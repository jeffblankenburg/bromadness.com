import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BrocketClient } from './BrocketClient'
import { getActiveUserId } from '@/lib/simulation'

interface BrocketPayouts {
  entry_fee: number
  enabled: boolean
  lock_individual?: boolean
}

interface Region {
  id: string
  name: string
  position: number
}

export default async function BrocketPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active user ID (may be simulated)
  const activeUserId = await getActiveUserId(user.id)

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, brocket_payouts, dev_simulated_time')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  const BrocketIcon = () => (
    <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 0 1-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 0 0 6.16-12.12A14.98 14.98 0 0 0 9.631 8.41m5.96 5.96a14.926 14.926 0 0 1-5.841 2.58m-.119-8.54a6 6 0 0 0-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 0 0-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 0 1-2.448-2.448 14.9 14.9 0 0 1 .06-.312m-2.24 2.39a4.493 4.493 0 0 0-1.757 4.306 4.493 4.493 0 0 0 4.306-1.758M16.5 9a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z" />
    </svg>
  )

  if (!tournament) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BrocketIcon />
          Brocket
        </h1>
        <p className="text-zinc-400">No tournament found.</p>
      </div>
    )
  }

  const payouts = (tournament.brocket_payouts as BrocketPayouts) || { entry_fee: 20, enabled: true }

  // Get regions for the tournament
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name, position')
    .eq('tournament_id', tournament.id)
    .order('position')

  if (!regions || regions.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BrocketIcon />
          Brocket
        </h1>
        <p className="text-zinc-400">Brocket coming soon!</p>
      </div>
    )
  }

  // Get brocket-eligible games using explicit flag (include round 0 for play-in display)
  const { data: gamesRaw } = await supabase
    .from('games')
    .select(`
      id, scheduled_at, team1_score, team2_score, winner_id, region_id,
      game_number, location, channel, round, next_game_id, is_team1_slot, is_brocket,
      team1:teams!games_team1_id_fkey(id, name, short_name, seed, record),
      team2:teams!games_team2_id_fkey(id, name, short_name, seed, record)
    `)
    .eq('tournament_id', tournament.id)
    .in('round', [0, 1, 2])
    .order('round')
    .order('game_number')

  // Transform games to extract team objects from arrays
  const allFetchedGames = (gamesRaw || []).map(g => ({
    ...g,
    team1: Array.isArray(g.team1) ? g.team1[0] || null : g.team1,
    team2: Array.isArray(g.team2) ? g.team2[0] || null : g.team2,
  }))

  // Include games scheduled on Thursday, Friday, or Saturday (Eastern time)
  const brocketDays = new Set([4, 5, 6]) // Thu, Fri, Sat
  const getEasternDay = (dateStr: string): number => {
    const dayStr = new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      weekday: 'short',
    }).format(new Date(dateStr))
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return dayMap[dayStr] ?? -1
  }

  const games = allFetchedGames.filter(g => {
    if (!g.scheduled_at) return false
    return brocketDays.has(getEasternDay(g.scheduled_at))
  })

  const r1Games = games.filter(g => g.round === 1)

  if (r1Games.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BrocketIcon />
          Brocket
        </h1>
        <p className="text-zinc-400">Brocket coming soon!</p>
      </div>
    )
  }

  // Find the earliest game time per round (lock time)
  const firstR1GameTime = r1Games.reduce((earliest, game) => {
    if (!game.scheduled_at) return earliest
    if (!earliest || game.scheduled_at < earliest) return game.scheduled_at
    return earliest
  }, null as string | null)

  const r2Games = games.filter(g => g.round === 2)
  const firstR2GameTime = r2Games.reduce((earliest, game) => {
    if (!game.scheduled_at) return earliest
    if (!earliest || game.scheduled_at < earliest) return game.scheduled_at
    return earliest
  }, null as string | null)

  // Get user's brocket entry
  const { data: userEntry } = await supabase
    .from('brocket_entries')
    .select('id, user_id, tournament_id, has_paid')
    .eq('user_id', activeUserId)
    .eq('tournament_id', tournament.id)
    .single()

  // Get user's brocket picks (for both R1 and R2 games)
  const { data: userPicks } = userEntry
    ? await supabase
        .from('brocket_picks')
        .select('id, entry_id, game_id, picked_team_id, is_correct')
        .eq('entry_id', userEntry.id)
    : { data: [] }

  // Get all users for leaderboard
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name')

  // Get all brocket entries for leaderboard
  const { data: allEntries } = await supabase
    .from('brocket_entries')
    .select('id, user_id, tournament_id, has_paid')
    .eq('tournament_id', tournament.id)

  // Get all brocket picks for leaderboard
  const entryIds = (allEntries || []).map(e => e.id)
  const { data: allPicks } = entryIds.length > 0
    ? await supabase
        .from('brocket_picks')
        .select('id, entry_id, game_id, picked_team_id, is_correct')
        .in('entry_id', entryIds)
    : { data: [] }

  const entryFee = payouts.entry_fee || 20
  const simulatedTime = tournament.dev_simulated_time as string | null
  const lockIndividual = payouts.lock_individual ?? false

  return (
    <BrocketClient
      userId={activeUserId}
      tournamentId={tournament.id}
      regions={regions as Region[]}
      games={games}
      users={users || []}
      userEntry={userEntry}
      userPicks={userPicks || []}
      allEntries={allEntries || []}
      allPicks={allPicks || []}
      entryFee={entryFee}
      simulatedTime={simulatedTime}
      firstR1GameTime={firstR1GameTime}
      firstR2GameTime={firstR2GameTime}
      lockIndividual={lockIndividual}
    />
  )
}
