'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface User {
  id: string
  phone: string
  display_name: string
  full_name: string | null
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
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [togglingAdmin, setTogglingAdmin] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deletingUser, setDeletingUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [menuOpenFor, setMenuOpenFor] = useState<string | null>(null)
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
        body: JSON.stringify({ phone: e164Phone, displayName, fullName: fullName || null }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to create user')
        return
      }

      setPhone('')
      setDisplayName('')
      setFullName('')
      setShowAddForm(false)
      router.refresh()
    } catch (err) {
      setError('Failed to create user')
    } finally {
      setSaving(false)
    }
  }

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingUser) return

    setError('')
    setSaving(true)

    // Convert formatted phone to E.164 format
    const digits = phone.replace(/\D/g, '')
    const e164Phone = `+1${digits}`

    try {
      const res = await fetch('/api/admin/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: editingUser.id,
          displayName,
          fullName: fullName || null,
          phone: e164Phone,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update user')
        return
      }

      setEditingUser(null)
      setPhone('')
      setDisplayName('')
      setFullName('')
      router.refresh()
    } catch (err) {
      setError('Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const startEditing = (user: User) => {
    setEditingUser(user)
    // Convert E.164 phone to formatted display
    const digits = user.phone.replace(/\D/g, '').slice(-10)
    setPhone(formatPhone(digits))
    setDisplayName(user.display_name)
    setFullName(user.full_name || '')
    setError('')
  }

  const cancelEditing = () => {
    setEditingUser(null)
    setPhone('')
    setDisplayName('')
    setFullName('')
    setError('')
  }

  const handleDelete = async () => {
    if (!deletingUser || deleteConfirm !== 'DELETE') return

    setDeleting(true)
    try {
      const res = await fetch('/api/admin/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: deletingUser.id }),
      })

      const data = await res.json()

      if (!res.ok) {
        alert(data.error || 'Failed to delete user')
        return
      }

      setDeletingUser(null)
      setDeleteConfirm('')
      router.refresh()
    } catch (err) {
      alert('Failed to delete user')
    } finally {
      setDeleting(false)
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
                setPhone('')
                setDisplayName('')
                setFullName('')
              }}
              className="text-zinc-400 hover:text-white text-sm"
            >
              Cancel
            </button>
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Full Name</label>
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Stacey Bartlett"
              className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm text-zinc-400 mb-1">Nickname</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Smitty"
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
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium">{user.display_name}</span>
                  {user.is_admin && (
                    <span className="text-xs bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded">
                      Admin
                    </span>
                  )}
                  {!user.is_active && (
                    <span className="text-xs bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">
                      Inactive
                    </span>
                  )}
                </div>
                {user.full_name && (
                  <div className="text-sm text-zinc-400">{user.full_name}</div>
                )}
                <div className="text-sm text-zinc-500">{user.phone}</div>
              </div>
              <div className="relative flex-shrink-0">
                <button
                  onClick={() => setMenuOpenFor(menuOpenFor === user.id ? null : user.id)}
                  className="p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                {menuOpenFor === user.id && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setMenuOpenFor(null)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-zinc-800 border border-zinc-700 rounded-lg shadow-lg py-1 min-w-[140px]">
                      <button
                        onClick={() => {
                          startEditing(user)
                          setMenuOpenFor(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          toggleAdmin(user.id, user.is_admin)
                          setMenuOpenFor(null)
                        }}
                        disabled={togglingAdmin === user.id}
                        className="w-full px-3 py-2 text-left text-sm text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
                      >
                        {user.is_admin ? 'Remove Admin' : 'Make Admin'}
                      </button>
                      <button
                        onClick={() => {
                          setDeletingUser(user)
                          setMenuOpenFor(null)
                        }}
                        className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-zinc-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p className="text-zinc-500 text-center py-4">No users yet</p>
          )}
        </div>
      </div>

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={cancelEditing}
          />

          <form
            onSubmit={handleEditSubmit}
            className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-orange-400">Edit User</h3>
              <button
                type="button"
                onClick={cancelEditing}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="John Michael Smith"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-1">Nickname</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Smitty"
                required
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
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
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
              />
            </div>

            {error && (
              <p className="text-red-400 text-sm">{error}</p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cancelEditing}
                className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || !phone || !displayName}
                className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => {
              setDeletingUser(null)
              setDeleteConfirm('')
            }}
          />

          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-red-400">Delete User</h3>
              <button
                onClick={() => {
                  setDeletingUser(null)
                  setDeleteConfirm('')
                }}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-3 text-sm">
              <p className="text-zinc-300">
                Are you sure you want to delete <span className="font-semibold text-white">{deletingUser.display_name}</span>?
              </p>
              <p className="text-zinc-400">
                This will permanently remove the user and all their associated data including picks, auction teams, and game history.
              </p>
              <p className="text-red-400 font-medium">
                This action cannot be undone.
              </p>
            </div>

            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Type <span className="font-mono text-white">DELETE</span> to confirm
              </label>
              <input
                type="text"
                value={deleteConfirm}
                onChange={(e) => setDeleteConfirm(e.target.value)}
                placeholder="DELETE"
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDeletingUser(null)
                  setDeleteConfirm('')
                }}
                className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleteConfirm !== 'DELETE' || deleting}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
              >
                {deleting ? 'Deleting...' : 'Delete User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
