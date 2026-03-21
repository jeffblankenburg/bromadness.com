'use client'

import Link from 'next/link'

interface Props {
  pickemMissing: number
  brocketMissing: number
}

export function PicksDueBanner({ pickemMissing, brocketMissing }: Props) {
  if (pickemMissing === 0 && brocketMissing === 0) return null

  const parts: string[] = []
  if (pickemMissing > 0) parts.push(`${pickemMissing} Pick'em pick${pickemMissing === 1 ? '' : 's'}`)
  if (brocketMissing > 0) parts.push(`${brocketMissing} Brocket pick${brocketMissing === 1 ? '' : 's'}`)

  return (
    <div className="space-y-2 mb-2">
      <div className="rotating-border p-3">
        <div className="relative z-10 text-red-400 text-sm font-medium text-center">
          You still need to make {parts.join(' and ')} before games lock!
        </div>
      </div>
      <div className="flex gap-2">
        {pickemMissing > 0 && (
          <Link
            href="/pickem"
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm uppercase tracking-wide text-center hover:bg-orange-600 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Make Pick&apos;em Picks
          </Link>
        )}
        {brocketMissing > 0 && (
          <Link
            href="/brocket"
            className="flex-1 py-2 rounded-xl bg-orange-500 text-white font-bold text-sm uppercase tracking-wide text-center hover:bg-orange-600 transition-colors"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Make Brocket Picks
          </Link>
        )}
      </div>
    </div>
  )
}
