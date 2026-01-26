import { NextResponse } from 'next/server'

// GET - Return the public VAPID key for client-side subscription
export async function GET() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY

  if (!publicKey) {
    return NextResponse.json({ error: 'VAPID key not configured' }, { status: 500 })
  }

  return NextResponse.json({ publicKey })
}
