import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getEasternNow } from '@/lib/timezone'

export async function GET(request: Request) {
  try {
    // Verify the request is from Vercel Cron
    const cronSecret = process.env.CRON_SECRET
    const authHeader = request.headers.get('authorization')
    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Get the active tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, start_date, pickem_payouts, brocket_payouts')
      .eq('is_active', true)
      .maybeSingle()

    if (tournamentError || !tournament) {
      return NextResponse.json({ message: 'No active tournament found' }, { status: 200 })
    }

    // Check if today is Thu/Fri/Sat of the first weekend
    const eastern = getEasternNow()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const todayStr = `${eastern.getFullYear()}-${pad(eastern.getMonth() + 1)}-${pad(eastern.getDate())}`

    // Tournament starts on Wednesday. First Thu/Fri/Sat are +1, +2, +3 days.
    const [year, month, day] = tournament.start_date.split('-').map(Number)
    const startDate = new Date(year, month - 1, day)

    const validDays: string[] = []
    for (let offset = 1; offset <= 3; offset++) {
      const d = new Date(startDate)
      d.setDate(d.getDate() + offset)
      validDays.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`)
    }

    if (!validDays.includes(todayStr)) {
      return NextResponse.json({
        message: `Today (${todayStr}) is not a pick reminder day`,
      }, { status: 200 })
    }

    const isFirstThursday = todayStr === validDays[0]

    // Get all active users
    const { data: users } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('is_active', true)

    if (!users || users.length === 0) {
      return NextResponse.json({ message: 'No active users' }, { status: 200 })
    }

    // Get today's pickem day
    const { data: pickemDay } = await supabase
      .from('pickem_days')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('contest_date', todayStr)
      .maybeSingle()

    // Get today's games (R1+R2)
    const { data: todayGames } = await supabase
      .from('games')
      .select('id')
      .eq('tournament_id', tournament.id)
      .in('round', [1, 2])
      .gte('scheduled_at', todayStr + 'T00:00:00')
      .lte('scheduled_at', todayStr + 'T23:59:59')

    const totalPickemGames = todayGames?.length || 0

    // Get pickem entries and picks for today
    let pickemEntries: Array<{ id: string; user_id: string }> = []
    let pickemPicks: Array<{ entry_id: string; game_id: string | null }> = []

    if (pickemDay && totalPickemGames > 0) {
      const { data: entries } = await supabase
        .from('pickem_entries')
        .select('id, user_id')
        .eq('pickem_day_id', pickemDay.id)

      pickemEntries = entries || []

      const entryIds = pickemEntries.map(e => e.id)
      const gameIds = (todayGames || []).map(g => g.id)
      if (entryIds.length > 0 && gameIds.length > 0) {
        const { data: picks } = await supabase
          .from('pickem_picks')
          .select('entry_id, game_id')
          .in('entry_id', entryIds)
          .in('game_id', gameIds)

        pickemPicks = picks || []
      }
    }

    // Get brocket data (only on first Thursday)
    let totalBrocketGames = 0
    let brocketEntries: Array<{ id: string; user_id: string }> = []
    let brocketPickCounts: Record<string, number> = {}

    if (isFirstThursday) {
      // Get all R1+R2 games
      const { data: allGames } = await supabase
        .from('games')
        .select('id, scheduled_at')
        .eq('tournament_id', tournament.id)
        .in('round', [1, 2])

      // Filter to Thu/Fri/Sat
      const brocketGames = (allGames || []).filter(g => {
        if (!g.scheduled_at) return false
        const d = new Date(g.scheduled_at.split('T')[0] + 'T12:00:00')
        return [4, 5, 6].includes(d.getDay())
      })
      totalBrocketGames = brocketGames.length

      if (totalBrocketGames > 0) {
        const { data: entries } = await supabase
          .from('brocket_entries')
          .select('id, user_id')
          .eq('tournament_id', tournament.id)

        brocketEntries = entries || []

        const entryIds = brocketEntries.map(e => e.id)
        const brocketGameIds = brocketGames.map(g => g.id)
        if (entryIds.length > 0) {
          const { data: picks } = await supabase
            .from('brocket_picks')
            .select('entry_id')
            .in('entry_id', entryIds)
            .in('game_id', brocketGameIds)

          // Count picks per entry
          for (const pick of picks || []) {
            brocketPickCounts[pick.entry_id] = (brocketPickCounts[pick.entry_id] || 0) + 1
          }
        }
      }
    }

    // Build list of users who need reminders
    const usersToNotify: Array<{ userId: string; pickemMissing: number; brocketMissing: number }> = []

    for (const user of users) {
      let userPickemMissing = 0
      let userBrocketMissing = 0

      // Check pickem
      if (totalPickemGames > 0) {
        const entry = pickemEntries.find(e => e.user_id === user.id)
        if (entry) {
          const userPicks = pickemPicks.filter(p => p.entry_id === entry.id).length
          userPickemMissing = totalPickemGames - userPicks
        } else {
          userPickemMissing = totalPickemGames
        }
      }

      // Check brocket (first Thursday only)
      if (isFirstThursday && totalBrocketGames > 0) {
        const entry = brocketEntries.find(e => e.user_id === user.id)
        if (entry) {
          const userPicks = brocketPickCounts[entry.id] || 0
          userBrocketMissing = totalBrocketGames - userPicks
        } else {
          userBrocketMissing = totalBrocketGames
        }
      }

      if (userPickemMissing > 0 || userBrocketMissing > 0) {
        usersToNotify.push({
          userId: user.id,
          pickemMissing: userPickemMissing,
          brocketMissing: userBrocketMissing,
        })
      }
    }

    if (usersToNotify.length === 0) {
      return NextResponse.json({ message: 'All users have completed their picks' }, { status: 200 })
    }

    // Send targeted push notifications
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.bromadness.com'
    let totalSent = 0
    let totalFailed = 0

    // Group users by notification message to batch sends
    const messageGroups: Record<string, string[]> = {}
    for (const user of usersToNotify) {
      const parts: string[] = []
      if (user.pickemMissing > 0) parts.push(`${user.pickemMissing} Pick'em pick${user.pickemMissing === 1 ? '' : 's'}`)
      if (user.brocketMissing > 0) parts.push(`${user.brocketMissing} Brocket pick${user.brocketMissing === 1 ? '' : 's'}`)
      const body = `You still need to make ${parts.join(' and ')} before games start!`

      if (!messageGroups[body]) messageGroups[body] = []
      messageGroups[body].push(user.userId)
    }

    for (const [body, userIds] of Object.entries(messageGroups)) {
      try {
        const pushRes = await fetch(`${baseUrl}/api/push/send`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
          },
          body: JSON.stringify({
            userIds,
            title: 'Picks Due Today!',
            body,
            data: { type: 'pick_reminder', url: '/pickem' },
          }),
        })

        if (pushRes.ok) {
          const pushData = await pushRes.json()
          totalSent += pushData.sent || 0
          totalFailed += pushData.failed || 0
        } else {
          console.error('Push notification request failed:', pushRes.status)
          totalFailed += userIds.length
        }
      } catch (err) {
        console.error('Failed to send pick reminder push notifications:', err)
        totalFailed += userIds.length
      }
    }

    return NextResponse.json({
      message: `Pick reminders sent: ${totalSent} success, ${totalFailed} failed`,
      usersNotified: usersToNotify.length,
      totalUsers: users.length,
    })
  } catch (error) {
    console.error('Error in pick reminder cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
