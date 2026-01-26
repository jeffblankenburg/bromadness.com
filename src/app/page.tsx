import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { DevTools } from '@/components/DevTools'
import { MenuDisplay } from '@/components/MenuDisplay'
import { AuctionTeamsCard } from '@/components/AuctionTeamsCard'
import { CurrentGames } from '@/components/CurrentGames'
import { ChatBubble } from '@/components/ChatBubble'
import { InstallPrompt } from '@/components/InstallPrompt'
import { NotificationPrompt } from '@/components/NotificationPrompt'
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
  let userAuctionTeamIds: string[] = []
  let userPickemTeamIds: string[] = []
  let userBrocketTeamIds: string[] = []
  let tripBalance = 0
  let simulatedTime: string | null = null
  let totalWinnings = 0

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

    // Find current user's points
    if (user) {
      userTotalPoints = userPoints[activeUserId] || 0

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

        // Get user's brocket picks for current games (Round 1 only)
        const { data: brocketEntry } = await supabase
          .from('brocket_entries')
          .select('id')
          .eq('user_id', activeUserId)
          .eq('tournament_id', tournament.id)
          .single()

        if (brocketEntry) {
          const { data: brocketPicks } = await supabase
            .from('brocket_picks')
            .select('picked_team_id')
            .eq('entry_id', brocketEntry.id)
            .in('game_id', currentGameIds)

          userBrocketTeamIds = (brocketPicks || [])
            .map(p => p.picked_team_id)
            .filter((id): id is string => id !== null)
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

      // Get total paid winnings for this user
      const { data: paidPayouts } = await supabase
        .from('payouts')
        .select('amount')
        .eq('tournament_id', tournament.id)
        .eq('user_id', activeUserId)
        .eq('is_paid', true)

      totalWinnings = (paidPayouts || []).reduce((sum, p) => sum + p.amount, 0)
    }
  }

  const currentDay = getTournamentDay(tournament?.start_date ?? null)

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col items-center px-6 pb-6"
      style={{
        marginTop: 'calc(-1 * (env(safe-area-inset-top) + 12px))',
        paddingTop: 'env(safe-area-inset-top)'
      }}
    >
      {/* DEV ONLY - Toggle with SHOW_DEV_TOOLS flag */}
      {SHOW_DEV_TOOLS && user && profile && <DevTools isAdmin={profile.is_admin ?? false} />}

      {/* Page Header */}
      <div className="bg-orange-500 -mx-6 px-6 py-2 mb-4 w-screen">
        <h1 className="text-xl font-bold text-white text-center" style={{ fontFamily: 'var(--font-display)' }}>
          Welcome to Bro Madness
        </h1>
      </div>

      <div className="text-center space-y-4 w-full max-w-sm">
        <InstallPrompt />
        <NotificationPrompt />
            <div className="space-y-3">
              {/* Name and Winnings */}
              {(() => {
                const fullName = profile?.display_name || ''
                const shouldTruncate = totalWinnings > 0 && fullName.length > 10
                const displayName = shouldTruncate ? fullName.slice(0, 10) + '...' : fullName
                const nameLength = shouldTruncate ? 10 : fullName.length
                const nameSize = nameLength <= 5 ? 'text-6xl' :
                                 nameLength <= 8 ? 'text-5xl' :
                                 nameLength <= 12 ? 'text-4xl' : 'text-3xl'

                return totalWinnings > 0 ? (
                  <div className="flex items-center justify-between">
                    {displayName && (
                      <h1
                        className={`${nameSize} text-white uppercase tracking-wide text-left`}
                        style={{ fontFamily: 'var(--font-display)' }}
                      >
                        {displayName}
                      </h1>
                    )}
                    <div className="w-20 h-20 flex-shrink-0 bg-gradient-to-br from-green-900/60 to-emerald-900/60 border border-green-500/50 rounded-xl flex flex-col items-center justify-center">
                      <div className="text-green-400 text-[10px] font-medium uppercase tracking-wide">
                        Winnings
                      </div>
                      <div className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                        ${totalWinnings}
                      </div>
                    </div>
                  </div>
                ) : (
                  displayName && (
                    <h1
                      className={`${nameSize} text-white uppercase tracking-wide`}
                      style={{ fontFamily: 'var(--font-display)' }}
                    >
                      {displayName}
                    </h1>
                  )
                )
              })()}

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
                  userBrocketTeamIds={userBrocketTeamIds}
                  simulatedTime={simulatedTime}
                />
              )}

              {/* User's Auction Teams */}
              <AuctionTeamsCard
                teams={userAuctionTeams}
                totalPoints={userTotalPoints}
              />

              {/* View Bracket Button */}
              <Link href="/bracket" className="block">
                <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4 hover:bg-zinc-700/50 transition-colors">
                  <div className="flex items-center justify-center gap-3">
                    <svg className="w-6 h-6 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
                    </svg>
                    <span className="text-lg font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                      View Bracket
                    </span>
                  </div>
                </div>
              </Link>

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
