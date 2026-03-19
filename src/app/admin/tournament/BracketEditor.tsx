'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InlineTeamSearch } from './InlineTeamSearch'
import { ROUND1_MATCHUPS } from '@/lib/bracket/generate'
import { getPlayInGameForSlot, getPlayInDisplayName } from '@/lib/bracket/play-in'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'
import { CHANNELS } from '@/lib/data/channels'
import { VENUES, getVenuesForRound, formatVenue } from '@/lib/data/venues'

interface Region {
  id: string
  name: string
  position: number
}

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
  region_id: string
  record: string | null
}

interface Game {
  id: string
  round: number
  region_id: string | null
  game_number: number
  team1_id: string | null
  team2_id: string | null
  winner_id: string | null
  team1_score: number | null
  team2_score: number | null
  scheduled_at: string | null
  spread: number | null
  favorite_team_id: string | null
  channel: string | null
  location: string | null
  next_game_id: string | null
  is_team1_slot: boolean | null
}


const ROUND_NAMES: Record<number, string> = {
  0: 'First Four',
  1: 'Round of 64',
  2: 'Round of 32',
  3: 'Sweet 16',
  4: 'Elite 8',
  5: 'Final Four',
  6: 'Championship',
}

interface Tournament {
  id: string
  name: string
  year: number
}

interface Props {
  tournament: Tournament
  regions: Region[]
  teams: Team[]
  games: Game[]
}

