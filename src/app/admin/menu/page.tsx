import { createClient } from '@/lib/supabase/server'
import { MenuEditor } from './MenuEditor'

export default async function MenuPage() {
  const supabase = await createClient()

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id, name, year')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="space-y-6">
        <p className="text-zinc-400">No tournament found. Create one first.</p>
      </div>
    )
  }

  // Get menu items
  const { data: menuItems } = await supabase
    .from('menu_items')
    .select('*')
    .eq('tournament_id', tournament.id)
    .order('sort_order')

  return (
    <div className="space-y-6">
      <MenuEditor
        tournamentId={tournament.id}
        menuItems={menuItems || []}
      />
    </div>
  )
}
