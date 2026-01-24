'use client'

import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch'
import Link from 'next/link'

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

interface Props {
  tournament: Tournament
  regions: Region[]
  teams: Team[]
  games: Game[]
}

const CELL_HEIGHT = 24 // Height of each cell row
const GAME_WIDTH = 110 // Width of game slot
const CONNECTOR_WIDTH = 16 // Width for connector lines

// Single team cell in a game
function TeamCell({
  team,
  score,
  isWinner,
  borderBottom = false,
  borderRight = false,
  borderLeft = false,
}: {
  team: Team | null | undefined
  score: number | null | undefined
  isWinner: boolean
  borderBottom?: boolean
  borderRight?: boolean
  borderLeft?: boolean
}) {
  const borderClasses = [
    borderBottom ? 'border-b border-zinc-500' : '',
    borderRight ? 'border-r border-zinc-500' : '',
    borderLeft ? 'border-l border-zinc-500' : '',
  ].filter(Boolean).join(' ')

  // Only show winner styling if there's actually a team
  const showAsWinner = isWinner && team

  // If no team, render empty cell
  if (!team) {
    return (
      <div
        className={`${borderClasses}`}
        style={{ height: CELL_HEIGHT, width: GAME_WIDTH }}
      />
    )
  }

  return (
    <div
      className={`flex items-center gap-1 px-1 ${showAsWinner ? 'bg-green-900/50' : ''} ${borderClasses}`}
      style={{ height: CELL_HEIGHT, width: GAME_WIDTH }}
    >
      <span className="text-[9px] text-zinc-500 w-3 text-center flex-shrink-0">
        {team.seed}
      </span>
      <span className={`text-[10px] flex-1 truncate ${showAsWinner ? 'text-white font-semibold' : 'text-zinc-300'}`}>
        {team.short_name || team.name}
      </span>
      {score != null && (
        <span className={`text-[9px] flex-shrink-0 ${showAsWinner ? 'text-white font-bold' : 'text-zinc-500'}`}>
          {score}
        </span>
      )}
    </div>
  )
}

// Empty cell for spacing with optional borders
function EmptyCell({
  width = GAME_WIDTH,
  borderBottom = false,
  borderRight = false,
  borderLeft = false,
}: {
  width?: number
  borderBottom?: boolean
  borderRight?: boolean
  borderLeft?: boolean
}) {
  const borderClasses = [
    borderBottom ? 'border-b border-zinc-500' : '',
    borderRight ? 'border-r border-zinc-500' : '',
    borderLeft ? 'border-l border-zinc-500' : '',
  ].filter(Boolean).join(' ')

  return <div className={borderClasses} style={{ height: CELL_HEIGHT, width }} />
}

