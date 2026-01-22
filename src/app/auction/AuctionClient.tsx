'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  children: React.ReactNode
  auctionComplete: boolean
}

export function AuctionClient({ children, auctionComplete }: Props) {
  const router = useRouter()

  // Auto-refresh: every 5 seconds during auction, every 30 seconds after
  useEffect(() => {
    const interval = setInterval(() => {
      router.refresh()
    }, auctionComplete ? 30000 : 5000)

    return () => clearInterval(interval)
  }, [auctionComplete, router])

  return <>{children}</>
}
