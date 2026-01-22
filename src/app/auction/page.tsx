import { createClient } from '@/lib/supabase/server'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

interface AuctionPayouts {
  championship_winner: number
  championship_runnerup: number
  points_1st: number
  points_2nd: number
  points_3rd: number
  points_4th: number
}

export default async function AuctionPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get active tournament with settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, entry_fee, salary_cap, auction_payouts')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">No tournament found.</p>
      </div>
    )
  }

  const payouts = (tournament.auction_payouts as AuctionPayouts) ?? {
    championship_winner: 80,
    championship_runnerup: 50,
    points_1st: 110,
    points_2nd: 80,
    points_3rd: 60,
    points_4th: 40,
  }

  const salaryCap = tournament.salary_cap ?? 100

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')
    .order('display_name')

  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, seed, region_id, is_eliminated')
    .eq('tournament_id', tournament.id)

  // Get auction assignments
  const { data: auctionTeams } = await supabase
    .from('auction_teams')
    .select('id, user_id, team_id, bid_amount')
    .eq('tournament_id', tournament.id)

  // Get completed games to determine winners
  const { data: games } = await supabase
    .from('games')
    .select('id, round, winner_id')
    .eq('tournament_id', tournament.id)
    .not('winner_id', 'is', null)

  // Calculate points for each user
  // Points = sum of seeds for each winning team they own
  const calculateUserPoints = (userId: string) => {
    const userTeamIds = (auctionTeams || [])
      .filter(a => a.user_id === userId)
      .map(a => a.team_id)

    let totalPoints = 0
    const winningTeamIds = new Set((games || []).map(g => g.winner_id))

    userTeamIds.forEach(teamId => {
      // Count how many games this team has won
      const teamWins = (games || []).filter(g => g.winner_id === teamId).length
      const team = (teams || []).find(t => t.id === teamId)
      if (team && teamWins > 0) {
        // Points = seed × number of wins
        totalPoints += team.seed * teamWins
      }
    })

    return totalPoints
  }

  // Get user's teams with status
  const getUserTeamsWithStatus = (userId: string) => {
    return (auctionTeams || [])
      .filter(a => a.user_id === userId)
      .map(a => {
        const team = (teams || []).find(t => t.id === a.team_id)
        const wins = (games || []).filter(g => g.winner_id === a.team_id).length
        const isEliminated = team?.is_eliminated ?? false
        return {
          ...a,
          team,
          wins,
          isEliminated,
          points: team ? team.seed * wins : 0,
        }
      })
      .sort((a, b) => (a.team?.seed || 99) - (b.team?.seed || 99))
  }

  // Find championship game (round 6) teams
  const championshipGame = (games || []).find(g => g.round === 6)
  const championshipWinnerId = championshipGame?.winner_id
  const finalFourGames = (games || []).filter(g => g.round === 5)
  const championshipTeamIds = new Set(finalFourGames.map(g => g.winner_id).filter(Boolean))

  // Calculate total spent per user
  const getUserTotalSpent = (userId: string) => {
    return (auctionTeams || [])
      .filter(a => a.user_id === userId)
      .reduce((sum, t) => sum + t.bid_amount, 0)
  }

  // Build leaderboard
  const leaderboard = (users || [])
    .map(user => {
      const totalSpent = getUserTotalSpent(user.id)
      return {
        user,
        points: calculateUserPoints(user.id),
        teams: getUserTeamsWithStatus(user.id),
        totalSpent,
        remaining: salaryCap - totalSpent,
        hasChampion: getUserTeamsWithStatus(user.id).some(t => t.team_id === championshipWinnerId),
        hasRunnerup: getUserTeamsWithStatus(user.id).some(t =>
          championshipTeamIds.has(t.team_id) && t.team_id !== championshipWinnerId
        ),
      }
    })
    .filter(entry => entry.teams.length > 0)
    .sort((a, b) => b.points - a.points)

  // Calculate ranks with ties
  const getRank = (index: number, points: number) => {
    // Find the first person with this point total
    const firstWithPoints = leaderboard.findIndex(e => e.points === points)
    return firstWithPoints + 1
  }

  // Get current user's teams
  const currentUserTeams = user
    ? (auctionTeams || [])
        .filter(a => a.user_id === user.id)
        .map(a => {
          const team = (teams || []).find(t => t.id === a.team_id)
          const d1Team = team ? findD1Team(team.name) : null
          const wins = (games || []).filter(g => g.winner_id === a.team_id).length
          const isEliminated = team?.is_eliminated ?? false
          return {
            ...a,
            team,
            d1Team,
            wins,
            isEliminated,
            points: team ? team.seed * wins : 0,
          }
        })
        .sort((a, b) => (a.team?.seed || 99) - (b.team?.seed || 99))
    : []

  return (
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-xl font-bold text-orange-500">Auction</h1>

      {/* My Teams Row */}
      {currentUserTeams.length > 0 && (
        <div className="flex items-center gap-3">
          {currentUserTeams.map(t => {
            const teamColor = t.d1Team?.primaryColor || '#666666'
            const logoUrl = t.d1Team ? getTeamLogoUrl(t.d1Team) : null

            return (
              <div
                key={t.id}
                className={`flex flex-col items-center ${t.isEliminated ? 'opacity-40' : ''}`}
                title={t.team?.name}
              >
                <div
                  className="w-14 h-14 rounded flex items-center justify-center"
                  style={{ backgroundColor: teamColor }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={t.team?.name || ''}
                      className="w-9 h-9 object-contain"
                      style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}
                    />
                  ) : (
                    <span className="text-white text-base font-bold">
                      {t.team?.short_name?.charAt(0) || '?'}
                    </span>
                  )}
                </div>
                <span className="text-[10px] text-zinc-400 font-medium mt-1">
                  {t.team?.seed} {t.d1Team?.abbreviation || t.team?.short_name}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Payouts Info */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-orange-400 mb-3">Payouts</h3>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-zinc-400">Champion</span>
            <span>${payouts.championship_winner}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">Runner-up</span>
            <span>${payouts.championship_runnerup}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">1st Place</span>
            <span>${payouts.points_1st}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">2nd Place</span>
            <span>${payouts.points_2nd}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">3rd Place</span>
            <span>${payouts.points_3rd}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-400">4th Place</span>
            <span>${payouts.points_4th}</span>
          </div>
        </div>
      </div>

      {/* Leaderboard */}
      <div className="space-y-3">
        {leaderboard.map((entry, idx) => {
          const rank = getRank(idx, entry.points)
          const isTop4 = rank <= 4

          return (
            <div
              key={entry.user.id}
              className={`bg-zinc-800/50 rounded-xl p-4 ${
                isTop4 ? 'ring-1 ring-orange-500/30' : ''
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold w-6 ${
                    rank === 1 ? 'text-yellow-400' :
                    rank === 2 ? 'text-zinc-300' :
                    rank === 3 ? 'text-orange-400' :
                    rank === 4 ? 'text-zinc-400' :
                    'text-zinc-500'
                  }`}>
                    {rank}
                  </span>
                  <div>
                    <span className="font-medium">
                      {entry.user.display_name || entry.user.phone}
                    </span>
                    <div className="text-xs text-zinc-500">
                      ${entry.totalSpent}/${salaryCap} spent
                      {entry.remaining > 0 && ` · $${entry.remaining} left`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-orange-400">{entry.points} pts</div>
                  {entry.hasChampion && (
                    <div className="text-xs text-yellow-400">Champion!</div>
                  )}
                  {entry.hasRunnerup && (
                    <div className="text-xs text-zinc-400">Runner-up</div>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap gap-1">
                {entry.teams.map(t => (
                  <span
                    key={t.id}
                    className={`text-xs px-2 py-0.5 rounded ${
                      t.isEliminated
                        ? 'bg-zinc-700/50 text-zinc-500 line-through'
                        : t.wins > 0
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-zinc-700 text-zinc-300'
                    }`}
                  >
                    #{t.team?.seed} {t.team?.short_name || t.team?.name}
                    {t.wins > 0 && ` (+${t.points})`}
                  </span>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {leaderboard.length === 0 && (
        <div className="text-center text-zinc-500 py-8">
          No teams assigned yet
        </div>
      )}
    </div>
  )
}
