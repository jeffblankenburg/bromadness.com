import { createClient } from '@/lib/supabase/server'
import { AuctionBoardClient } from './AuctionBoardClient'

export default async function AuctionBoardPage() {
  const supabase = await createClient()

  // Get active tournament with auction settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, salary_cap, auction_complete, auction_order_seed, auction_first_participant_id, teams_per_player')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="p-6 text-center">
        <p className="text-zinc-400">No tournament found.</p>
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

  // Get auction entries (participation status)
  const { data: auctionEntries } = await supabase
    .from('auction_entries')
    .select('id, user_id, is_participating')
    .eq('tournament_id', tournament.id)

  return (
    <AuctionBoardClient
      tournamentId={tournament.id}
      tournamentName={tournament.name}
      salaryCap={tournament.salary_cap ?? 100}
      teamsPerPlayer={tournament.teams_per_player ?? 3}
      users={users || []}
      teams={teams || []}
      initialAuctionTeams={auctionTeams || []}
      auctionEntries={auctionEntries || []}
    />
  )
}
