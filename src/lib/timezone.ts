/**
 * Get the current date/time in Eastern timezone as a Date object.
 * The returned Date's local fields (getHours, getMinutes, etc.) represent Eastern time.
 *
 * Uses Intl.DateTimeFormat for reliable timezone conversion across environments.
 */
export function getEasternNow(): Date {
  const now = new Date()
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })

  const parts = formatter.formatToParts(now)
  const get = (type: string) => parseInt(parts.find(p => p.type === type)?.value || '0')

  return new Date(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') === 24 ? 0 : get('hour'),
    get('minute'),
    get('second')
  )
}
