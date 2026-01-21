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

export function BracketEditor({ tournament, regions, teams }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<{ regionId: string; seed: number } | null>(null)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)
  // Bracket order: matchups are 1v16, 8v9, 5v12, 4v13, 6v11, 3v14, 7v10, 2v15
  const seeds = [1, 16, 8, 9, 5, 12, 4, 13, 6, 11, 3, 14, 7, 10, 2, 15]

  const getTeamForSlot = (regionId: string, seed: number) => {
    return teams.find(t => t.region_id === regionId && t.seed === seed)
  }

  const handleTeamSelect = async (teamName: string, shortName: string) => {
    if (!selectedSlot) return

    setSaving(true)
    const existingTeam = getTeamForSlot(selectedSlot.regionId, selectedSlot.seed)

    try {
      if (existingTeam) {
        // Update existing team
        await supabase
          .from('teams')
          .update({ name: teamName, short_name: shortName })
          .eq('id', existingTeam.id)
      } else {
        // Create new team
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Bracket Editor</h3>
        <span className="text-sm text-zinc-400">
          Tap a slot to assign a team
        </span>
      </div>

      {/* Bracket Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {sortedRegions.map((region) => (
          <div key={region.id} className="bg-zinc-800/50 rounded-xl p-3">
            <h4 className="text-sm font-semibold text-orange-400 mb-3">{region.name}</h4>
            <div className="space-y-1">
              {seeds.map((seed) => {
                const team = getTeamForSlot(region.id, seed)
                const isSelected = selectedSlot?.regionId === region.id && selectedSlot?.seed === seed

                return (
                  <button
                    key={seed}
                    onClick={() => setSelectedSlot({ regionId: region.id, seed })}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${
                      isSelected
                        ? 'bg-orange-500 text-white'
                        : team
                        ? 'bg-zinc-700 hover:bg-zinc-600'
                        : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                    }`}
                  >
                    <span className="w-5 text-xs text-zinc-400 font-mono">{seed}</span>
                    <span className={`flex-1 text-sm truncate ${!team ? 'text-zinc-500 italic' : ''}`}>
                      {team ? team.name : 'Empty'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

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
