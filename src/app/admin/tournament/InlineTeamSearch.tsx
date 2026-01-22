'use client'

import { useState, useRef, useEffect } from 'react'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface Props {
  seed: number
  currentTeamName?: string
  onSelect: (name: string, shortName: string) => void
  onClear: () => void
  onCancel: () => void
}

export function InlineTeamSearch({ seed, currentTeamName, onSelect, onClear, onCancel }: Props) {
  const [search, setSearch] = useState(currentTeamName || '')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  // Handle clicking outside to cancel
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onCancel()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onCancel])

  const filteredTeams = search.length > 0
    ? D1_TEAMS.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.shortName.toLowerCase().includes(search.toLowerCase()) ||
        t.abbreviation.toLowerCase().includes(search.toLowerCase())
      ).slice(0, 6)
    : []

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex(i => Math.min(i + 1, filteredTeams.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredTeams[highlightedIndex]) {
        const team = filteredTeams[highlightedIndex]
        onSelect(team.name, team.shortName)
      } else if (search.trim()) {
        onSelect(search.trim(), search.trim().substring(0, 15))
      }
    } else if (e.key === 'Backspace' && search === '' && currentTeamName) {
      onClear()
    }
  }

  const handleSelectTeam = (team: { name: string; shortName: string }) => {
    onSelect(team.name, team.shortName)
  }

  return (
    <div ref={containerRef} className="relative flex-1">
      <div className="flex items-center gap-2 px-2 py-1.5 bg-zinc-900 rounded-lg border-2 border-orange-500">
        <span className="w-5 text-xs font-mono text-zinc-400">{seed}</span>
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value)
            setHighlightedIndex(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Type team name..."
          className="flex-1 bg-transparent text-white text-sm outline-none placeholder-zinc-500"
          autoComplete="off"
        />
        {currentTeamName && (
          <button
            onClick={onClear}
            className="text-red-400 hover:text-red-300 text-xs px-1"
          >
            ×
          </button>
        )}
      </div>

      {/* Dropdown */}
      {filteredTeams.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden z-50 shadow-xl">
          {filteredTeams.map((team, idx) => {
            const logoUrl = getTeamLogoUrl(team)
            const isHighlighted = idx === highlightedIndex
            return (
              <button
                key={team.name}
                type="button"
                onClick={() => handleSelectTeam(team)}
                onMouseEnter={() => setHighlightedIndex(idx)}
                className={`w-full px-3 py-2 text-left flex items-center gap-2 ${
                  isHighlighted ? 'bg-orange-500/20' : 'hover:bg-zinc-800'
                }`}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: team.primaryColor }}
                >
                  {logoUrl ? (
                    <img src={logoUrl} alt="" className="w-4 h-4 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                  ) : (
                    <span className="text-[8px] font-bold text-white">{team.abbreviation.slice(0, 2)}</span>
                  )}
                </div>
                <span className="flex-1 text-sm text-white truncate">{team.shortName}</span>
                <span className="text-xs text-zinc-500">{team.abbreviation}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* No results */}
      {search.length > 0 && filteredTeams.length === 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 rounded-lg p-3 z-50 shadow-xl">
          <p className="text-sm text-zinc-400 text-center">No teams found</p>
          <p className="text-xs text-zinc-500 text-center mt-1">Press Enter to use "{search}"</p>
        </div>
      )}
    </div>
  )
}
