import { createClient } from '@/lib/supabase/server'
import { AuctionEditor } from './AuctionEditor'
import { AuctionSettings } from './AuctionSettings'

interface AuctionPayouts {
  championship_winner: number
  championship_runnerup: number
  points_1st: number
  points_2nd: number
  points_3rd: number
  points_4th: number
}

export default async function AuctionPage() {
  const supabase = await createClient()

  // Get active tournament with auction settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, entry_fee, salary_cap, bid_increment, auction_payouts')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Auction</h2>
        <p className="text-zinc-400">No tournament found. Create one first.</p>
      </div>
    )
  }

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')
    .order('display_name')

  // Get all teams for this tournament
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, seed, region_id')
    .eq('tournament_id', tournament.id)
    .order('seed')

  // Get auction assignments
  const { data: auctionTeams } = await supabase
    .from('auction_teams')
    .select('id, user_id, team_id, bid_amount')
    .eq('tournament_id', tournament.id)

  // Get regions for grouping
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name, position')
    .eq('tournament_id', tournament.id)
    .order('position')

  // Get auction entries (payment status)
  const { data: auctionEntries } = await supabase
    .from('auction_entries')
    .select('id, user_id, has_paid, paid_at')
    .eq('tournament_id', tournament.id)

  const settings = {
    entryFee: tournament.entry_fee ?? 20,
    salaryCap: tournament.salary_cap ?? 100,
    bidIncrement: tournament.bid_increment ?? 5,
    payouts: (tournament.auction_payouts as AuctionPayouts) ?? {
      championship_winner: 80,
      championship_runnerup: 50,
      points_1st: 110,
      points_2nd: 80,
      points_3rd: 60,
      points_4th: 40,
    },
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Auction</h2>

      <AuctionSettings tournamentId={tournament.id} settings={settings} />

      <AuctionEditor
        tournamentId={tournament.id}
        users={users || []}
        teams={teams || []}
        regions={regions || []}
        auctionTeams={auctionTeams || []}
        auctionEntries={auctionEntries || []}
        settings={settings}
      />
    </div>
  )
}
