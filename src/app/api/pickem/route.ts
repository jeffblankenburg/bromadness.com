import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'

// POST - Save a pick (handles simulation mode)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, pickemDayId, gameId, teamId } = await request.json()

    if (!userId || !pickemDayId || !gameId || !teamId) {
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
    // Fetch pickem_day to get tournament_id and contest_date
    const { data: pickemDay } = await supabase
      .from('pickem_days')
      .select('tournament_id, contest_date')
      .eq('id', pickemDayId)
      .single()

    if (!pickemDay) {
      return NextResponse.json({ error: 'Pickem day not found' }, { status: 404 })
    }

    // Fetch tournament settings from database (never trust client)
    const { data: tournament } = await supabase
      .from('tournaments')
      .select('pickem_payouts')
      .eq('id', pickemDay.tournament_id)
      .single()

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const pickemPayouts = tournament.pickem_payouts as { lock_individual?: boolean } | null
    const lockIndividual = pickemPayouts?.lock_individual ?? false

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
      // Global mode: check if the first game OF THIS DAY has started
      // Get the contest_date and find the earliest game on that date
      const contestDate = pickemDay.contest_date // Format: YYYY-MM-DD
      const { data: firstGame } = await supabase
        .from('games')
        .select('scheduled_at')
        .eq('tournament_id', pickemDay.tournament_id)
        .gte('scheduled_at', `${contestDate}T00:00:00`)
        .lt('scheduled_at', `${contestDate}T23:59:59`)
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

    // Get or create entry
    let entryId: string

    const { data: existingEntry } = await dbClient
      .from('pickem_entries')
      .select('id')
      .eq('user_id', userId)
      .eq('pickem_day_id', pickemDayId)
      .single()

    if (existingEntry) {
      entryId = existingEntry.id
    } else {
      const { data: newEntry, error: entryError } = await dbClient
        .from('pickem_entries')
        .insert({ user_id: userId, pickem_day_id: pickemDayId })
        .select()
        .single()

      if (entryError) {
        console.error('Error creating entry:', entryError)
        return NextResponse.json({ error: 'Failed to create entry' }, { status: 500 })
      }
      entryId = newEntry.id
    }

    // Upsert the pick
    const { error: pickError } = await dbClient
      .from('pickem_picks')
      .upsert({
        entry_id: entryId,
        game_id: gameId,
        picked_team_id: teamId,
        is_correct: null,
      }, { onConflict: 'entry_id,game_id' })

    if (pickError) {
      console.error('Error saving pick:', pickError)
      return NextResponse.json({ error: 'Failed to save pick' }, { status: 500 })
    }

    return NextResponse.json({ success: true, entryId })
  } catch (error) {
    console.error('Error in pickem API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
