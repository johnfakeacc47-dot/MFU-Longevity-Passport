/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  HEALTH ANALYTICS ENGINE                                     ║
 * ║                                                              ║
 * ║  Reads the per-day `health_scores` rollup rows from Supabase ║
 * ║  (score breakdown + daily aggregates) and derives period     ║
 * ║  averages, trends, the health summary, goal progress and a   ║
 * ║  rule-based interpretation. Days with no row = not tracked   ║
 * ║  (excluded from averages, absent from the trend line) — the  ║
 * ║  engine never fabricates numbers.                            ║
 * ║                                                              ║
 * ║  The real AI report lives in the `health-insights` Edge      ║
 * ║  Function; `aiReport` here is the offline fallback.          ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

import { calculateLongevityScore, getSleepTargetByAge } from './longevityScore';
import { getHealthHistory } from '../services/supabaseClient';
import { getTodayAggregates } from './dailyAggregates';
import { bangkokDateStr, addDaysStr, daysBetweenStr } from './bangkokTime';
import type { CalendarDayItem } from './healthCoach';

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
  sleepProgress: number; // 0-100
  overallProgress: number; // 0-100
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
  /** How many days in the current period actually have a logged row. */
  loggedDays: number;
  achievements: AchievementBadge[];
}

// ── health_scores row shape (historical column names: activity=exercise, fasting=mental) ──
interface ScoreRow {
  date: string;
  nutrition: number | null;
  sleep: number | null;
  activity: number | null;
  fasting: number | null;
  total: number | null;
  calories_in: number | null;
  calories_out: number | null;
  sleep_hours: number | null;
  water_glasses: number | null;
  protein_g: number | null;
  mood_score: number | null;
  stress_level: number | null;
}

interface DayPoint {
  dateStr: string;
  nutrition: number;
  exercise: number;
  sleep: number;
  mental: number;
  total: number;
  calories_in: number | null;
  calories_out: number | null;
  sleep_hours: number | null;
  water_glasses: number | null;
  protein_g: number | null;
  mood_score: number | null;
  stress_level: number | null;
}

const rowToDay = (r: ScoreRow): DayPoint => ({
  dateStr: r.date,
  nutrition: r.nutrition ?? 0,
  exercise: r.activity ?? 0,
  sleep: r.sleep ?? 0,
  mental: r.fasting ?? 0,
  total: r.total ?? 0,
  calories_in: r.calories_in,
  calories_out: r.calories_out,
  sleep_hours: r.sleep_hours,
  water_glasses: r.water_glasses,
  protein_g: r.protein_g,
  mood_score: r.mood_score,
  stress_level: r.stress_level,
});

const RANGE_DAYS: Record<Exclude<TimeRangeFilter, 'custom'>, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

function periodBounds(
  timeRange: TimeRangeFilter,
  customStart?: string,
  customEnd?: string,
): { from: string; to: string; prevFrom: string; prevTo: string } {
  const today = bangkokDateStr();

  if (timeRange === 'custom' && customStart && customEnd) {
    const span = Math.max(1, daysBetweenStr(customStart, customEnd));
    return {
      from: customStart,
      to: customEnd,
      prevFrom: addDaysStr(customStart, -span),
      prevTo: addDaysStr(customStart, -1),
    };
  }

  const days = RANGE_DAYS[(timeRange as Exclude<TimeRangeFilter, 'custom'>)] ?? 7;
  const from = addDaysStr(today, -(days - 1));
  return {
    from,
    to: today,
    prevFrom: addDaysStr(from, -days),
    prevTo: addDaysStr(from, -1),
  };
}

function labelFor(dateStr: string, timeRange: TimeRangeFilter): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1);
  if (timeRange === 'week') return dt.toLocaleDateString('en-US', { weekday: 'short' });
  if (timeRange === 'year') return dt.toLocaleDateString('en-US', { month: 'short' });
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

const avg = (nums: number[]): number =>
  nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;

