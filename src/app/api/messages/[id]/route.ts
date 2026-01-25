import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE - Admin-only message deletion
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify admin
    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const adminClient = createAdminClient()

    // First, check if the message has an image and delete it from storage
    const { data: message } = await adminClient
      .from('chat_messages')
      .select('image_url')
      .eq('id', id)
      .single()

    if (message?.image_url) {
      // Extract the path from the URL (format: .../chat-images/user_id/filename)
      const urlParts = message.image_url.split('/chat-images/')
      if (urlParts.length > 1) {
        const filePath = urlParts[1]
        await adminClient.storage
          .from('chat-images')
          .remove([filePath])
      }
    }

    // Delete the message
    const { error } = await adminClient
      .from('chat_messages')
      .delete()
      .eq('id', id)

    if (error) {
      console.error('Error deleting message:', error)
      return NextResponse.json({ error: 'Failed to delete message' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in message DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
