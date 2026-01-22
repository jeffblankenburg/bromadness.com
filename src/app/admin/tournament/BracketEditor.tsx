'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { InlineTeamSearch } from './InlineTeamSearch'
import { ROUND1_MATCHUPS } from '@/lib/bracket/generate'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

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
  next_game_id: string | null
  is_team1_slot: boolean | null
}

const CHANNELS = ['CBS', 'TBS', 'TNT', 'truTV']

const ROUND_NAMES: Record<number, string> = {
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
  const router = useRouter()
  const supabase = createClient()

  // Special tab IDs for final rounds
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

  const handleScheduleChange = async (gameId: string, datetime: string) => {
    const { error } = await supabase
      .from('games')
      .update({ scheduled_at: datetime || null })
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
    const date = new Date(dateStr)
    const days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']
    const day = days[date.getDay()]
    const hours = date.getHours()
    const mins = date.getMinutes().toString().padStart(2, '0')
    const hour12 = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours
    return `${day} ${hour12}:${mins}`
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

  const currentRegion = sortedRegions.find(r => r.id === activeTab)
  const regionTeamCount = teams.filter(t => t.region_id === activeTab).length
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
          const count = teams.filter(t => t.region_id === region.id).length
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

      {/* Final Rounds Tabs */}
      <div className="flex gap-1 bg-zinc-800/50 p-1 rounded-xl">
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

      {/* Current Region */}
      {/* Region Content */}
      {isRegionTab && currentRegion && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-orange-400">{currentRegion.name} Region</h3>
            <span className="text-sm text-zinc-400">{regionTeamCount}/16 teams</span>
          </div>

          {/* Round 1 Matchups */}
          <div className="text-xs text-zinc-500 font-medium mt-2">{ROUND_NAMES[1]}</div>
          <div className="space-y-3">
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

              return (
                <div key={idx} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                  {/* Header: DateTime (left), Channel (right) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {/* DateTime */}
                      <label className="relative">
                        <span className={`block px-2 py-1 rounded text-[11px] text-center cursor-pointer ${
                          game?.scheduled_at
                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                            : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                        }`}>
                          {game?.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                        </span>
                        <input
                          type="datetime-local"
                          value={game?.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                          onChange={(e) => game && handleScheduleChange(game.id, e.target.value)}
                          disabled={!game}
                          className="absolute inset-0 opacity-0 cursor-pointer disabled:cursor-default"
                        />
                      </label>
                    </div>
                    {/* Channel selector - same width as spread */}
                    <select
                      value={game?.channel || ''}
                      onChange={(e) => game && handleChannelChange(game.id, e.target.value)}
                      disabled={!game}
                      className={`w-[72px] px-1 py-1 rounded text-[11px] text-center cursor-pointer ${
                        game?.channel
                          ? 'bg-zinc-900 border border-zinc-700 text-zinc-300'
                          : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                      } disabled:opacity-30`}
                    >
                      <option value="">Channel</option>
                      {CHANNELS.map(ch => (
                        <option key={ch} value={ch}>{ch}</option>
                      ))}
                    </select>
                  </div>

                  {/* Team 1 (favorite/lower seed) with spread input */}
                  <div className="flex items-center gap-2">
                    {isSelected1 ? (
                      <InlineTeamSearch
                        seed={seed1}
                        currentTeamName={team1?.name}
                        onSelect={(name, shortName) => handleTeamSelect(activeTab, seed1, name, shortName)}
                        onClear={() => handleClearTeam(activeTab, seed1)}
                        onCancel={() => setSelectedSlot(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setSelectedSlot({ regionId: activeTab, seed: seed1 })}
                        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                          team1
                            ? 'hover:bg-zinc-600'
                            : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                        }`}
                        style={team1 && d1Team1 ? { backgroundColor: d1Team1.primaryColor + '40' } : undefined}
                      >
                        <span className="w-5 text-xs font-mono text-zinc-400">{seed1}</span>
                        {team1 && d1Team1 ? (
                          <>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: d1Team1.primaryColor }}
                            >
                              {logo1 ? (
                                <img src={logo1} alt="" className="w-5 h-5 object-contain" />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{d1Team1.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{d1Team1.shortName}</span>
                            <span className="text-xs text-zinc-400">{d1Team1.abbreviation}</span>
                          </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm">Select team...</span>
                        )}
                      </button>
                    )}
                    {!isSelected1 && (
                      <div className="w-[72px] flex-shrink-0">
                        {game?.spread ? (
                          <input
                            type="text"
                            defaultValue={game.spread}
                            onBlur={(e) => game && handleSpreadChange(game.id, e.target.value)}
                            className="w-full px-2 py-2 bg-zinc-900 border border-zinc-700 rounded text-center text-xs text-zinc-400"
                          />
                        ) : team1 ? (
                          <input
                            type="text"
                            defaultValue=""
                            onBlur={(e) => game && handleSpreadChange(game.id, e.target.value)}
                            placeholder="Spread"
                            className="w-full px-2 py-2 bg-zinc-900/50 border border-dashed border-zinc-700 rounded text-center text-xs text-zinc-500 placeholder-zinc-600"
                          />
                        ) : (
                          <span className="block w-full py-2 text-center text-xs text-zinc-600">—</span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Team 2 (underdog/higher seed) with datetime */}
                  <div className="flex items-center gap-2">
                    {isSelected2 ? (
                      <InlineTeamSearch
                        seed={seed2}
                        currentTeamName={team2?.name}
                        onSelect={(name, shortName) => handleTeamSelect(activeTab, seed2, name, shortName)}
                        onClear={() => handleClearTeam(activeTab, seed2)}
                        onCancel={() => setSelectedSlot(null)}
                      />
                    ) : (
                      <button
                        onClick={() => setSelectedSlot({ regionId: activeTab, seed: seed2 })}
                        className={`flex-1 flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                          team2
                            ? 'hover:bg-zinc-600'
                            : 'bg-zinc-900 hover:bg-zinc-800 border border-dashed border-zinc-700'
                        }`}
                        style={team2 && d1Team2 ? { backgroundColor: d1Team2.primaryColor + '40' } : undefined}
                      >
                        <span className="w-5 text-xs font-mono text-zinc-400">{seed2}</span>
                        {team2 && d1Team2 ? (
                          <>
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{ backgroundColor: d1Team2.primaryColor }}
                            >
                              {logo2 ? (
                                <img src={logo2} alt="" className="w-5 h-5 object-contain" />
                              ) : (
                                <span className="text-[10px] font-bold text-white">{d1Team2.abbreviation.slice(0, 2)}</span>
                              )}
                            </div>
                            <span className="flex-1 truncate text-sm">{d1Team2.shortName}</span>
                            <span className="text-xs text-zinc-400">{d1Team2.abbreviation}</span>
                          </>
                        ) : (
                          <span className="flex-1 text-zinc-500 italic text-sm">Select team...</span>
                        )}
                      </button>
                    )}
                    {/* Spacer to match spread width */}
                    {!isSelected2 && (
                      <div className="w-[72px] flex-shrink-0" />
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Later Rounds (2-4) within this region */}
          {[2, 3, 4].map(round => {
            const roundGames = getGamesForRound(activeTab, round)
            const readyGames = roundGames.filter(g => isGamePartiallyReady(g))

            if (readyGames.length === 0) return null

            return (
              <div key={round} className="mt-6">
                <div className="text-xs text-zinc-500 font-medium mb-2">{ROUND_NAMES[round]}</div>
                <div className="space-y-3">
                  {readyGames.map(game => {
                    const team1 = getTeamById(game.team1_id)
                    const team2 = getTeamById(game.team2_id)
                    const d1Team1 = team1 ? getD1TeamData(team1.name) : null
                    const d1Team2 = team2 ? getD1TeamData(team2.name) : null
                    const logo1 = d1Team1 ? getTeamLogoUrl(d1Team1) : null
                    const logo2 = d1Team2 ? getTeamLogoUrl(d1Team2) : null

                    return (
                      <div key={game.id} className="bg-zinc-800/50 rounded-xl p-3 space-y-2">
                        {/* Header: DateTime (left), Channel (right) */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {/* DateTime */}
                            <label className="relative">
                              <span className={`block px-2 py-1 rounded text-[11px] text-center cursor-pointer ${
                                game.scheduled_at
                                  ? 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                                  : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                              }`}>
                                {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                              </span>
                              <input
                                type="datetime-local"
                                value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                                onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                                className="absolute inset-0 opacity-0 cursor-pointer"
                              />
                            </label>
                          </div>
                          {/* Channel selector */}
                          <select
                            value={game.channel || ''}
                            onChange={(e) => handleChannelChange(game.id, e.target.value)}
                            className={`w-[60px] px-1 py-1 rounded text-[11px] text-center cursor-pointer ${
                              game.channel
                                ? 'bg-zinc-900 border border-zinc-700 text-zinc-300'
                                : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                            }`}
                          >
                            <option value="">Channel</option>
                            {CHANNELS.map(ch => (
                              <option key={ch} value={ch}>{ch}</option>
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
                                    <img src={logo1} alt="" className="w-5 h-5 object-contain" />
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
                          {/* Spread input for team1 (favorite) */}
                          <div className="w-[60px] flex-shrink-0">
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
                                    <img src={logo2} alt="" className="w-5 h-5 object-contain" />
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
                          {/* Spacer to match team1 spread width */}
                          <div className="w-[60px] flex-shrink-0" />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Final Four Content */}
      {isFinalFourTab && (
        <div className="space-y-3">
          <h3 className="font-semibold text-orange-400">Final Four</h3>
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
                    {/* Header: DateTime (left), Channel (right) */}
                    <div className="flex items-center justify-between">
                      <label className="relative">
                        <span className={`block px-2 py-1 rounded text-[11px] text-center cursor-pointer ${
                          game.scheduled_at
                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                            : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                        }`}>
                          {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                        </span>
                        <input
                          type="datetime-local"
                          value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                          onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                      <select
                        value={game.channel || ''}
                        onChange={(e) => handleChannelChange(game.id, e.target.value)}
                        className={`w-[72px] px-1 py-1 rounded text-[11px] text-center cursor-pointer ${
                          game.channel
                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-300'
                            : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                        }`}
                      >
                        <option value="">Channel</option>
                        {CHANNELS.map(ch => (
                          <option key={ch} value={ch}>{ch}</option>
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
                                <img src={logo1} alt="" className="w-5 h-5 object-contain" />
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
                                <img src={logo2} alt="" className="w-5 h-5 object-contain" />
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
          <h3 className="font-semibold text-orange-400">Championship</h3>
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
                    {/* Header: DateTime (left), Channel (right) */}
                    <div className="flex items-center justify-between">
                      <label className="relative">
                        <span className={`block px-2 py-1 rounded text-[11px] text-center cursor-pointer ${
                          game.scheduled_at
                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-300 hover:border-zinc-500'
                            : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                        }`}>
                          {game.scheduled_at ? formatGameTime(game.scheduled_at) : 'Time'}
                        </span>
                        <input
                          type="datetime-local"
                          value={game.scheduled_at ? game.scheduled_at.slice(0, 16) : ''}
                          onChange={(e) => handleScheduleChange(game.id, e.target.value)}
                          className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                      </label>
                      <select
                        value={game.channel || ''}
                        onChange={(e) => handleChannelChange(game.id, e.target.value)}
                        className={`w-[72px] px-1 py-1 rounded text-[11px] text-center cursor-pointer ${
                          game.channel
                            ? 'bg-zinc-900 border border-zinc-700 text-zinc-300'
                            : 'bg-zinc-900/50 border border-dashed border-zinc-700 text-zinc-500'
                        }`}
                      >
                        <option value="">Channel</option>
                        {CHANNELS.map(ch => (
                          <option key={ch} value={ch}>{ch}</option>
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
                                <img src={logo1} alt="" className="w-5 h-5 object-contain" />
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
                                <img src={logo2} alt="" className="w-5 h-5 object-contain" />
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
