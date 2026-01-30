'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  tournamentId: string
}

export function BrocketResetPicks({ tournamentId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [resetting, setResetting] = useState(false)
  const router = useRouter()

  const handleReset = async () => {
    setResetting(true)

    try {
      const response = await fetch('/api/brocket', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tournamentId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reset picks')
      }

      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to reset picks:', error)
      alert('Failed to reset picks')
    }
    setResetting(false)
  }

  return (
    <>
      {/* Reset Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors"
      >
        Reset All Picks
      </button>

      {/* Confirmation Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-zinc-900 border border-red-700 rounded-xl p-6 w-full max-w-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
                Warning
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

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
                <p className="text-sm text-zinc-300">
                  This will permanently delete <span className="text-red-400 font-semibold">all Brocket picks</span> for all players in this tournament. This action cannot be undone.
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsOpen(false)}
                  className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReset}
                  disabled={resetting}
                  className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 text-white font-medium rounded-lg text-sm"
                >
                  {resetting ? 'Resetting...' : 'Reset All Picks'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
