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

export async function PUT(request: Request) {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId, displayName, fullName, phone } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Normalize phone to 10 digits if provided
    const phone10 = phone ? phone.replace(/\D/g, '').slice(-10) : null

    const adminClient = createAdminClient()

    // Get current user data to check what actually changed
    const { data: currentUser } = await adminClient
      .from('users')
      .select('phone')
      .eq('id', userId)
      .single()

    // Build update object with only provided fields
    const updates: Record<string, string> = {}
    if (displayName !== undefined) updates.display_name = displayName
    if (fullName !== undefined) updates.full_name = fullName

    // Only include phone in updates if it actually changed
    const phoneChanged = phone10 && currentUser?.phone !== phone10
    if (phoneChanged) updates.phone = phone10

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
    }

    // If phone actually changed, also update in auth.users (no + prefix)
    if (phoneChanged) {
      const { error: authError } = await adminClient.auth.admin.updateUserById(userId, {
        phone: `1${phone10}`,
      })
      if (authError) {
        console.error('Auth update error:', authError)
        return NextResponse.json({ error: authError.message || 'Failed to update phone number' }, { status: 500 })
      }
    }

    const { error } = await adminClient
      .from('users')
      .update(updates)
      .eq('id', userId)

    if (error) {
      console.error('Update error:', error)
      return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating user:', error)
    const message = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Prevent deleting yourself
    if (userId === admin.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Delete from auth.users (this will cascade to public.users due to foreign key)
    const { error } = await adminClient.auth.admin.deleteUser(userId)

    if (error) {
      console.error('Delete error:', error)
      return NextResponse.json({ error: 'Failed to delete user' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting user:', error)
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
    const { phone, displayName, fullName } = await request.json()

    if (!phone || !displayName) {
      return NextResponse.json({ error: 'Phone and name are required' }, { status: 400 })
    }

    // Normalize to 10 digits
    const phone10 = phone.replace(/\D/g, '').slice(-10)
    if (phone10.length !== 10) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 })
    }

    // Use admin client to create user
    const adminClient = createAdminClient()

    // Create auth user with phone (no + prefix - matches what signInWithOtp stores)
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      phone: `1${phone10}`,
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

    // Create public.users record (store just 10 digits)
    const { error: profileError } = await adminClient
      .from('users')
      .insert({
        id: authUser.user.id,
        phone: phone10,
        display_name: displayName,
        full_name: fullName || null,
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
