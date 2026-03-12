'use client'

import { useState, useRef, useEffect } from 'react'

export function ThemeSongButton() {
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const togglePlay = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio('/Bro Madness.mp3')
      audioRef.current.addEventListener('ended', () => setIsPlaying(false))
    }

    if (isPlaying) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <button
      onClick={togglePlay}
      className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl p-4 transition-all active:scale-95"
    >
      <div className="flex items-center justify-center gap-3">
        {isPlaying ? (
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
          </svg>
        ) : (
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M8 5.14v14l11-7-11-7z" />
          </svg>
        )}
        <span className="text-lg font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
          {isPlaying ? 'Stop Theme Song' : 'Play Theme Song'}
        </span>
      </div>
    </button>
  )
}
