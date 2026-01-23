import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getActiveUserId } from '@/lib/simulation'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeUserId = await getActiveUserId(user.id)

    const formData = await request.formData()
    const file = formData.get('image') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No image provided' }, { status: 400 })
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    // Limit file size (already compressed on client, but double-check)
    const maxSize = 500 * 1024 // 500KB
    if (file.size > maxSize) {
      return NextResponse.json({ error: 'Image too large (max 500KB)' }, { status: 400 })
    }

    // Generate unique filename
    const ext = file.type.split('/')[1] || 'jpg'
    const filename = `${activeUserId}/${Date.now()}.${ext}`

    // Upload to Supabase storage
    const { data, error } = await supabase.storage
      .from('chat-images')
      .upload(filename, file, {
        contentType: file.type,
        cacheControl: '31536000', // 1 year cache
      })

    if (error) {
      console.error('Storage upload error:', error)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('chat-images')
      .getPublicUrl(data.path)

    return NextResponse.json({ url: publicUrl })
  } catch (error) {
    console.error('Error in image upload:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
