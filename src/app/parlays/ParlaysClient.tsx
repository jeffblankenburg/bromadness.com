'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  spread: number | null
  favorite_team_id: string | null
  round: number
  location?: string | null
  channel?: string | null
  team1: Team | null
  team2: Team | null
}

interface Parlay {
  id: string
  bet_amount: number
  status: string
  has_paid: boolean
  is_paid: boolean
  created_at: string
}

interface ParlayPick {
  id: string
  parlay_id: string
  game_id: string
  picked_team_id: string
  is_correct: boolean | null
}

interface Props {
  userId: string
  tournamentId: string
  games: Game[]
  userParlays: Parlay[]
  parlayPicks: ParlayPick[]
  simulatedTime: string | null
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
  const [, , month, day, hours, mins] = match
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'p' : 'a'
  const date = new Date(parseInt(match[1]), parseInt(month) - 1, parseInt(day))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return `${days[date.getDay()]} ${hour12}:${mins}${ampm}`
}

const getChannelNumber = (channelName: string | null) => {
  if (!channelName) return null
  const channel = CHANNELS.find(c => c.name.toLowerCase() === channelName.toLowerCase())
  return channel ? channel.number : null
}

export function ParlaysClient({
  userId,
  tournamentId,
  games,
  userParlays,
  parlayPicks,
  simulatedTime,
}: Props) {
  const parseTimestamp = (timeStr: string): Date => {
    const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):?(\d{2})?/)
    if (!match) return new Date(0)
    const [, year, month, day, hours, mins, secs] = match
    return new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hours), parseInt(mins), parseInt(secs || '0'))
  }

  const getCurrentTime = (): Date => {
    if (simulatedTime) {
      return parseTimestamp(simulatedTime)
    }
    return getEasternNow()
  }

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list')
  const [selectedPicks, setSelectedPicks] = useState<Record<string, string>>({})
  const [betAmount, setBetAmount] = useState(1)
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null)
  const [expandedParlays, setExpandedParlays] = useState<Record<string, boolean>>({})
  const router = useRouter()

  const selectedCount = Object.keys(selectedPicks).length

  // Filter games available for new parlays (not yet started, have both teams)
  const availableGames = games.filter(g => {
    if (!g.team1 || !g.team2 || !g.scheduled_at) return false
    return parseTimestamp(g.scheduled_at) > getCurrentTime()
  })

  const isGameLocked = (game: Game): boolean => {
    return game.scheduled_at ? parseTimestamp(game.scheduled_at) <= getCurrentTime() : false
  }

  const handlePickTeam = (gameId: string, teamId: string) => {
    setSelectedPicks(prev => {
      const next = { ...prev }
      if (next[gameId] === teamId) {
        // Deselect
        delete next[gameId]
      } else if (Object.keys(next).length >= 4 && !next[gameId]) {
        // Already have 4 picks and trying to add a new game
        return prev
      } else {
        next[gameId] = teamId
      }
      return next
    })
  }

  const handleSubmit = async () => {
    setSaving(true)
    try {
      const picks = Object.entries(selectedPicks).map(([gameId, teamId]) => ({
        gameId,
        teamId,
      }))

      const res = await fetch('/api/parlays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          tournamentId,
          betAmount,
          picks,
        }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to create parlay')
      }

      setSelectedPicks({})
      setBetAmount(1)
      setShowConfirm(false)
      setActiveTab('list')
      router.refresh()
    } catch (error) {
      console.error('Failed to create parlay:', error)
      alert(error instanceof Error ? error.message : 'Failed to create parlay')
    }
    setSaving(false)
  }

  const handleDelete = async (parlayId: string) => {
    setDeleting(parlayId)
    try {
      const res = await fetch('/api/parlays', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parlayId }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete parlay')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to delete parlay:', error)
      alert(error instanceof Error ? error.message : 'Failed to delete parlay')
    }
    setDeleting(null)
  }

  const getTeamDisplay = (game: Game, teamId: string) => {
    const team = game.team1?.id === teamId ? game.team1 : game.team2
    if (!team) return { name: 'Unknown', seed: 0, spreadDisplay: '' }
    const d1Team = findD1Team(team.name)
    const displayName = d1Team?.shortName || team.short_name || team.name

    const lowerSeedTeam = game.team1 && game.team2
      ? (game.team1.seed < game.team2.seed ? game.team1 : game.team2)
      : null
    const isLowerSeed = lowerSeedTeam?.id === team.id
    const spreadValue = game.spread ? Math.abs(game.spread) : null
    const spreadDisplay = spreadValue ? (isLowerSeed && game.spread! < 0 ? `-${spreadValue}` : `+${spreadValue}`) : ''

    return { name: displayName, seed: team.seed, spreadDisplay, d1Team }
  }

  const toggleParlay = (parlayId: string) => {
    setExpandedParlays(prev => ({ ...prev, [parlayId]: !prev[parlayId] }))
  }

  const renderParlayPickGame = (pick: ParlayPick) => {
    const game = games.find(g => g.id === pick.game_id)
    if (!game || !game.team1 || !game.team2) return null

    const lowerSeedTeam = game.team1.seed < game.team2.seed ? game.team1 : game.team2
    const higherSeedTeam = game.team1.seed < game.team2.seed ? game.team2 : game.team1
    const lowerSeedIsFavorite = game.spread ? game.spread < 0 : true
    const favoriteTeam = lowerSeedIsFavorite ? lowerSeedTeam : higherSeedTeam
    const underdogTeam = lowerSeedIsFavorite ? higherSeedTeam : lowerSeedTeam

    const d1Favorite = findD1Team(favoriteTeam.name)
    const d1Underdog = findD1Team(underdogTeam.name)
    const logoFavorite = d1Favorite ? getTeamLogoUrl(d1Favorite) : null
    const logoUnderdog = d1Underdog ? getTeamLogoUrl(d1Underdog) : null

    const channelNum = getChannelNumber(game.channel || null)
    const isComplete = game.winner_id !== null
    const isStarted = game.scheduled_at && parseTimestamp(game.scheduled_at) <= getCurrentTime()

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null, isFavorite: boolean) => {
      const isPicked = pick.picked_team_id === team.id
      const spreadValue = game.spread ? Math.abs(game.spread) : null
      const spreadDisplay = spreadValue ? (isFavorite ? `-${spreadValue}` : `+${spreadValue}`) : null
      const isWinner = isComplete && game.winner_id === team.id

      let ringClass = ''
      if (isPicked) {
        ringClass = isComplete
          ? (pick.is_correct === true ? 'ring-2 ring-green-500' : pick.is_correct === false ? 'ring-2 ring-red-500' : 'ring-2 ring-orange-500')
          : 'ring-2 ring-orange-500'
      }

      return (
        <div
          key={team.id}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg ${ringClass}`}
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
            <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          )}
        </div>
      )
    }

    return (
      <div key={pick.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
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
            <span className="px-1 py-0.5 bg-zinc-800 rounded">
              {game.channel}{channelNum ? ` (${channelNum})` : ''}
            </span>
          )}
          {/* Correctness indicator in header */}
          {pick.is_correct === true && (
            <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
            </svg>
          )}
          {pick.is_correct === false && (
            <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          )}
          {pick.is_correct === null && (
            <svg className="w-4 h-4 text-zinc-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
            </svg>
          )}
        </div>
        {renderTeamRow(favoriteTeam, d1Favorite, logoFavorite, true)}
        {renderTeamRow(underdogTeam, d1Underdog, logoUnderdog, false)}
      </div>
    )
  }

  const renderParlayCard = (parlay: Parlay) => {
    const picks = parlayPicks.filter(p => p.parlay_id === parlay.id)
    const payout = parlay.bet_amount * 9
    const isExpanded = expandedParlays[parlay.id] ?? false

    const statusConfig = {
      open: { label: 'Open', bg: 'bg-green-500/20', text: 'text-green-400', border: 'border-green-500/30' },
      lost: { label: 'Lost', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
      won: { label: 'Won', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
    }[parlay.status] || { label: parlay.status, bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/30' }

    return (
      <div key={parlay.id} className={`bg-zinc-800/50 rounded-xl border ${statusConfig.border} overflow-hidden`}>
        {/* Collapsible Header */}
        <button
          onClick={() => toggleParlay(parlay.id)}
          className="w-full p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${statusConfig.bg} ${statusConfig.text}`}>
              {statusConfig.label}
            </span>
            {parlay.status === 'won' && parlay.is_paid && (
              <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-green-500/20 text-green-400">
                PAID
              </span>
            )}
            <span className="flex items-center gap-1">
              {picks.map(pick => (
                pick.is_correct === true ? (
                  <svg key={pick.id} className="w-4 h-4 text-green-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : pick.is_correct === false ? (
                  <svg key={pick.id} className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg key={pick.id} className="w-4 h-4 text-zinc-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                  </svg>
                )
              ))}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-sm text-zinc-300">${parlay.bet_amount} bet</div>
              <div className={`text-xs ${parlay.status === 'won' ? 'text-yellow-400 font-bold' : 'text-zinc-500'}`}>
                {parlay.status === 'won' ? `Won $${payout}` : `Wins $${payout}`}
              </div>
            </div>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </div>
        </button>

        {/* Expanded Content */}
        {isExpanded && (
          <div className="px-4 pb-4 space-y-3">
            {/* Full game cards for each pick */}
            <div className="space-y-2">
              {picks.map(pick => renderParlayPickGame(pick))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between pt-1">
              <div className="text-[10px] text-zinc-600">
                {new Date(parlay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
              </div>
              {!parlay.has_paid && (
                <button
                  onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(parlay.id) }}
                  className="px-3 py-1 rounded-lg text-xs text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    )
  }

  const renderGameCard = (game: Game) => {
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

    const gameLocked = isGameLocked(game)
    const channelNum = getChannelNumber(game.channel || null)

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null, isFavorite: boolean) => {
      const isPicked = selectedPicks[game.id] === team.id
      const spreadValue = game.spread ? Math.abs(game.spread) : null
      const spreadDisplay = spreadValue ? (isFavorite ? `-${spreadValue}` : `+${spreadValue}`) : null
      const canPick = !gameLocked && (selectedCount < 4 || selectedPicks[game.id] !== undefined)

      let ringClass = ''
      if (isPicked) {
        ringClass = 'ring-2 ring-orange-500'
      }

      return (
        <button
          key={team.id}
          onClick={() => handlePickTeam(game.id, team.id)}
          disabled={gameLocked || !canPick}
          className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg transition-all ${ringClass} ${
            gameLocked || !canPick ? 'cursor-default opacity-60' : 'hover:opacity-80 active:scale-[0.99]'
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
          {isPicked && (
            <svg className="w-5 h-5 text-orange-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
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
            <span className={`px-1 py-0.5 rounded flex items-center gap-1 ${gameLocked ? 'bg-red-500/20 text-red-400 font-bold' : 'bg-zinc-800'}`}>
              {gameLocked ? 'LOCKED' : formatGameTime(game.scheduled_at)}
              {gameLocked && (
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

  const renderConfirmDialog = () => {
    if (!showConfirm) return null

    const payout = betAmount * 9

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/70" onClick={() => setShowConfirm(false)} />
        <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm space-y-4">
          <h3 className="text-lg font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            Confirm Parlay
          </h3>

          <div className="space-y-2">
            {Object.entries(selectedPicks).map(([gameId, teamId]) => {
              const game = games.find(g => g.id === gameId)
              if (!game) return null
              const { name, seed, spreadDisplay, d1Team } = getTeamDisplay(game, teamId)
              const logo = d1Team ? getTeamLogoUrl(d1Team) : null

              return (
                <div key={gameId} className="flex items-center gap-2 py-1.5 px-2 rounded-lg bg-zinc-800/50">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: d1Team?.primaryColor || '#3f3f46' }}
                  >
                    {logo ? (
                      <img src={logo} alt="" className="w-4 h-4 object-contain" style={{ filter: 'drop-shadow(0 0 1px white)' }} />
                    ) : (
                      <span className="text-[8px] font-bold text-white">{d1Team?.abbreviation?.slice(0, 2) || name.slice(0, 2)}</span>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">{seed}</span>
                  <span className="flex-1 text-sm text-white truncate">{name}</span>
                  {spreadDisplay && (
                    <span className="text-xs text-zinc-400">{spreadDisplay}</span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="bg-zinc-800/50 rounded-lg p-3 text-center">
            <div className="text-sm text-zinc-400">
              ${betAmount} bet &rarr; <span className="text-green-400 font-bold">${payout} payout</span>
            </div>
          </div>

          <p className="text-xs text-red-400 text-center">
            This cannot be changed after submission.
          </p>

          <div className="flex gap-3">
            <button
              onClick={() => setShowConfirm(false)}
              className="flex-1 px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50"
            >
              {saving ? 'Placing...' : 'Place Parlay'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 pb-20 space-y-4">
      <div>
        <h1 className="text-xl font-bold text-orange-400 uppercase tracking-wide flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
          </svg>
          Parlays
        </h1>
        <p className="text-xs text-zinc-500 mt-0.5">Pick 4 teams against the spread. All 4 must win. Payout: 8:1.</p>
      </div>

      {/* Tabs */}
      <div className="flex bg-zinc-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('list')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'list'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          My Parlays
          {userParlays.length > 0 && (
            <span className="ml-2 text-xs text-zinc-500">({userParlays.length})</span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('create')}
          className={`flex-1 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeTab === 'create'
              ? 'bg-zinc-700 text-white'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          New Parlay
        </button>
      </div>

      {/* My Parlays Tab */}
      {activeTab === 'list' && (
        <div className="space-y-3">
          {/* Venmo Payment Button */}
          {(() => {
            const unpaidTotal = userParlays
              .filter(p => !p.has_paid)
              .reduce((sum, p) => sum + p.bet_amount, 0)
            if (unpaidTotal <= 0) return null
            const venmoDeepLink = `venmo://paycharge?txn=pay&recipients=Brett-Lyme&amount=${unpaidTotal}&note=Bro%20Madness%20Parlays`
            const venmoWebLink = `https://venmo.com/Brett-Lyme?txn=pay&amount=${unpaidTotal}&note=Bro%20Madness%20Parlays`
            return (
              <a
                href={venmoDeepLink}
                onClick={(e) => {
                  // Try deep link first, fall back to web after a short delay
                  setTimeout(() => { window.location.href = venmoWebLink }, 500)
                }}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-[#008CFF] text-white font-bold uppercase tracking-wide hover:bg-[#0074D4] transition-colors"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M19.5 3c.9 1.5 1.3 3 1.3 5 0 5.5-4.7 12.7-8.5 17H5.2L3 3.5l5.5-.5 1.2 10c1.1-1.8 2.5-4.6 2.5-6.5 0-1.9-.3-3.2-.8-4.2L19.5 3Z" />
                </svg>
                Pay ${unpaidTotal} via Venmo
              </a>
            )
          })()}
          {userParlays.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-400 text-lg">No parlays yet</p>
              <p className="text-zinc-500 text-sm mt-2">Create your first parlay to get started!</p>
              <button
                onClick={() => setActiveTab('create')}
                className="mt-4 px-6 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 transition-colors"
              >
                Create Parlay
              </button>
            </div>
          ) : (
            userParlays.map(parlay => renderParlayCard(parlay))
          )}
        </div>
      )}

      {/* New Parlay Tab */}
      {activeTab === 'create' && (
        <div className="space-y-4">
          {/* Bet Amount */}
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-zinc-300">Bet Amount</div>
                <div className="text-xs text-zinc-500">Max $10</div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setBetAmount(Math.max(1, betAmount - 1))}
                  disabled={betAmount <= 1}
                  className="w-8 h-8 rounded-full bg-zinc-700 text-white flex items-center justify-center hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                >
                  -
                </button>
                <span className="text-xl font-bold text-white w-8 text-center">${betAmount}</span>
                <button
                  onClick={() => setBetAmount(Math.min(10, betAmount + 1))}
                  disabled={betAmount >= 10}
                  className="w-8 h-8 rounded-full bg-zinc-700 text-white flex items-center justify-center hover:bg-zinc-600 disabled:opacity-30 transition-colors"
                >
                  +
                </button>
              </div>
            </div>
            <div className="mt-2 text-center text-sm">
              <span className="text-zinc-500">Potential payout: </span>
              <span className="text-green-400 font-bold">${betAmount * 9}</span>
              <span className="text-zinc-600 text-xs ml-1">(${betAmount * 8} profit + ${betAmount} returned)</span>
            </div>
          </div>

          {/* Pick Counter */}
          <div className="text-center">
            <span className={`text-sm font-semibold uppercase tracking-wide ${selectedCount === 4 ? 'text-green-400' : 'text-orange-400'}`} style={{ fontFamily: 'var(--font-display)' }}>
              {selectedCount} of 4 picks selected
            </span>
          </div>

          {/* Available Games */}
          {availableGames.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-zinc-400">No games available for parlays right now.</p>
              <p className="text-zinc-500 text-sm mt-1">Games with spreads that haven&apos;t started will appear here.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableGames.map(game => renderGameCard(game))}
            </div>
          )}

          {/* Submit Button */}
          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedCount !== 4}
            className="w-full py-3 rounded-xl bg-orange-500 text-white font-bold uppercase tracking-wide hover:bg-orange-600 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {selectedCount === 4 ? 'Place Parlay' : `Select ${4 - selectedCount} more ${4 - selectedCount === 1 ? 'team' : 'teams'}`}
          </button>
        </div>
      )}

      {/* Confirmation Dialog */}
      {renderConfirmDialog()}

      {/* Delete Confirmation Dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setShowDeleteConfirm(null)} />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-bold text-red-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              Delete Parlay?
            </h3>
            <p className="text-sm text-zinc-300">
              This will permanently delete this parlay and all of its picks. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  const id = showDeleteConfirm
                  setShowDeleteConfirm(null)
                  await handleDelete(id)
                }}
                disabled={deleting !== null}
                className="flex-1 px-4 py-2.5 rounded-lg bg-red-600 text-white font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
