import { createClient } from '@/lib/supabase/server'
import { User } from '@supabase/supabase-js'

interface AdminCheckResult {
  user: User
  supabase: Awaited<ReturnType<typeof createClient>>
}

/**
 * Checks if the current user is authenticated and is an admin.
 * Returns the user and supabase client if admin, null otherwise.
 */
export async function checkIsAdmin(): Promise<AdminCheckResult | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) return null

  return { user, supabase }
}
