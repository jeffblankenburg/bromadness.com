import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { FullMenuDisplay } from './FullMenuDisplay'

export default async function MenuPage() {
  const supabase = await createClient()

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, start_date')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6">
        <Link href="/" className="text-zinc-400 hover:text-white text-sm">← Back</Link>
        <p className="text-zinc-400 mt-4">No tournament found.</p>
      </div>
    )
  }

  // Get menu items
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('id, day, meal_type, item_name, provider')
    .eq('tournament_id', tournament.id)
    .order('sort_order')

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white p-6">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <Link href="/info" className="text-zinc-400 hover:text-white text-sm">← Info</Link>
          <h1 className="text-lg font-bold text-orange-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Menu</h1>
          <div className="w-10"></div>
        </div>

        <FullMenuDisplay items={menuItems || []} />
      </div>
    </div>
  )
}
