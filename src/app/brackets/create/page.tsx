import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CreateBracketClient } from './CreateBracketClient'

const BracketIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
  </svg>
)

export default async function CreateBracketPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get all users for participant selection
  const { data: users } = await supabase
    .from('users')
    .select('id, display_name, full_name')
    .eq('is_active', true)
    .order('display_name')

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-6 max-w-md mx-auto">
        <Link href="/brackets" className="text-zinc-400 hover:text-white text-sm">
          ← Back to Brackets
        </Link>

        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mt-4 mb-6 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BracketIcon />
          Create Bracket
        </h1>

        <CreateBracketClient users={users || []} />
      </div>
    </div>
  )
}
