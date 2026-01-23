import { cookies } from 'next/headers'

const COOKIE_NAME = 'simulated_user_id'

/**
 * Server-side: Get simulated user ID from cookie
 * Returns null if not simulating
 */
export async function getSimulatedUserId(): Promise<string | null> {
  const cookieStore = await cookies()
  return cookieStore.get(COOKIE_NAME)?.value || null
}

/**
 * Server-side: Get the active user ID (simulated or real)
 * Use this in pages to get the effective user ID for data loading
 */
export async function getActiveUserId(authUserId: string): Promise<string> {
  const simulatedId = await getSimulatedUserId()
  return simulatedId || authUserId
}

/**
 * Server-side: Set simulated user ID cookie
 * Called from API route
 */
export async function setSimulatedUserId(userId: string): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, userId, {
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 // 24 hours
  })
}

/**
 * Server-side: Clear simulated user ID cookie
 * Called from API route
 */
export async function clearSimulatedUserId(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.delete(COOKIE_NAME)
}
