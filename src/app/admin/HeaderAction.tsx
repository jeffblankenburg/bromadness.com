'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

export function HeaderAction({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = useState<HTMLElement | null>(null)

  useEffect(() => {
    const el = document.getElementById('admin-header-actions')
    setContainer(el)
  }, [])

  if (!container) return null

  return createPortal(children, container)
}
