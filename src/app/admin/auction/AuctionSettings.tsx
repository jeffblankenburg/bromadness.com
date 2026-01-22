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
    <>
      {/* Gear Icon Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
        title="Settings"
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
      </button>

      {/* Modal */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/70"
            onClick={() => setIsOpen(false)}
          />

          {/* Modal Content */}
          <div className="relative bg-zinc-900 border border-zinc-700 rounded-xl p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-orange-400">Auction Settings</h3>
              <button
                onClick={() => setIsOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Entry Fee</label>
                <div className="flex items-center">
                  <span className="text-zinc-500 mr-2">$</span>
                  <input
                    type="number"
                    value={entryFee}
                    onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Salary Cap</label>
                <div className="flex items-center">
                  <span className="text-zinc-500 mr-2">$</span>
                  <input
                    type="number"
                    value={salaryCap}
                    onChange={(e) => setSalaryCap(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-zinc-400 mb-1">Bid Increment</label>
                <div className="flex items-center">
                  <span className="text-zinc-500 mr-2">$</span>
                  <input
                    type="number"
                    value={bidIncrement}
                    onChange={(e) => setBidIncrement(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm"
                  />
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

              <div className="pt-4 border-t border-zinc-700">
                <label className="block text-sm text-zinc-400 mb-2">Throwout Order</label>
                <button
                  onClick={async () => {
                    const newSeed = crypto.randomUUID()
                    await supabase
                      .from('tournaments')
                      .update({ auction_order_seed: newSeed })
                      .eq('id', tournamentId)
                    router.refresh()
                  }}
                  className="w-full py-2 bg-zinc-700 hover:bg-zinc-600 text-white font-medium rounded-lg text-sm"
                >
                  Shuffle Order
                </button>
                <p className="text-xs text-zinc-500 mt-1">Randomizes the throwout order for the draft board</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
