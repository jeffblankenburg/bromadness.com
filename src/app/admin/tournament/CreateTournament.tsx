'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function CreateTournament() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Create tournament
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          year,
          name: `March Madness ${year}`,
          start_date: `${year}-03-15`,
          end_date: `${year}-04-08`,
          is_active: true,
        })
        .select()
        .single()

      if (tournamentError) throw tournamentError

      // Create regions
      const regions = ['East', 'West', 'South', 'Midwest']
      const { error: regionsError } = await supabase
        .from('regions')
        .insert(
          regions.map((name, index) => ({
            tournament_id: tournament.id,
            name,
            position: index + 1,
          }))
        )

      if (regionsError) throw regionsError

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
          disabled={loading}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
        >
          {loading ? 'Creating...' : 'Create Tournament'}
        </button>
      </form>
    </div>
  )
}
