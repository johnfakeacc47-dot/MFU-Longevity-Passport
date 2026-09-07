// Client for the `health-insights` Edge Function. The LLM key stays server-side;
// the report is cached in Supabase (ai_reports) and regenerates ~weekly or on
// an explicit refresh.

import { supabase } from './supabaseClient';

export type AiPillar = 'eating' | 'exercise' | 'sleep' | 'mental';

export interface AiSuggestion {
  pillar: AiPillar;
  action: string;
  why: string;
}

export interface AiReport {
  headline: string;
  scoreTrend: 'improving' | 'declining' | 'steady';
  whatsWorking: string[];
  whatToImprove: string[];
  suggestions: AiSuggestion[];
  focusNext: string;
}

export interface HealthInsightsResult {
  enoughData: boolean;
  loggedDays?: number;
  cached?: boolean;
  generatedAt?: string;
  model?: string;
  period?: { start: string; end: string };
  averages?: { total: number; nutrition: number; exercise: number; sleep: number; mental: number };
  report?: AiReport;
}

export async function getHealthInsights(
  periodType: 'week' | 'month',
  opts?: { force?: boolean; lang?: string },
): Promise<HealthInsightsResult> {
  if (!supabase) throw new Error('Not connected');

  const { data, error } = await supabase.functions.invoke<HealthInsightsResult>('health-insights', {
    body: { periodType, force: opts?.force ?? false, lang: opts?.lang ?? 'en' },
  });

  if (error) {
    let msg = 'Could not load the AI report';
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
  if (!data) throw new Error('No report returned');
  return data;
}
