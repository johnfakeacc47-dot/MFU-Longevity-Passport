// supabase/functions/health-chat/index.ts
//
// AI health-coach chat. Streams a reply from Claude, grounded in the caller's
// own recent health_scores rows + profile. The API key never reaches the
// browser. Each turn (the new user message + the assistant reply) is appended
// to public.chat_messages.
//
// Deployed with verify_jwt = false so the browser CORS preflight is not gated by
// the platform; the function verifies the caller's JWT itself (db.auth.getUser).
//
// Request (POST): { messages: [{ role: "user"|"assistant", content }, ...], lang? }
//   — recent turns, last entry must be a user message.
// Response: text/plain stream of the assistant reply (token by token).
//
// Provider is isolated to `streamReply()` — swappable to Gemini.
// Env: ANTHROPIC_API_KEY (required), HEALTH_CHAT_MODEL (default claude-haiku-4-5)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.124.0?deps=zod@3.25.76'

const DEFAULT_ORIGINS = [
  'https://mfu-longevity-passport.vercel.app',
  'http://localhost:5173',
]
function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw) return DEFAULT_ORIGINS
  const list = raw.split(',').map((o) => o.trim()).filter(Boolean)
  return list.length > 0 ? list : DEFAULT_ORIGINS
}
function isAllowedOrigin(origin: string): boolean {
  if (getAllowedOrigins().includes(origin)) return true
  // any localhost / 127.0.0.1 port (local dev, whatever port Vite lands on)
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
}
function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && isAllowedOrigin(origin)) headers['Access-Control-Allow-Origin'] = origin
  return headers
}
function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// ---------- limits ----------
const MAX_TURNS = 16
const MAX_CONTENT_CHARS = 4000
const MAX_TOKENS = 1024
const CONTEXT_DAYS = 14

// ---------- date helpers (Asia/Bangkok) ----------
const TZ = 'Asia/Bangkok'
const bkkToday = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

interface ChatTurn { role: 'user' | 'assistant'; content: string }
interface DayRow {
  date: string
  total: number | null
  nutrition: number | null
  sleep: number | null
  activity: number | null
  fasting: number | null
  calories_in: number | null
  sleep_hours: number | null
  water_glasses: number | null
  protein_g: number | null
  mood_score: number | null
  stress_level: number | null
  active_minutes: number | null
}

function ageFromBirthDate(birth?: string | null): number | null {
  if (!birth) return null
  const b = new Date(birth)
  if (isNaN(b.getTime())) return null
  const now = new Date()
  let age = now.getUTCFullYear() - b.getUTCFullYear()
  const mo = now.getUTCMonth() - b.getUTCMonth()
  if (mo < 0 || (mo === 0 && now.getUTCDate() < b.getUTCDate())) age--
  return age >= 0 && age < 130 ? age : null
}

interface ProfileRow {
  name?: string | null
  birth_date?: string | null
  gender?: string | null
  height_cm?: number | null
  weight_kg?: number | null
  handle?: string | null
  total_points?: number | null
  longevity_score?: number | null
  wellness_days?: boolean[] | null
  faculty?: string | null
  department?: string | null
  fasting_start_time?: string | null
  fasting_target_hours?: number | null
}
interface ChallengeRow { day_name: string; completed: boolean }
interface TeamMate { name: string; points: number; isMe: boolean }

const CHALLENGE_GOAL = 500

