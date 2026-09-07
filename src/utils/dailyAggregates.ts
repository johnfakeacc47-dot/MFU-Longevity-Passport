// Rolls today's localStorage logs into the numeric aggregates stored on the
// health_scores row, so the analytics page and the AI report can read real
// historical numbers after the daily reset clears the raw logs.

import { safeGetItem } from './safeStorage';
import { bangkokDateStr } from './bangkokTime';
import type { MealLog, ActivityLog, SleepLog, MentalLog } from './longevityScore';

export interface DailyAggregates {
  calories_in: number | null;
  calories_out: number | null;
  protein_g: number | null;
  active_minutes: number | null;
  sleep_hours: number | null;
  water_glasses: number | null;
  mood_score: number | null; // 0-10
  stress_level: number | null; // 1-10
}

const MOOD_SCORE: Record<string, number> = { great: 10, good: 8, neutral: 6, bad: 4, awful: 2 };

interface WaterLog { glasses?: number }

/** Aggregates for "today" (local midnight, matching calculateLongevityScore). */
export function getTodayAggregates(): DailyAggregates {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const ts = midnight.getTime();
  const isToday = (t: string | number | Date) => new Date(t).getTime() >= ts;

  const meals = safeGetItem<MealLog[]>('meals', []).filter((m) => isToday(m.timestamp));
  const activities = safeGetItem<ActivityLog[]>('activities', []).filter((a) => isToday(a.timestamp));
  const sleep = safeGetItem<SleepLog[]>('sleepLogs', []).find((s) => isToday(s.timestamp));
  const mental = safeGetItem<MentalLog[]>('mentalLogs', []).find((m) => isToday(m.timestamp));

  const waterLogs = safeGetItem<Record<string, WaterLog>>('waterLogs', {});
  const waterToday =
    waterLogs[bangkokDateStr()] ?? waterLogs[new Date().toISOString().slice(0, 10)];

  const caloriesIn = meals.reduce((s, m) => s + (m.calories || 0), 0);
  const proteinG = meals.reduce((s, m) => s + (m.macros?.protein || 0), 0);
  const activeMin = activities.reduce((s, a) => s + (a.duration || 0), 0);
  const caloriesOut = Math.round(activeMin * 6.5);

  return {
    calories_in: meals.length ? Math.round(caloriesIn) : null,
    calories_out: activities.length ? caloriesOut : null,
    protein_g: meals.length ? Math.round(proteinG) : null,
    active_minutes: activities.length ? Math.round(activeMin) : null,
    sleep_hours: sleep ? Number(sleep.duration.toFixed(1)) : null,
    water_glasses: waterToday?.glasses != null ? waterToday.glasses : null,
    mood_score: mental ? (MOOD_SCORE[mental.mood] ?? 6) : null,
    stress_level: mental ? mental.stress : null,
  };
}
