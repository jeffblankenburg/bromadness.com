import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST - Mark reactions as read (update last_read timestamp)
export async function POST() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { error } = await supabase
      .from('chat_reaction_read_status')
      .upsert(
        { user_id: user.id, last_read_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('Error updating reaction read status:', error)
      return NextResponse.json({ error: 'Failed to update status' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in reactions/read POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
