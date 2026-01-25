'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tournamentId: string
  auctionComplete: boolean
}

export function AuctionFinishButton({ tournamentId, auctionComplete }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleFinish = async () => {
    setSaving(true)
    try {
      await supabase
        .from('tournaments')
        .update({ auction_complete: true })
        .eq('id', tournamentId)
      setShowConfirm(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to finish auction:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleReopen = async () => {
    setSaving(true)
    try {
      await supabase
        .from('tournaments')
        .update({ auction_complete: false })
        .eq('id', tournamentId)
      router.refresh()
    } catch (err) {
      console.error('Failed to reopen auction:', err)
    } finally {
      setSaving(false)
    }
  }

  if (auctionComplete) {
    return (
      <button
        onClick={handleReopen}
        disabled={saving}
        className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 disabled:bg-zinc-800 text-white font-medium rounded-lg text-sm"
      >
        {saving ? 'Reopening...' : 'Reopen Auction'}
      </button>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-bold rounded-lg text-sm transition-colors"
      >
        Auction Is Finished
      </button>

      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <h3 className="text-lg font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>End Auction?</h3>
            <p className="text-sm text-zinc-300">
              This will end the auction and show the leaderboard to all users.
              Any unclaimed teams will remain unassigned.
            </p>
            <p className="text-xs text-zinc-500">
              You can reopen the auction later if needed.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowConfirm(false)}
                className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleFinish}
                disabled={saving}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white font-bold rounded-lg text-sm"
              >
                {saving ? 'Finishing...' : 'End Auction'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
