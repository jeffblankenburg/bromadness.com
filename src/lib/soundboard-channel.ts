'use client'

import { createClient } from '@/lib/supabase/client'

type Channel = ReturnType<ReturnType<typeof createClient>['channel']>

let channel: Channel | null = null
let subscribePromise: Promise<void> | null = null

export function getSoundboardChannel(): Channel {
  if (!channel) {
    const supabase = createClient()
    channel = supabase.channel('soundboard', {
      config: { broadcast: { self: true } },
    })
  }
  return channel
}

export async function ensureSoundboardSubscribed(): Promise<Channel> {
  const ch = getSoundboardChannel()

  if (!subscribePromise) {
    subscribePromise = new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === 'SUBSCRIBED') resolve()
      })
    })
  }

  await subscribePromise
  return ch
}

export function cleanupSoundboardChannel() {
  if (channel) {
    const supabase = createClient()
    supabase.removeChannel(channel)
    channel = null
    subscribePromise = null
  }
}
