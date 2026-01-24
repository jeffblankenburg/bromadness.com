import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE() {
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

    const adminClient = createAdminClient()

    // Step 1: Delete all files from chat-images bucket
    // First, list all folders (user IDs)
    const { data: folders, error: listError } = await adminClient.storage
      .from('chat-images')
      .list('', { limit: 10000 })

    if (listError) {
      console.error('Error listing storage folders:', listError)
      return NextResponse.json({ error: 'Failed to list storage' }, { status: 500 })
    }

    // Delete files in each folder
    for (const folder of folders || []) {
      if (folder.id && !folder.metadata?.size) {
        // This is a folder, list and delete its contents
        const { data: files } = await adminClient.storage
          .from('chat-images')
          .list(folder.name, { limit: 10000 })

        if (files && files.length > 0) {
          const filePaths = files.map(f => `${folder.name}/${f.name}`)
          const { error: deleteError } = await adminClient.storage
            .from('chat-images')
            .remove(filePaths)

          if (deleteError) {
            console.error('Error deleting files in folder:', folder.name, deleteError)
          }
        }
      } else if (folder.metadata?.size) {
        // This is a file at root level
        const { error: deleteError } = await adminClient.storage
          .from('chat-images')
          .remove([folder.name])

        if (deleteError) {
          console.error('Error deleting root file:', folder.name, deleteError)
        }
      }
    }

    // Step 2: Delete all chat messages from database
    const { error: deleteMessagesError } = await adminClient
      .from('chat_messages')
      .delete()
      .gte('id', '00000000-0000-0000-0000-000000000000') // Match all rows

    if (deleteMessagesError) {
      console.error('Error deleting messages:', deleteMessagesError)
      return NextResponse.json({ error: 'Failed to delete messages' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in chat delete-all:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
