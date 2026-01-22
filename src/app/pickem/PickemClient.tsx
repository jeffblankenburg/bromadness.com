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

function formatShortDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short' })
}

const formatGameTime = (dateStr: string | null) => {
  if (!dateStr) return null
  return new Date(dateStr).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
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
  const getCurrentTime = () => simulatedTime ? new Date(simulatedTime) : new Date()
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [activeTab, setActiveTab] = useState<'picks' | 'leaderboard'>('picks')
  const [localPicks, setLocalPicks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [earlyGamesExpanded, setEarlyGamesExpanded] = useState(true)
  const [lateGamesExpanded, setLateGamesExpanded] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  // Persist tab and expand states
  useEffect(() => {
    const storedTab = localStorage.getItem('pickem-active-tab')
    if (storedTab === 'picks' || storedTab === 'leaderboard') {
      setActiveTab(storedTab)
    }
    const storedEarly = localStorage.getItem('pickem-early-expanded')
    const storedLate = localStorage.getItem('pickem-late-expanded')
    if (storedEarly !== null) setEarlyGamesExpanded(storedEarly === 'true')
    if (storedLate !== null) setLateGamesExpanded(storedLate === 'true')
  }, [])

  const handleTabChange = (tab: 'picks' | 'leaderboard') => {
    setActiveTab(tab)
    localStorage.setItem('pickem-active-tab', tab)
  }

  const toggleEarlyGames = () => {
    const newValue = !earlyGamesExpanded
    setEarlyGamesExpanded(newValue)
    localStorage.setItem('pickem-early-expanded', String(newValue))
  }

  const toggleLateGames = () => {
    const newValue = !lateGamesExpanded
    setLateGamesExpanded(newValue)
    localStorage.setItem('pickem-late-expanded', String(newValue))
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

  // Split into sessions
  const midpoint = Math.ceil(dayGames.length / 2)
  const session1Games = dayGames.slice(0, midpoint)
  const session2Games = dayGames.slice(midpoint)

  // Calculate session payouts
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

  // Check if day is locked
  const firstGameTime = dayGames[0]?.scheduled_at
  const isLocked = firstGameTime ? new Date(firstGameTime) <= getCurrentTime() : false

  // Get user's entry and picks
  const userEntry = userEntries.find(e => e.pickem_day_id === currentDay.id)
  const dayGameIds = dayGames.map(g => g.id)
  const userDayPicks = userPicks.filter(p => p.game_id && dayGameIds.includes(p.game_id))

  const getPickedTeamId = (gameId: string): string => {
    if (localPicks[gameId]) return localPicks[gameId]
    const pick = userDayPicks.find(p => p.game_id === gameId)
    return pick?.picked_team_id || ''
  }

  const handlePick = async (gameId: string, teamId: string) => {
    if (isLocked || saving) return
    setLocalPicks(prev => ({ ...prev, [gameId]: teamId }))
    setSaving(true)

    try {
      let entryId = userEntry?.id
      if (!entryId) {
        const { data: newEntry, error: entryError } = await supabase
          .from('pickem_entries')
          .insert({ user_id: userId, pickem_day_id: currentDay.id })
          .select()
          .single()
        if (entryError) throw entryError
        entryId = newEntry.id
      }

      const { error: pickError } = await supabase
        .from('pickem_picks')
        .upsert({
          entry_id: entryId,
          game_id: gameId,
          picked_team_id: teamId,
          is_correct: null,
        }, { onConflict: 'entry_id,game_id' })

      if (pickError) throw pickError
      router.refresh()
    } catch (error) {
      console.error('Failed to save pick:', error)
      setLocalPicks(prev => {
        const next = { ...prev }
        delete next[gameId]
        return next
      })
    }
    setSaving(false)
  }

  // Spread logic
  const isPickCorrect = (game: Game, pickedTeamId: string): boolean | null => {
    if (!game.winner_id || game.spread === null) return null
    if (game.team1_score === null || game.team2_score === null) return null
    if (!game.team1 || !game.team2) return null

    const margin = game.team1_score - game.team2_score
    const team1IsLowerSeed = game.team1.seed < game.team2.seed
    const adjustedMargin = team1IsLowerSeed ? margin + game.spread : margin - game.spread
    const team1Covered = adjustedMargin > 0
    const pickedTeam1 = pickedTeamId === game.team1.id

    return pickedTeam1 ? team1Covered : !team1Covered
  }

  // Calculate standings for a session
  const calculateSessionStandings = (sessionGames: Game[]) => {
    const completedGames = sessionGames.filter(g => g.winner_id !== null)
    const completedGameIds = completedGames.map(g => g.id)
    const sessionGameIds = sessionGames.map(g => g.id)
    const dayEntries = allEntries.filter(e => e.pickem_day_id === currentDay.id && e.has_paid === true)

    return dayEntries.map(entry => {
      const user = users.find(u => u.id === entry.user_id)
      const entryPicks = allPicks.filter(p =>
        p.entry_id === entry.id && p.game_id && sessionGameIds.includes(p.game_id)
      )
      const correctPicks = entryPicks.filter(p =>
        p.is_correct === true && completedGameIds.includes(p.game_id!)
      ).length

      // Tiebreaker
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
          if (firstLoss === null) firstLoss = index + 1
          else if (secondLoss === null) secondLoss = index + 1
        }
      })

      return {
        user_id: entry.user_id,
        display_name: user?.display_name || 'Unknown',
        correct_picks: correctPicks,
        total_games: sessionGames.length,
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

  const getRank = (standings: ReturnType<typeof calculateSessionStandings>, index: number) => {
    const currentScore = standings[index].correct_picks
    return standings.findIndex(s => s.correct_picks === currentScore) + 1
  }

  const renderGame = (game: Game) => {
    if (!game.team1 || !game.team2) return null

    const lowerSeedTeam = game.team1.seed < game.team2.seed ? game.team1 : game.team2
    const higherSeedTeam = game.team1.seed < game.team2.seed ? game.team2 : game.team1
    const lowerSeedIsFavorite = game.spread ? game.spread < 0 : true
    const favoriteTeam = lowerSeedIsFavorite ? lowerSeedTeam : higherSeedTeam
    const underdogTeam = lowerSeedIsFavorite ? higherSeedTeam : lowerSeedTeam

    const d1Favorite = findD1Team(favoriteTeam.name)
    const d1Underdog = findD1Team(underdogTeam.name)
    const logoFavorite = d1Favorite ? getTeamLogoUrl(d1Favorite) : null
    const logoUnderdog = d1Underdog ? getTeamLogoUrl(d1Underdog) : null

    const pickedTeamId = getPickedTeamId(game.id)
    const isComplete = game.winner_id !== null
    const hasSpread = game.spread !== null
    const savedPick = userDayPicks.find(p => p.game_id === game.id)
    const pickCorrectness = savedPick?.is_correct ?? (isComplete && pickedTeamId ? isPickCorrect(game, pickedTeamId) : null)
    const channelNum = getChannelNumber(game.channel || null)

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null, isFavorite: boolean) => {
      const isPicked = pickedTeamId === team.id
      const isWinner = isComplete && game.winner_id === team.id
      let ringClass = ''
      if (isPicked) {
        ringClass = isComplete
          ? (pickCorrectness === true ? 'ring-2 ring-green-500' : 'ring-2 ring-red-500')
          : 'ring-2 ring-orange-500'
      }
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
            {spreadDisplay && <span className="text-xs text-zinc-400 ml-1">{spreadDisplay}</span>}
          </span>
          {isComplete && (
            <span className={`w-8 text-right text-sm text-zinc-300 ${isWinner ? 'font-bold' : 'font-normal'}`}>
              {team.id === game.team1?.id ? game.team1_score : game.team2_score}
            </span>
          )}
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
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">{formatGameTime(game.scheduled_at)}</span>
          )}
          {game.channel && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">
              {game.channel}{channelNum ? ` (${channelNum})` : ''}
            </span>
          )}
        </div>
        {renderTeamRow(favoriteTeam, d1Favorite, logoFavorite, true)}
        {renderTeamRow(underdogTeam, d1Underdog, logoUnderdog, false)}
      </div>
    )
  }

  const renderLeaderboard = (sessionGames: Game[], sessionLabel: string) => {
    const standings = calculateSessionStandings(sessionGames)
    if (standings.length === 0) {
      return (
        <div className="text-sm text-zinc-500 text-center py-4">
          No paid entries yet
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {standings.map((standing, index) => {
          const rank = getRank(standings, index)
          const tiedCount = standings.filter(s => s.correct_picks === standing.correct_picks).length
          const payoutAmounts = [sessionPayouts.first, sessionPayouts.second, sessionPayouts.third]
          let totalPayoutForTie = 0
          for (let pos = rank; pos < rank + tiedCount && pos <= 3; pos++) {
            totalPayoutForTie += payoutAmounts[pos - 1]
          }
          const payout = totalPayoutForTie > 0 ? Math.floor(totalPayoutForTie / tiedCount) : 0

          return (
            <div
              key={standing.user_id}
              className={`flex items-center justify-between text-sm py-2 px-3 rounded-lg ${
                standing.is_current_user ? 'bg-orange-500/20' : 'bg-zinc-800/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className={`w-6 text-sm font-bold ${
                  rank === 1 ? 'text-yellow-400' :
                  rank === 2 ? 'text-zinc-300' :
                  rank === 3 ? 'text-orange-400' :
                  'text-zinc-500'
                }`}>
                  {rank}
                </span>
                <span className={standing.is_current_user ? 'font-medium' : ''}>
                  {standing.display_name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-zinc-400">
                  {standing.correct_picks}/{standing.total_games}
                </span>
                {payout > 0 && (
                  <span className="text-green-400 font-medium">${payout}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const picksCount = userDayPicks.length
  const totalGames = dayGames.length

  return (
    <div className="p-4 pb-20 space-y-4">
      {/* Simulated Time Banner */}
      {simulatedTime && (
        <div className="bg-purple-500/20 border border-purple-500/50 text-purple-300 rounded-lg px-4 py-2 text-xs">
          <span className="font-bold">DEV MODE:</span> Simulated time is {getCurrentTime().toLocaleString('en-US', {
            timeZone: 'America/New_York',
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })} ET
        </div>
      )}
        <h1 className="text-xl font-bold text-orange-500">NCAA Pick'em</h1>
      {/* Day Tabs */}
      <div className="flex gap-2">
        {pickemDays.map((day, index) => {
          const entry = userEntries.find(e => e.pickem_day_id === day.id)
          const hasPaid = entry?.has_paid ?? false

          return (
            <button
              key={day.id}
              onClick={() => setSelectedDayIndex(index)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDayIndex === index
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <div>{formatShortDayName(day.contest_date)}</div>
              <div className={`text-[10px] ${
                selectedDayIndex === index
                  ? (hasPaid ? 'text-green-300' : 'text-red-300')
                  : (hasPaid ? 'text-green-500' : 'text-red-500')
              }`}>
                {hasPaid ? 'PAID' : 'PAY BRO'}
              </div>
            </button>
          )
        })}
      </div>

      {/* Sub-tabs: My Picks / Leaderboard */}
      <div className="flex bg-zinc-800 rounded-lg p-1">
        <button
          onClick={() => handleTabChange('picks')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'picks'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          My Picks
          {!isLocked && (
            <span className="ml-2 text-xs text-zinc-500">({picksCount}/{totalGames})</span>
          )}
        </button>
        <button
          onClick={() => handleTabChange('leaderboard')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'leaderboard'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          Leaderboard
        </button>
      </div>

      {/* Lock Status */}
      {isLocked && activeTab === 'picks' && (
        <div className="bg-red-500/20 text-red-400 rounded-lg px-4 py-2 text-sm text-center">
          Picks are locked
        </div>
      )}

      {/* My Picks Tab */}
      {activeTab === 'picks' && (() => {
        const session1GameIds = session1Games.map(g => g.id)
        const session2GameIds = session2Games.map(g => g.id)
        const session1Correct = userDayPicks.filter(p => p.game_id && session1GameIds.includes(p.game_id) && p.is_correct === true).length
        const session2Correct = userDayPicks.filter(p => p.game_id && session2GameIds.includes(p.game_id) && p.is_correct === true).length
        const session1HasResults = session1Games.some(g => g.winner_id !== null)
        const session2HasResults = session2Games.some(g => g.winner_id !== null)

        return (
          <div className="space-y-4">
            {/* Early Games */}
            <div>
              <button
                onClick={toggleEarlyGames}
                className="w-full flex items-center justify-between py-2"
              >
                <h3 className="text-sm font-semibold text-orange-400">
                  Early Games
                  {session1HasResults && (
                    <span className="text-zinc-400 font-normal ml-2">
                      {session1Correct} Correct
                    </span>
                  )}
                </h3>
                <svg
                  className={`w-4 h-4 text-zinc-400 transition-transform ${earlyGamesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </button>
              {earlyGamesExpanded && (
                <div className="space-y-2">
                  {session1Games.map(game => renderGame(game))}
                </div>
              )}
            </div>

            {/* Late Games */}
            <div>
              <button
                onClick={toggleLateGames}
                className="w-full flex items-center justify-between py-2"
              >
                <h3 className="text-sm font-semibold text-orange-400">
                  Late Games
                  {session2HasResults && (
                    <span className="text-zinc-400 font-normal ml-2">
                      {session2Correct} Correct
                    </span>
                  )}
                </h3>
                <svg
                  className={`w-4 h-4 text-zinc-400 transition-transform ${lateGamesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </button>
              {lateGamesExpanded && (
                <div className="space-y-2">
                  {session2Games.map(game => renderGame(game))}
                </div>
              )}
            </div>
          </div>
        )
      })()}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <div className="space-y-6">
          {/* Payouts */}
          {(sessionPayouts.first > 0 || sessionPayouts.second > 0 || sessionPayouts.third > 0) && (
            <div className="bg-zinc-800/50 rounded-xl px-4 py-3 text-center">
              <div className="text-xs text-zinc-500 mb-1">Session Payouts</div>
              <div className="flex justify-center gap-6 text-sm">
                <span><span className="text-yellow-400">1st</span> ${sessionPayouts.first}</span>
                <span><span className="text-zinc-300">2nd</span> ${sessionPayouts.second}</span>
                <span><span className="text-orange-400">3rd</span> ${sessionPayouts.third}</span>
              </div>
            </div>
          )}

          {/* Session 1 Leaderboard */}
          <div>
            <h3 className="text-sm font-semibold text-orange-400 mb-3">Session 1 - Early Games</h3>
            {renderLeaderboard(session1Games, 'Session 1')}
          </div>

          {/* Session 2 Leaderboard */}
          <div>
            <h3 className="text-sm font-semibold text-orange-400 mb-3">Session 2 - Late Games</h3>
            {renderLeaderboard(session2Games, 'Session 2')}
          </div>
        </div>
      )}
    </div>
  )
}
