// supabase/functions/recognize-food/index.ts
//
// Cloud food recognition. The local TensorFlow.js model in the app only knows
// 10 Thai dishes; this identifies arbitrary food and estimates nutrition for the
// visible portion, using a vision LLM. The API key lives ONLY in this function's
// environment - the browser never sees it (same pattern as admin-users).
//
// Request  (POST, JWT required):
//   { imageB64: string, mimeType: "image/jpeg"|"image/png"|"image/webp", hint?: { dish: string, confidence: number } }
// Response (200):
//   { isFood, dish, dishLocal, cuisine, confidence, ingredients[],
//     nutrition: { calories, protein, carbs, fat, fiber, sodium },
//     servingEstimate, healthScore, healthNotes }
// Errors: { error: string } with a non-2xx status.
//
// --- Provider swap (Claude -> Gemini) ---
// Only `recognizeFood()` below is provider-specific. To move to Gemini: rewrite
// that one function to POST generativelanguage.googleapis.com with a
// responseSchema, swap ANTHROPIC_API_KEY -> GEMINI_API_KEY, redeploy. Nothing
// else in this file, the frontend, or the response contract changes.
//
// Operator env:
//   ANTHROPIC_API_KEY   (supabase secrets set)   - required
//   RECOGNIZE_FOOD_MODEL (optional)              - defaults to claude-sonnet-5
//   ALLOWED_ORIGINS      (shared with the other functions)

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.124.0?deps=zod@3.25.76'
import { z } from 'https://esm.sh/zod@3.25.76'
import { zodOutputFormat } from 'https://esm.sh/@anthropic-ai/sdk@0.124.0/helpers/zod?deps=zod@3.25.76'

// ---------- CORS (origin allowlist) - identical to admin-users/delete-user ----------
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

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && getAllowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// ---------- Provider-agnostic result schema ----------
const NutritionSchema = z.object({
  calories: z.number().describe('kcal for the visible portion'),
  protein: z.number().describe('grams'),
  carbs: z.number().describe('grams'),
  fat: z.number().describe('grams'),
  fiber: z.number().describe('grams'),
  sodium: z.number().describe('milligrams'),
})

const FoodSchema = z.object({
  isFood: z.boolean().describe('false if the image is not food/drink'),
  dish: z.string().describe('best-guess dish name in English, e.g. "Pad Thai with shrimp"'),
  dishLocal: z.string().describe('local-language name if applicable (Thai script), else ""'),
  cuisine: z.string().describe('e.g. "Thai", "Japanese", "unknown"'),
  confidence: z.number().describe('0-1'),
  ingredients: z.array(z.string()).describe('visible main ingredients'),
  nutrition: NutritionSchema,
  servingEstimate: z.string().describe('e.g. "1 plate, ~350 g"'),
  healthScore: z.number().describe('0-100, higher = healthier, for a general-population diet'),
  healthNotes: z.string().describe('one short sentence of practical advice'),
})

type FoodResult = z.infer<typeof FoodSchema>

const MIME_ALLOW = ['image/jpeg', 'image/png', 'image/webp']
const MAX_B64_LEN = 5 * 1024 * 1024 // ~3.7 MB decoded - the frontend downscales to ~768px well under this

const PROMPT = `You are a nutrition assistant for a health-tracking app. Identify the food or drink in the photo and estimate nutrition for the portion that is actually visible (not a generic serving).

Rules:
- If the image is not food or drink, set isFood=false, dish="", and zero the nutrition.
- Prefer a specific dish name over a category ("Khao Man Gai", not "chicken and rice").
- dishLocal: Thai script name when the dish is Thai, otherwise "".
- healthScore: 0-100 for a general healthy-eating context (fried/high-sodium/high-sugar lower it; vegetables/lean protein/whole grains raise it).
- Be realistic about portion size from visual cues (plate size, utensils).
- Output ONLY the structured object.`

// ---------- PROVIDER-SPECIFIC (the only part that changes for Gemini) ----------
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

  const response = await client.messages.parse({
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
    output_config: {
      format: zodOutputFormat(FoodSchema),
      effort: 'low',
    },
  })

  if (!response.parsed_output) {
    throw new Error('model_returned_unparseable_output')
  }
  return response.parsed_output
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
    // 1. AuthN
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

    // 2. Input validation
    let body: any
    try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400, req) }

    const imageB64: unknown = body?.imageB64
    const mimeType: unknown = body?.mimeType
    if (typeof imageB64 !== 'string' || imageB64.length === 0) {
      return json({ error: 'imageB64 is required' }, 400, req)
    }
    if (imageB64.length > MAX_B64_LEN) {
      return json({ error: 'Image too large - downscale before sending' }, 413, req)
    }
    if (typeof mimeType !== 'string' || !MIME_ALLOW.includes(mimeType)) {
      return json({ error: `mimeType must be one of ${MIME_ALLOW.join(', ')}` }, 400, req)
    }
    const hint =
      body?.hint && typeof body.hint.dish === 'string' && typeof body.hint.confidence === 'number'
        ? { dish: body.hint.dish, confidence: body.hint.confidence }
        : undefined

    // 3. Recognize
    const result = await recognizeFood(imageB64, mimeType, hint)
    return json(result, 200, req)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg === 'server_not_configured') {
      console.error('ANTHROPIC_API_KEY is not set')
      return json({ error: 'AI recognition is not configured' }, 503, req)
    }
    if (msg === 'model_returned_unparseable_output') {
      return json({ error: 'Could not read the image - try another photo' }, 422, req)
    }
    // Anthropic SDK errors carry a status
    const status = (err as any)?.status
    if (status === 429) return json({ error: 'AI is busy - try again in a moment' }, 429, req)
    if (status === 401) {
      console.error('Anthropic auth failed - check ANTHROPIC_API_KEY')
      return json({ error: 'AI recognition is misconfigured' }, 502, req)
    }
    console.error('recognize-food error:', msg)
    return json({ error: 'Recognition failed' }, 500, req)
  }
})
