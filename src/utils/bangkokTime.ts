// The app's "day" is Asia/Bangkok (UTC+7), and the daily score resets at 00:00
// Bangkok time. All day-boundary logic must go through these helpers — never
// `new Date().toISOString().split('T')[0]` (that's UTC and rolls over 7h early
// for users in Thailand).

const TZ = 'Asia/Bangkok';

/** "YYYY-MM-DD" for the given instant in Bangkok local time (default: now). */
export function bangkokDateStr(d: Date = new Date()): string {
  // en-CA formats as YYYY-MM-DD
  return d.toLocaleDateString('en-CA', { timeZone: TZ });
}

/** Parse "YYYY-MM-DD" to a UTC-midnight Date (calendar date, no TZ shift). */
function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** "YYYY-MM-DD" N days before today, Bangkok time. */
export function bangkokDateStrDaysAgo(days: number): string {
  return addDaysStr(bangkokDateStr(), -days);
}

/** Add/subtract whole days from a "YYYY-MM-DD" string (calendar math, TZ-safe). */
export function addDaysStr(dateStr: string, delta: number): string {
  const d = parseDateStr(dateStr);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Inclusive whole-day span between two "YYYY-MM-DD" strings. */
export function daysBetweenStr(fromStr: string, toStr: string): number {
  const ms = parseDateStr(toStr).getTime() - parseDateStr(fromStr).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Milliseconds until the next 00:00 Asia/Bangkok (>= 1000). */
export function msUntilNextBangkokMidnight(): number {
  const now = new Date();
  const bkkNow = new Date(now.toLocaleString('en-US', { timeZone: TZ }));
  const nextMidnight = new Date(bkkNow);
  nextMidnight.setHours(24, 0, 0, 0);
  return Math.max(1000, nextMidnight.getTime() - bkkNow.getTime());
}
