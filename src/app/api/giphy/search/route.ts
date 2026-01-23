import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const GIPHY_API_KEY = process.env.GIPHY_API_KEY

export async function GET(request: Request) {
  try {
    // Verify user is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!GIPHY_API_KEY) {
      console.error('GIPHY_API_KEY is not set in environment variables')
      return NextResponse.json({ error: 'Giphy API key not configured' }, { status: 500 })
    }

    console.log('Giphy API key found, length:', GIPHY_API_KEY.length)

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q')
    const limit = searchParams.get('limit') || '20'

    const url = query
      ? `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(query)}&limit=${limit}&rating=pg-13`
      : `https://api.giphy.com/v1/gifs/trending?api_key=${GIPHY_API_KEY}&limit=${limit}&rating=pg-13`

    const res = await fetch(url)
    const data = await res.json()

    if (!res.ok) {
      console.error('Giphy API error:', data)
      return NextResponse.json({ error: 'Giphy API error', details: data }, { status: 500 })
    }

    return NextResponse.json({ gifs: data.data || [] })
  } catch (error) {
    console.error('Error searching Giphy:', error)
    return NextResponse.json({ error: 'Failed to search GIFs' }, { status: 500 })
  }
}
