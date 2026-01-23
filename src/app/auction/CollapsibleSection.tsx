'use client'

import { useState, useEffect } from 'react'

interface Props {
  title: string
  subtitle?: string
  storageKey: string
  defaultExpanded?: boolean
  children: React.ReactNode
}

export function CollapsibleSection({ title, subtitle, storageKey, defaultExpanded = true, children }: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  useEffect(() => {
    const saved = localStorage.getItem(storageKey)
    if (saved !== null) {
      setExpanded(saved === 'true')
    }
  }, [storageKey])

  const toggleExpanded = () => {
    const newValue = !expanded
    setExpanded(newValue)
    localStorage.setItem(storageKey, String(newValue))
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
      <button
        onClick={toggleExpanded}
        className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-orange-400">{title}</h3>
          {subtitle && <span className="text-xs text-zinc-500">{subtitle}</span>}
        </div>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="pb-2">
          {children}
        </div>
      )}
    </div>
  )
}
