import type {
  MealLog,
  ActivityLog,
  SleepLog,
  MentalLog,
  LongevityBreakdown,
} from './longevityScore';
import { calculateLongevityScore } from './longevityScore';
import { safeGetItem } from './safeStorage';
import { bangkokDateStr } from './bangkokTime';

// ── 1. DAILY GOALS ─────────────────────────────────────────────────────────────

export interface DailyGoalItem {
  id: 'nutrition' | 'exercise' | 'sleep' | 'mental';
  titleKey: string;
  targetTextKey: string;
  completed: boolean;
  progress: number; // 0-100
  currentText?: string;
}

export interface DailyGoalsResult {
  items: DailyGoalItem[];
  completedCount: number;
  totalCount: number;
  isAllCompleted: boolean;
}

export const getDailyGoals = (): DailyGoalsResult => {
  const ts = new Date().setHours(0, 0, 0, 0);
  const meals = safeGetItem<MealLog[]>('meals', []);
  const activities = safeGetItem<ActivityLog[]>('activities', []);
  const sleepLogs = safeGetItem<SleepLog[]>('sleepLogs', []);
  const mentalLogs = safeGetItem<MentalLog[]>('mentalLogs', []);

  const todayMeals = meals.filter(m => new Date(m.timestamp).getTime() >= ts);
  const todayActivities = activities.filter(a => new Date(a.timestamp).getTime() >= ts);
  const todaySleep = sleepLogs.find(s => new Date(s.timestamp).getTime() >= ts);
  const todayMental = mentalLogs.find(m => new Date(m.timestamp).getTime() >= ts);

  const totalCalories = todayMeals.reduce((sum, m) => sum + (m.calories || 0), 0);
  const totalDuration = todayActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const sleepDuration = todaySleep ? todaySleep.duration : 0;

  const profile = safeGetItem<any>('profileData', {});
  const targetCalories = profile.targetCalories || 2000;
  const targetExercise = 30; // 30 min minimum daily goal
  const targetSleepMin = 7;

  // Nutrition completion: Logged at least 1 meal and within sensible calorie range or reached target
  const nutritionCompleted = todayMeals.length > 0 && totalCalories >= targetCalories * 0.5;
  const nutritionProgress = Math.min(100, Math.round((totalCalories / targetCalories) * 100));

  // Exercise completion: >= 30 min
  const exerciseCompleted = totalDuration >= targetExercise;
  const exerciseProgress = Math.min(100, Math.round((totalDuration / targetExercise) * 100));

  // Sleep completion: >= 7 hours
  const sleepCompleted = sleepDuration >= targetSleepMin;
  const sleepProgress = Math.min(100, Math.round((sleepDuration / targetSleepMin) * 100));

  // Mental check-in completion
  const mentalCompleted = !!todayMental;
  const mentalProgress = mentalCompleted ? 100 : 0;

  const items: DailyGoalItem[] = [
    {
      id: 'nutrition',
      titleKey: 'goal.caloriesTitle',
      targetTextKey: 'goal.caloriesTarget',
      completed: nutritionCompleted,
      progress: nutritionProgress,
      currentText: `${totalCalories} / ${targetCalories} kcal`,
    },
    {
      id: 'exercise',
      titleKey: 'goal.exerciseTitle',
      targetTextKey: 'goal.exerciseTarget',
      completed: exerciseCompleted,
      progress: exerciseProgress,
      currentText: `${totalDuration} / ${targetExercise} min`,
    },
    {
      id: 'sleep',
      titleKey: 'goal.sleepTitle',
      targetTextKey: 'goal.sleepTarget',
      completed: sleepCompleted,
      progress: sleepProgress,
      currentText: `${sleepDuration.toFixed(1)} / ${targetSleepMin} hrs`,
    },
    {
      id: 'mental',
      titleKey: 'goal.mentalTitle',
      targetTextKey: 'goal.mentalTarget',
      completed: mentalCompleted,
      progress: mentalProgress,
      currentText: mentalCompleted ? (todayMental?.note || todayMental?.mood || 'Logged') : 'Not logged',
    },
  ];

  const completedCount = items.filter(i => i.completed).length;

  return {
    items,
    completedCount,
    totalCount: 4,
    isAllCompleted: completedCount === 4,
  };
};

