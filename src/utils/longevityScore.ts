/**
 * Daily Longevity Score Calculator
 * Combines data from all four health pillars into a single 0-100 score
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
  nutrition: number;
  fasting: number;
  activity: number;
  sleep: number;
  total: number;
}

export const calculateLongevityScore = (): LongevityBreakdown => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayTimestamp = today.getTime();

  // Get today's data
  const meals: MealLog[] = JSON.parse(localStorage.getItem('meals') || '[]');
  const fastingState: FastingState = JSON.parse(localStorage.getItem('fastingState') || '{}');
  const activities: ActivityLog[] = JSON.parse(localStorage.getItem('activities') || '[]');
  const sleepLogs: SleepLog[] = JSON.parse(localStorage.getItem('sleepLogs') || '[]');

  // Filter for today's data
  const todayMeals = meals.filter(m => new Date(m.timestamp).getTime() >= todayTimestamp);
  const todayActivities = activities.filter(a => new Date(a.timestamp).getTime() >= todayTimestamp);
  const todaySleep = sleepLogs.find(s => new Date(s.timestamp).getTime() >= todayTimestamp);

  // Calculate Nutrition Score (0-25 points)
  const nutritionScore = calculateNutritionScore(todayMeals);

  // Calculate Fasting Score (0-25 points)
  const fastingScore = calculateFastingScore(fastingState);

  // Calculate Activity Score (0-25 points)
  const activityScore = calculateActivityScore(todayActivities);

  // Calculate Sleep Score (0-25 points)
  const sleepScore = calculateSleepScore(todaySleep);

  const total = Math.round(nutritionScore + fastingScore + activityScore + sleepScore);

  return {
    nutrition: Math.round(nutritionScore),
    fasting: Math.round(fastingScore),
    activity: Math.round(activityScore),
    sleep: Math.round(sleepScore),
    total: Math.min(total, 100)
  };
};

const calculateNutritionScore = (meals: MealLog[]): number => {
  if (meals.length === 0) return 0;

  // Base score for logging at least one meal (20 points)
  let score = 20;

  // Add up to 5 points based on average health score
  const avgHealthScore = meals.reduce((sum, m) => sum + m.healthScore, 0) / meals.length;
  score += (avgHealthScore / 100) * 5;

  return Math.min(score, 25);
};

const calculateFastingScore = (state: FastingState): number => {
  if (!state.startTime) return 0;

  const now = new Date();
  const startTime = new Date(state.startTime);
  const elapsedHours = (now.getTime() - startTime.getTime()) / (1000 * 60 * 60);

  // Scoring based on fasting protocol
  if (state.isFasting) {
    // Currently fasting - score based on progress
    const targetHours = state.fastingHours || 16;
    const progress = Math.min(elapsedHours / targetHours, 1);
    return progress * 25;
  } else if (state.endTime) {
    // Completed fast today
    const fastDuration = (new Date(state.endTime).getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (fastDuration >= 12) {
      // Full points for completing 12+ hour fast
      return 25;
    } else {
      return (fastDuration / 12) * 25;
    }
  }

  return 0;
};

const calculateActivityScore = (activities: ActivityLog[]): number => {
  if (activities.length === 0) return 0;

  const totalMinutes = activities.reduce((sum, a) => sum + a.duration, 0);

  // WHO recommends 150 minutes per week (21.4 min/day)
  // We'll score based on 30 min/day for better longevity
  const targetMinutes = 30;
  const progress = Math.min(totalMinutes / targetMinutes, 1);
  let score = progress * 20; // 20 points for duration

  // Bonus for variety (5 points)
  score += Math.min(activities.length * 2, 5);

  return Math.min(score, 25);
};

const calculateSleepScore = (sleepLog: SleepLog | undefined): number => {
  if (!sleepLog) return 0;

  // Optimal sleep: 7-9 hours
  const optimalMin = 7;
  const optimalMax = 9;
  const duration = sleepLog.duration;

  let durationScore = 0;
  if (duration >= optimalMin && duration <= optimalMax) {
    durationScore = 15; // Perfect duration
  } else if (duration >= 6 && duration <= 10) {
    // Close to optimal
    const distanceFromOptimal = Math.min(
      Math.abs(duration - optimalMin),
      Math.abs(duration - optimalMax)
    );
    durationScore = 15 - (distanceFromOptimal * 3);
  } else {
    // Poor duration
    durationScore = Math.max(0, 10 - Math.abs(duration - 8) * 2);
  }

  // Quality score (10 points)
  const qualityScore = (sleepLog.quality / 10) * 10;

  return Math.min(durationScore + qualityScore, 25);
};

export const getScoreColor = (score: number): string => {
  if (score >= 80) return '#22c55e'; // Excellent - Green
  if (score >= 60) return '#f59e0b'; // Good - Orange
  if (score >= 40) return '#fb923c'; // Fair - Light Orange
  return '#ef4444'; // Poor - Red
};

export const getScoreLabel = (score: number): string => {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
};
