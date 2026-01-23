'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface User {
  id: string
  display_name: string | null
  phone: string | null
}

interface TripCost {
  id: string
  user_id: string
  amount_owed: number
}

interface Payment {
  id: string
  trip_cost_id: string
  amount: number
  note: string | null
  paid_at: string
}

interface Props {
  tournamentId: string
  users: User[]
  tripCosts: TripCost[]
  payments: Payment[]
}

export function TripCostManager({ tournamentId, users, tripCosts, payments }: Props) {
  const [expandedUser, setExpandedUser] = useState<string | null>(null)
  const [editingOwed, setEditingOwed] = useState<string | null>(null)
  const [owedAmount, setOwedAmount] = useState('')
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentNote, setPaymentNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletePaymentId, setDeletePaymentId] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  // Build user data with costs and payments
  const userData = users.map(user => {
    const tripCost = tripCosts.find(tc => tc.user_id === user.id)
    const userPayments = tripCost
      ? payments.filter(p => p.trip_cost_id === tripCost.id)
      : []
    const totalPaid = userPayments.reduce((sum, p) => sum + p.amount, 0)
    const amountOwed = tripCost?.amount_owed || 0
    const balance = amountOwed - totalPaid

    return {
      ...user,
      tripCostId: tripCost?.id || null,
      amountOwed,
      totalPaid,
      balance,
      payments: userPayments,
    }
  })

  // Calculate totals
  const totalOwed = userData.reduce((sum, u) => sum + u.amountOwed, 0)
  const totalPaid = userData.reduce((sum, u) => sum + u.totalPaid, 0)
  const totalBalance = totalOwed - totalPaid

  const handleSetOwed = async (userId: string) => {
    const amount = parseFloat(owedAmount)
    if (isNaN(amount) || amount < 0) return

    setSaving(true)
    try {
      const existing = tripCosts.find(tc => tc.user_id === userId)
      if (existing) {
        await supabase
          .from('trip_costs')
          .update({ amount_owed: amount })
          .eq('id', existing.id)
      } else {
        await supabase
          .from('trip_costs')
          .insert({
            tournament_id: tournamentId,
            user_id: userId,
            amount_owed: amount,
          })
      }
      setEditingOwed(null)
      setOwedAmount('')
      router.refresh()
    } catch (err) {
      console.error('Failed to set amount:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAddPayment = async (userId: string, tripCostId: string | null) => {
    const amount = parseFloat(paymentAmount)
    if (isNaN(amount) || amount <= 0) return

    setSaving(true)
    try {
      let costId = tripCostId

      // Create trip_cost record if it doesn't exist
      if (!costId) {
        const { data } = await supabase
          .from('trip_costs')
          .insert({
            tournament_id: tournamentId,
            user_id: userId,
            amount_owed: 0,
          })
          .select('id')
          .single()
        costId = data?.id
      }

      if (costId) {
        await supabase
          .from('trip_payments')
          .insert({
            trip_cost_id: costId,
            amount,
            note: paymentNote || null,
          })
      }

      setPaymentAmount('')
      setPaymentNote('')
      router.refresh()
    } catch (err) {
      console.error('Failed to add payment:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeletePayment = async () => {
    if (!deletePaymentId) return

    setSaving(true)
    try {
      await supabase
        .from('trip_payments')
        .delete()
        .eq('id', deletePaymentId)
      setDeletePaymentId(null)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete payment:', err)
    } finally {
      setSaving(false)
    }
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Owed: <span className="text-white">${totalOwed.toFixed(0)}</span></span>
          <span className="text-zinc-400">Collected: <span className="text-green-400">${totalPaid.toFixed(0)}</span></span>
          <span className="text-zinc-400">Due: <span className={totalBalance > 0 ? 'text-red-400' : 'text-green-400'}>${totalBalance.toFixed(0)}</span></span>
        </div>
      </div>

      {/* User list */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
          {users.length} Users
        </h3>
        <div className="space-y-1">
          {userData.map(user => (
            <div key={user.id}>
              {/* User row */}
              <div
                onClick={() => setExpandedUser(expandedUser === user.id ? null : user.id)}
                className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0 cursor-pointer hover:bg-zinc-700/20 -mx-2 px-2 rounded"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.display_name || user.phone}</span>
                  {user.payments.length > 0 && (
                    <span className="text-xs text-zinc-500">
                      ({user.payments.length})
                    </span>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  user.balance > 0
                    ? 'bg-red-500/20 text-red-400'
                    : user.balance < 0
                    ? 'bg-yellow-500/20 text-yellow-400'
                    : user.amountOwed > 0
                    ? 'bg-green-500/20 text-green-400'
                    : 'text-zinc-500'
                }`}>
                  {user.balance > 0 ? `-$${user.balance.toFixed(0)}` :
                   user.balance < 0 ? `+$${Math.abs(user.balance).toFixed(0)}` :
                   user.amountOwed > 0 ? 'Paid' : '--'}
                </span>
              </div>

              {/* Expanded detail */}
              {expandedUser === user.id && (
                <div className="py-3 space-y-3 text-sm">
                  {/* Set amount owed */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Trip Cost</label>
                    {editingOwed === user.id ? (
                      <div className="flex gap-2">
                        <input
                          type="text" inputMode="numeric"
                          value={owedAmount}
                          onChange={e => setOwedAmount(e.target.value)}
                          placeholder="0"
                          className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSetOwed(user.id)}
                          disabled={saving}
                          className="px-3 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white text-xs rounded"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => { setEditingOwed(null); setOwedAmount('') }}
                          className="px-2 py-1 text-zinc-400 hover:text-white text-xs"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => { setEditingOwed(user.id); setOwedAmount(user.amountOwed.toString()) }}
                        className="text-zinc-300 hover:text-white"
                      >
                        ${user.amountOwed.toFixed(0)} <span className="text-zinc-500 text-xs">(edit)</span>
                      </button>
                    )}
                  </div>

                  {/* Add payment */}
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Add Payment</label>
                    <div className="flex gap-2">
                      <input
                        type="text" inputMode="numeric"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                        placeholder="$"
                        className="w-20 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm"
                      />
                      <input
                        type="text"
                        value={paymentNote}
                        onChange={e => setPaymentNote(e.target.value)}
                        placeholder="venmo, cash, etc."
                        className="flex-1 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm"
                      />
                      <button
                        onClick={() => handleAddPayment(user.id, user.tripCostId)}
                        disabled={saving || !paymentAmount}
                        className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-zinc-700 text-white text-xs rounded"
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* Payment history */}
                  {user.payments.length > 0 && (
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">History</label>
                      <div className="space-y-1">
                        {user.payments.map(payment => (
                          <div
                            key={payment.id}
                            className="flex items-center justify-between text-xs py-1"
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-green-400">+${payment.amount.toFixed(0)}</span>
                              {payment.note && <span className="text-zinc-500">{payment.note}</span>}
                              <span className="text-zinc-600">{formatDate(payment.paid_at)}</span>
                            </div>
                            <button
                              onClick={() => setDeletePaymentId(payment.id)}
                              className="text-zinc-500 hover:text-red-400"
                            >
                              x
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deletePaymentId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setDeletePaymentId(null)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-4 w-full max-w-xs space-y-3">
            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Delete Payment?</h3>
            <p className="text-sm text-zinc-400">
              This will remove the payment from this user&apos;s history.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setDeletePaymentId(null)}
                className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePayment}
                disabled={saving}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white text-sm font-medium rounded"
              >
                {saving ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
