// supabase/functions/health-insights/index.ts
// Real AI period report. Reads the caller's health_scores rollup rows, asks an
// LLM for a grounded supportive interpretation, caches it in ai_reports so it
// regenerates ~weekly (or on force). API key stays server-side.
//
// Structured output is prompt-driven + hand-parsed (no SDK zod helper — it broke
// on zod version drift over esm.sh/Deno: "reading 'def'").

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.124.0'

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

const TZ = 'Asia/Bangkok'
const bkkToday = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ })
function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() + delta)
  return dt.toISOString().slice(0, 10)
}

const MIN_DAYS = 3
const CADENCE_MS: Record<string, number> = {
  week: 6.5 * 24 * 3600 * 1000,
  month: 27 * 24 * 3600 * 1000,
}
const FORCE_COOLDOWN_MS = 2 * 3600 * 1000

type Pillar = 'eating' | 'exercise' | 'sleep' | 'mental'
interface Suggestion { pillar: Pillar; action: string; why: string }
interface Report {
  headline: string
  scoreTrend: 'improving' | 'declining' | 'steady'
  whatsWorking: string[]
  whatToImprove: string[]
  suggestions: Suggestion[]
  focusNext: string
}

interface DayRow {
  date: string
  total: number | null
  nutrition: number | null
  sleep: number | null
  activity: number | null
  fasting: number | null
  calories_in: number | null
  calories_out: number | null
  sleep_hours: number | null
  water_glasses: number | null
  protein_g: number | null
  mood_score: number | null
  stress_level: number | null
}

const strArr = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean).slice(0, 6) : []

