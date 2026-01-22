'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PickemDay {
  id: string
  contest_date: string
  is_locked: boolean
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
  paid_at: string | null
  correct_picks: number
}

interface Props {
  pickemDays: PickemDay[]
  users: User[]
  pickemEntries: PickemEntry[]
  entryFee: number
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function PaymentTracker({ pickemDays, users, pickemEntries, entryFee }: Props) {
  const [saving, setSaving] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const togglePayment = async (userId: string, pickemDayId: string) => {
    const key = `${userId}-${pickemDayId}`
    setSaving(key)

    try {
      const existingEntry = pickemEntries.find(
        e => e.user_id === userId && e.pickem_day_id === pickemDayId
      )

      if (existingEntry) {
        // Update existing entry
        const { error } = await supabase
          .from('pickem_entries')
          .update({
            has_paid: !existingEntry.has_paid,
            paid_at: !existingEntry.has_paid ? new Date().toISOString() : null,
          })
          .eq('id', existingEntry.id)

        if (error) throw error
      } else {
        // Create new entry with paid status
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
      alert('Failed to update payment status')
    }

    setSaving(null)
  }

  const isUserPaid = (userId: string, pickemDayId: string): boolean => {
    const entry = pickemEntries.find(
      e => e.user_id === userId && e.pickem_day_id === pickemDayId
    )
    return entry?.has_paid ?? false
  }

  // Calculate totals per day
  const dayTotals = pickemDays.map(day => {
    const paidCount = pickemEntries.filter(
      e => e.pickem_day_id === day.id && e.has_paid
    ).length
    return {
      day,
      paidCount,
      totalCollected: paidCount * entryFee,
    }
  })

  const grandTotalPaid = dayTotals.reduce((sum, d) => sum + d.paidCount, 0)
  const grandTotalCollected = grandTotalPaid * entryFee

  if (pickemDays.length === 0) {
    return null
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-orange-400">Payment Tracking</h3>
        <div className="text-sm text-zinc-400">
          ${entryFee} per day
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        {dayTotals.map(({ day, paidCount, totalCollected }) => (
          <div key={day.id} className="flex justify-between bg-zinc-700/50 rounded px-3 py-2">
            <span className="text-zinc-400">{formatDate(day.contest_date)}</span>
            <span>
              {paidCount}/{users.length} paid
              <span className="text-green-400 ml-2">${totalCollected}</span>
            </span>
          </div>
        ))}
      </div>

      <div className="text-right text-sm mb-4 border-t border-zinc-700 pt-2">
        <span className="text-zinc-400">Total Collected: </span>
        <span className="text-green-400 font-semibold">${grandTotalCollected}</span>
      </div>

      {/* User Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-700">
              <th className="text-left py-2 text-zinc-400 font-medium">User</th>
              {pickemDays.map(day => (
                <th key={day.id} className="text-center py-2 text-zinc-400 font-medium px-2">
                  {formatDate(day.contest_date)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map(user => (
              <tr key={user.id} className="border-b border-zinc-800">
                <td className="py-2">{user.display_name || user.phone}</td>
                {pickemDays.map(day => {
                  const isPaid = isUserPaid(user.id, day.id)
                  const isSaving = saving === `${user.id}-${day.id}`

                  return (
                    <td key={day.id} className="text-center py-2 px-2">
                      <button
                        onClick={() => togglePayment(user.id, day.id)}
                        disabled={isSaving}
                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                          isPaid
                            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                            : 'bg-zinc-700 text-zinc-500 hover:bg-zinc-600'
                        }`}
                      >
                        {isSaving ? (
                          <span className="text-xs">...</span>
                        ) : isPaid ? (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                        ) : (
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                        )}
                      </button>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
