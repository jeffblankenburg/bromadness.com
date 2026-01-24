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

type ViewMode = 'results' | 'auction'

interface Props {
  tournament: Tournament
  regions: Region[]
  teams: Team[]
  games: Game[]
  userPicks?: Pick[]
  teamOwners?: Record<string, string>
}

const CELL_HEIGHT = 24 // Height of each cell row
const GAME_WIDTH = 110 // Width of game slot
const CONNECTOR_WIDTH = 16 // Width for connector lines

// Single team cell in a game
function TeamCell({
  team,
  score,
  isWinner,
  isPicked = false,
  ownerName,
  viewMode = 'results',
  borderBottom = false,
  borderRight = false,
  borderLeft = false,
}: {
  team: Team | null | undefined
  score: number | null | undefined
  isWinner: boolean
  isPicked?: boolean
  ownerName?: string
  viewMode?: ViewMode
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
      <span className={`text-[10px] flex-1 flex items-center gap-0.5 min-w-0 ${showAsWinner ? 'text-white font-semibold' : 'text-zinc-300'}`}>
        <span className="truncate">
          {viewMode === 'auction' ? (ownerName || team.short_name || team.name) : (team.short_name || team.name)}
        </span>
        {isPicked && viewMode === 'results' && (
          <svg className="w-3 h-3 flex-shrink-0 text-zinc-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        )}
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
  userPicks = [],
  teamOwners = {},
  viewMode = 'results',
  flowDirection = 'right'
}: {
  region: Region
  games: Game[]
  teams: Team[]
  userPicks?: Pick[]
  teamOwners?: Record<string, string>
  viewMode?: ViewMode
  flowDirection?: 'left' | 'right'
}) {
  const regionGames = games.filter(g => g.region_id === region.id)
  const regionTeams = teams.filter(t => t.region_id === region.id)

  const getGamesForRound = (round: number) =>
    regionGames.filter(g => g.round === round).sort((a, b) => a.game_number - b.game_number)

  const getTeam = (teamId: string | null) =>
    teamId ? regionTeams.find(t => t.id === teamId) || teams.find(t => t.id === teamId) : null

  const isPicked = (gameId: string | undefined, teamId: string | null) => {
    if (!gameId || !teamId) return false
    return userPicks.some(p => p.game_id === gameId && p.picked_team_id === teamId)
  }

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
    const r1TeamId = isR1Top ? r1Game?.team1_id : r1Game?.team2_id
    const r1Team = getTeam(r1TeamId || null)
    const r1Score = isR1Top ? r1Game?.team1_score : r1Game?.team2_score
    const r1IsWinner = r1Game?.winner_id === r1TeamId

    cells.push(
      <TeamCell
        key="r1"
        team={r1Team}
        score={r1Score ?? undefined}
        isWinner={!!r1IsWinner}
        isPicked={isPicked(r1Game?.id, r1TeamId || null)}
        ownerName={r1TeamId ? teamOwners[r1TeamId] : undefined}
        viewMode={viewMode}
        borderBottom={isR1Top}
      />
    )

    // === CONNECTOR R1->R2 ===
    // R1 games at rows 0-1 and 2-3 connect to R2 game at rows 1-2
    const r1PosInBlock = row % 4
    // Horizontal lines exit from between team1/team2 of each R1 game (rows 0 and 2)
    const c1BottomBorder = r1PosInBlock === 0 || r1PosInBlock === 2
    // Vertical line spans from row 1 to row 2 (connecting the two exit points)
    const c1SideBorder = r1PosInBlock === 1 || r1PosInBlock === 2
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
      const r2TeamId = isTop ? r2Game?.team1_id : r2Game?.team2_id
      const r2Team = getTeam(r2TeamId || null)
      const r2Score = isTop ? r2Game?.team1_score : r2Game?.team2_score
      const r2IsWinner = r2Game?.winner_id === r2TeamId
      cells.push(
        <TeamCell
          key="r2"
          team={r2Team}
          score={r2Score ?? undefined}
          isWinner={!!r2IsWinner}
          isPicked={isPicked(r2Game?.id, r2TeamId || null)}
          ownerName={r2TeamId ? teamOwners[r2TeamId] : undefined}
          viewMode={viewMode}
          borderBottom={isTop}
        />
      )
    } else {
      cells.push(<EmptyCell key="r2" />)
    }

    // === CONNECTOR R2->R3 ===
    // R2 games at rows 1-2 and 5-6 connect to R3 game at rows 3-4
    const r2PosInBlock = row % 8
    // Horizontal lines exit from between team1/team2 of each R2 game
    const c2BottomBorder = r2PosInBlock === 1 || r2PosInBlock === 5
    // Vertical line spans from row 2 to row 5 (connecting the two exit points)
    const c2SideBorder = r2PosInBlock >= 2 && r2PosInBlock <= 5
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
      const r3TeamId = isTop ? r3Game?.team1_id : r3Game?.team2_id
      const r3Team = getTeam(r3TeamId || null)
      const r3Score = isTop ? r3Game?.team1_score : r3Game?.team2_score
      const r3IsWinner = r3Game?.winner_id === r3TeamId
      cells.push(
        <TeamCell
          key="r3"
          team={r3Team}
          score={r3Score ?? undefined}
          isWinner={!!r3IsWinner}
          isPicked={isPicked(r3Game?.id, r3TeamId || null)}
          ownerName={r3TeamId ? teamOwners[r3TeamId] : undefined}
          viewMode={viewMode}
          borderBottom={isTop}
        />
      )
    } else {
      cells.push(<EmptyCell key="r3" />)
    }

    // === CONNECTOR R3->R4 ===
    // R3 games at rows 3-4 and 11-12 connect to R4 game at rows 7-8
    // Horizontal lines exit from between team1/team2 of each R3 game
    const c3BottomBorder = row === 3 || row === 11
    // Vertical line spans from row 4 to row 11 (connecting the two exit points)
    const c3SideBorder = row >= 4 && row <= 11
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
      const r4TeamId = isTop ? r4Game?.team1_id : r4Game?.team2_id
      const r4Team = getTeam(r4TeamId || null)
      const r4Score = isTop ? r4Game?.team1_score : r4Game?.team2_score
      const r4IsWinner = r4Game?.winner_id === r4TeamId
      cells.push(
        <TeamCell
          key="r4"
          team={r4Team}
          score={r4Score ?? undefined}
          isWinner={!!r4IsWinner}
          isPicked={isPicked(r4Game?.id, r4TeamId || null)}
          ownerName={r4TeamId ? teamOwners[r4TeamId] : undefined}
          viewMode={viewMode}
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
  userPicks = [],
  teamOwners = {},
  viewMode = 'results',
  label,
  labelColor = 'text-orange-400'
}: {
  game: Game | undefined
  teams: Team[]
  userPicks?: Pick[]
  teamOwners?: Record<string, string>
  viewMode?: ViewMode
  label: string
  labelColor?: string
}) {
  const getTeam = (teamId: string | null) =>
    teamId ? teams.find(t => t.id === teamId) : null

  const isPicked = (teamId: string | null) => {
    if (!game?.id || !teamId) return false
    return userPicks.some(p => p.game_id === game.id && p.picked_team_id === teamId)
  }

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
          isPicked={isPicked(game?.team1_id || null)}
          ownerName={game?.team1_id ? teamOwners[game.team1_id] : undefined}
          viewMode={viewMode}
          borderBottom
        />
        <TeamCell
          team={team2}
          score={game?.team2_score ?? undefined}
          isWinner={!!team2IsWinner}
          isPicked={isPicked(game?.team2_id || null)}
          ownerName={game?.team2_id ? teamOwners[game.team2_id] : undefined}
          viewMode={viewMode}
        />
      </div>
    </div>
  )
}

