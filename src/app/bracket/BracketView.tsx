'use client'

import { useState } from 'react'

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
}

interface Game {
  id: string
  round: number
  region_id: string | null
  game_number: number
  team1_id: string | null
  team2_id: string | null
  winner_id: string | null
  team1_score: number | null
  team2_score: number | null
}

interface Tournament {
  id: string
  name: string
  year: number
}

interface Pick {
  game_id: string
  picked_team_id: string
}

type ViewMode = 'brocket' | 'auction' | 'pickem'

interface Props {
  tournament: Tournament
  regions: Region[]
  teams: Team[]
  games: Game[]
  pickemPicks?: Pick[]
  brocketPicks?: Pick[]
  teamOwners?: Record<string, string>
}

// Constants for layout
const MATCHUP_WIDTH = 115
const MATCHUP_HEIGHT = 48
const CONNECTOR_WIDTH = 24
const MATCHUP_GAP = 8
const LABEL_HEIGHT = 24

// Total height of a region (8 R1 matchups with 7 gaps)
const REGION_HEIGHT = 8 * MATCHUP_HEIGHT + 7 * MATCHUP_GAP // 440px

// Team slot component - a single team in a matchup
function TeamSlot({
  team,
  seed,
  score,
  isWinner,
  isLoser,
  isPicked,
  ownerName,
  viewMode,
  isTop,
}: {
  team: Team | null | undefined
  seed?: number
  score?: number | null
  isWinner: boolean
  isLoser: boolean
  isPicked: boolean
  ownerName?: string
  viewMode: ViewMode
  isTop: boolean
}) {
  const displayName = team
    ? viewMode === 'auction'
      ? ownerName || team.short_name || team.name
      : team.short_name || team.name
    : ''

  const showPickIndicator = isPicked && (viewMode === 'brocket' || viewMode === 'pickem')

  return (
    <div
      className={`
        flex items-center h-6 px-1.5 text-[11px]
        ${isTop ? 'border-b border-zinc-700' : ''}
        ${isWinner ? 'bg-green-900/40 font-semibold' : ''}
        ${isLoser && team ? 'text-zinc-500 line-through decoration-zinc-600' : ''}
      `}
    >
      {seed !== undefined && (
        <span className="w-4 text-[10px] text-zinc-500 flex-shrink-0">{seed}</span>
      )}
      <span className={`flex-1 truncate ${isWinner ? 'text-white' : 'text-zinc-300'}`}>
        {displayName}
      </span>
      {showPickIndicator && viewMode === 'brocket' && (
        <svg className="w-3 h-3 flex-shrink-0 text-orange-400 mx-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
        </svg>
      )}
      {showPickIndicator && viewMode === 'pickem' && (
        <svg className="w-3 h-3 flex-shrink-0 text-orange-400 mx-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      )}
      {viewMode === 'auction' && ownerName && (
        <img src="/auction.svg" alt="Auction" className="w-3 h-3 flex-shrink-0 mx-0.5 brightness-0 invert opacity-70" />
      )}
      {score !== undefined && score !== null && (
        <span className={`w-5 text-right text-[10px] flex-shrink-0 ${isWinner ? 'text-white font-bold' : 'text-zinc-500'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

// Matchup component - two teams facing each other
function Matchup({
  game,
  teams,
  brocketPicks,
  pickemPicks,
  teamOwners,
  viewMode,
  showSeeds = true,
}: {
  game: Game | undefined
  teams: Team[]
  brocketPicks: Pick[]
  pickemPicks: Pick[]
  teamOwners: Record<string, string>
  viewMode: ViewMode
  showSeeds?: boolean
}) {
  const getTeam = (teamId: string | null) =>
    teamId ? teams.find(t => t.id === teamId) : null

  const isPicked = (teamId: string | null, round: number) => {
    if (!game?.id || !teamId) return false
    if (viewMode === 'brocket') {
      if (round !== 1) return false
      return brocketPicks.some(p => p.game_id === game.id && p.picked_team_id === teamId)
    } else if (viewMode === 'pickem') {
      return pickemPicks.some(p => p.game_id === game.id && p.picked_team_id === teamId)
    }
    return false
  }

  const team1 = getTeam(game?.team1_id || null)
  const team2 = getTeam(game?.team2_id || null)
  const hasWinner = !!game?.winner_id
  const team1IsWinner = game?.winner_id === game?.team1_id && hasWinner
  const team2IsWinner = game?.winner_id === game?.team2_id && hasWinner
  const team1IsLoser = hasWinner && !team1IsWinner
  const team2IsLoser = hasWinner && !team2IsWinner

  return (
    <div
      className="bg-zinc-900 border border-zinc-700 rounded overflow-hidden flex-shrink-0"
      style={{ width: MATCHUP_WIDTH, height: MATCHUP_HEIGHT }}
    >
      <TeamSlot
        team={team1}
        seed={showSeeds ? team1?.seed : undefined}
        score={game?.team1_score}
        isWinner={team1IsWinner}
        isLoser={team1IsLoser}
        isPicked={isPicked(game?.team1_id || null, game?.round || 1)}
        ownerName={game?.team1_id ? teamOwners[game.team1_id] : undefined}
        viewMode={viewMode}
        isTop={true}
      />
      <TeamSlot
        team={team2}
        seed={showSeeds ? team2?.seed : undefined}
        score={game?.team2_score}
        isWinner={team2IsWinner}
        isLoser={team2IsLoser}
        isPicked={isPicked(game?.team2_id || null, game?.round || 1)}
        ownerName={game?.team2_id ? teamOwners[game.team2_id] : undefined}
        viewMode={viewMode}
        isTop={false}
      />
    </div>
  )
}

// Region bracket component with precise positioning
function RegionBracket({
  region,
  games,
  teams,
  brocketPicks,
  pickemPicks,
  teamOwners,
  viewMode,
  direction,
}: {
  region: Region
  games: Game[]
  teams: Team[]
  brocketPicks: Pick[]
  pickemPicks: Pick[]
  teamOwners: Record<string, string>
  viewMode: ViewMode
  direction: 'right' | 'left'
}) {
  const regionGames = games.filter(g => g.region_id === region.id)

  const getGamesForRound = (round: number) =>
    regionGames.filter(g => g.round === round).sort((a, b) => a.game_number - b.game_number)

  const r1Games = getGamesForRound(1)
  const r2Games = getGamesForRound(2)
  const r3Games = getGamesForRound(3)
  const r4Games = getGamesForRound(4)

  const isRight = direction === 'right'

  // Calculate Y positions for each round's matchups
  // R1: 8 matchups at fixed positions
  const r1Tops = Array.from({ length: 8 }, (_, i) => i * (MATCHUP_HEIGHT + MATCHUP_GAP))
  const r1Centers = r1Tops.map(top => top + MATCHUP_HEIGHT / 2)

  // R2: 4 matchups, each centered between 2 R1 matchups
  const r2Centers = [0, 1, 2, 3].map(i => (r1Centers[i * 2] + r1Centers[i * 2 + 1]) / 2)
  const r2Tops = r2Centers.map(c => c - MATCHUP_HEIGHT / 2)

  // R3: 2 matchups, each centered between 2 R2 matchups
  const r3Centers = [0, 1].map(i => (r2Centers[i * 2] + r2Centers[i * 2 + 1]) / 2)
  const r3Tops = r3Centers.map(c => c - MATCHUP_HEIGHT / 2)

  // R4: 1 matchup, centered between 2 R3 matchups
  const r4Center = (r3Centers[0] + r3Centers[1]) / 2
  const r4Top = r4Center - MATCHUP_HEIGHT / 2

  // Render a matchup at absolute position
  const renderMatchup = (game: Game, top: number, showSeeds: boolean) => (
    <div key={game.id} className="absolute" style={{ top }}>
      <Matchup
        game={game}
        teams={teams}
        brocketPicks={brocketPicks}
        pickemPicks={pickemPicks}
        teamOwners={teamOwners}
        viewMode={viewMode}
        showSeeds={showSeeds}
      />
    </div>
  )

  // Render connector lines between two matchups leading to one
  const renderConnector = (
    fromCenter1: number,
    fromCenter2: number,
    toCenter: number,
  ) => {
    const minY = Math.min(fromCenter1, fromCenter2)
    const maxY = Math.max(fromCenter1, fromCenter2)

    return (
      <svg
        width={CONNECTOR_WIDTH}
        height={REGION_HEIGHT}
        className="absolute top-0 left-0"
        style={{ overflow: 'visible' }}
      >
        {/* Horizontal line from first matchup */}
        <line
          x1={isRight ? 0 : CONNECTOR_WIDTH}
          y1={fromCenter1}
          x2={CONNECTOR_WIDTH / 2}
          y2={fromCenter1}
          stroke="#52525b"
          strokeWidth={1}
        />
        {/* Horizontal line from second matchup */}
        <line
          x1={isRight ? 0 : CONNECTOR_WIDTH}
          y1={fromCenter2}
          x2={CONNECTOR_WIDTH / 2}
          y2={fromCenter2}
          stroke="#52525b"
          strokeWidth={1}
        />
        {/* Vertical line connecting them */}
        <line
          x1={CONNECTOR_WIDTH / 2}
          y1={minY}
          x2={CONNECTOR_WIDTH / 2}
          y2={maxY}
          stroke="#52525b"
          strokeWidth={1}
        />
        {/* Horizontal line to next round */}
        <line
          x1={CONNECTOR_WIDTH / 2}
          y1={toCenter}
          x2={isRight ? CONNECTOR_WIDTH : 0}
          y2={toCenter}
          stroke="#52525b"
          strokeWidth={1}
        />
      </svg>
    )
  }

  // Build columns
  const round1Column = (
    <div className="relative" style={{ width: MATCHUP_WIDTH, height: REGION_HEIGHT }}>
      {r1Games.map((game, i) => renderMatchup(game, r1Tops[i], true))}
    </div>
  )

  const connector1Column = (
    <div className="relative" style={{ width: CONNECTOR_WIDTH, height: REGION_HEIGHT }}>
      {[0, 1, 2, 3].map(i => (
        <div key={i}>
          {renderConnector(r1Centers[i * 2], r1Centers[i * 2 + 1], r2Centers[i])}
        </div>
      ))}
    </div>
  )

  const round2Column = (
    <div className="relative" style={{ width: MATCHUP_WIDTH, height: REGION_HEIGHT }}>
      {r2Games.map((game, i) => renderMatchup(game, r2Tops[i], false))}
    </div>
  )

  const connector2Column = (
    <div className="relative" style={{ width: CONNECTOR_WIDTH, height: REGION_HEIGHT }}>
      {[0, 1].map(i => (
        <div key={i}>
          {renderConnector(r2Centers[i * 2], r2Centers[i * 2 + 1], r3Centers[i])}
        </div>
      ))}
    </div>
  )

  const round3Column = (
    <div className="relative" style={{ width: MATCHUP_WIDTH, height: REGION_HEIGHT }}>
      {r3Games.map((game, i) => renderMatchup(game, r3Tops[i], false))}
    </div>
  )

  const connector3Column = (
    <div className="relative" style={{ width: CONNECTOR_WIDTH, height: REGION_HEIGHT }}>
      {renderConnector(r3Centers[0], r3Centers[1], r4Center)}
    </div>
  )

  const round4Column = (
    <div className="relative" style={{ width: MATCHUP_WIDTH, height: REGION_HEIGHT }}>
      {r4Games.map((game) => renderMatchup(game, r4Top, false))}
    </div>
  )

  // Arrange columns based on direction
  const columns = isRight
    ? [round1Column, connector1Column, round2Column, connector2Column, round3Column, connector3Column, round4Column]
    : [round4Column, connector3Column, round3Column, connector2Column, round2Column, connector1Column, round1Column]

  return (
    <div>
      {/* Region name */}
      <div
        className="text-xs font-bold text-orange-400 uppercase tracking-wide mb-2"
        style={{
          fontFamily: 'var(--font-display)',
          textAlign: isRight ? 'left' : 'right',
          paddingLeft: isRight ? 0 : undefined,
          paddingRight: !isRight ? 0 : undefined,
        }}
      >
        {region.name}
      </div>
      {/* Region bracket */}
      <div className="flex">
        {columns.map((col, idx) => (
          <div key={idx}>{col}</div>
        ))}
      </div>
    </div>
  )
}

// Connector from Elite Eight to Final Four
function FinalFourConnector({
  direction,
  region1R4Center,
  region2R4Center,
  finalFourY,
  totalHeight,
}: {
  direction: 'right' | 'left'
  region1R4Center: number // Y position of top region's Elite 8 center
  region2R4Center: number // Y position of bottom region's Elite 8 center
  finalFourY: number // Y position of the Final Four game center
  totalHeight: number
}) {
  const isRight = direction === 'right'

  // Calculate the vertical line extent - must include all connection points
  const minY = Math.min(region1R4Center, region2R4Center, finalFourY)
  const maxY = Math.max(region1R4Center, region2R4Center, finalFourY)

  return (
    <svg
      width={CONNECTOR_WIDTH}
      height={totalHeight}
      className="flex-shrink-0"
      style={{ display: 'block' }}
    >
      {/* Horizontal line from top region's Elite 8 */}
      <line
        x1={isRight ? 0 : CONNECTOR_WIDTH}
        y1={region1R4Center}
        x2={CONNECTOR_WIDTH / 2}
        y2={region1R4Center}
        stroke="#52525b"
        strokeWidth={1}
      />
      {/* Horizontal line from bottom region's Elite 8 */}
      <line
        x1={isRight ? 0 : CONNECTOR_WIDTH}
        y1={region2R4Center}
        x2={CONNECTOR_WIDTH / 2}
        y2={region2R4Center}
        stroke="#52525b"
        strokeWidth={1}
      />
      {/* Vertical line connecting all points */}
      <line
        x1={CONNECTOR_WIDTH / 2}
        y1={minY}
        x2={CONNECTOR_WIDTH / 2}
        y2={maxY}
        stroke="#52525b"
        strokeWidth={1}
      />
      {/* Horizontal line to Final Four */}
      <line
        x1={CONNECTOR_WIDTH / 2}
        y1={finalFourY}
        x2={isRight ? CONNECTOR_WIDTH : 0}
        y2={finalFourY}
        stroke="#52525b"
        strokeWidth={1}
      />
    </svg>
  )
}

export function BracketView({
  tournament,
  regions,
  teams,
  games,
  pickemPicks = [],
  brocketPicks = [],
  teamOwners = {},
}: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('pickem')

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  // Positions 1,2 on left, 3,4 on right
  const leftRegions = sortedRegions.filter(r => r.position <= 2)
  const rightRegions = sortedRegions.filter(r => r.position > 2)

  const finalFourGames = games.filter(g => g.round === 5).sort((a, b) => a.game_number - b.game_number)
  const championshipGame = games.find(g => g.round === 6)

  // Get champion
  const getTeam = (teamId: string | null) =>
    teamId ? teams.find(t => t.id === teamId) : null
  const champion = getTeam(championshipGame?.winner_id || null)

  // Center column width
  const centerWidth = MATCHUP_WIDTH + 60

  // Calculate Y positions for Final Four connectors
  // R4 center within a region is at the vertical center of REGION_HEIGHT
  const r4CenterInRegion = REGION_HEIGHT / 2

  // Gap between regions + label height (text-xs ~16px + mb-2 8px = ~24px)
  const regionGap = 32
  const labelHeight = 28 // label text + margin

  // Total height of left/right side (2 regions + gap + 2 labels)
  const sideHeight = REGION_HEIGHT * 2 + regionGap + labelHeight * 2

  // Y positions of R4 centers relative to the side container
  const region1R4Center = labelHeight + r4CenterInRegion
  const region2R4Center = labelHeight + REGION_HEIGHT + regionGap + labelHeight + r4CenterInRegion

  // Final Four and Championship positions - spread out vertically
  // These are the Y positions where the connector lines should point (matchup centers)
  const ff1Center = sideHeight * 0.25 // Final Four Game 1 (top)
  const centerMidpoint = sideHeight / 2 // Championship (middle)
  const ff2Center = sideHeight * 0.75 // Final Four Game 2 (bottom)
  const labelOffset = 20 // Space taken by label above each matchup

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 pt-safe border-b border-zinc-800 bg-black z-10">
        <h1
          className="flex-1 text-lg font-bold text-white uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {tournament.year} Bracket
        </h1>
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('brocket')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              viewMode === 'brocket' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Brocket
          </button>
          <button
            onClick={() => setViewMode('auction')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              viewMode === 'auction' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Auction
          </button>
          <button
            onClick={() => setViewMode('pickem')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              viewMode === 'pickem' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Pick'em
          </button>
        </div>
      </div>

      {/* Scrollable Bracket */}
      <div className="flex-1 overflow-auto">
        <div className="inline-block p-8 pb-16 min-w-full">
          {/* Main bracket */}
          <div className="flex items-start">
            {/* LEFT SIDE - Two regions stacked */}
            <div className="flex flex-col" style={{ gap: regionGap }}>
              {leftRegions.map(region => (
                <RegionBracket
                  key={region.id}
                  region={region}
                  games={games}
                  teams={teams}
                  brocketPicks={brocketPicks}
                  pickemPicks={pickemPicks}
                  teamOwners={teamOwners}
                  viewMode={viewMode}
                  direction="right"
                />
              ))}
            </div>

            {/* LEFT CONNECTOR - Elite 8 to Final Four */}
            <FinalFourConnector
              direction="right"
              region1R4Center={region1R4Center}
              region2R4Center={region2R4Center}
              finalFourY={ff1Center}
              totalHeight={sideHeight}
            />

            {/* CENTER - Final Four & Championship */}
            <div
              className="relative flex-shrink-0"
              style={{ width: centerWidth, height: sideHeight }}
            >
              {/* Final Four Game 1 */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: ff1Center - labelOffset - MATCHUP_HEIGHT / 2 }}
              >
                <div
                  className="text-xs font-bold text-orange-400 uppercase tracking-wide whitespace-nowrap text-center mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Final Four
                </div>
                <Matchup
                  game={finalFourGames[0]}
                  teams={teams}
                  brocketPicks={brocketPicks}
                  pickemPicks={pickemPicks}
                  teamOwners={teamOwners}
                  viewMode={viewMode}
                  showSeeds={false}
                />
              </div>

              {/* Championship */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: centerMidpoint - labelOffset - MATCHUP_HEIGHT / 2 }}
              >
                <div
                  className="text-xs font-bold text-yellow-400 uppercase tracking-wide whitespace-nowrap text-center mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Championship
                </div>
                <Matchup
                  game={championshipGame}
                  teams={teams}
                  brocketPicks={brocketPicks}
                  pickemPicks={pickemPicks}
                  teamOwners={teamOwners}
                  viewMode={viewMode}
                  showSeeds={false}
                />
                {champion && (
                  <div className="text-center mt-2">
                    <div className="text-[10px] text-zinc-500 uppercase">Champion</div>
                    <div className="text-sm font-bold text-yellow-400">{champion.name}</div>
                  </div>
                )}
              </div>

              {/* Final Four Game 2 */}
              <div
                className="absolute left-1/2 -translate-x-1/2"
                style={{ top: ff2Center - labelOffset - MATCHUP_HEIGHT / 2 }}
              >
                <div
                  className="text-xs font-bold text-orange-400 uppercase tracking-wide whitespace-nowrap text-center mb-1"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  Final Four
                </div>
                <Matchup
                  game={finalFourGames[1]}
                  teams={teams}
                  brocketPicks={brocketPicks}
                  pickemPicks={pickemPicks}
                  teamOwners={teamOwners}
                  viewMode={viewMode}
                  showSeeds={false}
                />
              </div>
            </div>

            {/* RIGHT CONNECTOR - Final Four to Elite 8 */}
            <FinalFourConnector
              direction="left"
              region1R4Center={region1R4Center}
              region2R4Center={region2R4Center}
              finalFourY={ff2Center}
              totalHeight={sideHeight}
            />

            {/* RIGHT SIDE - Two regions stacked */}
            <div className="flex flex-col" style={{ gap: regionGap }}>
              {rightRegions.map(region => (
                <RegionBracket
                  key={region.id}
                  region={region}
                  games={games}
                  teams={teams}
                  brocketPicks={brocketPicks}
                  pickemPicks={pickemPicks}
                  teamOwners={teamOwners}
                  viewMode={viewMode}
                  direction="left"
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
