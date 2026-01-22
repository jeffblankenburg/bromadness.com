'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Settings {
  entryFee: number
  salaryCap: number
  bidIncrement: number
}

interface Props {
  tournamentId: string
  settings: Settings
}

export function AuctionSettings({ tournamentId, settings }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [entryFee, setEntryFee] = useState(settings.entryFee)
  const [salaryCap, setSalaryCap] = useState(settings.salaryCap)
  const [bidIncrement, setBidIncrement] = useState(settings.bidIncrement)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    try {
      await supabase
        .from('tournaments')
        .update({
          entry_fee: entryFee,
          salary_cap: salaryCap,
          bid_increment: bidIncrement,
        })
        .eq('id', tournamentId)
      setIsOpen(false)
      router.refresh()
    } catch (err) {
      console.error('Failed to save settings:', err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-zinc-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-orange-400">Settings</h3>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="text-xs text-zinc-400 hover:text-white"
        >
          {isOpen ? 'Close' : 'Edit'}
        </button>
      </div>

      {!isOpen ? (
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <div className="text-zinc-500 text-xs">Entry Fee</div>
            <div>${settings.entryFee}</div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs">Salary Cap</div>
            <div>${settings.salaryCap}</div>
          </div>
          <div>
            <div className="text-zinc-500 text-xs">Bid Increment</div>
            <div>${settings.bidIncrement}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Entry Fee</label>
              <div className="flex items-center">
                <span className="text-zinc-500 mr-1">$</span>
                <input
                  type="number"
                  value={entryFee}
                  onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Salary Cap</label>
              <div className="flex items-center">
                <span className="text-zinc-500 mr-1">$</span>
                <input
                  type="number"
                  value={salaryCap}
                  onChange={(e) => setSalaryCap(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Bid Increment</label>
              <div className="flex items-center">
                <span className="text-zinc-500 mr-1">$</span>
                <input
                  type="number"
                  value={bidIncrement}
                  onChange={(e) => setBidIncrement(parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm"
                />
              </div>
            </div>
          </div>

          <div className="text-xs text-zinc-500">
            Payouts are calculated automatically based on entry fee × participants
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-700 text-white font-medium rounded-lg text-sm"
          >
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      )}
    </div>
  )
}
