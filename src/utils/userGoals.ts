import { safeGetItem } from './safeStorage';

/**
 * The user's daily targets as set on the Set Goals page. Stored locally
 * (there is no profile column for them); Set Goals writes, the coach reads.
 * Ranges mirror the page's sliders so a hand-edited or stale value can't
 * push a target somewhere the UI never offers.
 */
export interface UserGoals {
  fastingHours: number;
  sleepHours: number;
  activityMinutes: number;
  updatedAt: string;
}

export const USER_GOALS_KEY = 'userGoals';

export const DEFAULT_GOALS: UserGoals = { fastingHours: 16, sleepHours: 8, activityMinutes: 30, updatedAt: '' };

export const GOAL_RANGES = {
  fastingHours:    { min: 12, max: 22 },
  sleepHours:      { min: 4,  max: 10 },
  activityMinutes: { min: 15, max: 120 },
} as const;

const clamp = (n: unknown, min: number, max: number, fallback: number) => {
  const v = typeof n === 'number' && Number.isFinite(n) ? n : fallback;
  return Math.min(max, Math.max(min, v));
};

export const readUserGoals = (): UserGoals => {
  const saved = safeGetItem<Partial<UserGoals>>(USER_GOALS_KEY, {});
  return {
    fastingHours:    clamp(saved.fastingHours,    GOAL_RANGES.fastingHours.min,    GOAL_RANGES.fastingHours.max,    DEFAULT_GOALS.fastingHours),
    sleepHours:      clamp(saved.sleepHours,      GOAL_RANGES.sleepHours.min,      GOAL_RANGES.sleepHours.max,      DEFAULT_GOALS.sleepHours),
    activityMinutes: clamp(saved.activityMinutes, GOAL_RANGES.activityMinutes.min, GOAL_RANGES.activityMinutes.max, DEFAULT_GOALS.activityMinutes),
    updatedAt: typeof saved.updatedAt === 'string' ? saved.updatedAt : '',
  };
};
