import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { DevTools } from '@/components/DevTools'
import { MenuDisplay } from '@/components/MenuDisplay'

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

  // If logged in, try to get user profile
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('display_name, is_admin, casino_credits')
      .eq('id', user.id)
      .single()
    profile = data
  }

  // Get active tournament and menu items
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, start_date, auction_payouts')
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

  let userAuctionTeams: Array<{
    team: { id: string; name: string; short_name: string | null; seed: number } | null
    bid_amount: number
    wins: number
    points: number
  }> = []
  let userTotalPoints = 0
  let userPlace = 0
  let userPayout = 0

  if (tournament) {
    const { data } = await supabase
      .from('menu_items')
      .select('id, day, meal_type, item_name, provider')
      .eq('tournament_id', tournament.id)
      .order('sort_order')
    menuItems = data || []

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
      userTotalPoints = userPoints[user.id] || 0
      const userIndex = sortedUsers.findIndex(([id]) => id === user.id)
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
      const userTeams = (allAuctionData || []).filter(a => a.user_id === user.id)
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
    }
  }

  const currentDay = getTournamentDay(tournament?.start_date ?? null)

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col items-center justify-center p-6">
      {/* DEV ONLY - Remove before launch */}
      {user && profile && <DevTools isAdmin={profile.is_admin ?? false} />}

      <div className="text-center space-y-6 w-full max-w-sm">
          {user ? (
            <div className="space-y-4">
              {profile?.display_name && (
                <h1
                  className="text-4xl text-orange-400 uppercase tracking-wide"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {profile.display_name}
                </h1>
              )}

              {/* User's Auction Teams */}
              <Link href="/auction" className="block w-full bg-zinc-800/50 hover:bg-zinc-800 rounded-xl p-4 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-orange-400">
                      Your Auction Teams
                    </h3>
                    {userPlace > 0 && (
                      <span className="text-xs text-zinc-500">
                        ({userPlace === 1 ? '1st' : userPlace === 2 ? '2nd' : userPlace === 3 ? '3rd' : `${userPlace}th`} place)
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {userPayout > 0 && (
                      <div className="flex items-center gap-1">
                        <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                        </svg>
                        <span className="text-sm font-bold text-green-400">${userPayout.toFixed(2)}</span>
                      </div>
                    )}
                    <span className="text-sm font-bold text-orange-400">{userTotalPoints} pts</span>
                  </div>
                </div>
                {userAuctionTeams.length > 0 ? (
                  <div className="space-y-1">
                    {userAuctionTeams
                      .sort((a, b) => (a.team?.seed || 99) - (b.team?.seed || 99))
                      .map((at, idx) => (
                        <div key={idx} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="w-5 text-xs text-zinc-500">{at.team?.seed}</span>
                            <span className={at.wins > 0 ? 'text-green-400' : ''}>{at.team?.short_name || at.team?.name}</span>
                            <span className="text-xs text-zinc-500">${at.bid_amount}</span>
                          </div>
                          <span className="text-xs text-zinc-400">
                            {at.points}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center">No teams yet</p>
                )}
              </Link>

              {/* Today's Menu */}
              {menuItems.length > 0 && (
                <Link href="/menu" className="block pt-4">
                  <div className="hover:opacity-80 transition-opacity">
                    <MenuDisplay items={menuItems} currentDay={currentDay} hideAlwaysAvailable />
                  </div>
                </Link>
              )}

              <div className="pt-4">
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="text-zinc-500 hover:text-zinc-300 text-sm"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="space-y-8">
              <Image
                src="/logo.png"
                alt="Bro Madness"
                width={300}
                height={200}
                priority
                className="mx-auto"
              />
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}
      </div>
    </div>
  )
}
