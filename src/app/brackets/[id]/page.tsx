import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { BracketDetailClient } from './BracketDetailClient'
import { getActiveUserId } from '@/lib/simulation'

const BracketIcon = () => (
  <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
  </svg>
)

export default async function BracketDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Get active user ID (may be simulated)
  const activeUserId = await getActiveUserId(user.id)

  // Fetch bracket
  const { data: bracket, error: bracketError } = await supabase
    .from('custom_brackets')
    .select('*')
    .eq('id', id)
    .single()

  if (bracketError || !bracket) {
    notFound()
  }

  // Fetch participants with user info
  const { data: participants } = await supabase
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

  // Fetch matches
  const { data: matches } = await supabase
    .from('custom_bracket_matches')
    .select('*')
    .eq('bracket_id', id)
    .order('bracket_side', { ascending: true })
    .order('round', { ascending: true })
    .order('match_number', { ascending: true })

  // Transform participants to include display_name
  const participantsWithNames = participants?.map(p => ({
    ...p,
    display_name: (p.users as unknown as { display_name: string } | null)?.display_name || 'Unknown',
    users: undefined,
  })) || []

  const isOwner = bracket.created_by === activeUserId

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-6">
        <Link href="/brackets" className="text-zinc-400 hover:text-white text-sm">
          ← Back to Brackets
        </Link>

        <h1 className="text-2xl font-bold text-orange-400 uppercase tracking-wide mt-4 mb-2 flex items-center gap-2" style={{ fontFamily: 'var(--font-display)' }}>
          <BracketIcon />
          {bracket.name}
        </h1>

        <div className="text-sm text-zinc-400 mb-6 flex items-center gap-2">
          <span className={bracket.bracket_type === 'double' ? 'text-orange-400' : ''}>
            {bracket.bracket_type === 'single' ? 'Single' : 'Double'} Elimination
          </span>
          <span>·</span>
          <span>{participantsWithNames.length} players</span>
          {bracket.status === 'completed' && (
            <>
              <span>·</span>
              <span className="text-green-400">Completed</span>
            </>
          )}
        </div>

        <BracketDetailClient
          bracket={bracket}
          participants={participantsWithNames}
          matches={matches || []}
          isOwner={isOwner}
        />
      </div>
    </div>
  )
}
