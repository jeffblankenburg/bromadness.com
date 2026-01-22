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

export function MenuDisplay({ items, currentDay, hideAlwaysAvailable = false }: Props) {
  // Get today's items and always-available items
  const todayItems = items.filter(item => item.day === currentDay)
  const randomItems = hideAlwaysAvailable ? [] : items.filter(item => item.day === 'Random')

  if (todayItems.length === 0 && randomItems.length === 0) {
    return null
  }

  // Group today's items by meal type
  const groupedItems = MEAL_ORDER.reduce((acc, mealType) => {
    const mealItems = todayItems.filter(item => item.meal_type === mealType)
    if (mealItems.length > 0) {
      acc[mealType] = mealItems
    }
    return acc
  }, {} as Record<string, MenuItem[]>)

  return (
    <div className="w-full max-w-sm bg-zinc-800/50 rounded-xl p-4 space-y-3">
      <h3 className="text-sm font-semibold text-orange-400 text-center">
        {currentDay}&apos;s Menu
      </h3>

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
