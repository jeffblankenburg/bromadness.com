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
}

const DAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MEAL_ORDER = ['Breakfast', 'Dinner', 'Misc']

export function FullMenuDisplay({ items }: Props) {
  const [activeDay, setActiveDay] = useState('Wednesday')

  const dayItems = items.filter(item => item.day === activeDay)
  const randomItems = items.filter(item => item.day === 'Random')

  // Group by meal type
  const groupedItems = MEAL_ORDER.reduce((acc, mealType) => {
    const mealItems = dayItems.filter(item => item.meal_type === mealType)
    if (mealItems.length > 0) {
      acc[mealType] = mealItems
    }
    return acc
  }, {} as Record<string, MenuItem[]>)

  return (
    <div className="space-y-4">
      {/* Day Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl">
        {DAYS.map((day) => {
          const count = items.filter(i => i.day === day).length
          const isActive = day === activeDay
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex-1 py-2 px-1 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              {day.slice(0, 3)}
            </button>
          )
        })}
      </div>

      {/* Day's Menu */}
      <div className="space-y-4">
        {Object.keys(groupedItems).length === 0 && dayItems.length === 0 ? (
          <p className="text-zinc-500 text-sm text-center py-4">No menu items for {activeDay}</p>
        ) : (
          Object.entries(groupedItems).map(([mealType, mealItems]) => (
            <div key={mealType} className="bg-zinc-800/50 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-orange-400 mb-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{mealType}</h3>
              <div className="space-y-2">
                {mealItems.map(item => (
                  <div key={item.id} className="flex items-center justify-between">
                    <span className="text-sm">{item.item_name}</span>
                    {item.provider && (
                      <span className="text-xs text-zinc-500">{item.provider}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Always Available */}
      {randomItems.length > 0 && (
        <div className="bg-zinc-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-orange-400 mb-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Always Available</h3>
          <div className="space-y-2">
            {randomItems.map(item => (
              <div key={item.id} className="flex items-center justify-between">
                <span className="text-sm">{item.item_name}</span>
                {item.provider && (
                  <span className="text-xs text-zinc-500">{item.provider}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
