import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BracketView } from './BracketView'

export default async function BracketPage() {
  const supabase = await createClient()

  // Require authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6">
        <h1 className="text-2xl font-bold mb-2">Bracket</h1>
        <p className="text-zinc-400">No tournament found.</p>
      </div>
    )
  }

  // Get regions ordered by position
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name, position')
    .eq('tournament_id', tournament.id)
    .order('position')

  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, seed, region_id')
    .eq('tournament_id', tournament.id)

  // Get all games
  const { data: games } = await supabase
    .from('games')
    .select('id, round, region_id, game_number, team1_id, team2_id, winner_id, team1_score, team2_score')
    .eq('tournament_id', tournament.id)
    .order('round')
    .order('game_number')

  return (
    <BracketView
      tournament={tournament}
      regions={regions || []}
      teams={teams || []}
      games={games || []}
    />
  )
}
