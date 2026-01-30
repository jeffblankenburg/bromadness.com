'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tournamentId: string
}

export function DeleteAllPicks({ tournamentId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  // tournamentId is available if needed in the future
  void tournamentId

  const handleDelete = async () => {
    setDeleting(true)
    try {
      // Delete ALL picks from pickem_picks table (preserves entries/payment status)
      const { error: picksError } = await supabase
        .from('pickem_picks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Workaround: delete all rows

      if (picksError) {
        console.error('Error deleting picks:', picksError)
        alert('Failed to delete picks')
        setDeleting(false)
        return
      }

      setIsOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete picks:', err)
      alert('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Reset All Picks
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative bg-zinc-900 border border-red-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                Confirm Reset
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <p className="text-sm text-zinc-300">
              This will delete all Pick&apos;em picks for all players. Payment status will be preserved.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white font-medium rounded-lg text-sm"
              >
                {deleting ? 'Resetting...' : 'Reset All Picks'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
