import { createClient } from '@/lib/supabase/server'
import { CreateTournament } from './CreateTournament'
import { BracketEditor } from './BracketEditor'
import { DeleteTournament } from './DeleteTournament'

export default async function TournamentPage() {
  const supabase = await createClient()

  // Get active tournament or most recent
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
      .select('id, round, region_id, game_number, team1_id, team2_id, winner_id, team1_score, team2_score, scheduled_at')
      .eq('tournament_id', tournament.id)
      .order('round')
      .order('game_number')
    games = gamesData || []
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Tournament Setup</h2>

      {!tournament ? (
        <CreateTournament />
      ) : (
        <div className="space-y-6">
          <div className="bg-zinc-800/50 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold">{tournament.name}</h3>
                <p className="text-sm text-zinc-400">
                  {tournament.year} • {tournament.regions?.length || 0} regions • {teams.length}/64 teams
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  tournament.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
                }`}>
                  {tournament.is_active ? 'Active' : 'Inactive'}
                </span>
                <DeleteTournament tournamentId={tournament.id} tournamentName={tournament.name} />
              </div>
            </div>
          </div>

          <BracketEditor
            tournament={tournament}
            regions={tournament.regions || []}
            teams={teams}
            games={games}
          />
        </div>
      )}
    </div>
  )
}
