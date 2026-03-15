import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

// DELETE - Delete all parlays for a tournament (admin only)
export async function DELETE(request: Request) {
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
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    const { tournamentId } = await request.json()

    if (!tournamentId) {
      return NextResponse.json({ error: 'Tournament ID required' }, { status: 400 })
    }

    const adminClient = createAdminClient()

    // Delete all parlays for this tournament (parlay_picks cascade automatically)
    const { error: deleteError } = await adminClient
      .from('parlays')
      .delete()
      .eq('tournament_id', tournamentId)

    if (deleteError) {
      console.error('Error deleting parlays:', deleteError)
      return NextResponse.json({ error: 'Failed to delete parlays' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in admin parlays DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
