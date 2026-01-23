'use client'

import { useState, useEffect } from 'react'
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
  location: string | null
  channel: string | null
  spread: number | null
  favorite_team_id: string | null
  team1: Team | null
  team2: Team | null
}

interface Props {
  games: Game[]
  userAuctionTeamIds: string[]
  userPickemTeamIds: string[]
  pickemPayout?: number
  simulatedTime?: string | null
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

// Parse a timestamp string (stored as Eastern) into a Date object
const parseTimestamp = (timeStr: string): Date => {
  const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
  if (!match) return new Date(0)
  const [, year, month, day, hours, mins, secs] = match
  return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(mins), parseInt(secs || '0'))
}

export function CurrentGames({ games, userAuctionTeamIds, userPickemTeamIds, pickemPayout = 0, simulatedTime }: Props) {
  const [expanded, setExpanded] = useState(true)

  // Get current time as a Date object (in Eastern time context)
  const getCurrentTime = (): Date => {
    if (simulatedTime) {
      return parseTimestamp(simulatedTime)
    }
    // Get current Eastern time
    const eastern = new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })
    return new Date(eastern)
  }

  // Load saved state from localStorage after mount
  useEffect(() => {
    const saved = localStorage.getItem('current-games-expanded')
    if (saved !== null) {
      setExpanded(saved === 'true')
    }
  }, [])

  // Save state changes to localStorage
  const toggleExpanded = () => {
    const newValue = !expanded
    setExpanded(newValue)
    localStorage.setItem('current-games-expanded', String(newValue))
  }

  const renderGame = (game: Game) => {
    if (!game.team1 || !game.team2) return null

    const d1Team1 = findD1Team(game.team1.name)
    const d1Team2 = findD1Team(game.team2.name)
    const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
    const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

    const isStarted = game.scheduled_at && parseTimestamp(game.scheduled_at) <= getCurrentTime()
    const channelNum = getChannelNumber(game.channel)

    // Determine which team is the favorite
    // Spread is assigned to lower seed: positive = higher seed is favorite, negative = lower seed is favorite
    const team1IsFavorite = game.spread
      ? (game.spread < 0 ? game.team1.seed < game.team2.seed : game.team1.seed > game.team2.seed)
      : game.team1.seed < game.team2.seed

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null, isFavorite: boolean) => {
      const hasSpread = game.spread !== null && game.spread !== 0
      const spreadValue = hasSpread ? Math.abs(game.spread!) : null
      const spreadDisplay = spreadValue ? (isFavorite ? `-${spreadValue}` : `+${spreadValue}`) : null
      const isAuctionTeam = userAuctionTeamIds.includes(team.id)
      const isPickemTeam = userPickemTeamIds.includes(team.id)

      return (
        <div
          className="w-full flex items-center gap-2 px-2 py-2 rounded-lg"
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
          {/* Auction ownership icon (rocket) */}
          {isAuctionTeam && (
            <span className="text-zinc-400 flex-shrink-0" title="Your auction team">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
              </svg>
            </span>
          )}
          {/* Pickem pick icon (circled checkmark) */}
          {isPickemTeam && (
            <span className="text-zinc-400 flex-shrink-0" title="Your pick">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
          )}
        </div>
      )
    }

    return (
      <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
        {/* Header: Time, Location, Channel */}
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className={`px-1 py-0.5 rounded ${isStarted ? 'bg-red-500/20 text-red-400 font-bold' : 'bg-zinc-800'}`}>
              {isStarted ? 'LIVE' : formatGameTime(game.scheduled_at)}
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

        {/* Team 1 */}
        {renderTeamRow(game.team1, d1Team1, logo1, team1IsFavorite)}

        {/* Team 2 */}
        {renderTeamRow(game.team2, d1Team2, logo2, !team1IsFavorite)}
      </div>
    )
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-orange-400">Current Pick&apos;em Games</h3>
          {pickemPayout > 0 && (
            <div className="flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
              </svg>
              <span className="text-sm font-bold text-green-400">${pickemPayout}</span>
            </div>
          )}
        </div>
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
        <div className="px-4 pb-4 space-y-2">
          {games.map(game => renderGame(game))}
        </div>
      )}
    </div>
  )
}