// Region bracket using table-like structure with borders
function RegionBracket({
  region,
  games,
  teams,
  flowDirection = 'right'
}: {
  region: Region
  games: Game[]
  teams: Team[]
  flowDirection?: 'left' | 'right'
}) {
  const regionGames = games.filter(g => g.region_id === region.id)
  const regionTeams = teams.filter(t => t.region_id === region.id)

  const getGamesForRound = (round: number) =>
    regionGames.filter(g => g.round === round).sort((a, b) => a.game_number - b.game_number)

  const getTeam = (teamId: string | null) =>
    teamId ? regionTeams.find(t => t.id === teamId) || teams.find(t => t.id === teamId) : null

  const r1Games = getGamesForRound(1)
  const r2Games = getGamesForRound(2)
  const r3Games = getGamesForRound(3)
  const r4Games = getGamesForRound(4)

  const isLeft = flowDirection === 'right'
  const borderSide = isLeft ? 'borderRight' : 'borderLeft'

  // Build 16 rows
  const rows: React.ReactNode[] = []

  for (let row = 0; row < 16; row++) {
    const cells: React.ReactNode[] = []

    // === ROUND 1 ===
    const r1GameIdx = Math.floor(row / 2)
    const r1Game = r1Games[r1GameIdx]
    const isR1Top = row % 2 === 0
    const r1Team = isR1Top ? getTeam(r1Game?.team1_id || null) : getTeam(r1Game?.team2_id || null)
    const r1Score = isR1Top ? r1Game?.team1_score : r1Game?.team2_score
    const r1IsWinner = r1Game?.winner_id === (isR1Top ? r1Game?.team1_id : r1Game?.team2_id)

    cells.push(
      <TeamCell
        key="r1"
        team={r1Team}
        score={r1Score ?? undefined}
        isWinner={!!r1IsWinner}
        borderBottom={isR1Top}
        {...{ [borderSide]: true }}
      />
    )

    // === CONNECTOR R1->R2 ===
    // Connection pattern for 4-row blocks: top row has bottom border, rows in between have side border
    const r1Block = Math.floor(row / 4)
    const r1PosInBlock = row % 4
    // Top game exits at row 0, bottom game exits at row 2, they meet at row 1
    // Border on right/left side for rows 0 and 2, horizontal at row 1
    const c1BottomBorder = r1PosInBlock === 0 || r1PosInBlock === 2
    const c1SideBorder = r1PosInBlock === 0 || r1PosInBlock === 1 || r1PosInBlock === 2
    cells.push(
      <EmptyCell
        key="c1"
        width={CONNECTOR_WIDTH}
        borderBottom={c1BottomBorder}
        {...{ [borderSide]: c1SideBorder }}
      />
    )

    // === ROUND 2 ===
    const r2GameIdx = Math.floor(row / 4)
    const r2RowInGame = row % 4
    const r2Game = r2Games[r2GameIdx]

    if (r2RowInGame === 1 || r2RowInGame === 2) {
      const isTop = r2RowInGame === 1
      const r2Team = isTop ? getTeam(r2Game?.team1_id || null) : getTeam(r2Game?.team2_id || null)
      const r2Score = isTop ? r2Game?.team1_score : r2Game?.team2_score
      const r2IsWinner = r2Game?.winner_id === (isTop ? r2Game?.team1_id : r2Game?.team2_id)
      cells.push(
        <TeamCell
          key="r2"
          team={r2Team}
          score={r2Score ?? undefined}
          isWinner={!!r2IsWinner}
          borderBottom={isTop}
          {...{ [borderSide]: true }}
        />
      )
    } else {
      cells.push(<EmptyCell key="r2" />)
    }

    // === CONNECTOR R2->R3 ===
    // Connection pattern for 8-row blocks
    const r2Block = Math.floor(row / 8)
    const r2PosInBlock = row % 8
    // Games at rows 1-2 and 5-6 within each 8-row block connect to game at 3-4
    // Top game (1-2) connects down, bottom game (5-6) connects up, meet at row 3-4
    const c2BottomBorder = r2PosInBlock === 1 || r2PosInBlock === 5
    const c2SideBorder = r2PosInBlock >= 1 && r2PosInBlock <= 5
    cells.push(
      <EmptyCell
        key="c2"
        width={CONNECTOR_WIDTH}
        borderBottom={c2BottomBorder}
        {...{ [borderSide]: c2SideBorder }}
      />
    )

    // === ROUND 3 ===
    const r3GameIdx = Math.floor(row / 8)
    const r3RowInGame = row % 8
    const r3Game = r3Games[r3GameIdx]

    if (r3RowInGame === 3 || r3RowInGame === 4) {
      const isTop = r3RowInGame === 3
      const r3Team = isTop ? getTeam(r3Game?.team1_id || null) : getTeam(r3Game?.team2_id || null)
      const r3Score = isTop ? r3Game?.team1_score : r3Game?.team2_score
      const r3IsWinner = r3Game?.winner_id === (isTop ? r3Game?.team1_id : r3Game?.team2_id)
      cells.push(
        <TeamCell
          key="r3"
          team={r3Team}
          score={r3Score ?? undefined}
          isWinner={!!r3IsWinner}
          borderBottom={isTop}
          {...{ [borderSide]: true }}
        />
      )
    } else {
      cells.push(<EmptyCell key="r3" />)
    }

    // === CONNECTOR R3->R4 ===
    // Connection for 16 rows - games at 3-4 and 11-12 connect to game at 7-8
    const c3BottomBorder = row === 3 || row === 11
    const c3SideBorder = row >= 3 && row <= 11
    cells.push(
      <EmptyCell
        key="c3"
        width={CONNECTOR_WIDTH}
        borderBottom={c3BottomBorder}
        {...{ [borderSide]: c3SideBorder }}
      />
    )

    // === ROUND 4 (Elite 8) ===
    const r4Game = r4Games[0]
    if (row === 7 || row === 8) {
      const isTop = row === 7
      const r4Team = isTop ? getTeam(r4Game?.team1_id || null) : getTeam(r4Game?.team2_id || null)
      const r4Score = isTop ? r4Game?.team1_score : r4Game?.team2_score
      const r4IsWinner = r4Game?.winner_id === (isTop ? r4Game?.team1_id : r4Game?.team2_id)
      cells.push(
        <TeamCell
          key="r4"
          team={r4Team}
          score={r4Score ?? undefined}
          isWinner={!!r4IsWinner}
          borderBottom={isTop}
        />
      )
    } else {
      cells.push(<EmptyCell key="r4" />)
    }

    // Reverse for right side regions
    if (!isLeft) {
      cells.reverse()
    }

    rows.push(
      <div key={row} className="flex">
        {cells}
      </div>
    )
  }

  return (
    <div>
      <div
        className={`text-[10px] font-bold text-orange-400 uppercase tracking-wide mb-1 ${isLeft ? 'text-left' : 'text-right'}`}
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {region.name}
      </div>
      <div className="flex flex-col">
        {rows}
      </div>
    </div>
  )
}

