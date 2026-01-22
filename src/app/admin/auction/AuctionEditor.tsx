'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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
  settings: Settings
}

export function AuctionEditor({ tournamentId, users, teams, regions, auctionTeams, auctionEntries, settings }: Props) {
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null)
  const [selectedUser, setSelectedUser] = useState('')
  const [bidAmount, setBidAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

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
      <div className="bg-zinc-800/50 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-orange-400 mb-3">Owners</h3>
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
        <div className="mt-3 pt-3 border-t border-zinc-700 flex justify-between text-xs text-zinc-500">
          <span>{auctionEntries.filter(e => e.has_paid).length}/{users.length} paid</span>
          <span>Entry fee: ${settings.entryFee}</span>
        </div>
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
            </div>
          </div>
        )
      })()}

      {/* Teams by Region */}
      {teamsByRegion.map(({ region, teams: regionTeams }) => (
        <div key={region.id} className="bg-zinc-800/50 rounded-xl p-4">
          <h3 className="text-sm font-semibold text-orange-400 mb-3">{region.name}</h3>
          <div className="space-y-1">
            {regionTeams.map(team => {
              const owner = getTeamOwner(team.id)
              return (
                <div
                  key={team.id}
                  className="flex items-center gap-2 py-1"
                >
                  <button
                    onClick={() => {
                      setSelectedTeam(team)
                      if (owner && owner.user) {
                        setSelectedUser(owner.user.id)
                        setBidAmount(owner.bidAmount.toString())
                      } else {
                        setSelectedUser('')
                        setBidAmount('')
                      }
                    }}
                    className="flex-1 flex items-center gap-2 text-left hover:text-orange-400"
                  >
                    <span className="w-6 text-xs text-zinc-500">{team.seed}</span>
                    <span className="flex-1 text-sm truncate">{team.short_name || team.name}</span>
                  </button>
                  {owner ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs bg-zinc-700 px-2 py-0.5 rounded">
                        {owner.user?.display_name || owner.user?.phone || 'Unknown'} · ${owner.bidAmount}
                      </span>
                      <button
                        onClick={() => handleRemove(owner.auctionId)}
                        disabled={saving}
                        className="text-red-400 hover:text-red-300 text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-zinc-600">Unassigned</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
