'use client'

import { useState, useRef, useEffect } from 'react'

const LYRICS = `BRO! BRO! BRO!
MADNESS! MADNESS! MADNESS!
BRO-MADNESS!
BRO-MADNESS!

(Drums kick in)

Verse 1
Down in Powell, Ohio in a basement full of noise
Three TVs blazing with the brackets and the boys
Cold beer in the cooler, darts flying off the wall
First tip of March Madness and we're ready for it all
Cards on the table and the euchre's getting wild
Killer teaching lessons like a card-sharking child
Bro just laughs and raises up a can
Says "Welcome to the greatest weekend known to man!"

Pre-Chorus
Hear the buzzer sound
Hear the crowd go mad
Raise a glass boys
Best damn weekend we've had

BRO-MADNESS!
Raise your glass tonight
BRO-MADNESS!
Brackets burning bright
From Bro's basement walls
To the hills where the cabins stand
BRO-MADNESS!
The greatest weekend planned

BRO-MADNESS!
Hear the whole crew shout
BRO-MADNESS!
Let the madness out
Basketball and beer
With the best damn friends we've had
BRO-MADNESS!
BRO-MADNESS!

Verse 2
Got too big for the basement, had to take it to the hills
Cabins in the forest where the madness never chills
First came the Butte where the shouting shook the night
Then Wildcat Lodge when the brackets caught fire bright
Liberty was rocking when the bourbon started flowing
Makers kept the party and the laughter overflowing
Now Golden Acres hears the madness every spring
Thirty guys yelling when the underdogs win

Spanky's yelling "five!" with the cards up in the air
Killer teaching euchre to a rookie in the chair
G-Stan running audits with his laptop on the bar
While Bourbon Butter's pouring whiskey from a jar
Chef's cooking dinner but it's gone before it lands
Black Doug's hitting bullseyes throwing darts with steady hands
Quack brought yard games if the sunshine breaks through
Spider pushing Patron shots for the whole damn crew

Sheiker's watching Price Is Right like it's game seven night
"Drew's chocolate chicks!" and the whole room laughs outright

Now the table's getting loud tonight
3's and D's!
3's and D's!
Dollars flying everywhere
Bills thrown in the air
3's and D's!
3's and D's!
Winner buys the whiskey
Loser buys the beer!

BRO-MADNESS!
Raise your glass tonight
BRO-MADNESS!
Brackets burning bright
From Bro's basement walls
To the hills where the cabins stand
BRO-MADNESS!
The greatest weekend planned

BRO-MADNESS!
Hear the whole crew shout
BRO-MADNESS!
Let the madness out
Basketball and beer
With the best damn friends we've had
BRO-MADNESS!
BRO-MADNESS!
BRO-MADNESS!`

export function ThemeSongButton() {
  const [isOpen, setIsOpen] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause()
        audioRef.current = null
      }
    }
  }, [])

  const openPlayer = () => {
    setIsOpen(true)
    if (!audioRef.current) {
      audioRef.current = new Audio('/Bro Madness.mp3')
      audioRef.current.addEventListener('ended', () => setIsPlaying(false))
    }
    audioRef.current.play()
    setIsPlaying(true)
  }

  const closePlayer = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setIsPlaying(false)
    setIsOpen(false)
  }

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
      setIsPlaying(false)
    } else {
      audioRef.current.play()
      setIsPlaying(true)
    }
  }

  return (
    <>
      <button
        onClick={openPlayer}
        className="w-full bg-gradient-to-r from-orange-600 to-orange-500 hover:from-orange-500 hover:to-orange-400 text-white rounded-xl p-4 transition-all active:scale-95"
      >
        <div className="flex items-center justify-center gap-3">
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55C7.79 13 6 14.79 6 17s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z" />
          </svg>
          <span className="text-lg font-bold uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
            Play Theme Song
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 flex-shrink-0"
            style={{ paddingTop: 'calc(env(safe-area-inset-top) + 12px)' }}
          >
            <h2 className="text-lg font-bold text-orange-400 uppercase tracking-wide" style={{ fontFamily: 'var(--font-display)' }}>
              Bro Madness Theme
            </h2>
            <button
              onClick={closePlayer}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Scrollable Lyrics */}
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-lg mx-auto">
              {LYRICS.split('\n').map((line, i) => {
                const isSectionHeader = /^(Verse \d|Pre-Chorus|Chorus|Bridge|Outro|\(.*\))/.test(line)
                const isBroMadness = line.includes('BRO-MADNESS') || line.includes('BRO! BRO! BRO!') || line.includes('MADNESS! MADNESS! MADNESS!')
                const isShout = line.includes("3's and D's!")

                if (line.trim() === '') {
                  return <div key={i} className="h-4" />
                }

                if (isSectionHeader) {
                  return (
                    <p key={i} className="text-zinc-500 text-xs uppercase tracking-widest mt-4 mb-2">
                      {line}
                    </p>
                  )
                }

                if (isBroMadness || isShout) {
                  return (
                    <p key={i} className="text-orange-400 text-xl font-bold uppercase tracking-wide my-1" style={{ fontFamily: 'var(--font-display)' }}>
                      {line}
                    </p>
                  )
                }

                return (
                  <p key={i} className="text-zinc-200 text-base leading-relaxed my-1">
                    {line}
                  </p>
                )
              })}
            </div>
          </div>

          {/* Player Controls */}
          <div className="flex-shrink-0 border-t border-zinc-800 px-4 py-4"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 16px)' }}
          >
            <div className="flex items-center justify-center gap-4 max-w-lg mx-auto">
              <button
                onClick={togglePlay}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-orange-500 hover:bg-orange-400 transition-colors active:scale-95"
              >
                {isPlaying ? (
                  <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                  </svg>
                ) : (
                  <svg className="w-7 h-7 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M8 5.14v14l11-7-11-7z" />
                  </svg>
                )}
              </button>

              <a
                href="/Bro Madness.mp3"
                download="Bro Madness.mp3"
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white text-sm font-medium transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Download
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
