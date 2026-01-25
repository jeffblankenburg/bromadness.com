'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  display_name: string
  full_name: string | null
}

interface Props {
  users: User[]
}

export function CreateBracketClient({ users }: Props) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [bracketType, setBracketType] = useState<'single' | 'double'>('single')
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set())
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const toggleUser = (userId: string) => {
    const newSelected = new Set(selectedUsers)
    if (newSelected.has(userId)) {
      newSelected.delete(userId)
    } else {
      newSelected.add(userId)
    }
    setSelectedUsers(newSelected)
  }

  const selectAll = () => {
    setSelectedUsers(new Set(users.map(u => u.id)))
  }

  const selectNone = () => {
    setSelectedUsers(new Set())
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!name.trim()) {
      setError('Please enter a bracket name')
      return
    }

    if (selectedUsers.size < 2) {
      setError('Please select at least 2 participants')
      return
    }

    setCreating(true)
    try {
      const res = await fetch('/api/brackets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bracketType,
          participantUserIds: Array.from(selectedUsers),
        }),
      })

      const data = await res.json()

      if (res.ok) {
        router.push(`/brackets/${data.id}`)
      } else {
        setError(data.error || 'Failed to create bracket')
      }
    } catch {
      setError('Failed to create bracket')
    } finally {
      setCreating(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Bracket Name */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Bracket Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Darts Tournament"
          className="w-full p-3 bg-zinc-800 rounded-lg text-white placeholder-zinc-500 border border-zinc-700 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
        />
      </div>

      {/* Bracket Type */}
      <div>
        <label className="block text-sm font-medium text-zinc-300 mb-2">
          Elimination Type
        </label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setBracketType('single')}
            className={`flex-1 p-3 rounded-lg border transition-colors ${
              bracketType === 'single'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="font-medium">Single</div>
            <div className="text-xs mt-1 opacity-75">One loss = out</div>
          </button>
          <button
            type="button"
            onClick={() => setBracketType('double')}
            className={`flex-1 p-3 rounded-lg border transition-colors ${
              bracketType === 'double'
                ? 'bg-orange-500 border-orange-500 text-white'
                : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-600'
            }`}
          >
            <div className="font-medium">Double</div>
            <div className="text-xs mt-1 opacity-75">Two losses = out</div>
          </button>
        </div>
      </div>

      {/* Participants */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-zinc-300">
            Participants ({selectedUsers.size} selected)
          </label>
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              onClick={selectAll}
              className="text-orange-400 hover:text-orange-300"
            >
              All
            </button>
            <span className="text-zinc-600">|</span>
            <button
              type="button"
              onClick={selectNone}
              className="text-orange-400 hover:text-orange-300"
            >
              None
            </button>
          </div>
        </div>
        <div className="bg-zinc-800 rounded-lg border border-zinc-700 max-h-64 overflow-y-auto">
          {users.map((user) => (
            <label
              key={user.id}
              className="flex items-center gap-3 p-3 hover:bg-zinc-700/50 cursor-pointer border-b border-zinc-700/50 last:border-b-0"
            >
              <input
                type="checkbox"
                checked={selectedUsers.has(user.id)}
                onChange={() => toggleUser(user.id)}
                className="w-5 h-5 rounded bg-zinc-700 border-zinc-600 text-orange-500 focus:ring-orange-500 focus:ring-offset-0"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user.display_name}</div>
                {user.full_name && user.full_name !== user.display_name && (
                  <div className="text-xs text-zinc-500 truncate">{user.full_name}</div>
                )}
              </div>
            </label>
          ))}
        </div>
        {selectedUsers.size > 0 && (
          <div className="mt-2 text-sm text-zinc-400">
            {selectedUsers.size} players will be randomly seeded
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 bg-red-900/50 border border-red-800 rounded-lg text-red-200 text-sm">
          {error}
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={creating || selectedUsers.size < 2 || !name.trim()}
        className="w-full p-4 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-400 rounded-xl font-medium transition-colors"
      >
        {creating ? 'Creating...' : 'Create Bracket'}
      </button>
    </form>
  )
}
