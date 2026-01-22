import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
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
    .select('id, name, year, pickem_payouts')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Pick&apos;em</h2>
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

  // Get Round 1 & 2 games (Pick'em games)
  // Round 1 = Thursday/Friday, Round 2 = Saturday/Sunday
  const { data: games } = await supabase
    .from('games')
    .select('id, scheduled_at, winner_id')
    .eq('tournament_id', tournament.id)
    .in('round', [1, 2])
    .order('scheduled_at')

  // Group games by date to determine pick'em days
  const gamesByDate = (games || []).reduce((acc, game) => {
    if (!game.scheduled_at) return acc
    const date = game.scheduled_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, typeof games>)

  const pickemDates = Object.keys(gamesByDate).sort()

  // Get pickem entries (for payment tracking) - join through pickem_days
  const { data: pickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date')
    .eq('tournament_id', tournament.id)

  // Auto-create pickem_days for any dates that don't exist
  const existingDates = (pickemDays || []).map(d => d.contest_date)
  const missingDates = pickemDates.filter(date => !existingDates.includes(date))

  if (missingDates.length > 0) {
    await supabase
      .from('pickem_days')
      .insert(missingDates.map(date => ({
        tournament_id: tournament.id,
        contest_date: date,
        is_locked: false,
      })))
  }

  // Re-fetch pickem_days after potential insert
  const { data: allPickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date')
    .eq('tournament_id', tournament.id)
    .order('contest_date')

  const dayIds = (allPickemDays || []).map(d => d.id)

  // Get pickem entries
  const { data: pickemEntries } = dayIds.length > 0
    ? await supabase
        .from('pickem_entries')
        .select('id, user_id, pickem_day_id, has_paid')
        .in('pickem_day_id', dayIds)
    : { data: [] }

  // Get picks (using game_id directly)
  const gameIds = (games || []).map(g => g.id)
  const { data: pickemPicks } = gameIds.length > 0
    ? await supabase
        .from('pickem_picks')
        .select('id, entry_id, game_id, picked_team_id, is_correct')
        .in('game_id', gameIds)
    : { data: [] }

  const payouts = (tournament.pickem_payouts as PickemPayouts) || {
    entry_fee: 10,
    session_1st: 0,
    session_2nd: 0,
    session_3rd: 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Pick&apos;em</h2>
        <PickemSettings
          tournamentId={tournament.id}
          payouts={payouts}
        />
      </div>

      <PaymentTracker
        pickemDays={allPickemDays || []}
        users={users || []}
        pickemEntries={pickemEntries || []}
        games={games || []}
        pickemPicks={pickemPicks || []}
        entryFee={payouts.entry_fee}
      />
    </div>
  )
}
