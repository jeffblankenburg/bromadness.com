'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'
import { CHANNELS } from '@/lib/data/channels'

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
}

interface Game {
  id: string
  scheduled_at: string | null
  team1_score: number | null
  team2_score: number | null
  winner_id: string | null
  spread: number | null
  favorite_team_id: string | null
  location?: string | null
  channel?: string | null
  team1: Team | null
  team2: Team | null
}

interface PickemDay {
  id: string
  contest_date: string
}

interface User {
  id: string
  display_name: string | null
}

interface PickemEntry {
  id: string
  user_id: string
  pickem_day_id: string
  has_paid?: boolean
}

interface PickemPick {
  id: string
  entry_id: string
  game_id: string | null
  picked_team_id: string
  is_correct: boolean | null
}

interface Props {
  userId: string
  pickemDays: PickemDay[]
  games: Game[]
  users: User[]
  userEntries: PickemEntry[]
  userPicks: PickemPick[]
  allEntries: PickemEntry[]
  allPicks: PickemPick[]
  entryFee: number
  simulatedTime: string | null
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

function formatDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

const formatGameTime = (dateStr: string | null) => {
  if (!dateStr) return null
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hours, mins] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayName = days[date.getDay()]
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'p' : 'a'
  return `${dayName} ${hour12}:${mins}${ampm}`
}

const getChannelNumber = (channelName: string | null) => {
  if (!channelName) return null
  const channel = CHANNELS.find(c => c.name.toLowerCase() === channelName.toLowerCase())
  return channel ? channel.number : null
}

