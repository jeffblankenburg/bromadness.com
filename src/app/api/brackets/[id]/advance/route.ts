import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'

// POST - Advance winner in a match
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: bracketId } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for simulation
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId !== user.id

    // If simulating, verify the caller is an admin
    if (isSimulating) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized - admin required for simulation' }, { status: 403 })
      }
    }

    const activeUserId = simulatedUserId || user.id
    const dbClient = isSimulating ? createAdminClient() : supabase

    const { matchId, winnerId } = await request.json()

    if (!matchId || !winnerId) {
      return NextResponse.json({ error: 'Missing matchId or winnerId' }, { status: 400 })
    }

    // Verify ownership
    const { data: bracket, error: bracketError } = await supabase
      .from('custom_brackets')
      .select('created_by, bracket_type')
      .eq('id', bracketId)
      .single()

    if (bracketError || !bracket) {
      return NextResponse.json({ error: 'Bracket not found' }, { status: 404 })
    }

    if (bracket.created_by !== activeUserId) {
      return NextResponse.json({ error: 'Not authorized to modify this bracket' }, { status: 403 })
    }

    // Get the match
    const { data: match, error: matchError } = await supabase
      .from('custom_bracket_matches')
      .select('*')
      .eq('id', matchId)
      .eq('bracket_id', bracketId)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Verify winner is a participant in this match
    if (winnerId !== match.participant1_id && winnerId !== match.participant2_id) {
      return NextResponse.json({ error: 'Winner must be a participant in this match' }, { status: 400 })
    }

    // Determine loser
    const loserId = winnerId === match.participant1_id ? match.participant2_id : match.participant1_id

    // Update match winner
    const { error: updateError } = await dbClient
      .from('custom_bracket_matches')
      .update({ winner_id: winnerId })
      .eq('id', matchId)

    if (updateError) {
      console.error('Error updating match winner:', updateError)
      return NextResponse.json({ error: 'Failed to update match' }, { status: 500 })
    }

    // Special handling for Grand Finals in double elimination
    // GF1 (round 1): If winners bracket champ wins, they win tournament. If losers bracket champ wins, go to reset.
    // GF2 (round 2, reset): Winner takes the tournament.
    if (bracket.bracket_type === 'double' && match.bracket_side === 'finals') {
      if (match.round === 1) {
        // Grand Finals Match 1
        // participant1 = winners bracket champion, participant2 = losers bracket champion
        if (winnerId === match.participant1_id) {
          // Winners bracket champion wins - they win the tournament (no reset needed)
          const { data: winningParticipant } = await supabase
            .from('custom_bracket_participants')
            .select('user_id')
            .eq('id', winnerId)
            .single()

          if (winningParticipant) {
            await dbClient
              .from('custom_brackets')
              .update({ status: 'completed', winner_id: winningParticipant.user_id })
              .eq('id', bracketId)
          }

          // Mark loser as eliminated
          if (loserId) {
            await dbClient
              .from('custom_bracket_participants')
              .update({ is_eliminated: true, eliminated_at: new Date().toISOString() })
              .eq('id', loserId)
          }
        } else {
          // Losers bracket champion wins GF1 - need reset match
          // Both players go to the reset match (GF2)
          if (match.winner_goes_to_match_id) {
            // Winner (losers bracket champ) goes to slot 1
            await dbClient
              .from('custom_bracket_matches')
              .update({ participant1_id: winnerId })
              .eq('id', match.winner_goes_to_match_id)

            // Loser (winners bracket champ) goes to slot 2
            if (loserId) {
              await dbClient
                .from('custom_bracket_matches')
                .update({ participant2_id: loserId })
                .eq('id', match.winner_goes_to_match_id)
            }
          }
        }
      } else if (match.round === 2) {
        // Grand Finals Reset - winner takes the tournament
        const { data: winningParticipant } = await supabase
          .from('custom_bracket_participants')
          .select('user_id')
          .eq('id', winnerId)
          .single()

        if (winningParticipant) {
          await dbClient
            .from('custom_brackets')
            .update({ status: 'completed', winner_id: winningParticipant.user_id })
            .eq('id', bracketId)
        }

        // Mark loser as eliminated
        if (loserId) {
          await dbClient
            .from('custom_bracket_participants')
            .update({ is_eliminated: true, eliminated_at: new Date().toISOString() })
            .eq('id', loserId)
        }
      }

      return NextResponse.json({ success: true })
    }

    // Standard advancement for non-finals matches
    // Advance winner to next match if exists
    if (match.winner_goes_to_match_id) {
      const slot = match.winner_is_slot1 ? 'participant1_id' : 'participant2_id'

      const { error: advanceError } = await dbClient
        .from('custom_bracket_matches')
        .update({ [slot]: winnerId })
        .eq('id', match.winner_goes_to_match_id)

      if (advanceError) {
        console.error('Error advancing winner:', advanceError)
        return NextResponse.json({ error: 'Failed to advance winner' }, { status: 500 })
      }
    }

    // Handle loser in double elimination (for non-finals matches)
    if (bracket.bracket_type === 'double' && loserId && match.loser_goes_to_match_id) {
      // Find which slot the loser should go to in losers bracket
      const { data: loserMatch, error: loserMatchError } = await supabase
        .from('custom_bracket_matches')
        .select('participant1_id, participant2_id')
        .eq('id', match.loser_goes_to_match_id)
        .single()

      if (!loserMatchError && loserMatch) {
        // Put loser in first empty slot
        const slot = loserMatch.participant1_id === null ? 'participant1_id' : 'participant2_id'

        const { error: loserAdvanceError } = await dbClient
          .from('custom_bracket_matches')
          .update({ [slot]: loserId })
          .eq('id', match.loser_goes_to_match_id)

        if (loserAdvanceError) {
          console.error('Error advancing loser:', loserAdvanceError)
        }
      }
    }

    // If loser is out completely (single elim, or losers bracket loss), mark as eliminated
    if (
      bracket.bracket_type === 'single' ||
      (bracket.bracket_type === 'double' && match.bracket_side === 'losers')
    ) {
      if (loserId) {
        await dbClient
          .from('custom_bracket_participants')
          .update({ is_eliminated: true, eliminated_at: new Date().toISOString() })
          .eq('id', loserId)
      }
    }

    // Check if bracket is complete (for single elimination)
    if (bracket.bracket_type === 'single') {
      const { data: allMatches } = await supabase
        .from('custom_bracket_matches')
        .select('round, winner_id')
        .eq('bracket_id', bracketId)
        .eq('bracket_side', 'winners')
        .order('round', { ascending: false })
        .limit(1)

      if (allMatches && allMatches[0]?.winner_id) {
        const { data: winningParticipant } = await supabase
          .from('custom_bracket_participants')
          .select('user_id')
          .eq('id', allMatches[0].winner_id)
          .single()

        if (winningParticipant) {
          await dbClient
            .from('custom_brackets')
            .update({ status: 'completed', winner_id: winningParticipant.user_id })
            .eq('id', bracketId)
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in advance API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
