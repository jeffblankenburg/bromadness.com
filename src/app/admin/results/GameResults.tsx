'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'
import { CHANNELS } from '@/lib/data/channels'

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
  region_id: string
}

interface Game {
  id: string
  round: number
  region_id: string | null
  game_number: number
  team1_id: string | null
  team2_id: string | null
  winner_id: string | null
  team1_score: number | null
  team2_score: number | null
  scheduled_at: string | null
  next_game_id: string | null
  is_team1_slot: boolean | null
  spread: number | null
  favorite_team_id: string | null
  location: string | null
  channel: string | null
}

interface Tournament {
  id: string
  name: string
  year: number
}

interface Props {
  tournament: Tournament
  teams: Team[]
  games: Game[]
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Rd of 64',
  2: 'Rd of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Champ',
}

const formatGameTime = (dateStr: string | null) => {
  if (!dateStr) return null
  // Parse directly without timezone conversion
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, year, month, day, hours, mins] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
  const dayName = days[date.getDay()]
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'p' : 'a'
  return `${dayName} ${hour12}:${mins}${ampm}`
}

const getD1TeamData = (teamName: string) => {
  return D1_TEAMS.find(t => t.name.toLowerCase() === teamName.toLowerCase())
}

const getChannelNumber = (channelName: string | null) => {
  if (!channelName) return null
  const channel = CHANNELS.find(c => c.name.toLowerCase() === channelName.toLowerCase())
  return channel ? channel.number : null
}

