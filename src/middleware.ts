import { type NextRequest, NextResponse } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

const ALLOWED_ORIGINS = [
  'https://www.bromadness.com',
  'https://bromadness.com',
]

export async function middleware(request: NextRequest) {
  // CSRF protection: validate Origin on mutation requests to API routes
  const method = request.method
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(method) && request.nextUrl.pathname.startsWith('/api')) {
    const origin = request.headers.get('origin')
    if (origin) {
      const isAllowed = ALLOWED_ORIGINS.some(allowed => origin === allowed) ||
        (process.env.NODE_ENV === 'development' && origin === 'http://localhost:3000')
      if (!isAllowed) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }
  }

  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (icons, images, etc.)
     * - sw.js (service worker)
     * - manifest.json (PWA manifest)
     */
    '/((?!_next/static|_next/image|favicon.ico|icons/|sw\\.js|manifest\\.json|manifest\\.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
