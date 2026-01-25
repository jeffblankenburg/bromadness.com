import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSimulatedUserId } from '@/lib/simulation'

// GET - Get bracket detail
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get active user ID (may be simulated)
    const simulatedUserId = await getSimulatedUserId()
    const activeUserId = simulatedUserId || user.id

    // Fetch bracket
    const { data: bracket, error: bracketError } = await supabase
      .from('custom_brackets')
      .select('*')
      .eq('id', id)
      .single()

    if (bracketError || !bracket) {
      return NextResponse.json({ error: 'Bracket not found' }, { status: 404 })
    }

    // Fetch participants with user info
    const { data: participants, error: participantsError } = await supabase
      .from('custom_bracket_participants')
      .select(`
        id,
        bracket_id,
        user_id,
        seed,
        is_eliminated,
        eliminated_at,
        created_at,
        users:user_id(display_name)
      `)
      .eq('bracket_id', id)
      .order('seed', { ascending: true })

    if (participantsError) {
      console.error('Error fetching participants:', participantsError)
      return NextResponse.json({ error: 'Failed to fetch participants' }, { status: 500 })
    }

    // Fetch matches
    const { data: matches, error: matchesError } = await supabase
      .from('custom_bracket_matches')
      .select('*')
      .eq('bracket_id', id)
      .order('bracket_side', { ascending: true })
      .order('round', { ascending: true })
      .order('match_number', { ascending: true })

    if (matchesError) {
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
    }

    // Transform participants to include display_name
    const participantsWithNames = participants?.map(p => ({
      ...p,
      display_name: (p.users as unknown as { display_name: string } | null)?.display_name || 'Unknown',
      users: undefined,
    })) || []

    return NextResponse.json({
      bracket,
      participants: participantsWithNames,
      matches: matches || [],
      isOwner: bracket.created_by === activeUserId,
    })
  } catch (error) {
    console.error('Error in bracket detail API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete bracket
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check for simulation
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId !== user.id

    // If simulating, verify the caller is an admin
    if (isSimulating) {
      const { data: profile } = await supabase
        .from('users')
        .select('is_admin')
        .eq('id', user.id)
        .single()

      if (!profile?.is_admin) {
        return NextResponse.json({ error: 'Unauthorized - admin required for simulation' }, { status: 403 })
      }
    }

    const activeUserId = simulatedUserId || user.id
    const dbClient = isSimulating ? createAdminClient() : supabase

    // Verify ownership
    const { data: bracket, error: bracketError } = await supabase
      .from('custom_brackets')
      .select('created_by')
      .eq('id', id)
      .single()

    if (bracketError || !bracket) {
      return NextResponse.json({ error: 'Bracket not found' }, { status: 404 })
    }

    if (bracket.created_by !== activeUserId) {
      return NextResponse.json({ error: 'Not authorized to delete this bracket' }, { status: 403 })
    }

    // Delete bracket (cascade will handle participants and matches)
    const { error: deleteError } = await dbClient
      .from('custom_brackets')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting bracket:', deleteError)
      return NextResponse.json({ error: 'Failed to delete bracket' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in bracket delete API:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
