export interface Channel {
  name: string
  number: number
}

export const CHANNELS: Channel[] = [
  { name: 'CBS', number: 10 },
  { name: 'TBS', number: 247 },
  { name: 'TNT', number: 245 },
  { name: 'truTV', number: 246 },
]

export function getChannelByName(name: string): Channel | undefined {
  return CHANNELS.find(c => c.name.toLowerCase() === name.toLowerCase())
}

export function formatChannel(name: string): string {
  const channel = getChannelByName(name)
  if (!channel) return name
  return `${channel.name} (${channel.number})`
}
