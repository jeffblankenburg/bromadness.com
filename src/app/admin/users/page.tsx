import { createClient } from '@/lib/supabase/server'
import { UserList } from './UserList'

export default async function UsersPage() {
  const supabase = await createClient()

  const { data: users } = await supabase
    .from('users')
    .select('id, phone, display_name, is_admin, is_active, created_at')
    .order('display_name')

  return (
    <div className="space-y-6">
      <UserList users={users || []} />
    </div>
  )
}
