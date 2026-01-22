'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
}

interface Game {
  id: string
  round: number
  game_number: number
  scheduled_at: string | null
  team1_score: number | null
  team2_score: number | null
  winner_id: string | null
  spread: number | null
  favorite_team_id: string | null
  team1: Team | null
  team2: Team | null
}

interface PickemDay {
  id: string
  contest_date: string
  is_locked: boolean
}

interface PickemGame {
  id: string
  pickem_day_id: string
  game_id: string
  spread: number
  favorite_team_id: string
  session: number
  winner_team_id: string | null
}

interface User {
  id: string
  display_name: string | null
  phone: string
}

interface PickemEntry {
  id: string
  user_id: string
  pickem_day_id: string
  has_paid: boolean
  paid_at: string | null
  correct_picks: number
}

interface PickemPick {
  id: string
  entry_id: string
  pickem_game_id: string
  picked_team_id: string
  is_correct: boolean | null
}

interface PickemPayouts {
  entry_fee: number
  session_1st: number
  session_2nd: number
  session_3rd: number
}

interface Props {
  tournamentId: string
  startDate: string
  pickemDays: PickemDay[]
  games: Game[]
  pickemGames: PickemGame[]
  users: User[]
  pickemEntries: PickemEntry[]
  pickemPicks: PickemPick[]
  payouts: PickemPayouts
}

// Tournament days: Wed=0, Thu=1, Fri=2, Sat=3, Sun=4
const DAYS = ['Thursday', 'Friday', 'Saturday', 'Sunday']

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function getDayDate(startDate: string, dayIndex: number): string {
  const start = new Date(startDate + 'T00:00:00')
  const dayDate = new Date(start.getTime() + (dayIndex + 1) * 24 * 60 * 60 * 1000)
  return dayDate.toISOString().split('T')[0]
}

