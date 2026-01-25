'use client'

import { useState, useRef, useEffect } from 'react'

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡']

const EMOJI_CATEGORIES: Record<string, string[]> = {
  'Smileys': ['😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉', '😍', '🥰', '😘'],
  'Gestures': ['👍', '👎', '👏', '🙌', '🤝', '✌️', '🤞', '💪', '🙏'],
  'Hearts': ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '💔', '💕', '💖'],
  'Faces': ['😮', '😢', '😭', '😤', '😡', '🤔', '🤯', '😱', '🥳', '🤩'],
}

interface ReactionPickerProps {
  onSelect: (emoji: string) => void
  onClose: () => void
  currentEmoji?: string
}

export function ReactionPicker({ onSelect, onClose, currentEmoji }: ReactionPickerProps) {
  const [showFullPicker, setShowFullPicker] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleEmojiClick = (emoji: string) => {
    if (emoji === currentEmoji) {
      onSelect('')
    } else {
      onSelect(emoji)
    }
    onClose()
  }

  return (
    <div
      ref={pickerRef}
      className="bg-zinc-800 rounded-xl shadow-lg border border-zinc-700 p-2"
    >
      {!showFullPicker ? (
        <div className="flex items-center gap-1">
          {QUICK_EMOJIS.map(emoji => (
            <button
              key={emoji}
              onClick={() => handleEmojiClick(emoji)}
              className={`text-2xl p-1 hover:bg-zinc-700 rounded transition-colors ${
                emoji === currentEmoji ? 'bg-zinc-600 ring-2 ring-orange-500' : ''
              }`}
            >
              {emoji}
            </button>
          ))}
          <button
            onClick={() => setShowFullPicker(true)}
            className="text-xl p-1 hover:bg-zinc-700 rounded text-zinc-400"
            title="More emojis"
          >
            +
          </button>
        </div>
      ) : (
        <div className="w-64 max-h-48 overflow-y-auto">
          <button
            onClick={() => setShowFullPicker(false)}
            className="text-xs text-zinc-400 mb-2 hover:text-white"
          >
            ← Back
          </button>
          {Object.entries(EMOJI_CATEGORIES).map(([category, emojis]) => (
            <div key={category} className="mb-2">
              <div className="text-xs text-zinc-500 mb-1">{category}</div>
              <div className="flex flex-wrap gap-1">
                {emojis.map(emoji => (
                  <button
                    key={emoji}
                    onClick={() => handleEmojiClick(emoji)}
                    className={`text-xl p-1 hover:bg-zinc-700 rounded ${
                      emoji === currentEmoji ? 'bg-zinc-600' : ''
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
