export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white">
      <main className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="text-center space-y-6">
          <div className="w-24 h-24 mx-auto bg-orange-500 rounded-3xl flex items-center justify-center shadow-lg shadow-orange-500/30">
            <span className="text-4xl font-bold">BM</span>
          </div>

          <h1 className="text-4xl font-bold tracking-tight">
            Bromadness
          </h1>

          <p className="text-zinc-400 max-w-xs">
            March Madness brackets, daily pick&apos;em, and casino games
          </p>

          <div className="pt-8 space-y-3">
            <div className="flex items-center gap-3 text-zinc-500">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse" />
              <span>Coming Soon</span>
            </div>
          </div>
        </div>

        <footer className="absolute bottom-6 text-zinc-600 text-sm">
          Install this app to your home screen
        </footer>
      </main>
    </div>
  );
}
