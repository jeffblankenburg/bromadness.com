'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function CreateTournament() {
  const [name, setName] = useState('')
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/admin/tournament', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), year }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error)

      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl p-6 max-w-md">
      <h3 className="text-lg font-semibold mb-4">Create Tournament</h3>

      <form onSubmit={handleCreate} className="space-y-4">
        <div>
          <label className="block text-sm text-zinc-400 mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. March Madness 2025"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="block text-sm text-zinc-400 mb-1">Year</label>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white"
            min={2020}
            max={2100}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Creating...' : 'Create Tournament'}
        </button>
      </form>
    </div>
  )
}
