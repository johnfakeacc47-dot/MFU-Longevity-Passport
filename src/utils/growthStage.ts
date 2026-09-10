// Longevity Garden — growth-stage thresholds.
//
// Growth stage tracks `profiles.total_points` (server-authoritative — it's
// SUM(health_scores.total) via the trigger in
// supabase/migrations/0001_enable_rls.sql, so it only ever grows). Tuned so a
// typical, mostly-consistent user (a realistic mix of good/bad days) reaches
// a fully mature, fully-blooming tree in about a month; strong daily pillars
// get there faster (~3 weeks); an inconsistent stretch just takes longer.
// Growth never resets and is never blocked — a bad week only slows it down.
export const GROWTH_STAGE_COUNT = 5;
export type GrowthStage = 0 | 1 | 2 | 3 | 4;

export const STAGE_NAME_KEYS: Record<GrowthStage, string> = {
  0: 'garden.stageSeed',
  1: 'garden.stageSprout',
  2: 'garden.stageSapling',
  3: 'garden.stageYoungTree',
  4: 'garden.stageMatureTree',
};

export function stageFromPoints(totalPoints: number): GrowthStage {
  if (totalPoints >= 1800) return 4;
  if (totalPoints >= 500) return 3;
  if (totalPoints >= 150) return 2;
  if (totalPoints >= 20) return 1;
  return 0;
}

/** 0–3 tier for one pillar's 0–25 daily score — drives the tree's day-to-day
 *  look (soil richness, branch/leaf fullness, bloom, glow). Independent of
 *  growth stage, which only tracks all-time points. */
export function pillarTier(value: number): 0 | 1 | 2 | 3 {
  if (value >= 20) return 3;
  if (value >= 14) return 2;
  if (value >= 7) return 1;
  return 0;
}
