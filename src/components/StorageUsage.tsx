'use client'

import { useState, useEffect } from 'react'

interface StorageData {
  totalBytes: number
  totalFiles: number
  limitBytes: number
  usagePercent: number
  projectId: string
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`
}

export function StorageUsage() {
  const [data, setData] = useState<StorageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/storage/usage', { credentials: 'include' })
        if (res.ok) {
          const storageData = await res.json()
          setData(storageData)
        } else {
          setError('Failed to fetch storage usage')
        }
      } catch {
        setError('Failed to fetch storage usage')
      } finally {
        setLoading(false)
      }
    }

    fetchUsage()
  }, [])

  const supabaseUrl = data?.projectId
    ? `https://supabase.com/dashboard/project/${data.projectId}/storage/buckets/chat-images`
    : null

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3
          className="text-sm font-semibold text-orange-400 uppercase tracking-wide"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Storage Usage
        </h3>
        {supabaseUrl && (
          <a
            href={supabaseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-400 hover:text-orange-500 transition-colors"
          >
            Open in Supabase
          </a>
        )}
      </div>

      {loading ? (
        <p className="text-zinc-400">Loading...</p>
      ) : error ? (
        <p className="text-red-400">{error}</p>
      ) : data ? (
        <div className="space-y-3">
          {/* Progress bar */}
          <div className="w-full bg-zinc-700 rounded-full h-3">
            <div
              className={`h-3 rounded-full transition-all ${
                data.usagePercent > 90 ? 'bg-red-500' :
                data.usagePercent > 70 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${Math.min(data.usagePercent, 100)}%` }}
            />
          </div>

          {/* Stats */}
          <div className="flex justify-between text-sm">
            <span className="text-zinc-400">
              {formatBytes(data.totalBytes)} / {formatBytes(data.limitBytes)}
            </span>
            <span className={`font-medium ${
              data.usagePercent > 90 ? 'text-red-400' :
              data.usagePercent > 70 ? 'text-yellow-400' : 'text-green-400'
            }`}>
              {data.usagePercent.toFixed(1)}%
            </span>
          </div>

          <p className="text-xs text-zinc-500">
            {data.totalFiles} {data.totalFiles === 1 ? 'file' : 'files'} in chat-images bucket
          </p>
        </div>
      ) : null}
    </div>
  )
}
