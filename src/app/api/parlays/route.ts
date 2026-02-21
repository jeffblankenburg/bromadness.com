import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'

// DELETE - Delete an unpaid parlay
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { parlayId } = await request.json()

    if (!parlayId) {
      return NextResponse.json({ error: 'Missing parlayId' }, { status: 400 })
    }

    // Fetch the parlay to verify ownership and paid status
    const { data: parlay } = await supabase
      .from('parlays')
      .select('id, user_id, has_paid')
      .eq('id', parlayId)
      .single()

    if (!parlay) {
      return NextResponse.json({ error: 'Parlay not found' }, { status: 404 })
    }

    // Check simulation mode
    const simulatedUserId = await getSimulatedUserId()
    const activeUserId = simulatedUserId || user.id

    if (parlay.user_id !== activeUserId) {
      return NextResponse.json({ error: 'Cannot delete another user\'s parlay' }, { status: 403 })
    }

    if (parlay.has_paid) {
      return NextResponse.json({ error: 'Cannot delete a paid parlay' }, { status: 403 })
    }

    // Use admin client if simulating
    const isSimulating = simulatedUserId && simulatedUserId !== user.id
    const dbClient = isSimulating ? createAdminClient() : supabase

    // Delete the parlay (parlay_picks cascade automatically)
    const { error } = await dbClient
      .from('parlays')
      .delete()
      .eq('id', parlayId)

    if (error) {
      console.error('Error deleting parlay:', error)
      return NextResponse.json({ error: 'Failed to delete parlay' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in parlays DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create a new parlay
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, tournamentId, betAmount, picks } = await request.json()

    if (!userId || !tournamentId || !betAmount || !picks) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate exactly 4 picks
    if (!Array.isArray(picks) || picks.length !== 4) {
      return NextResponse.json({ error: 'Exactly 4 picks are required' }, { status: 400 })
    }

    // Validate bet amount
    if (!Number.isInteger(betAmount) || betAmount < 1 || betAmount > 10) {
      return NextResponse.json({ error: 'Bet amount must be between $1 and $10' }, { status: 400 })
    }

    // Validate all game IDs are distinct
    const gameIds = picks.map((p: { gameId: string }) => p.gameId)
    if (new Set(gameIds).size !== 4) {
      return NextResponse.json({ error: 'Cannot pick the same game twice' }, { status: 400 })
    }

    // Check simulation mode
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId === userId && simulatedUserId !== user.id

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
      return NextResponse.json({ error: 'Cannot create parlays for another user' }, { status: 403 })
    }

    const dbClient = isSimulating ? createAdminClient() : supabase

    // Get current time in Eastern timezone
    const now = new Date()
    const easternTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))

    // Validate each pick
    for (const pick of picks) {
      const { gameId, teamId } = pick as { gameId: string; teamId: string }

      if (!gameId || !teamId) {
        return NextResponse.json({ error: 'Each pick must have gameId and teamId' }, { status: 400 })
      }

      // Fetch game and validate
      const { data: game } = await supabase
        .from('games')
        .select('id, tournament_id, spread, team1_id, team2_id, scheduled_at')
        .eq('id', gameId)
        .single()

      if (!game) {
        return NextResponse.json({ error: `Game not found: ${gameId}` }, { status: 404 })
      }

      if (game.tournament_id !== tournamentId) {
        return NextResponse.json({ error: 'Game does not belong to this tournament' }, { status: 400 })
      }

      if (game.spread === null) {
        return NextResponse.json({ error: 'Game does not have a spread assigned' }, { status: 400 })
      }

      // Validate team belongs to the game
      if (teamId !== game.team1_id && teamId !== game.team2_id) {
        return NextResponse.json({ error: 'Team does not belong to the selected game' }, { status: 400 })
      }

      // Server-side lock enforcement - game must not have started
      if (game.scheduled_at) {
        const gameTime = new Date(game.scheduled_at)
        if (easternTime >= gameTime) {
          return NextResponse.json({ error: 'One or more selected games have already started' }, { status: 403 })
        }
      }
    }

    // Create the parlay
    const { data: parlay, error: parlayError } = await dbClient
      .from('parlays')
      .insert({
        user_id: userId,
        tournament_id: tournamentId,
        bet_amount: betAmount,
      })
      .select()
      .single()

    if (parlayError) {
      console.error('Error creating parlay:', parlayError)
      return NextResponse.json({ error: 'Failed to create parlay' }, { status: 500 })
    }

    // Insert the 4 picks
    const pickRows = picks.map((p: { gameId: string; teamId: string }) => ({
      parlay_id: parlay.id,
      game_id: p.gameId,
      picked_team_id: p.teamId,
      is_correct: null,
    }))

    const { error: picksError } = await dbClient
      .from('parlay_picks')
      .insert(pickRows)

    if (picksError) {
      console.error('Error creating parlay picks:', picksError)
      // Clean up the parlay if picks failed
      await dbClient.from('parlays').delete().eq('id', parlay.id)
      return NextResponse.json({ error: 'Failed to create parlay picks' }, { status: 500 })
    }

    return NextResponse.json({ success: true, parlayId: parlay.id })
  } catch (error) {
    console.error('Error in parlays API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
