import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

async function checkIsAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return null

  return user
}

export async function PATCH(request: Request) {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, isAdmin } = await request.json()

    if (!userId || typeof isAdmin !== 'boolean') {
      return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    const { error } = await adminClient
      .from('users')
      .update({ is_admin: isAdmin })
      .eq('id', userId)

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get request body
    const { phone, displayName } = await request.json()

    if (!phone || !displayName) {
      return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 })
    }

    // Use admin client to create user
    const adminClient = createAdminClient()

    // Create auth user with phone
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      phone,
      phone_confirm: true, // Auto-confirm the phone
    })

    if (authError) {
      // Check if user already exists
      if (authError.message.includes('already') || authError.message.includes('duplicate')) {
        return NextResponse.json({ error: 'A user with this phone number already exists' }, { status: 400 })
      }
      console.error('Auth error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    if (!authUser.user) {
      return NextResponse.json({ error: 'Failed to create auth user' }, { status: 500 })
    }

    // Create public.users record
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: authUser.user.id,
        phone,
        display_name: displayName,
      })

    if (profileError) {
      // Rollback: delete the auth user if profile creation fails
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      console.error('Profile error:', profileError)
      return NextResponse.json({ error: 'Failed to create user profile' }, { status: 500 })
    }

    return NextResponse.json({ success: true, userId: authUser.user.id })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
