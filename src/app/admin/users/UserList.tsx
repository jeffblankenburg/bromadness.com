'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  phone: string
  display_name: string
  is_admin: boolean
  is_active: boolean
  created_at: string
}

interface Props {
  users: User[]
}

export function UserList({ users }: Props) {
  const [showAddForm, setShowAddForm] = useState(false)
  const [phone, setPhone] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [error, setError] = useState('')
  const router = useRouter()

  const toggleAdmin = async (userId: string, currentStatus: boolean) => {
    setTogglingAdmin(userId)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, isAdmin: !currentStatus }),
      })

      if (!res.ok) {
        const data = await res.json()
        alert(data.error || 'Failed to update user')
        return
      }

      router.refresh()
    } catch (err) {
      alert('Failed to update user')
    } finally {
      setTogglingAdmin(null)
    }
  }

  const formatPhone = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '')
    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setSaving(true)

    // Convert formatted phone to E.164 format
    const digits = phone.replace(/\D/g, '')
    const e164Phone = `+1${digits}`

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: e164Phone, displayName }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create user')
        return
      }

      setPhone('')
      setDisplayName('')
      setShowAddForm(false)
      router.refresh()
    } catch (err) {
      setError('Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Add User Button/Form */}
      {!showAddForm ? (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-lg"
        >
          Add User
        </button>
      ) : (
        <form onSubmit={handleSubmit} className="bg-zinc-800/50 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-orange-400">New User</h3>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false)
                setError('')
              }}
              className="text-zinc-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="John Smith"
              required
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Phone</label>
            <input
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              placeholder="(555) 123-4567"
              required
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
            />
          </div>

          {error && (
            <p className="text-red-400 text-sm">{error}</p>
          )}

          <button
            type="submit"
            disabled={saving || !phone || !displayName}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded-lg"
          >
            {saving ? 'Creating...' : 'Create User'}
          </button>
        </form>
      )}

      {/* User List */}
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-orange-400 mb-3">
          {users.length} Users
        </h3>
        <div className="space-y-2">
          {users.map(user => (
            <div key={user.id} className="flex items-center justify-between py-2 border-b border-zinc-700 last:border-0">
              <div>
                <div className="font-medium">{user.display_name}</div>
                <div className="text-sm text-zinc-500">{user.phone}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => toggleAdmin(user.id, user.is_admin)}
                  disabled={togglingAdmin === user.id}
                  className={`text-xs px-2 py-0.5 rounded transition-colors ${
                    user.is_admin
                      ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                      : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                  }`}
                >
                  {togglingAdmin === user.id ? '...' : user.is_admin ? 'Admin' : 'User'}
                </button>
                {!user.is_active && (
                  <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">
                    Inactive
                  </span>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-zinc-500 text-center py-4">No users yet</p>
          )}
        </div>
      </div>
    </div>
  )
}
