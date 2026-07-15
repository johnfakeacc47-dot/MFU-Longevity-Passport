/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  SCORING RULES — Single Source of Truth                     ║
 * ║                                                              ║
 * ║  ALL scoring thresholds live here.                          ║
 * ║  To adjust criteria: edit ONLY this file.                   ║
 * ║  Do NOT touch UI components or longevityScore.ts for        ║
 * ║  threshold changes.                                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 *
 * Architecture:
 *   scoringRules.ts  ← config (edit thresholds here)
 *       ↓
 *   scoringEngine.ts ← pure functions (IF logic, no side effects)
 *       ↓
 *   longevityScore.ts← orchestrator (reads localStorage → calls engine)
 *       ↓
 *   UI Components    ← display only (no scoring logic)
 *
 * AI role: interpret results, NOT compute them.
 */

// ── Pillar maximums ───────────────────────────────────────────
export const PILLAR_MAX = {
  nutrition: 25,
  exercise:  25,
  sleep:     25,
  mental:    25,
  total:     100,
} as const;

// ═══════════════════════════════════════════════════════════════
// 1. NUTRITION RULES  (max 25 pts)
// ═══════════════════════════════════════════════════════════════

export const NUTRITION_RULES = {
  /**
   * Calorie adherence — 0 to 8 pts.
   * Compare (todayCalories / targetCalories) ratio.
   */
  calorieAdherence: {
    max: 8,
    /** ratio range [min, max) → points awarded */
    bands: [
      { minRatio: 0.90, maxRatio: 1.05, points: 8 },   // 90-105 % of target → perfect
      { minRatio: 0.80, maxRatio: 1.15, points: 6 },   // 80-115 %
      { minRatio: 0.70, maxRatio: 1.25, points: 4 },   // 70-125 %
      { minRatio: 0.50, maxRatio: 1.50, points: 2 },   // 50-150 %
    ] as { minRatio: number; maxRatio: number; points: number }[],
    fallback: 0,
  },

  /**
   * Food quality (0-100 AI health-score on each meal) → 0-7 pts.
   * Averaged across all meals of the day.
   */
  mealQuality: {
    max: 7,
    bands: [
      { minScore: 80, points: 7 },
      { minScore: 65, points: 5 },
      { minScore: 50, points: 3 },
      { minScore: 30, points: 1 },
    ] as { minScore: number; points: number }[],
    fallback: 0,
    /** Extra point if ≥ 2 meals logged */
    mealCountBonus: { threshold: 2, bonus: 1 },
  },

  /**
   * Intermittent Fasting (IF) bonus — 0 to 5 pts.
   * Added on top of nutrition score (caps at PILLAR_MAX.nutrition).
   */
  intermittentFasting: {
    max: 5,
    bands: [
      { minHours: 16, points: 5 },
      { minHours: 14, points: 4 },
      { minHours: 12, points: 3 },
      { minHours: 10, points: 2 },
      { minHours:  8, points: 1 },
    ] as { minHours: number; points: number }[],
    fallback: 0,
  },

  /**
   * Water intake bonus — 0 to 3 pts.
   * Based on glasses/day (1 glass ≈ 250 ml).
   */
  waterIntake: {
    max: 3,
    bands: [
      { minGlasses: 8, points: 3 },
      { minGlasses: 6, points: 2 },
      { minGlasses: 4, points: 1 },
    ] as { minGlasses: number; points: number }[],
    fallback: 0,
  },

  /**
   * Macronutrient balance — 0 to 2 pts.
   * Each macro within recommended range gives partial credit.
   * Targets (% of total calories):
   *   Protein:  15–35 %
   *   Carbs:    45–65 %
   *   Fat:      20–35 %
   */
  macroBalance: {
    max: 2,
    protein:  { minPct: 15, maxPct: 35 },
    carbs:    { minPct: 45, maxPct: 65 },
    fat:      { minPct: 20, maxPct: 35 },
    /** points per macro within range */
    pointsPerMacro: 0.67, // 3 macros × 0.67 ≈ 2 pts
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 2. EXERCISE RULES  (max 25 pts)
// ═══════════════════════════════════════════════════════════════

/** Age-based daily exercise targets (minutes) */
export const EXERCISE_TARGETS_BY_AGE: { maxAge: number; targetMin: number }[] = [
  { maxAge: 17, targetMin: 60 },
  { maxAge: 64, targetMin: 30 },
  { maxAge: 999, targetMin: 20 },
];

export const EXERCISE_RULES = {
  /**
   * Duration adherence — 0 to 15 pts.
   * (minutesLogged / targetMinutes) ratio capped at 1.0.
   */
  durationAdherence: { max: 15 },

  /**
   * Intensity/type bonus — 0 to 6 pts.
   * Based on MET (Metabolic Equivalent of Task).
   */
  intensity: {
    max: 6,
    /** Calories burned per minute thresholds */
    calPerMinBands: [
      { minCalPerMin: 10, points: 6 },  // high intensity (running, HIIT)
      { minCalPerMin:  7, points: 4 },  // moderate-high
      { minCalPerMin:  5, points: 3 },  // moderate
      { minCalPerMin:  3, points: 2 },  // light
    ] as { minCalPerMin: number; points: number }[],
    fallback: 1,
  },

  /**
   * Session variety bonus — 0 to 4 pts.
   * Logging more than one session type in a day.
   */
  variety: {
    max: 4,
    bands: [
      { minSessions: 3, points: 4 },
      { minSessions: 2, points: 2 },
      { minSessions: 1, points: 0 },
    ] as { minSessions: number; points: number }[],
    fallback: 0,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 3. SLEEP RULES  (max 25 pts)
// ═══════════════════════════════════════════════════════════════

/** Age-based recommended sleep (hours) */
export const SLEEP_TARGETS_BY_AGE: { maxAge: number; minHours: number; maxHours: number }[] = [
  { maxAge: 13,  minHours: 9,  maxHours: 11 },
  { maxAge: 17,  minHours: 8,  maxHours: 10 },
  { maxAge: 64,  minHours: 7,  maxHours: 9  },
  { maxAge: 999, minHours: 7,  maxHours: 8  },
];

export const SLEEP_RULES = {
  /**
   * Duration score — 0 to 15 pts.
   * Based on deviation from recommended range.
   */
  duration: {
    max: 15,
    /** deviationHours is |actual - midpoint of target range| */
    bands: [
      { maxDeviation: 0.5, points: 15 },   // within 30 min of ideal
      { maxDeviation: 1.0, points: 12 },
      { maxDeviation: 1.5, points: 9  },
      { maxDeviation: 2.0, points: 5  },
    ] as { maxDeviation: number; points: number }[],
    fallback: 2,
  },

  /**
   * Sleep quality — 0 to 7 pts.
   * Self-reported quality (0–10 scale).
   */
  quality: {
    max: 7,
    /** quality score (0–10) → points */
    bands: [
      { minQuality: 8, points: 7 },
      { minQuality: 6, points: 5 },
      { minQuality: 4, points: 3 },
      { minQuality: 2, points: 1 },
    ] as { minQuality: number; points: number }[],
    fallback: 0,
  },

  /**
   * Bedtime bonus — 0 to 3 pts.
   * Earlier bedtime = better longevity outcome.
   */
  bedtime: {
    max: 3,
    /** Hour of day (24-h) when sleep started → points */
    bands: [
      { beforeHour: 22, points: 3 },   // before 22:00
      { beforeHour: 23, points: 2 },   // 22:00–22:59
      { beforeHour: 24, points: 1 },   // 23:00–23:59
    ] as { beforeHour: number; points: number }[],
    fallback: 0,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 4. MENTAL HEALTH RULES  (max 25 pts)
// ═══════════════════════════════════════════════════════════════

export const MENTAL_RULES = {
  /**
   * Mood — 0 to 10 pts.
   */
  mood: {
    max: 10,
    map: {
      great:   10,
      good:     8,
      neutral:  6,
      bad:      3,
      awful:    0,
    } as Record<string, number>,
    fallback: 0,
  },

  /**
   * Stress level (1–10 input, lower = better) — 0 to 8 pts.
   */
  stress: {
    max: 8,
    /** stress value 1-10 → points (lower stress = more points) */
    bands: [
      { maxStress: 2,  points: 8 },
      { maxStress: 4,  points: 6 },
      { maxStress: 6,  points: 4 },
      { maxStress: 8,  points: 2 },
    ] as { maxStress: number; points: number }[],
    fallback: 0,
  },

  /**
   * Energy level (1–10 input) — 0 to 7 pts.
   */
  energy: {
    max: 7,
    bands: [
      { minEnergy: 8, points: 7 },
      { minEnergy: 6, points: 5 },
      { minEnergy: 4, points: 3 },
      { minEnergy: 2, points: 1 },
    ] as { minEnergy: number; points: number }[],
    fallback: 0,
  },
} as const;

// ═══════════════════════════════════════════════════════════════
// 5. GLOBAL LABEL / COLOUR THRESHOLDS
// ═══════════════════════════════════════════════════════════════

export const SCORE_GRADE_BANDS = [
  { minScore: 80, label: 'Excellent',        color: '#10B981' },
  { minScore: 65, label: 'Good',             color: '#22C55E' },
  { minScore: 50, label: 'Fair',             color: '#F59E0B' },
  { minScore:  1, label: 'Needs Improvement',color: '#F97316' },
  { minScore:  0, label: 'Not Recorded',     color: '#94A3B8' },
] as const;

export const PILLAR_STATUS_BANDS = [
  { minScore: 20, label: 'Excellent',        color: '#10B981' },
  { minScore: 15, label: 'Good',             color: '#22C55E' },
  { minScore: 10, label: 'Fair',             color: '#F59E0B' },
  { minScore:  1, label: 'Need Improvement', color: '#F97316' },
  { minScore:  0, label: 'Not Recorded',     color: '#94A3B8' },
] as const;
