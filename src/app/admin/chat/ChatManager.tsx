'use client'

import { useState } from 'react'
import { StorageUsage } from '@/components/StorageUsage'

interface LeaderboardEntry {
  userId: string
  displayName: string
  count: number
}

interface ChatManagerProps {
  messageCount: number
  leaderboard: LeaderboardEntry[]
}

export function ChatManager({ messageCount, leaderboard }: ChatManagerProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleDelete = async () => {
    if (confirmText !== 'DELETE ALL') return

    setIsDeleting(true)
    setError(null)

    try {
      const res = await fetch('/api/chat/delete-all', { method: 'DELETE', credentials: 'include' })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete messages')
      }

      setSuccess(true)
      setShowConfirm(false)
      setConfirmText('')

      // Refresh the page after a short delay
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Leaderboard */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <h3
          className="text-sm font-semibold text-orange-400 mb-3 uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Top Contributors ({messageCount.toLocaleString()} messages)
        </h3>
        {leaderboard.length > 0 ? (
          <div className="space-y-2">
            {leaderboard.map((entry, index) => (
              <div key={entry.userId} className="flex items-center gap-3">
                <span className={`w-6 text-center font-bold ${
                  index === 0 ? 'text-yellow-400' :
                  index === 1 ? 'text-zinc-300' :
                  index === 2 ? 'text-orange-400' :
                  'text-zinc-500'
                }`}>
                  {index + 1}
                </span>
                <span className="flex-1 text-white truncate">{entry.displayName}</span>
                <span className="text-zinc-400 text-sm">{entry.count.toLocaleString()}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-zinc-500 text-sm">No messages yet.</p>
        )}
      </div>

      {/* Storage Usage */}
      <StorageUsage />

      {/* Delete All Messages */}
      <div className="bg-zinc-800/50 rounded-xl p-4 border border-red-900/50">
        <h3
          className="text-sm font-semibold text-red-400 mb-3 uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Danger Zone
        </h3>

        {success ? (
          <div className="bg-green-500/20 border border-green-500/50 rounded-lg p-3">
            <p className="text-green-400 text-sm">All chat messages and images deleted successfully. Refreshing...</p>
          </div>
        ) : !showConfirm ? (
          <div>
            <p className="text-zinc-400 text-sm mb-4">
              Delete all chat messages and uploaded images. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowConfirm(true)}
              disabled={messageCount === 0}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Delete All Chat Data
            </button>
            {messageCount === 0 && (
              <p className="text-zinc-500 text-xs mt-2">No messages to delete.</p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-zinc-300 text-sm">
              You are about to delete <span className="text-red-400 font-bold">{messageCount.toLocaleString()}</span> messages and all uploaded images.
            </p>
            <p className="text-zinc-400 text-sm">
              Type <span className="font-mono text-red-400">DELETE ALL</span> to confirm:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DELETE ALL"
              className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 text-sm focus:outline-none focus:border-red-500"
              autoFocus
            />
            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE ALL' || isDeleting}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                onClick={() => {
                  setShowConfirm(false)
                  setConfirmText('')
                  setError(null)
                }}
                disabled={isDeleting}
                className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
