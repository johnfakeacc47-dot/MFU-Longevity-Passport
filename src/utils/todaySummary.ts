// Presentation-side roll-up of today's locally stored logs (meals, activity,
// sleep, mood, water) for the Home / Daily-log rows. Read-only: it never writes
// and adds no new storage keys.
import { safeGetItem } from './safeStorage';
import { getTodayWater } from './healthCoach';
import type { MealLog, ActivityLog, SleepLog, MentalLog } from './longevityScore';

export interface TodaySummary {
  meals: number;
  calories: number;
  activeMinutes: number;
  caloriesOut: number;
  sleepHours: number | null;
  sleepQuality: number | null;
  mood: MentalLog['mood'] | null;
  stress: number | null;
  waterMl: number;
  waterTargetMl: number;
}

export function getTodaySummary(): TodaySummary {
  const midnight = new Date();
  midnight.setHours(0, 0, 0, 0);
  const isToday = (t: string | number | Date) => new Date(t).getTime() >= midnight.getTime();

  const meals = safeGetItem<MealLog[]>('meals', []).filter((m) => isToday(m.timestamp));
  const acts = safeGetItem<ActivityLog[]>('activities', []).filter((a) => isToday(a.timestamp));
  const sleep = safeGetItem<SleepLog[]>('sleepLogs', []).find((s) => isToday(s.timestamp));
  const mental = safeGetItem<MentalLog[]>('mentalLogs', []).find((m) => isToday(m.timestamp));
  const water = getTodayWater();
  const activeMinutes = acts.reduce((s, a) => s + (a.duration || 0), 0);

  return {
    meals: meals.length,
    calories: Math.round(meals.reduce((s, m) => s + (m.calories || 0), 0)),
    activeMinutes: Math.round(activeMinutes),
    caloriesOut: Math.round(activeMinutes * 6.5),
    sleepHours: sleep ? sleep.duration : null,
    sleepQuality: sleep ? sleep.quality : null,
    mood: mental ? mental.mood : null,
    stress: mental ? mental.stress : null,
    waterMl: water.ml,
    waterTargetMl: water.targetMl || 2000,
  };
}

/** 7.17 -> { h: 7, m: 10 } */
export function splitHours(h: number): { h: number; m: number } {
  const total = Math.round(h * 60);
  return { h: Math.floor(total / 60), m: total % 60 };
}

/** Pillar scores are stored 0-25; the UI shows 0-100. */
export const toPct = (v: number | undefined | null): number =>
  Math.max(0, Math.min(100, Math.round((v ?? 0) * 4)));
