'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tournamentId: string
  currentSimulatedTime: string | null
  firstGameTimes: { date: string; time: string }[]
}

export function TimeSimulator({ tournamentId, currentSimulatedTime, firstGameTimes }: Props) {
  const [saving, setSaving] = useState(false)
  const [customDate, setCustomDate] = useState('')
  const [customTime, setCustomTime] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const setSimulatedTime = async (time: string | null) => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({ dev_simulated_time: time })
        .eq('id', tournamentId)

      if (error) throw error
      router.refresh()
    } catch (error) {
      console.error('Failed to set simulated time:', error)
      alert('Failed to set simulated time')
    }
    setSaving(false)
  }

  const handleSetCustomTime = () => {
    if (!customDate || !customTime) {
      alert('Please enter both date and time')
      return
    }
    const isoTime = `${customDate}T${customTime}:00`
    setSimulatedTime(isoTime)
  }

  const handleQuickSet = (minutesOffset: number, gameTime: string) => {
    const baseTime = new Date(gameTime)
    baseTime.setMinutes(baseTime.getMinutes() + minutesOffset)
    setSimulatedTime(baseTime.toISOString())
  }

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-purple-400">Time Simulator (Dev Tool)</h3>
        {currentSimulatedTime && (
          <button
            onClick={() => setSimulatedTime(null)}
            disabled={saving}
            className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
          >
            {saving ? '...' : 'Clear / Use Real Time'}
          </button>
        )}
      </div>

      {currentSimulatedTime ? (
        <div className="text-sm">
          <span className="text-zinc-400">Current simulated time: </span>
          <span className="text-purple-300 font-mono">
            {new Date(currentSimulatedTime).toLocaleString()}
          </span>
        </div>
      ) : (
        <div className="text-sm text-zinc-400">
          Using real time. Set a simulated time to test pick locking.
        </div>
      )}

      {/* Quick set buttons for each day's first game */}
      {firstGameTimes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-zinc-500">Quick set relative to first game:</p>
          {firstGameTimes.map(({ date, time }) => (
            <div key={date} className="flex flex-wrap gap-2">
              <span className="text-xs text-zinc-400 w-20">
                {new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' })}:
              </span>
              <button
                onClick={() => handleQuickSet(-60, time)}
                disabled={saving}
                className="px-2 py-1 text-xs bg-zinc-700 rounded hover:bg-zinc-600 transition-colors"
              >
                1hr before
              </button>
              <button
                onClick={() => handleQuickSet(-5, time)}
                disabled={saving}
                className="px-2 py-1 text-xs bg-zinc-700 rounded hover:bg-zinc-600 transition-colors"
              >
                5min before
              </button>
              <button
                onClick={() => handleQuickSet(5, time)}
                disabled={saving}
                className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors"
              >
                5min after (locked)
              </button>
              <button
                onClick={() => handleQuickSet(60, time)}
                disabled={saving}
                className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors"
              >
                1hr after (locked)
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Custom time input */}
      <div className="flex items-end gap-2">
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Date</label>
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            className="px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded"
          />
        </div>
        <div>
          <label className="block text-xs text-zinc-500 mb-1">Time</label>
          <input
            type="time"
            value={customTime}
            onChange={(e) => setCustomTime(e.target.value)}
            className="px-2 py-1 text-sm bg-zinc-800 border border-zinc-700 rounded"
          />
        </div>
        <button
          onClick={handleSetCustomTime}
          disabled={saving || !customDate || !customTime}
          className="px-3 py-1 text-sm bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : 'Set Custom'}
        </button>
      </div>
    </div>
  )
}
