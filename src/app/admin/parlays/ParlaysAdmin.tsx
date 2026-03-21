'use client'

import { useState } from 'react'
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
  over_under_total: number | null
  round: number
  location?: string | null
  channel?: string | null
  team1: Team | null
  team2: Team | null
}

interface Parlay {
  id: string
  user_id: string
  bet_amount: number
  status: string
  has_paid: boolean
  is_paid: boolean
  paid_at: string | null
  created_at: string
}

interface ParlayPick {
  id: string
  parlay_id: string
  game_id: string
  picked_team_id: string | null
  is_correct: boolean | null
  pick_type: string
  picked_over_under: string | null
}

interface User {
  id: string
  display_name: string | null
}

interface Props {
  tournamentId: string
  parlays: Parlay[]
  parlayPicks: ParlayPick[]
  games: Game[]
  users: User[]
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

export function ParlaysAdmin({ tournamentId, parlays, parlayPicks, games, users }: Props) {
  const [localParlays, setLocalParlays] = useState(parlays)
  const [activeFilter, setActiveFilter] = useState<'all' | 'open' | 'won' | 'lost'>('all')
  const [saving, setSaving] = useState<string | null>(null)
  const [expandedParlays, setExpandedParlays] = useState<Record<string, boolean>>({})
  const [resolving, setResolving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // Detect unresolved picks on completed games
  const unresolvedPicks = parlayPicks.filter(pick => {
    if (pick.is_correct !== null) return false
    const game = games.find(g => g.id === pick.game_id)
    return game?.winner_id !== null
  })

  const handleResolveAll = async () => {
    setResolving(true)
    try {
      const affectedParlayIds = new Set<string>()

      for (const pick of unresolvedPicks) {
        const game = games.find(g => g.id === pick.game_id)
        if (!game || !game.team1 || !game.team2 || game.team1_score === null || game.team2_score === null) continue

        let isCorrect: boolean

        if (pick.pick_type === 'over_under') {
          if (game.over_under_total === null) continue
          const totalScore = game.team1_score + game.team2_score
          if (pick.picked_over_under === 'over') {
            isCorrect = totalScore >= game.over_under_total
          } else {
            isCorrect = totalScore <= game.over_under_total
          }
        } else {
          if (game.spread === null) continue
          const margin = game.team1_score - game.team2_score
          // Spread is relative to team1: negative = team1 favored
          const adjustedMargin = margin + game.spread
          const spreadWinnerId = adjustedMargin > 0 ? game.team1.id : game.team2.id
          isCorrect = pick.picked_team_id === spreadWinnerId
        }

        await supabase
          .from('parlay_picks')
          .update({ is_correct: isCorrect })
          .eq('id', pick.id)

        affectedParlayIds.add(pick.parlay_id)
      }

      // Re-evaluate status for each affected parlay
      for (const parlayId of affectedParlayIds) {
        const { data: allPicks } = await supabase
          .from('parlay_picks')
          .select('is_correct')
          .eq('parlay_id', parlayId)

        if (!allPicks) continue

        const hasLoss = allPicks.some(p => p.is_correct === false)
        const allCorrect = allPicks.every(p => p.is_correct === true)
        const newStatus = hasLoss ? 'lost' : allCorrect ? 'won' : 'open'

        await supabase
          .from('parlays')
          .update({ status: newStatus })
          .eq('id', parlayId)
      }

      router.refresh()
    } catch (err) {
      console.error('Failed to re-resolve parlays:', err)
    } finally {
      setResolving(false)
    }
  }

  const filteredParlays = activeFilter === 'all'
    ? localParlays
    : localParlays.filter(p => p.status === activeFilter)

  // Stats
  const totalParlays = localParlays.length
  const totalWagered = localParlays.reduce((sum, p) => sum + p.bet_amount, 0)
  const totalCollected = localParlays.filter(p => p.has_paid).reduce((sum, p) => sum + p.bet_amount, 0)
  const openCount = localParlays.filter(p => p.status === 'open').length
  const wonCount = localParlays.filter(p => p.status === 'won').length
  const lostCount = localParlays.filter(p => p.status === 'lost').length
  const totalOwedToWinners = localParlays.filter(p => p.status === 'won' && !p.is_paid).reduce((sum, p) => sum + p.bet_amount * 9, 0)
  const totalPaidToWinners = localParlays.filter(p => p.status === 'won' && p.is_paid).reduce((sum, p) => sum + p.bet_amount * 9, 0)

  const handleToggleHasPaid = async (parlay: Parlay) => {
    const key = `has_paid_${parlay.id}`
    setSaving(key)
    const newValue = !parlay.has_paid

    setLocalParlays(prev =>
      prev.map(p => p.id === parlay.id ? { ...p, has_paid: newValue } : p)
    )

    try {
      await supabase
        .from('parlays')
        .update({
          has_paid: newValue,
          has_paid_at: newValue ? new Date().toISOString() : null,
        })
        .eq('id', parlay.id)

      router.refresh()
    } catch (err) {
      console.error('Failed to update entry payment:', err)
      setLocalParlays(prev =>
        prev.map(p => p.id === parlay.id ? parlay : p)
      )
    } finally {
      setSaving(null)
    }
  }

  const handleToggleIsPaid = async (parlay: Parlay) => {
    const key = `is_paid_${parlay.id}`
    setSaving(key)
    const newValue = !parlay.is_paid

    setLocalParlays(prev =>
      prev.map(p => p.id === parlay.id ? { ...p, is_paid: newValue, paid_at: newValue ? new Date().toISOString() : null } : p)
    )

    try {
      await supabase
        .from('parlays')
        .update({
          is_paid: newValue,
          paid_at: newValue ? new Date().toISOString() : null,
        })
        .eq('id', parlay.id)

      router.refresh()
    } catch (err) {
      console.error('Failed to update winner payout:', err)
      setLocalParlays(prev =>
        prev.map(p => p.id === parlay.id ? parlay : p)
      )
    } finally {
      setSaving(null)
    }
  }

  const getUserName = (userId: string) => {
    const user = users.find(u => u.id === userId)
    const name = user?.display_name || 'Unknown'
    return name.length > 9 ? name.slice(0, 9) : name
  }

  const toggleParlay = (parlayId: string) => {
    setExpandedParlays(prev => ({ ...prev, [parlayId]: !prev[parlayId] }))
  }

  const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    open: { label: 'Open', bg: 'bg-zinc-500/20', text: 'text-zinc-400', border: 'border-zinc-500/30' },
    lost: { label: 'Lost', bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
    won: { label: 'Won', bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  }

  const renderToggle = (isOn: boolean, isSaving: boolean, onToggle: () => void, label: string, colorClass: string) => (
    <label className="flex items-center gap-2 cursor-pointer">
      <span className={`text-xs ${isOn ? colorClass : 'text-zinc-500'}`}>
        {label}
      </span>
      <button
        onClick={onToggle}
        disabled={isSaving}
        className={`relative w-10 h-6 rounded-full transition-colors ${
          isOn ? (colorClass === 'text-green-400' ? 'bg-green-600' : 'bg-yellow-600') : 'bg-zinc-700'
        } ${isSaving ? 'opacity-50' : ''}`}
      >
        <div
          className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
            isOn ? 'translate-x-4' : ''
          }`}
        />
      </button>
    </label>
  )

  const renderPickGameCard = (pick: ParlayPick) => {
    const game = games.find(g => g.id === pick.game_id)
    if (!game || !game.team1 || !game.team2) return null

    // Spread is relative to team1: negative = team1 favored
    const team1IsFavorite = game.spread ? game.spread < 0 : game.team1.seed < game.team2.seed
    const favoriteTeam = team1IsFavorite ? game.team1 : game.team2
    const underdogTeam = team1IsFavorite ? game.team2 : game.team1

    const d1Favorite = findD1Team(favoriteTeam.name)
    const d1Underdog = findD1Team(underdogTeam.name)
    const logoFavorite = d1Favorite ? getTeamLogoUrl(d1Favorite) : null
    const logoUnderdog = d1Underdog ? getTeamLogoUrl(d1Underdog) : null

    const channelNum = getChannelNumber(game.channel || null)
    const isComplete = game.winner_id !== null
    const isOverUnderPick = pick.pick_type === 'over_under'

    const renderTeamRow = (team: Team, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null, isFavorite: boolean) => {
      const isPicked = !isOverUnderPick && pick.picked_team_id === team.id
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
      <div key={pick.id} className="bg-zinc-900/50 rounded-xl p-3 space-y-2">
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className="px-1 py-0.5 rounded bg-zinc-800">
              {formatGameTime(game.scheduled_at)}
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
        {isOverUnderPick && (
          <div className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${
            isComplete
              ? (pick.is_correct === true ? 'ring-2 ring-green-500' : pick.is_correct === false ? 'ring-2 ring-red-500' : 'ring-2 ring-orange-500')
              : 'ring-2 ring-orange-500'
          } ${pick.picked_over_under === 'over' ? 'bg-green-500/20' : 'bg-blue-500/20'}`}>
            <span className={`text-xs font-bold ${pick.picked_over_under === 'over' ? 'text-green-400' : 'text-blue-400'}`}>
              {pick.picked_over_under === 'over' ? 'OVER' : 'UNDER'} {game.over_under_total}
            </span>
            {isComplete && game.team1_score !== null && game.team2_score !== null && (
              <span className="text-xs text-zinc-400 ml-auto">
                Total: {game.team1_score + game.team2_score}
              </span>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary Stats */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <span className="text-zinc-500">Total Parlays</span>
            <div className="text-white font-medium">{totalParlays}</div>
          </div>
          <div>
            <span className="text-zinc-500">Total Wagered</span>
            <div className="text-white font-medium">${totalWagered}</div>
          </div>
          <div>
            <span className="text-zinc-500">Collected</span>
            <div className="text-green-400 font-medium">${totalCollected} <span className="text-zinc-600 text-xs">/ ${totalWagered}</span></div>
          </div>
          <div>
            <span className="text-zinc-500">Status</span>
            <div className="flex gap-2 text-xs mt-0.5">
              <span className="text-green-400">{openCount} open</span>
              <span className="text-yellow-400">{wonCount} won</span>
              <span className="text-red-400">{lostCount} lost</span>
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Owed to Winners</span>
            <div className={`font-medium ${totalOwedToWinners > 0 ? 'text-yellow-400' : 'text-zinc-400'}`}>
              ${totalOwedToWinners}
            </div>
          </div>
          <div>
            <span className="text-zinc-500">Paid to Winners</span>
            <div className={`font-medium ${totalPaidToWinners > 0 ? 'text-green-400' : 'text-zinc-400'}`}>
              ${totalPaidToWinners}
            </div>
          </div>
        </div>
      </div>

      {/* Unresolved Picks Warning */}
      {unresolvedPicks.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-4 flex items-center justify-between gap-3">
          <div>
            <div className="text-yellow-400 text-sm font-medium">
              {unresolvedPicks.length} unresolved pick{unresolvedPicks.length !== 1 ? 's' : ''} on completed games
            </div>
            <div className="text-yellow-400/60 text-xs mt-0.5">
              These picks were not resolved when results were entered.
            </div>
          </div>
          <button
            onClick={handleResolveAll}
            disabled={resolving}
            className="px-4 py-2 bg-yellow-600 text-white text-sm font-medium rounded-lg hover:bg-yellow-500 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {resolving ? 'Resolving...' : 'Re-resolve'}
          </button>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {(['all', 'open', 'won', 'lost'] as const).map(filter => (
          <button
            key={filter}
            onClick={() => setActiveFilter(filter)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg capitalize transition-colors ${
              activeFilter === filter
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {filter}
            <span className="ml-1 text-xs opacity-60">
              ({filter === 'all' ? totalParlays : localParlays.filter(p => p.status === filter).length})
            </span>
          </button>
        ))}
      </div>

      {/* Parlay Cards */}
      {filteredParlays.length === 0 ? (
        <div className="bg-zinc-800/50 rounded-xl p-8 text-center text-zinc-500">
          {totalParlays === 0 ? 'No parlays created yet.' : `No ${activeFilter} parlays.`}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredParlays.map(parlay => {
            const picks = parlayPicks
              .filter(p => p.parlay_id === parlay.id)
              .sort((a, b) => {
                const gameA = games.find(g => g.id === a.game_id)
                const gameB = games.find(g => g.id === b.game_id)
                const timeA = gameA?.scheduled_at ? new Date(gameA.scheduled_at).getTime() : 0
                const timeB = gameB?.scheduled_at ? new Date(gameB.scheduled_at).getTime() : 0
                return timeA - timeB
              })
            const config = statusConfig[parlay.status] || statusConfig.open
            const payout = parlay.bet_amount * 9
            const isExpanded = expandedParlays[parlay.id] ?? false

            return (
              <div key={parlay.id} className={`bg-zinc-800/50 rounded-xl border ${config.border} overflow-hidden`}>
                {/* Collapsible Header */}
                <div className="p-4 flex items-center gap-3">
                  {/* Clickable area to expand/collapse */}
                  <div
                    onClick={() => toggleParlay(parlay.id)}
                    className="flex-1 flex items-center justify-between cursor-pointer min-w-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-sm font-medium text-orange-400 truncate">
                        {getUserName(parlay.user_id)}
                      </span>
                      {parlay.status !== 'open' && (
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold flex-shrink-0 ${config.bg} ${config.text}`}>
                          {config.label}
                        </span>
                      )}
                      <span className="flex items-center gap-1 flex-shrink-0">
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
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className="text-right">
                        <span className="text-sm text-zinc-300">${parlay.bet_amount}</span>
                        <span className="text-zinc-500"> &rarr; </span>
                        <span className={parlay.status === 'won' ? 'text-yellow-400 font-bold text-sm' : 'text-zinc-400 text-sm'}>${payout}</span>
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
                  </div>

                  {/* Payment toggle - always visible */}
                  <div onClick={(e) => e.stopPropagation()} className="flex-shrink-0">
                    <button
                      onClick={() => handleToggleHasPaid(parlay)}
                      disabled={saving === `has_paid_${parlay.id}`}
                      className={`relative w-10 h-6 rounded-full transition-colors ${
                        parlay.has_paid ? 'bg-green-600' : 'bg-zinc-700'
                      } ${saving === `has_paid_${parlay.id}` ? 'opacity-50' : ''}`}
                      title={parlay.has_paid ? 'Paid' : 'Not paid'}
                    >
                      <div
                        className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                          parlay.has_paid ? 'translate-x-4' : ''
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-3">
                    {/* Full game cards for each pick */}
                    <div className="space-y-2">
                      {picks.map(pick => renderPickGameCard(pick))}
                    </div>

                    {/* Footer: winner payout toggle (only for won parlays) */}
                    {parlay.status === 'won' && (
                      <div className="flex items-center justify-end gap-4 pt-1 border-t border-zinc-700/50">
                        {renderToggle(
                          parlay.is_paid,
                          saving === `is_paid_${parlay.id}`,
                          () => handleToggleIsPaid(parlay),
                          `Paid ${getUserName(parlay.user_id)}`,
                          'text-yellow-400'
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-zinc-600 text-right">
                      {new Date(parlay.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