const periodAverage = (days: DayPoint[]): PeriodAverage => ({
  total: Math.round(avg(days.map((x) => x.total))),
  nutrition: Math.round(avg(days.map((x) => x.nutrition))),
  exercise: Math.round(avg(days.map((x) => x.exercise))),
  sleep: Math.round(avg(days.map((x) => x.sleep))),
  mental: Math.round(avg(days.map((x) => x.mental))),
});

function buildSummary(days: DayPoint[]): HealthSummary {
  const nn = (sel: (d: DayPoint) => number | null): number[] =>
    days.map(sel).filter((v): v is number => v != null);

  const avgMood = avg(nn((d) => d.mood_score));
  return {
    avgCaloriesIntake: Math.round(avg(nn((d) => d.calories_in))),
    avgCaloriesBurned: Math.round(avg(nn((d) => d.calories_out))),
    avgSleepHours: Number(avg(nn((d) => d.sleep_hours)).toFixed(1)),
    avgMoodScore: Number(avgMood.toFixed(1)),
    avgMoodLabel:
      avgMood >= 8.5 ? 'Great' : avgMood >= 7 ? 'Good' : avgMood >= 5 ? 'Neutral' : avgMood > 0 ? 'Needs Check' : '—',
    avgStressLevel: Number(avg(nn((d) => d.stress_level)).toFixed(1)),
    avgWaterIntake: Math.round(avg(nn((d) => d.water_glasses))),
    avgProteinIntake: Math.round(avg(nn((d) => d.protein_g))),
  };
}

