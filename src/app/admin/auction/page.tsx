import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { AuctionEditor } from './AuctionEditor'
import { AuctionSettings } from './AuctionSettings'
import { AuctionFinishButton } from './AuctionFinishButton'
import { AuctionResetButton } from './AuctionResetButton'
import { HeaderAction } from '../HeaderAction'

export default async function AuctionPage() {
  const supabase = await createClient()

  // Get active tournament with auction settings
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, entry_fee, salary_cap, bid_increment, teams_per_player, auction_payouts, auction_complete, auction_first_participant_id')
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

  // Get auction entries (payment and participation status)
  const { data: auctionEntries } = await supabase
    .from('auction_entries')
    .select('id, user_id, has_paid, paid_at, is_participating')
    .eq('tournament_id', tournament.id)

  // Get regions for grouping
  const { data: regions } = await supabase
    .from('regions')
    .select('id, name, position')
    .eq('tournament_id', tournament.id)
    .order('position')

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

  // Build participants list (users who are participating in the auction)
  const participatingUserIds = new Set(
    (auctionEntries || []).filter(e => e.is_participating).map(e => e.user_id)
  )
  const participants = (users || [])
    .filter(u => participatingUserIds.has(u.id))
    .map(u => ({ id: u.id, display_name: u.display_name }))

  return (
    <div className="space-y-6">
      <HeaderAction>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/auction/board"
            className="p-1.5 rounded-lg bg-zinc-700/50 hover:bg-zinc-600/50 text-zinc-400 hover:text-white transition-colors"
            title="Auction Board"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25a2.25 2.25 0 0 1-2.25-2.25v-2.25Z" />
            </svg>
          </Link>
          <AuctionSettings
            tournamentId={tournament.id}
            settings={settings}
            participants={participants}
            firstParticipantId={tournament.auction_first_participant_id ?? null}
          />
        </div>
      </HeaderAction>

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

      <div className="pt-6 border-t border-zinc-700 flex gap-3">
        <AuctionFinishButton
          tournamentId={tournament.id}
          auctionComplete={tournament.auction_complete ?? false}
        />
        <AuctionResetButton tournamentId={tournament.id} />
      </div>
    </div>
  )
}
