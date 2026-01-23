import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { setSimulatedUserId, clearSimulatedUserId, getSimulatedUserId } from '@/lib/simulation'

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

// GET - Get current simulation status
export async function GET() {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const simulatedUserId = await getSimulatedUserId()

    if (!simulatedUserId) {
      return NextResponse.json({ simulating: false })
    }

    // Get the simulated user's info
    const supabase = await createClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, display_name, phone')
      .eq('id', simulatedUserId)
      .single()

    if (!user) {
      // Invalid user ID in cookie, clear it
      await clearSimulatedUserId()
      return NextResponse.json({ simulating: false })
    }

    return NextResponse.json({
      simulating: true,
      user: {
        id: user.id,
        displayName: user.display_name,
        phone: user.phone
      }
    })
  } catch (error) {
    console.error('Error getting simulation status:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Start simulating a user
export async function POST(request: Request) {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 })
    }

    // Verify the user exists
    const supabase = await createClient()
    const { data: user } = await supabase
      .from('users')
      .select('id, display_name')
      .eq('id', userId)
      .single()

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    await setSimulatedUserId(userId)

    return NextResponse.json({
      success: true,
      message: `Now simulating ${user.display_name}`
    })
  } catch (error) {
    console.error('Error starting simulation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Stop simulating
export async function DELETE() {
  try {
    const admin = await checkIsAdmin()
    if (!admin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await clearSimulatedUserId()

    return NextResponse.json({ success: true, message: 'Simulation stopped' })
  } catch (error) {
    console.error('Error stopping simulation:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
