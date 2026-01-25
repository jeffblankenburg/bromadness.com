'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

interface Message {
  id: string
  content: string | null
  gif_url: string | null
  image_url: string | null
  created_at: string
  user: { id: string; display_name: string | null } | null
}

interface GiphyGif {
  id: string
  images: {
    fixed_height: { url: string; width: string; height: string }
    fixed_height_small: { url: string; width: string; height: string }
  }
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingOlder, setLoadingOlder] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [showGifPicker, setShowGifPicker] = useState(false)
  const [gifSearch, setGifSearch] = useState('')
  const [gifs, setGifs] = useState<GiphyGif[]>([])
  const [loadingGifs, setLoadingGifs] = useState(false)
  const [gifError, setGifError] = useState<string | null>(null)
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const gifSearchTimeout = useRef<NodeJS.Timeout | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Mark as read on mount
  useEffect(() => {
    fetch('/api/messages/read', { method: 'POST', credentials: 'include' }).catch(console.error)
  }, [])

  // Fetch messages on mount and subscribe to realtime updates
  useEffect(() => {
    const supabase = createClient()

    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/messages?limit=50', { credentials: 'include' })
        if (res.ok) {
          const data = await res.json()
          setMessages(data.messages)
          setHasMore(data.hasMore)
          if (data.activeUserId) {
            setActiveUserId(data.activeUserId)
          }
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()

    // Subscribe to new messages in realtime
    const channel = supabase
      .channel('chat-messages')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          // Fetch the full message with user data
          const { data: newMessage } = await supabase
            .from('chat_messages')
            .select(`
              id,
              content,
              gif_url,
              image_url,
              created_at,
              user:users!chat_messages_user_id_fkey(id, display_name)
            `)
            .eq('id', payload.new.id)
            .single()

          if (newMessage) {
            // Transform user array to single object (Supabase returns array for joins)
            const formattedMessage: Message = {
              id: newMessage.id,
              content: newMessage.content,
              gif_url: newMessage.gif_url,
              image_url: newMessage.image_url,
              created_at: newMessage.created_at,
              user: Array.isArray(newMessage.user) ? newMessage.user[0] : newMessage.user
            }

            setMessages(prev => {
              // Avoid duplicates (in case we sent this message ourselves)
              if (prev.some(m => m.id === formattedMessage.id)) {
                return prev
              }
              return [...prev, formattedMessage]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  // Load older messages when scrolling to top
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return

    const oldestMessage = messages[0]
    setLoadingOlder(true)

    try {
      const res = await fetch(`/api/messages?limit=50&before=${encodeURIComponent(oldestMessage.created_at)}`, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        if (data.messages.length > 0) {
          // Preserve scroll position
          const container = messagesContainerRef.current
          const prevScrollHeight = container?.scrollHeight || 0

          setMessages(prev => [...data.messages, ...prev])
          setHasMore(data.hasMore)

          // Restore scroll position after new messages are added
          requestAnimationFrame(() => {
            if (container) {
              const newScrollHeight = container.scrollHeight
              container.scrollTop = newScrollHeight - prevScrollHeight
            }
          })
        } else {
          setHasMore(false)
        }
      }
    } catch (error) {
      console.error('Failed to load older messages:', error)
    } finally {
      setLoadingOlder(false)
    }
  }

  // Handle scroll to detect when user reaches the top and track position
  const handleScroll = () => {
    const container = messagesContainerRef.current
    if (container) {
      // Load older messages when near top
      if (container.scrollTop < 100 && hasMore && !loadingOlder) {
        loadOlderMessages()
      }
      // Track if user is near bottom for auto-scroll behavior
      updateAutoScroll()
    }
  }

  // Scroll to bottom only on initial load or if user is near bottom
  const isInitialLoad = useRef(true)
  const shouldAutoScroll = useRef(true)

  // Track if user is near the bottom
  const updateAutoScroll = () => {
    const container = messagesContainerRef.current
    if (container) {
      const threshold = 150
      const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < threshold
      shouldAutoScroll.current = isNearBottom
    }
  }

  // Scroll to bottom helper - used by image onLoad
  const scrollToBottom = () => {
    if (shouldAutoScroll.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }

  useEffect(() => {
    if (messages.length > 0) {
      if (isInitialLoad.current) {
        const scrollToBottom = () => {
          messagesEndRef.current?.scrollIntoView({ behavior: 'instant' })
        }

        // Scroll multiple times to catch late-loading content (like GIFs)
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            scrollToBottom()
            // Scroll again after short delays to catch images loading
            setTimeout(scrollToBottom, 100)
            setTimeout(scrollToBottom, 300)
            setTimeout(() => {
              scrollToBottom()
              isInitialLoad.current = false
            }, 500)
          })
        })
      } else if (shouldAutoScroll.current) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }
    }
  }, [messages])

  // Load trending GIFs when picker opens
  useEffect(() => {
    if (showGifPicker && gifs.length === 0) {
      fetchGifs('')
    }
  }, [showGifPicker, gifs.length])

  // Debounced GIF search
  useEffect(() => {
    if (gifSearchTimeout.current) {
      clearTimeout(gifSearchTimeout.current)
    }

    if (showGifPicker) {
      gifSearchTimeout.current = setTimeout(() => {
        fetchGifs(gifSearch)
      }, 300)
    }

    return () => {
      if (gifSearchTimeout.current) {
        clearTimeout(gifSearchTimeout.current)
      }
    }
  }, [gifSearch, showGifPicker])

  const fetchGifs = async (query: string) => {
    setLoadingGifs(true)
    setGifError(null)
    try {
      const url = query
        ? `/api/giphy/search?q=${encodeURIComponent(query)}&limit=20`
        : '/api/giphy/search?limit=20'
      const res = await fetch(url, { credentials: 'include' })
      if (res.ok) {
        const data = await res.json()
        setGifs(data.gifs || [])
      } else {
        const errorData = await res.json().catch(() => ({}))
        setGifError(`${res.status}: ${errorData.error || res.statusText}`)
      }
    } catch (error) {
      setGifError(`Network error: ${error instanceof Error ? error.message : 'Unknown'}`)
    } finally {
      setLoadingGifs(false)
    }
  }

  const handleSend = async () => {
    if (!newMessage.trim() || sending) return

    setSending(true)
    const content = newMessage.trim()
    setNewMessage('')

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
      }
    } catch (error) {
      console.error('Failed to send message:', error)
      setNewMessage(content)
    } finally {
      setSending(false)
    }
  }

  const handleSendGif = async (gifUrl: string) => {
    setSending(true)
    setShowGifPicker(false)

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gif_url: gifUrl }),
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
      }
    } catch (error) {
      console.error('Failed to send GIF:', error)
    } finally {
      setSending(false)
    }
  }

  // Compress image using canvas
  const compressImage = (file: File, maxWidth: number, quality: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = document.createElement('img')
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let width = img.width
        let height = img.height

        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        canvas.width = width
        canvas.height = height

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('Failed to get canvas context'))
          return
        }

        ctx.drawImage(img, 0, 0, width, height)
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob)
            else reject(new Error('Failed to compress image'))
          },
          'image/jpeg',
          quality
        )
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || sending) return

    // Reset input so same file can be selected again
    e.target.value = ''

    setSending(true)

    try {
      // Compress image (max 800px wide, 70% quality)
      const compressed = await compressImage(file, 800, 0.7)

      // Upload to storage
      const formData = new FormData()
      formData.append('image', compressed, 'photo.jpg')

      const uploadRes = await fetch('/api/chat-images/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      })

      if (!uploadRes.ok) {
        const error = await uploadRes.json()
        throw new Error(error.error || 'Upload failed')
      }

      const { url } = await uploadRes.json()

      // Send message with image
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image_url: url }),
        credentials: 'include',
      })

      if (res.ok) {
        const data = await res.json()
        setMessages(prev => [...prev, data.message])
      }
    } catch (error) {
      console.error('Failed to send photo:', error)
      alert('Failed to upload photo. Please try again.')
    } finally {
      setSending(false)
    }
  }

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  // Check if message is only emojis (for larger display)
  const isEmojiOnly = (text: string | null) => {
    if (!text || text.trim().length === 0) return false
    // Match emoji including skin tones, ZWJ sequences, etc.
    const emojiPattern = /^[\s\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}\uFE0F\u200D]+$/u
    return emojiPattern.test(text)
  }

  return (
    <div
      className="fixed bg-black flex flex-col"
      style={{
        top: 0,
        left: 0,
        right: 0,
        bottom: 'calc(2.75rem + env(safe-area-inset-bottom, 0px))'
      }}
    >
      {/* Header - never scrolls */}
      <div className="flex-none flex items-center justify-between px-4 py-3 pt-safe border-b border-zinc-800 bg-black">
        <div className="w-8" />
        <h1 className="text-xl font-bold text-white" style={{ fontFamily: 'var(--font-display)' }}>
          Bro Chat
        </h1>
        <Link href="/" className="text-zinc-400 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </Link>
      </div>

      {/* Messages - ONLY this area scrolls */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-auto scrollbar-hide"
        style={{
          minHeight: 0,
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'contain'
        }}
      >
        <div className="p-4 space-y-3">
        {loadingOlder && (
          <div className="text-center text-zinc-500 py-2">Loading older messages...</div>
        )}
        {!hasMore && messages.length > 0 && (
          <div className="text-center text-zinc-600 text-xs py-2">Beginning of chat</div>
        )}
        {loading ? (
          <div className="text-center text-zinc-500">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-zinc-500">No messages yet. Be the first!</div>
        ) : (
          messages.map(msg => {
            const isOwnMessage = activeUserId && msg.user?.id === activeUserId
            const emojiOnly = isEmojiOnly(msg.content)
            return (
            <div key={msg.id} className={`flex flex-col ${isOwnMessage ? 'items-end' : 'items-start'}`}>
              <div className={`flex items-baseline gap-2 mb-1 ${isOwnMessage ? 'flex-row-reverse' : ''}`}>
                <span
                  className={`text-sm ${isOwnMessage ? 'text-zinc-400' : 'text-orange-400'}`}
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {msg.user?.display_name || 'Unknown'}
                </span>
                <span className="text-xs text-zinc-500">{formatTime(msg.created_at)}</span>
              </div>
              {msg.gif_url || msg.image_url ? (
                <div className={`px-4 py-2 max-w-[85%] ${
                  isOwnMessage
                    ? 'bg-orange-500 rounded-2xl rounded-tr-sm'
                    : 'bg-zinc-800 rounded-2xl rounded-tl-sm'
                }`}>
                  <Image
                    src={msg.gif_url || msg.image_url || ''}
                    alt={msg.gif_url ? 'GIF' : 'Photo'}
                    width={200}
                    height={150}
                    className="rounded-lg max-w-[200px]"
                    unoptimized
                    onLoad={scrollToBottom}
                  />
                </div>
              ) : emojiOnly ? (
                <div className={`px-4 py-2 ${
                  isOwnMessage
                    ? 'bg-orange-500 rounded-2xl rounded-tr-sm'
                    : 'bg-zinc-800 rounded-2xl rounded-tl-sm'
                }`}>
                  <span style={{ fontSize: '4rem', lineHeight: 1 }}>{msg.content}</span>
                </div>
              ) : (
                <div className={`px-4 py-2 max-w-[85%] ${
                  isOwnMessage
                    ? 'bg-orange-500 rounded-2xl rounded-tr-sm'
                    : 'bg-zinc-800 rounded-2xl rounded-tl-sm'
                }`}>
                  <p className="text-sm text-white break-words">{msg.content}</p>
                </div>
              )}
            </div>
          )}))
        }
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* GIF Picker - never scrolls */}
      {showGifPicker && (
        <div className="flex-none border-t border-zinc-800 bg-zinc-900 p-3">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={gifSearch}
              onChange={e => setGifSearch(e.target.value)}
              placeholder="Search GIFs..."
              className="flex-1 bg-zinc-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
            <button
              onClick={() => setShowGifPicker(false)}
              className="text-zinc-400 hover:text-white p-1"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="h-40 overflow-y-auto">
            {loadingGifs ? (
              <div className="text-center text-zinc-500 py-4">Loading...</div>
            ) : gifError ? (
              <div className="text-center text-red-400 py-4 text-sm">{gifError}</div>
            ) : gifs.length === 0 ? (
              <div className="text-center text-zinc-500 py-4">No GIFs found</div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {gifs.map(gif => (
                  <button
                    key={gif.id}
                    onClick={() => handleSendGif(gif.images.fixed_height.url)}
                    className="relative aspect-square overflow-hidden rounded hover:ring-2 hover:ring-orange-500"
                  >
                    <Image
                      src={gif.images.fixed_height_small.url}
                      alt="GIF"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="text-center mt-2">
            <span className="text-xs text-zinc-500">Powered by GIPHY</span>
          </div>
        </div>
      )}

      {/* Input - never scrolls */}
      <div className="flex-none border-t border-zinc-800 p-3 bg-zinc-900">
        {/* Hidden file input for photos */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoSelect}
          className="hidden"
        />
        <div className="flex gap-2">
          <button
            onClick={() => setShowGifPicker(!showGifPicker)}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
              showGifPicker
                ? 'bg-orange-500 text-white'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            GIF
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={sending}
            className="px-2 py-2 rounded-lg bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
            </svg>
          </button>
          <input
            type="text"
            value={newMessage}
            onChange={e => setNewMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type a message..."
            maxLength={500}
            className="flex-1 bg-zinc-800 text-white rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
          <button
            onClick={handleSend}
            disabled={!newMessage.trim() || sending}
            className="bg-orange-500 text-white rounded-lg px-4 py-2 font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-orange-600 transition-colors"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