function ruleBasedReport(
  timeRange: TimeRangeFilter,
  cur: PeriodAverage,
  deltaPct: number,
  improvements: ImprovementStatus[],
  loggedDays: number,
  lang: string,
): string {
  const th = lang === 'th';
  if (loggedDays === 0) {
    return th
      ? 'ยังไม่มีข้อมูลในช่วงเวลานี้ เริ่มบันทึกการกิน การออกกำลังกาย การนอน และสุขภาพจิต เพื่อดูสรุปและคำแนะนำ'
      : 'No data logged for this period yet. Start tracking your eating, exercise, sleep and mental health to see a summary and suggestions.';
  }
  const best = [...improvements].sort((a, b) => b.delta - a.delta)[0];
  const worst = [...improvements].sort((a, b) => a.delta - b.delta)[0];
  const period = th
    ? timeRange === 'today' ? 'วันนี้' : timeRange === 'week' ? 'สัปดาห์นี้' : timeRange === 'month' ? 'เดือนนี้' : timeRange === 'year' ? 'ปีนี้' : 'ช่วงนี้'
    : timeRange === 'today' ? 'today' : timeRange === 'week' ? 'this week' : timeRange === 'month' ? 'this month' : timeRange === 'year' ? 'this year' : 'this period';

  if (th) {
    return `ในช่วง${period} คุณบันทึกข้อมูล ${loggedDays} วัน คะแนนเฉลี่ยอยู่ที่ ${cur.total}/100 (${deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`} เทียบกับช่วงก่อนหน้า) จุดที่ดีขึ้นมากที่สุดคือ${best.pillar} (${best.delta >= 0 ? `+${best.delta}` : best.delta} คะแนน) ส่วน${worst.pillar}${worst.delta < 0 ? `ลดลง ${Math.abs(worst.delta)} คะแนน — ลองให้ความสำคัญกับด้านนี้มากขึ้น` : 'ยังคงที่'}`;
  }
  return `Over ${period} you logged ${loggedDays} day${loggedDays === 1 ? '' : 's'}. Your average score was ${cur.total}/100 (${deltaPct >= 0 ? `+${deltaPct}%` : `${deltaPct}%`} vs the previous period). Biggest gain: ${best.pillar} (${best.delta >= 0 ? `+${best.delta}` : best.delta} pts). ${worst.pillar} ${worst.delta < 0 ? `slipped ${Math.abs(worst.delta)} pts — worth focusing on next.` : 'held steady.'}`;
}

export async function getAnalyticsData(
  timeRange: TimeRangeFilter = 'week',
  customStart?: string,
  customEnd?: string,
  age: number = 25,
  lang: string = 'th',
): Promise<AnalyticsResult> {
  const { from, to, prevFrom, prevTo } = periodBounds(timeRange, customStart, customEnd);

  const [curRows, prevRows] = await Promise.all([
    getHealthHistory(from, to) as Promise<ScoreRow[]>,
    getHealthHistory(prevFrom, prevTo) as Promise<ScoreRow[]>,
  ]);

  const curDays: DayPoint[] = curRows.map(rowToDay);
  const prevDays: DayPoint[] = prevRows.map(rowToDay);

  // Overlay the live (possibly-unsynced) score for today.
  const todayStr = bangkokDateStr();
  if (to === todayStr) {
    const live = calculateLongevityScore(age);
    const liveAgg = getTodayAggregates();
    const idx = curDays.findIndex((d) => d.dateStr === todayStr);
    const liveDay: DayPoint = {
      dateStr: todayStr,
      nutrition: live.nutrition,
      exercise: live.exercise,
      sleep: live.sleep,
      mental: live.mental,
      total: live.total,
      calories_in: liveAgg.calories_in ?? (idx >= 0 ? curDays[idx].calories_in : null),
      calories_out: liveAgg.calories_out ?? (idx >= 0 ? curDays[idx].calories_out : null),
      sleep_hours: liveAgg.sleep_hours ?? (idx >= 0 ? curDays[idx].sleep_hours : null),
      water_glasses: liveAgg.water_glasses ?? (idx >= 0 ? curDays[idx].water_glasses : null),
      protein_g: liveAgg.protein_g ?? (idx >= 0 ? curDays[idx].protein_g : null),
      mood_score: liveAgg.mood_score ?? (idx >= 0 ? curDays[idx].mood_score : null),
      stress_level: liveAgg.stress_level ?? (idx >= 0 ? curDays[idx].stress_level : null),
    };
    const liveHasSomething =
      live.total > 0 || liveAgg.calories_in != null || liveAgg.sleep_hours != null || liveAgg.mood_score != null;
    if (idx >= 0) curDays[idx] = liveDay;
    else if (liveHasSomething) curDays.push(liveDay);
  }

  const loggedDays = curDays.length;
  const currentAvg = periodAverage(curDays);
  const prevAvg = periodAverage(prevDays);
  const deltaPercent = prevAvg.total > 0
    ? Math.round(((currentAvg.total - prevAvg.total) / prevAvg.total) * 100)
    : 0;

  // ── Trend points ────────────────────────────────────────────────────────────
  let trendPoints: TrendPoint[];
  if (timeRange === 'year') {
    const byMonth = new Map<string, DayPoint[]>();
    for (const d of curDays) {
      const key = d.dateStr.slice(0, 7);
      const arr = byMonth.get(key) ?? [];
      arr.push(d);
      byMonth.set(key, arr);
    }
    trendPoints = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, days]) => {
        const m = Number(key.slice(5, 7));
        return {
          dateStr: key,
          label: new Date(2000, m - 1, 1).toLocaleDateString('en-US', { month: 'short' }),
          total: Math.round(avg(days.map((x) => x.total))),
          nutrition: Math.round(avg(days.map((x) => x.nutrition))),
          exercise: Math.round(avg(days.map((x) => x.exercise))),
          sleep: Math.round(avg(days.map((x) => x.sleep))),
          mental: Math.round(avg(days.map((x) => x.mental))),
        };
      });
  } else {
    trendPoints = curDays
      .slice()
      .sort((a, b) => a.dateStr.localeCompare(b.dateStr))
      .map((d) => ({
        dateStr: d.dateStr,
        label: timeRange === 'today' ? (lang === 'th' ? 'วันนี้' : 'Today') : labelFor(d.dateStr, timeRange),
        total: d.total,
        nutrition: d.nutrition,
        exercise: d.exercise,
        sleep: d.sleep,
        mental: d.mental,
      }));
  }

  // ── Health summary ──────────────────────────────────────────────────────────
  const healthSummary = buildSummary(curDays);

  // ── Goal achievement ────────────────────────────────────────────────────────
  const sleepTarget = getSleepTargetByAge(age);
  const caloriesProgress = healthSummary.avgCaloriesIntake > 0
    ? Math.min(100, Math.round((healthSummary.avgCaloriesIntake / 2000) * 100))
    : 0;
  const exerciseProgress = Math.min(100, Math.round((currentAvg.exercise / 25) * 100));
  const sleepProgress = healthSummary.avgSleepHours > 0
    ? Math.min(100, Math.round((healthSummary.avgSleepHours / sleepTarget.min) * 100))
    : 0;
  const goalAchievement: GoalAchievement = {
    caloriesProgress,
    exerciseProgress,
    sleepProgress,
    overallProgress: Math.round((caloriesProgress + exerciseProgress + sleepProgress) / 3),
  };

  // ── Improvement analysis ────────────────────────────────────────────────────
  const pillarsConfig: { pillar: string; key: ImprovementStatus['key'] }[] = [
    { pillar: lang === 'th' ? 'การกิน' : 'Eating', key: 'nutrition' },
    { pillar: lang === 'th' ? 'การออกกำลังกาย' : 'Exercise', key: 'exercise' },
    { pillar: lang === 'th' ? 'การนอนหลับ' : 'Sleep', key: 'sleep' },
    { pillar: lang === 'th' ? 'สุขภาพจิต' : 'Mental Health', key: 'mental' },
  ];
  const improvementAnalysis: ImprovementStatus[] = pillarsConfig.map(({ pillar, key }) => {
    const diff = currentAvg[key] - prevAvg[key];
    let status: ImprovementStatus['status'] = 'stable';
    let label = lang === 'th' ? 'คงที่' : 'Stable';
    if (diff >= 1) {
      status = 'improved';
      label = key === 'sleep' ? (lang === 'th' ? 'ดีขึ้น' : 'Better') : (lang === 'th' ? 'เพิ่มขึ้น' : 'Improved');
    } else if (diff <= -1) {
      status = 'decreased';
      label = lang === 'th' ? 'ลดลง' : 'Decreased';
    }
    return { pillar, key, status, label, delta: diff };
  });

  // ── Achievements ────────────────────────────────────────────────────────────
  const th = lang === 'th';
  const achievements: AchievementBadge[] = [
    {
      id: 'eat-consistent',
      title: th ? 'กินอย่างสมดุล' : 'Balanced Eating',
      status: currentAvg.nutrition >= 20 ? (th ? 'สำเร็จ' : 'Completed') : (th ? `เฉลี่ย ${currentAvg.nutrition}/25` : `Avg ${currentAvg.nutrition}/25`),
      isCompleted: currentAvg.nutrition >= 20,
      category: 'nutrition',
    },
    {
      id: 'sleep-goal',
      title: th ? 'บรรลุเป้าหมายการนอน' : 'Sleep Goal',
      status: healthSummary.avgSleepHours >= sleepTarget.min
        ? (th ? 'สำเร็จ' : 'Completed')
        : (th ? `เฉลี่ย ${healthSummary.avgSleepHours} ชม. / ${sleepTarget.min}` : `Avg ${healthSummary.avgSleepHours}h / ${sleepTarget.min}h`),
      isCompleted: healthSummary.avgSleepHours >= sleepTarget.min,
      category: 'sleep',
    },
    {
      id: 'exe-active',
      title: th ? 'เคลื่อนไหวสม่ำเสมอ' : 'Stay Active',
      status: currentAvg.exercise >= 18 ? (th ? 'สำเร็จ' : 'Completed') : (th ? `เฉลี่ย ${currentAvg.exercise}/25` : `Avg ${currentAvg.exercise}/25`),
      isCompleted: currentAvg.exercise >= 18,
      category: 'exercise',
    },
    {
      id: 'mood-stable',
      title: th ? 'สมดุลอารมณ์และความเครียด' : 'Mood & Stress Balanced',
      status: healthSummary.avgMoodScore >= 7 && healthSummary.avgStressLevel > 0 && healthSummary.avgStressLevel <= 5
        ? (th ? 'ยอดเยี่ยม' : 'Excellent')
        : (th ? 'ควรตรวจสอบเพิ่มเติม' : 'Needs Check-in'),
      isCompleted: healthSummary.avgMoodScore >= 7 && healthSummary.avgStressLevel > 0 && healthSummary.avgStressLevel <= 5,
      category: 'mental',
    },
  ];

  return {
    timeRange,
    startDateStr: from,
    endDateStr: to,
    currentAvg,
    prevAvg,
    deltaPercent,
    trendPoints,
    healthSummary,
    goalAchievement,
    improvementAnalysis,
    aiReport: ruleBasedReport(timeRange, currentAvg, deltaPercent, improvementAnalysis, loggedDays, lang),
    loggedDays,
    achievements,
  };
}

// ── Health calendar + streak (same Supabase rows as the trend chart) ──────────
export interface HealthCalendarData {
  days: CalendarDayItem[];
  /** Consecutive days up to today (or yesterday, if today isn't logged yet) with total > 0. */
  streakDays: number;
}

export async function getHealthCalendarData(daysCount = 30, age = 25): Promise<HealthCalendarData> {
  const today = bangkokDateStr();
  const from = addDaysStr(today, -(daysCount - 1));
  const rows = (await getHealthHistory(from, today)) as ScoreRow[];
  const byDate = new Map(rows.map((r) => [r.date, rowToDay(r)]));

  // Overlay the live score for today.
  const live = calculateLongevityScore(age);
  if (live.total > 0) {
    byDate.set(today, {
      dateStr: today,
      nutrition: live.nutrition,
      exercise: live.exercise,
      sleep: live.sleep,
      mental: live.mental,
      total: live.total,
      calories_in: null, calories_out: null, sleep_hours: null,
      water_glasses: null, protein_g: null, mood_score: null, stress_level: null,
    });
  }

  const days: CalendarDayItem[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    const dateStr = addDaysStr(today, -i);
    const d = byDate.get(dateStr);
    const [, , dd] = dateStr.split('-').map(Number);
    const score = d?.total ?? 0;
    const status: CalendarDayItem['status'] =
      score >= 80 ? 'good' : score >= 50 ? 'medium' : score > 0 ? 'bad' : 'empty';
    days.push({
      dateStr,
      dayNum: dd,
      score,
      status,
      nutrition: d?.nutrition ?? 0,
      exercise: d?.exercise ?? 0,
      sleep: d?.sleep ?? 0,
      mental: d?.mental ?? 0,
    });
  }

  // Streak: walk back from today; allow today to be empty (not logged yet).
  let streakDays = 0;
  let cursor = today;
  if ((byDate.get(cursor)?.total ?? 0) === 0) cursor = addDaysStr(cursor, -1);
  while ((byDate.get(cursor)?.total ?? 0) > 0) {
    streakDays++;
    cursor = addDaysStr(cursor, -1);
  }

  return { days, streakDays };
}

/** Empty result for first paint before the async fetch resolves. */
export function emptyAnalytics(timeRange: TimeRangeFilter = 'week', lang = 'th'): AnalyticsResult {
  const zero: PeriodAverage = { total: 0, nutrition: 0, exercise: 0, sleep: 0, mental: 0 };
  return {
    timeRange,
    startDateStr: bangkokDateStr(),
    endDateStr: bangkokDateStr(),
    currentAvg: zero,
    prevAvg: zero,
    deltaPercent: 0,
    trendPoints: [],
    healthSummary: {
      avgCaloriesIntake: 0, avgCaloriesBurned: 0, avgSleepHours: 0, avgMoodScore: 0,
      avgMoodLabel: '—', avgStressLevel: 0, avgWaterIntake: 0, avgProteinIntake: 0,
    },
    goalAchievement: { caloriesProgress: 0, exerciseProgress: 0, sleepProgress: 0, overallProgress: 0 },
    improvementAnalysis: [],
    aiReport: lang === 'th' ? 'กำลังโหลดข้อมูล...' : 'Loading…',
    loggedDays: 0,
    achievements: [],
  };
}
