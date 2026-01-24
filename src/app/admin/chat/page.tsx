import { createClient } from '@/lib/supabase/server'
import { ChatManager } from './ChatManager'

export default async function ChatAdminPage() {
  const supabase = await createClient()

  // Get message count
  const { count } = await supabase
    .from('chat_messages')
    .select('*', { count: 'exact', head: true })

  // Get top 10 contributors by message count
  const { data: allMessages } = await supabase
    .from('chat_messages')
    .select('user_id, user:users!chat_messages_user_id_fkey(display_name)')

  // Aggregate message counts by user
  const userCounts = (allMessages || []).reduce((acc, msg) => {
    const userId = msg.user_id
    const user = msg.user as unknown as { display_name: string } | null
    const displayName = user?.display_name || 'Unknown'
    if (!acc[userId]) {
      acc[userId] = { userId, displayName, count: 0 }
    }
    acc[userId].count++
    return acc
  }, {} as Record<string, { userId: string; displayName: string; count: number }>)

  const leaderboard = Object.values(userCounts)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  return (
    <div className="space-y-6">
      <ChatManager
        messageCount={count || 0}
        leaderboard={leaderboard}
      />
    </div>
  )
}