export function BracketView({ tournament, regions, teams, games, userPicks = [], teamOwners = {} }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('results')

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  const finalFourGames = games.filter(g => g.round === 5).sort((a, b) => a.game_number - b.game_number)
  const championshipGame = games.find(g => g.round === 6)

  const leftRegions = sortedRegions.filter(r => r.position <= 2)
  const rightRegions = sortedRegions.filter(r => r.position > 2)

  return (
    <div className="fixed inset-0 bg-black flex flex-col">
      {/* Header */}
      <div className="flex-none flex items-center justify-between px-4 py-3 pt-safe border-b border-zinc-800 bg-black z-10">
        <h1 className="flex-1 text-lg font-bold text-white uppercase tracking-wide text-center" style={{ fontFamily: 'var(--font-display)' }}>
          {tournament.year} Brocket
        </h1>
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          <button
            onClick={() => setViewMode('results')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              viewMode === 'results' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Results
          </button>
          <button
            onClick={() => setViewMode('auction')}
            className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
              viewMode === 'auction' ? 'bg-orange-500 text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            Auction
          </button>
        </div>
      </div>

      {/* Scrollable Bracket */}
      <div className="flex-1 overflow-auto">
        <div className="p-6 pb-12 flex items-start gap-2" style={{ minWidth: '1200px' }}>
          {/* Left regions stacked */}
          <div className="flex flex-col gap-6">
            {leftRegions.map(region => (
              <RegionBracket
                key={region.id}
                region={region}
                games={games}
                teams={teams}
                userPicks={userPicks}
                teamOwners={teamOwners}
                viewMode={viewMode}
                flowDirection="right"
              />
            ))}
          </div>

          {/* Center: Final Four + Championship */}
          <div className="flex flex-col items-center justify-center gap-4 px-2" style={{ minHeight: 16 * CELL_HEIGHT * 2 + 48 }}>
            <GameBox game={finalFourGames[0]} teams={teams} userPicks={userPicks} teamOwners={teamOwners} viewMode={viewMode} label="Final Four" />
            <GameBox game={championshipGame} teams={teams} userPicks={userPicks} teamOwners={teamOwners} viewMode={viewMode} label="Championship" labelColor="text-yellow-400" />
            <GameBox game={finalFourGames[1]} teams={teams} userPicks={userPicks} teamOwners={teamOwners} viewMode={viewMode} label="Final Four" />
          </div>

          {/* Right regions stacked */}
          <div className="flex flex-col gap-6">
            {rightRegions.map(region => (
              <RegionBracket
                key={region.id}
                region={region}
                games={games}
                teams={teams}
                userPicks={userPicks}
                teamOwners={teamOwners}
                viewMode={viewMode}
                flowDirection="left"
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
