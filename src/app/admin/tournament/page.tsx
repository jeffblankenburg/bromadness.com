import { createClient } from '@/lib/supabase/server'
import { CreateTournament } from './CreateTournament'
import { BracketEditor } from './BracketEditor'

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

  // Get teams if tournament exists
  let teams: Array<{
    id: string
    name: string
    short_name: string | null
    seed: number
    region_id: string
  }> = []

  if (tournament) {
    const { data } = await supabase
      .from('teams')
      .select('id, name, short_name, seed, region_id')
      .eq('tournament_id', tournament.id)
      .order('seed')
    teams = data || []
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
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                tournament.is_active ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700 text-zinc-400'
              }`}>
                {tournament.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          <BracketEditor
            tournament={tournament}
            regions={tournament.regions || []}
            teams={teams}
          />
        </div>
      )}
    </div>
  )
}
