'use client'

import { useState, useRef } from 'react'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
}

interface TeamEntry {
  id: string
  team_id: string
  bid_amount: number
  team: Team | null | undefined
}

interface DraftEntry {
  user: {
    id: string
    display_name: string | null
    phone: string
  }
  paidTeams: TeamEntry[]
  bonusTeams: TeamEntry[]
  totalSpent: number
  hasPaid: boolean
}

interface Props {
  draftBoard: DraftEntry[]
  teamsPerPlayer: number
  salaryCap: number
  entryFee: number
  currentThrowerIndex: number
}

interface PeekState {
  teamEntry: TeamEntry
  userName: string
  x: number
  y: number
  isFromFreeColumn: boolean
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

function truncateName(name: string | null, maxLen: number = 10): string {
  if (!name) return '?'
  return name.length > maxLen ? name.slice(0, maxLen) : name
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

export function DraftBoard({ draftBoard, teamsPerPlayer, salaryCap, entryFee, currentThrowerIndex }: Props) {
  const [peeking, setPeeking] = useState<PeekState | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const isPlayerDone = (idx: number) => draftBoard[idx].paidTeams.length >= teamsPerPlayer

  const handlePeekStart = (e: React.MouseEvent | React.TouchEvent, teamEntry: TeamEntry, userName: string, isFromFreeColumn: boolean = false) => {
    const target = e.currentTarget as HTMLElement
    const containerRect = containerRef.current?.getBoundingClientRect()
    const targetRect = target.getBoundingClientRect()

    if (containerRect) {
      // Position tooltip above the element
      const x = targetRect.left - containerRect.left + targetRect.width / 2
      const y = targetRect.top - containerRect.top
      setPeeking({ teamEntry, userName, x, y, isFromFreeColumn })
    }
  }

  const handlePeekEnd = () => {
    setPeeking(null)
  }

  const renderTeamBlock = (teamEntry: TeamEntry, userName: string, size: 'normal' | 'small' = 'normal', isFromFreeColumn: boolean = false) => {
    const d1Team = teamEntry.team ? findD1Team(teamEntry.team.name) : null
    const logo = d1Team ? getTeamLogoUrl(d1Team) : null
    const bgColor = d1Team?.primaryColor || '#3f3f46'

    const sizeClass = size === 'normal' ? 'w-11 h-11' : 'w-[21px] h-[21px]'
    const logoSize = size === 'normal' ? 'w-7 h-7' : 'w-3.5 h-3.5'

    return (
      <div
        key={teamEntry.id}
        onMouseDown={(e) => handlePeekStart(e, teamEntry, userName, isFromFreeColumn)}
        onMouseUp={handlePeekEnd}
        onMouseLeave={handlePeekEnd}
        onTouchStart={(e) => handlePeekStart(e, teamEntry, userName, isFromFreeColumn)}
        onTouchEnd={handlePeekEnd}
        className={`${sizeClass} rounded-sm flex items-center justify-center flex-shrink-0 cursor-pointer select-none`}
        style={{ backgroundColor: bgColor }}
      >
        {logo ? (
          <img
            src={logo}
            alt=""
            className={`${logoSize} object-contain pointer-events-none`}
            style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px white)' }}
            draggable={false}
          />
        ) : (
          <span className={`font-bold text-white pointer-events-none ${size === 'normal' ? 'text-xs' : 'text-[6px]'}`}>
            {d1Team?.abbreviation?.slice(0, 2) || teamEntry.team?.short_name?.slice(0, 2) || '?'}
          </span>
        )}
      </div>
    )
  }

  // Get peek info
  const peekD1Team = peeking?.teamEntry.team ? findD1Team(peeking.teamEntry.team.name) : null

  return (
    <div className="relative" ref={containerRef}>
      {/* Peek tooltip */}
      {peeking && (() => {
        const primary = peekD1Team?.primaryColor || '#52525b'
        const secondary = peekD1Team?.secondaryColor || '#27272a'
        const { bg: bgColor, border: borderColor } = getDarkerColor(primary, secondary)
        const textColor = getContrastColor(bgColor)
        const teamName = peekD1Team?.shortName || peeking.teamEntry.team?.short_name || peeking.teamEntry.team?.name

        // For free column, show tooltip above with arrow on bottom-right, extending left
        if (peeking.isFromFreeColumn) {
          return (
            <div
              className="absolute z-20 pointer-events-none"
              style={{
                left: peeking.x,
                top: peeking.y - 8,
                transform: 'translate(calc(-100% + 18px), -100%)'
              }}
            >
              <div
                className="rounded-lg px-3 py-2 text-sm whitespace-nowrap"
                style={{ backgroundColor: bgColor, border: `4px solid ${borderColor}`, color: textColor }}
              >
                <span className="font-semibold">#{peeking.teamEntry.team?.seed} {teamName}</span>
                <span className="mx-2">-</span>
                <span>{peeking.userName}</span>
                <span className="ml-2 font-semibold">${peeking.teamEntry.bid_amount}</span>
              </div>
              {/* Arrow at bottom-right, offset from corner like original */}
              <div className="flex justify-end pr-[18px]">
                <div
                  className="w-3 h-3 rotate-45 -mt-[7px]"
                  style={{ backgroundColor: bgColor, borderRight: `4px solid ${borderColor}`, borderBottom: `4px solid ${borderColor}` }}
                />
              </div>
            </div>
          )
        }

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
              <span className="font-semibold">#{peeking.teamEntry.team?.seed} {teamName}</span>
              <span className="mx-2">-</span>
              <span>{peeking.userName}</span>
              <span className="ml-2 font-semibold">${peeking.teamEntry.bid_amount}</span>
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

      {/* Draft Board Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-zinc-800">
              <th className="text-left px-1 py-1 text-zinc-400 font-medium text-[10px]">Player</th>
              {Array.from({ length: teamsPerPlayer }).map((_, i) => (
                <th key={i} className="px-0.5 py-1 text-zinc-400 font-medium text-[10px] w-12">
                  Team {i + 1}
                </th>
              ))}
              <th className="px-0.5 py-1 text-zinc-400 font-medium text-[10px]">Free Teams</th>
              <th className="text-right px-1 py-1 text-zinc-400 font-medium text-[10px]">Left</th>
            </tr>
          </thead>
          <tbody>
            {draftBoard.map((entry, idx) => {
              const isCurrentThrower = idx === currentThrowerIndex && !isPlayerDone(idx)
              const userName = entry.user.display_name || entry.user.phone
              return (
                <tr
                  key={entry.user.id}
                  className={idx % 2 === 0 ? 'bg-zinc-900/40' : 'bg-zinc-700/40'}
                >
                  <td className={`relative px-1 py-1 ${isCurrentThrower ? 'font-bold text-orange-400' : 'font-medium text-zinc-300'} text-[11px] whitespace-nowrap`}>
                    {!entry.hasPaid && (
                      <span className="absolute left-0 right-0 top-1/2 -translate-y-1/2 text-center text-red-500/20 text-[8px] font-black whitespace-nowrap tracking-widest pointer-events-none" style={{ width: '250%' }}>
                        PAY ${entryFee}
                      </span>
                    )}
                    <span className="relative">{truncateName(userName)}</span>
                  </td>
                  {/* Paid teams */}
                  {Array.from({ length: teamsPerPlayer }).map((_, i) => {
                    const teamEntry = entry.paidTeams[i]
                    return (
                      <td key={i} className="px-0.5 py-1">
                        {teamEntry ? (
                          renderTeamBlock(teamEntry, userName)
                        ) : (
                          <div className="w-11 h-11 rounded-sm bg-zinc-800/30 flex items-center justify-center">
                            <span className="text-zinc-700 text-xs">—</span>
                          </div>
                        )}
                      </td>
                    )
                  })}
                  {/* Bonus teams */}
                  <td className="px-0.5 py-1 align-top">
                    {entry.bonusTeams.length > 0 ? (
                      <div className="grid grid-cols-2 gap-0.5 w-11 h-11 content-start justify-start">
                        {entry.bonusTeams.map(bt => renderTeamBlock(bt, userName, 'small', true))}
                      </div>
                    ) : (
                      <div className="w-11 h-11 flex items-center justify-center">
                        <span className="text-zinc-800 text-xs">—</span>
                      </div>
                    )}
                  </td>
                  <td className="text-right px-1 py-1 text-white text-[11px] font-semibold whitespace-nowrap">
                    ${salaryCap - entry.totalSpent}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