// Compact, factual briefing on this user for the system prompt: identity, their
// longevity status, 14-day health data, the wellness challenge, and their team.
function buildContextBlock(
  profile: ProfileRow | null,
  days: DayRow[],
  challenges: ChallengeRow[],
  teamCount: number,
  team: TeamMate[],
): string {
  const lines: string[] = []

  // ── identity ──
  const name = profile?.name?.trim()
  const who: string[] = []
  const age = ageFromBirthDate(profile?.birth_date)
  if (age != null) who.push(`age ${age}`)
  if (profile?.gender) who.push(String(profile.gender))
  if (profile?.height_cm) who.push(`${profile.height_cm} cm`)
  if (profile?.weight_kg) who.push(`${profile.weight_kg} kg`)
  const edu = [profile?.faculty, profile?.department].filter(Boolean).join(' / ')
  lines.push(
    `User${name ? `: ${name}` : ' (name not set)'}` +
    `${who.length ? ` — ${who.join(', ')}` : ''}` +
    `${edu ? `, ${edu}` : ''}.` +
    `${profile?.handle ? ` Invite handle: ${profile.handle}.` : ''}`,
  )

  // ── longevity status ──
  const status: string[] = []
  if (profile?.total_points != null) status.push(`${profile.total_points} total points`)
  if (profile?.longevity_score) status.push(`longevity score ${profile.longevity_score}`)
  if (Array.isArray(profile?.wellness_days)) {
    const n = profile.wellness_days.filter(Boolean).length
    if (n) status.push(`${n} wellness days this week`)
  }
  if (status.length) lines.push(`Longevity status: ${status.join(', ')}.`)

  // ── active fast ──
  if (profile?.fasting_start_time) {
    const elapsedH = (Date.now() - new Date(profile.fasting_start_time).getTime()) / 3.6e6
    if (elapsedH >= 0 && elapsedH < 72) {
      const target = profile.fasting_target_hours
      lines.push(
        `Currently fasting: ${elapsedH.toFixed(1)} h elapsed` +
        `${target ? ` of a ${target} h target` : ''}.`,
      )
    }
  }

  // ── 14-day health data ──
  if (!days.length) {
    lines.push('Health tracking: nothing logged in the last 2 weeks.')
  } else {
    const avg = (pick: (d: DayRow) => number | null) => {
      const vals = days.map(pick).filter((v): v is number => v != null)
      return vals.length ? Math.round((vals.reduce((a, b) => a + b, 0) / vals.length) * 10) / 10 : null
    }
    const last = days[days.length - 1]
    lines.push(`Health data: logged ${days.length} of the last ${CONTEXT_DAYS} days.`)
    lines.push(
      `14-day pillar averages (out of 25 each): nutrition ${avg((d) => d.nutrition) ?? '-'}, ` +
      `exercise ${avg((d) => d.activity) ?? '-'}, sleep ${avg((d) => d.sleep) ?? '-'}, ` +
      `mental ${avg((d) => d.fasting) ?? '-'}; daily total ${avg((d) => d.total) ?? '-'}/100.`,
    )
    lines.push(
      `Behaviour averages: ~${avg((d) => d.calories_in) ?? '-'} kcal in, ` +
      `${avg((d) => d.protein_g) ?? '-'} g protein, ${avg((d) => d.sleep_hours) ?? '-'} h sleep, ` +
      `${avg((d) => d.water_glasses) ?? '-'} glasses water, ${avg((d) => d.active_minutes) ?? '-'} active min, ` +
      `mood ${avg((d) => d.mood_score) ?? '-'}/10, stress ${avg((d) => d.stress_level) ?? '-'}/10.`,
    )
    lines.push(
      `Most recent day (${last.date}): total ${last.total ?? '-'}/100 ` +
      `(nutrition ${last.nutrition ?? '-'}, exercise ${last.activity ?? '-'}, sleep ${last.sleep ?? '-'}, mental ${last.fasting ?? '-'}).`,
    )
  }

  // ── weekly wellness challenge ──
  if (challenges.length) {
    const done = challenges.filter((c) => c.completed).map((c) => c.day_name)
    lines.push(
      `Weekly wellness challenge: ${done.length}/${challenges.length} days complete` +
      `${done.length ? ` (${done.join(', ')})` : ''}.`,
    )
  }

  // ── team & wellness challenges ──
  if (teamCount > 1) {
    const roster = [...team].sort((a, b) => b.points - a.points)
    const teamScore = roster.reduce((s, m) => s + m.points, 0)
    const myRank = roster.findIndex((m) => m.isMe)
    lines.push(
      `Team: ${teamCount} members. Combined team score ${teamScore} / ${CHALLENGE_GOAL} challenge goal` +
      `${teamScore >= CHALLENGE_GOAL ? ' (goal reached!)' : ''}.` +
      `${myRank >= 0 ? ` This user ranks #${myRank + 1} of ${roster.length} shown.` : ''}`,
    )
    if (roster.length) {
      lines.push(
        `Teammates (public scores): ` +
        roster.map((m) => `${m.name}${m.isMe ? ' [this user]' : ''} ${m.points} pts`).join('; ') + '.' +
        (roster.length < teamCount ? ` (${teamCount - roster.length} more with private scores.)` : ''),
      )
    }
  } else {
    lines.push('Team: not in a team yet — could invite friends from the Team page (QR code / invite handle).')
  }

  return lines.join('\n')
}

