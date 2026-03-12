import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveUserId, getSimulatedUserId } from '@/lib/simulation'

// GET - Fetch messages with sender info
export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active user ID (may be simulated)
    const activeUserId = await getActiveUserId(user.id)

    const { searchParams } = new URL(request.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    const before = searchParams.get('before') // ISO timestamp for pagination

    let query = supabase
      .from('chat_messages')
      .select(`
        id,
        content,
        gif_url,
        image_url,
        created_at,
        is_system,
        system_name,
        user:users!chat_messages_user_id_fkey(id, display_name)
      `)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (before) {
      query = query.lt('created_at', before)
    }

    const { data: messages, error } = await query

    if (error) {
      console.error('Error fetching messages:', error)
      return NextResponse.json({ error: 'Failed to fetch messages' }, { status: 500 })
    }

    // Check if active user is admin (uses simulated user when simulating)
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', activeUserId)
      .single()

    // Reverse to get chronological order for display
    const hasMore = (messages?.length || 0) === limit
    return NextResponse.json({
      messages: (messages || []).reverse(),
      activeUserId,
      hasMore,
      isAdmin: profile?.is_admin || false
    })
  } catch (error) {
    console.error('Error in messages GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Send new message
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active user ID (may be simulated)
    const activeUserId = await getActiveUserId(user.id)

    const { content, gif_url, image_url } = await request.json()

    // Must have either content, gif_url, or image_url
    const hasContent = content && typeof content === 'string' && content.trim().length > 0

    // Validate GIF URLs against trusted Giphy domains
    const trustedGifDomains = ['media.giphy.com', 'media0.giphy.com', 'media1.giphy.com', 'media2.giphy.com', 'media3.giphy.com', 'media4.giphy.com']
    let hasGif = false
    if (gif_url && typeof gif_url === 'string') {
      try {
        const gifHost = new URL(gif_url).hostname
        hasGif = trustedGifDomains.includes(gifHost)
      } catch { hasGif = false }
    }

    // Validate image URLs against Supabase storage domain
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
    let hasImage = false
    if (image_url && typeof image_url === 'string') {
      try {
        const imgUrl = new URL(image_url)
        const supabaseHost = supabaseUrl ? new URL(supabaseUrl).hostname : ''
        hasImage = imgUrl.hostname === supabaseHost
      } catch { hasImage = false }
    }

    if (!hasContent && !hasGif && !hasImage) {
      return NextResponse.json({ error: 'Message content, GIF, or image required' }, { status: 400 })
    }

    if (hasContent && content.length > 500) {
      return NextResponse.json({ error: 'Message too long (max 500 chars)' }, { status: 400 })
    }

    const insertData: { user_id: string; content?: string; gif_url?: string; image_url?: string } = {
      user_id: activeUserId,
    }
    if (hasContent) insertData.content = content.trim()
    if (hasGif) insertData.gif_url = gif_url
    if (hasImage) insertData.image_url = image_url

    // Use admin client if simulating (to bypass RLS)
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId !== user.id
    const dbClient = isSimulating ? createAdminClient() : supabase

    const { data, error } = await dbClient
      .from('chat_messages')
      .insert(insertData)
      .select(`
        id,
        content,
        gif_url,
        image_url,
        created_at,
        is_system,
        system_name,
        user:users!chat_messages_user_id_fkey(id, display_name)
      `)
      .single()

    if (error) {
      console.error('Error sending message:', error)
      return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })
    }

    // Send push notifications to other users (fire and forget)
    const senderName = (data.user as { display_name?: string })?.display_name || 'Someone'
    let notificationBody = 'Sent a message'
    if (hasContent) {
      notificationBody = content.trim().length > 50
        ? content.trim().substring(0, 50) + '...'
        : content.trim()
    } else if (hasGif) {
      notificationBody = 'Sent a GIF'
    } else if (hasImage) {
      notificationBody = 'Sent an image'
    }

    // Send push notifications to other users (fire and forget)
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://www.bromadness.com'

    fetch(`${baseUrl}/api/push/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        excludeUserId: activeUserId,
        title: senderName,
        body: notificationBody,
        data: {
          type: 'chat_message',
          messageId: data.id,
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) {
          console.error('Push notification request failed:', res.status)
        }
      })
      .catch(err => {
        console.error('Failed to send push notifications:', err)
      })

    return NextResponse.json({ message: data })
  } catch (error) {
    console.error('Error in messages POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
