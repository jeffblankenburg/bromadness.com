'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Bracket {
  id: string
  name: string
  bracket_type: string
  status: string
  winner_id: string | null
  created_at: string
  participant_count: number
  is_owner: boolean
  creator_name: string
}

interface Props {
  brackets: Bracket[]
}

export function BracketsListClient({ brackets }: Props) {
  const router = useRouter()
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const handleDelete = async () => {
    if (!deleteId) return

    setDeleting(true)
    try {
      const res = await fetch(`/api/brackets/${deleteId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        setDeleteId(null)
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to delete bracket')
      }
    } catch {
      alert('Failed to delete bracket')
    } finally {
      setDeleting(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div>
      <Link
        href="/brackets/create"
        className="flex items-center justify-center gap-2 w-full p-4 bg-orange-500 hover:bg-orange-600 rounded-xl font-medium transition-colors mb-6"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
        </svg>
        Create New Bracket
      </Link>

      {brackets.length === 0 ? (
        <div className="text-center py-8 text-zinc-400">
          <p>You haven&apos;t created any brackets yet.</p>
          <p className="text-sm mt-2">Create one to get started!</p>
        </div>
      ) : (
        <div className="space-y-3">
          {brackets.map((bracket) => (
            <div
              key={bracket.id}
              className="bg-zinc-800/50 rounded-xl overflow-hidden"
            >
              <Link
                href={`/brackets/${bracket.id}`}
                className="flex items-center gap-4 p-4 hover:bg-zinc-800 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{bracket.name}</div>
                  <div className="text-sm text-zinc-400 flex items-center gap-2">
                    <span className={bracket.bracket_type === 'double' ? 'text-orange-400' : ''}>
                      {bracket.bracket_type === 'single' ? 'Single' : 'Double'} Elimination
                    </span>
                    <span>·</span>
                    <span>{bracket.participant_count} players</span>
                  </div>
                  <div className="text-xs text-zinc-500 mt-1 flex items-center gap-2">
                    <span>{formatDate(bracket.created_at)}</span>
                    {!bracket.is_owner && (
                      <span>· by {bracket.creator_name}</span>
                    )}
                    {bracket.status === 'completed' && (
                      <span className="text-green-400">· Completed</span>
                    )}
                  </div>
                </div>
                <svg className="w-5 h-5 text-zinc-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                </svg>
              </Link>
              {bracket.is_owner && (
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setDeleteId(bracket.id)}
                    className="text-sm text-red-400 hover:text-red-300 transition-colors"
                  >
                    Delete bracket
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70">
          <div className="bg-zinc-800 rounded-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">Delete Bracket?</h3>
            <p className="text-zinc-400 text-sm mb-6">
              This action cannot be undone. All bracket data will be permanently deleted.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteId(null)}
                className="flex-1 p-3 bg-zinc-700 hover:bg-zinc-600 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex-1 p-3 bg-red-600 hover:bg-red-700 disabled:bg-zinc-600 disabled:text-zinc-400 rounded-lg transition-colors"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
