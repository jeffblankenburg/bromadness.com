'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface MenuItem {
  id: string
  tournament_id: string
  day: string
  meal_type: string | null
  item_name: string
  provider: string | null
  sort_order: number
}

interface Props {
  tournamentId: string
  menuItems: MenuItem[]
}

const DAYS = ['Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday', 'Random']
const MEAL_TYPES = ['Breakfast', 'Dinner', 'Misc']

export function MenuEditor({ tournamentId, menuItems }: Props) {
  const [activeDay, setActiveDay] = useState('Thursday')
  const [adding, setAdding] = useState(false)
  const [newItem, setNewItem] = useState({ meal_type: 'Dinner', item_name: '', provider: '' })
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const dayItems = menuItems.filter(item => item.day === activeDay)
  const randomItems = menuItems.filter(item => item.day === 'Random')

  // Group items by meal type
  const groupedItems = MEAL_TYPES.reduce((acc, mealType) => {
    acc[mealType] = dayItems.filter(item => item.meal_type === mealType)
    return acc
  }, {} as Record<string, MenuItem[]>)

  const handleAddItem = async () => {
    if (!newItem.item_name.trim()) return

    setSaving(true)
    try {
      const maxSort = Math.max(0, ...dayItems.map(i => i.sort_order))
      await supabase.from('menu_items').insert({
        tournament_id: tournamentId,
        day: activeDay,
        meal_type: activeDay === 'Random' ? null : newItem.meal_type,
        item_name: newItem.item_name.trim(),
        provider: newItem.provider.trim() || null,
        sort_order: maxSort + 1,
      })
      setNewItem({ meal_type: 'Dinner', item_name: '', provider: '' })
      setAdding(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to add item:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteItem = async (id: string) => {
    setSaving(true)
    try {
      await supabase.from('menu_items').delete().eq('id', id)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete item:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Day Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl overflow-x-auto">
        {DAYS.filter(d => d !== 'Random').map((day) => {
          const count = menuItems.filter(i => i.day === day).length
          const isActive = day === activeDay
          return (
            <button
              key={day}
              onClick={() => setActiveDay(day)}
              className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <div>{day.slice(0, 3)}</div>
              <div className={`text-xs ${isActive ? 'text-orange-200' : 'text-zinc-500'}`}>
                {count}
              </div>
            </button>
          )
        })}
      </div>

      {/* Add Item Form */}
      {adding ? (
        <div className="bg-zinc-800 rounded-xl p-3 space-y-3">
          <div className="flex gap-2">
            <select
              value={activeDay === 'Random' ? 'Random' : newItem.meal_type}
              onChange={(e) => {
                if (e.target.value === 'Random') {
                  setActiveDay('Random')
                } else {
                  setNewItem({ ...newItem, meal_type: e.target.value })
                }
              }}
              className="px-2 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm"
            >
              {MEAL_TYPES.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
              <option value="Random">Always Available</option>
            </select>
          </div>
          <input
            type="text"
            value={newItem.item_name}
            onChange={(e) => setNewItem({ ...newItem, item_name: e.target.value })}
            placeholder="Item name"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm"
            autoFocus
          />
          <input
            type="text"
            value={newItem.provider}
            onChange={(e) => setNewItem({ ...newItem, provider: e.target.value })}
            placeholder="Provider (optional)"
            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleAddItem}
              disabled={saving || !newItem.item_name.trim()}
              className="flex-1 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded text-sm"
            >
              {saving ? 'Adding...' : 'Add Item'}
            </button>
            <button
              onClick={() => { setAdding(false); setNewItem({ meal_type: 'Dinner', item_name: '', provider: '' }) }}
              className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-white rounded text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="w-full py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-sm"
        >
          + Add Item
        </button>
      )}

      {/* Menu Items for Day */}
      <div className="space-y-4">
        {MEAL_TYPES.map(mealType => {
          const items = groupedItems[mealType] || []
          return (
            <div key={mealType} className="bg-zinc-800/50 rounded-xl p-3">
              <h3 className="text-sm font-semibold text-orange-400 mb-2">{mealType}</h3>
              {items.length === 0 ? (
                <p className="text-zinc-500 text-sm">No items</p>
              ) : (
                <div className="space-y-1">
                  {items.map(item => (
                    <div key={item.id} className="flex items-center gap-2 py-1">
                      <span className="flex-1 text-sm">{item.item_name}</span>
                      {item.provider && (
                        <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded">
                          {item.provider}
                        </span>
                      )}
                      <button
                        onClick={() => handleDeleteItem(item.id)}
                        disabled={saving}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Random Items Section */}
      <div className="bg-zinc-800/50 rounded-xl p-3">
        <h3 className="text-sm font-semibold text-orange-400 mb-2">Always Available</h3>
        {randomItems.length === 0 ? (
          <p className="text-zinc-500 text-sm">No items</p>
        ) : (
          <div className="space-y-1">
            {randomItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 py-1">
                <span className="flex-1 text-sm">{item.item_name}</span>
                {item.provider && (
                  <span className="text-xs text-zinc-400 bg-zinc-700 px-2 py-0.5 rounded">
                    {item.provider}
                  </span>
                )}
                <button
                  onClick={() => handleDeleteItem(item.id)}
                  disabled={saving}
                  className="text-red-400 hover:text-red-300 text-xs"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
