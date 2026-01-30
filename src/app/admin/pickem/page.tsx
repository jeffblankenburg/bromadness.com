import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PaymentTracker } from './PaymentTracker'
import { PickemSettings } from './PickemSettings'
import { DeleteAllPicks } from './DeleteAllPicks'

interface PickemPayouts {
  entry_fee: number
  enabled_days?: string[]  // Day names like "Thursday", "Friday", etc.
  lock_individual?: boolean
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

  // Get enabled days from settings
  const payoutsData = (tournament.pickem_payouts as PickemPayouts) || { entry_fee: 10 }
  const enabledDaysFromSettings = payoutsData.enabled_days || ['Thursday', 'Friday']

  // Helper to get day name from date
  const getDayNameFromDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T12:00:00')
    return date.toLocaleDateString('en-US', { weekday: 'long' })
  }

  // Build a map of day name -> date from existing game dates
  const dayNameToDate: Record<string, string> = {}
  pickemDates.forEach(date => {
    dayNameToDate[getDayNameFromDate(date)] = date
  })

  // For enabled days without games, derive dates from existing ones
  // Thursday=0, Friday=1, Saturday=2, Sunday=3 offset from Thursday
  const dayOffsets: Record<string, number> = { Thursday: 0, Friday: 1, Saturday: 2, Sunday: 3 }

  // Find a reference date (preferably Thursday)
  const referenceDay = ['Thursday', 'Friday', 'Saturday', 'Sunday'].find(d => dayNameToDate[d])
  if (referenceDay) {
    const refDate = new Date(dayNameToDate[referenceDay] + 'T12:00:00')
    const refOffset = dayOffsets[referenceDay]

    enabledDaysFromSettings.forEach(dayName => {
      if (!dayNameToDate[dayName] && dayOffsets[dayName] !== undefined) {
        const dayOffset = dayOffsets[dayName] - refOffset
        const newDate = new Date(refDate)
        newDate.setDate(newDate.getDate() + dayOffset)
        const dateStr = newDate.toISOString().split('T')[0]
        dayNameToDate[dayName] = dateStr
      }
    })
  }

  // All dates we need (from games + derived for enabled days)
  const allNeededDates = [...new Set([
    ...pickemDates,
    ...enabledDaysFromSettings.map(d => dayNameToDate[d]).filter(Boolean)
  ])].sort()

  // Get pickem entries (for payment tracking) - join through pickem_days
  const { data: pickemDays } = await supabase
    .from('pickem_days')
    .select('id, contest_date')
    .eq('tournament_id', tournament.id)

  // Auto-create pickem_days for any dates that don't exist
  const existingDates = (pickemDays || []).map(d => d.contest_date)
  const missingDates = allNeededDates.filter(date => !existingDates.includes(date))

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
  }

  const enabledDays = payouts.enabled_days || ['Thursday', 'Friday'] // Default to Thu/Fri

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-end gap-2">
        <PickemSettings
          tournamentId={tournament.id}
          entryFee={payouts.entry_fee}
          enabledDays={enabledDays}
          lockIndividual={payouts.lock_individual ?? false}
        />
      </div>

      <PaymentTracker
        pickemDays={allPickemDays || []}
        users={users || []}
        pickemEntries={pickemEntries || []}
        games={games || []}
        pickemPicks={pickemPicks || []}
        entryFee={payouts.entry_fee}
        enabledDays={enabledDays}
      />

      <div className="pt-8 border-t border-zinc-800">
        <DeleteAllPicks tournamentId={tournament.id} />
      </div>
    </div>
  )
}
