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
  enabledDays: string[]  // Day names like "Thursday", "Friday", etc.
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
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, , , , hours, mins] = match
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'p' : 'a'
  return `${hour12}:${mins}${ampm}`
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
  enabledDays,
}: Props) {
  // Parse a timestamp string (stored as Eastern) into a Date object
  const parseTimestamp = (timeStr: string): Date => {
    const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
    if (!match) return new Date(0)
    const [, year, month, day, hours, mins, secs] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(mins), parseInt(secs || '0'))
  }

  // Get current time as a Date object (in Eastern time context)
  const getCurrentTime = (): Date => {
    if (simulatedTime) {
      return parseTimestamp(simulatedTime)
    }
    // Get current Eastern time
    const eastern = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    return new Date(eastern)
  }

  const [selectedDayName, setSelectedDayName] = useState(enabledDays[0] || 'Thursday')
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

  // Find the pickem_day that matches the selected day name
  const currentDay = pickemDays.find(d => formatDayName(d.contest_date) === selectedDayName)

  // Get games for current day (if it exists)
  const dayGames = currentDay
    ? games
        .filter(g => g.scheduled_at?.split('T')[0] === currentDay.contest_date)
        .sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
    : []

  // Check if this day has no games yet
  const dayHasNoGames = !currentDay || dayGames.length === 0

  // Split into sessions
  const midpoint = Math.ceil(dayGames.length / 2)
  const session1Games = dayGames.slice(0, midpoint)
  const session2Games = dayGames.slice(midpoint)

  // Calculate session payouts with $5 rounding
  const paidEntriesForDay = currentDay
    ? allEntries.filter(e => e.pickem_day_id === currentDay.id && e.has_paid === true).length
    : 0
  const dayPot = paidEntriesForDay * entryFee
  const sessionPot = Math.round((dayPot / 2) / 5) * 5 // Round session pot to $5

  // Calculate payouts rounded to $5, ensuring total equals session pot
  const calculateSessionPayouts = (pot: number) => {
    const percentages = { first: 0.6, second: 0.3, third: 0.1 }
    const entries = Object.entries(percentages).map(([key, pct]) => {
      const raw = pot * pct
      const rounded = Math.round(raw / 5) * 5
      const diff = raw - rounded
      return { key, raw, rounded, diff }
    })

    let total = entries.reduce((sum, e) => sum + e.rounded, 0)
    let adjustment = pot - total

    while (adjustment !== 0) {
      if (adjustment > 0) {
        entries.sort((a, b) => b.diff - a.diff)
        entries[0].rounded += 5
        entries[0].diff -= 5
        adjustment -= 5
      } else {
        entries.sort((a, b) => a.diff - b.diff)
        entries[0].rounded -= 5
        entries[0].diff += 5
        adjustment += 5
      }
    }

    const result: Record<string, number> = {}
    entries.forEach(e => { result[e.key] = e.rounded })
    return result as { first: number; second: number; third: number }
  }

  const sessionPayouts = calculateSessionPayouts(sessionPot)

  // Check if day is locked
  const firstGameTime = dayGames[0]?.scheduled_at
  const isLocked = firstGameTime ? parseTimestamp(firstGameTime) <= getCurrentTime() : false

  // Get user's entry and picks
  const userEntry = currentDay ? userEntries.find(e => e.pickem_day_id === currentDay.id) : undefined
  const dayGameIds = dayGames.map(g => g.id)
  const userDayPicks = userPicks.filter(p => p.game_id && dayGameIds.includes(p.game_id))

  const getPickedTeamId = (gameId: string): string => {
    if (localPicks[gameId]) return localPicks[gameId]
    const pick = userDayPicks.find(p => p.game_id === gameId)
    return pick?.picked_team_id || ''
  }

  const handlePick = async (gameId: string, teamId: string) => {
    if (isLocked || saving || !currentDay) return
    setLocalPicks(prev => ({ ...prev, [gameId]: teamId }))
    setSaving(true)

    try {
      // Use API route to handle picks (supports simulation mode)
      const res = await fetch('/api/pickem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          pickemDayId: currentDay.id,
          gameId,
          teamId,
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save pick')
      }

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
      .sort((a, b) => parseTimestamp(a.scheduled_at || '').getTime() - parseTimestamp(b.scheduled_at || '').getTime())
    const completedGameIds = completedGames.map(g => g.id)
    const sessionGameIds = sessionGames.map(g => g.id)
    const dayEntries = currentDay
      ? allEntries.filter(e => e.pickem_day_id === currentDay.id && e.has_paid === true)
      : []

    return dayEntries.map(entry => {
      const user = users.find(u => u.id === entry.user_id)
      const entryPicks = allPicks.filter(p =>
        p.entry_id === entry.id && p.game_id && sessionGameIds.includes(p.game_id)
      )
      const correctPicks = entryPicks.filter(p =>
        p.is_correct === true && completedGameIds.includes(p.game_id!)
      ).length

      // Tiebreaker: check each completed game in order
      // Missing picks count as losses!
      let firstLoss: number | null = null
      let secondLoss: number | null = null
      completedGames.forEach((game, index) => {
        const pick = entryPicks.find(p => p.game_id === game.id)
        // Loss = no pick made OR pick was incorrect
        const isLoss = !pick || pick.is_correct === false
        if (isLoss) {
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
    const current = standings[index]
    // Find rank by checking all tiebreaker values, not just correct_picks
    return standings.findIndex(s =>
      s.correct_picks === current.correct_picks &&
      s.second_loss === current.second_loss &&
      s.first_loss === current.first_loss
    ) + 1
  }

  // Check if two standings entries are truly tied
  const isTied = (standings: ReturnType<typeof calculateSessionStandings>, index: number) => {
    if (index >= standings.length - 1) return false
    const current = standings[index]
    const next = standings[index + 1]
    return current.correct_picks === next.correct_picks &&
           current.second_loss === next.second_loss &&
           current.first_loss === next.first_loss
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

    const isStarted = game.scheduled_at && parseTimestamp(game.scheduled_at) <= getCurrentTime()

    return (
      <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className={`px-1 py-0.5 rounded flex items-center gap-1 ${isStarted && !isComplete ? 'bg-red-500/20 text-red-400 font-bold' : 'bg-zinc-800'}`}>
              {isStarted && !isComplete ? 'LIVE' : formatGameTime(game.scheduled_at)}
              {isLocked && (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                </svg>
              )}
            </span>
          )}
          {game.location && (
            <span className="flex-1 text-center truncate">{game.location}</span>
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

  const renderLeaderboard = (sessionGames: Game[], _sessionLabel: string) => {
    const standings = calculateSessionStandings(sessionGames)
    if (standings.length === 0) {
      return (
        <div className="text-sm text-zinc-500 text-center py-4">
          No paid entries yet
        </div>
      )
    }

    // Count truly tied entries (same score AND same tiebreakers)
    const getTiedCount = (index: number) => {
      const current = standings[index]
      return standings.filter(s =>
        s.correct_picks === current.correct_picks &&
        s.second_loss === current.second_loss &&
        s.first_loss === current.first_loss
      ).length
    }

    return (
      <div className="space-y-1">
        {standings.map((standing, index) => {
          const rank = getRank(standings, index)
          const tiedCount = getTiedCount(index)
          const payoutAmounts = [sessionPayouts.first, sessionPayouts.second, sessionPayouts.third]
          let totalPayoutForTie = 0
          for (let pos = rank; pos < rank + tiedCount && pos <= 3; pos++) {
            totalPayoutForTie += payoutAmounts[pos - 1]
          }
          const payout = totalPayoutForTie > 0 ? Math.floor(totalPayoutForTie / tiedCount) : 0

          // Show tiebreaker info if there are others with same correct picks
          const othersWithSameScore = standings.filter(s =>
            s.correct_picks === standing.correct_picks && s.user_id !== standing.user_id
          )
          const showTiebreaker = othersWithSameScore.length > 0 && standing.first_loss !== null

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
                <div className="flex flex-col">
                  <span className={standing.is_current_user ? 'font-medium' : ''}>
                    {standing.display_name}
                  </span>
                  {showTiebreaker && (
                    <span className="text-xs text-zinc-500">
                      1st miss: G{standing.first_loss}{standing.second_loss ? `, 2nd: G${standing.second_loss}` : ''}
                    </span>
                  )}
                </div>
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
      <h1 className="text-xl font-bold text-orange-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>NCAA Pick'em</h1>
      {/* Day Tabs */}
      <div className="flex gap-2">
        {enabledDays.map((dayName) => {
          const pickemDay = pickemDays.find(d => formatDayName(d.contest_date) === dayName)
          const entry = pickemDay ? userEntries.find(e => e.pickem_day_id === pickemDay.id) : null
          const hasPaid = entry?.has_paid ?? false
          const hasGames = pickemDay !== undefined

          // Check if this day is locked (first game has started)
          const dayGamesForTab = pickemDay
            ? games.filter(g => g.scheduled_at?.split('T')[0] === pickemDay.contest_date)
            : []
          const firstGameOfDay = dayGamesForTab.length > 0
            ? dayGamesForTab.reduce((earliest, g) =>
                !earliest || (g.scheduled_at && g.scheduled_at < earliest.scheduled_at!) ? g : earliest
              , dayGamesForTab[0])
            : null
          const isDayLocked = firstGameOfDay?.scheduled_at
            ? parseTimestamp(firstGameOfDay.scheduled_at) <= getCurrentTime()
            : false

          return (
            <button
              key={dayName}
              onClick={() => setSelectedDayName(dayName)}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedDayName === dayName
                  ? 'bg-orange-500 text-orange-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <div className="flex items-center justify-center gap-1">
                {dayName.slice(0, 3)}
                {isDayLocked && (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                  </svg>
                )}
              </div>
              <div className={`text-[10px] ${
                selectedDayName === dayName
                  ? (hasGames ? (hasPaid ? 'text-green-700' : 'text-red-600 font-bold') : 'text-orange-800')
                  : (hasGames ? (hasPaid ? 'text-green-500' : 'text-red-500 font-bold') : 'text-zinc-500')
              }`}>
                {hasGames ? (hasPaid ? 'PAID' : `PAY BRO $${entryFee}`) : 'SOON'}
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
      {activeTab === 'picks' && dayHasNoGames && (
        <div className="text-center py-12">
          <p className="text-zinc-400 text-lg">{selectedDayName} games coming soon!</p>
          <p className="text-zinc-500 text-sm mt-2">Check back once the bracket is set.</p>
        </div>
      )}

      {activeTab === 'picks' && !dayHasNoGames && (() => {
        const getSessionStats = (sessionGames: Game[]) => {
          const completedGames = sessionGames.filter(g => g.winner_id !== null)
          const correctCount = completedGames.filter(game => {
            const pick = userDayPicks.find(p => p.game_id === game.id)
            if (!pick) return false
            if (pick.is_correct !== null) return pick.is_correct
            return isPickCorrect(game, pick.picked_team_id) === true
          }).length
          return { correct: correctCount, total: completedGames.length }
        }
        const session1Stats = getSessionStats(session1Games)
        const session2Stats = getSessionStats(session2Games)

        // Check if any late game has started
        const lateGamesStarted = session2Games.some(g =>
          g.scheduled_at && parseTimestamp(g.scheduled_at) <= getCurrentTime()
        )

        const renderEarlyGames = () => (
          <div>
            <button
              onClick={toggleEarlyGames}
              className="w-full flex items-center justify-between py-2"
            >
              <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Early Games</h3>
              <div className="flex items-center gap-2">
                {session1Stats.total > 0 && (
                  <span className="text-zinc-400 text-sm">
                    {session1Stats.correct}/{session1Stats.total} correct
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-zinc-400 transition-transform ${earlyGamesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </div>
            </button>
            {earlyGamesExpanded && (
              <div className="space-y-2">
                {session1Games.map(game => renderGame(game))}
              </div>
            )}
          </div>
        )

        const renderLateGames = () => (
          <div>
            <button
              onClick={toggleLateGames}
              className="w-full flex items-center justify-between py-2"
            >
              <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Late Games</h3>
              <div className="flex items-center gap-2">
                {session2Stats.total > 0 && (
                  <span className="text-zinc-400 text-sm">
                    {session2Stats.correct}/{session2Stats.total} correct
                  </span>
                )}
                <svg
                  className={`w-4 h-4 text-zinc-400 transition-transform ${lateGamesExpanded ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </div>
            </button>
            {lateGamesExpanded && (
              <div className="space-y-2">
                {session2Games.map(game => renderGame(game))}
              </div>
            )}
          </div>
        )

        return (
          <div className="space-y-4">
            {lateGamesStarted ? (
              <>
                {renderLateGames()}
                {renderEarlyGames()}
              </>
            ) : (
              <>
                {renderEarlyGames()}
                {renderLateGames()}
              </>
            )}
          </div>
        )
      })()}

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && dayHasNoGames && (
        <div className="text-center py-12">
          <p className="text-zinc-400 text-lg">{selectedDayName} games coming soon!</p>
          <p className="text-zinc-500 text-sm mt-2">Leaderboard will appear once games are scheduled.</p>
        </div>
      )}

      {activeTab === 'leaderboard' && !dayHasNoGames && (
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
            <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Session 1 - Early Games</h3>
            {renderLeaderboard(session1Games, 'Session 1')}
          </div>

          {/* Session 2 Leaderboard */}
          <div>
            <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Session 2 - Late Games</h3>
            {renderLeaderboard(session2Games, 'Session 2')}
          </div>
        </div>
      )}
    </div>
  )
}
