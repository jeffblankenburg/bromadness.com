'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tournamentId: string
}

export function ClearTournament({ tournamentId }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleClear = async () => {
    if (confirmText !== 'CLEAR') return

    setClearing(true)
    setError('')
    try {
      // 1. Delete auction team assignments (references teams)
      const { error: auctionError } = await supabase
        .from('auction_teams')
        .delete()
        .eq('tournament_id', tournamentId)

      if (auctionError) {
        console.error('Error deleting auction teams:', auctionError)
        setError(`Failed to delete auction teams: ${auctionError.message}`)
        setClearing(false)
        return
      }

      // 2. Clear game metadata (keep game structure)
      const { error: gamesError } = await supabase
        .from('games')
        .update({
          team1_id: null,
          team2_id: null,
          winner_id: null,
          team1_score: null,
          team2_score: null,
          scheduled_at: null,
          spread: null,
          favorite_team_id: null,
          channel: null,
          location: null,
        })
        .eq('tournament_id', tournamentId)

      if (gamesError) {
        console.error('Error clearing games:', gamesError)
        setError(`Failed to clear games: ${gamesError.message}`)
        setClearing(false)
        return
      }

      // 3. Delete all teams
      const { error: teamsError } = await supabase
        .from('teams')
        .delete()
        .eq('tournament_id', tournamentId)

      if (teamsError) {
        console.error('Error deleting teams:', teamsError)
        setError(`Failed to delete teams: ${teamsError.message}`)
        setClearing(false)
        return
      }

      setIsOpen(false)
      setConfirmText('')
      router.refresh()
    } catch (err) {
      console.error('Failed to clear tournament:', err)
      setError('An unexpected error occurred')
    } finally {
      setClearing(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="px-3 py-1.5 bg-red-600/20 hover:bg-red-600/30 text-red-400 text-sm rounded-lg transition-colors"
      >
        Clear Tournament
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-400">Clear Tournament</h3>
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
                This will clear all tournament data to prepare for the next year:
              </p>
              <ul className="text-zinc-400 list-disc list-inside space-y-1">
                <li>Delete all 64 teams</li>
                <li>Clear all game assignments and scores</li>
                <li>Delete all auction team assignments</li>
              </ul>
              <p className="text-zinc-400">
                Game structure (rounds, regions) will be preserved.
              </p>
              <p className="text-red-400 font-medium">
                This action cannot be undone.
              </p>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Type <span className="font-mono text-white">CLEAR</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="CLEAR"
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
                onClick={handleClear}
                disabled={confirmText !== 'CLEAR' || clearing}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
              >
                {clearing ? 'Clearing...' : 'Clear All'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
