/**
 * Longevity Score Calculator — 4-pillar model.
 * Pillars: Eating (25) · Exercise (25) · Sleep (25) · Mental Health (25)
 * Total: 0–100
 *
 * Note: Intermittent Fasting (IF) is integrated as a bonus inside
 * Eating scoring — it is not a standalone top-level pillar.
 */

import { safeGetItem } from './safeStorage';

// ── Local storage interfaces ──────────────────────────────────────────────────

export interface Macros {
  protein: number;
  carbs:   number;
  fat:     number;
  sugar:   number;
  sodium:  number;
  fiber?:  number;
}

export interface MealLog {
  calories:    number;
  healthScore: number;
  timestamp:   string;
  foodName?:   string;
  /** TF.js model class label (e.g. "pad_thai") — lets the name re-translate per language. */
  foodKey?:    string;
  imageUrl?:   string;
  macros?:     Macros;
}

export interface FastingState {
  isFasting: boolean;
  startTime: string | null;
  endTime: string | null;
  fastingHours: number;
}

export interface ActivityLog {
  duration: number;
  timestamp: string;
}

export interface SleepLog {
  duration: number;
  quality: number;
  timestamp: string;
}

export interface MentalLog {
  mood: 'great' | 'good' | 'neutral' | 'bad' | 'awful';
  stress: number;   // 1–10 (lower is better)
  energy: number;   // 1–10
  note?: string;
  timestamp: string;
}

// ── Score breakdown ───────────────────────────────────────────────────────────

export interface LongevityBreakdown {
  nutrition: number;  // 0–25
  exercise: number;  // 0–25
  sleep: number;  // 0–25
  mental: number;  // 0–25
  total: number;  // 0–100
  /** @deprecated kept for backward compat — equals exercise */
  activity: number;
  /** @deprecated kept for backward compat — equals 0 */
  fasting: number;
}

// ── Age-dependent targets ─────────────────────────────────────────────────────

export const getSleepTargetByAge = (age: number): { min: number; max: number } => {
  if (age <= 13) return { min: 9, max: 11 };
  if (age <= 17) return { min: 8, max: 10 };
  if (age <= 64) return { min: 7, max: 9 };
  return { min: 7, max: 8 };
};

export const getActivityTargetByAge = (age: number): number => {
  if (age <= 17) return 60;
  if (age <= 64) return 30;
  return 20;
};

// ── Main Calculator ───────────────────────────────────────────────────────────

export const calculateLongevityScore = (age: number = 25): LongevityBreakdown => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const ts = today.getTime();

  const meals = safeGetItem<MealLog[]>('meals', []);
  const fastingState = safeGetItem<FastingState>('fastingState', { isFasting: false, startTime: null, endTime: null, fastingHours: 0 });
  const activities = safeGetItem<ActivityLog[]>('activities', []);
  const sleepLogs = safeGetItem<SleepLog[]>('sleepLogs', []);
  const mentalLogs = safeGetItem<MentalLog[]>('mentalLogs', []);

  const todayMeals = meals.filter((m) => new Date(m.timestamp).getTime() >= ts);
  const todayActivities = activities.filter((a) => new Date(a.timestamp).getTime() >= ts);
  const todaySleep = sleepLogs.find((s) => new Date(s.timestamp).getTime() >= ts);
  const todayMental = mentalLogs.find((m) => new Date(m.timestamp).getTime() >= ts);

  const sleepTarget = getSleepTargetByAge(age);
  const activityTarget = getActivityTargetByAge(age);

  const nutrition = calcNutritionScore(todayMeals, fastingState);
  const exercise = calcExerciseScore(todayActivities, activityTarget);
  const sleep = calcSleepScore(todaySleep, sleepTarget);
  const mental = calcMentalScore(todayMental);
  const total = Math.min(100, nutrition + exercise + sleep + mental);

  return { nutrition, exercise, sleep, mental, total, activity: exercise, fasting: 0 };
};

// ── Pillar calculators ────────────────────────────────────────────────────────

