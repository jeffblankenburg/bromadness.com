import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ParlaysClient } from './ParlaysClient'
import { getActiveUserId } from '@/lib/simulation'

const ParlaysIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
  </svg>
)

export default async function ParlaysPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const activeUserId = await getActiveUserId(user.id)

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, dev_simulated_time')
    .order('year', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!tournament) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <ParlaysIcon />
          Parlays
        </h1>
        <p className="text-zinc-400">No tournament found.</p>
      </div>
    )
  }

  // Get all games with spreads assigned, with team info
  const { data: gamesRaw } = await supabase
    .from('games')
    .select(`
      id, scheduled_at, team1_score, team2_score, winner_id,
      spread, favorite_team_id, round, location, channel,
      team1:teams!games_team1_id_fkey(id, name, short_name, seed),
      team2:teams!games_team2_id_fkey(id, name, short_name, seed)
    `)
    .eq('tournament_id', tournament.id)
    .not('spread', 'is', null)
    .not('team1_id', 'is', null)
    .not('team2_id', 'is', null)
    .order('scheduled_at')

  const games = (gamesRaw || []).map(g => ({
    ...g,
    team1: Array.isArray(g.team1) ? g.team1[0] || null : g.team1,
    team2: Array.isArray(g.team2) ? g.team2[0] || null : g.team2,
  }))

  if (games.length === 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mb-4 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <ParlaysIcon />
          Parlays
        </h1>
        <p className="text-zinc-400">Parlays coming soon! Games with spreads will appear here.</p>
      </div>
    )
  }

  // Get user's parlays
  const { data: userParlays } = await supabase
    .from('parlays')
    .select('id, bet_amount, status, has_paid, is_paid, created_at')
    .eq('user_id', activeUserId)
    .eq('tournament_id', tournament.id)
    .order('created_at', { ascending: false })

  // Get parlay picks for user's parlays
  const parlayIds = (userParlays || []).map(p => p.id)
  const { data: parlayPicks } = parlayIds.length > 0
    ? await supabase
        .from('parlay_picks')
        .select('id, parlay_id, game_id, picked_team_id, is_correct')
        .in('parlay_id', parlayIds)
    : { data: [] }

  const simulatedTime = tournament.dev_simulated_time as string | null

  return (
    <ParlaysClient
      userId={activeUserId}
      tournamentId={tournament.id}
      games={games}
      userParlays={userParlays || []}
      parlayPicks={parlayPicks || []}
      simulatedTime={simulatedTime}
    />
  )
}
