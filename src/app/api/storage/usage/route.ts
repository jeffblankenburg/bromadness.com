import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
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

    // Use admin client to list all files in the bucket
    const adminClient = createAdminClient()

    // List all files recursively
    const { data: files, error } = await adminClient.storage
      .from('chat-images')
      .list('', {
        limit: 10000,
        sortBy: { column: 'created_at', order: 'desc' }
      })

    if (error) {
      console.error('Storage list error:', error)
      return NextResponse.json({ error: 'Failed to get storage usage' }, { status: 500 })
    }

    // Calculate total size by listing files in each user folder
    let totalSize = 0
    let totalFiles = 0

    // Files at root level
    for (const file of files || []) {
      if (file.metadata?.size) {
        totalSize += file.metadata.size
        totalFiles++
      } else if (file.id) {
        // This is a folder, list its contents
        const { data: folderFiles } = await adminClient.storage
          .from('chat-images')
          .list(file.name, { limit: 10000 })

        for (const folderFile of folderFiles || []) {
          if (folderFile.metadata?.size) {
            totalSize += folderFile.metadata.size
            totalFiles++
          }
        }
      }
    }

    return NextResponse.json({
      totalBytes: totalSize,
      totalFiles,
      limitBytes: 1024 * 1024 * 1024, // 1GB free tier limit
      usagePercent: (totalSize / (1024 * 1024 * 1024)) * 100
    })
  } catch (error) {
    console.error('Error in storage usage:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
