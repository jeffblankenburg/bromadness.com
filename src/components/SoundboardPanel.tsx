'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { SoundItem, SoundCategory } from '@/lib/sounds'
import { compressImage } from '@/lib/compress-image'
import { ensureSoundboardSubscribed } from '@/lib/soundboard-channel'
import { useSortableGrid } from '@/lib/useSortableGrid'

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
  const [savingOrder, setSavingOrder] = useState(false)

  // Broadcast toggle
  const [broadcastEnabled, setBroadcastEnabled] = useState(true)

  // Categories
  const [categories, setCategories] = useState<SoundCategory[]>([])
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>([])
  const [newCategoryName, setNewCategoryName] = useState('')
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null)
  const [editingCategoryName, setEditingCategoryName] = useState('')
  const [deleteCategoryConfirmId, setDeleteCategoryConfirmId] = useState<string | null>(null)

  // Local audio playback (when broadcast is off)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map())

  const getAudioContext = () => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
      audioCtxRef.current = new AudioCtx()
    }
    return audioCtxRef.current
  }

  const playLocalSound = async (sound: SoundItem) => {
    const ctx = getAudioContext()
    if (ctx.state === 'suspended') await ctx.resume()

    let audioBuffer = bufferCache.current.get(sound.id)
    if (!audioBuffer) {
      const response = await fetch(sound.audio_url)
      const arrayBuffer = await response.arrayBuffer()
      audioBuffer = await ctx.decodeAudioData(arrayBuffer)
      bufferCache.current.set(sound.id, audioBuffer)
    }

    const source = ctx.createBufferSource()
    source.buffer = audioBuffer
    source.connect(ctx.destination)
    source.start(0)
  }

  const handleReorder = useCallback(async (reorderedSounds: SoundItem[]) => {
    setSounds(reorderedSounds)

    const order = reorderedSounds.map((s, i) => ({
      id: s.id,
      sort_order: i + 1,
    }))

    setSavingOrder(true)
    try {
      const res = await fetch('/api/soundboard', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order }),
        credentials: 'include',
      })

      if (res.ok) {
        const channel = await ensureSoundboardSubscribed()
        await channel.send({
          type: 'broadcast',
          event: 'sounds_updated',
          payload: {},
        })
      } else {
        const refetch = await fetch('/api/soundboard')
        if (refetch.ok) {
          const data = await refetch.json()
          setSounds(data.sounds || [])
        }
      }
    } catch {
      const refetch = await fetch('/api/soundboard')
      if (refetch.ok) {
        const data = await refetch.json()
        setSounds(data.sounds || [])
      }
    }
    setSavingOrder(false)
  }, [])

  const { dragIndex, overIndex, getDragHandlers, containerRef } = useSortableGrid({
    items: sounds,
    enabled: editMode,
    onReorder: handleReorder,
  })

  // Fetch sounds
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

  // Fetch broadcast setting
  useEffect(() => {
    const fetchSetting = async () => {
      try {
        const res = await fetch('/api/app-settings?key=soundboard_broadcast_enabled')
        if (res.ok) {
          const data = await res.json()
          setBroadcastEnabled(data.value === 'true')
        }
      } catch { /* default stays true */ }
    }
    fetchSetting()
  }, [])

  // Fetch categories
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const res = await fetch('/api/soundboard/categories')
        if (res.ok) {
          const data = await res.json()
          setCategories(data.categories || [])
        }
      } catch { /* silently fail */ }
    }
    fetchCategories()
  }, [])

  const playSound = async (sound: SoundItem) => {
    if (recentlyPlayed === sound.id) return
    setRecentlyPlayed(sound.id)
    setTimeout(() => setRecentlyPlayed(null), 300)

    if (broadcastEnabled) {
      const channel = await ensureSoundboardSubscribed()
      await channel.send({
        type: 'broadcast',
        event: 'play_sound',
        payload: {
          sound_id: sound.id,
          played_by: displayName,
        },
      })
    } else {
      await playLocalSound(sound)
    }
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
      if (selectedCategoryIds.length > 0) {
        formData.append('categoryIds', JSON.stringify(selectedCategoryIds))
      }

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
      setSelectedCategoryIds([])
      setError('')
    } catch {
      setError('Upload failed')
    }

    setUploading(false)
  }

  const handleEdit = async () => {
    if (!editingSound || uploading) return

    const nameChanged = editName.trim() && editName.trim() !== editingSound.name
    const categoriesChanged = JSON.stringify(selectedCategoryIds.sort()) !== JSON.stringify([...(editingSound.category_ids || [])].sort())
    const hasChanges = nameChanged || editAudioFile || editImageFile || categoriesChanged

    if (!hasChanges) return
    setUploading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('soundId', editingSound.id)

      if (nameChanged) {
        formData.append('name', editName.trim())
      }
      if (editAudioFile) {
        formData.append('audio', editAudioFile)
      }
      if (editImageFile) {
        const compressed = await compressImage(editImageFile, 200, 0.7)
        formData.append('image', compressed, 'thumb.jpg')
      }
      if (categoriesChanged) {
        formData.append('categoryIds', JSON.stringify(selectedCategoryIds))
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
    setSelectedCategoryIds([])
    setDeleteConfirmId(null)
    setError('')
  }

  const openEditForm = (sound: SoundItem) => {
    setEditingSound(sound)
    setEditName(sound.name)
    setEditAudioFile(null)
    setEditImageFile(null)
    setSelectedCategoryIds(sound.category_ids || [])
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
    closeEditForm()
  }

  const toggleEditMode = (e: React.MouseEvent) => {
    e.stopPropagation()
    setEditMode(!editMode)
    setShowAddForm(false)
    setDeleteConfirmId(null)
    setActiveCategory(null)
    closeEditForm()
  }

  // Category management
  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return
    try {
      const res = await fetch('/api/soundboard/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCategoryName.trim() }),
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCategories(prev => [...prev, data.category])
        setNewCategoryName('')
      }
    } catch { /* silently fail */ }
  }

  const handleRenameCategory = async (categoryId: string) => {
    if (!editingCategoryName.trim()) return
    try {
      const res = await fetch('/api/soundboard/categories', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId, name: editingCategoryName.trim() }),
        credentials: 'include',
      })
      if (res.ok) {
        const data = await res.json()
        setCategories(prev => prev.map(c => c.id === categoryId ? data.category : c))
      }
    } catch { /* silently fail */ }
    setEditingCategoryId(null)
    setEditingCategoryName('')
  }

  const handleDeleteCategory = async (categoryId: string) => {
    try {
      const res = await fetch('/api/soundboard/categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ categoryId }),
        credentials: 'include',
      })
      if (res.ok) {
        setCategories(prev => prev.filter(c => c.id !== categoryId))
        // Remove this category from all sounds locally
        setSounds(prev => prev.map(s => ({
          ...s,
          category_ids: s.category_ids.filter(id => id !== categoryId),
        })))
        if (activeCategory === categoryId) setActiveCategory(null)
      }
    } catch { /* silently fail */ }
    setDeleteCategoryConfirmId(null)
  }

  const toggleCategorySelection = (catId: string) => {
    setSelectedCategoryIds(prev =>
      prev.includes(catId) ? prev.filter(id => id !== catId) : [...prev, catId]
    )
  }

  // Filter sounds by active category (only when not in edit mode)
  const filteredSounds = !editMode && activeCategory
    ? sounds.filter(s => s.category_ids.includes(activeCategory))
    : sounds

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
          {isOpen && savingOrder && (
            <span className="text-[10px] text-zinc-500">Saving...</span>
          )}
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
              {/* Category filter tabs (only when not in edit mode and categories exist) */}
              {!editMode && categories.length > 0 && (
                <div className="flex gap-1.5 overflow-x-auto pb-2 mb-2 -mx-1 px-1" style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
                  <button
                    onClick={() => setActiveCategory(null)}
                    className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                      activeCategory === null
                        ? 'bg-orange-500 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    All
                  </button>
                  {categories.map(cat => (
                    <button
                      key={cat.id}
                      onClick={() => setActiveCategory(cat.id)}
                      className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        activeCategory === cat.id
                          ? 'bg-orange-500 text-white'
                          : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                      }`}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Sound grid */}
              <div ref={containerRef} className="grid grid-cols-4 gap-2">
                {filteredSounds.map((sound, index) => {
                  // For drag, use the index in the full sounds array
                  const fullIndex = editMode ? sounds.indexOf(sound) : index
                  const isDraggingThis = dragIndex === fullIndex
                  const isOverThis = overIndex === fullIndex && dragIndex !== null && dragIndex !== fullIndex

                  return (
                    <div
                      key={sound.id}
                      className="relative"
                      data-drag-index={editMode ? fullIndex : undefined}
                      style={{
                        opacity: isDraggingThis ? 0.3 : 1,
                        transform: isOverThis ? 'scale(1.06)' : undefined,
                        transition: isDraggingThis ? 'none' : 'transform 150ms ease, opacity 150ms ease',
                      }}
                    >
                      {/* Drag handle - only in edit mode */}
                      {editMode && (
                        <div
                          data-drag-handle
                          className="absolute -top-1 -left-1 z-10 w-6 h-6 bg-zinc-700 border border-zinc-500 rounded-full flex items-center justify-center cursor-grab active:cursor-grabbing"
                          style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none' } as React.CSSProperties}
                        >
                          <svg className="w-3 h-3 text-zinc-300" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="9" cy="6" r="2" />
                            <circle cx="15" cy="6" r="2" />
                            <circle cx="9" cy="12" r="2" />
                            <circle cx="15" cy="12" r="2" />
                            <circle cx="9" cy="18" r="2" />
                            <circle cx="15" cy="18" r="2" />
                          </svg>
                        </div>
                      )}
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
                              : isOverThis
                                ? 'bg-orange-500/10 border-orange-500/50'
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
                    </div>
                  )
                })}

                {/* Add Sound button — only in edit mode */}
                {editMode && (
                  <button
                    onClick={() => { setShowAddForm(true); closeEditForm(); setSelectedCategoryIds([]) }}
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
                  {/* Category assignment */}
                  {categories.length > 0 && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Categories</label>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleCategorySelection(cat.id)}
                            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                              selectedCategoryIds.includes(cat.id)
                                ? 'bg-orange-500 text-white'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => setDeleteConfirmId(deleteConfirmId === editingSound.id ? null : editingSound.id)}
                      disabled={uploading}
                      className="flex-1 py-2 bg-red-600 hover:bg-red-700 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-bold rounded-lg text-sm"
                    >
                      {deleteConfirmId === editingSound.id ? 'Confirm?' : 'Delete'}
                    </button>
                    <button
                      onClick={closeEditForm}
                      className="flex-1 py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleEdit}
                      disabled={uploading || (
                        !editAudioFile && !editImageFile
                        && editName.trim() === editingSound.name
                        && JSON.stringify(selectedCategoryIds.sort()) === JSON.stringify([...(editingSound.category_ids || [])].sort())
                      )}
                      className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-sm"
                    >
                      {uploading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                  {deleteConfirmId === editingSound.id && (
                    <button
                      onClick={() => handleDelete(editingSound.id)}
                      className="w-full py-2 bg-red-900/50 border border-red-700 hover:bg-red-800/50 text-red-400 font-medium rounded-lg text-sm"
                    >
                      Yes, permanently delete this sound
                    </button>
                  )}
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
                  {/* Category assignment */}
                  {categories.length > 0 && (
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Categories</label>
                      <div className="flex flex-wrap gap-1.5">
                        {categories.map(cat => (
                          <button
                            key={cat.id}
                            type="button"
                            onClick={() => toggleCategorySelection(cat.id)}
                            className={`px-2 py-0.5 rounded-full text-xs transition-colors ${
                              selectedCategoryIds.includes(cat.id)
                                ? 'bg-orange-500 text-white'
                                : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                            }`}
                          >
                            {cat.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  {error && <p className="text-red-400 text-xs">{error}</p>}
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setShowAddForm(false)
                        setSoundName('')
                        setAudioFile(null)
                        setImageFile(null)
                        setSelectedCategoryIds([])
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

              {/* Category Management — only in edit mode */}
              {editMode && (
                <div className="mt-4 bg-zinc-900 rounded-xl border border-zinc-700 overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-700/50 flex items-center gap-2">
                    <svg className="w-3.5 h-3.5 text-orange-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
                    </svg>
                    <span className="text-xs font-semibold text-orange-400 uppercase tracking-wide">Categories</span>
                  </div>
                  <div className="p-2 space-y-1">
                    {categories.length === 0 && (
                      <p className="text-xs text-zinc-600 text-center py-2">No categories yet</p>
                    )}
                    {categories.map(cat => (
                      <div key={cat.id} className="flex items-center gap-2 bg-zinc-800/50 rounded-lg px-3 py-2">
                        {editingCategoryId === cat.id ? (
                          <>
                            <input
                              type="text"
                              value={editingCategoryName}
                              onChange={e => setEditingCategoryName(e.target.value)}
                              maxLength={30}
                              className="flex-1 bg-zinc-700 border border-zinc-600 text-white rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-orange-500"
                              autoFocus
                              onKeyDown={e => { if (e.key === 'Enter') handleRenameCategory(cat.id) }}
                            />
                            <button
                              onClick={() => handleRenameCategory(cat.id)}
                              className="px-2 py-1 bg-orange-500 hover:bg-orange-600 text-white rounded-md text-[10px] font-medium"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => { setEditingCategoryId(null); setEditingCategoryName('') }}
                              className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-400 rounded-md text-[10px] font-medium"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span className="flex-1 text-xs text-zinc-200 font-medium text-left">{cat.name}</span>
                            <button
                              onClick={() => { setEditingCategoryId(cat.id); setEditingCategoryName(cat.name) }}
                              className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
                              title="Rename"
                            >
                              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L6.832 19.82a4.5 4.5 0 0 1-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 0 1 1.13-1.897L16.863 4.487Zm0 0L19.5 7.125" />
                              </svg>
                            </button>
                            {deleteCategoryConfirmId === cat.id ? (
                              <button
                                onClick={() => handleDeleteCategory(cat.id)}
                                className="px-2 py-0.5 bg-red-600 hover:bg-red-700 text-white rounded-md text-[10px] font-bold"
                              >
                                Confirm?
                              </button>
                            ) : (
                              <button
                                onClick={() => setDeleteCategoryConfirmId(cat.id)}
                                className="p-1 text-zinc-600 hover:text-red-400 transition-colors"
                                title="Delete"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="px-2 pb-2">
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder="New category name..."
                        maxLength={30}
                        className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-2 text-xs placeholder-zinc-600 focus:outline-none focus:border-orange-500"
                        onKeyDown={e => { if (e.key === 'Enter') handleAddCategory() }}
                      />
                      <button
                        onClick={handleAddCategory}
                        disabled={!newCategoryName.trim()}
                        className="px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 disabled:text-zinc-500 text-white font-medium rounded-lg text-xs transition-colors"
                      >
                        Add
                      </button>
                    </div>
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
