'use client'

import { useState, useEffect } from 'react'
import { SoundItem } from '@/lib/sounds'
import { compressImage } from '@/lib/compress-image'
import { ensureSoundboardSubscribed } from '@/lib/soundboard-channel'

interface Props {
  displayName: string
  userId: string
  isAdmin: boolean
}

export function SoundboardPanel({ displayName, userId, isAdmin }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [sounds, setSounds] = useState<SoundItem[]>([])
  const [loading, setLoading] = useState(true)
  const [recentlyPlayed, setRecentlyPlayed] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [soundName, setSoundName] = useState('')
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [editingSound, setEditingSound] = useState<SoundItem | null>(null)
  const [editName, setEditName] = useState('')
  const [editAudioFile, setEditAudioFile] = useState<File | null>(null)
  const [editImageFile, setEditImageFile] = useState<File | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchSounds = async () => {
      try {
        const res = await fetch('/api/soundboard')
        if (res.ok) {
          const data = await res.json()
          setSounds(data.sounds || [])
        }
      } catch {
        // Silently fail
      }
      setLoading(false)
    }
    fetchSounds()
  }, [])

  const playSound = async (sound: SoundItem) => {
    if (recentlyPlayed === sound.id) return
    setRecentlyPlayed(sound.id)
    setTimeout(() => setRecentlyPlayed(null), 300)

    // Broadcast to all users (including self via self:true on channel)
    // SoundListener handles all audio playback with a single AudioContext
    const channel = await ensureSoundboardSubscribed()
    const result = await channel.send({
      type: 'broadcast',
      event: 'play_sound',
      payload: {
        sound_id: sound.id,
        played_by: displayName,
      },
    })
    console.log('[SoundboardPanel] Broadcast result:', result)
  }

  const handleUpload = async () => {
    if (!audioFile || !imageFile || !soundName.trim() || uploading) return
    setUploading(true)
    setError('')

    try {
      const compressed = await compressImage(imageFile, 200, 0.7)

      const formData = new FormData()
      formData.append('audio', audioFile)
      formData.append('image', compressed, 'thumb.jpg')
      formData.append('name', soundName.trim())

      const res = await fetch('/api/soundboard', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Upload failed')
        setUploading(false)
        return
      }

      const data = await res.json()
      setSounds(prev => [...prev, data.sound])

      // Notify other clients
      const channel = await ensureSoundboardSubscribed()
      await channel.send({
        type: 'broadcast',
        event: 'sounds_updated',
        payload: {},
      })

      setShowAddForm(false)
      setSoundName('')
      setAudioFile(null)
      setImageFile(null)
      setError('')
    } catch {
      setError('Upload failed')
    }

    setUploading(false)
  }

  const handleEdit = async () => {
    if (!editingSound || uploading) return
    if (!editName.trim() && !editAudioFile && !editImageFile) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('soundId', editingSound.id)

      if (editName.trim() && editName.trim() !== editingSound.name) {
        formData.append('name', editName.trim())
      }
      if (editAudioFile) {
        formData.append('audio', editAudioFile)
      }
      if (editImageFile) {
        const compressed = await compressImage(editImageFile, 200, 0.7)
        formData.append('image', compressed, 'thumb.jpg')
      }

      const res = await fetch('/api/soundboard', {
        method: 'PATCH',
        body: formData,
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Update failed')
        setUploading(false)
        return
      }

      const data = await res.json()
      setSounds(prev => prev.map(s => s.id === data.sound.id ? data.sound : s))

      // Notify other clients
      const channel = await ensureSoundboardSubscribed()
      await channel.send({
        type: 'broadcast',
        event: 'sounds_updated',
        payload: {},
      })

      closeEditForm()
    } catch {
      setError('Update failed')
    }

    setUploading(false)
  }

  const closeEditForm = () => {
    setEditingSound(null)
    setEditName('')
    setEditAudioFile(null)
    setEditImageFile(null)
    setError('')
  }

  const openEditForm = (sound: SoundItem) => {
    setEditingSound(sound)
    setEditName(sound.name)
    setEditAudioFile(null)
    setEditImageFile(null)
    setShowAddForm(false)
    setDeleteConfirmId(null)
    setError('')
  }

  const handleDelete = async (soundId: string) => {
    try {
      const res = await fetch('/api/soundboard', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soundId }),
        credentials: 'include',
      })

      if (res.ok) {
        setSounds(prev => prev.filter(s => s.id !== soundId))

        const channel = await ensureSoundboardSubscribed()
        await channel.send({
          type: 'broadcast',
          event: 'sounds_updated',
          payload: {},
        })
      }
    } catch {
      // Silently fail
    }
    setDeleteConfirmId(null)
  }

  const toggleEditMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditMode(!editMode)
    setShowAddForm(false)
    setDeleteConfirmId(null)
    closeEditForm()
  }

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 cursor-pointer"
        role="button"
        tabIndex={0}
      >
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
          </svg>
          <span className="text-sm font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            Soundboard
          </span>
        </div>
        <div className="flex items-center gap-2">
          {isOpen && (
            <button
              onClick={toggleEditMode}
              className={`p-1 rounded transition-colors ${editMode ? 'text-orange-400' : 'text-zinc-500 hover:text-zinc-300'}`}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
            </button>
          )}
          <svg
            className={`w-5 h-5 text-zinc-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
          </svg>
        </div>
      </div>

      {isOpen && (
        <div className="px-4 pb-4">
          {loading ? (
            <p className="text-zinc-500 text-sm text-center py-4">Loading sounds...</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-2">
                {sounds.map(sound => (
                  <div key={sound.id} className="relative">
                    <button
                      onClick={() => editMode ? openEditForm(sound) : playSound(sound)}
                      disabled={!editMode && recentlyPlayed === sound.id}
                      className={`
                        w-full flex flex-col items-center gap-1 p-2 rounded-xl
                        border transition-all duration-150 active:scale-95
                        ${editingSound?.id === sound.id
                          ? 'bg-orange-500/20 border-orange-500'
                          : recentlyPlayed === sound.id
                            ? 'bg-orange-500/20 border-orange-500 scale-95'
                            : editMode
                              ? 'bg-zinc-900/50 border-zinc-600 hover:bg-zinc-700/50 hover:border-zinc-500'
                              : 'bg-zinc-900/50 border-zinc-700 hover:bg-zinc-700/50 hover:border-zinc-600'
                        }
                      `}
                    >
                      <img
                        src={sound.image_url}
                        alt={sound.name}
                        className="w-12 h-12 rounded-lg object-cover"
                      />
                      <span className="text-[10px] font-medium text-zinc-300 truncate w-full text-center">
                        {sound.name}
                      </span>
                    </button>
                    {editMode && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setDeleteConfirmId(deleteConfirmId === sound.id ? null : sound.id)
                        }}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-white text-xs leading-none"
                      >
                        &times;
                      </button>
                    )}
                    {editMode && deleteConfirmId === sound.id && (
                      <div className="absolute inset-0 z-10 bg-black/80 rounded-xl flex items-center justify-center">
                        <button
                          onClick={() => handleDelete(sound.id)}
                          className="text-xs text-red-400 font-bold px-2 py-1"
                        >
                          Delete?
                        </button>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add Sound button — only in edit mode */}
                {editMode && (
                  <button
                    onClick={() => { setShowAddForm(true); closeEditForm() }}
                    className="flex flex-col items-center justify-center gap-1 p-2 rounded-xl border border-dashed border-zinc-600 hover:border-zinc-500 hover:bg-zinc-800/50 transition-colors"
                  >
                    <span className="text-2xl text-zinc-500">+</span>
                    <span className="text-[10px] font-medium text-zinc-500">Add</span>
                  </button>
                )}
              </div>

              {/* Edit Sound Form */}
              {editMode && editingSound && (
                <div className="mt-3 p-3 bg-zinc-900 rounded-xl border border-zinc-700 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <img
                      src={editImageFile ? URL.createObjectURL(editImageFile) : editingSound.image_url}
                      alt=""
                      className="w-10 h-10 rounded-lg object-cover"
                    />
                    <span className="text-xs text-zinc-400">Editing</span>
                  </div>
                  <input
                    type="text"
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Sound name"
                    maxLength={50}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-center truncate">
                      <input
                        type="file"
                        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
                        onChange={e => setEditAudioFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <span className={editAudioFile ? 'text-orange-400' : 'text-zinc-500'}>
                        {editAudioFile ? editAudioFile.name : 'Replace audio'}
                      </span>
                    </label>
                    <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-center truncate">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => setEditImageFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <span className={editImageFile ? 'text-orange-400' : 'text-zinc-500'}>
                        {editImageFile ? 'Image set' : 'Replace image'}
                      </span>
                    </label>
                  </div>
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={closeEditForm}
                      className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={uploading || (!editAudioFile && !editImageFile && editName.trim() === editingSound.name)}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
                    >
                      {uploading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </div>
              )}

              {/* Add Sound Form — only in edit mode */}
              {editMode && showAddForm && !editingSound && (
                <div className="mt-3 p-3 bg-zinc-900 rounded-xl border border-zinc-700 space-y-3">
                  <input
                    type="text"
                    value={soundName}
                    onChange={e => setSoundName(e.target.value)}
                    placeholder="Sound name"
                    maxLength={50}
                    className="w-full bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-sm"
                  />
                  <div className="flex gap-2">
                    <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-center truncate">
                      <input
                        type="file"
                        accept="audio/*,.m4a,.mp3,.wav,.ogg,.webm"
                        onChange={e => setAudioFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <span className={audioFile ? 'text-orange-400' : 'text-zinc-500'}>
                        {audioFile ? audioFile.name : 'Choose audio'}
                      </span>
                    </label>
                    <label className="flex-1 cursor-pointer bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-center truncate">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={e => setImageFile(e.target.files?.[0] || null)}
                        className="hidden"
                      />
                      <span className={imageFile ? 'text-orange-400' : 'text-zinc-500'}>
                        {imageFile ? 'Image set' : 'Choose image'}
                      </span>
                    </label>
                  </div>
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddForm(false)
                        setSoundName('')
                        setAudioFile(null)
                        setImageFile(null)
                        setError('')
                      }}
                      className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUpload}
                      disabled={uploading || !audioFile || !imageFile || !soundName.trim()}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
                    >
                      {uploading ? 'Uploading...' : 'Add Sound'}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