export function GameResults({ tournament, teams, games }: Props) {
  const [activeRound, setActiveRound] = useState(1)
  const [saving, setSaving] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const getTeamById = (teamId: string | null): Team | null => {
    if (!teamId) return null
    return teams.find(t => t.id === teamId) || null
  }

  const roundGames = games.filter(g => g.round === activeRound)

  const handleSetWinner = async (game: Game, winnerId: string, team1Score: number, team2Score: number) => {
    setSaving(game.id)
    try {
      // Update this game with winner and scores
      await supabase
        .from('games')
        .update({
          winner_id: winnerId,
          team1_score: team1Score,
          team2_score: team2Score,
        })
        .eq('id', game.id)

      // Propagate winner to next game
      if (game.next_game_id) {
        const updateField = game.is_team1_slot ? 'team1_id' : 'team2_id'
        await supabase
          .from('games')
          .update({ [updateField]: winnerId })
          .eq('id', game.next_game_id)
      }

      // Update pick'em results
      await updatePickemResults(game, team1Score, team2Score)

      router.refresh()
    } catch (err) {
      console.error('Failed to save result:', err)
    } finally {
      setSaving(null)
    }
  }

  // Update pick'em when game result is entered
  const updatePickemResults = async (game: Game, team1Score: number, team2Score: number) => {
    try {
      // Check if this game has a spread set (pick'em game)
      if (game.spread === null) return // No spread, not a pick'em game

      // Get team seeds to determine which team has the spread
      const team1 = teams.find(t => t.id === game.team1_id)
      const team2 = teams.find(t => t.id === game.team2_id)
      if (!team1 || !team2) return

      // Calculate who covered the spread
      // Spread is always assigned to the LOWER SEED:
      // - Negative spread = lower seed is favorite (must win by more than |spread|)
      // - Positive spread = lower seed is underdog (can lose by less than spread)
      const margin = team1Score - team2Score // positive = team1 won outright
      const team1IsLowerSeed = team1.seed < team2.seed

      // Adjusted margin: add spread if team1 is lower seed, subtract if team2 is lower seed
      const adjustedMargin = team1IsLowerSeed
        ? margin + game.spread
        : margin - game.spread

      // Winner against the spread
      const spreadWinnerId = adjustedMargin > 0 ? game.team1_id : game.team2_id

      // Get all picks for this game (picks reference game_id directly)
      const { data: picks } = await supabase
        .from('pickem_picks')
        .select('id, picked_team_id, entry_id')
        .eq('game_id', game.id)

      if (!picks || picks.length === 0) return

      // Update is_correct for each pick
      for (const pick of picks) {
        const isCorrect = pick.picked_team_id === spreadWinnerId
        await supabase
          .from('pickem_picks')
          .update({ is_correct: isCorrect })
          .eq('id', pick.id)
      }

      // Update correct_picks count for each affected entry
      const entryIds = [...new Set(picks.map(p => p.entry_id))]
      for (const entryId of entryIds) {
        const { count } = await supabase
          .from('pickem_picks')
          .select('*', { count: 'exact', head: true })
          .eq('entry_id', entryId)
          .eq('is_correct', true)

        await supabase
          .from('pickem_entries')
          .update({ correct_picks: count || 0 })
          .eq('id', entryId)
      }
    } catch (err) {
      console.error('Failed to update pick\'em results:', err)
    }
  }

  const handleClearResult = async (game: Game) => {
    setSaving(game.id)
    try {
      // Clear this game's result
      await supabase
        .from('games')
        .update({
          winner_id: null,
          team1_score: null,
          team2_score: null,
        })
        .eq('id', game.id)

      // Clear from next game
      if (game.next_game_id) {
        const updateField = game.is_team1_slot ? 'team1_id' : 'team2_id'
        await supabase
          .from('games')
          .update({ [updateField]: null })
          .eq('id', game.next_game_id)
      }

      // Clear pick'em correctness for this game
      await clearPickemResults(game)

      router.refresh()
    } catch (err) {
      console.error('Failed to clear result:', err)
    } finally {
      setSaving(null)
    }
  }

  // Clear pick'em correctness when result is cleared
  const clearPickemResults = async (game: Game) => {
    try {
      // Get all picks for this game
      const { data: picks } = await supabase
        .from('pickem_picks')
        .select('id, entry_id')
        .eq('game_id', game.id)

      if (!picks || picks.length === 0) return

      // Reset is_correct to null for all picks
      await supabase
        .from('pickem_picks')
        .update({ is_correct: null })
        .eq('game_id', game.id)

      // Recalculate correct_picks count for each affected entry
      const entryIds = [...new Set(picks.map(p => p.entry_id))]
      for (const entryId of entryIds) {
        const { count } = await supabase
          .from('pickem_picks')
          .select('*', { count: 'exact', head: true })
          .eq('entry_id', entryId)
          .eq('is_correct', true)

        await supabase
          .from('pickem_entries')
          .update({ correct_picks: count || 0 })
          .eq('id', entryId)
      }
    } catch (err) {
      console.error('Failed to clear pick\'em results:', err)
    }
  }

  // Sort games: incomplete first (by time), then completed (by time)
  const sortGames = (gamesToSort: Game[]) => {
    return [...gamesToSort].sort((a, b) => {
      // First: games without results come before games with results
      const aHasResult = a.winner_id !== null
      const bHasResult = b.winner_id !== null
      if (aHasResult !== bHasResult) {
        return aHasResult ? 1 : -1
      }
      // Then sort by scheduled time
      const aTime = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0
      const bTime = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0
      return aTime - bTime
    })
  }

  return (
    <div className="space-y-4">
      {/* Round Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl overflow-x-auto">
        {[1, 2, 3, 4, 5, 6].map((round) => {
          const roundGameCount = games.filter(g => g.round === round).length
          const completedCount = games.filter(g => g.round === round && g.winner_id).length
          const isActive = round === activeRound
          return (
            <button
              key={round}
              onClick={() => setActiveRound(round)}
              className={`flex-1 min-w-[80px] py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <div className="truncate">{ROUND_NAMES[round]}</div>
              <div className={`text-xs ${isActive ? 'text-orange-200' : 'text-zinc-500'}`}>
                {completedCount}/{roundGameCount}
              </div>
            </button>
          )
        })}
      </div>

      {/* Games */}
      <div className="space-y-2">
        {sortGames(roundGames).map((game) => (
          <GameCard
            key={game.id}
            game={game}
            team1={getTeamById(game.team1_id)}
            team2={getTeamById(game.team2_id)}
            saving={saving === game.id}
            onSetWinner={handleSetWinner}
            onClearResult={handleClearResult}
          />
        ))}

        {roundGames.length === 0 && (
          <p className="text-zinc-500 text-sm">No games in this round yet.</p>
        )}
      </div>
    </div>
  )
}

interface GameCardProps {
  game: Game
  team1: Team | null
  team2: Team | null
  saving: boolean
  onSetWinner: (game: Game, winnerId: string, team1Score: number, team2Score: number) => void
  onClearResult: (game: Game) => void
}

