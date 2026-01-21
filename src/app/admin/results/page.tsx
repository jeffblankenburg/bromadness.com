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
        <h2 className="text-xl font-bold">Game Results</h2>
        <p className="text-zinc-400">No tournament found. Create one first.</p>
      </div>
    )
  }

  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, seed, region_id')
    .eq('tournament_id', tournament.id)

  // Get all games with next_game info
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('round')
    .order('game_number')

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Game Results</h2>
      <p className="text-sm text-zinc-400">{tournament.name}</p>

      <GameResults
        tournament={tournament}
        regions={tournament.regions || []}
        teams={teams || []}
        games={games || []}
      />
    </div>
  )
}
