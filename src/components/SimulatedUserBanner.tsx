'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface Props {
  userName: string
  hasDevBanner?: boolean
}

export function SimulatedUserBanner({ userName, hasDevBanner = false }: Props) {
  const router = useRouter()
  const [stopping, setStopping] = useState(false)

  const handleStop = async () => {
    setStopping(true)
    try {
      await fetch('/api/admin/simulate-user', { method: 'DELETE' })
      router.refresh()
    } catch (error) {
      console.error('Failed to stop simulation:', error)
      setStopping(false)
    }
  }

  return (
    <div className={`fixed left-0 right-0 z-50 bg-purple-500/90 text-white px-4 py-1.5 text-xs text-center ${hasDevBanner ? 'top-8' : 'top-0'}`}>
      <span className="font-bold">SIMULATING:</span> {userName}
      <button
        onClick={handleStop}
        disabled={stopping}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/20 rounded transition-colors"
        title="Stop simulating"
      >
        {stopping ? (
          <span className="text-xs">...</span>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        )}
      </button>
    </div>
  )
}
