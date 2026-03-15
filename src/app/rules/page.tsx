'use client'

import { useState } from 'react'
import Link from 'next/link'

type GameId = '3s-ds' | '1st-to-10' | 'digits' | 'pickem' | 'auction' | 'parlays' | 'brocket'

interface GameRule {
  id: GameId
  title: string
  description: string
}

const games: GameRule[] = [
  { id: '3s-ds', title: "3's & D's", description: 'Three pointers, dunks, and more' },
  { id: '1st-to-10', title: '1st to 10', description: 'Race to the score' },
  { id: 'digits', title: 'Digits', description: 'Match the final digit' },
  { id: 'pickem', title: "Pick'em", description: 'Pick winners against the spread' },
  { id: 'auction', title: 'NCAA Auction', description: 'Bid on teams, earn points' },
  { id: 'parlays', title: 'Parlays', description: '4-team spread parlays' },
  { id: 'brocket', title: 'Brocket', description: 'Straight-up winners, Round 1 + Saturday' },
]

export default function RulesPage() {
  const [selectedGame, setSelectedGame] = useState<GameId | null>(null)

  const renderGameRules = (gameId: GameId) => {
    switch (gameId) {
      case '3s-ds':
        return <ThreesAndDsRules />
      case '1st-to-10':
        return <FirstToTenRules />
      case 'digits':
        return <DigitsRules />
      case 'pickem':
        return <PickemRules />
      case 'auction':
        return <AuctionRules />
      case 'parlays':
        return <ParlaysRules />
      case 'brocket':
        return <BrocketRules />
      default:
        return null
    }
  }

  if (selectedGame) {
    const game = games.find(g => g.id === selectedGame)
    return (
      <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
        <div className="p-4 max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => setSelectedGame(null)}
              className="text-zinc-400 hover:text-white text-sm"
            >
              ← Back
            </button>
            <h1 className="text-lg font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{game?.title}</h1>
            <div className="w-12"></div>
          </div>
          {renderGameRules(selectedGame)}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-4 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-4">
          <Link href="/info" className="text-zinc-400 hover:text-white text-sm">← Info</Link>
          <h1 className="text-lg font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>Game Rules</h1>
          <div className="w-10"></div>
        </div>

        <div className="space-y-2">
          {games.map((game) => (
            <button
              key={game.id}
              onClick={() => setSelectedGame(game.id)}
              className="w-full flex items-center justify-between p-3 bg-zinc-800/50 rounded-lg hover:bg-zinc-800 transition-colors text-left"
            >
              <div>
                <div className="font-medium text-sm">{game.title}</div>
                <div className="text-xs text-zinc-500">{game.description}</div>
              </div>
              <svg className="w-4 h-4 text-zinc-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <h2 className="text-sm font-semibold text-orange-400 mt-4 mb-2 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>{children}</h2>
}

function Rule({ children }: { children: React.ReactNode }) {
  return <li className="text-sm text-zinc-300 mb-1.5">{children}</li>
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-xs text-zinc-500 italic mt-2">{children}</p>
}

function PayoutTable({ rows }: { rows: { label: string; value: string }[] }) {
  return (
    <div className="bg-zinc-800/50 rounded-lg overflow-hidden mt-2 mb-3">
      {rows.map((row, i) => (
        <div key={i} className="flex justify-between px-3 py-1.5 text-xs border-b border-zinc-700/50 last:border-0">
          <span className="text-zinc-400">{row.label}</span>
          <span className="text-zinc-200 font-mono">{row.value}</span>
        </div>
      ))}
    </div>
  )
}

function ThreesAndDsRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Setup</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Establish the wager amount (X = $1, $2, etc.)</Rule>
        <Rule>Coin toss to see who chooses first</Rule>
        <Rule>Winner can defer or choose their team for the first half</Rule>
        <Rule>Deferring/losing participant can switch teams at halftime</Rule>
      </ul>

      <SectionHeader>You Win (opponent pays you)</SectionHeader>
      <p className="text-xs text-zinc-400 mb-2">When your team executes:</p>
      <PayoutTable rows={[
        { label: 'Three point play', value: '1X' },
        { label: 'Dunk', value: '1X' },
        { label: 'Four point play', value: '1X' },
        { label: 'Shot beyond half court', value: '2X' },
      ]} />
      <ul className="list-disc list-inside space-y-1 text-xs text-zinc-500">
        <Rule>Three point play = made basket + made foul shot</Rule>
        <Rule>Dunk = ball pushed through rim with downward motion on initial attempt</Rule>
        <Rule>Four point play = made 3-pointer + made foul shot</Rule>
      </ul>

      <SectionHeader>You Lose (you pay opponent)</SectionHeader>
      <p className="text-xs text-zinc-400 mb-2">When your team executes:</p>
      <PayoutTable rows={[
        { label: 'Air ball (backcourt 3pt or FT)', value: '1X' },
        { label: 'Air ball (frontcourt 3pt)', value: '2X' },
        { label: 'Missed dunk', value: '2X' },
      ]} />
      <ul className="list-disc list-inside space-y-1 text-xs text-zinc-500">
        <Rule>Air ball = shot that doesn&apos;t hit the rim</Rule>
        <Rule>Missed dunk = missed, unblocked, unfouled dunk attempt</Rule>
      </ul>

      <SectionHeader>Underdog Bonus</SectionHeader>
      <PayoutTable rows={[
        { label: 'Line below 13', value: '1:1' },
        { label: 'Line 13 or above', value: '1:1 +$1' },
      ]} />
      <Note>+$1 means an extra dollar on every occurrence by the underdog</Note>

      <SectionHeader>Optional: Streak</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Each occurrence starts/continues a streak for that team</Rule>
        <Rule>Streak bonus starts at $1 and increases $1 each time</Rule>
        <Rule>Bonus is paid in addition to the occurrence (not a multiplier)</Rule>
      </ul>

      <SectionHeader>Optional: Mercy Rule</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>End a streak by paying the exact amount of the most recent occurrence</Rule>
        <Rule>Example: 5th consecutive occurrence = $5 to end ($1 + $4 streak)</Rule>
      </ul>

      <Note>Disputes settled by live game summary on CBS Sports.</Note>
    </div>
  )
}

function FirstToTenRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Setup</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Establish the wager amount (X = $1, $2, etc.)</Rule>
        <Rule>Coin toss to see who chooses first</Rule>
      </ul>

      <SectionHeader>Payouts</SectionHeader>
      <PayoutTable rows={[
        { label: '1st team to 10 points', value: '1X' },
        { label: '1st team to 16 points', value: '2X' },
      ]} />

      <SectionHeader>Underdog Odds</SectionHeader>
      <p className="text-xs text-zinc-400 mb-2">Favorite always pays 1:1. Underdog pays based on line:</p>
      <PayoutTable rows={[
        { label: 'Line less than 10', value: '1:1' },
        { label: 'Line 10.0 - 17.0', value: '2:1' },
        { label: 'Line 17.5 & above', value: '3:1' },
      ]} />
    </div>
  )
}

function DigitsRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Setup</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>10 spots available (digits 0-9)</Rule>
        <Rule>Draw cards to determine your digit</Rule>
        <Rule>Cost: $10 per digit</Rule>
        <Rule>You can buy an extra digit if spots remain unclaimed</Rule>
      </ul>

      <SectionHeader>How to Win</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Winning digit = last digit of total points scored by both teams</Rule>
        <Rule>Two winners at halftime, two winners at end of game</Rule>
      </ul>

      <SectionHeader>Halftime Payouts</SectionHeader>
      <PayoutTable rows={[
        { label: 'Match final digit', value: '$20' },
        { label: 'Match final digit +5', value: '$10' },
      ]} />

      <SectionHeader>Full Game Payouts</SectionHeader>
      <PayoutTable rows={[
        { label: 'Match final digit', value: '$50' },
        { label: 'Match final digit +5', value: '$20' },
      ]} />

      <Note>Example: If total is 147, winning digits are 7 (primary) and 2 (secondary, 147+5=152).</Note>
    </div>
  )
}

function PickemRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Overview</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Pick the winner of each game against the spread</Rule>
        <Rule>Entry fee: $10 per day (covers both sessions)</Rule>
        <Rule>Two sessions per day: Early Games & Late Games</Rule>
      </ul>

      <SectionHeader>Scoring</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>1 point for each correct pick against the spread</Rule>
        <Rule>Standings calculated per session</Rule>
      </ul>

      <SectionHeader>Payouts (per session)</SectionHeader>
      <PayoutTable rows={[
        { label: '1st place', value: '60%' },
        { label: '2nd place', value: '30%' },
        { label: '3rd place', value: '10%' },
      ]} />
      <Note>Payouts rounded to nearest $5.</Note>

      <SectionHeader>Tiebreakers</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>1st: Most correct picks</Rule>
        <Rule>2nd: Later position of 2nd loss wins</Rule>
        <Rule>3rd: Later position of 1st loss wins</Rule>
        <Rule>Still tied: Split the payout</Rule>
      </ul>
    </div>
  )
}

function AuctionRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Overview</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Auction takes place in-person <b>9:45 AM on Thursday</b>.</Rule>
        <Rule>Entry fee: $20</Rule>
        <Rule>Salary cap: $100</Rule>
        <Rule>Must draft a specific number of teams</Rule>
        <Rule>Minimum bid increment: $5</Rule>
        <Rule>Each person will take turns throwing out a team.</Rule>
        <Rule>Bidding determines ownership.</Rule>
      </ul>

      <SectionHeader>Scoring</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Earn points when your teams win games</Rule>
        <Rule>Points per win = team&apos;s seed number</Rule>
      </ul>
      <PayoutTable rows={[
        { label: '#1 seed wins', value: '1 pt' },
        { label: '#5 seed wins', value: '5 pts' },
        { label: '#10 seed wins', value: '10 pts' },
        { label: '#16 seed wins', value: '16 pts' },
      ]} />
      <Note>Rewards buying lower seeds that make deep runs.</Note>

      <SectionHeader>Payouts</SectionHeader>
      <PayoutTable rows={[
        { label: 'Champion owner', value: '18%' },
        { label: 'Runner-up owner', value: '12%' },
        { label: '1st place (points)', value: '28%' },
        { label: '2nd place (points)', value: '21%' },
        { label: '3rd place (points)', value: '14%' },
        { label: '4th place (points)', value: '7%' },
      ]} />
      <Note>Payouts rounded to nearest $5.</Note>
    </div>
  )
}

function ParlaysRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Overview</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Pick 4 teams to win against the spread</Rule>
        <Rule>All 4 picks must be correct to win</Rule>
        <Rule>Only games with assigned spreads are eligible</Rule>
        <Rule>Picks lock when each game starts</Rule>
      </ul>

      <SectionHeader>Betting</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Minimum bet: $1</Rule>
        <Rule>Maximum bet: $10</Rule>
        <Rule>You can create multiple parlays</Rule>
        <Rule>Parlays cannot be edited after submission</Rule>
      </ul>

      <SectionHeader>Payouts</SectionHeader>
      <PayoutTable rows={[
        { label: 'All 4 correct', value: '8:1' },
        { label: '$1 bet wins', value: '$9' },
        { label: '$5 bet wins', value: '$45' },
        { label: '$10 bet wins', value: '$90' },
      ]} />
      <Note>Payout includes your original bet returned. ($8 profit + $1 bet = $9 total)</Note>

      <SectionHeader>Status</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Open (green) - all picks still pending or correct</Rule>
        <Rule>Lost (red) - at least one pick was incorrect</Rule>
        <Rule>Won (gold) - all 4 picks were correct</Rule>
      </ul>
    </div>
  )
}

function BrocketRules() {
  return (
    <div className="space-y-1">
      <SectionHeader>Overview</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Pick the straight-up winner of each game (no spread)</Rule>
        <Rule>Covers Round 1 (32 games) and Saturday Round 2 (8 games) - 40 total</Rule>
        <Rule>Entry fee: $20</Rule>
      </ul>

      <SectionHeader>Scoring</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Points = seed of the team you correctly picked</Rule>
        <Rule>Higher seeds are worth more points</Rule>
      </ul>
      <PayoutTable rows={[
        { label: '#1 seed correct', value: '1 pt' },
        { label: '#5 seed correct', value: '5 pts' },
        { label: '#12 seed correct', value: '12 pts' },
        { label: '#16 seed correct', value: '16 pts' },
      ]} />
      <Note>Rewards correctly picking upsets.</Note>

      <SectionHeader>Round 2 (Saturday Only)</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>Only Saturday&apos;s 8 Round 2 games are included (not Sunday)</Rule>
        <Rule>Round 2 matchups are based on your Round 1 picks</Rule>
        <Rule>Your projected winners from Round 1 fill the Saturday bracket</Rule>
        <Rule>Pick the winner of each projected matchup</Rule>
        <Rule>Round 2 points count toward the same leaderboard</Rule>
      </ul>

      <SectionHeader>Payouts</SectionHeader>
      <PayoutTable rows={[
        { label: '1st place', value: '50%' },
        { label: '2nd place', value: '30%' },
        { label: '3rd place', value: '20%' },
      ]} />
      <Note>Payouts rounded to nearest $5.</Note>

      <SectionHeader>Tiebreakers</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>1st: Most points</Rule>
        <Rule>2nd: Later position of 2nd loss wins</Rule>
        <Rule>3rd: Later position of 1st loss wins</Rule>
        <Rule>4th: Higher max possible points</Rule>
      </ul>

      <SectionHeader>Lock Timing</SectionHeader>
      <ul className="list-disc list-inside space-y-1">
        <Rule>All picks (Round 1 and Round 2) lock when the first game starts Thursday</Rule>
      </ul>
    </div>
  )
}
