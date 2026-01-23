'use client'

import { useState, useRef } from 'react'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
}

interface TeamWithStatus {
  id: string
  team_id: string
  bid_amount: number
  team: Team | undefined
  wins: number
  isEliminated: boolean
  points: number
}

interface LeaderboardEntry {
  user: {
    id: string
    display_name: string | null
    phone: string
  }
  points: number
  potential: number
  teams: TeamWithStatus[]
  totalSpent: number
  hasPaid: boolean
  hasChampion: boolean
  hasRunnerup: boolean
}

interface Props {
  leaderboard: LeaderboardEntry[]
  entryFee: number
}

interface PeekState {
  team: TeamWithStatus
  ownerName: string
  x: number
  y: number
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

function getLuminance(hexColor: string): number {
  const hex = hexColor.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16)
  const g = parseInt(hex.substring(2, 4), 16)
  const b = parseInt(hex.substring(4, 6), 16)
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255
}

function getContrastColor(hexColor: string): string {
  return getLuminance(hexColor) > 0.5 ? '#000000' : '#FFFFFF'
}

function getDarkerColor(color1: string, color2: string): { bg: string; border: string } {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  return lum1 < lum2 ? { bg: color1, border: color2 } : { bg: color2, border: color1 }
}

export function AuctionLeaderboard({ leaderboard, entryFee }: Props) {
  const [peeking, setPeeking] = useState<PeekState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getRank = (index: number, points: number) => {
    const firstWithPoints = leaderboard.findIndex(e => e.points === points)
    return firstWithPoints + 1
  }

  const handlePeekStart = (e: React.MouseEvent | React.TouchEvent, team: TeamWithStatus, ownerName: string) => {
    const target = e.currentTarget as HTMLElement
    const containerRect = containerRef.current?.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    if (containerRect) {
      const x = targetRect.left - containerRect.left + targetRect.width / 2
      const y = targetRect.top - containerRect.top
      setPeeking({ team, ownerName, x, y })
    }
  }

  const handlePeekEnd = () => {
    setPeeking(null)
  }

  const peekD1Team = peeking?.team.team ? findD1Team(peeking.team.team.name) : null

  return (
    <div className="space-y-2 relative" ref={containerRef}>
      {/* Peek tooltip */}
      {peeking && (() => {
        const primary = peekD1Team?.primaryColor || '#52525b'
        const secondary = peekD1Team?.secondaryColor || '#27272a'
        const { bg: bgColor, border: borderColor } = getDarkerColor(primary, secondary)
        const textColor = getContrastColor(bgColor)
        const teamName = peekD1Team?.shortName || peeking.team.team?.short_name || peeking.team.team?.name
        return (
          <div
            className="absolute z-20 pointer-events-none"
            style={{
              left: peeking.x,
              top: peeking.y - 8,
              transform: 'translate(-8px, -100%)'
            }}
          >
            <div
              className="rounded-lg px-3 py-2 text-sm whitespace-nowrap"
              style={{ backgroundColor: bgColor, border: `4px solid ${borderColor}`, color: textColor }}
            >
              <span className="font-semibold">#{peeking.team.team?.seed} {teamName}</span>
              <span className="mx-2">-</span>
              <span>{peeking.ownerName}</span>
              <span className="ml-2 font-semibold">${peeking.team.bid_amount}</span>
              {peeking.team.wins > 0 && (
                <span
                  className="ml-2 px-2 py-0.5 rounded text-xs font-bold"
                  style={{ backgroundColor: borderColor, color: getContrastColor(borderColor) }}
                >
                  {peeking.team.points} pts
                </span>
              )}
            </div>
            {/* Arrow at bottom-left */}
            <div className="flex justify-start pl-[10px]">
              <div
                className="w-3 h-3 rotate-45 -mt-[7px]"
                style={{ backgroundColor: bgColor, borderRight: `4px solid ${borderColor}`, borderBottom: `4px solid ${borderColor}` }}
              />
            </div>
          </div>
        )
      })()}

      {leaderboard.map((entry, idx) => {
        const rank = getRank(idx, entry.points)
        const isTop4 = rank <= 4

        return (
          <div
            key={entry.user.id}
            className={`relative overflow-hidden bg-zinc-800/50 rounded-lg px-2 py-1 ${
              isTop4 ? 'ring-1 ring-orange-500/30' : ''
            }`}
          >
            {/* Diagonal ribbon for unpaid */}
            {!entry.hasPaid && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="rotate-[15deg] bg-red-600/90 text-white text-xs font-bold py-1 w-[200%] text-center shadow-lg">
                  NEEDS TO PAY BRO ${entryFee}
                </div>
              </div>
            )}

            {/* Two column layout */}
            <div className="flex gap-3">
              {/* Left column: rank + name + teams */}
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2">
                  <span className={`text-3xl font-bold ${
                    rank === 1 ? 'text-yellow-400' :
                    rank === 2 ? 'text-zinc-300' :
                    rank === 3 ? 'text-orange-400' :
                    rank === 4 ? 'text-zinc-400' :
                    'text-zinc-500'
                  }`}>
                    {rank}
                  </span>
                  <span
                    className="text-2xl text-orange-400 uppercase tracking-wide truncate"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    {entry.user.display_name || entry.user.phone}
                  </span>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {entry.teams.map(t => {
                    const d1Team = t.team ? findD1Team(t.team.name) : null
                    const logo = d1Team ? getTeamLogoUrl(d1Team) : null
                    const bgColor = d1Team?.primaryColor || '#3f3f46'

                    return (
                      <div
                        key={t.id}
                        className="relative select-none cursor-pointer"
                        onMouseDown={(e) => handlePeekStart(e, t, entry.user.display_name || entry.user.phone || '')}
                        onMouseUp={handlePeekEnd}
                        onMouseLeave={handlePeekEnd}
                        onTouchStart={(e) => handlePeekStart(e, t, entry.user.display_name || entry.user.phone || '')}
                        onTouchEnd={handlePeekEnd}
                      >
                        <div
                          className={`w-10 h-10 rounded flex items-center justify-center ${
                            t.isEliminated ? 'ring-2 ring-red-500 ring-inset' : ''
                          }`}
                          style={{ backgroundColor: t.isEliminated ? '#71717a' : bgColor }}
                        >
                          {logo ? (
                            <img
                              src={logo}
                              alt=""
                              className={`w-7 h-7 object-contain pointer-events-none ${t.isEliminated ? 'grayscale' : ''}`}
                              style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px white)' }}
                              draggable={false}
                            />
                          ) : (
                            <span className={`font-bold text-xs pointer-events-none ${t.isEliminated ? 'text-zinc-400' : 'text-white'}`}>
                              {d1Team?.abbreviation?.slice(0, 2) || '?'}
                            </span>
                          )}
                        </div>

                        {/* Seed number in corner */}
                        <div className="absolute -top-1 -left-1 bg-black/80 text-white text-[9px] font-bold px-1 rounded pointer-events-none">
                          {t.team?.seed}
                        </div>

                        {/* Red X for eliminated */}
                        {t.isEliminated && (
                          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <svg className="w-8 h-8 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                              <path d="M18 6L6 18M6 6l12 12" />
                            </svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Right column: points */}
              <div className="text-right flex-shrink-0">
                <div
                  className="text-2xl font-bold text-orange-400"
                  style={{ fontFamily: 'var(--font-display)' }}
                >{entry.points} pts</div>
                {entry.potential > entry.points && (
                  <div className="text-xs text-zinc-500">{entry.potential} max</div>
                )}
                <div className="text-xs text-zinc-500">${entry.totalSpent}</div>
                {entry.hasChampion && (
                  <div className="text-xs text-yellow-400">Champion!</div>
                )}
                {entry.hasRunnerup && (
                  <div className="text-xs text-zinc-400">Runner-up</div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