function buildSystemPrompt(contextBlock: string, lang: 'en' | 'th'): string {
  const langLine = lang === 'th'
    ? 'Always reply in Thai (ภาษาไทย), no matter what language the user writes in.'
    : 'Always reply in English.'
  return [
    'You are the wellness coach in the MFU Longevity Passport app. You help students build healthy-ageing habits across four pillars (eating, exercise, sleep, mental health), and you also know about their longevity points, the weekly wellness challenge, and their team.',
    '',
    'FIRST RULE: answer the message the user just sent. If it is a question, answer that question straight away with practical advice. Never open with a welcome, a self-introduction, or a menu of pillars — the user is already in the app. Only greet back if the user actually greeted you.',
    '',
    "This user's profile and data (use it to make answers specific — address them by name when natural, cite their real numbers, never invent data):",
    contextBlock,
    '',
    'Other rules:',
    '- You may discuss their health data, longevity score/points, the weekly wellness challenge, and their team & teammates. Do not reveal another person\'s data beyond what is listed above; if asked about a teammate not listed, say their score is private.',
    '- Give practical advice directly even when the user has logged nothing. Only push them toward tracking a pillar when the answer truly needs their data (e.g. "why did my score drop?", "how am I doing this week?").',
    '- Stay on health, fitness, nutrition, sleep, stress, lifestyle, and how they are doing in the app. If asked something unrelated, briefly redirect to how you can help with their wellness.',
    '- You are NOT a doctor. Do not diagnose, name conditions, or give medical/medication advice. For symptoms, pain, or anything clinical, tell them to see a healthcare professional or MFU health services.',
    '- Be concrete and short: 2–4 sentences or a few bullet points. One clear suggestion at a time. Warm, never judgemental.',
    langLine,
  ].join('\n')
}

// ---------- provider-specific ----------
async function streamReply(
  system: string,
  messages: ChatTurn[],
): Promise<ReadableStream<Uint8Array> & { finalText: () => string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set')
  const model = Deno.env.get('HEALTH_CHAT_MODEL') || 'claude-haiku-4-5'
  const client = new Anthropic({ apiKey })

  const anthropicStream = client.messages.stream({
    model,
    max_tokens: MAX_TOKENS,
    system,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  })

  const encoder = new TextEncoder()
  let full = ''

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of anthropicStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            full += event.delta.text
            controller.enqueue(encoder.encode(event.delta.text))
          }
        }
      } catch (e) {
        console.error('[health-chat] stream error:', (e as Error)?.stack || String(e))
        const note = full
          ? '\n\n(The reply was cut off — please try again.)'
          : 'The coach is unavailable right now. Please try again in a bit.'
        controller.enqueue(encoder.encode(note))
      } finally {
        controller.close()
      }
    },
  }) as ReadableStream<Uint8Array> & { finalText: () => string }
  stream.finalText = () => full
  return stream
}

