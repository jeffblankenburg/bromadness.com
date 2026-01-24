import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BracketView } from './BracketView'
import { getActiveUserId } from '@/lib/simulation'

export default async function BracketPage() {
  const supabase = await createClient()

  // Require authentication
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeUserId = await getActiveUserId(user.id)

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

  // Get user's pick'em picks
  // First get pickem_days for this tournament
  const { data: pickemDays } = await supabase
    .from('pickem_days')
    .select('id')
    .eq('tournament_id', tournament.id)

  let userPicks: { game_id: string; picked_team_id: string }[] = []

  if (pickemDays && pickemDays.length > 0) {
    const dayIds = pickemDays.map(d => d.id)

    // Get user's entries for these days
    const { data: userEntries } = await supabase
      .from('pickem_entries')
      .select('id')
      .eq('user_id', activeUserId)
      .in('pickem_day_id', dayIds)

    if (userEntries && userEntries.length > 0) {
      const entryIds = userEntries.map(e => e.id)

      // Get all picks for these entries
      const { data: picks } = await supabase
        .from('pickem_picks')
        .select('game_id, picked_team_id')
        .in('entry_id', entryIds)
        .not('picked_team_id', 'is', null)

      userPicks = (picks || []) as { game_id: string; picked_team_id: string }[]
    }
  }

  return (
    <BracketView
      tournament={tournament}
      regions={regions || []}
      teams={teams || []}
      games={games || []}
      userPicks={userPicks}
    />
  )
}
