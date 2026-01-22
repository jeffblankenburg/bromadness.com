'use client'

import { useState, useEffect, useRef } from 'react'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface Team {
  id: string
  name: string
  short_name: string | null
}

interface Props {
  regionName: string
  seed: number
  currentTeam?: Team
  onSelect: (name: string, shortName: string) => void
  onClear: () => void
  onClose: () => void
  saving: boolean
}

export function TeamSelector({ regionName, seed, currentTeam, onSelect, onClear, onClose, saving }: Props) {
  const [search, setSearch] = useState(currentTeam?.name || '')
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const filteredTeams = search.length > 0
    ? D1_TEAMS.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.shortName.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 8)
    : []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!search.trim()) return

    // Find matching team or use custom name
    const match = D1_TEAMS.find(t => t.name.toLowerCase() === search.toLowerCase())
    onSelect(match?.name || search.trim(), match?.shortName || search.trim().substring(0, 15))
  }

  const handleSelectSuggestion = (team: { name: string; shortName: string }) => {
    onSelect(team.name, team.shortName)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
      <div className="bg-zinc-800 rounded-xl w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-zinc-700">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              {regionName} Region - #{seed} Seed
            </h3>
            <button onClick={onClose} className="text-zinc-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setShowSuggestions(true)
              }}
              onFocus={() => setShowSuggestions(true)}
              placeholder="Type team name..."
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              autoComplete="off"
            />

            {/* Suggestions dropdown */}
            {showSuggestions && filteredTeams.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-xl overflow-hidden z-10 max-h-64 overflow-y-auto">
                {filteredTeams.map((team) => {
                  const logoUrl = getTeamLogoUrl(team)
                  return (
                    <button
                      key={team.name}
                      type="button"
                      onClick={() => handleSelectSuggestion(team)}
                      className="w-full px-3 py-2 text-left hover:bg-zinc-800 flex items-center gap-3"
                    >
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: team.primaryColor }}
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="w-6 h-6 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                        ) : (
                          <span className="text-xs font-bold text-white">{team.abbreviation.slice(0, 2)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm truncate">{team.name}</div>
                        <div className="text-zinc-500 text-xs">{team.abbreviation}</div>
                      </div>
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: team.primaryColor }}
                      />
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !search.trim()}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {currentTeam && (
              <button
                type="button"
                onClick={onClear}
                disabled={saving}
                className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium rounded-lg transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
