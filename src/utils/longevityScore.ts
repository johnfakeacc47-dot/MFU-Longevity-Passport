/**
 * Longevity Score Calculator — 4-Pillar, Age-Dependent Model
 * 
 * Factors:
 *   - Sleep (0-25 pts)
 *   - Activity (0-25 pts)
 *   - Nutrition (0-25 pts)
 *   - Fasting (0-25 pts)
 * Total: 100 pts
 */

interface MealLog {
  calories: number;
  healthScore: number;
  timestamp: string;
}

interface FastingState {
  isFasting: boolean;
  startTime: string | null;
  endTime: string | null;
  fastingHours: number;
}

interface ActivityLog {
  duration: number;
  timestamp: string;
}

interface SleepLog {
  duration: number;
  quality: number;
  timestamp: string;
}

export interface LongevityBreakdown {
  sleep: number;
  nutrition: number;
  fasting: number;
  activity: number;
  total: number;
}

interface LongevityFactor {
  key: string;
  label: string;
  color: string;
  description: string;
}

export const getSleepTargetByAge = (age: number): { min: number; max: number } => {
  if (age <= 13) return { min: 9, max: 11 };
  if (age <= 17) return { min: 8, max: 10 };
  if (age <= 25) return { min: 7, max: 9 };
  if (age <= 64) return { min: 7, max: 9 };
  return { min: 7, max: 8 };
};

export const getActivityTargetByAge = (age: number): number => {
  if (age <= 17) return 60;
  if (age <= 64) return 30;
  return 20;
};

export const calculateLongevityScore = (age: number = 20): LongevityBreakdown => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  const meals: MealLog[] = JSON.parse(localStorage.getItem('meals') || '[]');
  const fastingState: FastingState = JSON.parse(localStorage.getItem('fastingState') || '{}');
  const activities: ActivityLog[] = JSON.parse(localStorage.getItem('activities') || '[]');
  const sleepLogs: SleepLog[] = JSON.parse(localStorage.getItem('sleepLogs') || '[]');

  const todayMeals = meals.filter(m => new Date(m.timestamp).getTime() >= todayTimestamp);
  const todayActivities = activities.filter(a => new Date(a.timestamp).getTime() >= todayTimestamp);
  const todaySleep = sleepLogs.find(s => new Date(s.timestamp).getTime() >= todayTimestamp);

  const sleepTarget = getSleepTargetByAge(age);
  const sleepScoreRaw = calculateSleepScore(todaySleep, sleepTarget);

  const activityTarget = getActivityTargetByAge(age);
  const activityScoreRaw = calculateActivityScore(todayActivities, activityTarget);

  const nutritionScoreRaw = calculateNutritionScore(todayMeals);
  const fastingScoreRaw = calculateFastingScore(fastingState);

  // Convert 0-20 raw scores to 0-25 weighted scores
  const sleep = Math.round((sleepScoreRaw / 20) * 25);
  const activity = Math.round((activityScoreRaw / 20) * 25);
  const nutrition = Math.round((nutritionScoreRaw / 20) * 25);
  const fasting = Math.round((fastingScoreRaw / 20) * 25);

  const total = Math.min(100, Math.round(sleep + activity + nutrition + fasting));

  return { sleep, activity, nutrition, fasting, total };
};

const calculateSleepScore = (sleepLog: SleepLog | undefined, target: { min: number; max: number }): number => {
  if (!sleepLog) return 0;
  const { duration, quality } = sleepLog;
  let score = 0;
  if (duration >= target.min && duration <= target.max) score = 12;
  else if (duration >= target.min - 1 && duration <= target.max + 1) score = 8;
  else if (duration >= target.min - 2 && duration <= target.max + 2) score = 4;
  
  const qualityScore = (quality / 10) * 8;
  return Math.min(score + qualityScore, 20);
};

const calculateActivityScore = (activities: ActivityLog[], targetMinutes: number): number => {
  if (activities.length === 0) return 0;
  const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);
  const progress = Math.min(totalMinutes / targetMinutes, 1);
  let score = progress * 16;
  score += Math.min(activities.length * 2, 4);
  return Math.min(score, 20);
};

const calculateNutritionScore = (meals: MealLog[]): number => {
  if (meals.length === 0) return 0;
  let score = 14;
  const avgHealthScore = meals.reduce((sum, m) => sum + m.healthScore, 0) / meals.length;
  score += (avgHealthScore / 100) * 6;
  return Math.min(score, 20);
};

const calculateFastingScore = (state: FastingState): number => {
  if (!state.startTime) return 0;
  const now = new Date();
  const startTime = new Date(state.startTime);
  const elapsedHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

  if (state.isFasting) {
    const targetHours = state.fastingHours || 16;
    return Math.min(elapsedHours / targetHours, 1) * 20;
  } else if (state.endTime) {
    const fastDuration = (new Date(state.endTime).getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (fastDuration >= 12) return 20;
    if (fastDuration >= 8) return 14;
    return (fastDuration / 12) * 20;
  }
  return 0;
};

export const getScoreColor = (score: number): string => {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#fb923c';
  return '#ef4444';
};

export const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
};

export const LONGEVITY_FACTORS: LongevityFactor[] = [
  { key: 'sleep', label: 'Sleep', color: '#0ea5e9', description: 'Restorative rest and circadian alignment.' },
  { key: 'activity', label: 'Activity', color: '#f59e0b', description: 'Daily movement and exercise intensity.' },
  { key: 'nutrition', label: 'Nutrition', color: '#10b981', description: 'Whole food intake and nutrient density.' },
  { key: 'fasting', label: 'Fasting', color: '#06b6d4', description: 'Metabolic flexibility through time-restricted feeding.' },
];