// ── 2. HEALTH STREAK ───────────────────────────────────────────────────────────

export interface HealthStreakResult {
  streakDays: number;
  isTodayCompleted: boolean;
  lastLoggedDate: string | null;
}

export const getHealthStreak = (): HealthStreakResult => {
  const goals = getDailyGoals();
  const isTodayCompleted = goals.completedCount === 4;

  const storedStreak = parseInt(localStorage.getItem('healthStreakDays') || '1', 10);
  const lastLogged = localStorage.getItem('lastStreakDate') || null;
  const todayStr = bangkokDateStr(); // QA-004

  // If today is completed and not yet logged as streak update
  if (isTodayCompleted && lastLogged !== todayStr) {
    let newStreak = storedStreak;
    if (lastLogged) {
      const lastDate = new Date(lastLogged);
      const todayDate = new Date(todayStr);
      const diffDays = Math.round((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        newStreak += 1;
      } else if (diffDays > 1) {
        newStreak = 1; // Reset if gap > 1 day
      }
    } else {
      newStreak = Math.max(1, storedStreak);
    }
    localStorage.setItem('healthStreakDays', newStreak.toString());
    localStorage.setItem('lastStreakDate', todayStr);
    return { streakDays: newStreak, isTodayCompleted: true, lastLoggedDate: todayStr };
  }

  return {
    streakDays: storedStreak,
    isTodayCompleted,
    lastLoggedDate: lastLogged || todayStr,
  };
};

// ── 3. WEEKLY CHALLENGES ──────────────────────────────────────────────────────

export interface WeeklyChallengeItem {
  id: string;
  titleKey: string;
  descKey: string;
  progress: number; // 0-100
  currentVal: number;
  targetVal: number;
  unitKey: string;
  completed: boolean;
}

export const getWeeklyChallenges = (): WeeklyChallengeItem[] => {
  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const activities = safeGetItem<ActivityLog[]>('activities', []);
  const sleepLogs = safeGetItem<SleepLog[]>('sleepLogs', []);
  const mentalLogs = safeGetItem<MentalLog[]>('mentalLogs', []);
  const meals = safeGetItem<MealLog[]>('meals', []);

  const weekActivities = activities.filter(a => new Date(a.timestamp).getTime() >= sevenDaysAgo);
  const weekSleep = sleepLogs.filter(s => new Date(s.timestamp).getTime() >= sevenDaysAgo);
  const weekMental = mentalLogs.filter(m => new Date(m.timestamp).getTime() >= sevenDaysAgo);
  const weekMeals = meals.filter(m => new Date(m.timestamp).getTime() >= sevenDaysAgo);

  const totalExerciseMin = weekActivities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const sleepBefore23Count = weekSleep.filter(s => {
    const d = new Date(s.timestamp);
    return d.getHours() <= 23 || d.getHours() <= 4;
  }).length;

  const uniqueMentalDays = new Set(weekMental.map(m => new Date(m.timestamp).toISOString().split('T')[0])).size;
  const uniqueMealDays = new Set(weekMeals.map(m => new Date(m.timestamp).toISOString().split('T')[0])).size;

  return [
    {
      id: 'ex150',
      titleKey: 'challenge.ex150Title',
      descKey: 'challenge.ex150Desc',
      progress: Math.min(100, Math.round((totalExerciseMin / 150) * 100)),
      currentVal: totalExerciseMin,
      targetVal: 150,
      unitKey: 'challenge.minUnit',
      completed: totalExerciseMin >= 150,
    },
    {
      id: 'sleep23',
      titleKey: 'challenge.sleep23Title',
      descKey: 'challenge.sleep23Desc',
      progress: Math.min(100, Math.round((sleepBefore23Count / 5) * 100)),
      currentVal: sleepBefore23Count,
      targetVal: 5,
      unitKey: 'challenge.daysUnit',
      completed: sleepBefore23Count >= 5,
    },
    {
      id: 'cal5d',
      titleKey: 'challenge.cal5dTitle',
      descKey: 'challenge.cal5dDesc',
      progress: Math.min(100, Math.round((uniqueMealDays / 5) * 100)),
      currentVal: uniqueMealDays,
      targetVal: 5,
      unitKey: 'challenge.daysUnit',
      completed: uniqueMealDays >= 5,
    },
    {
      id: 'mental7d',
      titleKey: 'challenge.mental7dTitle',
      descKey: 'challenge.mental7dDesc',
      progress: Math.min(100, Math.round((uniqueMentalDays / 7) * 100)),
      currentVal: uniqueMentalDays,
      targetVal: 7,
      unitKey: 'challenge.daysUnit',
      completed: uniqueMentalDays >= 7,
    },
  ];
};

// ── 4. ACHIEVEMENTS & BADGES ──────────────────────────────────────────────────

export interface BadgeItem {
  id: string;
  icon: string;
  titleKey: string;
  descKey: string;
  unlocked: boolean;
  progress: number; // 0-100
}

export const getAchievements = (): BadgeItem[] => {
  const meals = safeGetItem<MealLog[]>('meals', []);
  const activities = safeGetItem<ActivityLog[]>('activities', []);
  const sleepLogs = safeGetItem<SleepLog[]>('sleepLogs', []);

  const uniqueActiveDays = new Set([
    ...meals.map(m => new Date(m.timestamp).toISOString().split('T')[0]),
    ...activities.map(a => new Date(a.timestamp).toISOString().split('T')[0]),
    ...sleepLogs.map(s => new Date(s.timestamp).toISOString().split('T')[0]),
  ]).size;

  const totalExMin = activities.reduce((sum, a) => sum + (a.duration || 0), 0);
  const goodSleepDays = sleepLogs.filter(s => s.duration >= 7).length;
  const goodMealDays = new Set(meals.map(m => new Date(m.timestamp).toISOString().split('T')[0])).size;

  return [
    {
      id: 'log7d',
      icon: '🏅',
      titleKey: 'badge.log7dTitle',
      descKey: 'badge.log7dDesc',
      unlocked: uniqueActiveDays >= 7,
      progress: Math.min(100, Math.round((uniqueActiveDays / 7) * 100)),
    },
    {
      id: 'ex100m',
      icon: '🏋️',
      titleKey: 'badge.ex100Title',
      descKey: 'badge.ex100Desc',
      unlocked: totalExMin >= 100,
      progress: Math.min(100, Math.round((totalExMin / 100) * 100)),
    },
    {
      id: 'sleep10d',
      icon: '🛌',
      titleKey: 'badge.sleep10dTitle',
      descKey: 'badge.sleep10dDesc',
      unlocked: goodSleepDays >= 10,
      progress: Math.min(100, Math.round((goodSleepDays / 100) * 100)),
    },
    {
      id: 'cal7d',
      icon: '🥗',
      titleKey: 'badge.cal7dTitle',
      descKey: 'badge.cal7dDesc',
      unlocked: goodMealDays >= 7,
      progress: Math.min(100, Math.round((goodMealDays / 7) * 100)),
    },
  ];
};

// ── 5. LONGEVITY INDEX & LEVEL ────────────────────────────────────────────────

export type LongevityLevel = 'Beginner' | 'Healthy' | 'Excellent' | 'Elite';

export interface LongevityIndexResult {
  score: number;
  level: LongevityLevel;
  levelKey: string;
  healthAge: number;
  realAge: number;
  ageDelta: number; // e.g. -5 means 5 years younger
  trend: 'up' | 'down' | 'stable';
  trendPercent: number;
}

export const getLongevityIndex = (currentScore?: LongevityBreakdown): LongevityIndexResult => {
  const scoreObj = currentScore || calculateLongevityScore();
  const total = scoreObj.total;

  let level: LongevityLevel = 'Beginner';
  let levelKey = 'index.levelBeginner';
  let ageOffset = +4;

  if (total >= 85) {
    level = 'Elite';
    levelKey = 'index.levelElite';
    ageOffset = -7;
  } else if (total >= 70) {
    level = 'Excellent';
    levelKey = 'index.levelExcellent';
    ageOffset = -4;
  } else if (total >= 50) {
    level = 'Healthy';
    levelKey = 'index.levelHealthy';
    ageOffset = -1;
  }

  const profile = safeGetItem<any>('profileData', {});
  let realAge = profile.age || 35;
  if (profile.birthDate) {
    const diff = Date.now() - new Date(profile.birthDate).getTime();
    const calcAge = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
    if (calcAge > 10 && calcAge < 120) realAge = calcAge;
  }

  const healthAge = Math.max(18, realAge + (total === 0 ? 0 : ageOffset));

  const yesterdayTotal = parseFloat(localStorage.getItem('yesterdayScore') || `${total}`);
  let trend: 'up' | 'down' | 'stable' = 'stable';
  let trendPercent = 0;

  if (total > yesterdayTotal + 1) {
    trend = 'up';
    trendPercent = Math.round(((total - yesterdayTotal) / Math.max(1, yesterdayTotal)) * 100);
  } else if (total < yesterdayTotal - 1) {
    trend = 'down';
    trendPercent = Math.round(((yesterdayTotal - total) / Math.max(1, yesterdayTotal)) * 100);
  }

  return {
    score: total,
    level,
    levelKey,
    healthAge,
    realAge,
    ageDelta: healthAge - realAge,
    trend,
    trendPercent,
  };
};

// ── 6. AI HEALTH COACH & INSIGHTS ─────────────────────────────────────────────

export interface AICoachAdvice {
  summaryTitle: string;
  summaryText: string;
  recommendations: {
    pillar: 'nutrition' | 'exercise' | 'sleep' | 'mental';
    type: 'praise' | 'action';
    text: string;
  }[];
}

export const getAICoachAdvice = (lang: string, currentScore?: LongevityBreakdown): AICoachAdvice => {
  const score = currentScore || calculateLongevityScore();
  const isTh = lang === 'th';

  const recommendations: AICoachAdvice['recommendations'] = [];

  // Sleep analysis
  if (score.sleep >= 20) {
    recommendations.push({
      pillar: 'sleep',
      type: 'praise',
      text: isTh
        ? 'คุณภาพการนอนของคุณดีเยี่ยม รักษาตารางเวลาเข้านอนที่สม่ำเสมอนี้ไว้'
        : 'Your sleep duration and rest cycles are excellent. Maintain this steady bedtime schedule.',
    });
  } else if (score.sleep < 15) {
    recommendations.push({
      pillar: 'sleep',
      type: 'action',
      text: isTh
        ? 'วันนี้คุณนอนน้อยกว่าเป้าหมาย แนะนำให้เข้านอนเร็วขึ้นประมาณ 45-60 นาที เพื่อเพิ่มคะแนนการฟื้นฟูในวันพรุ่งนี้'
        : 'Your sleep duration was lower than optimal. We recommend winding down 45-60 minutes earlier tonight to boost cellular recovery.',
    });
  }

  // Nutrition analysis
  if (score.nutrition >= 20) {
    recommendations.push({
      pillar: 'nutrition',
      type: 'praise',
      text: isTh
        ? 'การกินวันนี้มีความสมดุลและพลังงานพอเหมาะ เป็นเกราะป้องกันการเสื่อมของเซลล์ที่ดี'
        : 'Your nutrition balance and caloric density today are right on target for optimal cellular health.',
    });
  } else if (score.nutrition < 15) {
    recommendations.push({
      pillar: 'nutrition',
      type: 'action',
      text: isTh
        ? 'ช่วงนี้การกินยังต่ำกว่าเป้า ลองเพิ่มผักใบเขียวหรือโปรตีนคุณภาพสูงในมื้อถัดไป หรือดื่มน้ำให้เพียงพอ'
        : 'Nutrition score could be improved. Try incorporating leafy greens or lean protein in your next meal, and stay hydrated.',
    });
  }

  // Exercise analysis
  if (score.exercise >= 20) {
    recommendations.push({
      pillar: 'exercise',
      type: 'praise',
      text: isTh
        ? 'การออกกำลังกายและการขยับร่างกายวันนี้ถึงเป้าหมายแล้ว! ช่วยกระตุ้นระบบเผาผลาญได้อย่างยอดเยี่ยม'
        : 'You reached your active movement target today! This promotes cardiovascular resilience and metabolic health.',
    });
  } else if (score.exercise < 15) {
    recommendations.push({
      pillar: 'exercise',
      type: 'action',
      text: isTh
        ? 'การเคลื่อนไหวร่างกายยังน้อยอยู่ ลองเดินเร็วหรือยืดเหยียดร่างกายเบาๆ อีก 15-20 นาทีก่อนช่วงเย็น'
        : 'Active movement is slightly low today. A 15-20 minute brisk walk or stretching routine will elevate your endurance score.',
    });
  }

  // Mental analysis
  if (score.mental >= 20) {
    recommendations.push({
      pillar: 'mental',
      type: 'praise',
      text: isTh
        ? 'สุขภาพจิตและระดับความเครียดของคุณอยู่ในเกณฑ์ดีมาก รักษาความรู้สึกเชิงบวกนี้ไว้'
        : 'Your mood resilience and stress control look fantastic today. Keep up the mindfulness practices.',
    });
  } else if (score.mental < 15) {
    recommendations.push({
      pillar: 'mental',
      type: 'action',
      text: isTh
        ? 'คุณอาจมีภาวะความเครียดหรือความเหนื่อยล้าสะสม แนะนำให้พักสายตา ฝึกหายใจลึกๆ 5 นาที หรือฟังเพลงผ่อนคลาย'
        : 'You may be experiencing mental stress or fatigue. Take 5 minutes for deep breathing exercises or quiet mindfulness.',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      pillar: 'nutrition',
      type: 'action',
      text: isTh
        ? 'เริ่มต้นวันใหม่ด้วยการบันทึกมื้ออาหาร การนอน และการออกกำลังกาย เพื่อให้ AI ประเมินแผนสุขภาพของคุณ'
        : 'Start your day by logging your meals, sleep, and workouts so our AI can craft your personalized health roadmap.',
    });
  }

  const summaryTitle = isTh ? 'AI โค้ชวิเคราะห์สุขภาพส่วนบุคคล' : 'Personalized AI Health Coach';
  const summaryText = isTh
    ? `จากการวิเคราะห์ 4 ด้านหลัก (การกิน, การออกกำลังกาย, การนอน, สุขภาพจิต) วันนี้คุณมีคะแนนรวม ${score.total}/100 เรามีคำแนะนำเฉพาะสำหรับคุณดังนี้`
    : `Based on your 4 core longevity pillars (Eating, Exercise, Sleep, Mental Health), your total score today is ${score.total}/100. Here are your personalized recommendations:`;

  return { summaryTitle, summaryText, recommendations };
};

// ── 7. TIMELINE ───────────────────────────────────────────────────────────────

export interface TimelineEvent {
  id: string;
  time: string;
  title: string;
  pillar: 'nutrition' | 'exercise' | 'sleep' | 'mental';
  detail: string;
  icon: string;
}

export const getTodayTimeline = (lang: string): TimelineEvent[] => {
  const isTh = lang === 'th';
  const ts = new Date().setHours(0, 0, 0, 0);
  const events: TimelineEvent[] = [];

  const meals = safeGetItem<MealLog[]>('meals', []);
  const activities = safeGetItem<ActivityLog[]>('activities', []);
  const sleepLogs = safeGetItem<SleepLog[]>('sleepLogs', []);
  const mentalLogs = safeGetItem<MentalLog[]>('mentalLogs', []);

  meals.filter(m => new Date(m.timestamp).getTime() >= ts).forEach((m, idx) => {
    const d = new Date(m.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    events.push({
      id: `meal-${idx}`,
      time: timeStr,
      title: isTh ? 'บันทึกมื้ออาหาร' : 'Meal Logged',
      pillar: 'nutrition',
      detail: `${m.calories || 0} kcal (${isTh ? 'คะแนนสุขภาพ' : 'Score'}: ${m.healthScore || 0}/10)`,
      icon: '🍴',
    });
  });

  activities.filter(a => new Date(a.timestamp).getTime() >= ts).forEach((a, idx) => {
    const d = new Date(a.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    events.push({
      id: `act-${idx}`,
      time: timeStr,
      title: isTh ? 'ออกกำลังกาย / ขยับร่างกาย' : 'Physical Activity',
      pillar: 'exercise',
      detail: `${a.duration || 0} ${isTh ? 'นาที' : 'minutes'}`,
      icon: '🏋️',
    });
  });

  sleepLogs.filter(s => new Date(s.timestamp).getTime() >= ts).forEach((s, idx) => {
    const d = new Date(s.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    events.push({
      id: `sleep-${idx}`,
      time: timeStr,
      title: isTh ? 'บันทึกการนอนหลับ' : 'Sleep Logged',
      pillar: 'sleep',
      detail: `${s.duration || 0} ${isTh ? 'ชั่วโมง' : 'hrs'} (${isTh ? 'คุณภาพ' : 'Quality'}: ${s.quality || 0}/10)`,
      icon: '🛌',
    });
  });

  mentalLogs.filter(m => new Date(m.timestamp).getTime() >= ts).forEach((m, idx) => {
    const d = new Date(m.timestamp);
    const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    events.push({
      id: `mental-${idx}`,
      time: timeStr,
      title: isTh ? 'เช็คอินสุขภาพจิต' : 'Mental Check-in',
      pillar: 'mental',
      detail: `${isTh ? 'อารมณ์' : 'Mood'}: ${m.mood} | ${isTh ? 'ความเครียด' : 'Stress'}: ${m.stress}/10`,
      icon: '🧠',
    });
  });

  events.sort((a, b) => a.time.localeCompare(b.time));
  return events;
};

// ── 8. WATER TRACKING ─────────────────────────────────────────────────────────

export interface WaterLog {
  date: string;
  glasses: number; // 1 glass = 250ml
  ml: number;
  targetMl: number;
}

export const getTodayWater = (): WaterLog => {
  const todayStr = bangkokDateStr(); // 00:00 Asia/Bangkok, not UTC (QA-004)
  const logs = safeGetItem<Record<string, WaterLog>>('waterLogs', {});
  if (logs[todayStr]) {
    return logs[todayStr];
  }
  return { date: todayStr, glasses: 0, ml: 0, targetMl: 2000 };
};

export const saveTodayWater = (glassesToAdd: number): WaterLog => {
  const todayStr = bangkokDateStr(); // QA-004
  const logs = safeGetItem<Record<string, WaterLog>>('waterLogs', {});
  const current = logs[todayStr] || { date: todayStr, glasses: 0, ml: 0, targetMl: 2000 };

  const newGlasses = Math.max(0, current.glasses + glassesToAdd);
  const newMl = newGlasses * 250;

  const updated: WaterLog = {
    ...current,
    glasses: newGlasses,
    ml: newMl,
  };

  logs[todayStr] = updated;
  localStorage.setItem('waterLogs', JSON.stringify(logs));
  window.dispatchEvent(new Event('healthDataUpdated'));
  return updated;
};

// ── 9. MOOD HISTORY ───────────────────────────────────────────────────────────

export interface MoodHistoryItem {
  id: string;
  dateStr: string;
  timeStr: string;
  mood: string;
  stress: number;
  energy: number;
  note: string;
  timestamp: string;
}

export const getMoodHistory = (): MoodHistoryItem[] => {
  const mentalLogs = safeGetItem<MentalLog[]>('mentalLogs', []);
  return mentalLogs
    .map((m, idx) => {
      const d = new Date(m.timestamp);
      return {
        id: `mood-${idx}-${m.timestamp}`,
        dateStr: d.toLocaleDateString(),
        timeStr: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        mood: m.mood,
        stress: m.stress,
        energy: m.energy,
        note: m.note || '',
        timestamp: m.timestamp,
      };
    })
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

// ── 10. HEALTH CALENDAR ───────────────────────────────────────────────────────

export interface CalendarDayItem {
  dateStr: string; // YYYY-MM-DD
  dayNum: number;
  score: number;
  status: 'good' | 'medium' | 'bad' | 'empty';
  nutrition: number;
  exercise: number;
  sleep: number;
  mental: number;
}

export const getHealthCalendar = (daysCount = 30): CalendarDayItem[] => {
  const items: CalendarDayItem[] = [];
  const today = new Date();
  const historicalScores = safeGetItem<Record<string, LongevityBreakdown>>('historicalScoresMap', {});

  const todayStr = today.toISOString().split('T')[0];
  historicalScores[todayStr] = calculateLongevityScore();
  localStorage.setItem('historicalScoresMap', JSON.stringify(historicalScores));

  for (let i = daysCount - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    const scoreObj = historicalScores[dateStr];

    let score = 0;
    let nutrition = 0;
    let exercise = 0;
    let sleep = 0;
    let mental = 0;
    let status: 'good' | 'medium' | 'bad' | 'empty' = 'empty';

    if (scoreObj && scoreObj.total > 0) {
      score = scoreObj.total;
      nutrition = scoreObj.nutrition;
      exercise = scoreObj.exercise || scoreObj.activity;
      sleep = scoreObj.sleep;
      mental = scoreObj.mental;

      if (score >= 80) status = 'good';
      else if (score >= 50) status = 'medium';
      else status = 'bad';
    }

    items.push({
      dateStr,
      dayNum: d.getDate(),
      score,
      status,
      nutrition,
      exercise,
      sleep,
      mental,
    });
  }

  return items;
};

// ── 11. WEEKLY AI REPORT ──────────────────────────────────────────────────────

export interface WeeklyAIReportResult {
  avgTotal: number;
  avgNutrition: number;
  avgExercise: number;
  avgSleep: number;
  avgMental: number;
  summaryText: string;
  bestPillarLabel: string;
}

export const getWeeklyAIReport = (lang: string): WeeklyAIReportResult => {
  const calendar = getHealthCalendar(7).filter(d => d.score > 0);
  const isTh = lang === 'th';

  if (calendar.length === 0) {
    return {
      avgTotal: 0,
      avgNutrition: 0,
      avgExercise: 0,
      avgSleep: 0,
      avgMental: 0,
      summaryText: isTh
        ? 'ยังไม่มีข้อมูลเพียงพอในรอบ 7 วันที่ผ่านมา เริ่มต้นบันทึกสุขภาพทั้ง 4 ด้านเพื่อให้ AI สรุปรายงานสัปดาห์นี้ให้คุณ'
        : 'Not enough data across the past 7 days. Start logging your 4 core pillars to unlock your Weekly AI Health Summary.',
      bestPillarLabel: '-',
    };
  }

  const count = calendar.length;
  const avgTotal = Math.round(calendar.reduce((sum, d) => sum + d.score, 0) / count);
  const avgNutrition = Math.round(calendar.reduce((sum, d) => sum + d.nutrition, 0) / count);
  const avgExercise = Math.round(calendar.reduce((sum, d) => sum + d.exercise, 0) / count);
  const avgSleep = Math.round(calendar.reduce((sum, d) => sum + d.sleep, 0) / count);
  const avgMental = Math.round(calendar.reduce((sum, d) => sum + d.mental, 0) / count);

  const pillars = [
    { key: 'nutrition', val: avgNutrition, label: isTh ? 'การกิน' : 'Eating' },
    { key: 'exercise', val: avgExercise, label: isTh ? 'การออกกำลังกาย' : 'Exercise' },
    { key: 'sleep', val: avgSleep, label: isTh ? 'การนอนหลับ' : 'Sleep' },
    { key: 'mental', val: avgMental, label: isTh ? 'สุขภาพจิต' : 'Mental Health' },
  ].sort((a, b) => b.val - a.val);

  const best = pillars[0];
  const worst = pillars[3];

  const summaryText = isTh
    ? `ในรอบ 7 วันที่ผ่านมา คะแนนสุขภาพเฉลี่ยของคุณคือ ${avgTotal}/100 จุดเด่นที่ทำได้ดีที่สุดคือด้าน${best.label} (เฉลี่ย ${best.val}/25) ขณะที่ด้าน${worst.label} มีคะแนนเฉลี่ย ${worst.val}/25 ควรให้ความสำคัญเพิ่มเติมในสัปดาห์หน้า`
    : `Over the past 7 days, your overall longevity score averaged ${avgTotal}/100. Your strongest performance was in ${best.label} (avg ${best.val}/25), while ${worst.label} averaged ${worst.val}/25 and represents your primary opportunity for next week.`;

  return {
    avgTotal,
    avgNutrition,
    avgExercise,
    avgSleep,
    avgMental,
    summaryText,
    bestPillarLabel: best.label,
  };
};