// Game component for Final Four / Championship
function GameBox({
  game,
  teams,
  label,
  labelColor = 'text-orange-400'
}: {
  game: Game | undefined
  teams: Team[]
  label: string
  labelColor?: string
}) {
  const getTeam = (teamId: string | null) =>
    teamId ? teams.find(t => t.id === teamId) : null

  const team1 = getTeam(game?.team1_id || null)
  const team2 = getTeam(game?.team2_id || null)
  const team1IsWinner = game?.winner_id === game?.team1_id
  const team2IsWinner = game?.winner_id === game?.team2_id

  return (
    <div className="flex flex-col items-center">
      <div className={`text-[10px] font-bold ${labelColor} uppercase mb-1`} style={{ fontFamily: 'var(--font-display)' }}>
        {label}
      </div>
      <div className="border border-zinc-600 rounded overflow-hidden" style={{ width: GAME_WIDTH }}>
        <TeamCell
          team={team1}
          score={game?.team1_score ?? undefined}
          isWinner={!!team1IsWinner}
          borderBottom
        />
        <TeamCell
          team={team2}
          score={game?.team2_score ?? undefined}
          isWinner={!!team2IsWinner}
        />
      </div>
    </div>
  )
}

export function BracketView({ tournament, regions, teams, games }: Props) {
  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  const finalFourGames = games.filter(g => g.round === 5).sort((a, b) => a.game_number - b.game_number)
  const championshipGame = games.find(g => g.round === 6)

  const leftRegions = sortedRegions.filter(r => r.position <= 2)
  const rightRegions = sortedRegions.filter(r => r.position > 2)

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 pt-safe border-b border-zinc-800 bg-black z-10">
        <Link href="/" className="text-zinc-400 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="text-lg font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          {tournament.year} Bracket
        </h1>
        <div className="w-8" />
      </div>

      {/* Zoom/Pan Bracket */}
      <div className="flex-1 overflow-hidden">
        <TransformWrapper
          initialScale={0.5}
          minScale={0.25}
          maxScale={2}
          centerOnInit
          wheel={{ step: 0.1 }}
          doubleClick={{ mode: 'zoomIn' }}
        >
          {({ zoomIn, zoomOut, resetTransform }) => (
            <>
              <div className="absolute bottom-4 right-4 z-20 flex gap-2">
                <button onClick={() => zoomOut()} className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 border border-zinc-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                  </svg>
                </button>
                <button onClick={() => resetTransform()} className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 border border-zinc-700 text-xs font-bold">
                  FIT
                </button>
                <button onClick={() => zoomIn()} className="w-10 h-10 bg-zinc-800 rounded-full flex items-center justify-center text-white hover:bg-zinc-700 border border-zinc-700">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                  </svg>
                </button>
              </div>

              <TransformComponent wrapperStyle={{ width: '100%', height: '100%' }}>
                <div className="p-8 flex items-start gap-2" style={{ minWidth: '1400px' }}>
                  {/* Left regions stacked */}
                  <div className="flex flex-col gap-6">
                    {leftRegions.map(region => (
                      <RegionBracket
                        key={region.id}
                        region={region}
                        games={games}
                        teams={teams}
                        flowDirection="right"
                      />
                    ))}
                  </div>

                  {/* Center: Final Four + Championship */}
                  <div className="flex flex-col items-center justify-center gap-4 px-2" style={{ minHeight: 16 * CELL_HEIGHT * 2 + 48 }}>
                    <GameBox game={finalFourGames[0]} teams={teams} label="Final Four" />
                    <GameBox game={championshipGame} teams={teams} label="Championship" labelColor="text-yellow-400" />
                    <GameBox game={finalFourGames[1]} teams={teams} label="Final Four" />
                  </div>

                  {/* Right regions stacked */}
                  <div className="flex flex-col gap-6">
                    {rightRegions.map(region => (
                      <RegionBracket
                        key={region.id}
                        region={region}
                        games={games}
                        teams={teams}
                        flowDirection="left"
                      />
                    ))}
                  </div>
                </div>
              </TransformComponent>
            </>
          )}
        </TransformWrapper>
      </div>

      <div className="absolute bottom-16 left-4 text-zinc-600 text-xs">
        Pinch to zoom • Drag to pan
      </div>
    </div>
  )
}
