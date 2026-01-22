import Link from 'next/link'

export default function SchedulePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white pb-20">
      <div className="p-6 max-w-md mx-auto">
        <div className="flex items-center justify-between mb-6">
          <Link href="/info" className="text-zinc-400 hover:text-white text-sm">← Info</Link>
          <h1 className="text-lg font-bold text-orange-500">Game Schedule</h1>
          <div className="w-10"></div>
        </div>
        <p className="text-zinc-400">TV schedule with times and channels. Coming soon.</p>
      </div>
    </div>
  )
}
