'use client'

import { useState, useEffect } from 'react'

export default function AdminSoundboardPage() {
  const [broadcastEnabled, setBroadcastEnabled] = useState(true)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const res = await fetch('/api/app-settings?key=soundboard_broadcast_enabled')
        if (res.ok) {
          const data = await res.json()
          setBroadcastEnabled(data.value === 'true')
        }
      } catch { /* default stays true */ }
      setLoading(false)
    }
    fetchSetting()
  }, [])

  const toggleBroadcast = async () => {
    const newValue = !broadcastEnabled
    setBroadcastEnabled(newValue)
    try {
      await fetch('/api/app-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'soundboard_broadcast_enabled', value: String(newValue) }),
        credentials: 'include',
      })
    } catch { /* local state already updated */ }
  }

  if (loading) {
    return <p className="text-zinc-500 text-sm text-center py-8">Loading...</p>
  }

  return (
    <div className="space-y-4">
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-white">Broadcast to all devices</h3>
            <p className="text-xs text-zinc-400 mt-1">
              {broadcastEnabled
                ? 'Sounds play on every connected device when pressed.'
                : 'Sounds only play on the device that pressed the button.'}
            </p>
          </div>
          <button
            onClick={toggleBroadcast}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors flex-shrink-0 ${
              broadcastEnabled ? 'bg-orange-500' : 'bg-zinc-600'
            }`}
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              broadcastEnabled ? 'translate-x-6' : 'translate-x-1'
            }`} />
          </button>
        </div>
      </div>
    </div>
  )
}
