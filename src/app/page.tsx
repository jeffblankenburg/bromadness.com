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
    .select('id, start_date')
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

  if (tournament) {
    const { data } = await supabase
      .from('menu_items')
      .select('id, day, meal_type, item_name, provider')
      .eq('tournament_id', tournament.id)
      .order('sort_order')
    menuItems = data || []

    // Get user's auction teams with win data
    if (user) {
      const { data: auctionData } = await supabase
        .from('auction_teams')
        .select('bid_amount, team_id, team:teams(id, name, short_name, seed)')
        .eq('tournament_id', tournament.id)
        .eq('user_id', user.id)

      // Get completed games to count wins
      const { data: games } = await supabase
        .from('games')
        .select('winner_id')
        .eq('tournament_id', tournament.id)
        .not('winner_id', 'is', null)

      userAuctionTeams = (auctionData || []).map(a => {
        const teamData = a.team as unknown as { id: string; name: string; short_name: string | null; seed: number } | null
        const wins = teamData ? (games || []).filter(g => g.winner_id === teamData.id).length : 0
        const points = teamData ? teamData.seed * wins : 0
        userTotalPoints += points
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

      <div className="text-center space-y-6">
          <Image
            src="/logo.png"
            alt="Bro Madness"
            width={380}
            height={253}
            priority
            className="mx-auto"
          />

          <p className="text-zinc-400 max-w-xs">
            March Madness brackets, daily pick&apos;em, and casino games
          </p>

          {user ? (
            <div className="pt-6 space-y-4">
              <p className="text-orange-400">
                Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
              </p>

              {profile?.is_admin && (
                <div className="flex justify-center text-sm">
                  <Link href="/admin" className="text-orange-500 font-medium hover:text-orange-400">
                    Admin →
                  </Link>
                </div>
              )}

              {/* User's Auction Teams */}
              <div className="w-full max-w-sm bg-zinc-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-orange-400">
                    Your Teams
                  </h3>
                  {userTotalPoints > 0 && (
                    <span className="text-sm font-bold text-orange-400">{userTotalPoints} pts</span>
                  )}
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
                          </div>
                          <span className="text-xs text-zinc-500">
                            {at.points > 0 ? `+${at.points} pts` : `$${at.bid_amount}`}
                          </span>
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-zinc-500 text-center">No teams yet</p>
                )}
              </div>

              {/* Today's Menu */}
              {menuItems.length > 0 && (
                <div className="pt-4 space-y-2">
                  <MenuDisplay items={menuItems} currentDay={currentDay} hideAlwaysAvailable />
                  <Link
                    href="/menu"
                    className="block text-center text-sm text-zinc-400 hover:text-white"
                  >
                    View full menu →
                  </Link>
                </div>
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
            <div className="pt-8">
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