/** Eating: 0–25. Includes meal quality and IF bonus. */
export function calcNutritionScore(meals: MealLog[], fastingState: FastingState): number {
  if (meals.length === 0 && !fastingState.startTime) return 0;

  // Base meal quality: 0–20
  let mealScore = 0;
  if (meals.length > 0) {
    mealScore = 14; // logged at least one meal
    const avg = meals.reduce((s, m) => s + m.healthScore, 0) / meals.length;
    mealScore += (avg / 100) * 6;
  }

  // IF bonus: 0–5 (on top of meal score)
  let ifBonus = 0;
  if (fastingState.startTime) {
    if (fastingState.endTime) {
      const dur = (new Date(fastingState.endTime).getTime() - new Date(fastingState.startTime).getTime()) / 3600000;
      if (dur >= 16) ifBonus = 5;
      else if (dur >= 12) ifBonus = 3;
      else if (dur >= 8) ifBonus = 1;
    } else if (fastingState.isFasting) {
      const elapsed = (Date.now() - new Date(fastingState.startTime).getTime()) / 3600000;
      const target = fastingState.fastingHours || 16;
      ifBonus = Math.min((elapsed / target) * 5, 5);
    }
  }

  return Math.min(25, Math.round(mealScore + ifBonus));
}

/** Exercise: 0–25, based on daily minutes vs target. */
export function calcExerciseScore(activities: ActivityLog[], targetMinutes: number): number {
  if (activities.length === 0) return 0;
  const totalMin = activities.reduce((s, a) => s + a.duration, 0);
  const progress = Math.min(totalMin / targetMinutes, 1);
  let score = progress * 20;
  score += Math.min(activities.length * 2, 5); // variety bonus
  return Math.min(25, Math.round(score));
}

/** Sleep: 0–25, based on duration and quality. */
export function calcSleepScore(log: SleepLog | undefined, target: { min: number; max: number }): number {
  if (!log) return 0;
  const { duration, quality } = log;
  let base = 0;
  if (duration >= target.min && duration <= target.max) base = 17;
  else if (duration >= target.min - 1 && duration <= target.max + 1) base = 12;
  else if (duration >= target.min - 2 && duration <= target.max + 2) base = 7;
  const qualityBonus = (quality / 10) * 8;
  return Math.min(25, Math.round(base + qualityBonus));
}

/** Mental Health: 0–25 from mood, stress (inverted), and energy. */
export function calcMentalScore(log: MentalLog | undefined): number {
  if (!log) return 0;
  const moodMap: Record<string, number> = { great: 10, good: 8, neutral: 6, bad: 3, awful: 0 };
  const moodScore = moodMap[log.mood] ?? 6;
  const stressScore = Math.round(((10 - log.stress) / 9) * 8); // lower stress → higher score
  const energyScore = Math.round((log.energy / 10) * 7);
  return Math.min(25, moodScore + stressScore + energyScore);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

export const getScoreColor = (score: number): string => {
  if (score >= 80) return '#10B981';
  if (score >= 60) return '#22C55E';
  if (score >= 40) return '#F59E0B';
  return '#EF4444';
};

export const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
};

/** Returns i18n translation key for the score level */
export const getScoreLabelKey = (score: number): string => {
  if (score >= 80) return 'score.excellent';
  if (score >= 60) return 'score.good';
  if (score >= 40) return 'score.fair';
  return 'score.needsImprovement';
};

export const getPillarStatus = (value: number): { label: string; color: string } => {
  if (value >= 20) return { label: 'Excellent', color: '#10B981' };
  if (value >= 15) return { label: 'Good', color: '#22C55E' };
  if (value >= 10) return { label: 'Fair', color: '#F59E0B' };
  if (value > 0) return { label: 'Need Improvement', color: '#F97316' };
  return { label: 'Not Recorded', color: '#94A3B8' };
};

/** Returns i18n translation key for pillar status */
export const getPillarStatusKey = (value: number): { labelKey: string; color: string } => {
  if (value >= 20) return { labelKey: 'score.excellent', color: '#10B981' };
  if (value >= 15) return { labelKey: 'score.good', color: '#22C55E' };
  if (value >= 10) return { labelKey: 'score.fair', color: '#F59E0B' };
  if (value > 0) return { labelKey: 'score.needsImprovement', color: '#F97316' };
  return { labelKey: 'score.notRecorded', color: '#94A3B8' };
};

export const LONGEVITY_FACTORS = [
  { key: 'nutrition', label: 'Eating', color: '#10B981', description: 'Food quality, calories & IF.' },
  { key: 'exercise', label: 'Exercise', color: '#F59E0B', description: 'Daily movement & intensity.' },
  { key: 'sleep', label: 'Sleep', color: '#3B82F6', description: 'Rest quality & duration.' },
  { key: 'mental', label: 'Mental Health', color: '#8B5CF6', description: 'Mood, stress & energy.' },
];
