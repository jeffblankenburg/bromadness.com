'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

// DEV ONLY - Remove before launch
export function DevTools({ isAdmin }: { isAdmin: boolean }) {
  const [admin, setAdmin] = useState(isAdmin)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggleAdmin = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/dev/toggle-admin', { method: 'POST' })
      const data = await res.json()
      if (res.ok) {
        setAdmin(data.is_admin)
        router.refresh()
      }
    } catch (e) {
      console.error('Failed to toggle admin:', e)
    }
    setLoading(false)
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 bg-zinc-800/90 backdrop-blur border border-zinc-700 rounded-xl p-3">
      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-400 uppercase tracking-wide">Dev Tools</span>
        <button
          onClick={toggleAdmin}
          disabled={loading}
          className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
            admin
              ? 'bg-orange-500 text-white'
              : 'bg-zinc-700 text-zinc-300'
          } disabled:opacity-50`}
        >
          {loading ? '...' : admin ? 'Admin: ON' : 'Admin: OFF'}
        </button>
      </div>
    </div>
  )
}
