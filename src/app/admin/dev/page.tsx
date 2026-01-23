import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { TimeSimulator } from '@/components/TimeSimulator'
import { UserSimulator } from '@/components/UserSimulator'
import { StorageUsage } from '@/components/StorageUsage'
import { getSimulatedUserId } from '@/lib/simulation'

export default async function AdminDevPage() {
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

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year, dev_simulated_time')
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

  // Get Round 1 & 2 games for first game times
  const { data: games } = await supabase
    .from('games')
    .select('id, scheduled_at')
    .eq('tournament_id', tournament.id)
    .in('round', [1, 2])
    .order('scheduled_at')

  // Group games by date to get first game times
  const gamesByDate = (games || []).reduce((acc, game) => {
    if (!game.scheduled_at) return acc
    const date = game.scheduled_at.split('T')[0]
    if (!acc[date]) acc[date] = []
    acc[date].push(game)
    return acc
  }, {} as Record<string, typeof games>)

  const firstGameTimes = Object.entries(gamesByDate)
    .map(([date, dayGames]) => {
      const sorted = [...(dayGames || [])].sort((a, b) =>
        (a.scheduled_at || '').localeCompare(b.scheduled_at || '')
      )
      return {
        date,
        time: sorted[0]?.scheduled_at || '',
      }
    })
    .filter(g => g.time)
    .sort((a, b) => a.date.localeCompare(b.date))

  // Fetch all users for user simulation
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, phone')
    .order('display_name')

  // Get current simulated user
  const simulatedUserId = await getSimulatedUserId()
  let currentSimulatedUser = null
  if (simulatedUserId) {
    const { data: simUser } = await supabase
      .from('users')
      .select('id, display_name, phone')
      .eq('id', simulatedUserId)
      .single()
    currentSimulatedUser = simUser
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-400">
        These tools are for testing and development purposes only.
      </p>

      <TimeSimulator
        tournamentId={tournament.id}
        currentSimulatedTime={tournament.dev_simulated_time as string | null}
        firstGameTimes={firstGameTimes}
      />

      <UserSimulator
        users={users || []}
        currentSimulatedUser={currentSimulatedUser}
      />

      <StorageUsage />
    </div>
  )
}
