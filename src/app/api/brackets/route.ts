import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'
import { generateBracket } from '@/lib/custom-brackets/generate'

// GET - List user's brackets
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: brackets, error } = await supabase
      .from('custom_brackets')
      .select(`
        id,
        name,
        bracket_type,
        status,
        winner_id,
        created_at,
        custom_bracket_participants(id)
      `)
      .eq('created_by', user.id)
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching brackets:', error)
      return NextResponse.json({ error: 'Failed to fetch brackets' }, { status: 500 })
    }

    // Add participant count
    const bracketsWithCount = brackets?.map(b => ({
      ...b,
      participant_count: b.custom_bracket_participants?.length || 0,
      custom_bracket_participants: undefined,
    })) || []

    return NextResponse.json({ brackets: bracketsWithCount })
  } catch (error) {
    console.error('Error in brackets API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new bracket
export async function POST(request: Request) {
  try {
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

    const { name, bracketType, participantUserIds } = await request.json()

    if (!name || !bracketType || !participantUserIds) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!Array.isArray(participantUserIds) || participantUserIds.length < 2) {
      return NextResponse.json({ error: 'At least 2 participants required' }, { status: 400 })
    }

    if (!['single', 'double'].includes(bracketType)) {
      return NextResponse.json({ error: 'Invalid bracket type' }, { status: 400 })
    }

    // Generate bracket structure
    const { participants, matches } = generateBracket(participantUserIds, bracketType)

    // Create bracket
    const { data: bracket, error: bracketError } = await dbClient
      .from('custom_brackets')
      .insert({
        name,
        created_by: activeUserId,
        bracket_type: bracketType,
        status: 'active',
      })
      .select()
      .single()

    if (bracketError) {
      console.error('Error creating bracket:', bracketError)
      return NextResponse.json({ error: 'Failed to create bracket' }, { status: 500 })
    }

    // Insert participants
    const participantsToInsert = participants.map(p => ({
      id: p.id,
      bracket_id: bracket.id,
      user_id: p.user_id,
      seed: p.seed,
    }))

    const { error: participantsError } = await dbClient
      .from('custom_bracket_participants')
      .insert(participantsToInsert)

    if (participantsError) {
      console.error('Error creating participants:', participantsError)
      // Clean up bracket
      await dbClient.from('custom_brackets').delete().eq('id', bracket.id)
      return NextResponse.json({ error: 'Failed to create participants' }, { status: 500 })
    }

    // Insert matches
    const matchesToInsert = matches.map(m => ({
      id: m.id,
      bracket_id: bracket.id,
      round: m.round,
      match_number: m.match_number,
      bracket_side: m.bracket_side,
      participant1_id: m.participant1_id,
      participant2_id: m.participant2_id,
      winner_id: m.winner_id,
      loser_goes_to_match_id: m.loser_goes_to_match_id,
      winner_goes_to_match_id: m.winner_goes_to_match_id,
      winner_is_slot1: m.winner_is_slot1,
    }))

    const { error: matchesError } = await dbClient
      .from('custom_bracket_matches')
      .insert(matchesToInsert)

    if (matchesError) {
      console.error('Error creating matches:', matchesError)
      // Clean up bracket (cascade will clean participants)
      await dbClient.from('custom_brackets').delete().eq('id', bracket.id)
      return NextResponse.json({ error: 'Failed to create matches' }, { status: 500 })
    }

    return NextResponse.json({ id: bracket.id })
  } catch (error) {
    console.error('Error in brackets API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
