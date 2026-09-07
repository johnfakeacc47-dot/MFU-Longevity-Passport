// Cloud food recognition client. Talks ONLY to the `recognize-food` Supabase
// Edge Function - the vision-model API key never reaches the browser.
// The provider (Claude now, maybe Gemini later) is entirely server-side; this
// module and its return shape do not change when the provider changes.

import { supabase } from './supabaseClient';

export interface AiNutrition {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
}

export interface AiFoodResult {
  isFood: boolean;
  dish: string;
  dishLocal: string;
  cuisine: string;
  confidence: number; // 0-1
  ingredients: string[];
  nutrition: AiNutrition;
  servingEstimate: string;
  healthScore: number; // 0-100
  healthNotes: string;
}

const MAX_DIM = 768;
const JPEG_QUALITY = 0.82;

/**
 * Downscale a data-URL / object-URL image to <= MAX_DIM on its longest edge and
 * re-encode as JPEG. Keeps the upload small (faster + cheaper + within model
 * limits) without losing the detail needed to identify a dish.
 */
export async function downscaleForAi(
  src: string,
): Promise<{ b64: string; mimeType: 'image/jpeg' }> {
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const el = new Image();
    el.onload = () => resolve(el);
    el.onerror = () => reject(new Error('Could not load image'));
    el.src = src;
  });

  const scale = Math.min(1, MAX_DIM / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas not available');
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const b64 = dataUrl.split(',', 2)[1] ?? '';
  return { b64, mimeType: 'image/jpeg' };
}

export interface AiRecognizeHint {
  dish: string;
  confidence: number; // 0-1
}

/**
 * Send an image to the recognize-food Edge Function. `src` is any browser image
 * URL (data:, blob:, object URL). `hint` is the local TF.js top guess, if any.
 * Throws Error(message) on failure - message is safe to show the user.
 */
export async function recognizeFoodWithAi(
  src: string,
  hint?: AiRecognizeHint,
): Promise<AiFoodResult> {
  if (!supabase) throw new Error('Not connected');

  const { b64, mimeType } = await downscaleForAi(src);

  const { data, error } = await supabase.functions.invoke<AiFoodResult>('recognize-food', {
    body: { imageB64: b64, mimeType, hint },
  });

  if (error) {
    let msg = 'AI recognition failed';
    try {
      const ctx = (error as { context?: { json?: () => Promise<{ error?: string }> } }).context;
      if (ctx && typeof ctx.json === 'function') {
        const parsed = await ctx.json();
        if (parsed?.error) msg = parsed.error;
      }
    } catch {
      /* keep default */
    }
    throw new Error(msg);
  }
  if (!data) throw new Error('AI returned no result');
  return data;
}
