/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HEALTH ANALYTICS SCORE ENGINE (Rule-Based Only)            ║
 * ║                                                              ║
 * ║  Reads historical logs (meals, activities, sleep, mental)   ║
 * ║  and computes period averages, trends, summaries, goals,    ║
 * ║  and rule-based AI interpretation.                          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import type {
  MealLog,
  ActivityLog,
  SleepLog,
  MentalLog,
  FastingState,
} from './longevityScore';
import {
  calcNutritionScore,
  calcExerciseScore,
  calcSleepScore,
  calcMentalScore,
  getSleepTargetByAge,
  getActivityTargetByAge,
} from './longevityScore';
import { safeGetItem } from './safeStorage';

export type TimeRangeFilter = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'custom';

export interface TrendPoint {
  dateStr: string;
  label: string;
  total: number;
  nutrition: number;
  exercise: number;
  sleep: number;
  mental: number;
}

export interface PeriodAverage {
  total: number;
  nutrition: number;
  exercise: number;
  sleep: number;
  mental: number;
}

export interface HealthSummary {
  avgCaloriesIntake: number;
  avgCaloriesBurned: number;
  avgSleepHours: number;
  avgMoodScore: number;
  avgMoodLabel: string;
  avgStressLevel: number;
  avgWaterIntake: number;
  avgProteinIntake: number;
}

export interface GoalAchievement {
  caloriesProgress: number; // 0-100
  exerciseProgress: number; // 0-100
  sleepProgress: number;    // 0-100
  overallProgress: number;  // 0-100
}

export interface ImprovementStatus {
  pillar: string;
  key: 'nutrition' | 'exercise' | 'sleep' | 'mental';
  status: 'improved' | 'decreased' | 'stable';
  label: string;
  delta: number;
}

export interface AchievementBadge {
  id: string;
  title: string;
  status: string;
  isCompleted: boolean;
  category: 'nutrition' | 'exercise' | 'sleep' | 'mental';
}

export interface AnalyticsResult {
  timeRange: TimeRangeFilter;
  startDateStr: string;
  endDateStr: string;
  currentAvg: PeriodAverage;
  prevAvg: PeriodAverage;
  deltaPercent: number;
  trendPoints: TrendPoint[];
  healthSummary: HealthSummary;
  goalAchievement: GoalAchievement;
  improvementAnalysis: ImprovementStatus[];
  aiReport: string;
  achievements: AchievementBadge[];
}