export function PickemClient({
  userId,
  pickemDays,
  games,
  users,
  userEntries,
  userPicks,
  allEntries,
  allPicks,
  entryFee,
  simulatedTime,
}: Props) {
  // Use simulated time if set, otherwise real time
  const getCurrentTime = () => simulatedTime ? new Date(simulatedTime) : new Date()
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [localPicks, setLocalPicks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [session1LeaderboardExpanded, setSession1LeaderboardExpanded] = useState(false)
  const [session2LeaderboardExpanded, setSession2LeaderboardExpanded] = useState(false)
  const [session1GamesExpanded, setSession1GamesExpanded] = useState(true)
  const [session2GamesExpanded, setSession2GamesExpanded] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Persist expand states
  useEffect(() => {
    const storedLb1 = localStorage.getItem('pickem-session1-leaderboard-expanded')
    const storedLb2 = localStorage.getItem('pickem-session2-leaderboard-expanded')
    const storedGames1 = localStorage.getItem('pickem-session1-games-expanded')
    const storedGames2 = localStorage.getItem('pickem-session2-games-expanded')
    if (storedLb1 !== null) setSession1LeaderboardExpanded(storedLb1 === 'true')
    if (storedLb2 !== null) setSession2LeaderboardExpanded(storedLb2 === 'true')
    if (storedGames1 !== null) setSession1GamesExpanded(storedGames1 === 'true')
    if (storedGames2 !== null) setSession2GamesExpanded(storedGames2 === 'true')
  }, [])

  const toggleSession1Leaderboard = () => {
    const newValue = !session1LeaderboardExpanded
    setSession1LeaderboardExpanded(newValue)
    localStorage.setItem('pickem-session1-leaderboard-expanded', String(newValue))
  }

  const toggleSession2Leaderboard = () => {
    const newValue = !session2LeaderboardExpanded
    setSession2LeaderboardExpanded(newValue)
    localStorage.setItem('pickem-session2-leaderboard-expanded', String(newValue))
  }

  const toggleSession1Games = () => {
    const newValue = !session1GamesExpanded
    setSession1GamesExpanded(newValue)
    localStorage.setItem('pickem-session1-games-expanded', String(newValue))
  }

  const toggleSession2Games = () => {
    const newValue = !session2GamesExpanded
    setSession2GamesExpanded(newValue)
    localStorage.setItem('pickem-session2-games-expanded', String(newValue))
  }

  const currentDay = pickemDays[selectedDayIndex]
  if (!currentDay) {
    return (
      <div className="p-4 space-y-4">
        <h1 className="text-xl font-bold text-orange-500">Pick&apos;em</h1>
        <p className="text-zinc-400">No games scheduled yet.</p>
      </div>
    )
  }

  // Get games for current day
  const dayGames = games
    .filter(g => g.scheduled_at?.split('T')[0] === currentDay.contest_date)
    .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  // Split into sessions (first half = session 1, second half = session 2)
  const midpoint = Math.ceil(dayGames.length / 2)
  const session1Games = dayGames.slice(0, midpoint)
  const session2Games = dayGames.slice(midpoint)

  // Calculate session payouts based on paid entries for current day
  // Entry fee is per day, split between 2 sessions
  // 1st: 60%, 2nd: 30%, 3rd: 10% (rounded to whole dollars)
  const paidEntriesForDay = allEntries.filter(
    e => e.pickem_day_id === currentDay.id && e.has_paid === true
  ).length
  const dayPot = paidEntriesForDay * entryFee
  const sessionPot = dayPot / 2
  const sessionPayouts = {
    first: Math.floor(sessionPot * 0.6),
    second: Math.floor(sessionPot * 0.3),
    third: Math.floor(sessionPot * 0.1),
  }

  // Check if day is locked (first game has started)
  const firstGameTime = dayGames[0]?.scheduled_at
  const isLocked = firstGameTime ? new Date(firstGameTime) <= getCurrentTime() : false

  // Get user's entry for current day
  const userEntry = userEntries.find(e => e.pickem_day_id === currentDay.id)

  // Get user's picks for current day's games
  const dayGameIds = dayGames.map(g => g.id)
  const userDayPicks = userPicks.filter(p => p.game_id && dayGameIds.includes(p.game_id))

  // Get picked team for a game
  const getPickedTeamId = (gameId: string): string => {
    if (localPicks[gameId]) return localPicks[gameId]
    const pick = userDayPicks.find(p => p.game_id === gameId)
    return pick?.picked_team_id || ''
  }

  const handlePick = async (gameId: string, teamId: string) => {
    if (isLocked || saving) return

    // Optimistic update
    setLocalPicks(prev => ({ ...prev, [gameId]: teamId }))
    setSaving(true)

    try {
      // Create or get entry
      let entryId = userEntry?.id

      if (!entryId) {
        const { data: newEntry, error: entryError } = await supabase
          .from('pickem_entries')
          .insert({
            user_id: userId,
            pickem_day_id: currentDay.id,
          })
          .select()
          .single()

        if (entryError) throw entryError
        entryId = newEntry.id
      }

      // Upsert pick (insert or update if exists) - atomic operation to prevent duplicates
      const { error: pickError } = await supabase
        .from('pickem_picks')
        .upsert({
          entry_id: entryId,
          game_id: gameId,
          picked_team_id: teamId,
          is_correct: null, // Reset correctness when pick changes
        }, {
          onConflict: 'entry_id,game_id',
        })

      if (pickError) throw pickError

      router.refresh()
    } catch (error) {
      console.error('Failed to save pick:', error)
      // Revert optimistic update
      setLocalPicks(prev => {
        const next = { ...prev }
        delete next[gameId]
        return next
      })
    }
    setSaving(false)
  }

  // Calculate standings for a session (only paid users)
  const calculateSessionStandings = (sessionGames: Game[]) => {
    // Only count games that have a winner (completed games)
    const completedGames = sessionGames.filter(g => g.winner_id !== null)
    const completedGameIds = completedGames.map(g => g.id)
    const sessionGameIds = sessionGames.map(g => g.id)
    const dayEntries = allEntries.filter(e => e.pickem_day_id === currentDay.id && e.has_paid === true)

    return dayEntries.map(entry => {
      const user = users.find(u => u.id === entry.user_id)
      const entryPicks = allPicks.filter(p =>
        p.entry_id === entry.id && p.game_id && sessionGameIds.includes(p.game_id)
      )

      // Only count correct picks for completed games
      const correctPicks = entryPicks.filter(p =>
        p.is_correct === true && completedGameIds.includes(p.game_id!)
      ).length
      const totalPicks = completedGames.length

      // Calculate tiebreaker positions (only for completed games)
      const sortedPicks = entryPicks
        .filter(pick => completedGameIds.includes(pick.game_id!))
        .map(pick => {
          const game = completedGames.find(g => g.id === pick.game_id)
          return { ...pick, scheduled_at: game?.scheduled_at || '' }
        })
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

      let firstLoss: number | null = null
      let secondLoss: number | null = null

      sortedPicks.forEach((pick, index) => {
        if (pick.is_correct === false) {
          if (firstLoss === null) {
            firstLoss = index + 1
          } else if (secondLoss === null) {
            secondLoss = index + 1
          }
        }
      })

      return {
        user_id: entry.user_id,
        display_name: user?.display_name || 'Unknown',
        correct_picks: correctPicks,
        total_picks: totalPicks,
        first_loss: firstLoss,
        second_loss: secondLoss,
        is_current_user: entry.user_id === userId,
      }
    }).sort((a, b) => {
      if (b.correct_picks !== a.correct_picks) return b.correct_picks - a.correct_picks
      if (a.second_loss !== b.second_loss) {
        if (a.second_loss === null) return -1
        if (b.second_loss === null) return 1
        return b.second_loss - a.second_loss
      }
      if (a.first_loss !== b.first_loss) {
        if (a.first_loss === null) return -1
        if (b.first_loss === null) return 1
        return b.first_loss - a.first_loss
      }
      return 0
    })
  }

  // Determine if pick was correct against spread
  // Spread is always assigned to the LOWER SEED:
  // - Negative spread = lower seed is favorite (must win by more than |spread|)
  // - Positive spread = lower seed is underdog (can lose by less than spread)
  const isPickCorrect = (game: Game, pickedTeamId: string): boolean | null => {
    if (!game.winner_id || game.spread === null) return null
    if (game.team1_score === null || game.team2_score === null) return null
    if (!game.team1 || !game.team2) return null

    const margin = game.team1_score - game.team2_score
    const team1IsLowerSeed = game.team1.seed < game.team2.seed

    // Adjusted margin from lower seed's perspective, then add spread
    // If team1 is lower seed: team1 covers if margin + spread > 0
    // If team2 is lower seed: team1 covers if margin - spread > 0
    const adjustedMargin = team1IsLowerSeed
      ? margin + game.spread
      : margin - game.spread

    const team1Covered = adjustedMargin > 0
    const pickedTeam1 = pickedTeamId === game.team1.id

    return pickedTeam1 ? team1Covered : !team1Covered
  }

  const renderGame = (game: Game) => {
    if (!game.team1 || !game.team2) return null

    // Determine which team is lower seed
    const lowerSeedTeam = game.team1.seed < game.team2.seed ? game.team1 : game.team2
    const higherSeedTeam = game.team1.seed < game.team2.seed ? game.team2 : game.team1

    // Spread is assigned to lower seed:
    // - Positive spread = lower seed is underdog, higher seed is favorite
    // - Negative spread = lower seed is favorite
    const lowerSeedIsFavorite = game.spread ? game.spread < 0 : true

    // Order teams so favorite is first
    const favoriteTeam = lowerSeedIsFavorite ? lowerSeedTeam : higherSeedTeam
    const underdogTeam = lowerSeedIsFavorite ? higherSeedTeam : lowerSeedTeam

    const d1Favorite = findD1Team(favoriteTeam.name)
    const d1Underdog = findD1Team(underdogTeam.name)
    const logoFavorite = d1Favorite ? getTeamLogoUrl(d1Favorite) : null
    const logoUnderdog = d1Underdog ? getTeamLogoUrl(d1Underdog) : null

    const pickedTeamId = getPickedTeamId(game.id)
    const isComplete = game.winner_id !== null
    const hasSpread = game.spread !== null

    // Get correctness from saved pick or calculate
    const savedPick = userDayPicks.find(p => p.game_id === game.id)
    const pickCorrectness = savedPick?.is_correct ?? (isComplete && pickedTeamId ? isPickCorrect(game, pickedTeamId) : null)

    const channelNum = getChannelNumber(game.channel || null)

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null, isFavorite: boolean) => {
      const isPicked = pickedTeamId === team.id
      const isWinner = isComplete && game.winner_id === team.id

      // Ring styling based on pick status and correctness
      let ringClass = ''
      if (isPicked) {
        if (isComplete) {
          ringClass = pickCorrectness === true ? 'ring-2 ring-green-500' : 'ring-2 ring-red-500'
        } else {
          ringClass = 'ring-2 ring-orange-500'
        }
      }

      // Favorite gets minus, underdog gets plus
      const spreadValue = hasSpread && game.spread ? Math.abs(game.spread) : null
      const spreadDisplay = spreadValue ? (isFavorite ? `-${spreadValue}` : `+${spreadValue}`) : null

      return (
        <button
          key={team.id}
          onClick={() => handlePick(game.id, team.id)}
          disabled={isLocked}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all ${ringClass} ${
            isLocked ? 'cursor-default' : 'hover:opacity-80 active:scale-[0.99]'
          }`}
          style={{ backgroundColor: d1Team ? d1Team.primaryColor + '40' : '#3f3f4640' }}
        >
          <span className="w-5 text-xs font-mono text-zinc-400">{team.seed}</span>
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: d1Team?.primaryColor || '#3f3f46' }}
          >
            {logo ? (
              <img src={logo} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
            ) : (
              <span className="text-[10px] font-bold text-white">{d1Team?.abbreviation?.slice(0, 2) || team.short_name?.slice(0, 2) || '?'}</span>
            )}
          </div>
          <span className="flex-1 truncate text-sm text-white text-left">
            {d1Team?.shortName || team.short_name || team.name}
            {spreadDisplay && (
              <span className="text-xs text-zinc-400 ml-1">{spreadDisplay}</span>
            )}
          </span>
          {/* Score column */}
          {isComplete && (
            <span className={`w-8 text-right text-sm text-zinc-300 ${isWinner ? 'font-bold' : 'font-normal'}`}>
              {team.id === game.team1?.id ? game.team1_score : game.team2_score}
            </span>
          )}
          {/* Circled checkmark for pending picks */}
          {isPicked && !isComplete && (
            <svg className="w-5 h-5 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          )}
        </button>
      )
    }

    return (
      <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
        {/* Header: Date/Time, Location, Channel */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">{formatGameTime(game.scheduled_at)}</span>
          )}
          {game.location && (
            <span className="flex-1 truncate">{game.location}</span>
          )}
          {game.channel && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">
              {game.channel}{channelNum ? ` (${channelNum})` : ''}
            </span>
          )}
        </div>

        {/* Favorite (top) */}
        {renderTeamRow(favoriteTeam, d1Favorite, logoFavorite, true)}

        {/* Underdog (bottom) */}
        {renderTeamRow(underdogTeam, d1Underdog, logoUnderdog, false)}
      </div>
    )
  }

  // Get rank with ties (same score = same rank)
  const getRank = (standings: typeof calculateSessionStandings extends (g: Game[]) => infer R ? R : never, index: number) => {
    const currentScore = standings[index].correct_picks
    const firstWithScore = standings.findIndex(s => s.correct_picks === currentScore)
    return firstWithScore + 1
  }

  const renderSessionLeaderboard = (sessionGames: Game[], sessionNum: number, expanded: boolean, onToggle: () => void) => {
    const standings = calculateSessionStandings(sessionGames)
    if (standings.length === 0) return null

    return (
      <div>
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-between py-2 hover:opacity-80 transition-opacity"
        >
          <span className="text-xs font-medium text-zinc-400">Leaderboard</span>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>

        {expanded && (
          <div className="bg-zinc-800/30 rounded-xl p-3 space-y-1">
            {standings.map((standing, index) => {
              const rank = getRank(standings, index)

              // Calculate payout considering ties
              // Find how many people are tied at this rank
              const tiedCount = standings.filter(s => s.correct_picks === standing.correct_picks).length

              // Sum up payouts for all positions this tie group occupies (positions rank through rank+tiedCount-1)
              // Only positions 1-3 have payouts
              const payoutAmounts = [sessionPayouts.first, sessionPayouts.second, sessionPayouts.third]
              let totalPayoutForTie = 0
              for (let pos = rank; pos < rank + tiedCount && pos <= 3; pos++) {
                totalPayoutForTie += payoutAmounts[pos - 1]
              }

              // Split equally among tied users (round to whole dollars)
              const payout = totalPayoutForTie > 0 ? Math.floor(totalPayoutForTie / tiedCount) : 0

              return (
                <div
                  key={standing.user_id}
                  className={`flex items-center justify-between text-sm py-1 px-2 rounded ${
                    standing.is_current_user ? 'bg-orange-500/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-5 text-xs font-bold ${
                      rank === 1 ? 'text-yellow-400' :
                      rank === 2 ? 'text-zinc-300' :
                      rank === 3 ? 'text-orange-400' :
                      'text-zinc-500'
                    }`}>
                      {rank}
                    </span>
                    <span className={`text-sm ${standing.is_current_user ? 'font-medium' : ''}`}>
                      {standing.display_name}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-400">
                      {standing.correct_picks}/{sessionGames.length}
                    </span>
                    {payout > 0 && (
                      <span className="text-xs text-green-400 font-medium">${payout}</span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-6">
      {/* Simulated Time Banner */}
      {simulatedTime && (
        <div className="bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg px-4 py-2 text-xs">
          <span className="font-bold">DEV MODE:</span> Simulated time is {getCurrentTime().toLocaleString()}
        </div>
      )}

      <h1 className="text-xl font-bold text-orange-500">Pick&apos;em</h1>

      {/* Day Tabs */}
      <div className="flex gap-2">
        {pickemDays.map((day, index) => {
          const entry = userEntries.find(e => e.pickem_day_id === day.id)
          const hasPaid = entry?.has_paid ?? false

          return (
            <div key={day.id} className="flex flex-col items-center flex-1">
              <button
                onClick={() => setSelectedDayIndex(index)}
                className={`w-full px-3 py-1.5 rounded-t text-sm font-medium transition-colors ${
                  selectedDayIndex === index
                    ? 'bg-orange-500 text-white'
                    : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                {formatDayName(day.contest_date)}
              </button>
              <div className={`w-full text-[10px] font-bold text-center py-0.5 rounded-b ${
                hasPaid
                  ? 'bg-green-500/20 text-green-400'
                  : 'bg-red-500/20 text-red-400'
              }`}>
                {hasPaid ? 'PAID' : 'PAY BRO'}
              </div>
            </div>
          )
        })}
      </div>

      {/* Lock Status */}
      {isLocked && (
        <div className="bg-red-500/20 text-red-400 rounded-lg px-4 py-2 text-sm">
          Picks are locked for {formatDayName(currentDay.contest_date)}
        </div>
      )}

      {/* Payouts */}
      {(sessionPayouts.first > 0 || sessionPayouts.second > 0 || sessionPayouts.third > 0) && (
        <div className="bg-zinc-800/50 rounded-xl px-4 py-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-orange-400">Session Payouts</span>
          <div className="flex items-center gap-4 text-sm">
            {sessionPayouts.first > 0 && (
              <span><span className="text-zinc-400">1st</span> ${sessionPayouts.first}</span>
            )}
            {sessionPayouts.second > 0 && (
              <span><span className="text-zinc-400">2nd</span> ${sessionPayouts.second}</span>
            )}
            {sessionPayouts.third > 0 && (
              <span><span className="text-zinc-400">3rd</span> ${sessionPayouts.third}</span>
            )}
          </div>
        </div>
      )}

      {/* Session 1 */}
      <div className="space-y-2">
        <button
          onClick={toggleSession1Games}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-semibold text-orange-400">Session 1 - Early Games</h3>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${session1GamesExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>
        {renderSessionLeaderboard(session1Games, 1, session1LeaderboardExpanded, toggleSession1Leaderboard)}
        {session1GamesExpanded && (
          <div className="space-y-2">
            {session1Games.map(game => renderGame(game))}
          </div>
        )}
      </div>

      {/* Session 2 */}
      <div className="space-y-2">
        <button
          onClick={toggleSession2Games}
          className="w-full flex items-center justify-between"
        >
          <h3 className="text-sm font-semibold text-orange-400">Session 2 - Late Games</h3>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${session2GamesExpanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </button>
        {renderSessionLeaderboard(session2Games, 2, session2LeaderboardExpanded, toggleSession2Leaderboard)}
        {session2GamesExpanded && (
          <div className="space-y-2">
            {session2Games.map(game => renderGame(game))}
          </div>
        )}
      </div>
    </div>
  )
}
