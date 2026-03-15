// Play-in (First Four) game utilities

interface PlayInGame {
  id: string
  round: number
  next_game_id?: string | null
  is_team1_slot?: boolean | null
  team1_id?: string | null
  team2_id?: string | null
  winner_id?: string | null
}

interface PlayInTeam {
  id: string
  name: string
  short_name: string | null
  seed: number
  region_id: string
}

/** Get all play-in (round 0) games */
export function getPlayInGames<T extends PlayInGame>(allGames: T[]): T[] {
  return allGames.filter(g => g.round === 0)
}

/** Find the play-in game that feeds into a specific Round 1 slot */
export function getPlayInGameForSlot<T extends PlayInGame>(
  allGames: T[],
  round1GameId: string,
  isTeam1Slot: boolean
): T | undefined {
  return allGames.find(
    g => g.round === 0 && g.next_game_id === round1GameId && g.is_team1_slot === isTeam1Slot
  )
}

/** Get combined "TeamA/TeamB" display name for a play-in game */
export function getPlayInDisplayName(
  playInGame: PlayInGame,
  allTeams: PlayInTeam[]
): string {
  const team1 = playInGame.team1_id ? allTeams.find(t => t.id === playInGame.team1_id) : null
  const team2 = playInGame.team2_id ? allTeams.find(t => t.id === playInGame.team2_id) : null
  const name1 = team1?.short_name || team1?.name || 'TBD'
  const name2 = team2?.short_name || team2?.name || 'TBD'
  return `${name1}/${name2}`
}
