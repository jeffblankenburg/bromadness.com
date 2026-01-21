'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Region {
  id: string
  name: string
  position: number
}

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
}

interface Tournament {
  id: string
  name: string
  year: number
}

interface Props {
  tournament: Tournament
  regions: Region[]
  teams: Team[]
  games: Game[]
}

const ROUND_NAMES: Record<number, string> = {
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
}

export function GameResults({ tournament, regions, teams, games }: Props) {
  const [activeRound, setActiveRound] = useState(1)
  const [saving, setSaving] = useState<string | null>(null)
  const router = useRouter()
  const supabase = createClient()

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  const getTeamById = (teamId: string | null): Team | null => {
    if (!teamId) return null
    return teams.find(t => t.id === teamId) || null
  }

  const getRegionById = (regionId: string | null) => {
    if (!regionId) return null
    return regions.find(r => r.id === regionId)
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

      router.refresh()
    } catch (err) {
      console.error('Failed to save result:', err)
    } finally {
      setSaving(null)
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

      router.refresh()
    } catch (err) {
      console.error('Failed to clear result:', err)
    } finally {
      setSaving(null)
    }
  }

  // Group games by region for rounds 1-4
  const gamesByRegion = activeRound <= 4
    ? sortedRegions.map(region => ({
        region,
        games: roundGames.filter(g => g.region_id === region.id),
      }))
    : [{ region: null, games: roundGames }]

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
      <div className="space-y-4">
        {gamesByRegion.map(({ region, games: regionGames }) => (
          <div key={region?.id || 'final'} className="space-y-2">
            {region && (
              <h3 className="text-sm font-semibold text-orange-400">{region.name} Region</h3>
            )}
            {!region && activeRound >= 5 && (
              <h3 className="text-sm font-semibold text-orange-400">{ROUND_NAMES[activeRound]}</h3>
            )}

            {regionGames.map((game) => (
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

            {regionGames.length === 0 && (
              <p className="text-zinc-500 text-sm">No games in this round yet.</p>
            )}
          </div>
        ))}
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
  const [showScoreInput, setShowScoreInput] = useState(false)
  const [pendingWinner, setPendingWinner] = useState<string | null>(null)

  const hasResult = game.winner_id !== null
  const canEnterResult = team1 && team2

  const handleTeamClick = (teamId: string) => {
    if (!canEnterResult || saving) return
    if (hasResult) return // Already has result

    setPendingWinner(teamId)
    setShowScoreInput(true)
  }

  const handleSubmitScore = () => {
    if (!pendingWinner) return
    const t1Score = parseInt(team1Score) || 0
    const t2Score = parseInt(team2Score) || 0
    onSetWinner(game, pendingWinner, t1Score, t2Score)
    setShowScoreInput(false)
    setPendingWinner(null)
  }

  const handleCancel = () => {
    setShowScoreInput(false)
    setPendingWinner(null)
    setTeam1Score(game.team1_score?.toString() || '')
    setTeam2Score(game.team2_score?.toString() || '')
  }

  const formatDate = (date: string | null) => {
    if (!date) return null
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className={`bg-zinc-800/50 rounded-xl p-3 space-y-2 ${saving ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span>Game {game.game_number}</span>
        {game.scheduled_at && <span>{formatDate(game.scheduled_at)}</span>}
      </div>

      {/* Team 1 */}
      <button
        onClick={() => team1 && handleTeamClick(team1.id)}
        disabled={!canEnterResult || saving || hasResult}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
          game.winner_id === team1?.id
            ? 'bg-green-600 text-white'
            : pendingWinner === team1?.id
            ? 'bg-orange-500 text-white'
            : team1
            ? 'bg-zinc-700 hover:bg-zinc-600'
            : 'bg-zinc-900 text-zinc-500'
        }`}
      >
        <span className="w-6 text-sm font-mono text-zinc-400">{team1?.seed || '?'}</span>
        <span className="flex-1 truncate">{team1?.name || 'TBD'}</span>
        {hasResult && game.team1_score !== null && (
          <span className="font-bold">{game.team1_score}</span>
        )}
      </button>

      {/* Team 2 */}
      <button
        onClick={() => team2 && handleTeamClick(team2.id)}
        disabled={!canEnterResult || saving || hasResult}
        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
          game.winner_id === team2?.id
            ? 'bg-green-600 text-white'
            : pendingWinner === team2?.id
            ? 'bg-orange-500 text-white'
            : team2
            ? 'bg-zinc-700 hover:bg-zinc-600'
            : 'bg-zinc-900 text-zinc-500'
        }`}
      >
        <span className="w-6 text-sm font-mono text-zinc-400">{team2?.seed || '?'}</span>
        <span className="flex-1 truncate">{team2?.name || 'TBD'}</span>
        {hasResult && game.team2_score !== null && (
          <span className="font-bold">{game.team2_score}</span>
        )}
      </button>

      {/* Score Input */}
      {showScoreInput && (
        <div className="flex items-center gap-2 pt-2 border-t border-zinc-700">
          <input
            type="number"
            value={team1Score}
            onChange={(e) => setTeam1Score(e.target.value)}
            placeholder={team1?.short_name || 'T1'}
            className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-center text-sm"
          />
          <span className="text-zinc-500">-</span>
          <input
            type="number"
            value={team2Score}
            onChange={(e) => setTeam2Score(e.target.value)}
            placeholder={team2?.short_name || 'T2'}
            className="w-16 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-center text-sm"
          />
          <button
            onClick={handleSubmitScore}
            className="px-3 py-1 bg-green-600 hover:bg-green-700 text-white text-sm rounded"
          >
            Save
          </button>
          <button
            onClick={handleCancel}
            className="px-3 py-1 bg-zinc-700 hover:bg-zinc-600 text-white text-sm rounded"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Clear Result Button */}
      {hasResult && !showScoreInput && (
        <button
          onClick={() => onClearResult(game)}
          disabled={saving}
          className="text-xs text-red-400 hover:text-red-300"
        >
          Clear result
        </button>
      )}
    </div>
  )
}
