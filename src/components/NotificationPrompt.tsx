'use client'

import { useState, useEffect } from 'react'
import {
  isPushSupported,
  isPWAInstalled,
  getNotificationPermission,
  subscribeToPush,
  registerServiceWorker,
} from '@/lib/push-notifications'

export function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const checkNotificationStatus = async () => {
      // Check if dismissed recently (7 days)
      const dismissedAt = localStorage.getItem('notification-prompt-dismissed')
      if (dismissedAt && Date.now() - parseInt(dismissedAt) < 7 * 24 * 60 * 60 * 1000) {
        setDismissed(true)
        return
      }

      // Only show if push is supported
      if (!isPushSupported()) {
        return
      }

      // Only show if PWA is installed (or on desktop)
      const isDesktop = !(/Android|iPhone|iPad|iPod/.test(navigator.userAgent))
      if (!isPWAInstalled() && !isDesktop) {
        return
      }

      // Don't show if already granted or denied
      const permission = getNotificationPermission()
      if (permission === 'granted' || permission === 'denied') {
        return
      }

      // Register service worker first
      await registerServiceWorker()

      setShowPrompt(true)
    }

    checkNotificationStatus()
  }, [])

  const handleEnable = async () => {
    setIsSubscribing(true)
    try {
      await subscribeToPush()
      setShowPrompt(false)
    } catch (error) {
      console.error('Failed to enable notifications:', error)
      // If permission was denied, hide the prompt
      if (getNotificationPermission() === 'denied') {
        setShowPrompt(false)
      }
    } finally {
      setIsSubscribing(false)
    }
  }

  const handleDismiss = () => {
    setDismissed(true)
    setShowPrompt(false)
    localStorage.setItem('notification-prompt-dismissed', Date.now().toString())
  }

  if (!showPrompt || dismissed) {
    return null
  }

  return (
    <div className="bg-zinc-800 border border-zinc-700 rounded-xl p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <h3 className="text-white font-semibold text-sm mb-1">Enable Notifications</h3>
          <p className="text-zinc-400 text-xs">
            Get notified when someone sends a message in chat
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleEnable}
            disabled={isSubscribing}
            className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 disabled:bg-orange-500/50 text-white text-xs font-medium rounded-lg transition-colors"
          >
            {isSubscribing ? 'Enabling...' : 'Enable'}
          </button>
          <button
            onClick={handleDismiss}
            className="p-1 text-zinc-500 hover:text-zinc-300 transition-colors"
            aria-label="Dismiss"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  )
}