export function DayManager({
  tournamentId,
  startDate,
  pickemDays,
  games,
  pickemGames,
  users,
  pickemEntries,
  pickemPicks,
  payouts,
}: Props) {
  const [selectedDay, setSelectedDay] = useState(0) // 0 = Thursday
  const [editingSpread, setEditingSpread] = useState<string | null>(null)
  const [spreadValue, setSpreadValue] = useState('')
  const [favoriteTeamId, setFavoriteTeamId] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const currentDayDate = getDayDate(startDate, selectedDay)
  const currentPickemDay = pickemDays.find(d => d.contest_date === currentDayDate)

  // Get games for current day that have both teams and are scheduled
  const dayGames = games.filter(g => {
    if (!g.scheduled_at || !g.team1 || !g.team2) return false
    const gameDate = g.scheduled_at.split('T')[0]
    return gameDate === currentDayDate
  }).sort((a, b) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())

  // Get pickem games for current day
  const dayPickemGames = currentPickemDay
    ? pickemGames.filter(pg => pg.pickem_day_id === currentPickemDay.id)
    : []

  // Group by session
  const session1Games = dayPickemGames.filter(pg => pg.session === 1)
  const session2Games = dayPickemGames.filter(pg => pg.session === 2)

  const createPickemDay = async () => {
    setSaving(true)
    try {
      // Create the pickem day
      const { data: newDay, error: dayError } = await supabase
        .from('pickem_days')
        .insert({
          tournament_id: tournamentId,
          contest_date: currentDayDate,
          is_locked: false,
        })
        .select()
        .single()

      if (dayError) throw dayError

      // Auto-assign games for this day with sessions
      const midpoint = Math.ceil(dayGames.length / 2)
      const pickemGamesToInsert = dayGames.map((game, index) => ({
        pickem_day_id: newDay.id,
        game_id: game.id,
        spread: game.spread || 0,
        favorite_team_id: game.favorite_team_id || game.team1!.id,
        session: index < midpoint ? 1 : 2,
      }))

      if (pickemGamesToInsert.length > 0) {
        const { error: gamesError } = await supabase
          .from('pickem_games')
          .insert(pickemGamesToInsert)

        if (gamesError) throw gamesError
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to create pickem day:', error)
      alert('Failed to create pickem day')
    }
    setSaving(false)
  }

  const updateSpread = async (pickemGameId: string) => {
    if (!spreadValue || !favoriteTeamId) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('pickem_games')
        .update({
          spread: parseFloat(spreadValue),
          favorite_team_id: favoriteTeamId,
        })
        .eq('id', pickemGameId)

      if (error) throw error

      setEditingSpread(null)
      setSpreadValue('')
      setFavoriteTeamId('')
      router.refresh()
    } catch (error) {
      console.error('Failed to update spread:', error)
      alert('Failed to update spread')
    }
    setSaving(false)
  }

  const toggleSession = async (pickemGameId: string, currentSession: number) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('pickem_games')
        .update({ session: currentSession === 1 ? 2 : 1 })
        .eq('id', pickemGameId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to toggle session:', error)
    }
    setSaving(false)
  }

  const toggleLock = async () => {
    if (!currentPickemDay) return

    setSaving(true)
    try {
      const { error } = await supabase
        .from('pickem_days')
        .update({ is_locked: !currentPickemDay.is_locked })
        .eq('id', currentPickemDay.id)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to toggle lock:', error)
    }
    setSaving(false)
  }

  const renderGame = (pickemGame: PickemGame) => {
    const game = games.find(g => g.id === pickemGame.game_id)
    if (!game || !game.team1 || !game.team2) return null

    const d1Team1 = findD1Team(game.team1.name)
    const d1Team2 = findD1Team(game.team2.name)
    const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
    const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

    const isEditing = editingSpread === pickemGame.id
    const isFavorite1 = pickemGame.favorite_team_id === game.team1.id
    const spread1 = isFavorite1 ? `-${pickemGame.spread}` : `+${pickemGame.spread}`
    const spread2 = isFavorite1 ? `+${pickemGame.spread}` : `-${pickemGame.spread}`

    const isComplete = game.winner_id !== null

    return (
      <div
        key={pickemGame.id}
        className={`p-3 rounded-lg ${isComplete ? 'bg-zinc-800/30' : 'bg-zinc-800/50'}`}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">{formatTime(game.scheduled_at)}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => toggleSession(pickemGame.id, pickemGame.session)}
              className="text-xs px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600"
              disabled={saving}
            >
              S{pickemGame.session}
            </button>
            {isComplete && (
              <span className="text-xs text-green-500">Complete</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Team 1 */}
          <div
            className={`flex-1 flex items-center gap-2 p-2 rounded ${
              game.winner_id === game.team1.id ? 'bg-green-500/20' : ''
            }`}
            style={{ backgroundColor: d1Team1?.primaryColor ? d1Team1.primaryColor + '20' : undefined }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: d1Team1?.primaryColor || '#3f3f46' }}
            >
              {logo1 ? (
                <img src={logo1} alt="" className="w-4 h-4 object-contain" />
              ) : (
                <span className="text-[8px] font-bold text-white">
                  {d1Team1?.abbreviation?.slice(0, 2) || game.team1.short_name?.slice(0, 2)}
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400">#{game.team1.seed}</span>
            <span className="text-sm flex-1">{d1Team1?.shortName || game.team1.short_name}</span>
            <span className={`text-xs font-mono ${isFavorite1 ? 'text-orange-400' : 'text-zinc-400'}`}>
              {spread1}
            </span>
          </div>

          <span className="text-zinc-600 text-sm">vs</span>

          {/* Team 2 */}
          <div
            className={`flex-1 flex items-center gap-2 p-2 rounded ${
              game.winner_id === game.team2.id ? 'bg-green-500/20' : ''
            }`}
            style={{ backgroundColor: d1Team2?.primaryColor ? d1Team2.primaryColor + '20' : undefined }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ backgroundColor: d1Team2?.primaryColor || '#3f3f46' }}
            >
              {logo2 ? (
                <img src={logo2} alt="" className="w-4 h-4 object-contain" />
              ) : (
                <span className="text-[8px] font-bold text-white">
                  {d1Team2?.abbreviation?.slice(0, 2) || game.team2.short_name?.slice(0, 2)}
                </span>
              )}
            </div>
            <span className="text-xs text-zinc-400">#{game.team2.seed}</span>
            <span className="text-sm flex-1">{d1Team2?.shortName || game.team2.short_name}</span>
            <span className={`text-xs font-mono ${!isFavorite1 ? 'text-orange-400' : 'text-zinc-400'}`}>
              {spread2}
            </span>
          </div>
        </div>

        {/* Edit Spread */}
        {isEditing ? (
          <div className="mt-2 flex items-center gap-2">
            <input
              type="number"
              step="0.5"
              value={spreadValue}
              onChange={(e) => setSpreadValue(e.target.value)}
              placeholder="Spread"
              className="w-20 px-2 py-1 bg-zinc-700 rounded text-sm"
            />
            <select
              value={favoriteTeamId}
              onChange={(e) => setFavoriteTeamId(e.target.value)}
              className="flex-1 px-2 py-1 bg-zinc-700 rounded text-sm"
            >
              <option value="">Favorite?</option>
              <option value={game.team1.id}>{game.team1.short_name} (favorite)</option>
              <option value={game.team2.id}>{game.team2.short_name} (favorite)</option>
            </select>
            <button
              onClick={() => updateSpread(pickemGame.id)}
              disabled={saving || !spreadValue || !favoriteTeamId}
              className="px-2 py-1 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 rounded text-sm"
            >
              Save
            </button>
            <button
              onClick={() => {
                setEditingSpread(null)
                setSpreadValue('')
                setFavoriteTeamId('')
              }}
              className="px-2 py-1 bg-zinc-600 hover:bg-zinc-500 rounded text-sm"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => {
              setEditingSpread(pickemGame.id)
              setSpreadValue(pickemGame.spread.toString())
              setFavoriteTeamId(pickemGame.favorite_team_id)
            }}
            className="mt-2 text-xs text-zinc-500 hover:text-zinc-300"
          >
            Edit spread
          </button>
        )}
      </div>
    )
  }

  // Calculate standings for a session
  const calculateSessionStandings = (session: number) => {
    if (!currentPickemDay) return []

    const sessionGameIds = dayPickemGames
      .filter(pg => pg.session === session)
      .map(pg => pg.id)

    const dayEntries = pickemEntries.filter(e => e.pickem_day_id === currentPickemDay.id)

    return dayEntries.map(entry => {
      const user = users.find(u => u.id === entry.user_id)
      const entryPicks = pickemPicks.filter(p =>
        p.entry_id === entry.id && sessionGameIds.includes(p.pickem_game_id)
      )

      const correctPicks = entryPicks.filter(p => p.is_correct === true).length
      const totalPicks = entryPicks.length

      // Calculate tiebreaker positions
      const sortedPicks = entryPicks
        .map(pick => {
          const pg = dayPickemGames.find(g => g.id === pick.pickem_game_id)
          const game = pg ? games.find(g => g.id === pg.game_id) : null
          return { ...pick, scheduled_at: game?.scheduled_at || '' }
        })
        .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())

      let firstLoss: number | null = null
      let secondLoss: number | null = null

      sortedPicks.forEach((pick, index) => {
        if (pick.is_correct === false) {
          if (firstLoss === null) {
            firstLoss = index + 1
          } else if (secondLoss === null) {
            secondLoss = index + 1
          }
        }
      })

      return {
        user_id: entry.user_id,
        display_name: user?.display_name || 'Unknown',
        correct_picks: correctPicks,
        total_picks: totalPicks,
        first_loss: firstLoss,
        second_loss: secondLoss,
      }
    }).sort((a, b) => {
      // 1. More correct picks = better
      if (b.correct_picks !== a.correct_picks) {
        return b.correct_picks - a.correct_picks
      }
      // 2. Later 2nd loss = better
      if (a.second_loss !== b.second_loss) {
        if (a.second_loss === null) return -1
        if (b.second_loss === null) return 1
        return b.second_loss - a.second_loss
      }
      // 3. Later 1st loss = better
      if (a.first_loss !== b.first_loss) {
        if (a.first_loss === null) return -1
        if (b.first_loss === null) return 1
        return b.first_loss - a.first_loss
      }
      return 0
    })
  }

  const session1Standings = calculateSessionStandings(1)
  const session2Standings = calculateSessionStandings(2)

  return (
    <div>
      {/* Day Tabs */}
      <div className="flex gap-2 mb-6">
        {DAYS.map((day, index) => (
          <button
            key={day}
            onClick={() => setSelectedDay(index)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedDay === index
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
            }`}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Day Content */}
      {!currentPickemDay ? (
        <div className="bg-zinc-800/50 rounded-xl p-6 text-center">
          <p className="text-zinc-400 mb-4">
            No pick&apos;em created for {DAYS[selectedDay]} yet.
            {dayGames.length > 0 && ` Found ${dayGames.length} games scheduled.`}
          </p>
          {dayGames.length > 0 ? (
            <button
              onClick={createPickemDay}
              disabled={saving}
              className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 rounded-lg font-medium"
            >
              {saving ? 'Creating...' : `Create ${DAYS[selectedDay]} Pick'em`}
            </button>
          ) : (
            <p className="text-zinc-500 text-sm">No games scheduled for this day.</p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Lock Status */}
          <div className="flex items-center justify-between bg-zinc-800/50 rounded-xl p-4">
            <div>
              <span className="text-sm text-zinc-400">Status: </span>
              <span className={currentPickemDay.is_locked ? 'text-red-400' : 'text-green-400'}>
                {currentPickemDay.is_locked ? 'Locked' : 'Open for picks'}
              </span>
            </div>
            <button
              onClick={toggleLock}
              disabled={saving}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                currentPickemDay.is_locked
                  ? 'bg-green-600 hover:bg-green-700'
                  : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              {currentPickemDay.is_locked ? 'Unlock' : 'Lock'}
            </button>
          </div>

          {/* Session 1 */}
          <div>
            <h3 className="text-lg font-semibold text-orange-400 mb-3">
              Session 1 - Early Games ({session1Games.length})
            </h3>
            <div className="space-y-2">
              {session1Games.map(pg => renderGame(pg))}
              {session1Games.length === 0 && (
                <p className="text-zinc-500 text-sm">No games in Session 1</p>
              )}
            </div>

            {/* Session 1 Standings */}
            {session1Standings.length > 0 && (
              <div className="mt-4 bg-zinc-800/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Session 1 Standings</h4>
                <div className="space-y-1">
                  {session1Standings.slice(0, 5).map((standing, index) => (
                    <div key={standing.user_id} className="flex items-center justify-between text-sm">
                      <span>
                        <span className={`font-medium ${
                          index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-zinc-300' :
                          index === 2 ? 'text-orange-400' :
                          'text-zinc-500'
                        }`}>
                          {index + 1}.
                        </span>
                        {' '}{standing.display_name}
                      </span>
                      <span className="text-zinc-400">
                        {standing.correct_picks}/{standing.total_picks}
                        {index < 3 && payouts[`session_${index + 1}st` as keyof PickemPayouts] > 0 && (
                          <span className="text-green-400 ml-2">
                            ${payouts[`session_${index + 1}st` as keyof PickemPayouts]}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Session 2 */}
          <div>
            <h3 className="text-lg font-semibold text-orange-400 mb-3">
              Session 2 - Late Games ({session2Games.length})
            </h3>
            <div className="space-y-2">
              {session2Games.map(pg => renderGame(pg))}
              {session2Games.length === 0 && (
                <p className="text-zinc-500 text-sm">No games in Session 2</p>
              )}
            </div>

            {/* Session 2 Standings */}
            {session2Standings.length > 0 && (
              <div className="mt-4 bg-zinc-800/30 rounded-lg p-3">
                <h4 className="text-sm font-medium text-zinc-400 mb-2">Session 2 Standings</h4>
                <div className="space-y-1">
                  {session2Standings.slice(0, 5).map((standing, index) => (
                    <div key={standing.user_id} className="flex items-center justify-between text-sm">
                      <span>
                        <span className={`font-medium ${
                          index === 0 ? 'text-yellow-400' :
                          index === 1 ? 'text-zinc-300' :
                          index === 2 ? 'text-orange-400' :
                          'text-zinc-500'
                        }`}>
                          {index + 1}.
                        </span>
                        {' '}{standing.display_name}
                      </span>
                      <span className="text-zinc-400">
                        {standing.correct_picks}/{standing.total_picks}
                        {index < 3 && payouts[`session_${index + 1}st` as keyof PickemPayouts] > 0 && (
                          <span className="text-green-400 ml-2">
                            ${payouts[`session_${index + 1}st` as keyof PickemPayouts]}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
