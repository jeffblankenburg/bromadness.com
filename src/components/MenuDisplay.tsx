'use client'

import { useState } from 'react'

interface MenuItem {
  id: string
  day: string
  meal_type: string | null
  item_name: string
  provider: string | null
}

interface Props {
  items: MenuItem[]
  currentDay: string
  hideAlwaysAvailable?: boolean
}

const MEAL_ORDER = ['Breakfast', 'Dinner', 'Misc']
const DAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']

export function MenuDisplay({ items, currentDay, hideAlwaysAvailable = false }: Props) {
  const [selectedDay, setSelectedDay] = useState(currentDay)

  const currentIndex = DAYS.indexOf(selectedDay)
  const canGoBack = currentIndex > 0
  const canGoForward = currentIndex < DAYS.length - 1

  const goBack = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canGoBack) {
      setSelectedDay(DAYS[currentIndex - 1])
    }
  }

  const goForward = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (canGoForward) {
      setSelectedDay(DAYS[currentIndex + 1])
    }
  }

  // Get selected day's items and always-available items
  const dayItems = items.filter(item => item.day === selectedDay)
  const randomItems = hideAlwaysAvailable ? [] : items.filter(item => item.day === 'Random')

  // Group day's items by meal type
  const groupedItems = MEAL_ORDER.reduce((acc, mealType) => {
    const mealItems = dayItems.filter(item => item.meal_type === mealType)
    if (mealItems.length > 0) {
      acc[mealType] = mealItems
    }
    return acc
  }, {} as Record<string, MenuItem[]>)

  return (
    <div className="w-full max-w-sm bg-zinc-800/50 rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <button
          onClick={goBack}
          disabled={!canGoBack}
          className={`p-1 rounded ${canGoBack ? 'text-zinc-400 hover:text-white' : 'text-zinc-700'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <h3 className="text-sm font-semibold text-orange-400 text-center">
          {selectedDay}&apos;s Menu
        </h3>
        <button
          onClick={goForward}
          disabled={!canGoForward}
          className={`p-1 rounded ${canGoForward ? 'text-zinc-400 hover:text-white' : 'text-zinc-700'}`}
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {dayItems.length === 0 && (
        <p className="text-sm text-zinc-500 text-center py-2">No menu items yet</p>
      )}

      {Object.entries(groupedItems).map(([mealType, mealItems]) => (
        <div key={mealType}>
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">{mealType}</div>
          <div className="space-y-1">
            {mealItems.map(item => (
              <div key={item.id} className="flex items-center justify-between text-sm">
                <span>{item.item_name}</span>
                {item.provider && (
                  <span className="text-xs text-zinc-500">{item.provider}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}

      {randomItems.length > 0 && (
        <div className="pt-2 border-t border-zinc-700">
          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Always Available</div>
          <div className="flex flex-wrap gap-2">
            {randomItems.map(item => (
              <span key={item.id} className="text-xs bg-zinc-700 px-2 py-1 rounded">
                {item.item_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
