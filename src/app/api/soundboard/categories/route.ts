import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getActiveUserId } from '@/lib/simulation'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: categories, error } = await supabase
      .from('soundboard_categories')
      .select('id, name, sort_order, created_by')
      .order('sort_order', { ascending: true })

    if (error) {
      console.error('Fetch categories error:', error)
      return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 })
    }

    return NextResponse.json({ categories: categories || [] })
  } catch (error) {
    console.error('Error fetching categories:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const activeUserId = await getActiveUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('can_use_soundboard')
      .eq('id', activeUserId)
      .single()

    if (!profile?.can_use_soundboard) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const { name } = await request.json()
    if (!name?.trim() || name.trim().length > 30) {
      return NextResponse.json({ error: 'Name required (max 30 chars)' }, { status: 400 })
    }

    const { data: maxRow } = await supabase
      .from('soundboard_categories')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .single()

    const nextSort = (maxRow?.sort_order ?? 0) + 1

    const { data: category, error } = await supabase
      .from('soundboard_categories')
      .insert({ name: name.trim(), sort_order: nextSort, created_by: activeUserId })
      .select('id, name, sort_order, created_by')
      .single()

    if (error) {
      console.error('Create category error:', error)
      return NextResponse.json({ error: 'Failed to create category' }, { status: 500 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error creating category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const activeUserId = await getActiveUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('can_use_soundboard')
      .eq('id', activeUserId)
      .single()

    if (!profile?.can_use_soundboard) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const { categoryId, name } = await request.json()
    if (!categoryId || !name?.trim()) {
      return NextResponse.json({ error: 'categoryId and name required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: category, error } = await adminClient
      .from('soundboard_categories')
      .update({ name: name.trim() })
      .eq('id', categoryId)
      .select('id, name, sort_order, created_by')
      .single()

    if (error) {
      console.error('Update category error:', error)
      return NextResponse.json({ error: 'Failed to update category' }, { status: 500 })
    }

    return NextResponse.json({ category })
  } catch (error) {
    console.error('Error updating category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const activeUserId = await getActiveUserId(user.id)

    const { data: profile } = await supabase
      .from('users')
      .select('can_use_soundboard')
      .eq('id', activeUserId)
      .single()

    if (!profile?.can_use_soundboard) {
      return NextResponse.json({ error: 'Not allowed' }, { status: 403 })
    }

    const { categoryId } = await request.json()
    if (!categoryId) {
      return NextResponse.json({ error: 'categoryId required' }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { error } = await adminClient
      .from('soundboard_categories')
      .delete()
      .eq('id', categoryId)

    if (error) {
      console.error('Delete category error:', error)
      return NextResponse.json({ error: 'Failed to delete category' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting category:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
