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
  scheduled_at: string | null
  team1_score: number | null
  team2_score: number | null
  winner_id: string | null
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
}

interface PickemEntry {
  id: string
  user_id: string
  pickem_day_id: string
  has_paid: boolean
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
  userId: string
  pickemDays: PickemDay[]
  games: Game[]
  pickemGames: PickemGame[]
  users: User[]
  pickemEntries: PickemEntry[]
  pickemPicks: PickemPick[]
  userEntries: PickemEntry[]
  payouts: PickemPayouts
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00')
  return date.toLocaleDateString('en-US', { weekday: 'long' })
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return 'TBD'
  const date = new Date(dateStr)
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

export function PickemClient({
  userId,
  pickemDays,
  games,
  pickemGames,
  users,
  pickemEntries,
  pickemPicks,
  userEntries,
  payouts,
}: Props) {
  const [selectedDayIndex, setSelectedDayIndex] = useState(0)
  const [localPicks, setLocalPicks] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const currentDay = pickemDays[selectedDayIndex]
  const dayPickemGames = pickemGames.filter(pg => pg.pickem_day_id === currentDay.id)

  // Get user's entry for current day
  const userEntry = userEntries.find(e => e.pickem_day_id === currentDay.id)

  // Get user's picks for current day
  const userPicks = userEntry
    ? pickemPicks.filter(p => p.entry_id === userEntry.id)
    : []

  // Initialize local picks from saved picks
  const getPickedTeamId = (pickemGameId: string): string => {
    if (localPicks[pickemGameId]) return localPicks[pickemGameId]
    const pick = userPicks.find(p => p.pickem_game_id === pickemGameId)
    return pick?.picked_team_id || ''
  }

  const handlePick = (pickemGameId: string, teamId: string) => {
    if (currentDay.is_locked) return
    setLocalPicks(prev => ({ ...prev, [pickemGameId]: teamId }))
  }

  const savePicks = async () => {
    setSaving(true)
    try {
      // Create or get entry
      let entryId = userEntry?.id

      if (!entryId) {
        const { data: newEntry, error: entryError } = await supabase
          .from('pickem_entries')
          .insert({
            user_id: userId,
            pickem_day_id: currentDay.id,
          })
          .select()
          .single()

        if (entryError) throw entryError
        entryId = newEntry.id
      }

      // Save all picks
      const picksToSave = dayPickemGames.map(pg => ({
        entry_id: entryId,
        pickem_game_id: pg.id,
        picked_team_id: getPickedTeamId(pg.id),
      })).filter(p => p.picked_team_id)

      // Delete existing picks for this entry
      await supabase
        .from('pickem_picks')
        .delete()
        .eq('entry_id', entryId)

      // Insert new picks
      if (picksToSave.length > 0) {
        const { error: picksError } = await supabase
          .from('pickem_picks')
          .insert(picksToSave)

        if (picksError) throw picksError
      }

      setLocalPicks({})
      router.refresh()
    } catch (error) {
      console.error('Failed to save picks:', error)
      alert('Failed to save picks')
    }
    setSaving(false)
  }

  // Check if all games have picks
  const allGamesPicked = dayPickemGames.every(pg => getPickedTeamId(pg.id))
  const hasUnsavedChanges = Object.keys(localPicks).length > 0

  // Group games by session
  const session1Games = dayPickemGames.filter(pg => pg.session === 1)
    .sort((a, b) => {
      const gameA = games.find(g => g.id === a.game_id)
      const gameB = games.find(g => g.id === b.game_id)
      return new Date(gameA?.scheduled_at || 0).getTime() - new Date(gameB?.scheduled_at || 0).getTime()
    })

  const session2Games = dayPickemGames.filter(pg => pg.session === 2)
    .sort((a, b) => {
      const gameA = games.find(g => g.id === a.game_id)
      const gameB = games.find(g => g.id === b.game_id)
      return new Date(gameA?.scheduled_at || 0).getTime() - new Date(gameB?.scheduled_at || 0).getTime()
    })

  // Calculate standings for a session
  const calculateSessionStandings = (session: number) => {
    const sessionGameIds = dayPickemGames
      .filter(pg => pg.session === session)
      .map(pg => pg.id)

    const dayEntries = pickemEntries.filter(e => e.pickem_day_id === currentDay.id)

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
        is_current_user: entry.user_id === userId,
      }
    }).sort((a, b) => {
      if (b.correct_picks !== a.correct_picks) return b.correct_picks - a.correct_picks
      if (a.second_loss !== b.second_loss) {
        if (a.second_loss === null) return -1
        if (b.second_loss === null) return 1
        return b.second_loss - a.second_loss
      }
      if (a.first_loss !== b.first_loss) {
        if (a.first_loss === null) return -1
        if (b.first_loss === null) return 1
        return b.first_loss - a.first_loss
      }
      return 0
    })
  }

  const renderGame = (pickemGame: PickemGame) => {
    const game = games.find(g => g.id === pickemGame.game_id)
    if (!game || !game.team1 || !game.team2) return null

    const d1Team1 = findD1Team(game.team1.name)
    const d1Team2 = findD1Team(game.team2.name)
    const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
    const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

    const isFavorite1 = pickemGame.favorite_team_id === game.team1.id
    const spread1 = isFavorite1 ? `-${pickemGame.spread}` : `+${pickemGame.spread}`
    const spread2 = isFavorite1 ? `+${pickemGame.spread}` : `-${pickemGame.spread}`

    const pickedTeamId = getPickedTeamId(pickemGame.id)
    const isComplete = game.winner_id !== null

    // Determine if pick was correct (against spread)
    const userPick = userPicks.find(p => p.pickem_game_id === pickemGame.id)
    const isCorrect = userPick?.is_correct

    const renderTeamButton = (team: Team, spread: string, d1Team: typeof D1_TEAMS[0] | undefined, logo: string | null) => {
      const isPicked = pickedTeamId === team.id
      const isWinnerAgainstSpread = pickemGame.winner_team_id === team.id

      let bgColor = d1Team?.primaryColor ? d1Team.primaryColor + '20' : 'rgba(63, 63, 70, 0.2)'
      let borderClass = ''

      if (isPicked) {
        bgColor = d1Team?.primaryColor ? d1Team.primaryColor + '60' : 'rgba(63, 63, 70, 0.6)'
        borderClass = 'ring-2 ring-orange-500'
      }

      if (isComplete && isPicked) {
        if (isCorrect === true) {
          borderClass = 'ring-2 ring-green-500'
        } else if (isCorrect === false) {
          borderClass = 'ring-2 ring-red-500'
        }
      }

      return (
        <button
          onClick={() => handlePick(pickemGame.id, team.id)}
          disabled={currentDay.is_locked}
          className={`flex-1 flex items-center gap-2 p-3 rounded-lg transition-all ${borderClass} ${
            currentDay.is_locked ? 'cursor-default' : 'hover:opacity-80'
          }`}
          style={{ backgroundColor: bgColor }}
        >
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: d1Team?.primaryColor || '#3f3f46' }}
          >
            {logo ? (
              <img src={logo} alt="" className="w-5 h-5 object-contain" />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {d1Team?.abbreviation?.slice(0, 2) || team.short_name?.slice(0, 2)}
              </span>
            )}
          </div>
          <div className="flex-1 text-left">
            <div className="flex items-center gap-1">
              <span className="text-xs text-zinc-400">#{team.seed}</span>
              <span className="text-sm font-medium">{d1Team?.shortName || team.short_name}</span>
            </div>
            <span className={`text-xs ${isFavorite1 === (team.id === game.team1?.id) ? 'text-orange-400' : 'text-zinc-400'}`}>
              {spread}
            </span>
          </div>
          {isPicked && (
            <div className="flex-shrink-0">
              {isComplete ? (
                isCorrect === true ? (
                  <svg className="w-5 h-5 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                ) : isCorrect === false ? (
                  <svg className="w-5 h-5 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                ) : null
              ) : (
                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
                </svg>
              )}
            </div>
          )}
        </button>
      )
    }

    return (
      <div key={pickemGame.id} className="bg-zinc-800/30 rounded-xl p-3">
        <div className="text-xs text-zinc-500 mb-2">{formatTime(game.scheduled_at)}</div>
        <div className="flex gap-2">
          {renderTeamButton(game.team1, spread1, d1Team1, logo1)}
          {renderTeamButton(game.team2, spread2, d1Team2, logo2)}
        </div>
      </div>
    )
  }

  const renderStandings = (session: number, standings: ReturnType<typeof calculateSessionStandings>) => {
    if (standings.length === 0) return null

    const sessionGames = session === 1 ? session1Games : session2Games
    const totalGames = sessionGames.length

    return (
      <div className="bg-zinc-800/30 rounded-xl p-4 mt-4">
        <h4 className="text-sm font-medium text-zinc-400 mb-3">
          Session {session} Standings
        </h4>
        <div className="space-y-2">
          {standings.map((standing, index) => {
            const payout = index === 0 ? payouts.session_1st :
                          index === 1 ? payouts.session_2nd :
                          index === 2 ? payouts.session_3rd : 0

            return (
              <div
                key={standing.user_id}
                className={`flex items-center justify-between text-sm p-2 rounded ${
                  standing.is_current_user ? 'bg-orange-500/20' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`w-6 font-bold ${
                    index === 0 ? 'text-yellow-400' :
                    index === 1 ? 'text-zinc-300' :
                    index === 2 ? 'text-orange-400' :
                    'text-zinc-500'
                  }`}>
                    {index + 1}.
                  </span>
                  <span className={standing.is_current_user ? 'font-medium' : ''}>
                    {standing.display_name}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-400">
                    {standing.correct_picks}/{totalGames}
                  </span>
                  {payout > 0 && (
                    <span className="text-green-400 font-medium">${payout}</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const session1Standings = calculateSessionStandings(1)
  const session2Standings = calculateSessionStandings(2)

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-6 max-w-lg mx-auto">
        <h1 className="text-2xl font-bold text-orange-500 mb-2">Pick&apos;em</h1>

        {/* Day Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto">
          {pickemDays.map((day, index) => (
            <button
              key={day.id}
              onClick={() => setSelectedDayIndex(index)}
              className={`px-4 py-2 rounded-lg font-medium whitespace-nowrap transition-colors ${
                selectedDayIndex === index
                  ? 'bg-orange-500 text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
              }`}
            >
              {formatDate(day.contest_date)}
            </button>
          ))}
        </div>

        {/* Lock Status */}
        {currentDay.is_locked && (
          <div className="bg-red-500/20 text-red-400 rounded-lg px-4 py-2 mb-4 text-sm">
            Picks are locked for {formatDate(currentDay.contest_date)}
          </div>
        )}

        {/* Payouts */}
        <div className="bg-zinc-800/50 rounded-xl p-4 mb-6">
          <h3 className="text-sm font-medium text-zinc-400 mb-2">Session Payouts</h3>
          <div className="flex gap-4 text-sm">
            <div>
              <span className="text-yellow-400">1st:</span> ${payouts.session_1st}
            </div>
            <div>
              <span className="text-zinc-300">2nd:</span> ${payouts.session_2nd}
            </div>
            <div>
              <span className="text-orange-400">3rd:</span> ${payouts.session_3rd}
            </div>
          </div>
        </div>

        {/* Session 1 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-orange-400 mb-3">
            Session 1 - Early Games
          </h3>
          <div className="space-y-3">
            {session1Games.map(pg => renderGame(pg))}
          </div>
          {currentDay.is_locked && renderStandings(1, session1Standings)}
        </div>

        {/* Session 2 */}
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-orange-400 mb-3">
            Session 2 - Late Games
          </h3>
          <div className="space-y-3">
            {session2Games.map(pg => renderGame(pg))}
          </div>
          {currentDay.is_locked && renderStandings(2, session2Standings)}
        </div>

        {/* Save Button */}
        {!currentDay.is_locked && (
          <div className="fixed bottom-16 left-0 right-0 p-4 bg-gradient-to-t from-black to-transparent">
            <div className="max-w-lg mx-auto">
              <button
                onClick={savePicks}
                disabled={saving || !allGamesPicked}
                className={`w-full py-3 rounded-xl font-semibold transition-colors ${
                  allGamesPicked
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-zinc-700 text-zinc-500'
                }`}
              >
                {saving ? 'Saving...' : allGamesPicked ? (
                  hasUnsavedChanges ? 'Save Picks' : 'Picks Saved'
                ) : (
                  `Pick all games (${dayPickemGames.filter(pg => getPickedTeamId(pg.id)).length}/${dayPickemGames.length})`
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
