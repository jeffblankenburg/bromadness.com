'use client'

import { useState, useEffect } from 'react'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'
import { getEasternNow } from '@/lib/timezone'
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
  userBrocketTeamIds: string[]
  userParlayTeamIds: string[]
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

export function CurrentGames({ games, userAuctionTeamIds, userPickemTeamIds, userBrocketTeamIds, userParlayTeamIds, simulatedTime }: Props) {
  const [expanded, setExpanded] = useState(true)

  // Get current time as a Date object (in Eastern time context)
  const getCurrentTime = (): Date => {
    if (simulatedTime) {
      return parseTimestamp(simulatedTime)
    }
    // Get current Eastern time
    return getEasternNow()
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
      const isBrocketTeam = userBrocketTeamIds.includes(team.id)
      const isParlayTeam = userParlayTeamIds.includes(team.id)

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
          {/* Brocket pick icon (rocket) */}
          {isBrocketTeam && (
            <span className="text-zinc-400 flex-shrink-0" title="Your brocket pick">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
              </svg>
            </span>
          )}
          {/* Parlay pick icon (banknote) */}
          {isParlayTeam && (
            <span className="text-zinc-400 flex-shrink-0" title="Your parlay pick">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
              </svg>
            </span>
          )}
          {/* Pickem pick icon (checkmark) */}
          {isPickemTeam && (
            <span className="text-zinc-400 flex-shrink-0" title="Your pickem pick">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            </span>
          )}
          {/* Auction ownership icon (gavel) */}
          {isAuctionTeam && (
            <span className="flex-shrink-0" title="Your auction team">
              <img src="/auction.svg" alt="Auction" className="w-5 h-5 brightness-0 invert opacity-60" />
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
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Current Games</h3>
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