export function BracketEditor({ tournament, regions, teams, games }: Props) {
  const [selectedSlot, setSelectedSlot] = useState<{ regionId: string; seed: number } | null>(null)
  const [activeTab, setActiveTab] = useState<string>(regions[0]?.id || '')
  const [saving, setSaving] = useState(false)
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(() => {
    if (typeof window === 'undefined') return new Set([1, 2, 3, 4])
    const saved = localStorage.getItem('bracket-expanded-rounds')
    if (saved) {
      try {
        return new Set(JSON.parse(saved))
      } catch {
        return new Set([1, 2, 3, 4])
      }
    }
    return new Set([1, 2, 3, 4])
  })
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    localStorage.setItem('bracket-expanded-rounds', JSON.stringify([...expandedRounds]))
  }, [expandedRounds])

  const toggleRound = (round: number) => {
    setExpandedRounds(prev => {
      const next = new Set(prev)
      if (next.has(round)) {
        next.delete(round)
      } else {
        next.add(round)
      }
      return next
    })
  }

  // Special tab IDs for final rounds
  const FIRST_FOUR_TAB = 'first-four'
  const FINAL_FOUR_TAB = 'final-four'
  const CHAMPIONSHIP_TAB = 'championship'

  const sortedRegions = [...regions].sort((a, b) => a.position - b.position)

  const getTeamForSlot = (regionId: string, seed: number) => {
    return teams.find(t => t.region_id === regionId && t.seed === seed)
  }

  const getD1TeamData = (teamName: string) => {
    return D1_TEAMS.find(t => t.name.toLowerCase() === teamName.toLowerCase())
  }

  const getGameForMatchup = (regionId: string, gameNumber: number) => {
    return games.find(g => g.region_id === regionId && g.round === 1 && g.game_number === gameNumber)
  }

  const getTeamById = (teamId: string | null) => {
    if (!teamId) return null
    return teams.find(t => t.id === teamId)
  }

  // Find which game number a seed belongs to, and whether it's team1 or team2
  const getGameInfoForSeed = (seed: number): { gameNumber: number; isTeam1: boolean } | null => {
    for (let i = 0; i < ROUND1_MATCHUPS.length; i++) {
      const [seed1, seed2] = ROUND1_MATCHUPS[i]
      if (seed === seed1) return { gameNumber: i + 1, isTeam1: true }
      if (seed === seed2) return { gameNumber: i + 1, isTeam1: false }
    }
    return null
  }

  const handleTeamSelect = async (regionId: string, seed: number, teamName: string, shortName: string) => {
    setSaving(true)
    const existingTeam = getTeamForSlot(regionId, seed)
    const gameInfo = getGameInfoForSeed(seed)
    const game = gameInfo ? getGameForMatchup(regionId, gameInfo.gameNumber) : null

    try {
      let teamId: string

      if (existingTeam) {
        // Update existing team
        await supabase
          .from('teams')
          .update({ name: teamName, short_name: shortName })
          .eq('id', existingTeam.id)
        teamId = existingTeam.id
      } else {
        // Create new team
        const { data: newTeam } = await supabase
          .from('teams')
          .insert({
            tournament_id: tournament.id,
            region_id: regionId,
            name: teamName,
            short_name: shortName,
            seed: seed,
          })
          .select()
          .single()
        teamId = newTeam?.id
      }

      // Update the round 1 game with the team
      if (game && teamId && gameInfo) {
        await supabase
          .from('games')
          .update(gameInfo.isTeam1 ? { team1_id: teamId } : { team2_id: teamId })
          .eq('id', game.id)
      }

      router.refresh()
    } catch (err) {
      console.error('Failed to save team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
    }
  }

  const handleClearTeam = async (regionId: string, seed: number) => {
    const existingTeam = getTeamForSlot(regionId, seed)
    if (!existingTeam) {
      setSelectedSlot(null)
      return
    }

    const gameInfo = getGameInfoForSeed(seed)
    const game = gameInfo ? getGameForMatchup(regionId, gameInfo.gameNumber) : null

    setSaving(true)
    try {
      // Clear from game first
      if (game && gameInfo) {
        await supabase
          .from('games')
          .update(gameInfo.isTeam1 ? { team1_id: null } : { team2_id: null })
          .eq('id', game.id)
      }

      // Delete team
      await supabase.from('teams').delete().eq('id', existingTeam.id)
      router.refresh()
    } catch (err) {
      console.error('Failed to delete team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
    }
  }

  const handleRecordChange = async (teamId: string, value: string) => {
    const record = value.trim() || null
    const { error } = await supabase
      .from('teams')
      .update({ record })
      .eq('id', teamId)
    if (error) {
      console.error('Failed to update record:', error)
    } else {
      router.refresh()
    }
  }

  const handleScheduleChange = async (gameId: string, datetime: string) => {
    // Store time as-is (Eastern time, no timezone conversion needed)
    const scheduledAt = datetime ? `${datetime}:00` : null

    const { error } = await supabase
      .from('games')
      .update({ scheduled_at: scheduledAt })
      .eq('id', gameId)

    if (error) {
      console.error('Failed to update schedule:', error)
      alert('Failed to save schedule: ' + error.message)
    } else {
      router.refresh()
    }
  }

  const formatGameTime = (dateStr: string | null) => {
    if (!dateStr) return '—'
    // Parse directly without timezone conversion
    const match = dateStr.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
    if (!match) return '—'
    const [, year, month, day, hours, mins] = match
    // Create date just to get day of week
    const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day))
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const dayName = days[date.getDay()]
    const hour = parseInt(hours)
    const hour12 = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour
    const ampm = hour >= 12 ? 'p' : 'a'
    return `${dayName} ${hour12}:${mins}${ampm}`
  }

  const handleSpreadChange = async (gameId: string, value: string) => {
    const spread = parseFloat(value)

    let error
    if (!value || isNaN(spread)) {
      // Clear spread if empty or invalid
      const result = await supabase
        .from('games')
        .update({ spread: null })
        .eq('id', gameId)
      error = result.error
    } else {
      // Store spread as entered (negative = team1 favored, positive = team2 favored)
      const result = await supabase
        .from('games')
        .update({ spread })
        .eq('id', gameId)
      error = result.error
    }

    if (error) {
      console.error('Failed to update spread:', error)
      alert('Failed to save spread: ' + error.message)
    } else {
      router.refresh()
    }
  }

  const handleChannelChange = async (gameId: string, channel: string) => {
    const { error } = await supabase
      .from('games')
      .update({ channel: channel || null })
      .eq('id', gameId)

    if (error) {
      console.error('Failed to update channel:', error)
      alert('Failed to save channel: ' + error.message)
    } else {
      router.refresh()
    }
  }

  const handleLocationChange = async (gameId: string, location: string) => {
    const { error } = await supabase
      .from('games')
      .update({ location: location || null })
      .eq('id', gameId)

    if (error) {
      console.error('Failed to update location:', error)
      alert('Failed to save location: ' + error.message)
    } else {
      router.refresh()
    }
  }

  // Get games for a specific round in a region
  const getGamesForRound = (regionId: string, round: number) => {
    return games
      .filter(g => g.region_id === regionId && g.round === round)
      .sort((a, b) => a.game_number - b.game_number)
  }

  // Get Final Four and Championship games
  const getFinalGames = () => {
    return games.filter(g => g.round >= 5).sort((a, b) => {
      if (a.round !== b.round) return a.round - b.round
      return a.game_number - b.game_number
    })
  }

  // Check if a game is ready to be displayed (both teams determined)
  const isGameReady = (game: Game) => {
    return game.team1_id && game.team2_id
  }

  // Check if a game has at least one team (partially ready)
  const isGamePartiallyReady = (game: Game) => {
    return game.team1_id || game.team2_id
  }

  // Get feeder game description for an empty slot in a later-round game
  const getFeederLabel = (gameId: string, isTeam1Slot: boolean): string | null => {
    const feeder = games.find(g => g.next_game_id === gameId && g.is_team1_slot === isTeam1Slot)
    if (!feeder) return null
    const t1 = (feeder.team1_id ? getTeamById(feeder.team1_id) : null) ?? null
    const t2 = (feeder.team2_id ? getTeamById(feeder.team2_id) : null) ?? null
    const name = (t: Team | null) => {
      if (!t) return 'TBD'
      const d1 = getD1TeamData(t.name)
      return `${t.seed} ${d1?.shortName || t.short_name || t.name}`
    }
    if (!t1 && !t2) return null
    return `${name(t1)} vs ${name(t2)}`
  }

  // Create a new play-in game
  const handleCreatePlayInGame = async (regionId: string, seed: number, round1GameId: string, isTeam1Slot: boolean) => {
    setSaving(true)
    try {
      // Find next game_number for round 0
      const existingPlayIns = games.filter(g => g.round === 0)
      const nextGameNumber = existingPlayIns.length > 0
        ? Math.max(...existingPlayIns.map(g => g.game_number)) + 1
        : 1

      await supabase
        .from('games')
        .insert({
          tournament_id: tournament.id,
          round: 0,
          region_id: regionId,
          game_number: nextGameNumber,
          next_game_id: round1GameId,
          is_team1_slot: isTeam1Slot,
        })

      router.refresh()
    } catch (err) {
      console.error('Failed to create play-in game:', err)
    } finally {
      setSaving(false)
    }
  }

  // Delete a play-in game and its teams
  const handleDeletePlayInGame = async (gameId: string) => {
    setSaving(true)
    try {
      const game = games.find(g => g.id === gameId)
      if (!game) return

      // Clear team references from game first
      await supabase
        .from('games')
        .update({ team1_id: null, team2_id: null })
        .eq('id', gameId)

      // Delete the teams
      if (game.team1_id) await supabase.from('teams').delete().eq('id', game.team1_id)
      if (game.team2_id) await supabase.from('teams').delete().eq('id', game.team2_id)

      // Clear from the Round 1 game slot if winner was propagated
      if (game.next_game_id) {
        const updateField = game.is_team1_slot ? 'team1_id' : 'team2_id'
        await supabase
          .from('games')
          .update({ [updateField]: null })
          .eq('id', game.next_game_id)
      }

      // Delete the game
      await supabase.from('games').delete().eq('id', gameId)

      router.refresh()
    } catch (err) {
      console.error('Failed to delete play-in game:', err)
    } finally {
      setSaving(false)
    }
  }

  // Select a team for a play-in game slot
  const handlePlayInTeamSelect = async (gameId: string, slot: 'team1' | 'team2', regionId: string, seed: number, teamName: string, shortName: string) => {
    setSaving(true)
    try {
      const game = games.find(g => g.id === gameId)
      if (!game) return

      const existingTeamId = slot === 'team1' ? game.team1_id : game.team2_id
      const existingTeam = existingTeamId ? teams.find(t => t.id === existingTeamId) : null

      let teamId: string
      if (existingTeam) {
        await supabase
          .from('teams')
          .update({ name: teamName, short_name: shortName })
          .eq('id', existingTeam.id)
        teamId = existingTeam.id
      } else {
        const { data: newTeam } = await supabase
          .from('teams')
          .insert({
            tournament_id: tournament.id,
            region_id: regionId,
            name: teamName,
            short_name: shortName,
            seed: seed,
          })
          .select()
          .single()
        teamId = newTeam?.id
      }

      const updateField = slot === 'team1' ? 'team1_id' : 'team2_id'
      await supabase
        .from('games')
        .update({ [updateField]: teamId })
        .eq('id', gameId)

      router.refresh()
    } catch (err) {
      console.error('Failed to save play-in team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
    }
  }

  // Clear a team from a play-in game slot
  const handleClearPlayInTeam = async (gameId: string, slot: 'team1' | 'team2') => {
    setSaving(true)
    try {
      const game = games.find(g => g.id === gameId)
      if (!game) return

      const teamId = slot === 'team1' ? game.team1_id : game.team2_id
      const updateField = slot === 'team1' ? 'team1_id' : 'team2_id'

      // Clear from game
      await supabase
        .from('games')
        .update({ [updateField]: null })
        .eq('id', gameId)

      // Delete team
      if (teamId) {
        await supabase.from('teams').delete().eq('id', teamId)
      }

      router.refresh()
    } catch (err) {
      console.error('Failed to clear play-in team:', err)
    } finally {
      setSaving(false)
      setSelectedSlot(null)
    }
  }

  // Play-in (First Four) games - round 0
  const playInGames = games.filter(g => g.round === 0)

  // Teams that lost a resolved play-in game (exclude from region counts)
  const playInLoserIds = new Set(
    playInGames
      .filter(g => g.winner_id)
      .map(g => g.team1_id === g.winner_id ? g.team2_id : g.team1_id)
      .filter((id): id is string => id !== null)
  )

  const currentRegion = sortedRegions.find(r => r.id === activeTab)
  const regionTeamCount = teams.filter(t => t.region_id === activeTab && !playInLoserIds.has(t.id)).length
  const isFirstFourTab = activeTab === FIRST_FOUR_TAB
  const isRegionTab = currentRegion !== undefined
  const isFinalFourTab = activeTab === FINAL_FOUR_TAB
  const isChampionshipTab = activeTab === CHAMPIONSHIP_TAB

  // Get Final Four games (round 5)
  const finalFourGames = games.filter(g => g.round === 5).sort((a, b) => a.game_number - b.game_number)
  const finalFourReadyGames = finalFourGames.filter(g => isGamePartiallyReady(g))

  // Get Championship game (round 6)
  const championshipGames = games.filter(g => g.round === 6)
  const championshipReadyGames = championshipGames.filter(g => isGamePartiallyReady(g))

  return (
    <div className="space-y-4">
      {/* Region Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl">
        {sortedRegions.map((region) => {
          const count = teams.filter(t => t.region_id === region.id && !playInLoserIds.has(t.id)).length
          const isActive = region.id === activeTab
          return (
            <button
              key={region.id}
              onClick={() => setActiveTab(region.id)}
              className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-orange-500 text-white'
                  : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
              }`}
            >
              <div>{region.name}</div>
              <div className={`text-xs ${isActive ? 'text-orange-200' : 'text-zinc-500'}`}>
                {count}/16
              </div>
            </button>
          )
        })}
      </div>

      {/* Special Rounds Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl">
        <button
          onClick={() => setActiveTab(FIRST_FOUR_TAB)}
          className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
            isFirstFourTab
              ? 'bg-orange-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
        >
          <div>First Four</div>
          <div className={`text-xs ${isFirstFourTab ? 'text-orange-200' : 'text-zinc-500'}`}>
            {playInGames.length} game{playInGames.length !== 1 ? 's' : ''}
          </div>
        </button>
        <button
          onClick={() => setActiveTab(FINAL_FOUR_TAB)}
          className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
            isFinalFourTab
              ? 'bg-orange-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
        >
          <div>Final Four</div>
          <div className={`text-xs ${isFinalFourTab ? 'text-orange-200' : 'text-zinc-500'}`}>
            {finalFourReadyGames.length > 0 ? `${finalFourReadyGames.length} game${finalFourReadyGames.length > 1 ? 's' : ''}` : 'TBD'}
          </div>
        </button>
        <button
          onClick={() => setActiveTab(CHAMPIONSHIP_TAB)}
          className={`flex-1 py-2 px-1 rounded-lg text-sm font-medium transition-colors ${
            isChampionshipTab
              ? 'bg-orange-500 text-white'
              : 'text-zinc-400 hover:text-white hover:bg-zinc-700'
          }`}
        >
          <div>Championship</div>
          <div className={`text-xs ${isChampionshipTab ? 'text-orange-200' : 'text-zinc-500'}`}>
            {championshipReadyGames.length > 0 ? '1 game' : 'TBD'}
          </div>
        </button>
      </div>

      {/* First Four Content */}
      {isFirstFourTab && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>First Four</h3>
          </div>

          {playInGames.map(game => {
            const team1 = getTeamById(game.team1_id)
            const team2 = getTeamById(game.team2_id)
            const d1Team1 = team1 ? getD1TeamData(team1.name) : null
            const d1Team2 = team2 ? getD1TeamData(team2.name) : null
            const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
            const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null
            const targetRegion = sortedRegions.find(r => r.id === game.region_id)
            const isSelectedT1 = selectedSlot?.regionId === `pi-${game.id}-t1` && selectedSlot?.seed === (team1?.seed || 0)
            const isSelectedT2 = selectedSlot?.regionId === `pi-${game.id}-t2` && selectedSlot?.seed === (team2?.seed || 0)

            return (
              <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                {/* Header: Region, Seed, Schedule */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-zinc-400">
                    {targetRegion?.name || '?'} #{team1?.seed || team2?.seed || '?'}
                  </span>
                  <div className="flex-1" />
                  <div className={`flex items-center gap-1 px-1 py-1 rounded text-[10px] ${
                    game.scheduled_at
                      ? 'bg-zinc-800 border border-zinc-600'
                      : 'bg-zinc-800/50 border border-dashed border-zinc-600'
                  }`}>
                    <span className={game.scheduled_at ? 'text-zinc-300' : 'text-zinc-500'}>
                      {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                    </span>
                    <input
                      type="datetime-local"
                      value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                      onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                      className="w-4 h-4 cursor-pointer text-transparent bg-transparent border-0 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:hidden"
                    />
                  </div>
                  <select
                    value={game.channel || ''}
                    onChange={(e) => handleChannelChange(game.id, e.target.value)}
                    className={`w-[72px] px-1 py-1 rounded text-[10px] text-center cursor-pointer ${
                      game.channel
                        ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                        : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                    }`}
                  >
                    <option value="">Ch</option>
                    {CHANNELS.map(ch => (
                      <option key={ch.name} value={ch.name}>{ch.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleDeletePlayInGame(game.id)}
                    disabled={saving}
                    className="text-red-400 hover:text-red-300 p-1"
                    title="Delete play-in game"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                    </svg>
                  </button>
                </div>

                {/* Team 1 */}
                <div className="flex items-center gap-1">
                  {isSelectedT1 ? (
                    <InlineTeamSearch
                      seed={team1?.seed || 0}
                      currentTeamName={team1?.name}
                      onSelect={(name, shortName) => handlePlayInTeamSelect(game.id, 'team1', game.region_id!, team1?.seed || 16, name, shortName)}
                      onClear={() => handleClearPlayInTeam(game.id, 'team1')}
                      onCancel={() => setSelectedSlot(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedSlot({ regionId: `pi-${game.id}-t1`, seed: team1?.seed || 0 })}
                      className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
                        team1
                          ? 'hover:bg-zinc-600'
                          : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                      }`}
                      style={team1 && d1Team1 ? { backgroundColor: d1Team1.primaryColor + '40' } : undefined}
                    >
                      <span className="w-5 text-xs font-mono text-zinc-400">{team1?.seed || '?'}</span>
                      {team1 && d1Team1 ? (
                        <>
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: d1Team1.primaryColor }}
                          >
                            {logo1 ? (
                              <img src={logo1} alt="" className="w-4 h-4 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                            ) : (
                              <span className="text-[8px] font-bold text-white">{d1Team1.abbreviation.slice(0, 2)}</span>
                            )}
                          </div>
                          <span className="flex-1 truncate text-sm">{d1Team1.shortName}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-zinc-500 italic text-sm">Select team...</span>
                      )}
                    </button>
                  )}
                  {!isSelectedT1 && (
                    <div className="w-[52px] flex-shrink-0">
                      {team1 ? (
                        <input
                          type="text"
                          defaultValue={team1.record || ''}
                          onBlur={(e) => handleRecordChange(team1.id, e.target.value)}
                          placeholder="W-L"
                          className="w-full px-1 py-1 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-[10px] text-zinc-400 placeholder-zinc-600"
                        />
                      ) : (
                        <span className="block w-full py-1 text-center text-[10px] text-zinc-600">-</span>
                      )}
                    </div>
                  )}
                </div>

                {/* Team 2 */}
                <div className="flex items-center gap-1">
                  {isSelectedT2 ? (
                    <InlineTeamSearch
                      seed={team2?.seed || 0}
                      currentTeamName={team2?.name}
                      onSelect={(name, shortName) => handlePlayInTeamSelect(game.id, 'team2', game.region_id!, team2?.seed || 16, name, shortName)}
                      onClear={() => handleClearPlayInTeam(game.id, 'team2')}
                      onCancel={() => setSelectedSlot(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setSelectedSlot({ regionId: `pi-${game.id}-t2`, seed: team2?.seed || 0 })}
                      className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
                        team2
                          ? 'hover:bg-zinc-600'
                          : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                      }`}
                      style={team2 && d1Team2 ? { backgroundColor: d1Team2.primaryColor + '40' } : undefined}
                    >
                      <span className="w-5 text-xs font-mono text-zinc-400">{team2?.seed || '?'}</span>
                      {team2 && d1Team2 ? (
                        <>
                          <div
                            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: d1Team2.primaryColor }}
                          >
                            {logo2 ? (
                              <img src={logo2} alt="" className="w-4 h-4 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                            ) : (
                              <span className="text-[8px] font-bold text-white">{d1Team2.abbreviation.slice(0, 2)}</span>
                            )}
                          </div>
                          <span className="flex-1 truncate text-sm">{d1Team2.shortName}</span>
                        </>
                      ) : (
                        <span className="flex-1 text-zinc-500 italic text-sm">Select team...</span>
                      )}
                    </button>
                  )}
                  {!isSelectedT2 && (
                    <div className="w-[52px] flex-shrink-0">
                      {team2 ? (
                        <input
                          type="text"
                          defaultValue={team2.record || ''}
                          onBlur={(e) => handleRecordChange(team2.id, e.target.value)}
                          placeholder="W-L"
                          className="w-full px-1 py-1 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-[10px] text-zinc-400 placeholder-zinc-600"
                        />
                      ) : (
                        <span className="block w-full py-1 text-center text-[10px] text-zinc-600">-</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add Play-In Game */}
          {playInGames.length < 4 && (
            <div className="bg-zinc-800/50 rounded-xl p-3 space-y-3">
              <h4 className="text-sm text-zinc-400">Add Play-In Game</h4>
              <div className="flex gap-2">
                <select
                  id="playin-region"
                  className="flex-1 px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Region</option>
                  {sortedRegions.map(r => (
                    <option key={r.id} value={r.id}>{r.name}</option>
                  ))}
                </select>
                <select
                  id="playin-seed"
                  className="w-20 px-2 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm"
                  defaultValue=""
                >
                  <option value="" disabled>Seed</option>
                  {[11, 12, 16].map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const regionSelect = document.getElementById('playin-region') as HTMLSelectElement
                    const seedSelect = document.getElementById('playin-seed') as HTMLSelectElement
                    const regionId = regionSelect.value
                    const seed = parseInt(seedSelect.value)
                    if (!regionId || isNaN(seed)) return

                    // Find the Round 1 game this seed feeds into
                    const gameInfo = getGameInfoForSeed(seed)
                    if (!gameInfo) return

                    const round1Game = getGameForMatchup(regionId, gameInfo.gameNumber)
                    if (!round1Game) {
                      alert('Round 1 game not found for this region/seed combination')
                      return
                    }

                    handleCreatePlayInGame(regionId, seed, round1Game.id, gameInfo.isTeam1)
                  }}
                  disabled={saving}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-400 disabled:bg-zinc-700 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Add
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Current Region */}
      {/* Region Content */}
      {isRegionTab && currentRegion && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{currentRegion.name} Region</h3>
            <span className="text-sm text-zinc-400">{regionTeamCount}/16 teams</span>
          </div>

          {/* All Rounds (1-4) - sorted: lower round first, completed rounds sink to bottom */}
          {[1, 2, 3, 4].sort((a, b) => {
            const gamesA = getGamesForRound(activeTab, a)
            const gamesB = getGamesForRound(activeTab, b)
            const statusOf = (rGames: typeof gamesA) => {
              const allDone = rGames.length > 0 && rGames.every(g => g.winner_id)
              return allDone ? 1 : 0 // complete → bottom, active/future → top
            }
            const diff = statusOf(gamesA) - statusOf(gamesB)
            return diff !== 0 ? diff : a - b // within same status, lower round first
          }).map(round => {
            // Round 1 has special rendering with team selection, play-in handling, etc.
            if (round === 1) {
              return (
          <div key={1} className="bg-zinc-800/50 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleRound(1)}
              className="w-full flex items-center justify-between p-3 hover:bg-zinc-700/30 transition-colors"
            >
              <span className="text-sm font-medium text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{ROUND_NAMES[1]}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-zinc-500">8 games</span>
                <svg
                  className={`w-4 h-4 text-zinc-400 transition-transform ${expandedRounds.has(1) ? 'rotate-180' : ''}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={2}
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                </svg>
              </div>
            </button>
            {expandedRounds.has(1) && (
              <div className="px-3 pb-3 space-y-3">
            {ROUND1_MATCHUPS.map(([seed1, seed2], idx) => {
              const gameNumber = idx + 1
              const game = getGameForMatchup(activeTab, gameNumber)
              const team1 = getTeamForSlot(activeTab, seed1)
              const team2 = getTeamForSlot(activeTab, seed2)
              const d1Team1 = team1 ? getD1TeamData(team1.name) : null
              const d1Team2 = team2 ? getD1TeamData(team2.name) : null
              const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
              const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null
              const isSelected1 = selectedSlot?.regionId === activeTab && selectedSlot?.seed === seed1
              const isSelected2 = selectedSlot?.regionId === activeTab && selectedSlot?.seed === seed2

              // Check if this slot has a play-in game feeding into it
              // Only show play-in label when the play-in is unresolved (no winner yet)
              const playIn1 = game ? getPlayInGameForSlot(games, game.id, true) : undefined
              const playIn2 = game ? getPlayInGameForSlot(games, game.id, false) : undefined
              const playInName1 = playIn1 && !playIn1.winner_id ? getPlayInDisplayName(playIn1, teams) : null
              const playInName2 = playIn2 && !playIn2.winner_id ? getPlayInDisplayName(playIn2, teams) : null

              // If play-in resolved, use the winner from the game's team slot instead of seed lookup
              const resolvedTeam1 = playIn1?.winner_id && game?.team1_id ? getTeamById(game.team1_id) : null
              const resolvedTeam2 = playIn2?.winner_id && game?.team2_id ? getTeamById(game.team2_id) : null
              const displayTeam1 = resolvedTeam1 || team1
              const displayTeam2 = resolvedTeam2 || team2
              const displayD1Team1 = resolvedTeam1 ? getD1TeamData(resolvedTeam1.name) : d1Team1
              const displayD1Team2 = resolvedTeam2 ? getD1TeamData(resolvedTeam2.name) : d1Team2
              const displayLogo1 = displayD1Team1 ? getTeamLogoUrl(displayD1Team1) : null
              const displayLogo2 = displayD1Team2 ? getTeamLogoUrl(displayD1Team2) : null

              return (
                <div key={`${activeTab}-${idx}`} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                  {/* Header: DateTime, Location, Channel */}
                  <div className="flex items-center gap-1">
                    {/* DateTime - compact display + picker */}
                    <div className={`flex items-center gap-1 px-1 py-1 rounded text-[10px] ${
                      game?.scheduled_at
                        ? 'bg-zinc-800 border border-zinc-600'
                        : 'bg-zinc-800/50 border border-dashed border-zinc-600'
                    } ${!game ? 'opacity-30' : ''}`}>
                      <span className={game?.scheduled_at ? 'text-zinc-300' : 'text-zinc-500'}>
                        {game?.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                      </span>
                      <input
                        type="datetime-local"
                        value={game?.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                        onChange={(e) => game && handleScheduleChange(game.id, e.target.value)}
                        disabled={!game}
                        className="w-4 h-4 cursor-pointer text-transparent bg-transparent border-0 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:hidden"
                      />
                    </div>
                    {/* Location */}
                    <select
                      value={game?.location || ''}
                      onChange={(e) => game && handleLocationChange(game.id, e.target.value)}
                      disabled={!game}
                      className={`flex-1 min-w-0 px-1 py-1 rounded text-[10px] cursor-pointer disabled:opacity-30 ${
                        game?.location
                          ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                          : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                      }`}
                    >
                      <option value="">Location</option>
                      {getVenuesForRound(1).map(v => (
                        <option key={formatVenue(v)} value={formatVenue(v)}>{formatVenue(v)}</option>
                      ))}
                    </select>
                    {/* Channel selector */}
                    <select
                      value={game?.channel || ''}
                      onChange={(e) => game && handleChannelChange(game.id, e.target.value)}
                      disabled={!game}
                      className={`w-[72px] px-1 py-1 rounded text-[10px] text-center cursor-pointer ${
                        game?.channel
                          ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                          : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                      } disabled:opacity-30`}
                    >
                      <option value="">Ch</option>
                      {CHANNELS.map(ch => (
                        <option key={ch.name} value={ch.name}>{ch.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Team 1 (favorite/lower seed) with record + spread input */}
                  <div className="flex items-center gap-1">
                    {playInName1 ? (
                      <div className="flex-1 flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/50 border border-zinc-700">
                        <span className="w-5 text-xs font-mono text-zinc-400">{seed1}</span>
                        <span className="flex-1 truncate text-sm text-amber-400">{playInName1}</span>
                        <span className="text-[10px] text-zinc-500">Play-in</span>
                      </div>
                    ) : isSelected1 ? (
                      <InlineTeamSearch
                        seed={seed1}
                        currentTeamName={displayTeam1?.name}
                        onSelect={(name, shortName) => handleTeamSelect(activeTab, seed1, name, shortName)}
                        onClear={() => handleClearTeam(activeTab, seed1)}
                        onCancel={() => setSelectedSlot(null)}
                      />
                    ) : (
                      <button
                        onClick={() => !resolvedTeam1 && setSelectedSlot({ regionId: activeTab, seed: seed1 })}
                        className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
                          displayTeam1
                            ? 'hover:bg-zinc-600'
                            : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                        }`}
                        style={displayTeam1 && displayD1Team1 ? { backgroundColor: displayD1Team1.primaryColor + '40' } : undefined}
                      >
                        <span className="w-5 text-xs font-mono text-zinc-400">{seed1}</span>
                        {displayTeam1 && displayD1Team1 ? (
                          <>
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: displayD1Team1.primaryColor }}
                            >
                              {displayLogo1 ? (
                                <img src={displayLogo1} alt="" className="w-4 h-4 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                              ) : (
                                <span className="text-[8px] font-bold text-white">{displayD1Team1.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{displayD1Team1.shortName}</span>
                            {resolvedTeam1 && <span className="text-[10px] text-green-400">Play-in W</span>}
                          </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm">Select team...</span>
                        )}
                      </button>
                    )}
                    {!isSelected1 && !playInName1 && (
                      <>
                        <div className="w-[52px] flex-shrink-0">
                          {displayTeam1 ? (
                            <input
                              type="text"
                              defaultValue={displayTeam1.record || ''}
                              onBlur={(e) => handleRecordChange(displayTeam1.id, e.target.value)}
                              placeholder="W-L"
                              className="w-full px-1 py-1 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-[10px] text-zinc-400 placeholder-zinc-600"
                            />
                          ) : (
                            <span className="block w-full py-1 text-center text-[10px] text-zinc-600">—</span>
                          )}
                        </div>
                        <div className="w-[52px] flex-shrink-0">
                          {game?.spread ? (
                            <input
                              type="text"
                              defaultValue={game.spread}
                              onBlur={(e) => game && handleSpreadChange(game.id, e.target.value)}
                              className="w-full px-1 py-1 bg-zinc-900 border border-zinc-700 rounded text-center text-[10px] text-zinc-400"
                            />
                          ) : displayTeam1 ? (
                            <input
                              type="text"
                              defaultValue=""
                              onBlur={(e) => game && handleSpreadChange(game.id, e.target.value)}
                              placeholder="Sprd"
                              className="w-full px-1 py-1 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-[10px] text-zinc-500 placeholder-zinc-600"
                            />
                          ) : (
                            <span className="block w-full py-1 text-center text-[10px] text-zinc-600">—</span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Team 2 (underdog/higher seed) */}
                  <div className="flex items-center gap-1">
                    {playInName2 ? (
                      <div className="flex-1 flex items-center gap-2 px-2 py-1 rounded-lg bg-zinc-900/50 border border-zinc-700">
                        <span className="w-5 text-xs font-mono text-zinc-400">{seed2}</span>
                        <span className="flex-1 truncate text-sm text-amber-400">{playInName2}</span>
                        <span className="text-[10px] text-zinc-500">Play-in</span>
                      </div>
                    ) : isSelected2 ? (
                      <InlineTeamSearch
                        seed={seed2}
                        currentTeamName={displayTeam2?.name}
                        onSelect={(name, shortName) => handleTeamSelect(activeTab, seed2, name, shortName)}
                        onClear={() => handleClearTeam(activeTab, seed2)}
                        onCancel={() => setSelectedSlot(null)}
                      />
                    ) : (
                      <button
                        onClick={() => !resolvedTeam2 && setSelectedSlot({ regionId: activeTab, seed: seed2 })}
                        className={`flex-1 flex items-center gap-2 px-2 py-1 rounded-lg text-left transition-colors ${
                          displayTeam2
                            ? 'hover:bg-zinc-600'
                            : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                        }`}
                        style={displayTeam2 && displayD1Team2 ? { backgroundColor: displayD1Team2.primaryColor + '40' } : undefined}
                      >
                        <span className="w-5 text-xs font-mono text-zinc-400">{seed2}</span>
                        {displayTeam2 && displayD1Team2 ? (
                          <>
                            <div
                              className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: displayD1Team2.primaryColor }}
                            >
                              {displayLogo2 ? (
                                <img src={displayLogo2} alt="" className="w-4 h-4 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                              ) : (
                                <span className="text-[8px] font-bold text-white">{displayD1Team2.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{displayD1Team2.shortName}</span>
                            {resolvedTeam2 && <span className="text-[10px] text-green-400">Play-in W</span>}
                          </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm">Select team...</span>
                        )}
                      </button>
                    )}
                    {/* Record + spacer to match spread width */}
                    {!isSelected2 && !playInName2 && (
                      <>
                        <div className="w-[52px] flex-shrink-0">
                          {displayTeam2 ? (
                            <input
                              type="text"
                              defaultValue={displayTeam2.record || ''}
                              onBlur={(e) => handleRecordChange(displayTeam2.id, e.target.value)}
                              placeholder="W-L"
                              className="w-full px-1 py-1 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-[10px] text-zinc-400 placeholder-zinc-600"
                            />
                          ) : (
                            <span className="block w-full py-1 text-center text-[10px] text-zinc-600">—</span>
                          )}
                        </div>
                        <div className="w-[52px] flex-shrink-0" />
                      </>
                    )}
                  </div>
                </div>
              )
            })}
              </div>
            )}
          </div>
              )
            }

            // Rounds 2-4
            const roundGames = getGamesForRound(activeTab, round)

            if (roundGames.length === 0) return null

            const isExpanded = expandedRounds.has(round)

            return (
              <div key={round} className="bg-zinc-800/50 rounded-xl overflow-hidden">
                <button
                  onClick={() => toggleRound(round)}
                  className="w-full flex items-center justify-between p-3 hover:bg-zinc-700/30 transition-colors"
                >
                  <span className="text-sm font-medium text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{ROUND_NAMES[round]}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">{roundGames.length} game{roundGames.length !== 1 ? 's' : ''}</span>
                    <svg
                      className={`w-4 h-4 text-zinc-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                      stroke="currentColor"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
                    </svg>
                  </div>
                </button>
                {isExpanded && (
                  <div className="px-3 pb-3 space-y-3">
                    {roundGames.map(game => {
                      const team1 = getTeamById(game.team1_id)
                      const team2 = getTeamById(game.team2_id)
                      const d1Team1 = team1 ? getD1TeamData(team1.name) : null
                      const d1Team2 = team2 ? getD1TeamData(team2.name) : null
                      const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
                      const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

                      return (
                        <div key={game.id} className="bg-zinc-900/50 rounded-lg p-3 space-y-2">
                          {/* Header: DateTime, Location, Channel */}
                          <div className="flex items-center gap-1">
                            <div className={`flex items-center gap-1 px-1 py-1 rounded text-[10px] ${
                              game.scheduled_at
                                ? 'bg-zinc-800 border border-zinc-600'
                                : 'bg-zinc-800/50 border border-dashed border-zinc-600'
                            }`}>
                              <span className={game.scheduled_at ? 'text-zinc-300' : 'text-zinc-500'}>
                                {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                              </span>
                              <input
                                type="datetime-local"
                                value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                                onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                                className="w-4 h-4 cursor-pointer text-transparent bg-transparent border-0 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:hidden"
                              />
                            </div>
                            <select
                              value={game.location || ''}
                              onChange={(e) => handleLocationChange(game.id, e.target.value)}
                              className={`flex-1 min-w-0 px-1 py-1 rounded text-[10px] cursor-pointer ${
                                game.location
                                  ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                                  : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                              }`}
                            >
                              <option value="">Location</option>
                              {getVenuesForRound(round).map(v => (
                                <option key={formatVenue(v)} value={formatVenue(v)}>{formatVenue(v)}</option>
                              ))}
                            </select>
                            <select
                              value={game.channel || ''}
                              onChange={(e) => handleChannelChange(game.id, e.target.value)}
                              className={`w-[72px] px-1 py-1 rounded text-[10px] text-center cursor-pointer ${
                                game.channel
                                  ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                                  : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                              }`}
                            >
                              <option value="">Ch</option>
                              {CHANNELS.map(ch => (
                                <option key={ch.name} value={ch.name}>{ch.name}</option>
                              ))}
                            </select>
                          </div>

                          {/* Team 1 */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg ${
                                team1 && d1Team1 ? '' : 'bg-zinc-900/50 border border-dashed border-zinc-700'
                              }`}
                              style={team1 && d1Team1 ? { backgroundColor: d1Team1.primaryColor + '40' } : undefined}
                            >
                              {team1 && d1Team1 ? (
                                <>
                                  <span className="w-5 text-xs font-mono text-zinc-400">{team1.seed}</span>
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: d1Team1.primaryColor }}
                                  >
                                    {logo1 ? (
                                      <img src={logo1} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                                    ) : (
                                      <span className="text-[10px] font-bold text-white">{d1Team1.abbreviation.slice(0, 2)}</span>
                                    )}
                                  </div>
                                  <span className="flex-1 truncate text-sm">{d1Team1.shortName}</span>
                                </>
                              ) : (
                                <span className="flex-1 text-zinc-600 italic text-xs text-center truncate">
                                  {getFeederLabel(game.id, true) ? `W: ${getFeederLabel(game.id, true)}` : 'TBD'}
                                </span>
                              )}
                            </div>
                            <div className="w-[72px] flex-shrink-0">
                              {game.spread ? (
                                <input
                                  type="text"
                                  defaultValue={game.spread}
                                  onBlur={(e) => handleSpreadChange(game.id, e.target.value)}
                                  className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded text-center text-xs text-zinc-400"
                                />
                              ) : team1 ? (
                                <input
                                  type="text"
                                  defaultValue=""
                                  onBlur={(e) => handleSpreadChange(game.id, e.target.value)}
                                  placeholder="Sprd"
                                  className="w-full px-1 py-2 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-[10px] text-zinc-500 placeholder-zinc-600"
                                />
                              ) : (
                                <span className="block w-full py-2 text-center text-xs text-zinc-600">—</span>
                              )}
                            </div>
                          </div>

                          {/* Team 2 */}
                          <div className="flex items-center gap-2">
                            <div
                              className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg ${
                                team2 && d1Team2 ? '' : 'bg-zinc-900/50 border border-dashed border-zinc-700'
                              }`}
                              style={team2 && d1Team2 ? { backgroundColor: d1Team2.primaryColor + '40' } : undefined}
                            >
                              {team2 && d1Team2 ? (
                                <>
                                  <span className="w-5 text-xs font-mono text-zinc-400">{team2.seed}</span>
                                  <div
                                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                                    style={{ backgroundColor: d1Team2.primaryColor }}
                                  >
                                    {logo2 ? (
                                      <img src={logo2} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                                    ) : (
                                      <span className="text-[10px] font-bold text-white">{d1Team2.abbreviation.slice(0, 2)}</span>
                                    )}
                                  </div>
                                  <span className="flex-1 truncate text-sm">{d1Team2.shortName}</span>
                                </>
                              ) : (
                                <span className="flex-1 text-zinc-600 italic text-xs text-center truncate">
                                  {getFeederLabel(game.id, false) ? `W: ${getFeederLabel(game.id, false)}` : 'TBD'}
                                </span>
                              )}
                            </div>
                            <div className="w-[72px] flex-shrink-0" />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })}

        </div>
      )}

      {/* Final Four Content */}
      {isFinalFourTab && (
        <div className="space-y-3">
          <h3 className="font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Final Four</h3>
          {finalFourGames.length === 0 ? (
            <p className="text-zinc-500 text-sm">No Final Four games created yet.</p>
          ) : finalFourReadyGames.length === 0 ? (
            <p className="text-zinc-500 text-sm">Waiting for Elite 8 winners...</p>
          ) : (
            <div className="space-y-3">
              {finalFourGames.map(game => {
                const team1 = getTeamById(game.team1_id)
                const team2 = getTeamById(game.team2_id)
                const d1Team1 = team1 ? getD1TeamData(team1.name) : null
                const d1Team2 = team2 ? getD1TeamData(team2.name) : null
                const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
                const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

                if (!team1 && !team2) return null

                return (
                  <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                    {/* Header: DateTime, Location, Channel */}
                    <div className="flex items-center gap-1">
                      {/* DateTime - compact display + picker */}
                      <div className={`flex items-center gap-1 px-1 py-1 rounded text-[10px] ${
                        game.scheduled_at
                          ? 'bg-zinc-800 border border-zinc-600'
                          : 'bg-zinc-800/50 border border-dashed border-zinc-600'
                      }`}>
                        <span className={game.scheduled_at ? 'text-zinc-300' : 'text-zinc-500'}>
                          {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                        </span>
                        <input
                          type="datetime-local"
                          value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                          onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                          className="w-4 h-4 cursor-pointer text-transparent bg-transparent border-0 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:hidden"
                        />
                      </div>
                      <input
                        type="text"
                        defaultValue={game.location || ''}
                        onBlur={(e) => handleLocationChange(game.id, e.target.value)}
                        placeholder="Location"
                        className={`flex-1 min-w-0 px-1 py-1 rounded text-[10px] ${
                          game.location
                            ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                            : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400 placeholder-zinc-500'
                        }`}
                      />
                      <select
                        value={game.channel || ''}
                        onChange={(e) => handleChannelChange(game.id, e.target.value)}
                        className={`w-[72px] px-1 py-1 rounded text-[10px] text-center cursor-pointer ${
                          game.channel
                            ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                            : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                        }`}
                      >
                        <option value="">Ch</option>
                        {CHANNELS.map(ch => (
                          <option key={ch.name} value={ch.name}>{ch.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Team 1 */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg ${
                          team1 && d1Team1 ? '' : 'bg-zinc-900/50 border border-dashed border-zinc-700'
                        }`}
                        style={team1 && d1Team1 ? { backgroundColor: d1Team1.primaryColor + '40' } : undefined}
                      >
                        {team1 && d1Team1 ? (
                          <>
                            <span className="w-5 text-xs font-mono text-zinc-400">{team1.seed}</span>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: d1Team1.primaryColor }}
                            >
                              {logo1 ? (
                                <img src={logo1} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{d1Team1.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{d1Team1.shortName}</span>
                          </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm text-center">TBD</span>
                        )}
                      </div>
                      <div className="w-[72px] flex-shrink-0">
                        {game.spread ? (
                          <input
                            type="text"
                            defaultValue={game.spread}
                            onBlur={(e) => handleSpreadChange(game.id, e.target.value)}
                            className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded text-center text-xs text-zinc-400"
                          />
                        ) : team1 ? (
                          <input
                            type="text"
                            defaultValue=""
                            onBlur={(e) => handleSpreadChange(game.id, e.target.value)}
                            placeholder="Spread"
                            className="w-full px-1 py-2 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-xs text-zinc-500 placeholder-zinc-600"
                          />
                        ) : (
                          <span className="block w-full py-2 text-center text-xs text-zinc-600">—</span>
                        )}
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg ${
                          team2 && d1Team2 ? '' : 'bg-zinc-900/50 border border-dashed border-zinc-700'
                        }`}
                        style={team2 && d1Team2 ? { backgroundColor: d1Team2.primaryColor + '40' } : undefined}
                      >
                        {team2 && d1Team2 ? (
                          <>
                            <span className="w-5 text-xs font-mono text-zinc-400">{team2.seed}</span>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: d1Team2.primaryColor }}
                            >
                              {logo2 ? (
                                <img src={logo2} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{d1Team2.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{d1Team2.shortName}</span>
                                                      </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm text-center">TBD</span>
                        )}
                      </div>
                      <div className="w-[72px] flex-shrink-0" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Championship Content */}
      {isChampionshipTab && (
        <div className="space-y-3">
          <h3 className="font-semibold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Championship</h3>
          {championshipGames.length === 0 ? (
            <p className="text-zinc-500 text-sm">No Championship game created yet.</p>
          ) : championshipReadyGames.length === 0 ? (
            <p className="text-zinc-500 text-sm">Waiting for Final Four winners...</p>
          ) : (
            <div className="space-y-3">
              {championshipGames.map(game => {
                const team1 = getTeamById(game.team1_id)
                const team2 = getTeamById(game.team2_id)
                const d1Team1 = team1 ? getD1TeamData(team1.name) : null
                const d1Team2 = team2 ? getD1TeamData(team2.name) : null
                const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
                const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

                if (!team1 && !team2) return null

                return (
                  <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                    {/* Header: DateTime, Location, Channel */}
                    <div className="flex items-center gap-1">
                      {/* DateTime - compact display + picker */}
                      <div className={`flex items-center gap-1 px-1 py-1 rounded text-[10px] ${
                        game.scheduled_at
                          ? 'bg-zinc-800 border border-zinc-600'
                          : 'bg-zinc-800/50 border border-dashed border-zinc-600'
                      }`}>
                        <span className={game.scheduled_at ? 'text-zinc-300' : 'text-zinc-500'}>
                          {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                        </span>
                        <input
                          type="datetime-local"
                          value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                          onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                          className="w-4 h-4 cursor-pointer text-transparent bg-transparent border-0 [&::-webkit-calendar-picker-indicator]:opacity-80 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-datetime-edit]:hidden"
                        />
                      </div>
                      <input
                        type="text"
                        defaultValue={game.location || ''}
                        onBlur={(e) => handleLocationChange(game.id, e.target.value)}
                        placeholder="Location"
                        className={`flex-1 min-w-0 px-1 py-1 rounded text-[10px] ${
                          game.location
                            ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                            : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400 placeholder-zinc-500'
                        }`}
                      />
                      <select
                        value={game.channel || ''}
                        onChange={(e) => handleChannelChange(game.id, e.target.value)}
                        className={`w-[72px] px-1 py-1 rounded text-[10px] text-center cursor-pointer ${
                          game.channel
                            ? 'bg-zinc-800 border border-zinc-600 text-zinc-300'
                            : 'bg-zinc-800/50 border border-dashed border-zinc-600 text-zinc-400'
                        }`}
                      >
                        <option value="">Ch</option>
                        {CHANNELS.map(ch => (
                          <option key={ch.name} value={ch.name}>{ch.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Team 1 */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg ${
                          team1 && d1Team1 ? '' : 'bg-zinc-900/50 border border-dashed border-zinc-700'
                        }`}
                        style={team1 && d1Team1 ? { backgroundColor: d1Team1.primaryColor + '40' } : undefined}
                      >
                        {team1 && d1Team1 ? (
                          <>
                            <span className="w-5 text-xs font-mono text-zinc-400">{team1.seed}</span>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: d1Team1.primaryColor }}
                            >
                              {logo1 ? (
                                <img src={logo1} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{d1Team1.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{d1Team1.shortName}</span>
                          </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm text-center">TBD</span>
                        )}
                      </div>
                      <div className="w-[72px] flex-shrink-0">
                        {game.spread ? (
                          <input
                            type="text"
                            defaultValue={game.spread}
                            onBlur={(e) => handleSpreadChange(game.id, e.target.value)}
                            className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded text-center text-xs text-zinc-400"
                          />
                        ) : team1 ? (
                          <input
                            type="text"
                            defaultValue=""
                            onBlur={(e) => handleSpreadChange(game.id, e.target.value)}
                            placeholder="Spread"
                            className="w-full px-1 py-2 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-xs text-zinc-500 placeholder-zinc-600"
                          />
                        ) : (
                          <span className="block w-full py-2 text-center text-xs text-zinc-600">—</span>
                        )}
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg ${
                          team2 && d1Team2 ? '' : 'bg-zinc-900/50 border border-dashed border-zinc-700'
                        }`}
                        style={team2 && d1Team2 ? { backgroundColor: d1Team2.primaryColor + '40' } : undefined}
                      >
                        {team2 && d1Team2 ? (
                          <>
                            <span className="w-5 text-xs font-mono text-zinc-400">{team2.seed}</span>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: d1Team2.primaryColor }}
                            >
                              {logo2 ? (
                                <img src={logo2} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{d1Team2.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{d1Team2.shortName}</span>
                                                      </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm text-center">TBD</span>
                        )}
                      </div>
                      <div className="w-[72px] flex-shrink-0" />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

    </div>
  )
}
