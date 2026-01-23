import { createClient } from '@/lib/supabase/server'
import { AuctionEditor } from './AuctionEditor'
import { AuctionSettings } from './AuctionSettings'
import { AuctionFinishButton } from './AuctionFinishButton'

export default async function AuctionPage() {
  const supabase = await createClient()

  // Get active tournament with auction settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, entry_fee, salary_cap, bid_increment, teams_per_player, auction_payouts, auction_complete')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
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

  // Get round 1 games to show opponents
  const { data: games } = await supabase
    .from('games')
    .select('id, team1_id, team2_id')
    .eq('tournament_id', tournament.id)
    .eq('round', 1)

  const settings = {
    entryFee: tournament.entry_fee ?? 20,
    salaryCap: tournament.salary_cap ?? 100,
    bidIncrement: tournament.bid_increment ?? 5,
    teamsPerPlayer: tournament.teams_per_player ?? 3,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end">
        <AuctionSettings tournamentId={tournament.id} settings={settings} />
      </div>

      <AuctionEditor
        tournamentId={tournament.id}
        users={users || []}
        teams={teams || []}
        regions={regions || []}
        auctionTeams={auctionTeams || []}
        auctionEntries={auctionEntries || []}
        games={games || []}
        settings={settings}
      />

      <div className="pt-6 border-t border-zinc-700">
        <AuctionFinishButton
          tournamentId={tournament.id}
          auctionComplete={tournament.auction_complete ?? false}
        />
      </div>
    </div>
  )
}
