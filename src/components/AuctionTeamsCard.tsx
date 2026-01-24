'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface AuctionTeam {
  team: { id: string; name: string; short_name: string | null; seed: number } | null
  bid_amount: number
  wins: number
  points: number
}

interface Props {
  teams: AuctionTeam[]
  totalPoints: number
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

const STORAGE_KEY = 'auction-teams-expanded'

export function AuctionTeamsCard({ teams, totalPoints }: Props) {
  const [expanded, setExpanded] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored !== null) {
      setExpanded(stored === 'true')
    }
  }, [])

  const toggleExpanded = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const newValue = !expanded
    setExpanded(newValue)
    localStorage.setItem(STORAGE_KEY, String(newValue))
  }

  const sortedTeams = [...teams].sort((a, b) => (a.team?.seed || 99) - (b.team?.seed || 99))

  return (
    <div className="block w-full bg-zinc-800/50 rounded-xl overflow-hidden">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
          NCAA Auction {totalPoints > 0 && <span className="text-zinc-400">({totalPoints})</span>}
        </h3>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <Link href="/auction" className="block px-4 pb-4">
          {teams.length > 0 ? (
            <div className="space-y-2">
              {sortedTeams.map((at, idx) => {
                const d1Team = at.team?.name ? findD1Team(at.team.name) : null
                const logoUrl = d1Team ? getTeamLogoUrl(d1Team) : null
                return (
                  <div
                    key={idx}
                    className="flex items-center justify-between text-sm px-2 py-2 rounded-lg"
                    style={{ backgroundColor: d1Team?.primaryColor ? d1Team.primaryColor + '40' : '#3f3f4640' }}
                  >
                    <div className="flex items-center gap-2">
                      <span className="w-5 text-xs text-zinc-400">{at.team?.seed}</span>
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: d1Team?.primaryColor || '#3f3f46' }}
                      >
                        {logoUrl ? (
                          <img src={logoUrl} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                        ) : (
                          <span className="text-[10px] font-bold text-white">{d1Team?.abbreviation?.slice(0, 2) || at.team?.short_name?.slice(0, 2) || '?'}</span>
                        )}
                      </div>
                      <span className="text-white">{d1Team?.shortName || at.team?.short_name || at.team?.name}</span>
                      <span className="text-xs text-zinc-400">${at.bid_amount}</span>
                    </div>
                    <span className="text-xs text-zinc-300">
                      {at.points}
                    </span>
                  </div>
                )
              })}
              <div className="flex items-center justify-between text-sm px-2 pt-2 mt-2 border-t border-zinc-700">
                <span className="font-semibold text-zinc-300">Total Points</span>
                <span className="text-xs font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{totalPoints}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-500 text-center">No teams yet</p>
          )}
        </Link>
      )}
    </div>
  )
}
