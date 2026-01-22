import { createClient } from '@/lib/supabase/server'
import { TripCostManager } from './TripCostManager'

export default async function TripCostPage() {
  const supabase = await createClient()

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
        <h2 className="text-xl font-bold">Trip Cost</h2>
        <p className="text-zinc-400">No tournament found. Create one first.</p>
      </div>
    )
  }

  // Get all users
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')
    .order('display_name')

  // Get trip costs for this tournament
  const { data: tripCosts } = await supabase
    .from('trip_costs')
    .select('id, user_id, amount_owed')
    .eq('tournament_id', tournament.id)

  // Get all payments for these trip costs
  const tripCostIds = (tripCosts || []).map(tc => tc.id)
  let payments: Array<{
    id: string
    trip_cost_id: string
    amount: number
    note: string | null
    paid_at: string
  }> = []

  if (tripCostIds.length > 0) {
    const { data } = await supabase
      .from('trip_payments')
      .select('id, trip_cost_id, amount, note, paid_at')
      .in('trip_cost_id', tripCostIds)
      .order('paid_at', { ascending: false })
    payments = data || []
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Trip Cost</h2>
      <TripCostManager
        tournamentId={tournament.id}
        users={users || []}
        tripCosts={tripCosts || []}
        payments={payments}
      />
    </div>
  )
}
