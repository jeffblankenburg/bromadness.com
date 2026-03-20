import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ParlaysAdmin } from './ParlaysAdmin'
import { ParlaysResetAll } from './ParlaysResetAll'

export default async function AdminParlaysPage() {
  const supabase = await createClient()

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/')

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
        <p className="text-zinc-400">No tournament found. Create a tournament first.</p>
      </div>
    )
  }

  // Get all parlays for this tournament
  const { data: parlays } = await supabase
    .from('parlays')
    .select('id, user_id, bet_amount, status, has_paid, is_paid, paid_at, created_at')
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: false })

  // Get all parlay picks
  const parlayIds = (parlays || []).map(p => p.id)
  const { data: parlayPicks } = parlayIds.length > 0
    ? await supabase
        .from('parlay_picks')
        .select('id, parlay_id, game_id, picked_team_id, is_correct, pick_type, picked_over_under')
        .in('parlay_id', parlayIds)
    : { data: [] }

  // Get games referenced by picks (with team info)
  const gameIds = [...new Set((parlayPicks || []).map(p => p.game_id))]
  const { data: gamesRaw } = gameIds.length > 0
    ? await supabase
        .from('games')
        .select(`
          id, scheduled_at, team1_score, team2_score, winner_id,
          spread, favorite_team_id, over_under_total, round, location, channel,
          team1:teams!games_team1_id_fkey(id, name, short_name, seed),
          team2:teams!games_team2_id_fkey(id, name, short_name, seed)
        `)
        .in('id', gameIds)
    : { data: [] }

  const games = (gamesRaw || []).map(g => ({
    ...g,
    team1: Array.isArray(g.team1) ? g.team1[0] || null : g.team1,
    team2: Array.isArray(g.team2) ? g.team2[0] || null : g.team2,
  }))

  // Get all users for display names
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')

  return (
    <div className="space-y-6">
      <ParlaysAdmin
        tournamentId={tournament.id}
        parlays={parlays || []}
        parlayPicks={parlayPicks || []}
        games={games}
        users={users || []}
      />

      <div className="pt-8 border-t border-zinc-800">
        <ParlaysResetAll tournamentId={tournament.id} />
      </div>
    </div>
  )
}
