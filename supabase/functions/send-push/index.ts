// supabase/functions/send-push/index.ts
//
// Delivers a real Web Push notification to every device a user has
// subscribed on. Called internally by the notifications-table trigger
// (trigger_push_on_notification — see supabase/migrations/0008_notifications.sql)
// via pg_net, never by the browser directly — hence verify_jwt:false plus a
// manual shared-secret check instead of a user JWT.

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'
import webpush from 'npm:web-push@3.6.7'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

// Constant-time comparison of two equal-length byte arrays. Deno's old
// crypto.subtle.timingSafeEqual was a non-standard extension that is gone in
// Deno 2, so this is spelled out by hand: XOR every byte, never exit early.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Compare the shared secret without leaking, byte by byte, how much of it a
// caller guessed right. Both sides are hashed first so the comparison is over
// fixed-length digests — the length check above then says nothing about the
// real secret, and `!==` on the raw strings (which short-circuits at the first
// differing character) is avoided entirely.
async function secretMatches(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!provided || !expected) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
}

const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') || 'mailto:admin@mfu-longevity-passport.app'
const INTERNAL_SECRET = Deno.env.get('NOTIFY_INTERNAL_SECRET')

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!(await secretMatches(req.headers.get('x-notify-secret'), INTERNAL_SECRET))) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    console.error('VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY are not set')
    return json({ error: 'Push not configured' }, 503)
  }

  let body: any
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400) }

  const userId = body?.user_id
  const title = body?.title
  const bodyText = body?.body
  const data = body?.data ?? {}
  if (typeof userId !== 'string' || typeof title !== 'string' || typeof bodyText !== 'string') {
    return json({ error: 'user_id, title, body are required' }, 400)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'Server is not configured' }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey)

  const { data: subs, error } = await admin
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (error) {
    console.error('push_subscriptions lookup failed:', error)
    return json({ error: 'Lookup failed' }, 500)
  }
  if (!subs || subs.length === 0) {
    return json({ ok: true, sent: 0, reason: 'no_subscriptions' }, 200)
  }

  const payload = JSON.stringify({
    title,
    body: bodyText,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data,
  })

  let sent = 0
  const staleIds: string[] = []

  await Promise.all(subs.map(async (sub: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload,
      )
      sent++
    } catch (err: any) {
      const status = err?.statusCode
      if (status === 404 || status === 410) {
        staleIds.push(sub.id) // expired/unsubscribed on the browser side — clean it up
      } else {
        console.error('web-push send failed:', status, err?.body ?? err?.message ?? err)
      }
    }
  }))

  if (staleIds.length > 0) {
    await admin.from('push_subscriptions').delete().in('id', staleIds)
  }

  return json({ ok: true, sent, stale_removed: staleIds.length }, 200)
})
