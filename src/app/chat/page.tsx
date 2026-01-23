'use client'

import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import Link from 'next/link'

interface Message {
  id: string
  content: string | null
  gif_url: string | null
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
  const [activeUserId, setActiveUserId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const gifSearchTimeout = useRef<NodeJS.Timeout | null>(null)

  // Mark as read on mount
  useEffect(() => {
    fetch('/api/messages/read', { method: 'POST' }).catch(console.error)
  }, [])

  // Fetch messages on mount and poll
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch('/api/messages?limit=50')
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
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [])

  // Load older messages when scrolling to top
  const loadOlderMessages = async () => {
    if (loadingOlder || !hasMore || messages.length === 0) return

    const oldestMessage = messages[0]
    setLoadingOlder(true)

    try {
      const res = await fetch(`/api/messages?limit=50&before=${encodeURIComponent(oldestMessage.created_at)}`)
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
    try {
      const url = query
        ? `/api/giphy/search?q=${encodeURIComponent(query)}&limit=20`
        : '/api/giphy/search?limit=20'
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        setGifs(data.gifs)
      }
    } catch (error) {
      console.error('Failed to fetch GIFs:', error)
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

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const isToday = date.toDateString() === now.toDateString()

    if (isToday) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    }
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
  }

  return (
    <div className="h-[calc(100vh-2.75rem)] bg-black flex flex-col overflow-hidden">
      {/* Header - fixed at top */}
      <div className="shrink-0 flex items-center justify-between px-4 py-3 pt-safe border-b border-zinc-800 bg-black">
        <div className="w-8" />
        <h1 className="text-xl font-bold text-orange-500" style={{ fontFamily: 'var(--font-display)' }}>
          Bro Chat
        </h1>
        <Link href="/" className="text-zinc-400 hover:text-white p-1">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </Link>
      </div>

      {/* Messages */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
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
              <div className={`px-4 py-2 max-w-[85%] ${
                isOwnMessage
                  ? 'bg-orange-600 rounded-2xl rounded-tr-sm'
                  : 'bg-zinc-800 rounded-2xl rounded-tl-sm'
              }`}>
                {msg.gif_url ? (
                  <Image
                    src={msg.gif_url}
                    alt="GIF"
                    width={200}
                    height={150}
                    className="rounded-lg max-w-[200px]"
                    unoptimized
                  />
                ) : (
                  <p className="text-sm text-white break-words">{msg.content}</p>
                )}
              </div>
            </div>
          )}))
        }
        <div ref={messagesEndRef} />
      </div>

      {/* GIF Picker */}
      {showGifPicker && (
        <div className="shrink-0 border-t border-zinc-800 bg-zinc-900 p-3">
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

      {/* Input - fixed at bottom */}
      <div className="shrink-0 border-t border-zinc-800 p-3 bg-zinc-900">
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
