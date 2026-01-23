import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { D1_TEAMS } from '@/lib/data/d1-teams'
import { CHANNELS } from '@/lib/data/channels'
import { ScheduleClient } from './ScheduleClient'

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
}

interface Game {
  id: string
  round: number
  scheduled_at: string | null
  winner_id: string | null
  channel: string | null
  team1_id: string | null
  team2_id: string | null
  team1_score: number | null
  team2_score: number | null
}

function findD1Team(teamName: string) {
  return D1_TEAMS.find(t =>
    t.name.toLowerCase() === teamName.toLowerCase() ||
    t.shortName.toLowerCase() === teamName.toLowerCase()
  )
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return null
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return null
  const [, , , , hours, mins] = match
  const hour = parseInt(hours)
  const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
  const ampm = hour >= 12 ? 'p' : 'a'
  return `${hour12}:${mins}${ampm}`
}

function formatDate(dateStr: string) {
  const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (!match) return dateStr
  const [, year, month, day] = match
  const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${parseInt(day)}`
}

function getChannelDisplay(channelName: string | null) {
  if (!channelName) return null
  const channel = CHANNELS.find(c => c.name.toLowerCase() === channelName.toLowerCase())
  return channel ? `${channel.name} ${channel.number}` : channelName
}

export default async function SchedulePage() {
  const supabase = await createClient()

  // Get active tournament
  const { data: tournament } = await supabase
    .from('tournaments')
    .select('id')
    .order('year', { ascending: false })
    .limit(1)
    .single()

  if (!tournament) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
        <div className="p-6 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link href="/info" className="text-zinc-400 hover:text-white text-sm">← Info</Link>
            <h1 className="text-lg font-bold text-orange-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Schedule</h1>
            <div className="w-10"></div>
          </div>
          <p className="text-zinc-400 text-center">No tournament found.</p>
        </div>
      </div>
    )
  }

  // Get all teams
  const { data: teams } = await supabase
    .from('teams')
    .select('id, name, short_name, seed')
    .eq('tournament_id', tournament.id)

  const teamsById = (teams || []).reduce((acc, t) => {
    acc[t.id] = t
    return acc
  }, {} as Record<string, Team>)

  // Get all games
  const { data: games } = await supabase
    .from('games')
    .select('id, round, scheduled_at, winner_id, channel, team1_id, team2_id, team1_score, team2_score')
    .eq('tournament_id', tournament.id)
    .order('scheduled_at')

  // Group games by date
  const gamesByDate: Record<string, Game[]> = {}
  for (const game of (games || [])) {
    if (!game.scheduled_at) continue
    const dateKey = game.scheduled_at.split('T')[0]
    if (!gamesByDate[dateKey]) gamesByDate[dateKey] = []
    gamesByDate[dateKey].push(game)
  }

  const sortedDates = Object.keys(gamesByDate).sort()

  return (
    <ScheduleClient>
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
        <div className="p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Link href="/info" className="text-zinc-400 hover:text-white text-sm">← Info</Link>
            <h1 className="text-lg font-bold text-orange-500 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Schedule</h1>
            <div className="w-10"></div>
          </div>

          {sortedDates.length === 0 ? (
            <p className="text-zinc-400 text-center text-sm">No games scheduled yet.</p>
          ) : (
            <div className="space-y-4">
              {sortedDates.map(dateKey => (
                <div key={dateKey}>
                  <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
                    {formatDate(dateKey)}
                  </h2>
                  <div className="space-y-1">
                    {gamesByDate[dateKey].map(game => {
                      const team1 = game.team1_id ? teamsById[game.team1_id] : null
                      const team2 = game.team2_id ? teamsById[game.team2_id] : null

                      if (!team1 || !team2) return null

                      const d1Team1 = findD1Team(team1.name)
                      const d1Team2 = findD1Team(team2.name)
                      const time = formatTime(game.scheduled_at)
                      const channel = getChannelDisplay(game.channel)
                      const isComplete = game.winner_id !== null
                      const team1Won = game.winner_id === team1.id
                      const team2Won = game.winner_id === team2.id

                      return (
                        <div
                          key={game.id}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded text-sm ${isComplete ? 'bg-zinc-800/50' : ''}`}
                        >
                          {/* Time */}
                          <span className="w-14 text-xs text-zinc-500 flex-shrink-0">
                            {time || '—'}
                          </span>

                          {/* Matchup */}
                          <span className="flex-1 truncate text-zinc-200">
                            <span className="text-zinc-500">{team1.seed}</span>{' '}
                            <span className={team1Won ? 'font-bold text-orange-400' : ''}>{d1Team1?.shortName || team1.short_name || team1.name}</span>
                            <span className="text-zinc-600 mx-1">vs</span>
                            <span className="text-zinc-500">{team2.seed}</span>{' '}
                            <span className={team2Won ? 'font-bold text-orange-400' : ''}>{d1Team2?.shortName || team2.short_name || team2.name}</span>
                          </span>

                          {/* Channel or Score */}
                          <span className="text-xs flex-shrink-0">
                            {isComplete ? (
                              <span className="font-bold">
                                <span className={team1Won ? 'text-orange-400' : 'text-zinc-500'}>{game.team1_score}</span>
                                <span className="text-zinc-500">-</span>
                                <span className={team2Won ? 'text-orange-400' : 'text-zinc-500'}>{game.team2_score}</span>
                              </span>
                            ) : (
                              <span className="text-zinc-500">{channel || ''}</span>
                            )}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </ScheduleClient>
  )
}
