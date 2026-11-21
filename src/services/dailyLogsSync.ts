// Cross-device sync for the raw daily logs (QA-009). Only `health_scores` and
// `profiles` synced before, so two devices on one account showed different
// meal / activity / sleep / water histories.
//
// Model: one `daily_logs` row per user per Bangkok-local day, holding a jsonb
// blob of that day's log arrays. The client pushes "today" on a debounce and
// reconciles the last ~14 days on boot. Logs are append-only, so the merge is a
// union keyed by timestamp — the only cost is that an item deleted on one device
// can briefly reappear from another device's stale copy.
import { supabase } from './supabaseClient';
import { safeGetItem } from '../utils/safeStorage';
import { bangkokDateStr } from '../utils/bangkokTime';

const ARRAY_KEYS = ['meals', 'activities', 'sleepLogs', 'mentalLogs'] as const;
const SYNC_DAYS = 14;

interface Timestamped { timestamp?: string }
interface DayBlob {
  meals?: Timestamped[];
  activities?: Timestamped[];
  sleepLogs?: Timestamped[];
  mentalLogs?: Timestamped[];
  water?: { glasses?: number; ml?: number; targetMl?: number; date?: string };
}

const itemKey = (it: any): string =>
  `${it?.timestamp ?? ''}|${it?.calories ?? ''}|${it?.duration ?? ''}|${it?.mood ?? ''}`;

const dayOf = (it: Timestamped): string | null => {
  if (!it?.timestamp) return null;
  const d = new Date(it.timestamp);
  return isNaN(d.getTime()) ? null : bangkokDateStr(d);
};

/** Group everything currently in localStorage by Bangkok date. */
function localByDate(): Record<string, DayBlob> {
  const out: Record<string, DayBlob> = {};
  for (const key of ARRAY_KEYS) {
    for (const item of safeGetItem<Timestamped[]>(key, [])) {
      const d = dayOf(item);
      if (!d) continue;
      (out[d] ??= {});
      ((out[d] as any)[key] ??= []).push(item);
    }
  }
  const water = safeGetItem<Record<string, any>>('waterLogs', {});
  for (const [d, w] of Object.entries(water)) {
    if (w) (out[d] ??= {}).water = w;
  }
  return out;
}

/** Debounced upload of the local logs for the last SYNC_DAYS. */
let pushTimer: ReturnType<typeof setTimeout> | null = null;
export const schedulePushDailyLogs = (delayMs = 3000): void => {
  if (!supabase) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(() => { void pushDailyLogs(); }, delayMs);
};

export const pushDailyLogs = async (): Promise<void> => {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = bangkokDateStr();
    const cutoff = addDays(today, -(SYNC_DAYS - 1));
    const byDate = localByDate();

    const rows = Object.entries(byDate)
      .filter(([d]) => d >= cutoff)
      .map(([date, logs]) => ({ user_id: user.id, date, logs }));
    if (!rows.length) return;

    await supabase.from('daily_logs').upsert(rows, { onConflict: 'user_id,date' });
  } catch (e) {
    console.warn('[dailyLogsSync] push failed:', e);
  }
};

/** Pull the last SYNC_DAYS from Supabase and union anything missing into localStorage. */
export const pullDailyLogs = async (): Promise<void> => {
  if (!supabase) return;
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const today = bangkokDateStr();
    const cutoff = addDays(today, -(SYNC_DAYS - 1));
    const { data, error } = await supabase
      .from('daily_logs')
      .select('date, logs')
      .eq('user_id', user.id)
      .gte('date', cutoff)
      .order('date', { ascending: true });
    if (error || !data || !data.length) return;

    let changed = false;

    // ── array logs: union by itemKey ──
    for (const key of ARRAY_KEYS) {
      const local: any[] = safeGetItem<any[]>(key, []);
      const seen = new Set(local.map(itemKey));
      let added = 0;
      for (const row of data) {
        const remoteItems: any[] = (row.logs as DayBlob)?.[key] ?? [];
        for (const it of remoteItems) {
          const k = itemKey(it);
          if (!seen.has(k)) { local.push(it); seen.add(k); added++; }
        }
      }
      if (added) {
        local.sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
        localStorage.setItem(key, JSON.stringify(local));
        changed = true;
      }
    }

    // ── water: take the higher glass count per day ──
    const water = safeGetItem<Record<string, any>>('waterLogs', {});
    for (const row of data) {
      const rw = (row.logs as DayBlob)?.water;
      if (!rw) continue;
      const d = row.date as string;
      const lw = water[d];
      if (!lw || (rw.glasses ?? 0) > (lw.glasses ?? 0)) {
        water[d] = { date: d, glasses: rw.glasses ?? 0, ml: rw.ml ?? (rw.glasses ?? 0) * 250, targetMl: rw.targetMl ?? 2000 };
        changed = true;
      }
    }
    if (changed) localStorage.setItem('waterLogs', JSON.stringify(water));

    if (changed) {
      window.dispatchEvent(new Event('healthDataUpdated'));
      // save the newly-merged state back up
      void pushDailyLogs();
    }
  } catch (e) {
    console.warn('[dailyLogsSync] pull failed:', e);
  }
};

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + delta);
  return dt.toISOString().slice(0, 10);
}
