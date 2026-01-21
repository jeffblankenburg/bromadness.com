'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamSelector } from './TeamSelector'
import { ROUND1_MATCHUPS } from '@/lib/bracket/generate'

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

export function BracketEditor({ tournament, regions, teams, games }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<{ regionId: string; seed: number } | null>(null)
  const [activeRegion, setActiveRegion] = useState<string>(regions[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  const getTeamForSlot = (regionId: string, seed: number) => {
    return teams.find(t => t.region_id === regionId && t.seed === seed)
  }

  const getGameForMatchup = (regionId: string, gameNumber: number) => {
    return games.find(g => g.region_id === regionId && g.round === 1 && g.game_number === gameNumber)
  }

  const getTeamById = (teamId: string | null) => {
    if (!teamId) return null
    return teams.find(t => t.id === teamId)
  }

  // Find which game number a seed belongs to, and whether it's team1 or team2
  const getGameInfoForSeed = (seed: number): { gameNumber: number; isTeam1: boolean } | null => {
    for (let i = 0; i < ROUND1_MATCHUPS.length; i++) {
      const [seed1, seed2] = ROUND1_MATCHUPS[i]
      if (seed === seed1) return { gameNumber: i + 1, isTeam1: true }
      if (seed === seed2) return { gameNumber: i + 1, isTeam1: false }
    }
    return null
  }

  const handleTeamSelect = async (teamName: string, shortName: string) => {
    if (!selectedSlot) return

    setSaving(true)
    const existingTeam = getTeamForSlot(selectedSlot.regionId, selectedSlot.seed)
    const gameInfo = getGameInfoForSeed(selectedSlot.seed)
    const game = gameInfo ? getGameForMatchup(selectedSlot.regionId, gameInfo.gameNumber) : null

    try {
      let teamId: string

      if (existingTeam) {
        // Update existing team
        await supabase
          .from('teams')
          .update({ name: teamName, short_name: shortName })
          .eq('id', existingTeam.id)
        teamId = existingTeam.id
      } else {
        // Create new team
        const { data: newTeam } = await supabase
          .from('teams')
          .insert({
            tournament_id: tournament.id,
            region_id: selectedSlot.regionId,
            name: teamName,
            short_name: shortName,
            seed: selectedSlot.seed,
          })
          .select()
          .single()
        teamId = newTeam?.id
      }

      // Update the round 1 game with the team
      if (game && teamId && gameInfo) {
        await supabase
          .from('games')
          .update(gameInfo.isTeam1 ? { team1_id: teamId } : { team2_id: teamId })
          .eq('id', game.id)
      }

      router.refresh()
    } catch (err) {
      console.error('Failed to save team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
    }
  }

  const handleClearTeam = async () => {
    if (!selectedSlot) return

    const existingTeam = getTeamForSlot(selectedSlot.regionId, selectedSlot.seed)
    if (!existingTeam) {
      setSelectedSlot(null)
      return
    }

    const gameInfo = getGameInfoForSeed(selectedSlot.seed)
    const game = gameInfo ? getGameForMatchup(selectedSlot.regionId, gameInfo.gameNumber) : null

    setSaving(true)
    try {
      // Clear from game first
      if (game && gameInfo) {
        await supabase
          .from('games')
          .update(gameInfo.isTeam1 ? { team1_id: null } : { team2_id: null })
          .eq('id', game.id)
      }

      // Delete team
      await supabase.from('teams').delete().eq('id', existingTeam.id)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
    }
  }

  const handleScheduleChange = async (gameId: string, datetime: string) => {
    try {
      await supabase
        .from('games')
        .update({ scheduled_at: datetime || null })
        .eq('id', gameId)
      router.refresh()
    } catch (err) {
      console.error('Failed to update schedule:', err)
    }
  }

  const currentRegion = sortedRegions.find(r => r.id === activeRegion)
  const regionTeamCount = teams.filter(t => t.region_id === activeRegion).length

  return (
    <div className="space-y-4">
      {/* Region Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl">
        {sortedRegions.map((region) => {
          const count = teams.filter(t => t.region_id === region.id).length
          const isActive = region.id === activeRegion
          return (
            <button
              key={region.id}
              onClick={() => setActiveRegion(region.id)}
              className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <div>{region.name}</div>
              <div className={`text-xs ${isActive ? 'text-orange-200' : 'text-zinc-500'}`}>
                {count}/16
              </div>
            </button>
          )
        })}
      </div>

      {/* Current Region */}
      {currentRegion && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-orange-400">{currentRegion.name} Region</h3>
            <span className="text-sm text-zinc-400">{regionTeamCount}/16 teams</span>
          </div>

          {/* Matchups */}
          <div className="space-y-3">
            {ROUND1_MATCHUPS.map(([seed1, seed2], idx) => {
              const gameNumber = idx + 1
              const game = getGameForMatchup(activeRegion, gameNumber)
              const team1 = getTeamForSlot(activeRegion, seed1)
              const team2 = getTeamForSlot(activeRegion, seed2)
              const isSelected1 = selectedSlot?.regionId === activeRegion && selectedSlot?.seed === seed1
              const isSelected2 = selectedSlot?.regionId === activeRegion && selectedSlot?.seed === seed2

              return (
                <div key={idx} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-zinc-500">Game {gameNumber}</span>
                    {game && (
                      <input
                        type="datetime-local"
                        value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                        onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                        className="text-xs bg-zinc-900 border border-zinc-700 rounded px-2 py-1 text-zinc-300"
                      />
                    )}
                  </div>

                  <button
                    onClick={() => setSelectedSlot({ regionId: activeRegion, seed: seed1 })}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected1
                        ? 'bg-orange-500 text-white'
                        : team1
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                    }`}
                  >
                    <span className="w-6 text-sm font-mono text-zinc-400">{seed1}</span>
                    <span className={`flex-1 truncate ${!team1 ? 'text-zinc-500 italic' : ''}`}>
                      {team1 ? team1.name : 'Select team...'}
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedSlot({ regionId: activeRegion, seed: seed2 })}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      isSelected2
                        ? 'bg-orange-500 text-white'
                        : team2
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                    }`}
                  >
                    <span className="w-6 text-sm font-mono text-zinc-400">{seed2}</span>
                    <span className={`flex-1 truncate ${!team2 ? 'text-zinc-500 italic' : ''}`}>
                      {team2 ? team2.name : 'Select team...'}
                    </span>
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Team Selector Modal */}
      {selectedSlot && (
        <TeamSelector
          regionName={sortedRegions.find(r => r.id === selectedSlot.regionId)?.name || ''}
          seed={selectedSlot.seed}
          currentTeam={getTeamForSlot(selectedSlot.regionId, selectedSlot.seed)}
          onSelect={handleTeamSelect}
          onClear={handleClearTeam}
          onClose={() => setSelectedSlot(null)}
          saving={saving}
        />
      )}
    </div>
  )
}
