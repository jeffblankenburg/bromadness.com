'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface PresenceState {
  user_id: string
  display_name: string
  online_at: string
}

interface Props {
  userId: string
  displayName: string
}

export function ActiveUsers({ userId, displayName }: Props) {
  const [onlineUsers, setOnlineUsers] = useState<PresenceState[]>([])
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    const channel = supabase.channel('online-users', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<PresenceState>()
        const users: PresenceState[] = []
        const seenIds = new Set<string>()

        for (const key of Object.keys(state)) {
          for (const presence of state[key]) {
            if (!seenIds.has(presence.user_id)) {
              seenIds.add(presence.user_id)
              users.push(presence)
            }
          }
        }

        users.sort((a, b) => a.display_name.localeCompare(b.display_name))
        setOnlineUsers(users)
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            display_name: displayName,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, displayName])

  if (onlineUsers.length === 0) return null

  return (
    <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-700/30 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500"></span>
          </span>
          <span className="text-sm font-medium text-zinc-300">
            {onlineUsers.length} Online
          </span>
        </div>
        <svg
          className={`w-4 h-4 text-zinc-400 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pt-1 pb-3">
          <div className="flex flex-wrap gap-2">
            {onlineUsers.map((user) => (
              <span
                key={user.user_id}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-700/50 text-xs text-zinc-300"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
                {user.display_name}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
