'use client'

import { useState, useRef, useCallback, useEffect } from 'react'

const THRESHOLD = 60

export function PullToRefresh({ children }: { children: React.ReactNode }) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const touchStartY = useRef(0)
  const pulling = useRef(false)

  const handleTouchStart = useCallback((e: TouchEvent) => {
    if (window.scrollY <= 0 && !isRefreshing) {
      touchStartY.current = e.touches[0].clientY
      pulling.current = true
    }
  }, [isRefreshing])

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!pulling.current || isRefreshing) return
    const diff = e.touches[0].clientY - touchStartY.current
    if (diff > 0 && window.scrollY <= 0) {
      setPullDistance(Math.min(diff * 0.4, 100))
    } else if (diff < -5) {
      pulling.current = false
      setPullDistance(0)
    }
  }, [isRefreshing])

  const handleTouchEnd = useCallback(() => {
    if (!pulling.current) return
    pulling.current = false

    if (pullDistance >= THRESHOLD) {
      setIsRefreshing(true)
      setPullDistance(40)
      window.location.reload()
    } else {
      setPullDistance(0)
    }
  }, [pullDistance])

  useEffect(() => {
    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)
    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return (
    <>
      {(pullDistance > 0 || isRefreshing) && (
        <div
          className="fixed left-1/2 -translate-x-1/2 z-50"
          style={{ top: Math.max(pullDistance - 40, 4) }}
        >
          <div
            className={`w-9 h-9 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center shadow-lg ${
              isRefreshing ? 'animate-spin' : ''
            }`}
          >
            <svg
              className="w-4 h-4 text-orange-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              style={
                !isRefreshing
                  ? { transform: `rotate(${(pullDistance / THRESHOLD) * 360}deg)` }
                  : undefined
              }
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.992 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
              />
            </svg>
          </div>
        </div>
      )}
      {children}
    </>
  )
}
