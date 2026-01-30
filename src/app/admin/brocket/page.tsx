import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BrocketPaymentTracker } from './BrocketPaymentTracker'
import { BrocketResetPicks } from './BrocketResetPicks'
import { BrocketSettings } from './BrocketSettings'

interface BrocketPayouts {
  entry_fee: number
  enabled: boolean
  lock_individual?: boolean
}

export default async function AdminBrocketPage() {
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

  // Get active tournament with brocket settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, brocket_payouts')
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

  // Get all users for payment tracking
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')
    .eq('is_active', true)
    .order('display_name')

  // Get Round 1 games (Brocket games - 32 total)
  const { data: games } = await supabase
    .from('games')
    .select('id, scheduled_at, winner_id, region_id')
    .eq('tournament_id', tournament.id)
    .eq('round', 1)
    .order('scheduled_at')

  // Get brocket entries
  const { data: brocketEntries } = await supabase
    .from('brocket_entries')
    .select('id, user_id, tournament_id, has_paid')
    .eq('tournament_id', tournament.id)

  // Get brocket picks
  const gameIds = (games || []).map(g => g.id)
  const entryIds = (brocketEntries || []).map(e => e.id)
  const { data: brocketPicks } = entryIds.length > 0 && gameIds.length > 0
    ? await supabase
        .from('brocket_picks')
        .select('id, entry_id, game_id, picked_team_id')
        .in('entry_id', entryIds)
    : { data: [] }

  const payouts = (tournament.brocket_payouts as BrocketPayouts) || {
    entry_fee: 20,
    enabled: true,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <BrocketSettings
          tournamentId={tournament.id}
          entryFee={payouts.entry_fee}
          enabled={payouts.enabled ?? true}
          lockIndividual={payouts.lock_individual ?? false}
        />
      </div>

      <BrocketPaymentTracker
        tournamentId={tournament.id}
        users={users || []}
        brocketEntries={brocketEntries || []}
        games={games || []}
        brocketPicks={brocketPicks || []}
        entryFee={payouts.entry_fee}
      />

      <div className="pt-8 border-t border-zinc-800">
        <BrocketResetPicks tournamentId={tournament.id} />
      </div>
    </div>
  )
}