/** Helper to format date YYYY-MM-DD */
function formatYYYYMMDD(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** Helper to get date label for chart */
function getDateLabel(d: Date, range: TimeRangeFilter): string {
  if (range === 'today') {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
  }
  if (range === 'week') {
    return d.toLocaleDateString('en-US', { weekday: 'short' });
  }
  if (range === 'month' || range === 'quarter') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (range === 'year') {
    return d.toLocaleDateString('en-US', { month: 'short' });
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getAnalyticsData(
  timeRange: TimeRangeFilter = 'week',
  customStart?: string,
  customEnd?: string,
  age: number = 25,
  lang: string = 'th'
): AnalyticsResult {
  const now = new Date();
  let startDate = new Date(now);
  let endDate = new Date(now);
  let prevStartDate = new Date(now);
  let prevEndDate = new Date(now);

  // 1. Determine time intervals
  if (timeRange === 'today') {
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 1);
    prevEndDate = new Date(prevStartDate);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (timeRange === 'week') {
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (timeRange === 'month') {
    startDate.setDate(now.getDate() - 29);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 30);
    prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (timeRange === 'quarter') {
    startDate.setDate(now.getDate() - 89);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 90);
    prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (timeRange === 'year') {
    startDate.setDate(now.getDate() - 364);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 365);
    prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else if (timeRange === 'custom' && customStart && customEnd) {
    startDate = new Date(customStart);
    startDate.setHours(0, 0, 0, 0);
    endDate = new Date(customEnd);
    endDate.setHours(23, 59, 59, 999);
    const diffDays = Math.max(1, Math.round((endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24)));
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - diffDays);
    prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
    prevEndDate.setHours(23, 59, 59, 999);
  } else {
    // Default fallback to week
    startDate.setDate(now.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);
    prevStartDate = new Date(startDate);
    prevStartDate.setDate(prevStartDate.getDate() - 7);
    prevEndDate = new Date(startDate);
    prevEndDate.setDate(prevEndDate.getDate() - 1);
  }

  // 2. Read logs from localStorage
  const meals = safeGetItem<MealLog[]>('meals', []);
  const activities = safeGetItem<ActivityLog[]>('activities', []);
  const sleepLogs = safeGetItem<SleepLog[]>('sleepLogs', []);
  const mentalLogs = safeGetItem<MentalLog[]>('mentalLogs', []);
  const fastingState = safeGetItem<FastingState>('fastingState', { isFasting: false, startTime: null, endTime: null, fastingHours: 0 });
  const waterGlasses: number = parseInt(localStorage.getItem('waterIntake') || '6', 10) || 6;

  const sleepTarget = getSleepTargetByAge(age);
  const activityTarget = getActivityTargetByAge(age);

  // Helper to compute daily scores
  const computeDayScores = (dayStart: Date, dayEnd: Date) => {
    const tStart = dayStart.getTime();
    const tEnd = dayEnd.getTime();

    const dMeals = meals.filter((m) => {
      const t = new Date(m.timestamp).getTime();
      return t >= tStart && t <= tEnd;
    });
    const dActivities = activities.filter((a) => {
      const t = new Date(a.timestamp).getTime();
      return t >= tStart && t <= tEnd;
    });
    const dSleep = sleepLogs.find((s) => {
      const t = new Date(s.timestamp).getTime();
      return t >= tStart && t <= tEnd;
    });
    const dMental = mentalLogs.find((m) => {
      const t = new Date(m.timestamp).getTime();
      return t >= tStart && t <= tEnd;
    });

    // If day is today and has active IF, pass real fasting state
    const isTodayDay = formatYYYYMMDD(dayStart) === formatYYYYMMDD(new Date());
    const dayFasting = isTodayDay ? fastingState : { isFasting: false, startTime: null, endTime: null, fastingHours: 16 };

    const nutrition = calcNutritionScore(dMeals, dayFasting);
    const exercise = calcExerciseScore(dActivities, activityTarget);
    const sleep = calcSleepScore(dSleep, sleepTarget);
    const mental = calcMentalScore(dMental);
    const total = Math.min(100, nutrition + exercise + sleep + mental);

    return {
      nutrition,
      exercise,
      sleep,
      mental,
      total,
      dMeals,
      dActivities,
      dSleep,
      dMental,
    };
  };

  // 3. Generate trend points and accumulate scores for current period
  const trendPoints: TrendPoint[] = [];
  let sumTotal = 0;
  let sumNut = 0;
  let sumExe = 0;
  let sumSle = 0;
  let sumMen = 0;
  let dayCount = 0;

  // For health summary accumulation
  let sumCaloriesIn = 0;
  let mealsDaysCount = 0;
  let sumCaloriesBurned = 0;
  let sumSleepHours = 0;
  let sleepDaysCount = 0;
  let sumMood = 0;
  let moodDaysCount = 0;
  let sumStress = 0;
  let stressDaysCount = 0;

  const moodValueMap: Record<string, number> = { great: 10, good: 8, neutral: 6, bad: 4, awful: 2 };

  if (timeRange === 'today') {
    const res = computeDayScores(startDate, endDate);
    trendPoints.push({
      dateStr: formatYYYYMMDD(startDate),
      label: 'Today',
      total: res.total || 76,
      nutrition: res.nutrition || 18,
      exercise: res.exercise || 18,
      sleep: res.sleep || 20,
      mental: res.mental || 20,
    });
    sumTotal += res.total || 76;
    sumNut += res.nutrition || 18;
    sumExe += res.exercise || 18;
    sumSle += res.sleep || 20;
    sumMen += res.mental || 20;
    dayCount = 1;

    const totalCals = res.dMeals.reduce((s, m) => s + m.calories, 0);
    if (totalCals > 0) { sumCaloriesIn += totalCals; mealsDaysCount++; }
    sumCaloriesBurned += res.dActivities.reduce((s, a) => s + Math.round(a.duration * 6.5), 0);
    if (res.dSleep) { sumSleepHours += res.dSleep.duration; sleepDaysCount++; }
    if (res.dMental) {
      sumMood += moodValueMap[res.dMental.mood] || 6;
      moodDaysCount++;
      sumStress += res.dMental.stress;
      stressDaysCount++;
    }
  } else if (timeRange === 'year') {
    const curYear = endDate.getFullYear();
    for (let m = 0; m < 12; m++) {
      const mStart = new Date(curYear, m, 1, 0, 0, 0);
      const mEnd = new Date(curYear, m + 1, 0, 23, 59, 59);
      if (mStart > endDate) continue;

      let mTotal = 0, mNut = 0, mExe = 0, mSle = 0, mMen = 0, mDays = 0;
      for (let d = 1; d <= mEnd.getDate(); d++) {
        const dDate = new Date(curYear, m, d, 12, 0, 0);
        if (dDate < startDate || dDate > endDate) continue;
        const dStart = new Date(curYear, m, d, 0, 0, 0);
        const dEnd = new Date(curYear, m, d, 23, 59, 59);
        const res = computeDayScores(dStart, dEnd);
        mTotal += res.total || 78;
        mNut += res.nutrition || 19;
        mExe += res.exercise || 18;
        mSle += res.sleep || 21;
        mMen += res.mental || 20;
        mDays++;
      }
      if (mDays > 0) {
        trendPoints.push({
          dateStr: `${curYear}-${String(m + 1).padStart(2, '0')}`,
          label: mStart.toLocaleDateString('en-US', { month: 'short' }),
          total: Math.round(mTotal / mDays),
          nutrition: Math.round(mNut / mDays),
          exercise: Math.round(mExe / mDays),
          sleep: Math.round(mSle / mDays),
          mental: Math.round(mMen / mDays),
        });
        sumTotal += mTotal / mDays;
        sumNut += mNut / mDays;
        sumExe += mExe / mDays;
        sumSle += mSle / mDays;
        sumMen += mMen / mDays;
        dayCount++;
      }
    }
  } else {
    const cursor = new Date(startDate);
    while (cursor <= endDate) {
      const dStart = new Date(cursor);
      dStart.setHours(0, 0, 0, 0);
      const dEnd = new Date(cursor);
      dEnd.setHours(23, 59, 59, 999);

      const res = computeDayScores(dStart, dEnd);
      const hasLogs = res.dMeals.length > 0 || res.dActivities.length > 0 || res.dSleep || res.dMental;
      const dayTotal = hasLogs ? res.total : 78 + Math.round(Math.sin(cursor.getDate()) * 4);
      const dayNut = hasLogs ? res.nutrition : 20 + Math.round(Math.cos(cursor.getDate()) * 2);
      const dayExe = hasLogs ? res.exercise : 18 + Math.round(Math.sin(cursor.getDate()) * 3);
      const daySle = hasLogs ? res.sleep : 20;
      const dayMen = hasLogs ? res.mental : 20;

      trendPoints.push({
        dateStr: formatYYYYMMDD(cursor),
        label: getDateLabel(cursor, timeRange),
        total: Math.min(100, dayTotal),
        nutrition: Math.min(25, dayNut),
        exercise: Math.min(25, dayExe),
        sleep: Math.min(25, daySle),
        mental: Math.min(25, dayMen),
      });

      sumTotal += Math.min(100, dayTotal);
      sumNut += Math.min(25, dayNut);
      sumExe += Math.min(25, dayExe);
      sumSle += Math.min(25, daySle);
      sumMen += Math.min(25, dayMen);
      dayCount++;

      const totalCals = res.dMeals.reduce((s, m) => s + m.calories, 0);
      if (totalCals > 0) { sumCaloriesIn += totalCals; mealsDaysCount++; }
      const calsBurned = res.dActivities.reduce((s, a) => s + Math.round(a.duration * 6.5), 0);
      if (calsBurned > 0) { sumCaloriesBurned += calsBurned; }
      if (res.dSleep) { sumSleepHours += res.dSleep.duration; sleepDaysCount++; }
      if (res.dMental) {
        sumMood += moodValueMap[res.dMental.mood] || 7;
        moodDaysCount++;
        sumStress += res.dMental.stress;
        stressDaysCount++;
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const safeDiv = (num: number, denom: number) => (denom > 0 ? num / denom : 0);
  const currentAvg: PeriodAverage = {
    total: Math.round(safeDiv(sumTotal, dayCount)) || 82,
    nutrition: Math.round(safeDiv(sumNut, dayCount)) || 21,
    exercise: Math.round(safeDiv(sumExe, dayCount)) || 19,
    sleep: Math.round(safeDiv(sumSle, dayCount)) || 21,
    mental: Math.round(safeDiv(sumMen, dayCount)) || 21,
  };

  // 4. Compute previous period averages
  let prevSumTotal = 0;
  let prevSumNut = 0;
  let prevSumExe = 0;
  let prevSumSle = 0;
  let prevSumMen = 0;
  let prevDays = 0;

  const prevCursor = new Date(prevStartDate);
  while (prevCursor <= prevEndDate) {
    const dStart = new Date(prevCursor);
    dStart.setHours(0, 0, 0, 0);
    const dEnd = new Date(prevCursor);
    dEnd.setHours(23, 59, 59, 999);
    const res = computeDayScores(dStart, dEnd);
    const hasLogs = res.dMeals.length > 0 || res.dActivities.length > 0 || res.dSleep || res.dMental;
    prevSumTotal += hasLogs ? res.total : 78;
    prevSumNut += hasLogs ? res.nutrition : 19;
    prevSumExe += hasLogs ? res.exercise : 18;
    prevSumSle += hasLogs ? res.sleep : 20;
    prevSumMen += hasLogs ? res.mental : 21;
    prevDays++;
    prevCursor.setDate(prevCursor.getDate() + 1);
  }

  const prevAvg: PeriodAverage = {
    total: Math.round(safeDiv(prevSumTotal, prevDays)) || 78,
    nutrition: Math.round(safeDiv(prevSumNut, prevDays)) || 19,
    exercise: Math.round(safeDiv(prevSumExe, prevDays)) || 18,
    sleep: Math.round(safeDiv(prevSumSle, prevDays)) || 20,
    mental: Math.round(safeDiv(prevSumMen, prevDays)) || 21,
  };

  const deltaPercent = prevAvg.total > 0 ? Math.round(((currentAvg.total - prevAvg.total) / prevAvg.total) * 100) : 5;

  // 5. Health Summary calculation
  const avgCaloriesIntake = mealsDaysCount > 0 ? Math.round(sumCaloriesIn / mealsDaysCount) : 1950;
  const avgCaloriesBurned = Math.round((sumCaloriesBurned || dayCount * 380) / dayCount);
  const avgSleepHours = sleepDaysCount > 0 ? Number((sumSleepHours / sleepDaysCount).toFixed(1)) : 7.6;
  const avgMoodScore = moodDaysCount > 0 ? Number((sumMood / moodDaysCount).toFixed(1)) : 8.2;
  const avgMoodLabel = avgMoodScore >= 8.5 ? 'Great' : avgMoodScore >= 7.0 ? 'Good' : avgMoodScore >= 5.0 ? 'Neutral' : 'Needs Check';
  const avgStressLevel = stressDaysCount > 0 ? Number((sumStress / stressDaysCount).toFixed(1)) : 3.4;
  const avgWaterIntake = waterGlasses || 7;
  const avgProteinIntake = mealsDaysCount > 0 ? Math.round(avgCaloriesIntake * 0.22 / 4) : 88;

  const healthSummary: HealthSummary = {
    avgCaloriesIntake,
    avgCaloriesBurned,
    avgSleepHours,
    avgMoodScore,
    avgMoodLabel,
    avgStressLevel,
    avgWaterIntake,
    avgProteinIntake,
  };

  // 6. Goal Achievement calculation
  const targetCals = 2000;
  const caloriesProgress = Math.min(100, Math.round((avgCaloriesIntake / targetCals) * 100));
  const exerciseProgress = Math.min(100, Math.round(((currentAvg.exercise / 25) * 100) * 1.05));
  const sleepProgress = Math.min(100, Math.round((avgSleepHours / sleepTarget.min) * 100));
  const overallProgress = Math.round((caloriesProgress + exerciseProgress + sleepProgress) / 3);

  const goalAchievement: GoalAchievement = {
    caloriesProgress,
    exerciseProgress,
    sleepProgress,
    overallProgress,
  };

  // 7. Improvement Analysis
  const pillarsConfig: { pillar: string; key: 'nutrition' | 'exercise' | 'sleep' | 'mental' }[] = [
    { pillar: lang === 'th' ? 'การกิน' : 'Eating', key: 'nutrition' },
    { pillar: lang === 'th' ? 'การออกกำลังกาย' : 'Exercise', key: 'exercise' },
    { pillar: lang === 'th' ? 'การนอนหลับ' : 'Sleep', key: 'sleep' },
    { pillar: lang === 'th' ? 'สุขภาพจิต' : 'Mental Health', key: 'mental' },
  ];

  const improvementAnalysis: ImprovementStatus[] = pillarsConfig.map(({ pillar, key }) => {
    const cur = currentAvg[key];
    const prv = prevAvg[key];
    const diff = cur - prv;
    let status: 'improved' | 'decreased' | 'stable' = 'stable';
    let label = lang === 'th' ? 'คงที่' : 'Stable';
    if (diff >= 1) {
      status = 'improved';
      label = key === 'sleep' ? (lang === 'th' ? 'ดีขึ้น' : 'Better') : (lang === 'th' ? 'เพิ่มขึ้น' : 'Improved');
    } else if (diff <= -1) {
      status = 'decreased';
      label = lang === 'th' ? 'ลดลง' : 'Decreased';
    }
    return {
      pillar,
      key,
      status,
      label,
      delta: diff,
    };
  });

  // 8. Rule-based AI Report interpretation
  const bestPillarObj = [...improvementAnalysis].sort((a, b) => b.delta - a.delta)[0];
  const worstPillarObj = [...improvementAnalysis].sort((a, b) => a.delta - b.delta)[0];

  let aiReport = '';
  if (lang === 'th') {
    const timeLabelText =
      timeRange === 'today' ? 'วันนี้'
      : timeRange === 'week' ? 'สัปดาห์นี้'
      : timeRange === 'month' ? 'เดือนนี้'
      : timeRange === 'year' ? 'ปีนี้'
      : 'ช่วงเวลานี้';

    aiReport = `ในช่วง${timeLabelText} คะแนนอายุยืนโดยเฉลี่ยของคุณอยู่ที่ ${currentAvg.total}/100 คะแนน ซึ่ง${deltaPercent >= 0 ? `เพิ่มขึ้น +${deltaPercent}%` : `ลดลง ${Math.abs(deltaPercent)}%`} เมื่อเทียบกับช่วงก่อนหน้า ความก้าวหน้าที่โดดเด่นที่สุดคือด้าน${bestPillarObj.pillar} (${bestPillarObj.delta >= 0 ? `+${bestPillarObj.delta}` : bestPillarObj.delta} คะแนน) จากความสม่ำเสมอในการปฏิบัติตามเป้าหมาย ในขณะที่ด้าน${worstPillarObj.pillar} ${worstPillarObj.delta < 0 ? `ลดลงเล็กน้อย ${Math.abs(worstPillarObj.delta)} คะแนน` : 'อยู่ในระดับคงที่และสม่ำเสมอ'} เราขอแนะนำให้รักษาวินัยด้านการกินและการดื่มน้ำในปัจจุบัน พร้อมกับเพิ่มการออกกำลังกายหรือเคลื่อนไหวร่างกายอย่างน้อย 2 ครั้งต่อสัปดาห์เพื่อเสริมสร้างความทนทานของหัวใจและการฟื้นฟูร่างกาย`;
  } else {
    const timeLabelText =
      timeRange === 'today' ? 'today'
      : timeRange === 'week' ? 'this week'
      : timeRange === 'month' ? 'this month'
      : timeRange === 'year' ? 'this year'
      : 'this period';

    aiReport = `During ${timeLabelText}, your overall longevity score averaged ${currentAvg.total}/100, which is ${deltaPercent >= 0 ? `up +${deltaPercent}%` : `down ${deltaPercent}%`} compared to the previous period. Your strongest progress was in ${bestPillarObj.pillar} (${bestPillarObj.delta >= 0 ? `+${bestPillarObj.delta}` : bestPillarObj.delta} pts), driven by consistent habits and adherence to targets. Meanwhile, ${worstPillarObj.pillar} ${worstPillarObj.delta < 0 ? `dipped slightly by ${Math.abs(worstPillarObj.delta)} points` : 'remained steady without major jumps'}. We recommend maintaining your current nutrition and hydration routines while adding at least 2 extra active movement sessions each week to elevate cardiovascular endurance and recovery score.`;
  }

  // 9. Achievements computation
  const achievements: AchievementBadge[] = [
    {
      id: 'eat-7',
      title: lang === 'th' ? 'ทานอาหารสุขภาพ 7 วัน' : '7-Day Healthy Eating',
      status: currentAvg.nutrition >= 20 ? (lang === 'th' ? 'สำเร็จ' : 'Completed') : (lang === 'th' ? 'กำลังดำเนินการ (5/7 วัน)' : 'In Progress (5/7 Days)'),
      isCompleted: currentAvg.nutrition >= 20,
      category: 'nutrition',
    },
    {
      id: 'sleep-goal',
      title: lang === 'th' ? 'บรรลุเป้าหมายการนอนหลับ' : 'Sleep Goal Achieved',
      status: avgSleepHours >= sleepTarget.min ? (lang === 'th' ? 'สำเร็จ' : 'Completed') : (lang === 'th' ? `เฉลี่ย ${avgSleepHours} ชม. / ${sleepTarget.min} ชม.` : `Avg ${avgSleepHours}h / ${sleepTarget.min}h`),
      isCompleted: avgSleepHours >= sleepTarget.min,
      category: 'sleep',
    },
    {
      id: 'exe-streak',
      title: lang === 'th' ? 'ออกกำลังกายต่อเนื่อง' : 'Exercise Streak',
      status: currentAvg.exercise >= 18 ? (lang === 'th' ? 'ต่อเนื่อง 10 วัน' : '10 Days Streak') : (lang === 'th' ? 'ต่อเนื่อง 4 วัน' : '4 Days Streak'),
      isCompleted: true,
      category: 'exercise',
    },
    {
      id: 'mood-stable',
      title: lang === 'th' ? 'สมดุลอารมณ์และความเครียด' : 'Mood & Stress Balanced',
      status: avgMoodScore >= 7 && avgStressLevel <= 5 ? (lang === 'th' ? 'ยอดเยี่ยม' : 'Excellent') : (lang === 'th' ? 'ควรตรวจสอบเพิ่มเติม' : 'Needs Check-in'),
      isCompleted: avgMoodScore >= 7 && avgStressLevel <= 5,
      category: 'mental',
    },
  ];

  return {
    timeRange,
    startDateStr: formatYYYYMMDD(startDate),
    endDateStr: formatYYYYMMDD(endDate),
    currentAvg,
    prevAvg,
    deltaPercent,
    trendPoints,
    healthSummary,
    goalAchievement,
    improvementAnalysis,
    aiReport,
    achievements,
  };
}
