'use client'

interface Props {
  simulatedTime: string
}

// Format time string for display (all times are Eastern)
const formatTime = (timeStr: string) => {
  const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/)
  if (!match) return timeStr

  const [, year, month, day, hours, mins] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const dayName = days[date.getDay()]
  const monthName = months[parseInt(month) - 1]

  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'PM' : 'AM'

  return `${dayName}, ${monthName} ${parseInt(day)}, ${hour12}:${mins} ${ampm} ET`
}

export function DevTimeBanner({ simulatedTime }: Props) {
  return (
    <div className="fixed left-0 right-0 z-50 bg-purple-500/90 text-white px-4 py-1.5 text-xs text-center" style={{ top: 'env(safe-area-inset-top)' }}>
      <span className="font-bold">DEV MODE:</span> Simulated time is {formatTime(simulatedTime)}
    </div>
  )
}
