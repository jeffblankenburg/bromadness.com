'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  children: React.ReactNode
}

export function ScheduleClient({ children }: Props) {
  const router = useRouter()

  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, 30000) // Refresh every 30 seconds

    return () => clearInterval(interval)
  }, [router])

  return <>{children}</>
}
