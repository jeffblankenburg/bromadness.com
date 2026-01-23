'use client'

import { useState, useEffect } from 'react'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface Region {
  id: string
  name: string
  position: number
}

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
  region_id: string
  is_eliminated: boolean
}

interface AuctionTeam {
  id: string
  user_id: string
  team_id: string
  bid_amount: number
}

interface User {
  id: string
  display_name: string | null
  phone: string
}

interface Props {
  regions: Region[]
  teams: Team[]
  auctionTeams: AuctionTeam[]
  users: User[]
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

export function AuctionTeamList({ regions, teams, auctionTeams, users }: Props) {
  const [selectedRegion, setSelectedRegion] = useState<string>('')
  const [expanded, setExpanded] = useState(true)

  // Load saved states from localStorage
  useEffect(() => {
    const savedRegion = localStorage.getItem('auction-team-list-region')
    if (savedRegion && regions.find(r => r.id === savedRegion)) {
      setSelectedRegion(savedRegion)
    } else if (regions.length > 0) {
      setSelectedRegion(regions[0].id)
    }

    const savedExpanded = localStorage.getItem('auction-team-list-expanded')
    if (savedExpanded !== null) {
      setExpanded(savedExpanded === 'true')
    }
  }, [regions])

  const toggleExpanded = () => {
    const newValue = !expanded
    setExpanded(newValue)
    localStorage.setItem('auction-team-list-expanded', String(newValue))
  }

  // Save selected region to localStorage
  const handleRegionChange = (regionId: string) => {
    setSelectedRegion(regionId)
    localStorage.setItem('auction-team-list-region', regionId)
  }

  // Bracket order: matchups are 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
  const BRACKET_ORDER = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]

  // Get teams for selected region, sorted by bracket order
  const regionTeams = teams
    .filter(t => t.region_id === selectedRegion)
    .sort((a, b) => BRACKET_ORDER.indexOf(a.seed) - BRACKET_ORDER.indexOf(b.seed))

  // Build a map of team_id -> auction info
  const auctionMap = new Map(
    auctionTeams.map(at => [at.team_id, at])
  )

  // Build a map of user_id -> user
  const userMap = new Map(
    users.map(u => [u.id, u])
  )

  const getOwnerName = (userId: string) => {
    const user = userMap.get(userId)
    return user?.display_name || user?.phone || 'Unknown'
  }

  // Count unclaimed teams
  const unclaimedCount = teams.filter(t => !auctionTeams.find(at => at.team_id === t.id)).length

  return (
    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
      {/* Collapsible Header */}
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>All Teams</h3>
          <span className="text-xs text-zinc-500">({unclaimedCount} available)</span>
        </div>
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
        <>
          {/* Region Tabs */}
          <div className="flex bg-zinc-900/50 mx-4 rounded-lg p-1 mb-3">
            {regions.map(region => (
              <button
                key={region.id}
                onClick={() => handleRegionChange(region.id)}
                className={`flex-1 px-3 py-2 rounded-md text-xs font-medium transition-colors ${
                  selectedRegion === region.id
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-white'
                }`}
              >
                {region.name}
              </button>
            ))}
          </div>

          {/* Team List */}
          <div className="px-4 pb-4 space-y-2">
        {regionTeams.map(team => {
          const d1Team = findD1Team(team.name)
          const logo = d1Team ? getTeamLogoUrl(d1Team) : null
          const auction = auctionMap.get(team.id)
          const isClaimed = !!auction

          return (
            <div
              key={team.id}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-opacity ${
                isClaimed ? 'opacity-40' : ''
              }`}
              style={{ backgroundColor: d1Team ? d1Team.primaryColor + '40' : '#3f3f4640' }}
            >
              {/* Seed */}
              <span className="w-5 text-xs font-mono text-zinc-400">{team.seed}</span>

              {/* Logo */}
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: d1Team?.primaryColor || '#3f3f46' }}
              >
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="w-5 h-5 object-contain"
                    style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }}
                  />
                ) : (
                  <span className="text-[10px] font-bold text-white">
                    {d1Team?.abbreviation?.slice(0, 2) || team.short_name?.slice(0, 2) || '?'}
                  </span>
                )}
              </div>

              {/* Team Name */}
              <span className="flex-1 text-sm text-white truncate">
                {d1Team?.shortName || team.short_name || team.name}
              </span>

              {/* Owner Info (if claimed) */}
              {isClaimed && auction && (
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-white font-semibold">
                    {getOwnerName(auction.user_id)}
                  </span>
                  <span className="text-sm text-zinc-400">
                    ${auction.bid_amount}
                  </span>
                </div>
              )}
            </div>
          )
        })}
          </div>
        </>
      )}
    </div>
  )
}
