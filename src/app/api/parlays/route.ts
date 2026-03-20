import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'
import { getEasternNow } from '@/lib/timezone'

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

    // Validate no duplicate pick types on the same game
    const gameIds = picks.map((p: { gameId: string }) => p.gameId)
    const pickKeys = picks.map((p: { gameId: string; pickType?: string }) => `${p.gameId}:${p.pickType || 'spread'}`)
    if (new Set(pickKeys).size !== 4) {
      return NextResponse.json({ error: 'Cannot have duplicate picks of the same type on the same game' }, { status: 400 })
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

    // Validate all picks have required fields
    for (const pick of picks) {
      const { gameId, pickType } = pick as { gameId: string; pickType?: string; teamId?: string; pickedOverUnder?: string }
      if (!gameId) {
        return NextResponse.json({ error: 'Each pick must have gameId' }, { status: 400 })
      }
      const type = pickType || 'spread'
      if (type === 'spread') {
        if (!pick.teamId) {
          return NextResponse.json({ error: 'Spread picks must have teamId' }, { status: 400 })
        }
      } else if (type === 'over_under') {
        if (!pick.pickedOverUnder || !['over', 'under'].includes(pick.pickedOverUnder)) {
          return NextResponse.json({ error: 'O/U picks must specify over or under' }, { status: 400 })
        }
      } else {
        return NextResponse.json({ error: 'Invalid pick type' }, { status: 400 })
      }
    }

    // Batch fetch all games at once instead of one-by-one
    const uniqueGameIds = [...new Set(gameIds)]
    const { data: allGames } = await supabase
      .from('games')
      .select('id, tournament_id, spread, over_under_total, team1_id, team2_id, scheduled_at')
      .in('id', uniqueGameIds)

    if (!allGames || allGames.length !== uniqueGameIds.length) {
      return NextResponse.json({ error: 'One or more games not found' }, { status: 404 })
    }

    const gamesById = new Map(allGames.map(g => [g.id, g]))

    // Get current time in Eastern timezone
    const easternTime = getEasternNow()

    // Validate all picks before inserting anything
    for (const pick of picks) {
      const { gameId, teamId, pickType, pickedOverUnder } = pick as { gameId: string; teamId?: string; pickType?: string; pickedOverUnder?: string }
      const type = pickType || 'spread'
      const game = gamesById.get(gameId)

      if (!game) {
        return NextResponse.json({ error: `Game not found: ${gameId}` }, { status: 404 })
      }

      if (game.tournament_id !== tournamentId) {
        return NextResponse.json({ error: 'Game does not belong to this tournament' }, { status: 400 })
      }

      if (type === 'spread') {
        if (game.spread === null) {
          return NextResponse.json({ error: 'Game does not have a spread assigned' }, { status: 400 })
        }
        if (teamId !== game.team1_id && teamId !== game.team2_id) {
          return NextResponse.json({ error: 'Team does not belong to the selected game' }, { status: 400 })
        }
      } else {
        if (game.over_under_total === null) {
          return NextResponse.json({ error: 'Game does not have an O/U total assigned' }, { status: 400 })
        }
      }

      if (game.scheduled_at) {
        const gameTime = new Date(game.scheduled_at)
        if (easternTime >= gameTime) {
          return NextResponse.json({ error: 'One or more selected games have already started' }, { status: 403 })
        }
      }
    }

    // All validation passed — now create the parlay
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
    const pickRows = picks.map((p: { gameId: string; teamId?: string; pickType?: string; pickedOverUnder?: string }) => ({
      parlay_id: parlay.id,
      game_id: p.gameId,
      pick_type: p.pickType || 'spread',
      picked_team_id: (p.pickType || 'spread') === 'spread' ? p.teamId : null,
      picked_over_under: p.pickType === 'over_under' ? p.pickedOverUnder : null,
      is_correct: null,
    }))

    const { error: picksError } = await dbClient
      .from('parlay_picks')
      .insert(pickRows)

    if (picksError) {
      console.error('Error creating parlay picks:', picksError)
      // Clean up the parlay if picks failed
      await dbClient.from('parlays').delete().eq('id', parlay.id)
      return NextResponse.json({ error: `Failed to create parlay picks: ${picksError.message}` }, { status: 500 })
    }

    return NextResponse.json({ success: true, parlayId: parlay.id })
  } catch (error) {
    console.error('Error in parlays API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
