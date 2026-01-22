import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PickemClient } from './PickemClient'

interface PickemPayouts {
  entry_fee: number
  session_1st: number
  session_2nd: number
  session_3rd: number
}

export default async function PickemPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, start_date, pickem_payouts')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6">
        <h1 className="text-2xl font-bold text-orange-500 mb-4">Pick&apos;em</h1>
        <p className="text-zinc-400">No tournament found.</p>
      </div>
    )
  }

  // Get pickem days
  const { data: pickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date, is_locked')
    .eq('tournament_id', tournament.id)
    .order('contest_date')

  if (!pickemDays || pickemDays.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6">
        <h1 className="text-2xl font-bold text-orange-500 mb-4">Pick&apos;em</h1>
        <p className="text-zinc-400">Pick&apos;em coming soon!</p>
      </div>
    )
  }

  // Get games with team info
  const { data: games } = await supabase
    .from('games')
    .select(`
      id, round, scheduled_at, team1_score, team2_score, winner_id,
      team1:teams!games_team1_id_fkey(id, name, short_name, seed),
      team2:teams!games_team2_id_fkey(id, name, short_name, seed)
    `)
    .eq('tournament_id', tournament.id)
    .eq('round', 1)

  // Get pickem games
  const { data: pickemGames } = await supabase
    .from('pickem_games')
    .select('id, pickem_day_id, game_id, spread, favorite_team_id, session, winner_team_id')

  // Get all users for standings
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')

  // Get all entries
  const { data: pickemEntries } = await supabase
    .from('pickem_entries')
    .select('id, user_id, pickem_day_id, has_paid, correct_picks')

  // Get all picks
  const { data: pickemPicks } = await supabase
    .from('pickem_picks')
    .select('id, entry_id, pickem_game_id, picked_team_id, is_correct')

  // Get user's entry for each day
  const userEntries = pickemEntries?.filter(e => e.user_id === user.id) || []

  const payouts = (tournament.pickem_payouts as PickemPayouts) || {
    entry_fee: 10,
    session_1st: 0,
    session_2nd: 0,
    session_3rd: 0,
  }

  return (
    <PickemClient
      userId={user.id}
      pickemDays={pickemDays}
      games={games || []}
      pickemGames={pickemGames || []}
      users={users || []}
      pickemEntries={pickemEntries || []}
      pickemPicks={pickemPicks || []}
      userEntries={userEntries}
      payouts={payouts}
    />
  )
}
