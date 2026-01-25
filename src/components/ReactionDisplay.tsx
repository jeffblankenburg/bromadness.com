'use client'

interface Reaction {
  id: string
  emoji: string
  user: { id: string; display_name: string | null } | null
}

interface ReactionDisplayProps {
  reactions: Reaction[]
  isOwnMessage: boolean
  onReactionClick?: (emoji: string) => void
}

export function ReactionDisplay({ reactions, isOwnMessage, onReactionClick }: ReactionDisplayProps) {
  if (!reactions || reactions.length === 0) return null

  // Group reactions by emoji
  const grouped = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = []
    acc[r.emoji].push(r)
    return acc
  }, {} as Record<string, Reaction[]>)

  return (
    <div className={`flex flex-wrap gap-1 mt-1 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      {Object.entries(grouped).map(([emoji, reactionList]) => (
        <button
          key={emoji}
          onClick={() => onReactionClick?.(emoji)}
          className="flex items-center gap-0.5 bg-zinc-700/50 hover:bg-zinc-600/50 rounded-full px-1.5 py-0.5 text-sm transition-colors"
          title={reactionList.map(r => r.user?.display_name || 'Unknown').join(', ')}
        >
          <span>{emoji}</span>
          <span className="text-xs text-zinc-400">{reactionList.length}</span>
        </button>
      ))}
    </div>
  )
}
