'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tournamentId: string
}

export function AuctionResetButton({ tournamentId }: Props) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [resetting, setResetting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleReset = async () => {
    setResetting(true)
    try {
      // Delete all auction team assignments for this tournament
      await supabase
        .from('auction_teams')
        .delete()
        .eq('tournament_id', tournamentId)

      // Reset auction_complete to false
      await supabase
        .from('tournaments')
        .update({ auction_complete: false })
        .eq('id', tournamentId)

      setShowConfirm(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to reset auction:', err)
      alert('Failed to reset auction. Check console for details.')
    } finally {
      setResetting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg text-sm transition-colors"
      >
        Reset Auction Data
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 max-w-sm w-full space-y-4 border border-zinc-700">
            <h3 className="text-lg font-bold text-white">Reset Auction?</h3>
            <p className="text-sm text-zinc-400">
              This will remove all team owners, clear all bids, and reset the auction to its initial state.
            </p>
            <p className="text-sm text-red-400 font-medium">
              This action cannot be reversed.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowConfirm(false)}
                disabled={resetting}
                className="flex-1 py-2 px-4 bg-zinc-800 rounded-lg text-zinc-300 text-sm font-medium hover:bg-zinc-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetting}
                className="flex-1 py-2 px-4 bg-red-600 rounded-lg text-white text-sm font-medium hover:bg-red-500 transition-colors disabled:opacity-50"
              >
                {resetting ? 'Resetting...' : 'Yes, Reset All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