serve(async (req: Request) => {
  const cors = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!cors['Access-Control-Allow-Origin']) return new Response('Origin not allowed', { status: 403 })
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return json({ error: 'Missing or malformed Authorization header' }, 401, req)
    }
    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    if (!supabaseUrl || !anonKey) return json({ error: 'Server is not configured' }, 500, req)

    const db = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await db.auth.getUser()
    if (userError || !user) return json({ error: 'Invalid or expired token' }, 401, req)

    let body: any = {}
    try { body = await req.json() } catch { body = {} }

    const lang: 'en' | 'th' = body?.lang === 'th' ? 'th' : 'en'
    const raw = Array.isArray(body?.messages) ? body.messages : []
    const messages: ChatTurn[] = raw
      .filter((m: any) => (m?.role === 'user' || m?.role === 'assistant') && typeof m?.content === 'string')
      .map((m: any) => ({ role: m.role, content: String(m.content).slice(0, MAX_CONTENT_CHARS).trim() }))
      .filter((m: ChatTurn) => m.content.length > 0)
      .slice(-MAX_TURNS)

    if (!messages.length || messages[messages.length - 1].role !== 'user') {
      return json({ error: 'The last message must be from the user.' }, 400, req)
    }
    const userMessage = messages[messages.length - 1].content

    // ---------- grounding context ----------
    const to = bkkToday()
    const from = addDays(to, -(CONTEXT_DAYS - 1))

    // Team roster IDs first (needed for the leaderboard lookup below).
    const { data: teamRows } = await db
      .from('team_members').select('member_id').eq('user_id', user.id)
    const teammateIds = (teamRows ?? []).map((r: { member_id: string }) => r.member_id)
    const rosterIds = [...new Set([...teammateIds, user.id])]

    const [
      { data: profile },
      { data: rows },
      { data: challenges },
      { data: teamProfiles },
    ] = await Promise.all([
      db.from('profiles')
        .select('name,birth_date,gender,height_cm,weight_kg,handle,total_points,longevity_score,wellness_days,faculty,department,fasting_start_time,fasting_target_hours')
        .eq('id', user.id).maybeSingle(),
      db.from('health_scores')
        .select('date,total,nutrition,sleep,activity,fasting,calories_in,sleep_hours,water_glasses,protein_g,mood_score,stress_level,active_minutes')
        .eq('user_id', user.id)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: true }),
      db.from('challenges').select('day_name,completed').eq('user_id', user.id),
      rosterIds.length > 1
        ? db.from('leaderboard_profiles').select('id,name,total_points').in('id', rosterIds)
        : Promise.resolve({ data: [] as { id: string; name: string; total_points: number }[] }),
    ])

    const team: TeamMate[] = (teamProfiles ?? []).map((p: { id: string; name: string; total_points: number }) => ({
      name: (p.name || 'Member').trim() || 'Member',
      points: p.total_points || 0,
      isMe: p.id === user.id,
    }))

    const system = buildSystemPrompt(
      buildContextBlock(
        (profile ?? null) as ProfileRow | null,
        (rows ?? []) as DayRow[],
        (challenges ?? []) as ChallengeRow[],
        rosterIds.length,
        team,
      ),
      lang,
    )

    // ---------- stream ----------
    const stream = await streamReply(system, messages)
    const [toClient, toPersist] = stream.tee()

    // Persist the turn once the model finishes, without blocking the response.
    ;(async () => {
      const reader = toPersist.getReader()
      // drain so `finalText()` fills
      while (true) { const { done } = await reader.read(); if (done) break }
      const replyText = stream.finalText().trim()
      if (!replyText) return
      try {
        await db.from('chat_messages').insert([
          { user_id: user.id, role: 'user', content: userMessage },
          { user_id: user.id, role: 'assistant', content: replyText.slice(0, 8000) },
        ])
      } catch { /* history is best-effort */ }
    })()

    return new Response(toClient, {
      headers: { ...cors, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  } catch (e) {
    return json({ error: (e as Error).message || 'Unexpected error' }, 500, req)
  }
})
