// supabase/functions/send-reminders/index.ts
//
// Fired every 30 minutes by pg_cron (job "send-reminders-every-30-min",
// via public.trigger_send_reminders() — see
// supabase/migrations/0008_notifications.sql). All the actual eligibility
// logic (which reminder windows, who's due, dedupe) lives server-side in
// public.run_scheduled_reminders() — this function is just the HTTP entry
// point pg_net can call, secret-checked the same way as send-push.
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

const INTERNAL_SECRET = Deno.env.get('NOTIFY_INTERNAL_SECRET')

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const provided = req.headers.get('x-notify-secret')
  if (!INTERNAL_SECRET || provided !== INTERNAL_SECRET) {
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
