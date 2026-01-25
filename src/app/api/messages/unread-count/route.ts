import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET - Get count of unread messages + unread reactions on own messages
export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's last read timestamps for both messages and reactions
    const [{ data: messageReadStatus }, { data: reactionReadStatus }] = await Promise.all([
      supabase
        .from('chat_read_status')
        .select('last_read_at')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('chat_reaction_read_status')
        .select('last_read_at')
        .eq('user_id', user.id)
        .single()
    ])

    // Count unread messages (from others)
    let messageQuery = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .neq('user_id', user.id)

    if (messageReadStatus?.last_read_at) {
      messageQuery = messageQuery.gt('created_at', messageReadStatus.last_read_at)
    }

    const { count: messageCount, error: messageError } = await messageQuery

    if (messageError) {
      console.error('Error getting message count:', messageError)
      return NextResponse.json({ error: 'Failed to get unread count' }, { status: 500 })
    }

    // Count unread reactions on user's OWN messages (from others)
    // First get user's message IDs, then count reactions on those messages
    const { data: userMessages } = await supabase
      .from('chat_messages')
      .select('id')
      .eq('user_id', user.id)

    let reactionCount = 0
    if (userMessages && userMessages.length > 0) {
      const userMessageIds = userMessages.map(m => m.id)

      let reactionQuery = supabase
        .from('chat_reactions')
        .select('id', { count: 'exact', head: true })
        .in('message_id', userMessageIds)
        .neq('user_id', user.id) // Not my own reactions

      if (reactionReadStatus?.last_read_at) {
        reactionQuery = reactionQuery.gt('created_at', reactionReadStatus.last_read_at)
      }

      const { count, error: reactionError } = await reactionQuery

      if (reactionError) {
        console.error('Error getting reaction count:', reactionError)
        // Don't fail completely, just use 0 for reactions
      } else {
        reactionCount = count || 0
      }
    }

    return NextResponse.json({
      count: (messageCount || 0) + reactionCount,
      messageCount: messageCount || 0,
      reactionCount
    })
  } catch (error) {
    console.error('Error in messages/unread-count GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
