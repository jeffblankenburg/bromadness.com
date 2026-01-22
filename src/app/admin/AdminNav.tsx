'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/admin/tournament', label: 'Tournament' },
  { href: '/admin/results', label: 'Results' },
  { href: '/admin/menu', label: 'Menu' },
  { href: '/admin/auction', label: 'Auction' },
  { href: '/admin/pickem', label: "Pick'em" },
  { href: '/admin/users', label: 'Users' },
  { href: '/admin/expenses', label: 'Expenses' },
  { href: '/admin/dev', label: 'Dev' },
]

export function AdminNav() {
  const pathname = usePathname()

  return (
    <nav className="flex gap-4 mt-3 text-sm overflow-x-auto">
      {NAV_ITEMS.map(item => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`whitespace-nowrap transition-colors ${
              isActive
                ? 'text-orange-400 font-medium'
                : 'text-zinc-400 hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
