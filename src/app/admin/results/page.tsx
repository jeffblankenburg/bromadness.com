import { createClient } from '@/lib/supabase/server'
import { GameResults } from './GameResults'

export default async function ResultsPage() {
  const supabase = await createClient()

  // Get active tournament
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

  if (!tournament) {
    return (
      <div className="space-y-6">
        <p className="text-zinc-400">No tournament found. Create one first.</p>
      </div>
    )
  }

  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, seed, region_id')
    .eq('tournament_id', tournament.id)

  // Get all games with next_game info and spread
  const { data: games } = await supabase
    .from('games')
    .select('id, round, region_id, game_number, team1_id, team2_id, winner_id, team1_score, team2_score, scheduled_at, next_game_id, is_team1_slot, spread, favorite_team_id, location, channel')
    .eq('tournament_id', tournament.id)
    .order('round')
    .order('game_number')

  return (
    <div className="space-y-6">
      <GameResults
        tournament={tournament}
        teams={teams || []}
        games={games || []}
      />
    </div>
  )
}
