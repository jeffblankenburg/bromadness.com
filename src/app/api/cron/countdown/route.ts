import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { COUNTDOWN_MESSAGES } from '@/lib/countdown-messages'

export async function GET(request: Request) {
  try {
    // Verify the request is from Vercel Cron
    const authHeader = request.headers.get('authorization')
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Get the active tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, start_date, name')
      .eq('is_active', true)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ message: 'No active tournament found' }, { status: 200 })
    }

    // Calculate days remaining in Eastern time
    const now = new Date()
    const eastern = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }))
    const todayET = new Date(eastern.getFullYear(), eastern.getMonth(), eastern.getDate())

    // start_date is the first game day — the trip starts the day before
    const [year, month, day] = tournament.start_date.split('-').map(Number)
    const tripStartDate = new Date(year, month - 1, day - 1)

    const diffMs = tripStartDate.getTime() - todayET.getTime()
    const daysRemaining = Math.round(diffMs / (1000 * 60 * 60 * 24))

    // Only post if we're in the 1-20 day countdown range
    if (daysRemaining < 1 || daysRemaining > 20) {
      return NextResponse.json({
        message: `${daysRemaining} days remaining — outside countdown range (1-20)`,
      }, { status: 200 })
    }

    const content = COUNTDOWN_MESSAGES[daysRemaining]
    if (!content) {
      return NextResponse.json({ message: `No message for day ${daysRemaining}` }, { status: 200 })
    }

    // Build the countdown image URL from Supabase Storage
    const imageUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/countdown/${daysRemaining}.png`

    // Insert the system message
    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert({
        content,
        image_url: imageUrl,
        is_system: true,
        system_name: 'Hoops',
        user_id: null,
      })

    if (insertError) {
      console.error('Error inserting countdown message:', insertError)
      return NextResponse.json({ error: 'Failed to insert message' }, { status: 500 })
    }

    // Send push notification to all users
    const host = request.headers.get('host') || 'www.bromadness.com'
    const protocol = host.includes('localhost') ? 'http' : 'https'
    const baseUrl = `${protocol}://${host}`

    fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.SUPABASE_SERVICE_ROLE_KEY || '',
      },
      body: JSON.stringify({
        title: 'Hoops',
        body: content,
        data: { type: 'chat_message' },
      }),
    }).catch(err => {
      console.error('Failed to send countdown push notifications:', err)
    })

    return NextResponse.json({
      message: `Countdown posted: ${daysRemaining} days remaining`,
      content,
    })
  } catch (error) {
    console.error('Error in countdown cron:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
