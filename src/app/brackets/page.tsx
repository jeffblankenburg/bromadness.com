import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BracketsListClient } from './BracketsListClient'
import { getActiveUserId } from '@/lib/simulation'

const BracketIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
  </svg>
)

export default async function BracketsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active user ID (may be simulated)
  const activeUserId = await getActiveUserId(user.id)

  // Get brackets where user is a participant
  const { data: participantEntries } = await supabase
    .from('custom_bracket_participants')
    .select('bracket_id')
    .eq('user_id', activeUserId)

  const participantBracketIds = participantEntries?.map(e => e.bracket_id) || []

  // Get brackets user created OR is a participant in
  let bracketsQuery = supabase
    .from('custom_brackets')
    .select(`
      id,
      name,
      bracket_type,
      status,
      winner_id,
      created_by,
      created_at,
      custom_bracket_participants(id),
      creator:users!custom_brackets_created_by_fkey(display_name)
    `)
    .order('created_at', { ascending: false })

  // If user has participant entries, include those brackets too
  if (participantBracketIds.length > 0) {
    bracketsQuery = bracketsQuery.or(`created_by.eq.${activeUserId},id.in.(${participantBracketIds.join(',')})`)
  } else {
    bracketsQuery = bracketsQuery.eq('created_by', activeUserId)
  }

  const { data: brackets } = await bracketsQuery

  // Add participant count and owner info
  const bracketsWithCount = brackets?.map(b => ({
    id: b.id,
    name: b.name,
    bracket_type: b.bracket_type,
    status: b.status,
    winner_id: b.winner_id,
    created_at: b.created_at,
    participant_count: b.custom_bracket_participants?.length || 0,
    is_owner: b.created_by === activeUserId,
    creator_name: (b.creator as unknown as { display_name: string } | null)?.display_name || 'Unknown',
  })) || []

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-6 max-w-md mx-auto">
        <Link href="/info" className="text-zinc-400 hover:text-white text-sm">
          ← Info
        </Link>

        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mt-4 mb-6 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BracketIcon />
          Custom Brackets
        </h1>

        <BracketsListClient brackets={bracketsWithCount} />
      </div>
    </div>
  )
}
