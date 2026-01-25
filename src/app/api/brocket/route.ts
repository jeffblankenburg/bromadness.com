import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'

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
