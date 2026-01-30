import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'

// DELETE - Reset all brocket picks for a tournament (admin only)
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { tournamentId } = await request.json()

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Get all entry IDs for this tournament
    const { data: entries } = await adminClient
      .from('brocket_entries')
      .select('id')
      .eq('tournament_id', tournamentId)

    if (entries && entries.length > 0) {
      const entryIds = entries.map(e => e.id)

      // Delete all picks for these entries
      const { error: deleteError } = await adminClient
        .from('brocket_picks')
        .delete()
        .in('entry_id', entryIds)

      if (deleteError) {
        console.error('Error deleting brocket picks:', deleteError)
        return NextResponse.json({ error: 'Failed to reset picks' }, { status: 500 })
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in brocket DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Save a brocket pick (handles simulation mode)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, tournamentId, gameId, teamId } = await request.json()

    if (!userId || !tournamentId || !gameId || !teamId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Check if this is a simulation (admin acting as another user)
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId === userId && simulatedUserId !== user.id

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
    } else if (userId !== user.id) {
      // Not simulating but trying to save for another user
      return NextResponse.json({ error: 'Cannot save picks for another user' }, { status: 403 })
    }

    // Use admin client if simulating, otherwise regular client
    const dbClient = isSimulating ? createAdminClient() : supabase

    // === SERVER-SIDE LOCK ENFORCEMENT ===
    // Fetch tournament settings and game data from database (never trust client)
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('brocket_payouts')
      .eq('id', tournamentId)
      .single()

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const brocketPayouts = tournament.brocket_payouts as { lock_individual?: boolean } | null
    const lockIndividual = brocketPayouts?.lock_individual ?? false

    // Get current time in Eastern timezone
    const now = new Date()
    const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))

    // Fetch the specific game's scheduled time
    const { data: game } = await supabase
      .from('games')
      .select('scheduled_at')
      .eq('id', gameId)
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    if (lockIndividual) {
      // Individual mode: check if THIS game has started
      if (game.scheduled_at) {
        const gameTime = new Date(game.scheduled_at)
        if (easternTime >= gameTime) {
          return NextResponse.json({ error: 'This game has already started - picks are locked' }, { status: 403 })
        }
      }
    } else {
      // Global mode: check if ANY Round 1 game has started
      const { data: firstGame } = await supabase
        .from('games')
        .select('scheduled_at')
        .eq('tournament_id', tournamentId)
        .eq('round', 1)
        .not('scheduled_at', 'is', null)
        .order('scheduled_at', { ascending: true })
        .limit(1)
        .single()

      if (firstGame?.scheduled_at) {
        const firstGameTime = new Date(firstGame.scheduled_at)
        if (easternTime >= firstGameTime) {
          return NextResponse.json({ error: 'Picks are locked - games have started' }, { status: 403 })
        }
      }
    }
    // === END LOCK ENFORCEMENT ===

    // Get or create brocket entry
    let entryId: string

    const { data: existingEntry } = await dbClient
      .from('brocket_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('tournament_id', tournamentId)
      .single()

    if (existingEntry) {
      entryId = existingEntry.id
    } else {
      const { data: newEntry, error: entryError } = await dbClient
        .from('brocket_entries')
        .insert({ user_id: userId, tournament_id: tournamentId })
        .select()
        .single()

      if (entryError) {
        console.error('Error creating brocket entry:', entryError)
        return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
      }
      entryId = newEntry.id
    }

    // Upsert the pick
    const { error: pickError } = await dbClient
      .from('brocket_picks')
      .upsert({
        entry_id: entryId,
        game_id: gameId,
        picked_team_id: teamId,
        is_correct: null,
      }, { onConflict: 'entry_id,game_id' })

    if (pickError) {
      console.error('Error saving brocket pick:', pickError)
      return NextResponse.json({ error: 'Failed to save pick' }, { status: 500 })
    }

    return NextResponse.json({ success: true, entryId })
  } catch (error) {
    console.error('Error in brocket API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
