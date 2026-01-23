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
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  // tournamentId is available if needed in the future
  void tournamentId

  const handleDelete = async () => {
    if (confirmText !== 'DELETE') return

    setDeleting(true)
    setError('')
    try {
      // Delete ALL picks from pickem_picks table (preserves entries/payment status)
      const { error: picksError } = await supabase
        .from('pickem_picks')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000') // Workaround: delete all rows

      if (picksError) {
        console.error('Error deleting picks:', picksError)
        setError(`Failed to delete picks: ${picksError.message}`)
        setDeleting(false)
        return
      }

      setIsOpen(false)
      setConfirmText('')
      router.refresh()
    } catch (err) {
      console.error('Failed to delete picks:', err)
      setError('An unexpected error occurred')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
      >
        Delete All Picks
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-400">Delete All Picks</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-zinc-300">
                This will permanently delete all pick&apos;em picks from all users.
              </p>
              <p className="text-zinc-400">
                Payment status will be preserved.
              </p>
              <p className="text-red-400 font-medium">
                This action cannot be undone.
              </p>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Type <span className="font-mono text-white">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setIsOpen(false)
                  setConfirmText('')
                }}
                className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE' || deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
              >
                {deleting ? 'Deleting...' : 'Delete All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
