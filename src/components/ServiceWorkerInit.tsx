'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/push-notifications'

export function ServiceWorkerInit() {
  useEffect(() => {
    // Register service worker on app load
    registerServiceWorker()
  }, [])

  return null
}
