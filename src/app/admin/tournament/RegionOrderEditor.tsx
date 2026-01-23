'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { ClearTournament } from './ClearTournament'

interface Region {
  id: string
  name: string
  position: number
}

interface Props {
  regions: Region[]
  tournamentId: string
}

export function RegionOrderEditor({ regions: initialRegions, tournamentId }: Props) {
  const [regions, setRegions] = useState<Region[]>(
    [...initialRegions].sort((a, b) => a.position - b.position)
  )
  const [isOpen, setIsOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const moveUp = (index: number) => {
    if (index === 0) return
    const newRegions = [...regions]
    // Swap positions
    const temp = newRegions[index - 1]
    newRegions[index - 1] = newRegions[index]
    newRegions[index] = temp
    // Update position values
    newRegions.forEach((r, i) => {
      r.position = i + 1
    })
    setRegions(newRegions)
  }

  const moveDown = (index: number) => {
    if (index === regions.length - 1) return
    const newRegions = [...regions]
    // Swap positions
    const temp = newRegions[index + 1]
    newRegions[index + 1] = newRegions[index]
    newRegions[index] = temp
    // Update position values
    newRegions.forEach((r, i) => {
      r.position = i + 1
    })
    setRegions(newRegions)
  }

  const saveOrder = async () => {
    setSaving(true)
    try {
      // Update each region's position
      for (const region of regions) {
        const { error } = await supabase
          .from('regions')
          .update({ position: region.position })
          .eq('id', region.id)

        if (error) {
          console.error('Failed to update region:', error)
          alert('Failed to save region order: ' + error.message)
          setSaving(false)
          return
        }
      }
      router.refresh()
    } finally {
      setSaving(false)
    }
  }

  // Check if order has changed from initial
  const hasChanges = regions.some((r, i) => {
    const initial = initialRegions.find(ir => ir.id === r.id)
    return initial && initial.position !== r.position
  })

  return (
    <div className="border border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between bg-zinc-800/50 hover:bg-zinc-800 transition-colors"
      >
        <span className="text-sm font-medium text-zinc-300">Bracket Settings</span>
        <svg
          className={`w-5 h-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isOpen && (
        <div className="p-4 space-y-4 bg-zinc-900/50">
          <div>
            <h4 className="text-sm font-medium text-zinc-300 mb-1">Final Four Matchups</h4>
            <p className="text-xs text-zinc-500 mb-3">
              Regions are paired by position: 1 vs 2 and 3 vs 4. Reorder to change matchups.
            </p>

            <div className="space-y-2">
              {regions.map((region, index) => (
                <div
                  key={region.id}
                  className="flex items-center gap-2 px-3 py-2 bg-zinc-800 rounded-lg"
                >
                  <span className="w-6 h-6 flex items-center justify-center bg-zinc-700 rounded text-xs font-mono text-zinc-300">
                    {region.position}
                  </span>
                  <span className="flex-1 text-sm text-white">{region.name}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => moveUp(index)}
                      disabled={index === 0}
                      className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => moveDown(index)}
                      disabled={index === regions.length - 1}
                      className="p-1 text-zinc-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Visual representation of matchups */}
          <div className="pt-2 border-t border-zinc-700">
            <p className="text-xs text-zinc-500 mb-2">Current Final Four setup:</p>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-zinc-800 rounded-lg p-2 text-center">
                <div className="text-zinc-400 mb-1">Semifinal 1</div>
                <div className="text-white font-medium">
                  {regions[0]?.name || '?'} vs {regions[1]?.name || '?'}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-2 text-center">
                <div className="text-zinc-400 mb-1">Semifinal 2</div>
                <div className="text-white font-medium">
                  {regions[2]?.name || '?'} vs {regions[3]?.name || '?'}
                </div>
              </div>
            </div>
          </div>

          {hasChanges && (
            <button
              onClick={saveOrder}
              disabled={saving}
              className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors"
            >
              {saving ? 'Saving...' : 'Save Order'}
            </button>
          )}

          {/* Danger Zone */}
          <div className="pt-4 mt-4 border-t border-zinc-700">
            <p className="text-xs text-zinc-500 mb-2">Danger Zone</p>
            <ClearTournament tournamentId={tournamentId} />
          </div>
        </div>
      )}
    </div>
  )
}