function GameCard({ game, team1, team2, saving, onSetWinner, onClearResult }: GameCardProps) {
  const [team1Score, setTeam1Score] = useState(game.team1_score?.toString() || '')
  const [team2Score, setTeam2Score] = useState(game.team2_score?.toString() || '')

  const hasResult = game.winner_id !== null
  const canEnterResult = team1 && team2
  const hasSpread = game.spread !== null

  const d1Team1 = team1 ? getD1TeamData(team1.name) : null
  const d1Team2 = team2 ? getD1TeamData(team2.name) : null
  const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
  const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

  // Get spread display for a team based on seed comparison
  const getSpreadDisplay = (team: Team | null, otherTeam: Team | null) => {
    if (!hasSpread || !team || !otherTeam) return null
    if (team.seed < otherTeam.seed) {
      // Lower seed - show spread as-is
      return `${game.spread! > 0 ? '+' : ''}${game.spread}`
    } else {
      // Higher seed - show inverted spread
      const inverted = game.spread! * -1
      return `${inverted > 0 ? '+' : ''}${inverted}`
    }
  }

  const handleScoreBlur = () => {
    if (!canEnterResult || saving) return

    const t1 = team1Score.trim()
    const t2 = team2Score.trim()

    // Only save if both scores are entered
    if (t1 === '' || t2 === '') return

    const t1Score = parseInt(t1)
    const t2Score = parseInt(t2)

    if (isNaN(t1Score) || isNaN(t2Score)) return

    // Determine winner based on scores
    const winnerId = t1Score > t2Score ? team1!.id : team2!.id

    // Only save if something changed
    if (game.team1_score === t1Score && game.team2_score === t2Score && game.winner_id === winnerId) return

    onSetWinner(game, winnerId, t1Score, t2Score)
  }

  const channelNum = getChannelNumber(game.channel)

  return (
    <div className={`bg-zinc-800/50 rounded-xl p-3 space-y-2 ${saving ? 'opacity-50' : ''}`}>
      {/* Header: Date/Time, Location, Channel */}
      {(game.scheduled_at || game.location || game.channel) && (
        <div className="flex items-center gap-2 text-[10px] text-zinc-400">
          {game.scheduled_at && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">{formatGameTime(game.scheduled_at)}</span>
          )}
          {game.location && (
            <span className="flex-1 truncate">{game.location}</span>
          )}
          {game.channel && (
            <span className="px-1 py-0.5 bg-zinc-800 rounded">
              {game.channel}{channelNum ? ` (${channelNum})` : ''}
            </span>
          )}
        </div>
      )}

      {/* Team 1 */}
      <div
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg ${
          hasResult && game.winner_id === team1?.id ? 'ring-2 ring-green-500' : ''
        }`}
        style={{ backgroundColor: d1Team1 ? d1Team1.primaryColor + '40' : '#3f3f4640' }}
      >
        <span className="w-5 text-xs font-mono text-zinc-400">{team1?.seed || '?'}</span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: d1Team1?.primaryColor || '#3f3f46' }}
        >
          {logo1 ? (
            <img src={logo1} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
          ) : (
            <span className="text-[10px] font-bold text-white">{d1Team1?.abbreviation?.slice(0, 2) || team1?.short_name?.slice(0, 2) || '?'}</span>
          )}
        </div>
        <span className="flex-1 truncate text-sm text-white">
          {d1Team1?.shortName || team1?.short_name || team1?.name || 'TBD'}
          {hasSpread && team1 && team2 && (
            <span className="text-xs text-zinc-400 ml-1">{getSpreadDisplay(team1, team2)}</span>
          )}
        </span>
        {canEnterResult ? (
          <input
            type="number"
            value={team1Score}
            onChange={(e) => setTeam1Score(e.target.value)}
            onBlur={handleScoreBlur}
            placeholder=""
            className={`w-14 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-center text-sm font-bold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              hasResult && game.winner_id === team1?.id ? 'text-green-400' : 'text-white'
            }`}
          />
        ) : (
          <span className="w-14 text-center text-zinc-500">—</span>
        )}
      </div>

      {/* Team 2 */}
      <div
        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg ${
          hasResult && game.winner_id === team2?.id ? 'ring-2 ring-green-500' : ''
        }`}
        style={{ backgroundColor: d1Team2 ? d1Team2.primaryColor + '40' : '#3f3f4640' }}
      >
        <span className="w-5 text-xs font-mono text-zinc-400">{team2?.seed || '?'}</span>
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: d1Team2?.primaryColor || '#3f3f46' }}
        >
          {logo2 ? (
            <img src={logo2} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
          ) : (
            <span className="text-[10px] font-bold text-white">{d1Team2?.abbreviation?.slice(0, 2) || team2?.short_name?.slice(0, 2) || '?'}</span>
          )}
        </div>
        <span className="flex-1 truncate text-sm text-white">
          {d1Team2?.shortName || team2?.short_name || team2?.name || 'TBD'}
          {hasSpread && team1 && team2 && (
            <span className="text-xs text-zinc-400 ml-1">{getSpreadDisplay(team2, team1)}</span>
          )}
        </span>
        {canEnterResult ? (
          <input
            type="number"
            value={team2Score}
            onChange={(e) => setTeam2Score(e.target.value)}
            onBlur={handleScoreBlur}
            placeholder=""
            className={`w-14 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-center text-sm font-bold appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
              hasResult && game.winner_id === team2?.id ? 'text-green-400' : 'text-white'
            }`}
          />
        ) : (
          <span className="w-14 text-center text-zinc-500">—</span>
        )}
      </div>

      {/* Clear Result Button */}
      {hasResult && (
        <div className="flex items-center gap-3 text-xs">
          <button
            onClick={() => onClearResult(game)}
            disabled={saving}
            className="text-red-400 hover:text-red-300"
          >
            Clear result
          </button>
        </div>
      )}
    </div>
  )
}
