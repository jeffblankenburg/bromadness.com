'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { TeamSelector } from './TeamSelector'

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

interface Tournament {
  id: string
  name: string
  year: number
}

interface Props {
  tournament: Tournament
  regions: Region[]
  teams: Team[]
}

// Bracket matchups in order
const MATCHUPS = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
]

export function BracketEditor({ tournament, regions, teams }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<{ regionId: string; seed: number } | null>(null)
  const [activeRegion, setActiveRegion] = useState<string>(regions[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  const getTeamForSlot = (regionId: string, seed: number) => {
    return teams.find(t => t.region_id === regionId && t.seed === seed)
  }

  const handleTeamSelect = async (teamName: string, shortName: string) => {
    if (!selectedSlot) return

    setSaving(true)
    const existingTeam = getTeamForSlot(selectedSlot.regionId, selectedSlot.seed)

    try {
      if (existingTeam) {
        await supabase
          .from('teams')
          .update({ name: teamName, short_name: shortName })
          .eq('id', existingTeam.id)
      } else {
        await supabase
          .from('teams')
          .insert({
            tournament_id: tournament.id,
            region_id: selectedSlot.regionId,
            name: teamName,
            short_name: shortName,
            seed: selectedSlot.seed,
          })
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

    setSaving(true)
    try {
      await supabase.from('teams').delete().eq('id', existingTeam.id)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
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
          <div className="space-y-2">
            {MATCHUPS.map(([seed1, seed2], idx) => {
              const team1 = getTeamForSlot(activeRegion, seed1)
              const team2 = getTeamForSlot(activeRegion, seed2)
              const isSelected1 = selectedSlot?.regionId === activeRegion && selectedSlot?.seed === seed1
              const isSelected2 = selectedSlot?.regionId === activeRegion && selectedSlot?.seed === seed2

              return (
                <div key={idx} className="bg-zinc-800/50 rounded-xl p-3 space-y-1">
                  <div className="text-xs text-zinc-500 mb-2">Game {idx + 1}</div>

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
