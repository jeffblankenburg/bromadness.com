'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Bracket {
  id: string
  name: string
  bracket_type: 'single' | 'double'
  status: string
  winner_id: string | null
}

interface Participant {
  id: string
  bracket_id: string
  user_id: string
  seed: number
  is_eliminated: boolean
  display_name: string
}

interface Match {
  id: string
  bracket_id: string
  round: number
  match_number: number
  bracket_side: 'winners' | 'losers' | 'finals'
  participant1_id: string | null
  participant2_id: string | null
  winner_id: string | null
  loser_goes_to_match_id: string | null
  winner_goes_to_match_id: string | null
  winner_is_slot1: boolean | null
}

interface Props {
  bracket: Bracket
  participants: Participant[]
  matches: Match[]
  isOwner: boolean
}

const MATCH_HEIGHT = 72
const MATCH_WIDTH = 150
const CONNECTOR_WIDTH = 24
const MATCH_GAP = 8

export function BracketDetailClient({ bracket, participants, matches, isOwner }: Props) {
  const router = useRouter()
  const [advancing, setAdvancing] = useState<string | null>(null)

  const getParticipant = (id: string | null): Participant | null => {
    if (!id) return null
    return participants.find(p => p.id === id) || null
  }

  const handleAdvance = async (matchId: string, winnerId: string) => {
    if (!isOwner || advancing) return

    setAdvancing(matchId)
    try {
      const res = await fetch(`/api/brackets/${bracket.id}/advance`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, winnerId }),
      })

      if (res.ok) {
        router.refresh()
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to advance winner')
      }
    } catch {
      alert('Failed to advance winner')
    } finally {
      setAdvancing(null)
    }
  }

  // Check if a match is a "bye" match (only one participant AND already auto-advanced)
  // This distinguishes true byes from matches waiting for an opponent
  const isByeMatch = (match: Match): boolean => {
    const p1 = getParticipant(match.participant1_id)
    const p2 = getParticipant(match.participant2_id)
    const hasOneParticipant = (p1 !== null && p2 === null) || (p1 === null && p2 !== null)
    // True bye: one participant + winner already set (auto-advanced during generation)
    return hasOneParticipant && match.winner_id !== null
  }

  // Group matches by bracket side and round
  const winnersMatches = matches.filter(m => m.bracket_side === 'winners')
  const losersMatches = matches.filter(m => m.bracket_side === 'losers')
  const finalsMatches = matches.filter(m => m.bracket_side === 'finals')

  const winnersRounds = [...new Set(winnersMatches.map(m => m.round))].sort((a, b) => a - b)
  const losersRounds = [...new Set(losersMatches.map(m => m.round))].sort((a, b) => a - b)

  const getMatchesForRound = (side: string, round: number) => {
    return matches
      .filter(m => m.bracket_side === side && m.round === round)
      .sort((a, b) => a.match_number - b.match_number)
  }

  const getRoundLabel = (round: number, totalRounds: number) => {
    if (round === totalRounds) return 'Final'
    if (round === totalRounds - 1) return 'Semis'
    if (round === totalRounds - 2) return 'Quarters'
    return `Round ${round}`
  }

  // Calculate bracket dimensions
  const round1Matches = getMatchesForRound('winners', 1)
  const bracketHeight = round1Matches.length * (MATCH_HEIGHT + MATCH_GAP)

  return (
    <div className="overflow-x-auto -mx-6 px-6 pb-4">
      {/* Winners Bracket */}
      <div className="mb-8">
        {bracket.bracket_type === 'double' && (
          <h3 className="text-sm font-bold text-zinc-400 uppercase mb-3">Winners Bracket</h3>
        )}

        <div className="flex" style={{ minWidth: winnersRounds.length * (MATCH_WIDTH + CONNECTOR_WIDTH) }}>
          {winnersRounds.map((round, roundIdx) => {
            const roundMatches = getMatchesForRound('winners', round)
            const matchSpacing = Math.pow(2, roundIdx)
            const initialOffset = (matchSpacing - 1) * (MATCH_HEIGHT + MATCH_GAP) / 2

            return (
              <div key={round} className="flex">
                {/* Round column */}
                <div className="flex flex-col" style={{ width: MATCH_WIDTH }}>
                  <div className="text-xs text-zinc-500 uppercase mb-2 text-center font-medium">
                    {getRoundLabel(round, winnersRounds.length)}
                  </div>
                  <div style={{ paddingTop: initialOffset }}>
                    {roundMatches.map((match, matchIdx) => (
                      <div
                        key={match.id}
                        style={{
                          marginBottom: matchIdx < roundMatches.length - 1
                            ? (matchSpacing - 1) * (MATCH_HEIGHT + MATCH_GAP) + MATCH_GAP
                            : 0
                        }}
                      >
                        <MatchCard
                          match={match}
                          getParticipant={getParticipant}
                          isOwner={isOwner}
                          isBye={isByeMatch(match)}
                          advancing={advancing}
                          onAdvance={handleAdvance}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Connector lines (except after last round) */}
                {roundIdx < winnersRounds.length - 1 && (
                  <div
                    className="relative"
                    style={{ width: CONNECTOR_WIDTH, marginTop: 28 + initialOffset }}
                  >
                    {roundMatches.map((match, matchIdx) => {
                      const isTop = matchIdx % 2 === 0
                      const pairIdx = Math.floor(matchIdx / 2)
                      const verticalSpan = matchSpacing * (MATCH_HEIGHT + MATCH_GAP)

                      return (
                        <div
                          key={match.id}
                          className="absolute"
                          style={{
                            top: matchIdx * matchSpacing * (MATCH_HEIGHT + MATCH_GAP) + MATCH_HEIGHT / 2 - 1,
                            left: 0,
                            width: CONNECTOR_WIDTH,
                          }}
                        >
                          {/* Horizontal line from match */}
                          <div
                            className="absolute bg-zinc-600"
                            style={{
                              left: 0,
                              top: 0,
                              width: CONNECTOR_WIDTH / 2,
                              height: 2,
                            }}
                          />
                          {/* Vertical line */}
                          {isTop && (
                            <div
                              className="absolute bg-zinc-600"
                              style={{
                                left: CONNECTOR_WIDTH / 2 - 1,
                                top: 0,
                                width: 2,
                                height: verticalSpan / 2 + 1,
                              }}
                            />
                          )}
                          {!isTop && (
                            <div
                              className="absolute bg-zinc-600"
                              style={{
                                left: CONNECTOR_WIDTH / 2 - 1,
                                top: -verticalSpan / 2 + 1,
                                width: 2,
                                height: verticalSpan / 2,
                              }}
                            />
                          )}
                          {/* Horizontal line to next match (only on bottom of pair) */}
                          {!isTop && (
                            <div
                              className="absolute bg-zinc-600"
                              style={{
                                left: CONNECTOR_WIDTH / 2 - 1,
                                top: -verticalSpan / 2 + 1,
                                width: CONNECTOR_WIDTH / 2 + 1,
                                height: 2,
                              }}
                            />
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Losers Bracket (Double Elimination) */}
      {bracket.bracket_type === 'double' && losersMatches.length > 0 && (
        <LosersBracket
          matches={losersMatches}
          allMatches={matches}
          getParticipant={getParticipant}
          isOwner={isOwner}
          isByeMatch={isByeMatch}
          advancing={advancing}
          onAdvance={handleAdvance}
        />
      )}

      {/* Grand Finals (Double Elimination) */}
      {finalsMatches.length > 0 && (
        <GrandFinals
          matches={finalsMatches}
          getParticipant={getParticipant}
          isOwner={isOwner}
          isByeMatch={isByeMatch}
          advancing={advancing}
          onAdvance={handleAdvance}
        />
      )}

      {/* Winner Display */}
      {bracket.status === 'completed' && bracket.winner_id && (
        <div className="mt-8 p-6 bg-gradient-to-r from-yellow-900/30 to-orange-900/30 rounded-xl text-center">
          <div className="text-sm text-yellow-400 uppercase mb-1">Champion</div>
          <div className="text-2xl font-bold text-white">
            {participants.find(p => p.user_id === bracket.winner_id)?.display_name || 'Unknown'}
          </div>
        </div>
      )}
    </div>
  )
}

function MatchCard({
  match,
  getParticipant,
  isOwner,
  isBye,
  advancing,
  onAdvance,
  isLosers = false,
  isFinals = false,
}: {
  match: Match
  getParticipant: (id: string | null) => Participant | null
  isOwner: boolean
  isBye: boolean
  advancing: string | null
  onAdvance: (matchId: string, winnerId: string) => void
  isLosers?: boolean
  isFinals?: boolean
}) {
  const p1 = getParticipant(match.participant1_id)
  const p2 = getParticipant(match.participant2_id)
  const isAdvancing = advancing === match.id

  // Can select if: owner, both participants present, not a bye
  // Allow changing picks even after winner is set
  const canSelect = isOwner && p1 && p2 && !isBye

  const getBorderColor = () => {
    if (isFinals) return 'border-yellow-600'
    if (isLosers) return 'border-red-900'
    return 'border-zinc-700'
  }

  return (
    <div
      className={`bg-zinc-800/50 rounded-lg border ${getBorderColor()} overflow-hidden`}
      style={{ width: MATCH_WIDTH, height: MATCH_HEIGHT }}
    >
      <ParticipantSlot
        participant={p1}
        isWinner={match.winner_id !== null && match.winner_id === match.participant1_id}
        isLoser={match.winner_id !== null && match.winner_id === match.participant2_id}
        isByeWinner={isBye && p1 !== null && p2 === null}
        canSelect={!!canSelect}
        isAdvancing={isAdvancing}
        onSelect={() => match.participant1_id && onAdvance(match.id, match.participant1_id)}
      />
      <div className="border-t border-zinc-700/50" />
      <ParticipantSlot
        participant={p2}
        isWinner={match.winner_id !== null && match.winner_id === match.participant2_id}
        isLoser={match.winner_id !== null && match.winner_id === match.participant1_id}
        isByeWinner={isBye && p2 !== null && p1 === null}
        canSelect={!!canSelect}
        isAdvancing={isAdvancing}
        onSelect={() => match.participant2_id && onAdvance(match.id, match.participant2_id)}
      />
    </div>
  )
}

// Grand Finals component with reset match support
function GrandFinals({
  matches,
  getParticipant,
  isOwner,
  isByeMatch,
  advancing,
  onAdvance,
}: {
  matches: Match[]
  getParticipant: (id: string | null) => Participant | null
  isOwner: boolean
  isByeMatch: (match: Match) => boolean
  advancing: string | null
  onAdvance: (matchId: string, winnerId: string) => void
}) {
  // Sort by round: GF1 (round 1) first, then GF2/Reset (round 2)
  const sortedMatches = [...matches].sort((a, b) => a.round - b.round)
  const gf1 = sortedMatches.find(m => m.round === 1)
  const gf2 = sortedMatches.find(m => m.round === 2)

  // Determine if reset is needed/active
  // Reset happens if losers bracket champion (participant2) wins GF1
  const gf1Winner = gf1?.winner_id
  const gf1Complete = gf1Winner !== null
  const losersChampWonGF1 = gf1Complete && gf1Winner === gf1?.participant2_id
  const resetNeeded = losersChampWonGF1
  const resetHasParticipants = gf2?.participant1_id !== null && gf2?.participant2_id !== null

  return (
    <div className="pt-6 border-t border-zinc-800">
      <h3 className="text-sm font-bold text-yellow-400 uppercase mb-3">Grand Finals</h3>

      <div className="flex gap-8 items-start">
        {/* GF1 */}
        {gf1 && (
          <div>
            <div className="text-xs text-zinc-500 mb-2 text-center">Match 1</div>
            <div className="text-[10px] text-zinc-600 mb-1 text-center">
              <span className="text-green-400/70">W</span> = Winners Champ
              {' · '}
              <span className="text-red-400/70">L</span> = Losers Champ
            </div>
            <MatchCard
              match={gf1}
              getParticipant={getParticipant}
              isOwner={isOwner}
              isBye={isByeMatch(gf1)}
              advancing={advancing}
              onAdvance={onAdvance}
              isFinals
            />
            {gf1Complete && !resetNeeded && (
              <div className="text-[10px] text-green-400 mt-1 text-center">
                Winners Champ wins!
              </div>
            )}
            {resetNeeded && (
              <div className="text-[10px] text-yellow-400 mt-1 text-center">
                Reset required →
              </div>
            )}
          </div>
        )}

        {/* Connector arrow */}
        {gf1 && gf2 && (resetNeeded || resetHasParticipants) && (
          <div className="flex items-center pt-8">
            <div className="w-8 h-0.5 bg-yellow-600/50" />
            <div className="text-yellow-600/50">→</div>
          </div>
        )}

        {/* GF2 (Reset) - only show if needed or has participants */}
        {gf2 && (resetNeeded || resetHasParticipants) && (
          <div>
            <div className="text-xs text-zinc-500 mb-2 text-center">Reset Match</div>
            <div className="text-[10px] text-zinc-600 mb-1 text-center italic">
              (if necessary)
            </div>
            <MatchCard
              match={gf2}
              getParticipant={getParticipant}
              isOwner={isOwner}
              isBye={isByeMatch(gf2)}
              advancing={advancing}
              onAdvance={onAdvance}
              isFinals
            />
          </div>
        )}

        {/* Show "if necessary" placeholder when GF1 not complete */}
        {gf2 && !gf1Complete && !resetHasParticipants && (
          <div className="opacity-40">
            <div className="text-xs text-zinc-500 mb-2 text-center">Reset Match</div>
            <div className="text-[10px] text-zinc-600 mb-1 text-center italic">
              (if necessary)
            </div>
            <div
              className="bg-zinc-800/30 rounded-lg border border-zinc-700/30 flex items-center justify-center text-zinc-600 text-sm"
              style={{ width: MATCH_WIDTH, height: MATCH_HEIGHT }}
            >
              Only if L wins
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function ParticipantSlot({
  participant,
  isWinner,
  isLoser,
  isByeWinner,
  canSelect,
  isAdvancing,
  onSelect,
}: {
  participant: Participant | null
  isWinner: boolean
  isLoser: boolean
  isByeWinner: boolean
  canSelect: boolean
  isAdvancing: boolean
  onSelect: () => void
}) {
  const height = (MATCH_HEIGHT - 1) / 2

  if (!participant) {
    return (
      <div
        className="px-3 flex items-center text-zinc-600 text-sm italic"
        style={{ height }}
      >
        {isByeWinner ? '' : 'TBD'}
      </div>
    )
  }

  const baseClasses = 'px-3 flex items-center gap-2 transition-colors'
  const stateClasses = isWinner
    ? 'bg-green-900/50 text-white font-medium'
    : isLoser
    ? 'bg-zinc-900/50 text-zinc-500'
    : isByeWinner
    ? 'bg-zinc-700/30 text-zinc-300'
    : 'text-zinc-200'
  const interactiveClasses = canSelect && !isAdvancing
    ? 'cursor-pointer hover:bg-zinc-700/50 active:bg-zinc-600/50'
    : ''

  return (
    <div
      className={`${baseClasses} ${stateClasses} ${interactiveClasses}`}
      style={{ height }}
      onClick={canSelect && !isAdvancing ? onSelect : undefined}
    >
      <span className="text-[10px] text-zinc-500 w-4 flex-shrink-0">{participant.seed}</span>
      <span className={`flex-1 truncate text-sm ${isLoser ? 'line-through' : ''}`}>
        {participant.display_name}
      </span>
      {isWinner && (
        <svg className="w-4 h-4 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      )}
      {isByeWinner && !isWinner && (
        <span className="text-[10px] text-zinc-500 flex-shrink-0">BYE</span>
      )}
    </div>
  )
}

// Losers Bracket Component - proper double elimination structure
function LosersBracket({
  matches,
  allMatches,
  getParticipant,
  isOwner,
  isByeMatch,
  advancing,
  onAdvance,
}: {
  matches: Match[]
  allMatches: Match[]
  getParticipant: (id: string | null) => Participant | null
  isOwner: boolean
  isByeMatch: (match: Match) => boolean
  advancing: string | null
  onAdvance: (matchId: string, winnerId: string) => void
}) {
  // Build a map of match connections
  const matchById = new Map<string, Match>()
  allMatches.forEach(m => matchById.set(m.id, m))

  // Find which winners bracket match sends its loser to each losers match
  const getDropInSource = (losersMatch: Match): Match | null => {
    for (const match of allMatches) {
      if (match.bracket_side === 'winners' && match.loser_goes_to_match_id === losersMatch.id) {
        return match
      }
    }
    return null
  }

  // Group losers matches by round
  const rounds = [...new Set(matches.map(m => m.round))].sort((a, b) => a - b)

  const getMatchesForRound = (round: number) => {
    return matches
      .filter(m => m.round === round)
      .sort((a, b) => a.match_number - b.match_number)
  }

  // Calculate round info for positioning
  // Each round tracks: matchCount, spacing multiplier, and vertical offset
  const round1Count = getMatchesForRound(rounds[0]).length

  interface RoundInfo {
    matchCount: number
    spacing: number    // Multiplier: how many "slots" between matches
    offset: number     // How many half-slots to offset from top
    isDropIn: boolean
  }

  const roundInfos: RoundInfo[] = []
  rounds.forEach((round, roundIdx) => {
    const matchCount = getMatchesForRound(round).length
    if (roundIdx === 0) {
      roundInfos.push({ matchCount, spacing: 1, offset: 0, isDropIn: false })
    } else {
      const prev = roundInfos[roundIdx - 1]
      const isDropIn = matchCount === prev.matchCount
      if (isDropIn) {
        roundInfos.push({ matchCount, spacing: prev.spacing, offset: prev.offset, isDropIn: true })
      } else {
        // Consolidation: center between pairs
        roundInfos.push({
          matchCount,
          spacing: prev.spacing * 2,
          offset: prev.offset + prev.spacing / 2,
          isDropIn: false,
        })
      }
    }
  })

  // Calculate slot positions using flexbox-friendly approach
  // "Slot" = the base unit (MATCH_HEIGHT + MATCH_GAP)
  const SLOT = MATCH_HEIGHT + MATCH_GAP
  const HEADER_HEIGHT = 28
  const DROP_LABEL_HEIGHT = 18
  const LABEL_PADDING = DROP_LABEL_HEIGHT // Extra space at top for drop-in labels

  // For each round, calculate where each match should be positioned (top of match box)
  // Add LABEL_PADDING to all positions to make room for drop-in labels
  const getMatchTopY = (roundIdx: number, matchIdx: number): number => {
    const info = roundInfos[roundIdx]
    return LABEL_PADDING + info.offset * SLOT + matchIdx * info.spacing * SLOT
  }

  // Total height based on round 1 (most matches) + label padding
  const totalContentHeight = LABEL_PADDING + round1Count * SLOT - MATCH_GAP

  return (
    <div className="mb-8 pt-6 border-t border-zinc-800">
      <h3 className="text-sm font-bold text-red-400 uppercase mb-3">Losers Bracket</h3>

      <div className="flex items-start">
        {rounds.map((round, roundIdx) => {
          const roundMatches = getMatchesForRound(round)
          const info = roundInfos[roundIdx]

          return (
            <div key={round} className="flex">
              {/* Round column */}
              <div style={{ width: MATCH_WIDTH }}>
                <div
                  className="text-xs text-zinc-500 uppercase text-center font-medium"
                  style={{ height: HEADER_HEIGHT, lineHeight: `${HEADER_HEIGHT}px` }}
                >
                  L-Round {round}
                </div>
                <div style={{ position: 'relative', height: totalContentHeight }}>
                  {roundMatches.map((match, matchIdx) => {
                    const dropInSource = info.isDropIn ? getDropInSource(match) : null
                    const topY = getMatchTopY(roundIdx, matchIdx)

                    return (
                      <div
                        key={match.id}
                        style={{
                          position: 'absolute',
                          top: topY,
                          left: 0,
                          width: MATCH_WIDTH,
                        }}
                      >
                        {/* Drop-in label - positioned above match */}
                        {info.isDropIn && dropInSource && (
                          <div
                            className="text-[10px] text-zinc-500 italic truncate absolute"
                            style={{
                              top: -DROP_LABEL_HEIGHT,
                              left: 0,
                              height: DROP_LABEL_HEIGHT,
                              lineHeight: `${DROP_LABEL_HEIGHT}px`
                            }}
                          >
                            Loser of W-R{dropInSource.round} M{dropInSource.match_number}
                          </div>
                        )}
                        <LosersMatchCard
                          match={match}
                          getParticipant={getParticipant}
                          isOwner={isOwner}
                          isBye={isByeMatch(match)}
                          advancing={advancing}
                          onAdvance={onAdvance}
                          dropInSource={dropInSource}
                          matchById={matchById}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Connector lines */}
              {roundIdx < rounds.length - 1 && (
                <LosersConnectorLines
                  roundIdx={roundIdx}
                  roundInfos={roundInfos}
                  totalContentHeight={totalContentHeight}
                  headerHeight={HEADER_HEIGHT}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Connector lines between losers bracket rounds
function LosersConnectorLines({
  roundIdx,
  roundInfos,
  totalContentHeight,
  headerHeight,
}: {
  roundIdx: number
  roundInfos: { matchCount: number; spacing: number; offset: number; isDropIn: boolean }[]
  totalContentHeight: number
  headerHeight: number
}) {
  const SLOT = MATCH_HEIGHT + MATCH_GAP
  const LABEL_PADDING = 18 // Must match the padding in LosersBracket
  const currentInfo = roundInfos[roundIdx]
  const nextInfo = roundInfos[roundIdx + 1]
  const isConsolidation = nextInfo.matchCount < currentInfo.matchCount

  // Calculate Y position for match center (including label padding)
  const getMatchCenterY = (info: typeof currentInfo, matchIdx: number): number => {
    return LABEL_PADDING + info.offset * SLOT + matchIdx * info.spacing * SLOT + MATCH_HEIGHT / 2
  }

  return (
    <div style={{ paddingTop: headerHeight }}>
      <svg
        width={CONNECTOR_WIDTH}
        height={totalContentHeight}
        style={{ display: 'block' }}
      >
        {Array.from({ length: currentInfo.matchCount }).map((_, matchIdx) => {
          const sourceY = getMatchCenterY(currentInfo, matchIdx)

          if (!isConsolidation) {
            // Straight line: 1:1 mapping
            const targetY = getMatchCenterY(nextInfo, matchIdx)
            return (
              <line
                key={matchIdx}
                x1={0}
                y1={sourceY}
                x2={CONNECTOR_WIDTH}
                y2={targetY}
                stroke="#7f1d1d"
                strokeWidth={2}
              />
            )
          }

          // Converging: 2:1 mapping (bracket style)
          const targetMatchIdx = Math.floor(matchIdx / 2)
          const targetY = getMatchCenterY(nextInfo, targetMatchIdx)
          const midX = CONNECTOR_WIDTH / 2

          return (
            <g key={matchIdx}>
              {/* Horizontal from source to midpoint */}
              <line
                x1={0}
                y1={sourceY}
                x2={midX}
                y2={sourceY}
                stroke="#7f1d1d"
                strokeWidth={2}
              />
              {/* Vertical from source to target level */}
              <line
                x1={midX}
                y1={sourceY}
                x2={midX}
                y2={targetY}
                stroke="#7f1d1d"
                strokeWidth={2}
              />
              {/* Horizontal from midpoint to target (only draw once per pair) */}
              {matchIdx % 2 === 1 && (
                <line
                  x1={midX}
                  y1={targetY}
                  x2={CONNECTOR_WIDTH}
                  y2={targetY}
                  stroke="#7f1d1d"
                  strokeWidth={2}
                />
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// Special match card for losers bracket that shows drop-in info
function LosersMatchCard({
  match,
  getParticipant,
  isOwner,
  isBye,
  advancing,
  onAdvance,
  dropInSource,
  matchById,
}: {
  match: Match
  getParticipant: (id: string | null) => Participant | null
  isOwner: boolean
  isBye: boolean
  advancing: string | null
  onAdvance: (matchId: string, winnerId: string) => void
  dropInSource: Match | null
  matchById: Map<string, Match>
}) {
  const p1 = getParticipant(match.participant1_id)
  const p2 = getParticipant(match.participant2_id)
  const isAdvancing = advancing === match.id
  // Allow changing picks even after winner is set
  const canSelect = isOwner && p1 && p2 && !isBye

  return (
    <div
      className="bg-zinc-800/50 rounded-lg border border-red-900/50 overflow-hidden"
      style={{ width: MATCH_WIDTH, height: MATCH_HEIGHT }}
    >
      <ParticipantSlot
        participant={p1}
        isWinner={match.winner_id !== null && match.winner_id === match.participant1_id}
        isLoser={match.winner_id !== null && match.winner_id === match.participant2_id}
        isByeWinner={isBye && p1 !== null && p2 === null}
        canSelect={!!canSelect}
        isAdvancing={isAdvancing}
        onSelect={() => match.participant1_id && onAdvance(match.id, match.participant1_id)}
      />
      <div className="border-t border-red-900/30" />
      <ParticipantSlot
        participant={p2}
        isWinner={match.winner_id !== null && match.winner_id === match.participant2_id}
        isLoser={match.winner_id !== null && match.winner_id === match.participant1_id}
        isByeWinner={isBye && p2 !== null && p1 === null}
        canSelect={!!canSelect}
        isAdvancing={isAdvancing}
        onSelect={() => match.participant2_id && onAdvance(match.id, match.participant2_id)}
      />
    </div>
  )
}

