'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  display_name: string
  phone: string
}

interface Props {
  users: User[]
  currentSimulatedUser: User | null
}

export function UserSimulator({ users, currentSimulatedUser }: Props) {
  const [selectedUserId, setSelectedUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()

  const startSimulation = async () => {
    if (!selectedUserId) {
      alert('Please select a user')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/admin/simulate-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: selectedUserId }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to start simulation')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to start simulation:', error)
      alert(error instanceof Error ? error.message : 'Failed to start simulation')
    }
    setSaving(false)
  }

  const stopSimulation = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/simulate-user', {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to stop simulation')
      }

      router.refresh()
    } catch (error) {
      console.error('Failed to stop simulation:', error)
      alert(error instanceof Error ? error.message : 'Failed to stop simulation')
    }
    setSaving(false)
  }

  return (
    <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-4 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-purple-400">User Simulator (Dev Tool)</h3>
        {currentSimulatedUser && (
          <button
            onClick={stopSimulation}
            disabled={saving}
            className="px-3 py-1 text-xs bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-colors"
          >
            {saving ? '...' : 'Stop Simulating'}
          </button>
        )}
      </div>

      {currentSimulatedUser ? (
        <div className="text-sm">
          <span className="text-zinc-400">Currently simulating: </span>
          <span className="text-purple-300 font-semibold">
            {currentSimulatedUser.display_name}
          </span>
          <span className="text-zinc-500 text-xs ml-2">
            ({currentSimulatedUser.phone})
          </span>
        </div>
      ) : (
        <div className="text-sm text-zinc-400">
          Not simulating any user. Select a user to view and interact with the app as them.
        </div>
      )}

      {/* User selection */}
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <label className="block text-xs text-zinc-500 mb-1">Select User</label>
          <select
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded"
          >
            <option value="">-- Select a user --</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>
                {user.display_name} ({user.phone})
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={startSimulation}
          disabled={saving || !selectedUserId}
          className="px-4 py-2 text-sm bg-purple-500/20 text-purple-400 rounded hover:bg-purple-500/30 transition-colors disabled:opacity-50"
        >
          {saving ? '...' : 'Simulate'}
        </button>
      </div>

      <p className="text-xs text-zinc-500">
        When simulating a user, you&apos;ll see their data and can make picks on their behalf.
        A purple banner will appear on every page to remind you.
      </p>
    </div>
  )
}
