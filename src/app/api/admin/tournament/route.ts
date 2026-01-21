import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { generateBracketGames, buildGameLinks } from '@/lib/bracket/generate'

export async function POST(request: Request) {
  const supabase = await createClient()

  // Check auth and admin status
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('users')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  try {
    const { name, year } = await request.json()

    if (!name || !year) {
      return NextResponse.json({ error: 'Name and year are required' }, { status: 400 })
    }

    // 1. Create tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        year,
        name: name.trim(),
        start_date: `${year}-03-15`,
        end_date: `${year}-04-08`,
        is_active: true,
      })
      .select()
      .single()

    if (tournamentError) throw tournamentError

    // 2. Create regions
    const regionNames = ['East', 'West', 'South', 'Midwest']
    const { data: regions, error: regionsError } = await supabase
      .from('regions')
      .insert(
        regionNames.map((name, index) => ({
          tournament_id: tournament.id,
          name,
          position: index + 1,
        }))
      )
      .select()

    if (regionsError) throw regionsError

    // 3. Generate bracket games
    const gamesData = generateBracketGames(tournament.id, regions)
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .insert(gamesData)
      .select()

    if (gamesError) throw gamesError

    // 4. Link games together
    const links = buildGameLinks(games, regions)
    for (const link of links) {
      await supabase
        .from('games')
        .update({ next_game_id: link.next_game_id, is_team1_slot: link.is_team1_slot })
        .eq('id', link.id)
    }

    return NextResponse.json({ tournament, regions, gamesCount: games.length })
  } catch (err) {
    console.error('Failed to create tournament:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create tournament' },
      { status: 500 }
    )
  }
}
