import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Check if user is admin
  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    redirect('/')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white">
      <header className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-lg font-bold text-orange-500">Admin</h1>
            <Link href="/" className="text-sm text-zinc-400 hover:text-white">
              ← Back to app
            </Link>
          </div>
          <nav className="flex gap-4 mt-3 text-sm">
            <Link href="/admin/tournament" className="text-zinc-400 hover:text-white">
              Tournament
            </Link>
            <Link href="/admin/results" className="text-zinc-400 hover:text-white">
              Results
            </Link>
            <Link href="/admin/users" className="text-zinc-400 hover:text-white">
              Users
            </Link>
            <Link href="/admin/expenses" className="text-zinc-400 hover:text-white">
              Expenses
            </Link>
          </nav>
        </div>
      </header>
      <div className="p-4">
        {children}
      </div>
    </div>
  )
}
