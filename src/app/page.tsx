import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MenuDisplay } from '@/components/MenuDisplay'
import { AuctionTeamsCard } from '@/components/AuctionTeamsCard'
import { CurrentGames } from '@/components/CurrentGames'
import { ChatBubble } from '@/components/ChatBubble'
import { InstallPrompt } from '@/components/InstallPrompt'
import { NotificationPrompt } from '@/components/NotificationPrompt'
import { ActiveUsers } from '@/components/ActiveUsers'
import { SoundboardPanel } from '@/components/SoundboardPanel'
import { ThemeSongButton } from '@/components/ThemeSongButton'
import { getActiveUserId } from '@/lib/simulation'
import { extractRelation } from '@/lib/supabase/helpers'
import { getEasternNow } from '@/lib/timezone'
import { PicksDueBanner } from '@/components/PicksDueBanner'

// Toggle to show/hide dev tools on home page

// Get tournament day based on start_date (Wednesday)
// Returns Wednesday, Thursday, Friday, Saturday, or Sunday
// Before tournament starts, defaults to Wednesday
function getTournamentDay(startDate: string | null): string {
  if (!startDate) return 'Wednesday'

  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

  const start = new Date(startDate + 'T00:00:00')
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const diffDays = Math.floor((today.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) return dayNames[start.getDay()] // Before tournament, show start day
  if (diffDays > 4) return dayNames[(start.getDay() + 4) % 7] // After tournament, show last day
  return dayNames[(start.getDay() + diffDays) % 7]
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
      .select('display_name, is_admin, casino_credits, can_use_soundboard')
      .eq('id', activeUserId)
      .maybeSingle()
    profile = data
  }

  // Get active tournament and menu items
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, start_date, auction_payouts, pickem_payouts, dev_simulated_time')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

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
  let userParlayTeamIds: string[] = []
  let tripBalance = 0
  let simulatedTime: string | null = null
  let totalWinnings = 0
  let pickemMissing = 0
  let brocketMissing = 0

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
      nowDate = getEasternNow()
    }

    const todayStr = formatTimestamp(nowDate).split('T')[0]

    // Check if today is first Thursday of tournament (brocket reminder day)
    const thursdayDate = new Date(tournament.start_date + 'T00:00:00')
    thursdayDate.setDate(thursdayDate.getDate() + 1) // Wednesday + 1 = Thursday
    const isFirstThursday = todayStr === formatTimestamp(thursdayDate).split('T')[0]

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

    // Fetch completed games and auction teams in parallel
    const [{ data: games }, { data: allAuctionData }] = await Promise.all([
      supabase
        .from('games')
        .select('winner_id, team1_id, team2_id')
        .eq('tournament_id', tournament.id)
        .gt('round', 0)
        .not('winner_id', 'is', null),
      supabase
        .from('auction_teams')
        .select('user_id, bid_amount, team:teams(id, name, short_name, seed)')
        .eq('tournament_id', tournament.id),
    ])

    // Pre-compute wins by team ID in O(n) instead of O(n*m)
    const winsByTeamId: Record<string, number> = {}
    const eliminatedTeamIds = new Set<string>()
    for (const g of games || []) {
      if (g.winner_id) {
        winsByTeamId[g.winner_id] = (winsByTeamId[g.winner_id] || 0) + 1
        // The loser is the other team in the game
        if (g.team1_id && g.team1_id !== g.winner_id) eliminatedTeamIds.add(g.team1_id)
        if (g.team2_id && g.team2_id !== g.winner_id) eliminatedTeamIds.add(g.team2_id)
      }
    }

    // Calculate points per user using pre-computed map
    const userPoints: Record<string, number> = {}
    for (const a of allAuctionData || []) {
      const teamData = extractRelation<{ id: string; seed: number }>(a.team)
      if (teamData) {
        const wins = winsByTeamId[teamData.id] || 0
        const points = teamData.seed * wins
        userPoints[a.user_id] = (userPoints[a.user_id] || 0) + points
      }
    }

    // Find current user's points
    if (user) {
      userTotalPoints = userPoints[activeUserId] || 0

      // Get user's teams
      const userTeams = (allAuctionData || []).filter(a => a.user_id === activeUserId)
      userAuctionTeams = userTeams.map(a => {
        const teamData = extractRelation<{ id: string; name: string; short_name: string | null; seed: number }>(a.team)
        const wins = teamData ? (winsByTeamId[teamData.id] || 0) : 0
        const points = teamData ? teamData.seed * wins : 0
        return {
          team: teamData,
          bid_amount: a.bid_amount,
          wins,
          points,
          isEliminated: teamData ? eliminatedTeamIds.has(teamData.id) : false,
        }
      })

      // Extract auction team IDs
      userAuctionTeamIds = userAuctionTeams
        .map(a => a.team?.id)
        .filter((id): id is string => id !== undefined && id !== null)

      // Fetch user-specific data in parallel
      const currentGameIds = currentGames.map(g => g.id)

      const [
        pickemResult,
        brocketEntryResult,
        parlayResult,
        tripCostResult,
        payoutsResult,
        todayPickemDayResult,
        todayGamesResult,
        allBrocketGamesResult,
      ] = await Promise.all([
        // Pickem picks
        currentGameIds.length > 0
          ? supabase.from('pickem_picks').select('picked_team_id, entry:pickem_entries!inner(user_id)').in('game_id', currentGameIds)
          : Promise.resolve({ data: null }),
        // Brocket entry
        supabase.from('brocket_entries').select('id').eq('user_id', activeUserId).eq('tournament_id', tournament.id).maybeSingle(),
        // Parlay picks
        currentGameIds.length > 0
          ? supabase.from('parlay_picks').select('picked_team_id, parlay:parlays!inner(user_id)').in('game_id', currentGameIds)
          : Promise.resolve({ data: null }),
        // Trip cost
        supabase.from('trip_costs').select('id, amount_owed').eq('tournament_id', tournament.id).eq('user_id', activeUserId).maybeSingle(),
        // Paid payouts
        supabase.from('payouts').select('amount').eq('tournament_id', tournament.id).eq('user_id', activeUserId).eq('is_paid', true),
        // Today's pickem day (for picks due banner)
        supabase.from('pickem_days').select('id').eq('tournament_id', tournament.id).eq('contest_date', todayStr).maybeSingle(),
        // Today's games for pickem count
        supabase.from('games').select('id').eq('tournament_id', tournament.id).in('round', [1, 2]).gte('scheduled_at', todayStr + 'T00:00:00').lte('scheduled_at', todayStr + 'T23:59:59'),
        // All R1+R2 games for brocket count (only fetched on first Thursday)
        isFirstThursday
          ? supabase.from('games').select('id, scheduled_at').eq('tournament_id', tournament.id).in('round', [1, 2])
          : Promise.resolve({ data: null }),
      ])

      // Process pickem picks
      userPickemTeamIds = (pickemResult.data || [])
        .filter(p => {
          const entry = extractRelation<{ user_id: string }>(p.entry)
          return entry?.user_id === activeUserId
        })
        .map(p => p.picked_team_id)
        .filter((id): id is string => id !== null)

      // Process brocket picks (needs sequential fetch for entry-based lookup)
      if (brocketEntryResult.data && currentGameIds.length > 0) {
        const { data: brocketPicks } = await supabase
          .from('brocket_picks')
          .select('picked_team_id')
          .eq('entry_id', brocketEntryResult.data.id)
          .in('game_id', currentGameIds)

        userBrocketTeamIds = (brocketPicks || [])
          .map(p => p.picked_team_id)
          .filter((id): id is string => id !== null)
      }

      // Process parlay picks
      userParlayTeamIds = (parlayResult.data || [])
        .filter(p => {
          const parlay = extractRelation<{ user_id: string }>(p.parlay)
          return parlay?.user_id === activeUserId
        })
        .map(p => p.picked_team_id)
        .filter((id): id is string => id !== null)

      // Process trip cost balance
      if (tripCostResult.data) {
        const { data: tripPayments } = await supabase
          .from('trip_payments')
          .select('amount')
          .eq('trip_cost_id', tripCostResult.data.id)

        const totalPaid = (tripPayments || []).reduce((sum, p) => sum + p.amount, 0)
        tripBalance = tripCostResult.data.amount_owed - totalPaid
      }

      // Process winnings
      totalWinnings = (payoutsResult.data || []).reduce((sum, p) => sum + p.amount, 0)

      // Check for incomplete picks due today
      const todayPickemDay = todayPickemDayResult.data
      const todayGamesList = todayGamesResult.data || []
      if (todayPickemDay && todayGamesList.length > 0) {
        const { data: todayEntry } = await supabase
          .from('pickem_entries')
          .select('id')
          .eq('user_id', activeUserId)
          .eq('pickem_day_id', todayPickemDay.id)
          .maybeSingle()

        if (todayEntry) {
          const todayGameIds = todayGamesList.map((g: { id: string }) => g.id)
          const { data: todayPicks } = await supabase
            .from('pickem_picks')
            .select('id')
            .eq('entry_id', todayEntry.id)
            .in('game_id', todayGameIds)

          pickemMissing = todayGamesList.length - (todayPicks?.length || 0)
        } else {
          pickemMissing = todayGamesList.length
        }
      }

      // Check brocket picks (only on first Thursday)
      if (isFirstThursday) {
        const allBrocketGames = (allBrocketGamesResult.data || []).filter((g: { id: string; scheduled_at: string | null }) => {
          if (!g.scheduled_at) return false
          const d = new Date(g.scheduled_at.split('T')[0] + 'T12:00:00')
          return [4, 5, 6].includes(d.getDay())
        })
        if (allBrocketGames.length > 0) {
          if (brocketEntryResult.data) {
            const brocketGameIds = allBrocketGames.map((g: { id: string }) => g.id)
            const { data: brocketPicksData } = await supabase
              .from('brocket_picks')
              .select('game_id')
              .eq('entry_id', brocketEntryResult.data.id)
              .in('game_id', brocketGameIds)

            brocketMissing = allBrocketGames.length - (brocketPicksData?.length || 0)
          } else {
            brocketMissing = allBrocketGames.length
          }
        }
      }
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
      {/* Page Header */}
      <div className="bg-orange-500 -mx-6 px-6 py-2 mb-4 w-screen">
        <h1 className="text-xl font-bold text-white text-center" style={{ fontFamily: 'var(--font-display)' }}>
          Welcome to Bro Madness
        </h1>
      </div>

      <div className="text-center space-y-4 w-full max-w-sm">
        <InstallPrompt />
        <NotificationPrompt />
        <PicksDueBanner pickemMissing={pickemMissing} brocketMissing={brocketMissing} />
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
                <div className="space-y-2">
                  <div className="rotating-border p-3">
                    <div className="relative z-10 text-red-400 text-sm font-medium">
                      You still owe Bro <span className="text-red-300 font-bold">${tripBalance.toFixed(0)}</span> for the trip!!
                    </div>
                  </div>
                  <a
                    href={`https://venmo.com/Brett-Lyme?txn=pay&amount=${Math.ceil(tripBalance)}&note=Bro%20Madness%20Trip`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl bg-[#008CFF] text-white font-bold text-sm uppercase tracking-wide hover:bg-[#0074D4] transition-colors"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.5 3c.9 1.5 1.3 3 1.3 5 0 5.5-4.7 12.7-8.5 17H5.2L3 3.5l5.5-.5 1.2 10c1.1-1.8 2.5-4.6 2.5-6.5 0-1.9-.3-3.2-.8-4.2L19.5 3Z" />
                    </svg>
                    Pay ${Math.ceil(tripBalance)} via Venmo
                  </a>
                </div>
              )}

              {/* Current Games */}
              {currentGames.length > 0 && (
                <CurrentGames
                  games={currentGames}
                  userAuctionTeamIds={userAuctionTeamIds}
                  userPickemTeamIds={userPickemTeamIds}
                  userBrocketTeamIds={userBrocketTeamIds}
                  userParlayTeamIds={userParlayTeamIds}
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
                      View Full Bracket
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

              <ActiveUsers userId={activeUserId} displayName={profile?.display_name || 'Unknown'} />

              {profile?.can_use_soundboard && (
                <SoundboardPanel
                  displayName={profile.display_name || 'Unknown'}
                  userId={activeUserId}
                  isAdmin={profile.is_admin ?? false}
                />
              )}

              {(() => {
                if (!tournament?.start_date) return null
                const start = new Date(tournament.start_date + 'T00:00:00')
                const now = simulatedTime
                  ? (() => {
                      const match = simulatedTime.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
                      if (match) {
                        const [, y, mo, d, h, mi, s] = match
                        return new Date(+y, +mo - 1, +d, +h, +mi, +(s || '0'))
                      }
                      return getEasternNow()
                    })()
                  : getEasternNow()
                return now >= start ? <ThemeSongButton /> : null
              })()}

              {/* Spacer for bottom navigation */}
              <div className="h-4" />
            </div>
      </div>

      {/* Chat bubble - floating button */}
      <ChatBubble />
    </div>
  )
}
