import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveUserId } from '@/lib/simulation'
import { execFile } from 'child_process'
import { writeFile, readFile, unlink, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import ffmpegPath from 'ffmpeg-static'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: sounds, error } = await supabase
      .from('soundboard_items')
      .select('id, name, audio_url, image_url, created_by')
      .order('created_at', { ascending: true })

    if (error) {
      console.error('Fetch sounds error:', error)
      return NextResponse.json({ error: 'Failed to fetch sounds' }, { status: 500 })
    }

    return NextResponse.json({ sounds: sounds || [] })
  } catch (error) {
    console.error('Error fetching sounds:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeUserId = await getActiveUserId(user.id)

    // Check soundboard permission
    const { data: profile } = await supabase
      .from('users')
      .select('can_use_soundboard')
      .eq('id', activeUserId)
      .single()

    if (!profile?.can_use_soundboard) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const formData = await request.formData()
    const audio = formData.get('audio') as File | null
    const image = formData.get('image') as File | null
    const name = (formData.get('name') as string | null)?.trim()

    if (!audio || !image || !name) {
      return NextResponse.json({ error: 'Audio, image, and name are required' }, { status: 400 })
    }

    if (name.length > 50) {
      return NextResponse.json({ error: 'Name must be 50 characters or less' }, { status: 400 })
    }

    // Validate audio type (m4a, mp3, wav, ogg, webm)
    const validAudioTypes = ['mp4', 'm4a', 'aac', 'mpeg', 'mp3', 'wav', 'ogg', 'webm']
    if (!validAudioTypes.some(t => audio.type.includes(t))) {
      return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 })
    }

    // Validate audio size (2MB)
    if (audio.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Audio file too large (max 2MB)' }, { status: 400 })
    }

    // Validate image type
    if (!image.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 })
    }

    // Validate image size (500KB)
    if (image.size > 500 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 500KB)' }, { status: 400 })
    }

    const timestamp = Date.now()

    // Convert audio to MP3 using ffmpeg for universal browser compatibility
    let mp3Buffer: Buffer
    const tmpDir = await mkdtemp(join(tmpdir(), 'soundboard-'))
    const inputPath = join(tmpDir, `input-${timestamp}`)
    const outputPath = join(tmpDir, `output-${timestamp}.mp3`)

    try {
      const audioArrayBuffer = await audio.arrayBuffer()
      await writeFile(inputPath, Buffer.from(audioArrayBuffer))

      await new Promise<void>((resolve, reject) => {
        execFile(
          ffmpegPath!,
          ['-i', inputPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', '-y', outputPath],
          (error, _stdout, stderr) => {
            if (error) {
              console.error('ffmpeg stderr:', stderr)
              reject(error)
            } else {
              resolve()
            }
          }
        )
      })

      mp3Buffer = await readFile(outputPath)
    } catch (err) {
      console.error('Audio conversion error:', err)
      // Clean up temp files
      await unlink(inputPath).catch(() => {})
      await unlink(outputPath).catch(() => {})
      return NextResponse.json({ error: 'Failed to convert audio' }, { status: 500 })
    } finally {
      // Clean up temp files
      await unlink(inputPath).catch(() => {})
      await unlink(outputPath).catch(() => {})
    }

    // Upload converted MP3
    const audioFilename = `${activeUserId}/${timestamp}.mp3`
    const { data: audioData, error: audioError } = await supabase.storage
      .from('soundboard')
      .upload(audioFilename, mp3Buffer, {
        contentType: 'audio/mpeg',
        cacheControl: '31536000',
      })

    if (audioError) {
      console.error('Audio upload error:', audioError)
      return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
    }

    // Upload image
    const imgExt = image.type.split('/')[1] || 'jpg'
    const imageFilename = `${activeUserId}/${timestamp}-thumb.${imgExt}`
    const { data: imageData, error: imageError } = await supabase.storage
      .from('soundboard')
      .upload(imageFilename, image, {
        contentType: image.type,
        cacheControl: '31536000',
      })

    if (imageError) {
      // Clean up the audio file we already uploaded
      await supabase.storage.from('soundboard').remove([audioData.path])
      console.error('Image upload error:', imageError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Get public URLs
    const { data: { publicUrl: audioUrl } } = supabase.storage
      .from('soundboard')
      .getPublicUrl(audioData.path)

    const { data: { publicUrl: imageUrl } } = supabase.storage
      .from('soundboard')
      .getPublicUrl(imageData.path)

    // Insert DB record
    const { data: sound, error: dbError } = await supabase
      .from('soundboard_items')
      .insert({
        name,
        audio_url: audioUrl,
        image_url: imageUrl,
        created_by: activeUserId,
      })
      .select('id, name, audio_url, image_url, created_by')
      .single()

    if (dbError) {
      // Clean up storage files
      await supabase.storage.from('soundboard').remove([audioData.path, imageData.path])
      console.error('DB insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save sound' }, { status: 500 })
    }

    return NextResponse.json({ sound })
  } catch (error) {
    console.error('Error creating sound:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeUserId = await getActiveUserId(user.id)

    const formData = await request.formData()
    const soundId = formData.get('soundId') as string | null
    const name = (formData.get('name') as string | null)?.trim()
    const audio = formData.get('audio') as File | null
    const image = formData.get('image') as File | null

    if (!soundId) {
      return NextResponse.json({ error: 'Sound ID is required' }, { status: 400 })
    }

    if (name && name.length > 50) {
      return NextResponse.json({ error: 'Name must be 50 characters or less' }, { status: 400 })
    }

    // Check soundboard permission
    const { data: profile } = await supabase
      .from('users')
      .select('can_use_soundboard')
      .eq('id', activeUserId)
      .single()

    if (!profile?.can_use_soundboard) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Fetch the existing sound
    const { data: existing, error: fetchError } = await supabase
      .from('soundboard_items')
      .select('id, created_by, audio_url, image_url')
      .eq('id', soundId)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Sound not found' }, { status: 404 })
    }

    const adminClient = createAdminClient()
    const updates: Record<string, string> = {}
    const timestamp = Date.now()

    const extractPath = (url: string) => {
      const match = url.match(/soundboard\/(.+)$/)
      return match ? match[1] : null
    }

    // Handle audio replacement
    if (audio) {
      const validAudioTypes = ['mp4', 'm4a', 'aac', 'mpeg', 'mp3', 'wav', 'ogg', 'webm']
      if (!validAudioTypes.some(t => audio.type.includes(t))) {
        return NextResponse.json({ error: 'Unsupported audio format' }, { status: 400 })
      }
      if (audio.size > 2 * 1024 * 1024) {
        return NextResponse.json({ error: 'Audio file too large (max 2MB)' }, { status: 400 })
      }

      // Convert to MP3
      let mp3Buffer: Buffer
      const tmpDir = await mkdtemp(join(tmpdir(), 'soundboard-'))
      const inputPath = join(tmpDir, `input-${timestamp}`)
      const outputPath = join(tmpDir, `output-${timestamp}.mp3`)

      try {
        const audioArrayBuffer = await audio.arrayBuffer()
        await writeFile(inputPath, Buffer.from(audioArrayBuffer))

        await new Promise<void>((resolve, reject) => {
          execFile(
            ffmpegPath!,
            ['-i', inputPath, '-codec:a', 'libmp3lame', '-qscale:a', '2', '-y', outputPath],
            (error, _stdout, stderr) => {
              if (error) {
                console.error('ffmpeg stderr:', stderr)
                reject(error)
              } else {
                resolve()
              }
            }
          )
        })

        mp3Buffer = await readFile(outputPath)
      } catch (err) {
        console.error('Audio conversion error:', err)
        await unlink(inputPath).catch(() => {})
        await unlink(outputPath).catch(() => {})
        return NextResponse.json({ error: 'Failed to convert audio' }, { status: 500 })
      } finally {
        await unlink(inputPath).catch(() => {})
        await unlink(outputPath).catch(() => {})
      }

      // Upload new audio
      const audioFilename = `${existing.created_by}/${timestamp}.mp3`
      const { data: audioData, error: audioError } = await adminClient.storage
        .from('soundboard')
        .upload(audioFilename, mp3Buffer, {
          contentType: 'audio/mpeg',
          cacheControl: '31536000',
        })

      if (audioError) {
        console.error('Audio upload error:', audioError)
        return NextResponse.json({ error: 'Failed to upload audio' }, { status: 500 })
      }

      // Delete old audio
      const oldAudioPath = extractPath(existing.audio_url)
      if (oldAudioPath) {
        await adminClient.storage.from('soundboard').remove([oldAudioPath])
      }

      const { data: { publicUrl } } = adminClient.storage
        .from('soundboard')
        .getPublicUrl(audioData.path)
      updates.audio_url = publicUrl
    }

    // Handle image replacement
    if (image) {
      if (!image.type.startsWith('image/')) {
        return NextResponse.json({ error: 'Thumbnail must be an image' }, { status: 400 })
      }
      if (image.size > 500 * 1024) {
        return NextResponse.json({ error: 'Image too large (max 500KB)' }, { status: 400 })
      }

      const imgExt = image.type.split('/')[1] || 'jpg'
      const imageFilename = `${existing.created_by}/${timestamp}-thumb.${imgExt}`
      const { data: imageData, error: imageError } = await adminClient.storage
        .from('soundboard')
        .upload(imageFilename, image, {
          contentType: image.type,
          cacheControl: '31536000',
        })

      if (imageError) {
        console.error('Image upload error:', imageError)
        return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
      }

      // Delete old image
      const oldImagePath = extractPath(existing.image_url)
      if (oldImagePath) {
        await adminClient.storage.from('soundboard').remove([oldImagePath])
      }

      const { data: { publicUrl } } = adminClient.storage
        .from('soundboard')
        .getPublicUrl(imageData.path)
      updates.image_url = publicUrl
    }

    // Handle name change
    if (name) {
      updates.name = name
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No changes provided' }, { status: 400 })
    }

    const { data: sound, error: updateError } = await adminClient
      .from('soundboard_items')
      .update(updates)
      .eq('id', soundId)
      .select('id, name, audio_url, image_url, created_by')
      .single()

    if (updateError) {
      console.error('Update error:', updateError)
      return NextResponse.json({ error: 'Failed to update sound' }, { status: 500 })
    }

    return NextResponse.json({ sound })
  } catch (error) {
    console.error('Error updating sound:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { soundId } = await request.json()

    if (!soundId) {
      return NextResponse.json({ error: 'Sound ID is required' }, { status: 400 })
    }

    const activeUserId = await getActiveUserId(user.id)

    // Check soundboard permission
    const { data: profile } = await supabase
      .from('users')
      .select('can_use_soundboard')
      .eq('id', activeUserId)
      .single()

    if (!profile?.can_use_soundboard) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    // Fetch the sound
    const { data: sound, error: fetchError } = await supabase
      .from('soundboard_items')
      .select('id, created_by, audio_url, image_url')
      .eq('id', soundId)
      .single()

    if (fetchError || !sound) {
      return NextResponse.json({ error: 'Sound not found' }, { status: 404 })
    }

    const adminClient = createAdminClient()

    // Extract storage paths from URLs
    const extractPath = (url: string) => {
      const match = url.match(/soundboard\/(.+)$/)
      return match ? match[1] : null
    }

    const audioPath = extractPath(sound.audio_url)
    const imagePath = extractPath(sound.image_url)

    // Delete storage files
    const pathsToDelete = [audioPath, imagePath].filter((p): p is string => p !== null)
    if (pathsToDelete.length > 0) {
      await adminClient.storage.from('soundboard').remove(pathsToDelete)
    }

    // Delete DB record
    const { error: deleteError } = await adminClient
      .from('soundboard_items')
      .delete()
      .eq('id', soundId)

    if (deleteError) {
      console.error('Delete error:', deleteError)
      return NextResponse.json({ error: 'Failed to delete sound' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting sound:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
