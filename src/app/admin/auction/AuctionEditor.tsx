'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { D1_TEAMS, getTeamLogoUrl } from '@/lib/data/d1-teams'

interface User {
  id: string
  display_name: string | null
  phone: string
}

interface Team {
  id: string
  name: string
  short_name: string | null
  seed: number
  region_id: string
}

interface Region {
  id: string
  name: string
  position: number
}

interface AuctionTeam {
  id: string
  user_id: string
  team_id: string
  bid_amount: number
}

interface AuctionEntry {
  id: string
  user_id: string
  has_paid: boolean
  paid_at: string | null
}

interface Game {
  id: string
  team1_id: string | null
  team2_id: string | null
}

interface AuctionPayouts {
  championship_winner: number
  championship_runnerup: number
  points_1st: number
  points_2nd: number
  points_3rd: number
  points_4th: number
}

interface Settings {
  entryFee: number
  salaryCap: number
  bidIncrement: number
  payouts: AuctionPayouts
}

interface Props {
  tournamentId: string
  users: User[]
  teams: Team[]
  regions: Region[]
  auctionTeams: AuctionTeam[]
  auctionEntries: AuctionEntry[]
  games: Game[]
  settings: Settings
}

const getD1TeamData = (teamName: string) => {
  return D1_TEAMS.find(t => t.name.toLowerCase() === teamName.toLowerCase())
}

