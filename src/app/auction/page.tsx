import { createClient } from '@/lib/supabase/server'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'
import { AuctionClient } from './AuctionClient'

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

// Simple seeded random for consistent throwout order
function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array]
  // Simple hash function
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  // Fisher-Yates shuffle with seeded random
  for (let i = result.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    const j = hash % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

// Payout percentages
const PAYOUT_PERCENTAGES = {
  championship_winner: 0.18,  // 18% - NCAA Champion
  championship_runnerup: 0.12, // 12% - NCAA Runner-up
  points_1st: 0.28,           // 28% - 1st in points
  points_2nd: 0.21,           // 21% - 2nd in points
  points_3rd: 0.14,           // 14% - 3rd in points
  points_4th: 0.07,           // 7% - 4th in points
}

// Calculate payouts rounded to nearest $5, ensuring total equals pot exactly
function calculateAuctionPayouts(pot: number) {
  // Round pot to nearest $5 if needed (shouldn't happen with typical entry fees)
  const adjustedPot = Math.round(pot / 5) * 5

  // Calculate raw amounts and initial $5 rounding
  const entries = Object.entries(PAYOUT_PERCENTAGES).map(([key, pct]) => {
    const raw = adjustedPot * pct
    const rounded = Math.round(raw / 5) * 5
    // diff tracks how much we rounded: positive = rounded down, negative = rounded up
    const diff = raw - rounded
    return { key, raw, rounded, diff }
  })

  // Calculate total and adjustment needed
  let total = entries.reduce((sum, e) => sum + e.rounded, 0)
  let adjustment = adjustedPot - total

  // Adjust in $5 increments, prioritizing items closest to rounding the other way
  while (adjustment !== 0) {
    if (adjustment > 0) {
      // Need to increase total - find item that was rounded down the most
      entries.sort((a, b) => b.diff - a.diff)
      entries[0].rounded += 5
      entries[0].diff -= 5
      adjustment -= 5
    } else {
      // Need to decrease total - find item that was rounded up the most
      entries.sort((a, b) => a.diff - b.diff)
      entries[0].rounded -= 5
      entries[0].diff += 5
      adjustment += 5
    }
  }

  // Convert back to object
  const result: Record<string, number> = {}
  entries.forEach(e => {
    result[e.key] = e.rounded
  })
  return result as {
    championship_winner: number
    championship_runnerup: number
    points_1st: number
    points_2nd: number
    points_3rd: number
    points_4th: number
  }
}

export default async function AuctionPage() {
  const supabase = await createClient()

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Get active tournament with settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, entry_fee, salary_cap, auction_payouts, auction_order_seed, auction_complete')
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

  const salaryCap = tournament.salary_cap ?? 100
  const entryFee = tournament.entry_fee ?? 50

  // Get all active users
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone, is_active')
    .eq('is_active', true)
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

  // Get auction entries (payment status)
  const { data: auctionEntries } = await supabase
    .from('auction_entries')
    .select('id, user_id, has_paid')
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
      const auctionEntry = (auctionEntries || []).find(e => e.user_id === user.id)
      const hasPaid = auctionEntry?.has_paid ?? false
      return {
        user,
        points: calculateUserPoints(user.id),
        teams: getUserTeamsWithStatus(user.id),
        totalSpent,
        remaining: salaryCap - totalSpent,
        hasPaid,
        hasChampion: getUserTeamsWithStatus(user.id).some(t => t.team_id === championshipWinnerId),
        hasRunnerup: getUserTeamsWithStatus(user.id).some(t =>
          championshipTeamIds.has(t.team_id) && t.team_id !== championshipWinnerId
        ),
      }
    })
    .filter(entry => entry.teams.length > 0)
    .sort((a, b) => b.points - a.points)

  // Calculate ranks with ties
  const getRank = (_index: number, points: number) => {
    // Find the first person with this point total
    const firstWithPoints = leaderboard.findIndex(e => e.points === points)
    return firstWithPoints + 1
  }

  // Calculate pot and payouts dynamically
  const participantCount = leaderboard.length
  const pot = participantCount * entryFee
  const payouts = calculateAuctionPayouts(pot)

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

  // Check if auction is complete (manually ended or all teams assigned)
  const totalTeams = (teams || []).length
  const assignedTeams = (auctionTeams || []).length
  const auctionComplete = (tournament.auction_complete ?? false) || (totalTeams > 0 && assignedTeams >= totalTeams)

  // Build draft board data (teams per user in bid order)
  const getDraftBoardData = () => {
    return (users || [])
      .map(u => {
        const userTeams = (auctionTeams || [])
          .filter(a => a.user_id === u.id)
          .map(a => {
            const team = (teams || []).find(t => t.id === a.team_id)
            return { ...a, team }
          })
          .sort((a, b) => (a.team?.seed || 99) - (b.team?.seed || 99))
        const auctionEntry = (auctionEntries || []).find(e => e.user_id === u.id)
        return {
          user: u,
          teams: userTeams,
          totalSpent: userTeams.reduce((sum, t) => sum + t.bid_amount, 0),
          hasPaid: auctionEntry?.has_paid ?? false,
        }
      })
  }

  const draftBoardUnsorted = getDraftBoardData()
  const orderSeed = tournament.auction_order_seed || tournament.id
  const draftBoard = seededShuffle(draftBoardUnsorted, orderSeed)
  const maxTeamsPerUser = Math.max(...draftBoard.map(d => d.teams.length), 3)

  // Calculate whose turn it is to throw out a team
  const currentThrowerIndex = draftBoard.length > 0 ? assignedTeams % draftBoard.length : 0

  return (
    <AuctionClient auctionComplete={auctionComplete}>
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-xl font-bold text-orange-500">NCAA Auction</h1>

      {/* My Teams Row - show during auction too */}
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

      {/* Draft Board - show during auction */}
      {!auctionComplete && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-zinc-800">
                <th className="text-left px-2 py-2 text-zinc-400 font-medium">Player</th>
                {Array.from({ length: maxTeamsPerUser }).map((_, i) => (
                  <th key={i} className="text-center px-2 py-2 text-zinc-400 font-medium w-24">
                    Bid {i + 1}
                  </th>
                ))}
                <th className="text-right px-2 py-2 text-zinc-400 font-medium">Spent</th>
              </tr>
            </thead>
            <tbody>
              {draftBoard.map((entry, idx) => {
                const isCurrentThrower = idx === currentThrowerIndex
                return (
                <tr
                  key={entry.user.id}
                  className={idx % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-700/40'}
                >
                  <td className={`relative px-2 py-1.5 ${isCurrentThrower ? 'font-bold text-orange-400' : 'font-medium text-zinc-200'}`}>
                    {/* Subtle background text for unpaid users */}
                    {!entry.hasPaid && (
                      <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 text-center text-red-500/15 text-sm font-black whitespace-nowrap tracking-widest pointer-events-none" style={{ width: '400%' }}>
                        PAY BRO ${entryFee}
                      </span>
                    )}
                    <span className="relative">{entry.user.display_name || entry.user.phone}</span>
                  </td>
                  {Array.from({ length: maxTeamsPerUser }).map((_, i) => {
                    const teamEntry = entry.teams[i]
                    const d1Team = teamEntry?.team ? findD1Team(teamEntry.team.name) : null
                    return (
                      <td key={i} className="text-center px-1 py-1">
                        {teamEntry ? (
                          <div className="flex flex-col items-center text-xs leading-tight">
                            <span className="text-zinc-400">${teamEntry.bid_amount}</span>
                            <span className="text-zinc-200 font-medium">
                              {teamEntry.team?.seed} {d1Team?.abbreviation || teamEntry.team?.short_name}
                            </span>
                          </div>
                        ) : (
                          <span className="text-zinc-700">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="text-right px-2 py-1.5 text-white text-base font-bold">
                    ${entry.totalSpent}
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          <p className="text-xs text-zinc-500 mt-2 text-center">
            {assignedTeams}/{totalTeams} teams assigned
          </p>
        </div>
      )}

      {/* Payouts Info - show after auction complete */}
      {auctionComplete && <div className="bg-zinc-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-orange-400">Payouts</h3>
          <span className="text-xs text-zinc-500">{participantCount} players · ${pot} pot</span>
        </div>
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
      </div>}

      {/* Leaderboard - show after auction complete */}
      {auctionComplete && <div className="space-y-3">
        {leaderboard.map((entry, idx) => {
          const rank = getRank(idx, entry.points)
          const isTop4 = rank <= 4

          return (
            <div
              key={entry.user.id}
              className={`relative overflow-hidden bg-zinc-800/50 rounded-xl p-4 ${
                isTop4 ? 'ring-1 ring-orange-500/30' : ''
              }`}
            >
              {/* Diagonal ribbon for unpaid */}
              {!entry.hasPaid && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="rotate-[15deg] bg-red-600/90 text-white text-xs font-bold py-1 w-[200%] text-center shadow-lg">
                    NEEDS TO PAY BRO ${entryFee}
                  </div>
                </div>
              )}
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
                  <span className="font-medium">
                    {entry.user.display_name || entry.user.phone}
                  </span>
                  <span className="text-xs text-zinc-500">
                    ${entry.totalSpent}/${salaryCap} spent
                  </span>
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
      </div>}

    </div>
    </AuctionClient>
  )
}
