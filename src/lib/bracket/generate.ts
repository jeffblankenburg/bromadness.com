// Generate the 63-game bracket structure for a tournament

interface GameInsert {
  tournament_id: string
  round: number
  region_id: string | null
  game_number: number
  scheduled_at?: string
}

interface GameWithId extends GameInsert {
  id: string
}

// Matchup seeds for round 1 (in bracket order)
export const ROUND1_MATCHUPS = [
  [1, 16],  // Game 1
  [8, 9],   // Game 2
  [5, 12],  // Game 3
  [4, 13],  // Game 4
  [6, 11],  // Game 5
  [3, 14],  // Game 6
  [7, 10],  // Game 7
  [2, 15],  // Game 8
]

// Generate all games for a tournament
// Returns games in order they should be inserted, with linking info
export function generateBracketGames(
  tournamentId: string,
  regions: Array<{ id: string; position: number }>
): GameInsert[] {
  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)
  const games: GameInsert[] = []

  // Round 1: 32 games (8 per region)
  for (const region of sortedRegions) {
    for (let gameNum = 1; gameNum <= 8; gameNum++) {
      games.push({
        tournament_id: tournamentId,
        round: 1,
        region_id: region.id,
        game_number: gameNum,
      })
    }
  }

  // Round 2: 16 games (4 per region)
  for (const region of sortedRegions) {
    for (let gameNum = 1; gameNum <= 4; gameNum++) {
      games.push({
        tournament_id: tournamentId,
        round: 2,
        region_id: region.id,
        game_number: gameNum,
      })
    }
  }

  // Round 3 (Sweet 16): 8 games (2 per region)
  for (const region of sortedRegions) {
    for (let gameNum = 1; gameNum <= 2; gameNum++) {
      games.push({
        tournament_id: tournamentId,
        round: 3,
        region_id: region.id,
        game_number: gameNum,
      })
    }
  }

  // Round 4 (Elite 8): 4 games (1 per region)
  for (const region of sortedRegions) {
    games.push({
      tournament_id: tournamentId,
      round: 4,
      region_id: region.id,
      game_number: 1,
    })
  }

  // Round 5 (Final Four): 2 games
  // Game 1: Region 1 winner vs Region 2 winner
  // Game 2: Region 3 winner vs Region 4 winner
  games.push({
    tournament_id: tournamentId,
    round: 5,
    region_id: null,
    game_number: 1,
  })
  games.push({
    tournament_id: tournamentId,
    round: 5,
    region_id: null,
    game_number: 2,
  })

  // Round 6 (Championship): 1 game
  games.push({
    tournament_id: tournamentId,
    round: 6,
    region_id: null,
    game_number: 1,
  })

  return games
}

// After games are created, this builds the linking updates
// Maps each game to its next_game_id and is_team1_slot
export function buildGameLinks(
  games: GameWithId[],
  regions: Array<{ id: string; position: number }>
): Array<{ id: string; next_game_id: string; is_team1_slot: boolean }> {
  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)
  const links: Array<{ id: string; next_game_id: string; is_team1_slot: boolean }> = []

  // Helper to find a game
  const findGame = (round: number, regionId: string | null, gameNumber: number) => {
    return games.find(g =>
      g.round === round &&
      g.region_id === regionId &&
      g.game_number === gameNumber
    )
  }

  // Link Round 1 → Round 2
  // Games 1,2 → R2 Game 1; Games 3,4 → R2 Game 2; etc.
  for (const region of sortedRegions) {
    for (let i = 0; i < 8; i += 2) {
      const r2GameNum = Math.floor(i / 2) + 1
      const r2Game = findGame(2, region.id, r2GameNum)
      if (r2Game) {
        const game1 = findGame(1, region.id, i + 1)
        const game2 = findGame(1, region.id, i + 2)
        if (game1) links.push({ id: game1.id, next_game_id: r2Game.id, is_team1_slot: true })
        if (game2) links.push({ id: game2.id, next_game_id: r2Game.id, is_team1_slot: false })
      }
    }
  }

  // Link Round 2 → Round 3
  for (const region of sortedRegions) {
    for (let i = 0; i < 4; i += 2) {
      const r3GameNum = Math.floor(i / 2) + 1
      const r3Game = findGame(3, region.id, r3GameNum)
      if (r3Game) {
        const game1 = findGame(2, region.id, i + 1)
        const game2 = findGame(2, region.id, i + 2)
        if (game1) links.push({ id: game1.id, next_game_id: r3Game.id, is_team1_slot: true })
        if (game2) links.push({ id: game2.id, next_game_id: r3Game.id, is_team1_slot: false })
      }
    }
  }

  // Link Round 3 → Round 4 (Elite 8)
  for (const region of sortedRegions) {
    const r4Game = findGame(4, region.id, 1)
    if (r4Game) {
      const game1 = findGame(3, region.id, 1)
      const game2 = findGame(3, region.id, 2)
      if (game1) links.push({ id: game1.id, next_game_id: r4Game.id, is_team1_slot: true })
      if (game2) links.push({ id: game2.id, next_game_id: r4Game.id, is_team1_slot: false })
    }
  }

  // Link Round 4 → Round 5 (Final Four)
  // Regions 1,2 → FF Game 1; Regions 3,4 → FF Game 2
  const ff1 = findGame(5, null, 1)
  const ff2 = findGame(5, null, 2)
  if (ff1) {
    const r4Game1 = findGame(4, sortedRegions[0].id, 1)
    const r4Game2 = findGame(4, sortedRegions[1].id, 1)
    if (r4Game1) links.push({ id: r4Game1.id, next_game_id: ff1.id, is_team1_slot: true })
    if (r4Game2) links.push({ id: r4Game2.id, next_game_id: ff1.id, is_team1_slot: false })
  }
  if (ff2) {
    const r4Game3 = findGame(4, sortedRegions[2].id, 1)
    const r4Game4 = findGame(4, sortedRegions[3].id, 1)
    if (r4Game3) links.push({ id: r4Game3.id, next_game_id: ff2.id, is_team1_slot: true })
    if (r4Game4) links.push({ id: r4Game4.id, next_game_id: ff2.id, is_team1_slot: false })
  }

  // Link Round 5 → Round 6 (Championship)
  const champ = findGame(6, null, 1)
  if (champ && ff1 && ff2) {
    links.push({ id: ff1.id, next_game_id: champ.id, is_team1_slot: true })
    links.push({ id: ff2.id, next_game_id: champ.id, is_team1_slot: false })
  }

  return links
}

// Get which seeds play in which round 1 game
export function getSeedsForGame(gameNumber: number): [number, number] {
  return ROUND1_MATCHUPS[gameNumber - 1] as [number, number]
}
