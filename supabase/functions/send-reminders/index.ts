// supabase/functions/send-reminders/index.ts
//
// Fired every 30 minutes by pg_cron (job "send-reminders-every-30-min",
// via public.trigger_send_reminders() — see
// supabase/migrations/0008_notifications.sql). All the actual eligibility
// logic (which reminder windows, who's due, dedupe) lives server-side in
// public.run_scheduled_reminders() — this function is just the HTTP entry
// point pg_net can call, secret-checked the same way as send-push.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.101.1'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const INTERNAL_SECRET = Deno.env.get('NOTIFY_INTERNAL_SECRET')

// Constant-time comparison of two equal-length byte arrays. Deno's old
// crypto.subtle.timingSafeEqual was a non-standard extension that is gone in
// Deno 2, so this is spelled out by hand: XOR every byte, never exit early.
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
  return diff === 0
}

// Same shared-secret check as send-push: hash both sides to fixed-length
// digests, then compare in constant time, so a caller cannot learn the secret
// one correct character at a time from response timing.
async function secretMatches(provided: string | null, expected: string | undefined): Promise<boolean> {
  if (!provided || !expected) return false
  const enc = new TextEncoder()
  const [a, b] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(provided)),
    crypto.subtle.digest('SHA-256', enc.encode(expected)),
  ])
  return timingSafeEqual(new Uint8Array(a), new Uint8Array(b))
}

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  if (!(await secretMatches(req.headers.get('x-notify-secret'), INTERNAL_SECRET))) {
    return json({ error: 'Unauthorized' }, 401)
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) {
    console.error('missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY')
    return json({ error: 'Server is not configured' }, 500)
  }
  const admin = createClient(supabaseUrl, serviceKey)

  const { data, error } = await admin.rpc('run_scheduled_reminders')
  if (error) {
    console.error('run_scheduled_reminders failed:', error)
    return json({ error: 'Failed' }, 500)
  }

  return json({ ok: true, sent: data }, 200)
})
