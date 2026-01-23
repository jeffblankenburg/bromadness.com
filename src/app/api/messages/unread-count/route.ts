import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Get count of unread messages
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's last read timestamp
    const { data: readStatus } = await supabase
      .from('chat_read_status')
      .select('last_read_at')
      .eq('user_id', user.id)
      .single()

    // Build query - if no read status, count all messages (first time user)
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })

    if (readStatus?.last_read_at) {
      query = query.gt('created_at', readStatus.last_read_at)
    }

    const { count, error } = await query

    if (error) {
      console.error('Error getting unread count:', error)
      return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 })
    }

    return NextResponse.json({ count: count || 0 })
  } catch (error) {
    console.error('Error in messages/unread-count GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
