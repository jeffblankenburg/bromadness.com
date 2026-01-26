'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { updateBadgeCount } from '@/lib/push-notifications'

export function ChatBubble() {
  const [unreadCount, setUnreadCount] = useState(0)

  // Update the app badge whenever unread count changes
  useEffect(() => {
    updateBadgeCount(unreadCount).catch((err) => {
      console.warn('Failed to update app badge:', err)
    })
  }, [unreadCount])

  useEffect(() => {
    const supabase = createClient()
    let currentUserId: string | null = null

    // Get current user and fetch initial unread count
    const initialize = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        currentUserId = user?.id || null

        const res = await fetch('/api/messages/unread-count', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setUnreadCount(data.count)
        }
      } catch (error) {
        console.error('Failed to initialize chat bubble:', error)
      }
    }

    initialize()

    // Subscribe to new messages in realtime
    const messageChannel = supabase
      .channel('chat-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          // Only increment for messages from other users
          if (payload.new && payload.new.user_id !== currentUserId) {
            setUnreadCount(prev => prev + 1)
          }
        }
      )
      .subscribe()

    // Subscribe to reactions on user's own messages
    const reactionChannel = supabase
      .channel('chat-reaction-unread')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_reactions' },
        async (payload) => {
          // Check if this reaction is on one of my messages
          if (payload.new && payload.new.user_id !== currentUserId) {
            const { data: message } = await supabase
              .from('chat_messages')
              .select('user_id')
              .eq('id', payload.new.message_id)
              .single()

            // Only increment if this is MY message
            if (message?.user_id === currentUserId) {
              setUnreadCount(prev => prev + 1)
            }
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(messageChannel)
      supabase.removeChannel(reactionChannel)
    }
  }, [])

  return (
    <Link
      href="/chat"
      className="fixed right-4 z-40 w-14 h-14 bg-orange-500 rounded-full shadow-lg flex items-center justify-center hover:bg-orange-600 transition-colors active:scale-95 bottom-nav-offset"
    >
      {/* Chat icon */}
      <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 0 1-2.555-.337A5.972 5.972 0 0 1 5.41 20.97a5.969 5.969 0 0 1-.474-.065 4.48 4.48 0 0 0 .978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25Z" />
      </svg>

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full min-w-[20px] h-5 flex items-center justify-center px-1">
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </Link>
  )
}
