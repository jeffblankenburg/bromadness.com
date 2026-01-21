import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Image from 'next/image'
import { DevTools } from '@/components/DevTools'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // If logged in, try to get user profile
  let profile = null
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('display_name, is_admin, casino_credits')
      .eq('id', user.id)
      .single()
    profile = data
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-zinc-900 to-black text-white flex flex-col items-center justify-center p-6">
      <div className="text-center space-y-6">
          <Image
            src="/logo.png"
            alt="Bro Madness"
            width={380}
            height={253}
            priority
            className="mx-auto"
          />

          <p className="text-zinc-400 max-w-xs">
            March Madness brackets, daily pick&apos;em, and casino games
          </p>

          {user ? (
            <div className="pt-6 space-y-4">
              <p className="text-orange-400">
                Welcome{profile?.display_name ? `, ${profile.display_name}` : ''}!
              </p>

              {profile && (
                <div className="flex justify-center gap-4 text-sm">
                  <span className="text-zinc-500">
                    Credits: <span className="text-white">{profile.casino_credits?.toLocaleString()}</span>
                  </span>
                  {profile.is_admin && (
                    <Link href="/admin" className="text-orange-500 font-medium hover:text-orange-400">
                      Admin →
                    </Link>
                  )}
                </div>
              )}

              <div className="pt-4">
                <form action="/api/auth/signout" method="POST">
                  <button
                    type="submit"
                    className="text-zinc-500 hover:text-zinc-300 text-sm"
                  >
                    Sign out
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <div className="pt-8">
              <Link
                href="/login"
                className="inline-flex items-center justify-center px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-xl transition-colors"
              >
                Sign in
              </Link>
            </div>
          )}
      </div>

      {/* DEV ONLY - Remove before launch */}
      {user && profile && <DevTools isAdmin={profile.is_admin ?? false} />}
    </div>
  )
}
