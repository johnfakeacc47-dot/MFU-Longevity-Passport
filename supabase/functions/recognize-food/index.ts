// supabase/functions/recognize-food/index.ts
//
// Cloud food recognition. The local TensorFlow.js model in the app only knows
// 10 Thai dishes; this identifies arbitrary food and estimates nutrition for the
// visible portion, using a vision LLM. The API key lives ONLY in this function's
// environment — the browser never sees it (same pattern as admin-users).
//
// Structured output is prompt-driven + hand-parsed rather than via the SDK's
// zod helper — `zodOutputFormat` over esm.sh/Deno broke twice on zod version
// drift ("Cannot read properties of undefined (reading 'def')").

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.124.0'

// ---------- CORS (origin allowlist) ----------
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

// ---------- result shape ----------
interface Nutrition { calories: number; protein: number; carbs: number; fat: number; fiber: number; sodium: number }
interface FoodResult {
  isFood: boolean
  dish: string
  dishLocal: string
  cuisine: string
  confidence: number
  ingredients: string[]
  nutrition: Nutrition
  servingEstimate: string
  healthScore: number
  healthNotes: string
}

const MIME_ALLOW = ['image/jpeg', 'image/png', 'image/webp']
const MAX_B64_LEN = 5 * 1024 * 1024

const num = (v: unknown, d = 0): number => (typeof v === 'number' && isFinite(v) ? v : Number(v) || d)
const str = (v: unknown, d = ''): string => (typeof v === 'string' ? v : d)

function coerce(raw: any): FoodResult {
  const n = raw?.nutrition ?? {}
  return {
    isFood: raw?.isFood !== false,
    dish: str(raw?.dish),
    dishLocal: str(raw?.dishLocal),
    cuisine: str(raw?.cuisine, 'unknown'),
    confidence: Math.max(0, Math.min(1, num(raw?.confidence, 0.5))),
    ingredients: Array.isArray(raw?.ingredients) ? raw.ingredients.map(String).slice(0, 20) : [],
    nutrition: {
      calories: Math.max(0, Math.round(num(n.calories))),
      protein: Math.max(0, Math.round(num(n.protein))),
      carbs: Math.max(0, Math.round(num(n.carbs))),
      fat: Math.max(0, Math.round(num(n.fat))),
      fiber: Math.max(0, Math.round(num(n.fiber))),
      sodium: Math.max(0, Math.round(num(n.sodium))),
    },
    servingEstimate: str(raw?.servingEstimate),
    healthScore: Math.max(0, Math.min(100, Math.round(num(raw?.healthScore, 50)))),
    healthNotes: str(raw?.healthNotes),
  }
}

/** Pull the first balanced JSON object out of a model reply (handles ```json fences and stray prose). */
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
    else if (c === '}') {
      depth--
      if (depth === 0) return JSON.parse(cleaned.slice(start, i + 1))
    }
  }
  throw new Error('unbalanced_json')
}

const PROMPT = `You are a nutrition assistant for a health-tracking app. Identify the food or drink in the photo and estimate nutrition for the portion that is actually visible (not a generic serving).

Rules:
- If the image is not food or drink, set isFood=false, dish="", and zero the nutrition.
- Prefer a specific dish name over a category ("Khao Man Gai", not "chicken and rice").
- dishLocal: Thai script name when the dish is Thai, otherwise "".
- healthScore: 0-100 for a general healthy-eating context (fried/high-sodium/high-sugar lower it; vegetables/lean protein/whole grains raise it).
- Be realistic about portion size from visual cues (plate size, utensils).

Respond with ONLY a JSON object (no markdown fences, no prose) of exactly this shape:
{
  "isFood": boolean,
  "dish": string,                 // English, e.g. "Pad Thai with shrimp"
  "dishLocal": string,            // Thai script if applicable, else ""
  "cuisine": string,              // e.g. "Thai", "Japanese", "unknown"
  "confidence": number,           // 0-1
  "ingredients": string[],        // visible main ingredients
  "nutrition": { "calories": number, "protein": number, "carbs": number, "fat": number, "fiber": number, "sodium": number },  // g except calories(kcal) and sodium(mg)
  "servingEstimate": string,      // e.g. "1 plate, ~350 g"
  "healthScore": number,          // 0-100
  "healthNotes": string           // one short sentence of practical advice
}`

// ---------- PROVIDER-SPECIFIC ----------
async function recognizeFood(
  imageB64: string,
  mimeType: string,
  hint?: { dish: string; confidence: number },
): Promise<FoodResult> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
  if (!apiKey) throw new Error('server_not_configured')

  const client = new Anthropic({ apiKey })
  const model = Deno.env.get('RECOGNIZE_FOOD_MODEL') || 'claude-sonnet-5'

  const hintLine = hint
    ? `\n\nA fast on-device model guessed "${hint.dish}" (confidence ${hint.confidence.toFixed(2)}). Treat that as a weak hint, not ground truth.`
    : ''

  const response = await client.messages.create({
    model,
    max_tokens: 2048,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mimeType, data: imageB64 } },
          { type: 'text', text: PROMPT + hintLine },
        ],
      },
    ],
  })

  const text = (response.content ?? [])
    .filter((b: any) => b.type === 'text')
    .map((b: any) => b.text)
    .join('')
    .trim()
  if (!text) throw new Error('model_returned_unparseable_output')

  try {
    return coerce(extractJsonObject(text))
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
    if (!supabaseUrl || !anonKey) {
      console.error('missing SUPABASE_URL / SUPABASE_ANON_KEY')
      return json({ error: 'Server is not configured' }, 500, req)
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Invalid or expired token' }, 401, req)

    let body: any
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400, req) }

    const imageB64: unknown = body?.imageB64
    const mimeType: unknown = body?.mimeType
    if (typeof imageB64 !== 'string' || imageB64.length === 0) {
      return json({ error: 'imageB64 is required' }, 400, req)
    }
    if (imageB64.length > MAX_B64_LEN) {
      return json({ error: 'Image too large — downscale before sending' }, 413, req)
    }
    if (typeof mimeType !== 'string' || !MIME_ALLOW.includes(mimeType)) {
      return json({ error: `mimeType must be one of ${MIME_ALLOW.join(', ')}` }, 400, req)
    }
    const hint =
      body?.hint && typeof body.hint.dish === 'string' && typeof body.hint.confidence === 'number'
        ? { dish: body.hint.dish, confidence: body.hint.confidence }
        : undefined

    const result = await recognizeFood(imageB64, mimeType, hint)
    return json(result, 200, req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'server_not_configured') {
      console.error('ANTHROPIC_API_KEY is not set')
      return json({ error: 'AI recognition is not configured' }, 503, req)
    }
    if (msg === 'model_returned_unparseable_output') {
      return json({ error: 'Could not read the image — try another photo' }, 422, req)
    }
    const status = (err as any)?.status
    if (status === 429) return json({ error: 'AI is busy — try again in a moment' }, 429, req)
    if (status === 400 && /credit balance/i.test(msg)) {
      console.error('Anthropic credit exhausted')
      return json({ error: 'AI recognition is temporarily unavailable' }, 503, req)
    }
    if (status === 401) {
      console.error('Anthropic auth failed — check ANTHROPIC_API_KEY')
      return json({ error: 'AI recognition is misconfigured' }, 502, req)
    }
    console.error('recognize-food error:', msg)
    return json({ error: 'Recognition failed' }, 500, req)
  }
})
