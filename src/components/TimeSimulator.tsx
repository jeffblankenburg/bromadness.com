'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Props {
  tournamentId: string
  currentSimulatedTime: string | null
  firstGameTimes: { date: string; time: string }[]
}

// Format time for display (all times are stored as Eastern)
const formatEastern = (timeStr: string) => {
  const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) return timeStr

  const [, year, month, day, hours, mins] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayName = days[date.getDay()]
  const monthName = months[parseInt(month) - 1]

  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'

  return `${dayName}, ${monthName} ${parseInt(day)}, ${hour12}:${mins} ${ampm} ET`
}

const formatTimeOnly = (timeStr: string) => {
  const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) return timeStr

  const [, , , , hours, mins] = match
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'

  return `${hour12}:${mins} ${ampm}`
}

const getDayName = (timeStr: string) => {
  const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return ''
  const [, year, month, day] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  return days[date.getDay()]
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
    // Store time as-is (Eastern time, no timezone conversion)
    setSimulatedTime(`${customDate}T${customTime}:00`)
  }

  const handleQuickSet = (minutesOffset: number, gameTime: string) => {
    // Extract time components from the string
    const match = gameTime.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
    if (!match) return

    const [, year, month, day, hours, mins] = match.map(Number)

    // Calculate new time with offset
    let totalMins = hours * 60 + mins + minutesOffset
    let newDay = day
    let newMonth = month
    let newYear = year

    // Handle day overflow/underflow
    while (totalMins >= 24 * 60) {
      totalMins -= 24 * 60
      newDay++
    }
    while (totalMins < 0) {
      totalMins += 24 * 60
      newDay--
    }

    // Simple day bounds check (doesn't handle month boundaries perfectly but good enough for quick set)
    if (newDay < 1) newDay = 1
    if (newDay > 31) newDay = 31

    const newHours = Math.floor(totalMins / 60)
    const newMins = totalMins % 60

    const pad = (n: number) => n.toString().padStart(2, '0')
    setSimulatedTime(`${newYear}-${pad(newMonth)}-${pad(newDay)}T${pad(newHours)}:${pad(newMins)}:00`)
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
          <span className="text-zinc-400">Simulated time: </span>
          <span className="text-purple-300 font-mono">
            {formatEastern(currentSimulatedTime)}
          </span>
        </div>
      ) : (
        <div className="text-sm text-zinc-400">
          Using real time. Set a simulated time to test pick locking.
        </div>
      )}

      {/* Quick set buttons for each day's first game */}
      {firstGameTimes.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-zinc-500">Quick set relative to first game of the day:</p>
          {firstGameTimes.map(({ date, time }) => {
            const dayName = getDayName(time)
            const gameTimeStr = formatTimeOnly(time)

            return (
              <div key={date} className="space-y-1">
                <div className="text-xs text-zinc-300">
                  {dayName} - First game at <span className="text-orange-400 font-medium">{gameTimeStr} ET</span>
                </div>
                <div className="flex flex-wrap gap-2">
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
                    5min after
                  </button>
                  <button
                    onClick={() => handleQuickSet(60, time)}
                    disabled={saving}
                    className="px-2 py-1 text-xs bg-orange-500/20 text-orange-400 rounded hover:bg-orange-500/30 transition-colors"
                  >
                    1hr after
                  </button>
                </div>
              </div>
            )
          })}
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
