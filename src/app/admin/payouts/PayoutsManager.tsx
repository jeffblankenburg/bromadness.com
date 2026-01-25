'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Winner {
  oderId: number
  oderlabel: string
  payout_type: string
  payout_label: string
  amount: number
  user_id: string | null
  user_name: string | null
  is_complete: boolean
  is_paid: boolean
  payout_id: string | null
}

interface Props {
  tournamentId: string
  winners: Winner[]
  pickemDates: string[]  // Actual dates like "2026-03-19"
}

export function PayoutsManager({ tournamentId, winners, pickemDates }: Props) {
  const [localWinners, setLocalWinners] = useState(winners)
  const [saving, setSaving] = useState<string | null>(null)

  // Determine default tab based on current date
  const getDefaultTab = () => {
    const pickemWinnersInit = winners.filter(w => w.payout_type.startsWith('pickem_'))
    const tabNames = [...new Set(pickemWinnersInit.map(w => w.oderlabel.split('|')[0]))]

    if (tabNames.length === 0) return 'Auction'

    const today = new Date().toISOString().split('T')[0]  // "2026-03-19"

    // Find today's date in pickemDates
    const todayIndex = pickemDates.findIndex(d => d === today)

    if (todayIndex !== -1 && todayIndex < tabNames.length) {
      // Current day of tournament
      return tabNames[todayIndex]
    }

    // Check if before tournament (today < first date)
    if (pickemDates.length > 0 && today < pickemDates[0]) {
      return tabNames[0]  // Default to Thursday
    }

    // Check if after tournament (today > last date)
    if (pickemDates.length > 0 && today > pickemDates[pickemDates.length - 1]) {
      return 'Auction'  // Default to Auction
    }

    // Fallback to first tab
    return tabNames[0] || 'Auction'
  }

  const [activeTab, setActiveTab] = useState(getDefaultTab)
  const router = useRouter()
  const supabase = createClient()

  // Toggle paid status
  const handleTogglePaid = async (winner: Winner) => {
    setSaving(winner.payout_type)
    const newIsPaid = !winner.is_paid

    // Optimistic update
    setLocalWinners(prev =>
      prev.map(w =>
        w.payout_type === winner.payout_type
          ? { ...w, is_paid: newIsPaid }
          : w
      )
    )

    try {
      if (winner.payout_id) {
        // Update existing record
        await supabase
          .from('payouts')
          .update({
            is_paid: newIsPaid,
            paid_at: newIsPaid ? new Date().toISOString() : null,
            user_id: winner.user_id, // Keep in sync
          })
          .eq('id', winner.payout_id)
      } else {
        // Create or update record (upsert to handle conflicts)
        await supabase
          .from('payouts')
          .upsert({
            tournament_id: tournamentId,
            payout_type: winner.payout_type,
            payout_label: winner.payout_label,
            amount: winner.amount,
            user_id: winner.user_id,
            is_paid: newIsPaid,
            paid_at: newIsPaid ? new Date().toISOString() : null,
            display_order: winner.oderId,
          }, {
            onConflict: 'tournament_id,payout_type',
          })
      }
      router.refresh()
    } catch (err) {
      console.error('Failed to update payout:', err)
      // Revert on error
      setLocalWinners(prev =>
        prev.map(w =>
          w.payout_type === winner.payout_type ? winner : w
        )
      )
    } finally {
      setSaving(null)
    }
  }

  // Get unique tabs - Pick'em days first, then Brocket, then Auction last
  const auctionWinners = localWinners.filter(w => w.payout_type.startsWith('auction_'))
  const pickemWinners = localWinners.filter(w => w.payout_type.startsWith('pickem_'))
  const brocketWinners = localWinners.filter(w => w.payout_type.startsWith('brocket_'))

  // Extract tab name from oderlabel format "THU|THURSDAY Pick'em Early Games"
  const getTabName = (label: string) => label.split('|')[0]
  const getDisplayLabel = (label: string) => label.split('|')[1] || label

  // Get unique Pick'em day tabs (THU, FRI, etc.)
  const pickemTabs = [...new Set(pickemWinners.map(w => getTabName(w.oderlabel)))]

  // Build tabs: Pick'em days, Brocket (if has entries), Auction
  const tabs = [
    ...pickemTabs,
    ...(brocketWinners.length > 0 ? ['Brocket'] : []),
    'Auction'
  ]

  // Get winners for current tab
  const getTabWinners = () => {
    if (activeTab === 'Auction') {
      return auctionWinners
    }
    if (activeTab === 'Brocket') {
      return brocketWinners
    }
    // For Pick'em tabs, show both sessions for that date
    return pickemWinners.filter(w => getTabName(w.oderlabel) === activeTab)
  }

  const tabWinners = getTabWinners()

  // Group by session within the tab (using the full display label)
  const groupedBySession = tabWinners.reduce((acc, winner) => {
    const key = getDisplayLabel(winner.oderlabel)
    if (!acc[key]) {
      acc[key] = []
    }
    acc[key].push(winner)
    return acc
  }, {} as Record<string, Winner[]>)

  // Calculate totals (all winners, not just current tab)
  const completedWinners = localWinners.filter(w => w.is_complete && w.user_id)
  const totalOwed = completedWinners.reduce((sum, w) => sum + w.amount, 0)
  const totalPaid = completedWinners.filter(w => w.is_paid).reduce((sum, w) => sum + w.amount, 0)
  const totalUnpaid = totalOwed - totalPaid

  const renderWinnerRow = (winner: Winner) => {
    const isSaving = saving === winner.payout_type
    const hasWinner = winner.user_id && winner.is_complete

    return (
      <div
        key={winner.payout_type}
        className={`flex items-center justify-between py-3 border-b border-zinc-700 last:border-0 ${
          !winner.is_complete ? 'opacity-50' : ''
        }`}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-200">{winner.payout_label}</span>
            {winner.amount > 0 && (
              <span className="text-green-400 font-medium">${winner.amount}</span>
            )}
          </div>
          <div className="text-sm mt-0.5">
            {hasWinner ? (
              <span className="text-orange-400">{winner.user_name}</span>
            ) : winner.is_complete ? (
              <span className="text-zinc-500 italic">No entries</span>
            ) : (
              <span className="text-zinc-600 italic">Pending...</span>
            )}
          </div>
        </div>

        {/* Paid toggle - only show if there's a winner and contest is complete */}
        {hasWinner && (
          <label className="flex items-center gap-2 cursor-pointer ml-4">
            <span className={`text-xs ${winner.is_paid ? 'text-green-400' : 'text-zinc-500'}`}>
              {winner.is_paid ? 'Paid' : 'Unpaid'}
            </span>
            <button
              onClick={() => handleTogglePaid(winner)}
              disabled={isSaving}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                winner.is_paid ? 'bg-green-600' : 'bg-zinc-700'
              } ${isSaving ? 'opacity-50' : ''}`}
            >
              <div
                className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${
                  winner.is_paid ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </label>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">
            Total: <span className="text-white">${totalOwed}</span>
          </span>
          <span className="text-zinc-400">
            Paid: <span className="text-green-400">${totalPaid}</span>
          </span>
          <span className="text-zinc-400">
            Unpaid: <span className={totalUnpaid > 0 ? 'text-red-400' : 'text-green-400'}>
              ${totalUnpaid}
            </span>
          </span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-sm font-medium rounded-lg whitespace-nowrap transition-colors ${
              activeTab === tab
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:text-white'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Content for selected tab */}
      {Object.entries(groupedBySession).map(([sessionLabel, sessionWinners]) => (
        <div key={sessionLabel} className="bg-zinc-800/50 rounded-xl p-4">
          <h3
            className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {sessionLabel}
          </h3>
          <div className="space-y-0">
            {sessionWinners.map(renderWinnerRow)}
          </div>
        </div>
      ))}

      {tabWinners.length === 0 && (
        <div className="bg-zinc-800/50 rounded-xl p-4 text-center text-zinc-500">
          No prizes configured for this section.
        </div>
      )}
    </div>
  )
}
