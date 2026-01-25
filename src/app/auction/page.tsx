import { createClient } from '@/lib/supabase/server'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'
import { AuctionClient } from './AuctionClient'
import { AuctionTeamList } from './AuctionTeamList'
import { AuctionLeaderboard } from './AuctionLeaderboard'
import { CollapsibleSection } from './CollapsibleSection'
import { DraftBoard } from './DraftBoard'
import { getActiveUserId } from '@/lib/simulation'

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

  // Get active user ID (may be simulated)
  const activeUserId = user ? await getActiveUserId(user.id) : null

  // Get active tournament with settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, entry_fee, salary_cap, teams_per_player, auction_payouts, auction_order_seed, auction_complete')
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

  // Get regions for team list
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name, position')
    .eq('tournament_id', tournament.id)
    .order('position')

  // Get auction assignments
  const { data: auctionTeams } = await supabase
    .from('auction_teams')
    .select('id, user_id, team_id, bid_amount')
    .eq('tournament_id', tournament.id)

  // Get auction entries (payment and participation status)
  const { data: auctionEntries } = await supabase
    .from('auction_entries')
    .select('id, user_id, has_paid, is_participating')
    .eq('tournament_id', tournament.id)

  // Filter to only participating users
  const participatingUserIds = new Set(
    (auctionEntries || [])
      .filter(e => e.is_participating)
      .map(e => e.user_id)
  )

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

  // Calculate potential points if all alive teams won their remaining games
  // When two of user's teams could meet, higher seed (underdog) wins for max points
  const calculatePotentialPoints = (userId: string) => {
    const userTeams = getUserTeamsWithStatus(userId)
    const aliveTeams = userTeams.filter(t => !t.isEliminated)

    if (aliveTeams.length === 0) {
      return userTeams.reduce((sum, t) => sum + t.points, 0)
    }

    // Group alive teams by region
    const teamsByRegion = new Map<string, typeof aliveTeams>()
    for (const team of aliveTeams) {
      const regionId = team.team?.region_id || 'unknown'
      if (!teamsByRegion.has(regionId)) {
        teamsByRegion.set(regionId, [])
      }
      teamsByRegion.get(regionId)!.push(team)
    }

    // Current points from all teams (including eliminated)
    let totalPotential = userTeams.reduce((sum, t) => sum + t.points, 0)

    // Track which team from each region goes to Final Four
    const regionWinners: { team: typeof aliveTeams[0]; regionPosition: number }[] = []

    // Calculate potential from regional play (rounds through Elite 8 = round 4)
    for (const [regionId, regionTeams] of teamsByRegion) {
      // Sort by seed DESCENDING (higher number = underdog = more points per win)
      regionTeams.sort((a, b) => (b.team?.seed || 0) - (a.team?.seed || 0))

      const region = (regions || []).find(r => r.id === regionId)
      const regionPosition = region?.position || 0

      // Highest seed (underdog) in this region makes it to Elite 8 (round 4)
      const bestTeam = regionTeams[0]
      const bestSeed = bestTeam.team?.seed || 0
      const bestWins = bestTeam.wins
      // Remaining regional games (up to round 4 = Elite 8 winner)
      const remainingRegional = Math.max(0, 4 - bestWins)
      totalPotential += bestSeed * remainingRegional
      regionWinners.push({ team: bestTeam, regionPosition })

      // Other teams in region get eliminated when they meet the highest seed
      // Approximate: they get ~1 more win on average before meeting
      for (let i = 1; i < regionTeams.length; i++) {
        const team = regionTeams[i]
        const seed = team.team?.seed || 0
        const wins = team.wins
        // Give credit for 1 more win before meeting the higher seed
        if (wins < 4) {
          totalPotential += seed
        }
      }
    }

    // Final Four and Championship (rounds 5-6)
    // Regions typically paired: position 1 vs 2, position 3 vs 4 for FF
    // Then winners meet in Championship
    if (regionWinners.length > 0) {
      // Group by FF matchup (positions 1&2 vs 3&4)
      const ffMatchup1 = regionWinners.filter(r => r.regionPosition <= 2)
      const ffMatchup2 = regionWinners.filter(r => r.regionPosition > 2)

      const ffWinners: typeof regionWinners = []

      // From each FF matchup, higher seed advances (more points)
      if (ffMatchup1.length > 0) {
        ffMatchup1.sort((a, b) => (b.team.team?.seed || 0) - (a.team.team?.seed || 0))
        const winner = ffMatchup1[0]
        const seed = winner.team.team?.seed || 0
        if (winner.team.wins < 5) {
          totalPotential += seed // FF win
        }
        ffWinners.push(winner)
      }

      if (ffMatchup2.length > 0) {
        ffMatchup2.sort((a, b) => (b.team.team?.seed || 0) - (a.team.team?.seed || 0))
        const winner = ffMatchup2[0]
        const seed = winner.team.team?.seed || 0
        if (winner.team.wins < 5) {
          totalPotential += seed // FF win
        }
        ffWinners.push(winner)
      }

      // Championship: higher seed of FF winners (more points)
      if (ffWinners.length > 0) {
        ffWinners.sort((a, b) => (b.team.team?.seed || 0) - (a.team.team?.seed || 0))
        const champion = ffWinners[0]
        const seed = champion.team.team?.seed || 0
        if (champion.team.wins < 6) {
          totalPotential += seed // Championship win
        }
      }
    }

    return totalPotential
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

  // Build leaderboard (only participating users)
  const leaderboard = (users || [])
    .filter(user => participatingUserIds.has(user.id))
    .map(user => {
      const totalSpent = getUserTotalSpent(user.id)
      const auctionEntry = (auctionEntries || []).find(e => e.user_id === user.id)
      const hasPaid = auctionEntry?.has_paid ?? false
      const points = calculateUserPoints(user.id)
      const potential = calculatePotentialPoints(user.id)
      return {
        user,
        points,
        potential,
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

  // Get current user's teams (uses activeUserId for simulation support)
  const currentUserTeams = activeUserId
    ? (auctionTeams || [])
        .filter(a => a.user_id === activeUserId)
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

  // Teams per player from settings (only paid teams count)
  const teamsPerPlayer = tournament.teams_per_player ?? 3

  // Build draft board data (teams per user in bid order)
  const getDraftBoardData = () => {
    return (users || [])
      .filter(u => participatingUserIds.has(u.id))
      .map(u => {
        const userTeams = (auctionTeams || [])
          .filter(a => a.user_id === u.id)
          .map(a => {
            const team = (teams || []).find(t => t.id === a.team_id)
            return { ...a, team }
          })
          .sort((a, b) => (a.team?.seed || 99) - (b.team?.seed || 99))

        // Separate paid teams from bonus ($0) teams
        const paidTeams = userTeams.filter(t => t.bid_amount > 0)
        const bonusTeams = userTeams.filter(t => t.bid_amount === 0)

        const auctionEntry = (auctionEntries || []).find(e => e.user_id === u.id)
        return {
          user: u,
          teams: userTeams,
          paidTeams,
          bonusTeams,
          totalSpent: userTeams.reduce((sum, t) => sum + t.bid_amount, 0),
          hasPaid: auctionEntry?.has_paid ?? false,
        }
      })
  }

  const draftBoardUnsorted = getDraftBoardData()
  const orderSeed = tournament.auction_order_seed || tournament.id
  const draftBoard = seededShuffle(draftBoardUnsorted, orderSeed)

  // Check if a player has purchased all their required teams (only paid teams count)
  const isPlayerDone = (idx: number) => {
    return draftBoard[idx].paidTeams.length >= teamsPerPlayer
  }

  // Count only paid teams for determining whose turn it is
  const totalPaidTeams = draftBoard.reduce((sum, entry) => sum + entry.paidTeams.length, 0)
  const numPlayers = draftBoard.length

  // Calculate whose turn it is to throw out a team, skipping players who are done
  const calculateCurrentThrower = () => {
    if (numPlayers === 0) return 0

    // Start from where we would be without skipping
    let baseIndex = totalPaidTeams % numPlayers

    // Skip players who have already purchased all their teams
    let attempts = 0
    while (isPlayerDone(baseIndex) && attempts < numPlayers) {
      baseIndex = (baseIndex + 1) % numPlayers
      attempts++
    }

    return baseIndex
  }

  const currentThrowerIndex = calculateCurrentThrower()

  return (
    <AuctionClient auctionComplete={auctionComplete}>
    <div className="p-4 pb-20 space-y-4">
      <h1 className="text-xl font-bold text-orange-400 uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
        <img src="/auction.svg" alt="" className="w-6 h-6" style={{ filter: 'brightness(0) saturate(100%) invert(64%) sepia(54%) saturate(2067%) hue-rotate(340deg) brightness(100%) contrast(97%)' }} />
        NCAA Auction
      </h1>

      {/* My Teams Row - show during auction too */}
      {currentUserTeams.length > 0 && (
        <div className="flex items-center gap-3">
          {currentUserTeams.map(t => {
            const teamColor = t.d1Team?.primaryColor || '#666666'
            const logoUrl = t.d1Team ? getTeamLogoUrl(t.d1Team) : null

            return (
              <div
                key={t.id}
                className="flex flex-col items-center"
                title={t.team?.name}
              >
                <div
                  className={`relative w-14 h-14 rounded flex items-center justify-center ${
                    t.isEliminated ? 'ring-2 ring-red-500 ring-inset' : ''
                  }`}
                  style={{ backgroundColor: t.isEliminated ? '#71717a' : teamColor }}
                >
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt={t.team?.name || ''}
                      className={`w-9 h-9 object-contain ${t.isEliminated ? 'grayscale' : ''}`}
                      style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}
                    />
                  ) : (
                    <span className={`text-base font-bold ${t.isEliminated ? 'text-zinc-400' : 'text-white'}`}>
                      {t.team?.short_name?.charAt(0) || '?'}
                    </span>
                  )}
                  {/* Red X for eliminated */}
                  {t.isEliminated && (
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                      <svg className="w-10 h-10 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </div>
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
        <CollapsibleSection
          title="Draft Board"
          subtitle={`${totalPaidTeams} of ${numPlayers * teamsPerPlayer} picks`}
          storageKey="auction-draft-board-expanded"
        >
          <DraftBoard
            draftBoard={draftBoard}
            teamsPerPlayer={teamsPerPlayer}
            salaryCap={salaryCap}
            entryFee={entryFee}
            currentThrowerIndex={currentThrowerIndex}
          />
        </CollapsibleSection>
      )}

      {/* All Teams List - show during auction */}
      {!auctionComplete && regions && regions.length > 0 && (
        <AuctionTeamList
          regions={regions}
          teams={teams || []}
          auctionTeams={auctionTeams || []}
          users={users || []}
        />
      )}

      {/* Payouts Info - show after auction complete */}
      {auctionComplete && <div className="bg-zinc-800/50 rounded-xl p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Payouts</h3>
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
      {auctionComplete && (
        <AuctionLeaderboard leaderboard={leaderboard} entryFee={entryFee} />
      )}

    </div>
    </AuctionClient>
  )
}
