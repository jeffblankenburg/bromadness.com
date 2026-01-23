import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DevTools } from '@/components/DevTools'
import { MenuDisplay } from '@/components/MenuDisplay'
import { AuctionTeamsCard } from '@/components/AuctionTeamsCard'
import { CurrentGames } from '@/components/CurrentGames'
import { ChatBubble } from '@/components/ChatBubble'
import { getActiveUserId } from '@/lib/simulation'

// Toggle to show/hide dev tools on home page
const SHOW_DEV_TOOLS = false

// Get tournament day based on start_date (Wednesday)
// Returns Wednesday, Thursday, Friday, Saturday, or Sunday
// Before tournament starts, defaults to Wednesday
function getTournamentDay(startDate: string | null): string {
  if (!startDate) return 'Wednesday'

  const start = new Date(startDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  const days = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

  if (diffDays < 0) return 'Wednesday' // Before tournament, show Wednesday
  if (diffDays > 4) return 'Sunday' // After tournament, show Sunday
  return days[diffDays]
}

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Redirect to login if not authenticated
  if (!user) {
    redirect('/login')
  }

  // Get active user ID (may be simulated)
  const activeUserId = await getActiveUserId(user.id)

  // Get user profile (for simulated user if simulating)
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('display_name, is_admin, casino_credits')
      .eq('id', activeUserId)
      .single()
    profile = data
  }

  // Get active tournament and menu items
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, start_date, auction_payouts, pickem_payouts, dev_simulated_time')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  let menuItems: Array<{
    id: string
    day: string
    meal_type: string | null
    item_name: string
    provider: string | null
  }> = []

  let currentGames: Array<{
    id: string
    scheduled_at: string | null
    team1_score: number | null
    team2_score: number | null
    winner_id: string | null
    location: string | null
    channel: string | null
    spread: number | null
    favorite_team_id: string | null
    team1: { id: string; name: string; short_name: string | null; seed: number } | null
    team2: { id: string; name: string; short_name: string | null; seed: number } | null
  }> = []

  let userAuctionTeams: Array<{
    team: { id: string; name: string; short_name: string | null; seed: number } | null
    bid_amount: number
    wins: number
    points: number
  }> = []
  let userTotalPoints = 0
  let userPlace = 0
  let userPayout = 0
  let userAuctionTeamIds: string[] = []
  let userPickemTeamIds: string[] = []
  let userPickemPayout = 0
  let tripBalance = 0
  let simulatedTime: string | null = null

  if (tournament) {
    simulatedTime = tournament.dev_simulated_time as string | null

    const { data } = await supabase
      .from('menu_items')
      .select('id, day, meal_type, item_name, provider')
      .eq('tournament_id', tournament.id)
      .order('sort_order')
    menuItems = data || []

    // Get current games (started in last 150 mins or starting in next 15 mins)
    // All times are stored as Eastern without timezone
    // Format helper for timestamp without timezone
    const formatTimestamp = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0')
      return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
    }

    // Parse simulated time or get current Eastern time
    let nowDate: Date
    if (simulatedTime) {
      // Parse the simulated time string directly (it's stored as Eastern)
      const match = simulatedTime.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
      if (match) {
        const [, year, month, day, hours, mins, secs] = match
        nowDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(mins), parseInt(secs || '0'))
      } else {
        nowDate = new Date()
      }
    } else {
      // Get current time in Eastern timezone
      const eastern = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
      nowDate = new Date(eastern)
    }

    const pastCutoff = formatTimestamp(new Date(nowDate.getTime() - 150 * 60 * 1000))
    const futureCutoff = formatTimestamp(new Date(nowDate.getTime() + 15 * 60 * 1000))

    const { data: gamesData } = await supabase
      .from('games')
      .select(`
        id, scheduled_at, team1_score, team2_score, winner_id, location, channel, spread, favorite_team_id,
        team1:teams!games_team1_id_fkey(id, name, short_name, seed),
        team2:teams!games_team2_id_fkey(id, name, short_name, seed)
      `)
      .eq('tournament_id', tournament.id)
      .is('winner_id', null)
      .gte('scheduled_at', pastCutoff)
      .lte('scheduled_at', futureCutoff)
      .order('scheduled_at')

    let gamesToShow = gamesData || []

    // Fallback: if no current games, show next 2 upcoming games
    if (gamesToShow.length === 0) {
      const nowTimestamp = formatTimestamp(nowDate)
      const { data: upcomingGames } = await supabase
        .from('games')
        .select(`
          id, scheduled_at, team1_score, team2_score, winner_id, location, channel, spread, favorite_team_id,
          team1:teams!games_team1_id_fkey(id, name, short_name, seed),
          team2:teams!games_team2_id_fkey(id, name, short_name, seed)
        `)
        .eq('tournament_id', tournament.id)
        .is('winner_id', null)
        .not('team1_id', 'is', null)
        .not('team2_id', 'is', null)
        .gte('scheduled_at', nowTimestamp)
        .order('scheduled_at')
        .limit(2)

      gamesToShow = upcomingGames || []
    }

    currentGames = gamesToShow.map(g => ({
      ...g,
      team1: Array.isArray(g.team1) ? g.team1[0] || null : g.team1,
      team2: Array.isArray(g.team2) ? g.team2[0] || null : g.team2,
    })) as typeof currentGames

    // Get completed games to count wins
    const { data: games } = await supabase
      .from('games')
      .select('winner_id')
      .eq('tournament_id', tournament.id)
      .not('winner_id', 'is', null)

    // Get ALL auction teams to calculate standings
    const { data: allAuctionData } = await supabase
      .from('auction_teams')
      .select('user_id, bid_amount, team:teams(id, name, short_name, seed)')
      .eq('tournament_id', tournament.id)

    // Calculate points per user
    const userPoints: Record<string, number> = {}
    for (const a of allAuctionData || []) {
      const teamData = a.team as unknown as { id: string; seed: number } | null
      if (teamData) {
        const wins = (games || []).filter(g => g.winner_id === teamData.id).length
        const points = teamData.seed * wins
        userPoints[a.user_id] = (userPoints[a.user_id] || 0) + points
      }
    }

    // Sort users by points to get rankings
    const sortedUsers = Object.entries(userPoints)
      .sort(([, a], [, b]) => b - a)

    // Find current user's place and calculate payout
    if (user) {
      userTotalPoints = userPoints[activeUserId] || 0
      const userIndex = sortedUsers.findIndex(([id]) => id === activeUserId)
      userPlace = userIndex >= 0 ? userIndex + 1 : 0

      // Calculate payout considering ties
      const payouts = tournament.auction_payouts as {
        points_1st?: number
        points_2nd?: number
        points_3rd?: number
        points_4th?: number
      } | null

      if (payouts && userPlace > 0 && userPlace <= 4) {
        const payoutAmounts = [
          payouts.points_1st || 0,
          payouts.points_2nd || 0,
          payouts.points_3rd || 0,
          payouts.points_4th || 0,
        ]

        // Find all users tied with current user
        const tiedUsers = sortedUsers.filter(([, pts]) => pts === userTotalPoints)
        const tiedCount = tiedUsers.length

        // Find the starting position (1-indexed)
        const startPos = sortedUsers.findIndex(([, pts]) => pts === userTotalPoints) + 1

        // Sum up all payouts for positions occupied by tied users
        let totalPayout = 0
        for (let i = startPos; i < startPos + tiedCount && i <= 4; i++) {
          totalPayout += payoutAmounts[i - 1]
        }

        // Split equally among tied users
        if (totalPayout > 0) {
          userPayout = Math.round((totalPayout / tiedCount) * 100) / 100
        }
      }

      // Get user's teams
      const userTeams = (allAuctionData || []).filter(a => a.user_id === activeUserId)
      userAuctionTeams = userTeams.map(a => {
        const teamData = a.team as unknown as { id: string; name: string; short_name: string | null; seed: number } | null
        const wins = teamData ? (games || []).filter(g => g.winner_id === teamData.id).length : 0
        const points = teamData ? teamData.seed * wins : 0
        return {
          team: teamData,
          bid_amount: a.bid_amount,
          wins,
          points,
        }
      })

      // Extract auction team IDs
      userAuctionTeamIds = userAuctionTeams
        .map(a => a.team?.id)
        .filter((id): id is string => id !== undefined && id !== null)

      // Get user's pickem picks for current games
      const currentGameIds = currentGames.map(g => g.id)
      if (currentGameIds.length > 0) {
        const { data: pickemPicks } = await supabase
          .from('pickem_picks')
          .select('picked_team_id, entry:pickem_entries!inner(user_id)')
          .in('game_id', currentGameIds)

        userPickemTeamIds = (pickemPicks || [])
          .filter(p => {
            const entry = p.entry as unknown as { user_id: string } | null
            return entry?.user_id === activeUserId
          })
          .map(p => p.picked_team_id)
          .filter((id): id is string => id !== null)
      }

      // Calculate user's pick'em payout
      // Entry fee per day, payouts auto-calculated: 1st=60%, 2nd=30%, 3rd=10%
      const pickemConfig = tournament.pickem_payouts as { entry_fee?: number } | null
      const entryFee = pickemConfig?.entry_fee || 10

      // Get pickem days for this tournament
      const { data: pickemDays } = await supabase
        .from('pickem_days')
        .select('id, contest_date')
        .eq('tournament_id', tournament.id)

      if (pickemDays && pickemDays.length > 0) {
        const dayIds = pickemDays.map(d => d.id)

        // Get all paid entries
        const { data: allEntries } = await supabase
          .from('pickem_entries')
          .select('id, user_id, pickem_day_id, has_paid')
          .in('pickem_day_id', dayIds)
          .eq('has_paid', true)

        // Get round 1 games (pick'em games) with results
        const { data: pickemGames } = await supabase
          .from('games')
          .select('id, scheduled_at, winner_id')
          .eq('tournament_id', tournament.id)
          .eq('round', 1)
          .not('winner_id', 'is', null)
          .order('scheduled_at')

        if (allEntries && pickemGames && pickemGames.length > 0) {
          const gameIds = pickemGames.map(g => g.id)
          const entryIds = allEntries.map(e => e.id)

          // Get all picks for completed games
          const { data: allPicks } = await supabase
            .from('pickem_picks')
            .select('id, entry_id, game_id, is_correct')
            .in('entry_id', entryIds)
            .in('game_id', gameIds)

          if (allPicks) {
            // Group games by date and session
            const gamesByDate: Record<string, typeof pickemGames> = {}
            for (const game of pickemGames) {
              if (game.scheduled_at) {
                const date = game.scheduled_at.split('T')[0]
                if (!gamesByDate[date]) gamesByDate[date] = []
                gamesByDate[date].push(game)
              }
            }

            // Calculate payouts for each session the user is in the money
            for (const date of Object.keys(gamesByDate)) {
              const dayGames = gamesByDate[date]
              const midpoint = Math.ceil(dayGames.length / 2)
              const sessions = [
                dayGames.slice(0, midpoint),
                dayGames.slice(midpoint),
              ]

              const pickemDay = pickemDays.find(d => d.contest_date === date)
              if (!pickemDay) continue

              // Calculate session pot for this day
              const paidEntriesForDay = allEntries.filter(e => e.pickem_day_id === pickemDay.id).length
              const dayPot = paidEntriesForDay * entryFee
              const sessionPot = dayPot / 2
              const sessionPayouts = {
                first: Math.floor(sessionPot * 0.6),
                second: Math.floor(sessionPot * 0.3),
                third: Math.floor(sessionPot * 0.1),
              }

              for (const sessionGames of sessions) {
                if (sessionGames.length === 0) continue
                const sessionGameIds = sessionGames.map(g => g.id)

                // Calculate correct picks per user for this session
                const userCorrectPicks: Record<string, number> = {}
                const dayEntries = allEntries.filter(e => e.pickem_day_id === pickemDay.id)

                for (const entry of dayEntries) {
                  const entryPicks = allPicks.filter(p =>
                    p.entry_id === entry.id &&
                    p.game_id &&
                    sessionGameIds.includes(p.game_id) &&
                    p.is_correct === true
                  )
                  userCorrectPicks[entry.user_id] = entryPicks.length
                }

                // Sort by correct picks to get rankings
                const sortedPickemUsers = Object.entries(userCorrectPicks)
                  .sort(([, a], [, b]) => b - a)

                const userScore = userCorrectPicks[activeUserId] || 0
                if (userScore === 0) continue

                // Find user's rank (with ties)
                const rank = sortedPickemUsers.findIndex(([, score]) => score === userScore) + 1

                if (rank <= 3) {
                  const payoutAmounts = [
                    sessionPayouts.first,
                    sessionPayouts.second,
                    sessionPayouts.third,
                  ]

                  // Find all users tied at this score
                  const tiedUsers = sortedPickemUsers.filter(([, score]) => score === userScore)
                  const tiedCount = tiedUsers.length

                  // Sum payouts for positions occupied by tied users
                  let totalPayout = 0
                  for (let i = rank; i < rank + tiedCount && i <= 3; i++) {
                    totalPayout += payoutAmounts[i - 1]
                  }

                  // Split equally (round down to whole dollars)
                  if (totalPayout > 0) {
                    userPickemPayout += Math.floor(totalPayout / tiedCount)
                  }
                }
              }
            }
          }
        }
      }

      // Get user's trip cost balance
      const { data: tripCost } = await supabase
        .from('trip_costs')
        .select('id, amount_owed')
        .eq('tournament_id', tournament.id)
        .eq('user_id', activeUserId)
        .single()

      if (tripCost) {
        const { data: tripPayments } = await supabase
          .from('trip_payments')
          .select('amount')
          .eq('trip_cost_id', tripCost.id)

        const totalPaid = (tripPayments || []).reduce((sum, p) => sum + p.amount, 0)
        tripBalance = tripCost.amount_owed - totalPaid
      }
    }
  }

  const currentDay = getTournamentDay(tournament?.start_date ?? null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col items-center p-6 pt-8">
      {/* DEV ONLY - Toggle with SHOW_DEV_TOOLS flag */}
      {SHOW_DEV_TOOLS && user && profile && <DevTools isAdmin={profile.is_admin ?? false} />}

      <div className="text-center space-y-6 w-full max-w-sm">
            <div className="space-y-4">
              {profile?.display_name && (
                <h1
                  className="text-4xl text-orange-400 uppercase tracking-wide"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {profile.display_name}
                </h1>
              )}

              {/* Trip Balance Reminder */}
              {tripBalance > 0 && (
                <div className="rotating-border p-3">
                  <div className="relative z-10 text-red-400 text-sm font-medium">
                    You still owe Bro <span className="text-red-300 font-bold">${tripBalance.toFixed(0)}</span> for the trip!!
                  </div>
                </div>
              )}

              {/* Current Games */}
              {currentGames.length > 0 && (
                <CurrentGames
                  games={currentGames}
                  userAuctionTeamIds={userAuctionTeamIds}
                  userPickemTeamIds={userPickemTeamIds}
                  pickemPayout={userPickemPayout}
                  simulatedTime={simulatedTime}
                />
              )}

              {/* User's Auction Teams */}
              <AuctionTeamsCard
                teams={userAuctionTeams}
                totalPoints={userTotalPoints}
                payout={userPayout}
              />

              {/* Today's Menu */}
              {menuItems.length > 0 && (
                <Link href="/menu" className="block">
                  <div className="hover:opacity-80 transition-opacity">
                    <MenuDisplay items={menuItems} currentDay={currentDay} hideAlwaysAvailable />
                  </div>
                </Link>
              )}
            </div>
      </div>

      {/* Chat bubble - floating button */}
      <ChatBubble />
    </div>
  )
}