function extractJsonObject(text: string): any {
  const cleaned = text.replace(/```(?:json)?/gi, '').trim()
  const start = cleaned.indexOf('{')
  if (start === -1) throw new Error('no_json')
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < cleaned.length; i++) {
    const c = cleaned[i]
    if (inStr) {
      if (esc) esc = false
      else if (c === '\\') esc = true
      else if (c === '"') inStr = false
    } else if (c === '"') inStr = true
    else if (c === '{') depth++
    else if (c === '}') { depth--; if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1)) }
  }
  throw new Error('unbalanced_json')
}

function coerceReport(raw: any): Report {
  const PILLARS: Pillar[] = ['eating', 'exercise', 'sleep', 'mental']
  const trend = ['improving', 'declining', 'steady'].includes(raw?.scoreTrend) ? raw.scoreTrend : 'steady'
  const suggestions: Suggestion[] = Array.isArray(raw?.suggestions)
    ? raw.suggestions.slice(0, 4).map((s: any) => ({
        pillar: PILLARS.includes(s?.pillar) ? s.pillar : 'eating',
        action: String(s?.action ?? ''),
        why: String(s?.why ?? ''),
      })).filter((s: Suggestion) => s.action)
    : []
  return {
    headline: String(raw?.headline ?? ''),
    scoreTrend: trend,
    whatsWorking: strArr(raw?.whatsWorking),
    whatToImprove: strArr(raw?.whatToImprove),
    suggestions,
    focusNext: String(raw?.focusNext ?? ''),
  }
}

// ---------- PROVIDER-SPECIFIC ----------
async function generateReport(
  periodType: 'week' | 'month',
  rows: DayRow[],
  lang: string,
): Promise<{ report: Report; model: string }> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('server_not_configured')
  const client = new Anthropic({ apiKey })
  const model = Deno.env.get('HEALTH_INSIGHTS_MODEL') || 'claude-sonnet-5'

  const table = rows
    .map((r) =>
      [
        r.date,
        `score ${r.total ?? '-'}`,
        `eat ${r.nutrition ?? '-'}/25`,
        `exercise ${r.activity ?? '-'}/25`,
        `sleep ${r.sleep ?? '-'}/25`,
        `mental ${r.fasting ?? '-'}/25`,
        r.calories_in != null ? `${r.calories_in}kcal in` : '',
        r.calories_out != null ? `${r.calories_out}kcal out` : '',
        r.sleep_hours != null ? `${r.sleep_hours}h sleep` : '',
        r.protein_g != null ? `${r.protein_g}g protein` : '',
        r.water_glasses != null ? `${r.water_glasses} glasses water` : '',
        r.mood_score != null ? `mood ${r.mood_score}/10` : '',
        r.stress_level != null ? `stress ${r.stress_level}/10` : '',
      ].filter(Boolean).join(', '),
    )
    .join('\n')

  const prompt = `You are a supportive health coach reviewing one user's tracked data for the past ${periodType === 'week' ? '7 days' : '30 days'}. The app scores four pillars 0-25 each (Eating, Exercise, Sleep, Mental Health) for a 0-100 daily total.

The user tracked ${rows.length} day(s):
${table}

Write a short report:
- Ground every statement in these specific numbers. Never invent data or assume days not shown.
- Be encouraging but honest. No medical advice, diagnoses, or calorie prescriptions — habit-level suggestions only.
- Suggestions must be concrete and small ("add one 15-min walk", not "exercise more").
- ${lang === 'th' ? 'Write in Thai.' : 'Write in English.'}

Respond with ONLY a JSON object (no markdown fences, no prose) of exactly this shape:
{
  "headline": string,                      // one encouraging sentence summarising the period
  "scoreTrend": "improving" | "declining" | "steady",
  "whatsWorking": string[],                 // 2-3 specific things the data shows going well
  "whatToImprove": string[],                // 2-3 specific gaps the data shows
  "suggestions": [ { "pillar": "eating" | "exercise" | "sleep" | "mental", "action": string, "why": string } ],  // 2-4
  "focusNext": string                       // the single most important thing to focus on next
}`

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [{ role: 'user', content: prompt }],
  })
  const text = (response.content ?? [])
    .filter((b: any) => b.type === 'text').map((b: any) => b.text).join('').trim()
  if (!text) throw new Error('model_returned_unparseable_output')
  try {
    return { report: coerceReport(extractJsonObject(text)), model }
  } catch {
    throw new Error('model_returned_unparseable_output')
  }
}
// ---------- /PROVIDER-SPECIFIC ----------

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
    const periodType: 'week' | 'month' = body?.periodType === 'month' ? 'month' : 'week'
    const force = body?.force === true
    const lang = body?.lang === 'th' ? 'th' : 'en'

    const to = bkkToday()
    const from = addDays(to, periodType === 'week' ? -6 : -29)

    const { data: cached } = await db
      .from('ai_reports')
      .select('*')
      .eq('user_id', user.id)
      .eq('period_type', periodType)
      .order('period_end', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (cached && !force) {
      const age = Date.now() - new Date(cached.generated_at).getTime()
      if (age < CADENCE_MS[periodType]) {
        return json(
          {
            enoughData: true,
            cached: true,
            generatedAt: cached.generated_at,
            model: cached.model,
            period: { start: cached.period_start, end: cached.period_end },
            averages: cached.payload?.averages ?? null,
            report: cached.payload?.report ?? null,
          },
          200,
          req,
        )
      }
    }
    if (cached && force) {
      const age = Date.now() - new Date(cached.generated_at).getTime()
      if (age < FORCE_COOLDOWN_MS) {
        return json({ error: 'Just updated — try again later' }, 429, req)
      }
    }

    const { data: rows, error: rowsErr } = await db
      .from('health_scores')
      .select('date,total,nutrition,sleep,activity,fasting,calories_in,calories_out,sleep_hours,water_glasses,protein_g,mood_score,stress_level')
      .eq('user_id', user.id)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true })
    if (rowsErr) return json({ error: rowsErr.message }, 400, req)

    const days = (rows ?? []) as DayRow[]
    if (days.length < MIN_DAYS) {
      return json({ enoughData: false, loggedDays: days.length }, 200, req)
    }

    const nn = (sel: (d: DayRow) => number | null) => days.map(sel).filter((v): v is number => v != null)
    const mean = (xs: number[]) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0)
    const averages = {
      total: mean(nn((d) => d.total)),
      nutrition: mean(nn((d) => d.nutrition)),
      exercise: mean(nn((d) => d.activity)),
      sleep: mean(nn((d) => d.sleep)),
      mental: mean(nn((d) => d.fasting)),
    }

    const { report, model } = await generateReport(periodType, days, lang)
    const payload = { report, averages }

    await db.from('ai_reports').upsert(
      {
        user_id: user.id,
        period_type: periodType,
        period_start: from,
        period_end: to,
        payload,
        model,
        generated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,period_type,period_end' },
    )

    return json(
      {
        enoughData: true,
        cached: false,
        generatedAt: new Date().toISOString(),
        model,
        period: { start: from, end: to },
        averages,
        report,
      },
      200,
      req,
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'server_not_configured') return json({ error: 'AI reports are not configured' }, 503, req)
    if (msg === 'model_returned_unparseable_output') return json({ error: 'Could not generate a report — try again' }, 422, req)
    const status = (err as any)?.status
    if (status === 429) return json({ error: 'AI is busy — try again in a moment' }, 429, req)
    if (status === 400 && /credit balance/i.test(msg)) return json({ error: 'AI reports are temporarily unavailable' }, 503, req)
    console.error('health-insights error:', msg)
    return json({ error: 'Report generation failed' }, 500, req)
  }
})
