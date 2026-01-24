import { createClient } from '@/lib/supabase/server'
import { PayoutsManager } from './PayoutsManager'

interface AuctionPayouts {
  championship_winner?: number
  championship_runnerup?: number
  points_1st?: number
  points_2nd?: number
  points_3rd?: number
  points_4th?: number
}

interface PickemPayouts {
  session_1st?: number
  session_2nd?: number
  session_3rd?: number
}

interface Winner {
  oderId: number
  oderlabel: string
  payout_type: string
  payout_label: string
  amount: number
  user_id: string | null
  user_name: string | null
  is_complete: boolean // Whether the contest has ended
}

export default async function PayoutsPage() {
  const supabase = await createClient()

  // Get active tournament with payout settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, auction_payouts, pickem_payouts, auction_complete')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
        <p className="text-zinc-400">No tournament found. Create one first.</p>
      </div>
    )
  }

  const auctionPayouts = tournament.auction_payouts as AuctionPayouts | null
  const pickemPayouts = tournament.pickem_payouts as PickemPayouts | null

  // Get all users for name lookups
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')

  const userMap = new Map((users || []).map(u => [u.id, u.display_name || u.phone || 'Unknown']))

  // Get existing payouts for this tournament (for paid status)
  const { data: existingPayouts } = await supabase
    .from('payouts')
    .select('*')
    .eq('tournament_id', tournament.id)

  const payoutMap = new Map((existingPayouts || []).map(p => [p.payout_type, p]))

  const winners: Winner[] = []
  let orderCounter = 0

  // ============================================
  // AUCTION WINNERS
  // ============================================

  // Get all games to determine championship winner/runner-up
  const { data: games } = await supabase
    .from('games')
    .select('id, round, winner_id, team1_id, team2_id, scheduled_at')
    .eq('tournament_id', tournament.id)
    .order('scheduled_at')

  // Get auction teams (who owns which team)
  const { data: auctionTeams } = await supabase
    .from('auction_teams')
    .select('user_id, team_id')
    .eq('tournament_id', tournament.id)

  // Get teams for seed info
  const { data: teams } = await supabase
    .from('teams')
    .select('id, seed')
    .eq('tournament_id', tournament.id)

  const teamSeedMap = new Map((teams || []).map(t => [t.id, t.seed]))

  // Find championship game (round 6)
  const championshipGame = (games || []).find(g => g.round === 6)
  const isAuctionComplete = championshipGame?.winner_id != null

  // Championship Winner - who owns the winning team
  let championUserId: string | null = null
  if (championshipGame?.winner_id) {
    const ownerEntry = (auctionTeams || []).find(at => at.team_id === championshipGame.winner_id)
    championUserId = ownerEntry?.user_id || null
  }

  winners.push({
    oderId: orderCounter++,
    oderlabel: 'Auction',
    payout_type: 'auction_champion',
    payout_label: 'Championship Winner',
    amount: auctionPayouts?.championship_winner || 0,
    user_id: championUserId,
    user_name: championUserId ? userMap.get(championUserId) || null : null,
    is_complete: isAuctionComplete,
  })

  // Championship Runner-up - who owns the losing finalist
  let runnerupUserId: string | null = null
  if (championshipGame?.winner_id) {
    const losingTeamId = championshipGame.team1_id === championshipGame.winner_id
      ? championshipGame.team2_id
      : championshipGame.team1_id
    if (losingTeamId) {
      const ownerEntry = (auctionTeams || []).find(at => at.team_id === losingTeamId)
      runnerupUserId = ownerEntry?.user_id || null
    }
  }

  winners.push({
    oderId: orderCounter++,
    oderlabel: 'Auction',
    payout_type: 'auction_runnerup',
    payout_label: 'Championship Runner-Up',
    amount: auctionPayouts?.championship_runnerup || 0,
    user_id: runnerupUserId,
    user_name: runnerupUserId ? userMap.get(runnerupUserId) || null : null,
    is_complete: isAuctionComplete,
  })

  // Points Winners - calculate points for each user
  // Points = sum of (seed × wins) for each team owned
  const userPoints = new Map<string, number>()

  for (const at of auctionTeams || []) {
    const teamWins = (games || []).filter(g => g.winner_id === at.team_id).length
    const seed = teamSeedMap.get(at.team_id) || 0
    const points = seed * teamWins
    userPoints.set(at.user_id, (userPoints.get(at.user_id) || 0) + points)
  }

  // Sort users by points descending
  const pointsLeaderboard = Array.from(userPoints.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  const pointsLabels = ['Points - 1st Place', 'Points - 2nd Place', 'Points - 3rd Place', 'Points - 4th Place']
  const pointsTypes = ['auction_points_1st', 'auction_points_2nd', 'auction_points_3rd', 'auction_points_4th']
  const pointsAmounts = [
    auctionPayouts?.points_1st || 0,
    auctionPayouts?.points_2nd || 0,
    auctionPayouts?.points_3rd || 0,
    auctionPayouts?.points_4th || 0,
  ]

  for (let i = 0; i < 4; i++) {
    const entry = pointsLeaderboard[i]
    winners.push({
      oderId: orderCounter++,
      oderlabel: 'Auction',
      payout_type: pointsTypes[i],
      payout_label: pointsLabels[i],
      amount: pointsAmounts[i],
      user_id: entry ? entry[0] : null,
      user_name: entry ? userMap.get(entry[0]) || null : null,
      is_complete: isAuctionComplete,
    })
  }

  // ============================================
  // PICK'EM WINNERS (per session)
  // ============================================

  // Pick'em uses Round 1 & 2 games directly from the games table (not pickem_games)
  const pickemRoundGames = (games || []).filter(g => g.round === 1 || g.round === 2)

  // Get enabled days from settings (e.g., ["Thursday", "Friday", "Saturday"])
  const enabledDays = (pickemPayouts as { enabled_days?: string[] })?.enabled_days || ['Thursday', 'Friday']

  // Helper to get day name from date
  const getDayName = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Get pickem days and filter by enabled days
  const { data: allPickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date')
    .eq('tournament_id', tournament.id)
    .order('contest_date')

  const pickemDays = (allPickemDays || []).filter(d => enabledDays.includes(getDayName(d.contest_date)))

  // Get all pickem entries (paid only)
  const pickemDayIds = (pickemDays || []).map(d => d.id)
  let pickemEntries: Array<{ id: string; user_id: string; pickem_day_id: string }> = []

  if (pickemDayIds.length > 0) {
    const { data } = await supabase
      .from('pickem_entries')
      .select('id, user_id, pickem_day_id')
      .eq('has_paid', true)
      .in('pickem_day_id', pickemDayIds)
    pickemEntries = data || []
  }

  // Get all picks (pickem_picks.game_id references games.id directly)
  const entryIds = pickemEntries.map(e => e.id)
  let pickemPicks: Array<{ id: string; entry_id: string; game_id: string; is_correct: boolean | null }> = []

  if (entryIds.length > 0) {
    const { data } = await supabase
      .from('pickem_picks')
      .select('id, entry_id, game_id, is_correct')
      .in('entry_id', entryIds)
    pickemPicks = data || []
  }

  // Group games by date (same as PickemClient)
  const gamesByDate = pickemRoundGames.reduce((acc, game) => {
    if (!game.scheduled_at) return acc
    const date = game.scheduled_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, typeof pickemRoundGames>)

  // Calculate session payouts dynamically (same as PickemClient)
  const entryFee = (pickemPayouts as { entry_fee?: number })?.entry_fee || 10

  const calculateSessionPayouts = (pot: number) => {
    const percentages = { first: 0.6, second: 0.3, third: 0.1 }
    const entries = Object.entries(percentages).map(([key, pct]) => {
      const raw = pot * pct
      const rounded = Math.round(raw / 5) * 5
      const diff = raw - rounded
      return { key, raw, rounded, diff }
    })

    let total = entries.reduce((sum, e) => sum + e.rounded, 0)
    let adjustment = pot - total

    while (adjustment !== 0) {
      if (adjustment > 0) {
        entries.sort((a, b) => b.diff - a.diff)
        entries[0].rounded += 5
        entries[0].diff -= 5
        adjustment -= 5
      } else {
        entries.sort((a, b) => a.diff - b.diff)
        entries[0].rounded -= 5
        entries[0].diff += 5
        adjustment += 5
      }
    }

    const result: Record<string, number> = {}
    entries.forEach(e => { result[e.key] = e.rounded })
    return result as { first: number; second: number; third: number }
  }

  // Format date for tabs - just weekday abbreviated (THU, FRI, SAT, SUN)
  const formatDateShort = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase()
  }

  // Format date for section headers - full weekday (THURSDAY, FRIDAY, etc.)
  const formatDateLong = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase()
  }

  // Process each day - split games into early/late by position (same as PickemClient)
  for (const day of pickemDays || []) {
    // Get games for this day from the grouped games
    const dayGames = gamesByDate[day.contest_date] || []
    const dateShort = formatDateShort(day.contest_date)
    const dateLong = formatDateLong(day.contest_date)

    // Calculate day pot from paid entries (same as PickemClient)
    const dayEntries = pickemEntries.filter(e => e.pickem_day_id === day.id)
    const dayPot = dayEntries.length * entryFee
    const sessionPot = Math.round((dayPot / 2) / 5) * 5  // Round session pot to $5
    const sessionPayouts = calculateSessionPayouts(sessionPot)

    // Split games by position: first half = early (session 1), second half = late (session 2)
    const midpoint = Math.ceil(dayGames.length / 2)
    const session1Games = dayGames.slice(0, midpoint)
    const session2Games = dayGames.slice(midpoint)

    // Process both sessions
    const sessionGameSets = [
      { session: 1, games: session1Games },
      { session: 2, games: session2Games },
    ]

    for (const { session, games: sessionGames } of sessionGameSets) {
      const sessionGameIds = new Set(sessionGames.map(g => g.id))

      // Session is complete if it has games and all have winners
      const hasGames = sessionGames.length > 0
      const isSessionComplete = hasGames && sessionGames.every(g => g.winner_id != null)

      // Calculate standings for this session (with tiebreaker logic from PickemClient)
      const completedSessionGames = sessionGames
        .filter(g => g.winner_id != null)
        .sort((a, b) => (a.scheduled_at || '').localeCompare(b.scheduled_at || ''))
      const completedGameIds = new Set(completedSessionGames.map(g => g.id))

      const standings = dayEntries.map(entry => {
        const entryPicks = pickemPicks.filter(p =>
          p.entry_id === entry.id && sessionGameIds.has(p.game_id)
        )
        const correctPicks = entryPicks.filter(p => p.is_correct === true && completedGameIds.has(p.game_id)).length

        // Tiebreaker: check each completed game in order
        // Missing picks count as losses!
        let firstLoss: number | null = null
        let secondLoss: number | null = null
        completedSessionGames.forEach((game, index) => {
          const pick = entryPicks.find(p => p.game_id === game.id)
          // Loss = no pick made OR pick was incorrect
          const isLoss = !pick || pick.is_correct === false
          if (isLoss) {
            if (firstLoss === null) firstLoss = index + 1
            else if (secondLoss === null) secondLoss = index + 1
          }
        })

        return { user_id: entry.user_id, correct_picks: correctPicks, first_loss: firstLoss, second_loss: secondLoss }
      }).sort((a, b) => {
        // Primary: most correct picks
        if (b.correct_picks !== a.correct_picks) return b.correct_picks - a.correct_picks
        // Tiebreaker 1: second loss position (later = better, null = best)
        if (a.second_loss !== b.second_loss) {
          if (a.second_loss === null) return -1
          if (b.second_loss === null) return 1
          return b.second_loss - a.second_loss
        }
        // Tiebreaker 2: first loss position (later = better, null = best)
        if (a.first_loss !== b.first_loss) {
          if (a.first_loss === null) return -1
          if (b.first_loss === null) return 1
          return b.first_loss - a.first_loss
        }
        return 0
      })

      const sessionName = session === 1 ? 'Early Games' : 'Late Games'
      const baseType = `pickem_${day.contest_date}_s${session}`

      // Helper to check if two entries are tied
      const isTied = (a: typeof standings[0], b: typeof standings[0]) => {
        if (!a || !b) return false
        return a.correct_picks === b.correct_picks &&
               a.second_loss === b.second_loss &&
               a.first_loss === b.first_loss
      }

      // Assign places with tie detection
      const placeAmounts = [sessionPayouts.first, sessionPayouts.second, sessionPayouts.third]
      let placeIndex = 0
      let standingsIndex = 0

      while (placeIndex < 3 && standingsIndex < standings.length) {
        // Find all people tied at this position
        const tiedEntries = [standings[standingsIndex]]
        while (standingsIndex + tiedEntries.length < standings.length &&
               isTied(standings[standingsIndex], standings[standingsIndex + tiedEntries.length])) {
          tiedEntries.push(standings[standingsIndex + tiedEntries.length])
        }

        // Calculate prize: sum of places they're tied for, split evenly
        let totalPrize = 0
        for (let p = placeIndex; p < Math.min(placeIndex + tiedEntries.length, 3); p++) {
          totalPrize += placeAmounts[p]
        }
        const splitPrize = Math.round(totalPrize / tiedEntries.length)

        // Create entries for each tied person
        const placeLabel = placeIndex === 0 ? '1st' : placeIndex === 1 ? '2nd' : '3rd'
        const tieLabel = tiedEntries.length > 1 ? ` (T-${tiedEntries.length})` : ''

        for (const entry of tiedEntries) {
          winners.push({
            oderId: orderCounter++,
            oderlabel: `${dateShort}|${dateLong} Pick'em ${sessionName}`,
            payout_type: `${baseType}_${placeLabel.toLowerCase()}_${entry.user_id}`,
            payout_label: `${placeLabel} Place${tieLabel}`,
            amount: splitPrize,
            user_id: entry.user_id,
            user_name: userMap.get(entry.user_id) || null,
            is_complete: isSessionComplete,
          })
        }

        standingsIndex += tiedEntries.length
        placeIndex += tiedEntries.length
      }

      // Fill remaining places if not enough entries
      while (placeIndex < 3) {
        const placeLabel = placeIndex === 0 ? '1st' : placeIndex === 1 ? '2nd' : '3rd'
        winners.push({
          oderId: orderCounter++,
          oderlabel: `${dateShort}|${dateLong} Pick'em ${sessionName}`,
          payout_type: `${baseType}_${placeLabel.toLowerCase()}`,
          payout_label: `${placeLabel} Place`,
          amount: placeAmounts[placeIndex],
          user_id: null,
          user_name: null,
          is_complete: isSessionComplete,
        })
        placeIndex++
      }
    }
  }

  // Merge with existing payout records (for is_paid status)
  const winnersWithPayStatus = winners.map(w => ({
    ...w,
    is_paid: payoutMap.get(w.payout_type)?.is_paid || false,
    payout_id: payoutMap.get(w.payout_type)?.id || null,
  }))

  return (
    <div className="space-y-6">
      <PayoutsManager
        tournamentId={tournament.id}
        winners={winnersWithPayStatus}
        pickemDates={(pickemDays || []).map(d => d.contest_date)}
      />
    </div>
  )
}
