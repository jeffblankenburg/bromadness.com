import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveUserId, getSimulatedUserId } from '@/lib/simulation'

// POST - Add or update a reaction (upsert)
export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeUserId = await getActiveUserId(user.id)
    const { message_id, emoji } = await request.json()

    if (!message_id || !emoji) {
      return NextResponse.json({ error: 'message_id and emoji required' }, { status: 400 })
    }

    // Basic emoji validation - should be a non-empty string
    if (typeof emoji !== 'string' || emoji.length === 0 || emoji.length > 10) {
      return NextResponse.json({ error: 'Invalid emoji' }, { status: 400 })
    }

    // Use admin client if simulating (to bypass RLS)
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId !== user.id
    const dbClient = isSimulating ? createAdminClient() : supabase

    // Upsert reaction (insert or update on conflict)
    const { data, error } = await dbClient
      .from('chat_reactions')
      .upsert(
        { message_id, user_id: activeUserId, emoji },
        { onConflict: 'message_id,user_id' }
      )
      .select(`
        id,
        emoji,
        created_at,
        user:users!chat_reactions_user_id_fkey(id, display_name)
      `)
      .single()

    if (error) {
      console.error('Error adding reaction:', error)
      return NextResponse.json({ error: 'Failed to add reaction' }, { status: 500 })
    }

    return NextResponse.json({ reaction: data })
  } catch (error) {
    console.error('Error in reactions POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Remove a reaction
export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const activeUserId = await getActiveUserId(user.id)
    const { message_id } = await request.json()

    if (!message_id) {
      return NextResponse.json({ error: 'message_id required' }, { status: 400 })
    }

    // Use admin client if simulating (to bypass RLS)
    const simulatedUserId = await getSimulatedUserId()
    const isSimulating = simulatedUserId && simulatedUserId !== user.id
    const dbClient = isSimulating ? createAdminClient() : supabase

    const { error } = await dbClient
      .from('chat_reactions')
      .delete()
      .eq('message_id', message_id)
      .eq('user_id', activeUserId)

    if (error) {
      console.error('Error removing reaction:', error)
      return NextResponse.json({ error: 'Failed to remove reaction' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in reactions DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
