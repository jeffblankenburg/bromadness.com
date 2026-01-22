import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { DayManager } from './DayManager'
import { PaymentTracker } from './PaymentTracker'
import { PickemSettings } from './PickemSettings'

interface PickemPayouts {
  entry_fee: number
  session_1st: number
  session_2nd: number
  session_3rd: number
}

export default async function AdminPickemPage() {
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

  // Get active tournament with pickem settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, start_date, end_date, pickem_payouts')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6">
        <h1 className="text-2xl font-bold text-orange-500 mb-4">Pick&apos;em Admin</h1>
        <p className="text-zinc-400">No tournament found. Create a tournament first.</p>
      </div>
    )
  }

  // Get all users for payment tracking
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')
    .eq('is_active', true)
    .order('display_name')

  // Get pickem days for this tournament
  const { data: pickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date, is_locked')
    .eq('tournament_id', tournament.id)
    .order('contest_date')

  // Get all games for this tournament (for assigning to pickem)
  const { data: gamesRaw } = await supabase
    .from('games')
    .select(`
      id, round, game_number, scheduled_at, team1_score, team2_score, winner_id,
      spread, favorite_team_id,
      team1:teams!games_team1_id_fkey(id, name, short_name, seed),
      team2:teams!games_team2_id_fkey(id, name, short_name, seed)
    `)
    .eq('tournament_id', tournament.id)
    .eq('round', 1) // Only Round of 64 for pick'em
    .order('scheduled_at')

  // Transform games to extract team objects from arrays
  const games = (gamesRaw || []).map(g => ({
    ...g,
    team1: Array.isArray(g.team1) ? g.team1[0] || null : g.team1,
    team2: Array.isArray(g.team2) ? g.team2[0] || null : g.team2,
  }))

  // Get pickem games (already assigned)
  const { data: pickemGames } = await supabase
    .from('pickem_games')
    .select('id, pickem_day_id, game_id, spread, favorite_team_id, session, winner_team_id')

  // Get pickem entries (for payment tracking)
  const { data: pickemEntries } = await supabase
    .from('pickem_entries')
    .select('id, user_id, pickem_day_id, has_paid, paid_at, correct_picks')

  // Get all picks for standings
  const { data: pickemPicks } = await supabase
    .from('pickem_picks')
    .select('id, entry_id, pickem_game_id, picked_team_id, is_correct')

  const payouts = (tournament.pickem_payouts as PickemPayouts) || {
    entry_fee: 10,
    session_1st: 0,
    session_2nd: 0,
    session_3rd: 0,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-orange-500">Pick&apos;em Admin</h1>
          <PickemSettings
            tournamentId={tournament.id}
            payouts={payouts}
          />
        </div>

        <DayManager
          tournamentId={tournament.id}
          startDate={tournament.start_date}
          pickemDays={pickemDays || []}
          games={games}
          pickemGames={pickemGames || []}
          users={users || []}
          pickemEntries={pickemEntries || []}
          pickemPicks={pickemPicks || []}
          payouts={payouts}
        />

        <div className="mt-8">
          <PaymentTracker
            pickemDays={pickemDays || []}
            users={users || []}
            pickemEntries={pickemEntries || []}
            entryFee={payouts.entry_fee}
          />
        </div>
      </div>
    </div>
  )
}
