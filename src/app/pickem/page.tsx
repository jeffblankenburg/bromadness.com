import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PickemClient } from './PickemClient'

interface PickemPayouts {
  entry_fee: number
  enabled_days?: string[]  // Day names like "Thursday", "Friday", etc.
}

// Get day name from a date string
function getDayName(dateStr: string): string {
  const date = new Date(dateStr + 'T12:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

export default async function PickemPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, pickem_payouts, dev_simulated_time')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-500 mb-4">Pick&apos;em</h1>
        <p className="text-zinc-400">No tournament found.</p>
      </div>
    )
  }

  const payouts = (tournament.pickem_payouts as PickemPayouts) || { entry_fee: 10 }
  const enabledDays = payouts.enabled_days || ['Thursday', 'Friday']

  // Get Round 1 & 2 games with team info and spreads
  // Round 1 = Thursday/Friday (Round of 64)
  // Round 2 = Saturday/Sunday (Round of 32)
  const { data: gamesRaw } = await supabase
    .from('games')
    .select(`
      id, scheduled_at, team1_score, team2_score, winner_id,
      spread, favorite_team_id, location, channel,
      team1:teams!games_team1_id_fkey(id, name, short_name, seed),
      team2:teams!games_team2_id_fkey(id, name, short_name, seed)
    `)
    .eq('tournament_id', tournament.id)
    .in('round', [1, 2])
    .order('scheduled_at')

  // Transform games to extract team objects from arrays, filter by enabled days
  const games = (gamesRaw || [])
    .filter(g => {
      if (!g.scheduled_at) return false
      const dayName = getDayName(g.scheduled_at.split('T')[0])
      return enabledDays.includes(dayName)
    })
    .map(g => ({
      ...g,
      team1: Array.isArray(g.team1) ? g.team1[0] || null : g.team1,
      team2: Array.isArray(g.team2) ? g.team2[0] || null : g.team2,
    }))

  if (games.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-500 mb-4">Pick&apos;em</h1>
        <p className="text-zinc-400">Pick&apos;em coming soon!</p>
      </div>
    )
  }

  // Group games by date
  const gamesByDate = games.reduce((acc, game) => {
    if (!game.scheduled_at) return acc
    const date = game.scheduled_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, typeof games>)

  const dates = Object.keys(gamesByDate).sort()

  // Get or create pickem_days
  const { data: existingDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date')
    .eq('tournament_id', tournament.id)

  const existingDates = (existingDays || []).map(d => d.contest_date)
  const missingDates = dates.filter(d => !existingDates.includes(d))

  if (missingDates.length > 0) {
    await supabase
      .from('pickem_days')
      .insert(missingDates.map(date => ({
        tournament_id: tournament.id,
        contest_date: date,
        is_locked: false,
      })))
  }

  const { data: pickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date')
    .eq('tournament_id', tournament.id)
    .order('contest_date')

  // Get user's entries
  const dayIds = (pickemDays || []).map(d => d.id)
  const { data: userEntries } = dayIds.length > 0
    ? await supabase
        .from('pickem_entries')
        .select('id, user_id, pickem_day_id, has_paid')
        .eq('user_id', user.id)
        .in('pickem_day_id', dayIds)
    : { data: [] }

  // Get user's picks
  const gameIds = games.map(g => g.id)
  const userEntryIds = (userEntries || []).map(e => e.id)
  const { data: userPicks } = userEntryIds.length > 0
    ? await supabase
        .from('pickem_picks')
        .select('id, entry_id, game_id, picked_team_id, is_correct')
        .in('entry_id', userEntryIds)
    : { data: [] }

  // Get all users for standings
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')

  // Get all entries for standings
  const { data: allEntries } = dayIds.length > 0
    ? await supabase
        .from('pickem_entries')
        .select('id, user_id, pickem_day_id, has_paid')
        .in('pickem_day_id', dayIds)
    : { data: [] }

  // Get all picks for standings
  const entryIds = (allEntries || []).map(e => e.id)
  const { data: allPicks } = entryIds.length > 0
    ? await supabase
        .from('pickem_picks')
        .select('id, entry_id, game_id, picked_team_id, is_correct')
        .in('entry_id', entryIds)
    : { data: [] }

  const entryFee = payouts.entry_fee || 10
  const simulatedTime = tournament.dev_simulated_time as string | null

  return (
    <PickemClient
      userId={user.id}
      pickemDays={pickemDays || []}
      games={games}
      users={users || []}
      userEntries={userEntries || []}
      userPicks={userPicks || []}
      allEntries={allEntries || []}
      allPicks={allPicks || []}
      entryFee={entryFee}
      simulatedTime={simulatedTime}
      enabledDays={enabledDays}
    />
  )
}
