'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

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
  region_id: string | null
  game_number: number
  location?: string | null
  channel?: string | null
  team1: Team | null
  team2: Team | null
}

interface Region {
  id: string
  name: string
  position: number
}

interface User {
  id: string
  display_name: string | null
}

interface BrocketEntry {
  id: string
  user_id: string
  tournament_id: string
  has_paid?: boolean
}

interface BrocketPick {
  id: string
  entry_id: string
  game_id: string | null
  picked_team_id: string
  is_correct: boolean | null
}

interface Props {
  userId: string
  tournamentId: string
  regions: Region[]
  games: Game[]
  users: User[]
  userEntry: BrocketEntry | null
  userPicks: BrocketPick[]
  allEntries: BrocketEntry[]
  allPicks: BrocketPick[]
  entryFee: number
  simulatedTime: string | null
  firstGameTime: string | null
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
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

const formatLockTime = (dateStr: string | null) => {
  if (!dateStr) return null
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, , month, day, hours, mins] = match
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'
  const date = new Date(`${match[1]}-${month}-${day}T12:00:00`)
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long' })
  return `${dayName} ${hour12}:${mins} ${ampm} ET`
}

export function BrocketClient({
  userId,
  tournamentId,
  regions,
  games,
  users,
  userEntry,
  userPicks,
  allEntries,
  allPicks,
  entryFee,
  simulatedTime,
  firstGameTime,
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
    const eastern = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    return new Date(eastern)
  }

  const [selectedRegionId, setSelectedRegionId] = useState<string>(regions[0]?.id || '')
  const [localPicks, setLocalPicks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  // Check if picks are locked
  const isLocked = firstGameTime ? parseTimestamp(firstGameTime) <= getCurrentTime() : false

  // Get games for selected region (sorted by bracket order)
  const regionGames = games
    .filter(g => g.region_id === selectedRegionId)
    .sort((a, b) => a.game_number - b.game_number)

  // Get user's picked team for a game
  const getPickedTeamId = (gameId: string): string => {
    if (localPicks[gameId]) return localPicks[gameId]
    const pick = userPicks.find(p => p.game_id === gameId)
    return pick?.picked_team_id || ''
  }

  const handlePick = async (gameId: string, teamId: string) => {
    if (isLocked || saving) return
    setLocalPicks(prev => ({ ...prev, [gameId]: teamId }))
    setSaving(true)

    try {
      const res = await fetch('/api/brocket', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tournamentId,
          gameId,
          teamId,
        }),
        credentials: 'include',
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

  // Calculate standings for leaderboard
  const calculateStandings = () => {
    return allEntries
      .filter(e => e.has_paid === true)
      .map(entry => {
        const user = users.find(u => u.id === entry.user_id)
        const entryPicks = allPicks.filter(p => p.entry_id === entry.id)

        let points = 0
        let maxPossible = 0

        entryPicks.forEach(pick => {
          const game = games.find(g => g.id === pick.game_id)
          if (!game) return

          const pickedTeam = game.team1?.id === pick.picked_team_id
            ? game.team1
            : game.team2

          if (!pickedTeam) return

          if (game.winner_id === pick.picked_team_id) {
            // Correct pick - add seed points
            points += pickedTeam.seed
            maxPossible += pickedTeam.seed
          } else if (game.winner_id === null) {
            // Game not played yet - counts toward max possible
            maxPossible += pickedTeam.seed
          }
          // Wrong pick: 0 points, 0 max for this game
        })

        return {
          user_id: entry.user_id,
          display_name: user?.display_name || 'Unknown',
          points,
          max_possible: maxPossible,
          is_current_user: entry.user_id === userId,
        }
      })
      .sort((a, b) => {
        // Sort by points descending, then max_possible descending as tiebreaker
        if (b.points !== a.points) return b.points - a.points
        return b.max_possible - a.max_possible
      })
  }

  // Calculate payouts
  const paidEntriesCount = allEntries.filter(e => e.has_paid === true).length
  const totalPot = paidEntriesCount * entryFee
  const payouts = {
    first: Math.round(totalPot * 0.5),
    second: Math.round(totalPot * 0.3),
    third: Math.round(totalPot * 0.2),
  }

  const renderGame = (game: Game) => {
    if (!game.team1 || !game.team2) return null

    // Sort teams by seed for consistent display (lower seed on top)
    const topTeam = game.team1.seed < game.team2.seed ? game.team1 : game.team2
    const bottomTeam = game.team1.seed < game.team2.seed ? game.team2 : game.team1

    const d1Top = findD1Team(topTeam.name)
    const d1Bottom = findD1Team(bottomTeam.name)
    const logoTop = d1Top ? getTeamLogoUrl(d1Top) : null
    const logoBottom = d1Bottom ? getTeamLogoUrl(d1Bottom) : null

    const pickedTeamId = getPickedTeamId(game.id)
    const isComplete = game.winner_id !== null
    const isStarted = game.scheduled_at && parseTimestamp(game.scheduled_at) <= getCurrentTime()

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null) => {
      const isPicked = pickedTeamId === team.id
      const isWinner = isComplete && game.winner_id === team.id
      const isCorrect = isPicked && isWinner

      let ringClass = ''
      if (isPicked) {
        ringClass = isComplete
          ? (isCorrect ? 'ring-2 ring-green-500' : 'ring-2 ring-red-500')
          : 'ring-2 ring-orange-500'
      }

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
          <span className={`flex-1 truncate text-sm text-left ${isWinner ? 'text-white font-bold' : 'text-white'}`}>
            {d1Team?.shortName || team.short_name || team.name}
          </span>
          {isComplete && (
            <span className={`w-8 text-right text-sm text-zinc-300 ${isWinner ? 'font-bold' : 'font-normal'}`}>
              {team.id === game.team1?.id ? game.team1_score : game.team2_score}
            </span>
          )}
          {isPicked && !isComplete && (
            <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          )}
          {isCorrect && (
            <span className="text-xs text-green-400 font-bold">+{team.seed}</span>
          )}
        </button>
      )
    }

    return (
      <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className={`px-1 py-0.5 rounded flex items-center gap-1 ${isStarted && !isComplete ? 'bg-red-500/20 text-red-400 font-bold' : 'bg-zinc-800'}`}>
              {isStarted && !isComplete ? 'LIVE' : formatGameTime(game.scheduled_at)}
            </span>
          )}
          {game.location && (
            <span className="flex-1 text-center truncate">{game.location}</span>
          )}
          {game.channel && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">{game.channel}</span>
          )}
        </div>
        {renderTeamRow(topTeam, d1Top, logoTop)}
        {renderTeamRow(bottomTeam, d1Bottom, logoBottom)}
      </div>
    )
  }

  const renderLeaderboard = () => {
    const standings = calculateStandings()

    if (standings.length === 0) {
      return (
        <div className="text-sm text-zinc-500 text-center py-8">
          No paid entries yet
        </div>
      )
    }

    return (
      <div className="space-y-1">
        {standings.map((standing, index) => {
          const rank = index + 1
          let payout = 0
          if (rank === 1) payout = payouts.first
          else if (rank === 2) payout = payouts.second
          else if (rank === 3) payout = payouts.third

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
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="text-white font-bold">{standing.points}</span>
                  <span className="text-zinc-500 text-xs ml-1">pts</span>
                </div>
                <div className="text-right w-16">
                  <span className="text-zinc-400 text-xs">max </span>
                  <span className="text-zinc-300">{standing.max_possible}</span>
                </div>
                {payout > 0 && (
                  <span className="text-green-400 font-medium w-12 text-right">${payout}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-orange-400 uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
          </svg>
          Brocket
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Straight-up first round winners - no spread!</p>
        <p className="text-xs text-zinc-500 mt-0.5">Earn points for the seed of your winners.</p>
      </div>

      {/* Leaderboard Container */}
      <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
        <div className={`px-4 py-2 text-sm text-center flex items-center justify-center gap-2 ${isLocked ? 'bg-zinc-700/50 text-white font-medium' : 'text-zinc-400'}`}>
          {isLocked ? (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a3 3 0 0 1 3 3h-15a3 3 0 0 1 3-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 0 1-.982-3.172M9.497 14.25a7.454 7.454 0 0 0 .981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 0 0 7.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M7.73 9.728a6.726 6.726 0 0 0 2.748 1.35m8.272-6.842V4.5c0 2.108-.966 3.99-2.48 5.228m2.48-5.492a46.32 46.32 0 0 1 2.916.52 6.003 6.003 0 0 1-5.395 4.972m0 0a6.726 6.726 0 0 1-2.749 1.35m0 0a6.772 6.772 0 0 1-2.752 0" />
              </svg>
              Leaderboard
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
              Picks lock {formatLockTime(firstGameTime)}
            </>
          )}
        </div>
        <div className="p-3">
          {/* Payouts */}
          {(payouts.first > 0 || payouts.second > 0 || payouts.third > 0) && (
            <div className="bg-zinc-900/50 rounded-lg px-4 py-2 text-center mb-3">
              <div className="flex justify-center gap-6 text-sm">
                <span><span className="text-yellow-400">1st</span> ${payouts.first}</span>
                <span><span className="text-zinc-300">2nd</span> ${payouts.second}</span>
                <span><span className="text-orange-400">3rd</span> ${payouts.third}</span>
              </div>
            </div>
          )}
          {renderLeaderboard()}
        </div>
      </div>

      {/* Region Tabs */}
      <div className="flex gap-2">
        {regions.map((region) => {
          const regionGameCount = games.filter(g => g.region_id === region.id).length
          const regionPickCount = userPicks.filter(p => {
            const game = games.find(g => g.id === p.game_id)
            return game?.region_id === region.id
          }).length

          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegionId(region.id)}
              className={`flex-1 px-2 py-2 rounded-lg text-xs font-medium transition-colors ${
                selectedRegionId === region.id
                  ? 'bg-orange-500 text-orange-950'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              <div>{region.name}</div>
              <div className={`text-[10px] ${selectedRegionId === region.id ? 'text-orange-800' : 'text-zinc-500'}`}>
                {regionPickCount}/{regionGameCount}
              </div>
            </button>
          )
        })}
      </div>

      {/* Games for selected region */}
      <div className="space-y-2">
        {regionGames.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-zinc-400">No games scheduled for this region yet.</p>
          </div>
        ) : (
          regionGames.map(game => renderGame(game))
        )}
      </div>
    </div>
  )
}
