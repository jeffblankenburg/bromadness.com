import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const url = new URL(request.url)
    const key = url.searchParams.get('key')

    if (key) {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', key)
        .single()

      if (error) return NextResponse.json({ error: 'Setting not found' }, { status: 404 })
      return NextResponse.json({ value: data.value })
    }

    const { data, error } = await supabase
      .from('app_settings')
      .select('key, value')

    if (error) return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 })
    return NextResponse.json({ settings: data || [] })
  } catch (error) {
    console.error('Error fetching app settings:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabase
      .from('users')
      .select('is_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { key, value } = await request.json()
    if (!key || value === undefined) {
      return NextResponse.json({ error: 'key and value required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('app_settings')
      .upsert({ key, value: String(value), updated_by: user.id, updated_at: new Date().toISOString() })

    if (error) {
      console.error('Error updating app setting:', error)
      return NextResponse.json({ error: 'Failed to update setting' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating app setting:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
