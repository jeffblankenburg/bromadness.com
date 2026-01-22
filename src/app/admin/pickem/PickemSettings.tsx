'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PickemPayouts {
  entry_fee: number
  session_1st: number
  session_2nd: number
  session_3rd: number
}

interface Props {
  tournamentId: string
  payouts: PickemPayouts
}

export function PickemSettings({ tournamentId, payouts }: Props) {
  const [isOpen, setIsOpen] = useState(false)
  const [entryFee, setEntryFee] = useState(payouts.entry_fee)
  const [session1st, setSession1st] = useState(payouts.session_1st)
  const [session2nd, setSession2nd] = useState(payouts.session_2nd)
  const [session3rd, setSession3rd] = useState(payouts.session_3rd)
  const [saving, setSaving] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  const handleSave = async () => {
    setSaving(true)
    try {
      const { error } = await supabase
        .from('tournaments')
        .update({
          pickem_payouts: {
            entry_fee: entryFee,
            session_1st: session1st,
            session_2nd: session2nd,
            session_3rd: session3rd,
          },
        })
        .eq('id', tournamentId)

      if (error) throw error

      setIsOpen(false)
      router.refresh()
    } catch (error) {
      console.error('Failed to save settings:', error)
      alert('Failed to save settings')
    }
    setSaving(false)
  }

  // Calculate expected prize pool per day (assuming full participation)
  const totalPayoutPerSession = session1st + session2nd + session3rd
  const totalPayoutPerDay = totalPayoutPerSession * 2 // 2 sessions per day

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
        </svg>
        Settings
      </button>

      {isOpen && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-orange-400 mb-6">Pick&apos;em Settings</h2>

            <div className="space-y-4">
              {/* Entry Fee */}
              <div>
                <label className="block text-sm text-zinc-400 mb-1">Entry Fee (per day)</label>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500">$</span>
                  <input
                    type="number"
                    value={entryFee}
                    onChange={(e) => setEntryFee(parseInt(e.target.value) || 0)}
                    className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
                  />
                </div>
              </div>

              <div className="border-t border-zinc-700 pt-4">
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Session Payouts</h3>
                <p className="text-xs text-zinc-500 mb-3">
                  Each day has 2 sessions. These payouts are per session.
                </p>

                <div className="space-y-3">
                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">1st Place</label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">$</span>
                      <input
                        type="number"
                        value={session1st}
                        onChange={(e) => setSession1st(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">2nd Place</label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">$</span>
                      <input
                        type="number"
                        value={session2nd}
                        onChange={(e) => setSession2nd(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-zinc-400 mb-1">3rd Place</label>
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500">$</span>
                      <input
                        type="number"
                        value={session3rd}
                        onChange={(e) => setSession3rd(parseInt(e.target.value) || 0)}
                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary */}
              <div className="bg-zinc-800/50 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-zinc-400">
                  <span>Per session payout:</span>
                  <span>${totalPayoutPerSession}</span>
                </div>
                <div className="flex justify-between text-zinc-400">
                  <span>Per day payout (2 sessions):</span>
                  <span>${totalPayoutPerDay}</span>
                </div>
                <div className="flex justify-between text-orange-400 font-medium mt-1 pt-1 border-t border-zinc-700">
                  <span>Thu + Fri total:</span>
                  <span>${totalPayoutPerDay * 2}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setIsOpen(false)}
                className="flex-1 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 disabled:bg-zinc-600 rounded-lg font-medium"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
