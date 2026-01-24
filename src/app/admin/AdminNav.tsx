'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect, useRef } from 'react'

const NAV_ITEMS = [
  { href: '/admin/tournament', label: 'Tournament Setup' },
  { href: '/admin/results', label: 'Game Results' },
  { href: '/admin/auction', label: 'Auction' },
  { href: '/admin/pickem', label: "Pick'em" },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/trip-cost', label: 'Trip Cost' },
  { href: '/admin/payouts', label: 'Payouts' },
  { href: '/admin/menu', label: 'Food Menu' },
  { href: '/admin/chat', label: 'Chat' },
  { href: '/admin/dev', label: 'Dev' },
]

export function AdminNav() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  // Get current page title
  const currentItem = NAV_ITEMS.find(
    item => pathname === item.href || pathname.startsWith(item.href + '/')
  )
  const pageTitle = currentItem?.label || 'Admin'

  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close menu on route change
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <div className="relative" ref={menuRef}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{pageTitle}</h1>
          <div id="admin-header-actions" />
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 -mr-2 text-zinc-400 hover:text-white transition-colors"
          aria-label="Toggle menu"
        >
          {isOpen ? (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          )}
        </button>
      </div>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-48 bg-zinc-800 border border-zinc-700 rounded-xl shadow-xl overflow-hidden z-50">
          {NAV_ITEMS.map(item => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block px-4 py-3 text-sm transition-colors ${
                  isActive
                    ? 'bg-orange-500/20 text-orange-400 font-medium'
                    : 'text-zinc-300 hover:bg-zinc-700'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
