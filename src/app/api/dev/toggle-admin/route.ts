import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// DEV ONLY - Remove before launch
export async function POST() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  // Get current admin status
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // Toggle admin status
  const { error } = await supabase
    .from('users')
    .update({ is_admin: !profile.is_admin })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ is_admin: !profile.is_admin })
}
