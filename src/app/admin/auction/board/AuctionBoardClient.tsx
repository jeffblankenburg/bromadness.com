'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface User {
  id: string
  display_name: string | null
  phone: string
}

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
  region_id: string
}

interface AuctionTeam {
  id: string
  user_id: string
  team_id: string
  bid_amount: number
}

interface AuctionEntry {
  id: string
  user_id: string
  is_participating: boolean
}

interface Props {
  tournamentId: string
  tournamentName: string
  salaryCap: number
  teamsPerPlayer: number
  auctionOrderSeed: string
  firstParticipantId: string | null
  users: User[]
  teams: Team[]
  initialAuctionTeams: AuctionTeam[]
  auctionEntries: AuctionEntry[]
}

// Same seeded shuffle used in the main auction page
function seededShuffle<T>(array: T[], seed: string): T[] {
  const result = [...array]
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i)
    hash = hash & hash
  }
  for (let i = result.length - 1; i > 0; i--) {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff
    const j = hash % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
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

export function AuctionBoardClient({
  tournamentId,
  salaryCap,
  teamsPerPlayer,
  auctionOrderSeed,
  firstParticipantId,
  users,
  teams,
  initialAuctionTeams,
  auctionEntries,
}: Props) {
  const [auctionTeams, setAuctionTeams] = useState<AuctionTeam[]>(initialAuctionTeams)
  const router = useRouter()

  // Subscribe to Realtime changes on auction_teams
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('auction-board')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'auction_teams',
          filter: `tournament_id=eq.${tournamentId}`,
        },
        () => {
          supabase
            .from('auction_teams')
            .select('id, user_id, team_id, bid_amount')
            .eq('tournament_id', tournamentId)
            .then(({ data }) => {
              if (data) {
                setAuctionTeams(data)
              }
            })
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tournamentId])

  // Poll fallback
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 10000)
    return () => clearInterval(interval)
  }, [router])

  // Sync props on server refresh
  useEffect(() => {
    setAuctionTeams(initialAuctionTeams)
  }, [initialAuctionTeams])

  // Get participating users
  const participatingUserIds = new Set(
    auctionEntries.filter(e => e.is_participating).map(e => e.user_id)
  )
  const participants = users.filter(u => participatingUserIds.has(u.id))

  // Build participant data
  const participantData = participants.map(user => {
    const userTeams = auctionTeams
      .filter(a => a.user_id === user.id)
      .map(a => {
        const team = teams.find(t => t.id === a.team_id)
        return { ...a, team }
      })
      .sort((a, b) => (b.bid_amount || 0) - (a.bid_amount || 0))

    const totalSpent = userTeams.reduce((sum, t) => sum + t.bid_amount, 0)

    return {
      user,
      allTeams: userTeams,
      totalSpent,
      remaining: salaryCap - totalSpent,
    }
  })

  // Compute draft order
  const draftOrder = (() => {
    if (firstParticipantId) {
      const first = participants.find(u => u.id === firstParticipantId)
      const rest = participants.filter(u => u.id !== firstParticipantId)
      const shuffledRest = seededShuffle(rest, auctionOrderSeed)
      return first ? [first, ...shuffledRest] : seededShuffle(participants, auctionOrderSeed)
    }
    return seededShuffle(participants, auctionOrderSeed)
  })()

  // Sort participant data by draft order
  const draftOrderIndex = new Map(draftOrder.map((u, i) => [u.id, i]))
  participantData.sort((a, b) =>
    (draftOrderIndex.get(a.user.id) ?? 99) - (draftOrderIndex.get(b.user.id) ?? 99)
  )

  const getPaidTeamCount = (userId: string) =>
    auctionTeams.filter(a => a.user_id === userId && a.bid_amount > 0).length

  const isPlayerDone = (userId: string) => getPaidTeamCount(userId) >= teamsPerPlayer

  const totalPaidTeams = draftOrder.reduce((sum, u) => sum + getPaidTeamCount(u.id), 0)

  const truncName = (user: User) => {
    const full = user.display_name || user.phone
    return full.length > 10 ? full.slice(0, 10) : full
  }

  // Find current thrower and on-deck
  const getNextTwoThrowers = () => {
    if (draftOrder.length === 0) return { currentId: null, currentName: null, onDeckName: null }

    let baseIndex = totalPaidTeams % draftOrder.length
    let attempts = 0
    while (isPlayerDone(draftOrder[baseIndex].id) && attempts < draftOrder.length) {
      baseIndex = (baseIndex + 1) % draftOrder.length
      attempts++
    }
    if (attempts >= draftOrder.length) return { currentId: null, currentName: null, onDeckName: null }

    const currentId = draftOrder[baseIndex].id
    const currentName = truncName(draftOrder[baseIndex])

    // Find next non-done player after current
    let deckIndex = (baseIndex + 1) % draftOrder.length
    let deckAttempts = 0
    while (deckIndex !== baseIndex && deckAttempts < draftOrder.length) {
      if (!isPlayerDone(draftOrder[deckIndex].id)) {
        return { currentId, currentName, onDeckName: truncName(draftOrder[deckIndex]) }
      }
      deckIndex = (deckIndex + 1) % draftOrder.length
      deckAttempts++
    }

    return { currentId, currentName, onDeckName: null }
  }

  const { currentId, currentName: currentThrowerName, onDeckName } = getNextTwoThrowers()

  // Split participants into three rows
  const colsPerRow = Math.ceil(participantData.length / 3)
  const row1 = participantData.slice(0, colsPerRow)
  const row2 = participantData.slice(colsPerRow, colsPerRow * 2)
  const row3 = participantData.slice(colsPerRow * 2)
  const lastRowHasEmpty = row3.length < colsPerRow

  const renderParticipant = ({ user, allTeams, remaining }: typeof participantData[0]) => {
    const fullName = user.display_name || user.phone
    const name = fullName.length > 10 ? fullName.slice(0, 10) : fullName
    const isCurrent = user.id === currentId

    return (
      <div
        key={user.id}
        className={`flex flex-col min-h-0 border-r border-zinc-800/40 last:border-r-0 ${isCurrent ? 'bg-white/10' : ''}`}
      >
        {/* Name + Balance stacked */}
        <div className={`px-3 py-1.5 border-b flex-shrink-0 text-center ${isCurrent ? 'bg-white/20 border-white/30' : 'bg-zinc-900/80 border-zinc-800/40'}`}>
          <div className="font-bold text-white text-2xl leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
            {name}
          </div>
          <div className="font-black text-3xl leading-tight text-orange-400" style={{ fontFamily: 'var(--font-display)' }}>
            ${remaining}
          </div>
        </div>

        {/* Team list */}
        <div className="flex-1 min-h-0 flex flex-col gap-px p-px bg-zinc-900/30">
          {allTeams.map(entry => {
            if (!entry.team) return null
            const d1Team = findD1Team(entry.team.name)
            const logo = d1Team ? getTeamLogoUrl(d1Team) : null
            const bgColor = d1Team?.primaryColor || '#3f3f46'
            const textColor = getContrastColor(bgColor)
            const isFree = entry.bid_amount === 0

            return (
              <div
                key={entry.id}
                className="flex items-center gap-2 px-2 py-1 flex-shrink-0"
                style={{ backgroundColor: bgColor }}
              >
                {logo ? (
                  <img
                    src={logo}
                    alt=""
                    className="w-7 h-7 object-contain flex-shrink-0"
                    style={{ filter: 'drop-shadow(0 0 1px white)' }}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-full bg-black/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[10px] font-bold" style={{ color: textColor }}>
                      {d1Team?.abbreviation?.slice(0, 3) || '?'}
                    </span>
                  </div>
                )}
                <span className="text-sm font-bold truncate flex-1" style={{ color: textColor }}>
                  {d1Team?.shortName || entry.team.short_name || entry.team.name}
                </span>
                <span className="text-xs font-bold font-mono flex-shrink-0" style={{ color: textColor, opacity: isFree ? 0.5 : 0.85 }}>
                  {isFree ? 'FREE' : `$${entry.bid_amount}`}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      {[row1, row2].map((row, i) => (
        <div
          key={i}
          className="flex-1 grid min-h-0 border-b border-zinc-700"
          style={{ gridTemplateColumns: `repeat(${colsPerRow}, 1fr)` }}
        >
          {row.map(renderParticipant)}
        </div>
      ))}

      {/* Bottom row with optional "Next Up" block */}
      <div
        className="flex-1 grid min-h-0"
        style={{ gridTemplateColumns: `repeat(${colsPerRow}, 1fr)` }}
      >
        {row3.map(renderParticipant)}
        {lastRowHasEmpty && currentThrowerName && (
          <div className="flex items-center justify-center bg-orange-500" style={{ gridColumn: `span ${colsPerRow - row3.length}` }}>
            <div className="text-center">
              <div className="text-black text-lg font-bold uppercase tracking-wider opacity-60" style={{ fontFamily: 'var(--font-display)' }}>
                Next Up
              </div>
              <div className="text-black text-5xl font-black leading-tight" style={{ fontFamily: 'var(--font-display)' }}>
                {currentThrowerName}
              </div>
              {onDeckName && (
                <>
                  <div className="text-black text-sm font-bold uppercase tracking-wider opacity-40 mt-4" style={{ fontFamily: 'var(--font-display)' }}>
                    On Deck
                  </div>
                  <div className="text-black text-2xl font-black leading-tight opacity-70" style={{ fontFamily: 'var(--font-display)' }}>
                    {onDeckName}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
