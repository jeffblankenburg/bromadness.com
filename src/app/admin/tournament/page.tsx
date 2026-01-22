import { createClient } from '@/lib/supabase/server'
import { BracketEditor } from './BracketEditor'
import { RegionOrderEditor } from './RegionOrderEditor'

export default async function TournamentPage() {
  const supabase = await createClient()

  // Get the tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select(`
      *,
      regions (
        id,
        name,
        position
      )
    `)
    .order('year', { ascending: false })
    .limit(1)
    .single()

  // Get teams and games if tournament exists
  let teams: Array<{
    id: string
    name: string
    short_name: string | null
    seed: number
    region_id: string
  }> = []

  let games: Array<{
    id: string
    round: number
    region_id: string | null
    game_number: number
    team1_id: string | null
    team2_id: string | null
    winner_id: string | null
    team1_score: number | null
    team2_score: number | null
    scheduled_at: string | null
    spread: number | null
    favorite_team_id: string | null
    channel: string | null
    location: string | null
    next_game_id: string | null
    is_team1_slot: boolean | null
  }> = []

  if (tournament) {
    const { data: teamsData } = await supabase
      .from('teams')
      .select('id, name, short_name, seed, region_id')
      .eq('tournament_id', tournament.id)
      .order('seed')
    teams = teamsData || []

    const { data: gamesData } = await supabase
      .from('games')
      .select('id, round, region_id, game_number, team1_id, team2_id, winner_id, team1_score, team2_score, scheduled_at, spread, favorite_team_id, channel, location, next_game_id, is_team1_slot')
      .eq('tournament_id', tournament.id)
      .order('round')
      .order('game_number')
    games = gamesData || []
  }

  if (!tournament) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Tournament Setup</h2>
        <p className="text-zinc-400">No tournament found. Please set up the tournament in the database.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Tournament Setup</h2>
        <span className="text-sm text-zinc-400">{teams.length}/64 teams</span>
      </div>

      <BracketEditor
        tournament={tournament}
        regions={tournament.regions || []}
        teams={teams}
        games={games}
      />

      <RegionOrderEditor regions={tournament.regions || []} />
    </div>
  )
}
