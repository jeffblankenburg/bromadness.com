'use client'

import { useRef, useState, useCallback, useEffect } from 'react'

const DRAG_THRESHOLD = 5

interface UseSortableGridOptions<T> {
  items: T[]
  enabled: boolean
  onReorder: (reorderedItems: T[]) => void
}

export function useSortableGrid<T>({ items, enabled, onReorder }: UseSortableGridOptions<T>) {
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  // Use state instead of ref so we can trigger the effect when the element mounts
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const containerRef = useCallback((node: HTMLDivElement | null) => {
    setContainer(node)
  }, [])

  const ghostRef = useRef<HTMLDivElement | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const isDragging = useRef(false)
  const dragItemIndex = useRef<number | null>(null)
  const currentOverIndex = useRef<number | null>(null)
  const itemsRef = useRef(items)
  const onReorderRef = useRef(onReorder)
  const enabledRef = useRef(enabled)

  useEffect(() => { itemsRef.current = items }, [items])
  useEffect(() => { onReorderRef.current = onReorder }, [onReorder])
  useEffect(() => { enabledRef.current = enabled }, [enabled])

  const cleanupDrag = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove()
      ghostRef.current = null
    }
    isDragging.current = false
    dragItemIndex.current = null
    currentOverIndex.current = null
    startPos.current = null
    setDragIndex(null)
    setOverIndex(null)
  }, [])

  const findDropIndex = useCallback((x: number, y: number): number | null => {
    if (ghostRef.current) ghostRef.current.style.visibility = 'hidden'
    const el = document.elementFromPoint(x, y)
    if (ghostRef.current) ghostRef.current.style.visibility = ''
    if (!el) return null
    const draggable = el.closest('[data-drag-index]') as HTMLElement | null
    if (!draggable) return null
    const idx = parseInt(draggable.getAttribute('data-drag-index') || '', 10)
    return isNaN(idx) ? null : idx
  }, [])

  // Attach/detach listeners whenever the container element or enabled state changes
  useEffect(() => {
    if (!container) return

    let handleEl: HTMLElement | null = null

    const createGhost = (el: HTMLElement, x: number, y: number) => {
      const itemEl = el.closest('[data-drag-index]') as HTMLElement | null
      if (!itemEl) return
      const rect = itemEl.getBoundingClientRect()
      const ghost = itemEl.cloneNode(true) as HTMLDivElement
      ghost.style.cssText = `
        position: fixed;
        width: ${rect.width}px;
        height: ${rect.height}px;
        left: ${x - rect.width / 2}px;
        top: ${y - rect.height / 2}px;
        z-index: 9999;
        pointer-events: none;
        opacity: 0.85;
        transform: scale(1.08);
        filter: drop-shadow(0 4px 12px rgba(0,0,0,0.4));
      `
      document.body.appendChild(ghost)
      ghostRef.current = ghost
    }

    const moveGhost = (x: number, y: number) => {
      if (!ghostRef.current) return
      const w = ghostRef.current.offsetWidth
      const h = ghostRef.current.offsetHeight
      ghostRef.current.style.left = `${x - w / 2}px`
      ghostRef.current.style.top = `${y - h / 2}px`
    }

    const onMove = (x: number, y: number) => {
      if (!startPos.current || !handleEl) return
      const dx = x - startPos.current.x
      const dy = y - startPos.current.y
      if (!isDragging.current && Math.sqrt(dx * dx + dy * dy) >= DRAG_THRESHOLD) {
        isDragging.current = true
        setDragIndex(dragItemIndex.current)
        createGhost(handleEl, x, y)
      }
      if (isDragging.current) {
        moveGhost(x, y)
        const idx = findDropIndex(x, y)
        if (idx !== null && idx !== currentOverIndex.current) {
          currentOverIndex.current = idx
          setOverIndex(idx)
        }
      }
    }

    const detachDocListeners = () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('touchend', onTouchEnd)
      document.removeEventListener('touchcancel', onTouchEnd)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseEnd)
    }

    const onEnd = () => {
      if (isDragging.current && dragItemIndex.current !== null && currentOverIndex.current !== null && dragItemIndex.current !== currentOverIndex.current) {
        const newItems = [...itemsRef.current]
        const [moved] = newItems.splice(dragItemIndex.current, 1)
        newItems.splice(currentOverIndex.current, 0, moved)
        onReorderRef.current(newItems)
      }
      detachDocListeners()
      cleanupDrag()
      handleEl = null
    }

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const t = e.touches[0]
      if (t) onMove(t.clientX, t.clientY)
    }
    const onTouchEnd = () => onEnd()
    const onMouseMove = (e: MouseEvent) => { e.preventDefault(); onMove(e.clientX, e.clientY) }
    const onMouseEnd = () => onEnd()

    const onTouchStart = (e: TouchEvent) => {
      if (!enabledRef.current) return
      const target = e.target as HTMLElement
      const handle = target.closest('[data-drag-handle]') as HTMLElement | null
      if (!handle) return
      const item = handle.closest('[data-drag-index]') as HTMLElement | null
      if (!item) return
      const idx = parseInt(item.getAttribute('data-drag-index') || '', 10)
      if (isNaN(idx)) return

      e.preventDefault()
      const t = e.touches[0]
      if (!t) return

      handleEl = handle
      startPos.current = { x: t.clientX, y: t.clientY }
      dragItemIndex.current = idx

      document.addEventListener('touchmove', onTouchMove, { passive: false })
      document.addEventListener('touchend', onTouchEnd)
      document.addEventListener('touchcancel', onTouchEnd)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (!enabledRef.current) return
      if (e.button !== 0) return
      const target = e.target as HTMLElement
      const handle = target.closest('[data-drag-handle]') as HTMLElement | null
      if (!handle) return
      const item = handle.closest('[data-drag-index]') as HTMLElement | null
      if (!item) return
      const idx = parseInt(item.getAttribute('data-drag-index') || '', 10)
      if (isNaN(idx)) return

      handleEl = handle
      startPos.current = { x: e.clientX, y: e.clientY }
      dragItemIndex.current = idx

      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseEnd)
    }

    container.addEventListener('touchstart', onTouchStart, { passive: false })
    container.addEventListener('mousedown', onMouseDown)

    return () => {
      container.removeEventListener('touchstart', onTouchStart)
      container.removeEventListener('mousedown', onMouseDown)
      detachDocListeners()
      cleanupDrag()
    }
  }, [container, enabled, cleanupDrag, findDropIndex])

  const getDragHandlers = useCallback((index: number) => ({
    'data-drag-index': index,
  }), [])

  return {
    dragIndex,
    overIndex,
    getDragHandlers,
    containerRef,
  }
}
