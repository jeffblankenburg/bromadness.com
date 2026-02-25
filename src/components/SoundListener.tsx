'use client'

import { useEffect, useRef } from 'react'
import { SoundItem } from '@/lib/sounds'
import { getSoundboardChannel, ensureSoundboardSubscribed, cleanupSoundboardChannel } from '@/lib/soundboard-channel'

export function SoundListener() {
  const bufferCache = useRef<Map<string, AudioBuffer>>(new Map())
  const soundsList = useRef<SoundItem[]>([])
  const audioUnlocked = useRef(false)
  const audioCtxRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    const fetchSounds = async () => {
      try {
        const res = await fetch('/api/soundboard')
        if (res.ok) {
          const data = await res.json()
          soundsList.current = data.sounds || []
          console.log('[SoundListener] Loaded', soundsList.current.length, 'sounds')
        }
      } catch {
        // Silently fail
      }
    }

    // Fetch sounds immediately so they're ready when a broadcast arrives
    fetchSounds()

    const getAudioContext = () => {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        audioCtxRef.current = new AudioCtx()
      }
      return audioCtxRef.current
    }

    const unlockAudio = () => {
      if (audioUnlocked.current) return

      const ctx = getAudioContext()
      const buffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = buffer
      source.connect(ctx.destination)
      source.start(0)

      audioUnlocked.current = true
      console.log('[SoundListener] Audio unlocked')

      document.removeEventListener('touchstart', unlockAudio)
      document.removeEventListener('click', unlockAudio)
    }

    document.addEventListener('touchstart', unlockAudio)
    document.addEventListener('click', unlockAudio)

    const playAudioUrl = async (url: string, soundId: string) => {
      try {
        if (!audioUnlocked.current) {
          console.warn('[SoundListener] Audio not unlocked yet, attempting unlock')
          unlockAudio()
        }

        const ctx = getAudioContext()
        if (ctx.state === 'suspended') await ctx.resume()

        let audioBuffer = bufferCache.current.get(soundId)
        if (!audioBuffer) {
          const response = await fetch(url)
          const arrayBuffer = await response.arrayBuffer()
          audioBuffer = await ctx.decodeAudioData(arrayBuffer)
          bufferCache.current.set(soundId, audioBuffer)
        }

        const source = ctx.createBufferSource()
        source.buffer = audioBuffer
        source.connect(ctx.destination)
        source.start(0)
        console.log('[SoundListener] Playing sound:', soundId)
      } catch (err) {
        console.error('[SoundListener] Play failed:', err)
      }
    }

    // Set up listeners on the shared channel, then subscribe
    const channel = getSoundboardChannel()

    channel
      .on('broadcast', { event: 'play_sound' }, (payload) => {
        console.log('[SoundListener] Received play_sound:', payload.payload)
        const { sound_id } = payload.payload
        const sound = soundsList.current.find(s => s.id === sound_id)
        if (!sound) {
          console.warn('[SoundListener] Sound not found:', sound_id, 'Have', soundsList.current.length, 'sounds')
          return
        }
        playAudioUrl(sound.audio_url, sound.id)
      })
      .on('broadcast', { event: 'sounds_updated' }, () => {
        console.log('[SoundListener] Sounds updated, refetching')
        bufferCache.current.clear()
        fetchSounds()
      })

    ensureSoundboardSubscribed()

    return () => {
      cleanupSoundboardChannel()
      document.removeEventListener('touchstart', unlockAudio)
      document.removeEventListener('click', unlockAudio)
    }
  }, [])

  return null
}
