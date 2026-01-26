import { NextResponse } from 'next/server'
import webpush from 'web-push'
import { createAdminClient } from '@/lib/supabase/admin'

// Configure web-push with VAPID keys
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY

if (vapidPublicKey && vapidPrivateKey) {
  webpush.setVapidDetails(
    'mailto:notifications@bromadness.com',
    vapidPublicKey,
    vapidPrivateKey
  )
}

interface SendPushRequest {
  excludeUserId?: string
  title: string
  body: string
  data?: Record<string, unknown>
}

// POST - Send push notifications (internal use only)
export async function POST(request: Request) {
  try {
    // Verify this is an internal request by checking for a secret header
    const internalSecret = request.headers.get('x-internal-secret')
    if (internalSecret !== process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!vapidPublicKey || !vapidPrivateKey) {
      return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
    }

    const { excludeUserId, title, body, data }: SendPushRequest = await request.json()

    const supabase = createAdminClient()

    // Get all push subscriptions except for the excluded user
    let query = supabase.from('push_subscriptions').select('*')

    if (excludeUserId) {
      query = query.neq('user_id', excludeUserId)
    }

    const { data: subscriptions, error } = await query

    if (error) {
      console.error('Error fetching subscriptions:', error)
      return NextResponse.json({ error: 'Failed to fetch subscriptions' }, { status: 500 })
    }

    if (!subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ sent: 0 })
    }

    // Send notifications to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushSubscription = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        }

        const payload = JSON.stringify({
          title,
          body,
          icon: '/icons/icon-192x192.png',
          badge: '/icons/icon-192x192.png',
          data,
        })

        try {
          await webpush.sendNotification(pushSubscription, payload)
          return { success: true, userId: sub.user_id }
        } catch (err: unknown) {
          const error = err as { statusCode?: number }
          // If subscription is no longer valid (410 Gone), remove it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await supabase
              .from('push_subscriptions')
              .delete()
              .eq('id', sub.id)
          }
          return { success: false, userId: sub.user_id, error: error.statusCode }
        }
      })
    )

    const sent = results.filter(r => r.status === 'fulfilled' && (r.value as { success: boolean }).success).length
    const failed = results.length - sent

    return NextResponse.json({ sent, failed, total: results.length })
  } catch (error) {
    console.error('Error sending push notifications:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
