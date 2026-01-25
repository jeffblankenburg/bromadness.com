'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  display_name: string | null
  phone: string
}

interface BrocketEntry {
  id: string
  user_id: string
  tournament_id: string
  has_paid: boolean
}

interface Game {
  id: string
  scheduled_at: string | null
  winner_id: string | null
  region_id: string | null
}

interface BrocketPick {
  id: string
  entry_id: string
  game_id: string | null
}

interface Props {
  tournamentId: string
  users: User[]
  brocketEntries: BrocketEntry[]
  games: Game[]
  brocketPicks: BrocketPick[]
  entryFee: number
}

export function BrocketPaymentTracker({ tournamentId, users, brocketEntries, games, brocketPicks, entryFee }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const [optimisticPaid, setOptimisticPaid] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === 'undefined') return true
    const saved = localStorage.getItem('brocket-users-expanded')
    return saved !== null ? saved === 'true' : true
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    localStorage.setItem('brocket-users-expanded', String(expanded))
  }, [expanded])

  const totalGames = games.length

  // Get user's pick count
  const getUserPickCount = (userId: string): number => {
    const entry = brocketEntries.find(e => e.user_id === userId)
    if (!entry) return 0
    return brocketPicks.filter(p => p.entry_id === entry.id).length
  }

  const isUserPaid = (userId: string): boolean => {
    if (userId in optimisticPaid) {
      return optimisticPaid[userId]
    }
    const entry = brocketEntries.find(e => e.user_id === userId)
    return entry?.has_paid ?? false
  }

  const togglePayment = async (userId: string) => {
    const currentlyPaid = isUserPaid(userId)
    const newPaidStatus = !currentlyPaid

    // Optimistic update
    setOptimisticPaid(prev => ({ ...prev, [userId]: newPaidStatus }))
    setSaving(userId)

    try {
      const existingEntry = brocketEntries.find(e => e.user_id === userId)

      if (existingEntry) {
        const { error } = await supabase
          .from('brocket_entries')
          .update({
            has_paid: newPaidStatus,
            paid_at: newPaidStatus ? new Date().toISOString() : null,
          })
          .eq('id', existingEntry.id)

        if (error) throw error
      } else {
        const { error } = await supabase
          .from('brocket_entries')
          .insert({
            user_id: userId,
            tournament_id: tournamentId,
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
        delete next[userId]
        return next
      })
      alert('Failed to update payment status')
    }

    setSaving(null)
  }

  // Check if all users are paid
  const areAllPaid = (): boolean => {
    return users.every(user => isUserPaid(user.id))
  }

  // Toggle all users paid/unpaid
  const toggleAll = async () => {
    const allPaid = areAllPaid()
    const newPaidStatus = !allPaid

    // Optimistic updates for all users
    const updates: Record<string, boolean> = {}
    users.forEach(user => {
      updates[user.id] = newPaidStatus
    })
    setOptimisticPaid(prev => ({ ...prev, ...updates }))

    try {
      for (const user of users) {
        const existingEntry = brocketEntries.find(e => e.user_id === user.id)

        if (existingEntry) {
          await supabase
            .from('brocket_entries')
            .update({
              has_paid: newPaidStatus,
              paid_at: newPaidStatus ? new Date().toISOString() : null,
            })
            .eq('id', existingEntry.id)
        } else if (newPaidStatus) {
          await supabase
            .from('brocket_entries')
            .insert({
              user_id: user.id,
              tournament_id: tournamentId,
              has_paid: true,
              paid_at: new Date().toISOString(),
            })
        }
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to toggle all payments:', error)
      setOptimisticPaid(prev => {
        const next = { ...prev }
        Object.keys(updates).forEach(key => delete next[key])
        return next
      })
    }
  }

  // Calculate totals
  const totalPaid = users.filter(user => isUserPaid(user.id)).length
  const totalCollected = totalPaid * entryFee

  return (
    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Brocket Entries</h3>
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-400">
            {totalPaid}/{users.length} paid · ${totalCollected}
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
            <div className="w-16 text-center">Picks</div>
            <div className="w-14 flex items-center justify-end gap-1">
              <span>Paid</span>
              <button
                onClick={toggleAll}
                className={`w-5 h-5 flex-shrink-0 rounded border flex items-center justify-center text-xs ${
                  areAllPaid()
                    ? 'bg-green-500/20 border-green-500 text-green-400'
                    : 'border-zinc-600 text-zinc-600 hover:border-zinc-400'
                }`}
                title={areAllPaid() ? 'All paid - click to mark all unpaid' : 'Click to mark all paid'}
              >
                {areAllPaid() ? '✓' : ''}
              </button>
            </div>
          </div>

          {/* User rows */}
          <div className="space-y-2">
            {users.map(user => {
              const isPaid = isUserPaid(user.id)
              const pickCount = getUserPickCount(user.id)
              const isComplete = pickCount === totalGames && totalGames > 0
              const isSaving = saving === user.id

              // Color logic: gray if not paid, red if paid but incomplete, green if complete
              const pickColor = !isPaid
                ? 'text-zinc-600'
                : isComplete
                  ? 'text-green-400'
                  : 'text-red-400'

              return (
                <div key={user.id} className="flex items-center gap-2 text-sm">
                  <div className="flex-1 truncate">
                    {user.display_name || user.phone}
                  </div>
                  <div className={`w-16 text-center text-xs ${pickColor}`}>
                    {pickCount > 0 ? `${pickCount}/${totalGames}` : isPaid ? `0/${totalGames}` : '-'}
                  </div>
                  <div className="w-14 flex items-center justify-end">
                    <button
                      onClick={() => togglePayment(user.id)}
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
                </div>
              )
            })}
          </div>

          {/* Footer */}
          <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-between text-xs">
            <span className="text-zinc-500">${entryFee} entry fee</span>
            <span className="text-green-400 font-medium">
              Total collected: ${totalCollected}
            </span>
          </div>
        </div>
      )}
    </div>
  )
}
