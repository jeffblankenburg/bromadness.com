'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PickemDay {
  id: string
  contest_date: string
}

interface User {
  id: string
  display_name: string | null
  phone: string
}

interface PickemEntry {
  id: string
  user_id: string
  pickem_day_id: string
  has_paid: boolean
}

interface Game {
  id: string
  scheduled_at: string | null
  winner_id: string | null
}

interface PickemPick {
  id: string
  entry_id: string
  game_id: string | null
}

interface Props {
  pickemDays: PickemDay[]
  users: User[]
  pickemEntries: PickemEntry[]
  games: Game[]
  pickemPicks: PickemPick[]
  entryFee: number
  enabledDays: string[]  // Day names like "Thursday", "Friday", etc.
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export function PaymentTracker({ pickemDays, users, pickemEntries, games, pickemPicks, entryFee, enabledDays }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [optimisticPaid, setOptimisticPaid] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('pickem-users-expanded')
    return saved !== null ? saved === 'true' : true
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    localStorage.setItem('pickem-users-expanded', String(expanded))
  }, [expanded])

  // Group games by date
  const gamesByDate = games.reduce((acc, game) => {
    if (!game.scheduled_at) return acc
    const date = game.scheduled_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, Game[]>)

  // Get games for a specific pickem_day
  const getGamesForDay = (contestDate: string): Game[] => {
    return gamesByDate[contestDate] || []
  }

  // Check if user has made all picks for a day
  const getUserPickStatus = (userId: string, pickemDayId: string, contestDate: string): { made: number; total: number } => {
    const entry = pickemEntries.find(e => e.user_id === userId && e.pickem_day_id === pickemDayId)
    const dayGames = getGamesForDay(contestDate)
    const total = dayGames.length

    if (!entry) return { made: 0, total }

    const dayGameIds = dayGames.map(g => g.id)
    const made = pickemPicks.filter(p =>
      p.entry_id === entry.id && p.game_id && dayGameIds.includes(p.game_id)
    ).length

    return { made, total }
  }

  const togglePayment = async (userId: string, pickemDayId: string) => {
    const key = `${userId}-${pickemDayId}`
    const currentlyPaid = isUserPaid(userId, pickemDayId)
    const newPaidStatus = !currentlyPaid

    // Optimistic update
    setOptimisticPaid(prev => ({ ...prev, [key]: newPaidStatus }))
    setSaving(key)

    try {
      const existingEntry = pickemEntries.find(
        e => e.user_id === userId && e.pickem_day_id === pickemDayId
      )

      if (existingEntry) {
        const { error } = await supabase
          .from('pickem_entries')
          .update({
            has_paid: newPaidStatus,
            paid_at: newPaidStatus ? new Date().toISOString() : null,
          })
          .eq('id', existingEntry.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('pickem_entries')
          .insert({
            user_id: userId,
            pickem_day_id: pickemDayId,
            has_paid: true,
            paid_at: new Date().toISOString(),
          })

        if (error) throw error
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to toggle payment:', error)
      setOptimisticPaid(prev => {
        const next = { ...prev }
        delete next[key]
        return next
      })
      alert('Failed to update payment status')
    }

    setSaving(null)
  }

  const isUserPaid = (userId: string, pickemDayId: string): boolean => {
    const key = `${userId}-${pickemDayId}`
    if (key in optimisticPaid) {
      return optimisticPaid[key]
    }
    const entry = pickemEntries.find(
      e => e.user_id === userId && e.pickem_day_id === pickemDayId
    )
    return entry?.has_paid ?? false
  }

  // Check if all users are paid for a specific day
  const areAllPaidForDay = (pickemDayId: string): boolean => {
    return users.every(user => isUserPaid(user.id, pickemDayId))
  }

  // Toggle all users paid/unpaid for a specific day
  const toggleAllForDay = async (pickemDayId: string) => {
    const allPaid = areAllPaidForDay(pickemDayId)
    const newPaidStatus = !allPaid

    // Optimistic updates for all users
    const updates: Record<string, boolean> = {}
    users.forEach(user => {
      const key = `${user.id}-${pickemDayId}`
      updates[key] = newPaidStatus
    })
    setOptimisticPaid(prev => ({ ...prev, ...updates }))

    try {
      for (const user of users) {
        const existingEntry = pickemEntries.find(
          e => e.user_id === user.id && e.pickem_day_id === pickemDayId
        )

        if (existingEntry) {
          await supabase
            .from('pickem_entries')
            .update({
              has_paid: newPaidStatus,
              paid_at: newPaidStatus ? new Date().toISOString() : null,
            })
            .eq('id', existingEntry.id)
        } else if (newPaidStatus) {
          // Only create entry if marking as paid
          await supabase
            .from('pickem_entries')
            .insert({
              user_id: user.id,
              pickem_day_id: pickemDayId,
              has_paid: true,
              paid_at: new Date().toISOString(),
            })
        }
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to toggle all payments:', error)
      // Revert optimistic updates
      setOptimisticPaid(prev => {
        const next = { ...prev }
        Object.keys(updates).forEach(key => delete next[key])
        return next
      })
    }
  }

  // Calculate totals
  const totalPaid = pickemDays.reduce((sum, day) => {
    return sum + users.filter(user => isUserPaid(user.id, day.id)).length
  }, 0)
  const totalCollected = totalPaid * entryFee

  if (enabledDays.length === 0) {
    return (
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <p className="text-zinc-400 text-sm">No pick&apos;em days enabled. Enable days in settings.</p>
      </div>
    )
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Users</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {totalPaid} paid · ${totalCollected}
          </span>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={2}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          {/* Header row */}
          <div className="flex items-center gap-2 mb-2 text-xs text-zinc-500">
            <div className="flex-1">Name</div>
            {enabledDays.map(dayName => {
              const pickemDay = pickemDays.find(d => getDayName(d.contest_date) === dayName)
              const allPaid = pickemDay ? areAllPaidForDay(pickemDay.id) : false
              const hasGames = pickemDay !== undefined
              return (
                <div key={dayName} className="w-14 flex items-center justify-end gap-1">
                  <span>{dayName.slice(0, 3)}</span>
                  {hasGames ? (
                    <button
                      onClick={() => toggleAllForDay(pickemDay!.id)}
                      className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center text-xs ${
                        allPaid
                          ? 'bg-green-500/20 border-green-500 text-green-400'
                          : 'border-zinc-600 text-zinc-600 hover:border-zinc-400'
                      }`}
                      title={allPaid ? 'All paid - click to mark all unpaid' : 'Click to mark all paid'}
                    >
                      {allPaid ? '✓' : ''}
                    </button>
                  ) : (
                    <span className="w-5 h-5 flex-shrink-0 text-center text-zinc-700 text-xs leading-5">—</span>
                  )}
                </div>
              )
            })}
          </div>

          {/* User rows */}
          <div className="space-y-2">
            {users.map(user => (
              <div key={user.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 truncate">
                  {user.display_name || user.phone}
                </div>
                {enabledDays.map(dayName => {
                  const pickemDay = pickemDays.find(d => getDayName(d.contest_date) === dayName)

                  if (!pickemDay) {
                    // Day is enabled but no games scheduled yet
                    return (
                      <div key={dayName} className="w-14 flex items-center justify-end gap-1">
                        <span className="text-zinc-700 text-xs">-</span>
                        <span className="w-5 h-5 flex-shrink-0 rounded border border-zinc-700 flex items-center justify-center text-xs text-zinc-700">—</span>
                      </div>
                    )
                  }

                  const isPaid = isUserPaid(user.id, pickemDay.id)
                  const pickStatus = getUserPickStatus(user.id, pickemDay.id, pickemDay.contest_date)
                  const hasPicks = pickStatus.made === pickStatus.total && pickStatus.total > 0
                  const isSaving = saving === `${user.id}-${pickemDay.id}`

                  // Color logic: gray if not paid, red if paid but incomplete, green if complete
                  const pickColor = !isPaid
                    ? 'text-zinc-600'
                    : hasPicks
                      ? 'text-green-400'
                      : 'text-red-400'

                  return (
                    <div key={dayName} className="w-14 flex items-center justify-end gap-1">
                      <span className={`text-xs ${pickColor}`}>
                        {pickStatus.made > 0 ? pickStatus.made : isPaid ? '0' : '-'}
                      </span>

                      <button
                        onClick={() => togglePayment(user.id, pickemDay.id)}
                        disabled={isSaving}
                        className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center text-xs ${
                          isPaid
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'border-zinc-600 text-zinc-600 hover:border-zinc-400'
                        }`}
                        title={isPaid ? 'Paid - click to mark unpaid' : 'Not paid - click to mark paid'}
                      >
                        {isSaving ? '...' : isPaid ? '✓' : ''}
                      </button>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-between text-xs">
            <span className="text-zinc-500">${entryFee} per day</span>
            <span className="text-green-400 font-medium">
              Total collected: ${totalCollected}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