export function AuctionEditor({ tournamentId, users, teams, regions, auctionTeams, auctionEntries, games, settings }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [ownersExpanded, setOwnersExpanded] = useState(true)
  const [expandedRegions, setExpandedRegions] = useState<Set<string>>(new Set(regions.map(r => r.id)))
  const router = useRouter()
  const supabase = createClient()

  const toggleRegion = (regionId: string) => {
    setExpandedRegions(prev => {
      const next = new Set(prev)
      if (next.has(regionId)) {
        next.delete(regionId)
      } else {
        next.add(regionId)
      }
      return next
    })
  }

  const getTeamOwner = (teamId: string) => {
    const auction = auctionTeams.find(a => a.team_id === teamId)
    if (!auction) return null
    const user = users.find(u => u.id === auction.user_id)
    return { user, bidAmount: auction.bid_amount, auctionId: auction.id }
  }

  const getUserTeams = (userId: string) => {
    return auctionTeams
      .filter(a => a.user_id === userId)
      .map(a => {
        const team = teams.find(t => t.id === a.team_id)
        return { ...a, team }
      })
  }

  const getUserTotalSpent = (userId: string) => {
    return auctionTeams
      .filter(a => a.user_id === userId)
      .reduce((sum, t) => sum + t.bid_amount, 0)
  }

  const getUserRemainingBudget = (userId: string) => {
    return settings.salaryCap - getUserTotalSpent(userId)
  }

  const isUserPaid = (userId: string) => {
    const entry = auctionEntries.find(e => e.user_id === userId)
    return entry?.has_paid ?? false
  }

  const getOpponent = (teamId: string) => {
    const game = games.find(g => g.team1_id === teamId || g.team2_id === teamId)
    if (!game) return null
    const opponentId = game.team1_id === teamId ? game.team2_id : game.team1_id
    if (!opponentId) return null
    return teams.find(t => t.id === opponentId) || null
  }

  const togglePayment = async (userId: string) => {
    setSaving(true)
    try {
      const entry = auctionEntries.find(e => e.user_id === userId)
      if (entry) {
        await supabase
          .from('auction_entries')
          .update({
            has_paid: !entry.has_paid,
            paid_at: !entry.has_paid ? new Date().toISOString() : null
          })
          .eq('id', entry.id)
      } else {
        await supabase.from('auction_entries').insert({
          tournament_id: tournamentId,
          user_id: userId,
          has_paid: true,
          paid_at: new Date().toISOString(),
        })
      }
      router.refresh()
    } catch (err) {
      console.error('Failed to toggle payment:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleAssign = async () => {
    if (!selectedTeam || !selectedUser) return

    setSaving(true)
    try {
      // Check if team is already assigned
      const existing = auctionTeams.find(a => a.team_id === selectedTeam.id)
      if (existing) {
        // Update existing assignment
        await supabase
          .from('auction_teams')
          .update({ user_id: selectedUser, bid_amount: parseInt(bidAmount) || 0 })
          .eq('id', existing.id)
      } else {
        // Create new assignment
        await supabase.from('auction_teams').insert({
          tournament_id: tournamentId,
          user_id: selectedUser,
          team_id: selectedTeam.id,
          bid_amount: parseInt(bidAmount) || 0,
        })
      }
      setSelectedTeam(null)
      setSelectedUser('')
      setBidAmount('')
      router.refresh()
    } catch (err) {
      console.error('Failed to assign team:', err)
    } finally {
      setSaving(false)
    }
  }

  const handleRemove = async (auctionId: string) => {
    setSaving(true)
    try {
      await supabase.from('auction_teams').delete().eq('id', auctionId)
      router.refresh()
    } catch (err) {
      console.error('Failed to remove assignment:', err)
    } finally {
      setSaving(false)
    }
  }

  // Group teams by region
  const teamsByRegion = regions.map(region => ({
    region,
    teams: teams.filter(t => t.region_id === region.id).sort((a, b) => a.seed - b.seed),
  }))

  return (
    <div className="space-y-6">
      {/* User Summary */}
      <div className="bg-zinc-800/50 rounded-xl overflow-hidden">
        <button
          onClick={() => setOwnersExpanded(!ownersExpanded)}
          className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
        >
          <h3 className="text-sm font-semibold text-orange-400">Owners</h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-zinc-400">
              {auctionEntries.filter(e => e.has_paid).length}/{users.length} paid
            </span>
            <svg
              className={`w-4 h-4 text-zinc-400 transition-transform ${ownersExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19 9-7 7-7-7" />
            </svg>
          </div>
        </button>
        {ownersExpanded && (
          <div className="px-4 pb-4">
            <div className="space-y-2">
              {users.map(user => {
                const userTeams = getUserTeams(user.id)
                const totalSpent = getUserTotalSpent(user.id)
                const remaining = getUserRemainingBudget(user.id)
                const paid = isUserPaid(user.id)
                const isOverBudget = remaining < 0
                const isLowBudget = remaining >= 0 && remaining < 20

                return (
                  <div key={user.id} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePayment(user.id)}
                        disabled={saving}
                        className={`w-5 h-5 rounded border flex items-center justify-center text-xs ${
                          paid
                            ? 'bg-green-500/20 border-green-500 text-green-400'
                            : 'border-zinc-600 text-zinc-600 hover:border-zinc-400'
                        }`}
                      >
                        {paid && '✓'}
                      </button>
                      <span>{user.display_name || user.phone}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-500 text-xs">
                        {userTeams.length} teams
                      </span>
                      <span className={`font-mono text-xs ${
                        isOverBudget
                          ? 'text-red-400'
                          : isLowBudget
                            ? 'text-yellow-400'
                            : 'text-zinc-400'
                      }`}>
                        ${totalSpent}/${settings.salaryCap}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-between text-xs">
              <span className="text-zinc-500">{auctionEntries.filter(e => e.has_paid).length}/{users.length} paid</span>
              <span className="text-green-400 font-medium">
                Total pot: ${auctionEntries.filter(e => e.has_paid).length * settings.entryFee}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Assignment Modal */}
      {selectedTeam && (() => {
        const existingAssignment = auctionTeams.find(a => a.team_id === selectedTeam.id)
        const currentBidForThisTeam = existingAssignment?.user_id === selectedUser ? existingAssignment.bid_amount : 0
        const userSpentWithoutThisTeam = selectedUser
          ? getUserTotalSpent(selectedUser) - currentBidForThisTeam
          : 0
        const proposedBid = parseInt(bidAmount) || 0
        const wouldExceedCap = selectedUser ? (userSpentWithoutThisTeam + proposedBid) > settings.salaryCap : false
        const remainingAfterBid = selectedUser
          ? settings.salaryCap - userSpentWithoutThisTeam - proposedBid
          : settings.salaryCap

        return (
          <div className="fixed inset-0 bg-black/70 flex items-end justify-center z-50 p-4">
            <div className="bg-zinc-800 rounded-xl w-full max-w-md p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">
                  #{selectedTeam.seed} {selectedTeam.name}
                </h3>
                <button onClick={() => setSelectedTeam(null)} className="text-zinc-400 hover:text-white">
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Owner</label>
                <select
                  value={selectedUser}
                  onChange={(e) => setSelectedUser(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg"
                >
                  <option value="">Select owner...</option>
                  {users.map(user => {
                    const remaining = getUserRemainingBudget(user.id)
                    return (
                      <option key={user.id} value={user.id}>
                        {user.display_name || user.phone} (${remaining} left)
                      </option>
                    )
                  })}
                </select>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-sm text-zinc-400">Bid Amount</label>
                  {selectedUser && (
                    <span className={`text-xs ${wouldExceedCap ? 'text-red-400' : 'text-zinc-500'}`}>
                      {wouldExceedCap ? 'Exceeds cap!' : `$${remainingAfterBid} remaining`}
                    </span>
                  )}
                </div>
                <input
                  type="number"
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  step={settings.bidIncrement}
                  min={0}
                  placeholder={`$${settings.bidIncrement} increments`}
                  className={`w-full px-3 py-2 bg-zinc-900 border rounded-lg ${
                    wouldExceedCap ? 'border-red-500' : 'border-zinc-700'
                  }`}
                />
              </div>

              <button
                onClick={handleAssign}
                disabled={saving || !selectedUser || wouldExceedCap}
                className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded-lg"
              >
                {saving ? 'Saving...' : wouldExceedCap ? 'Over Budget' : 'Assign Team'}
              </button>

              {existingAssignment && (
                <button
                  onClick={() => {
                    handleRemove(existingAssignment.id)
                    setSelectedTeam(null)
                  }}
                  disabled={saving}
                  className="w-full py-2 bg-zinc-700 hover:bg-red-600 disabled:bg-zinc-800 text-zinc-300 hover:text-white font-medium rounded-lg text-sm"
                >
                  Clear This Team
                </button>
              )}
            </div>
          </div>
        )
      })()}

      {/* Teams by Region */}
      {teamsByRegion.map(({ region, teams: regionTeams }) => {
        const isExpanded = expandedRegions.has(region.id)
        const assignedCount = regionTeams.filter(t => getTeamOwner(t.id)).length

        return (
          <div key={region.id} className="bg-zinc-800/50 rounded-xl overflow-hidden">
            <button
              onClick={() => toggleRegion(region.id)}
              className="w-full flex items-center justify-between p-4 hover:bg-zinc-700/30 transition-colors"
            >
              <h3 className="text-sm font-semibold text-orange-400">{region.name}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-zinc-400">
                  {assignedCount}/{regionTeams.length} assigned
                </span>
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
              <div className="px-4 pb-4 space-y-2">
                {regionTeams.map(team => {
                  const owner = getTeamOwner(team.id)
                  const d1Team = getD1TeamData(team.name)
                  const logo = d1Team ? getTeamLogoUrl(d1Team) : null
                  const opponent = getOpponent(team.id)
                  const d1Opponent = opponent ? getD1TeamData(opponent.name) : null

                  return (
                    <div
                      key={team.id}
                      className="flex items-center gap-2 p-2 rounded-lg"
                      style={{ backgroundColor: d1Team ? d1Team.primaryColor + '30' : '#3f3f4620' }}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedTeam(team)
                          if (owner && owner.user) {
                            setSelectedUser(owner.user.id)
                            setBidAmount(owner.bidAmount.toString())
                          } else {
                            setSelectedUser('')
                            setBidAmount('')
                          }
                        }}
                        className="flex-1 flex items-center gap-2 text-left hover:opacity-80 cursor-pointer"
                      >
                        <span className="w-5 text-xs font-mono text-zinc-400">{team.seed}</span>
                        <div
                          className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: d1Team?.primaryColor || '#3f3f46' }}
                        >
                          {logo ? (
                            <img src={logo} alt="" className="w-5 h-5 object-contain" style={{ filter: 'drop-shadow(0 0 1px white) drop-shadow(0 0 1px rgba(0,0,0,0.5))' }} />
                          ) : (
                            <span className="text-[10px] font-bold text-white">
                              {d1Team?.abbreviation?.slice(0, 2) || team.short_name?.slice(0, 2) || '?'}
                            </span>
                          )}
                        </div>
                        <span className="flex-1 text-sm truncate text-white">
                          {d1Team?.shortName || team.short_name || team.name}
                          {opponent && (
                            <span className="text-xs text-zinc-500 ml-1">
                              vs {d1Opponent?.shortName || opponent.short_name || opponent.name}
                            </span>
                          )}
                        </span>
                      </button>
                      {owner ? (
                        <span className="text-xs bg-zinc-900/50 px-2 py-1 rounded">
                          {owner.user?.display_name || owner.user?.phone || 'Unknown'} · ${owner.bidAmount}
                        </span>
                      ) : (
                        <span className="text-xs text-zinc-500 px-2">Unassigned</span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
