import { useEffect } from 'react';
import { bangkokDateStr, msUntilNextBangkokMidnight } from '../utils/bangkokTime';
import { calculateLongevityScore } from '../utils/longevityScore';
import { syncDailyScoreToSupabase } from '../services/supabaseClient';

// The score resets to 0 at 00:00 Asia/Bangkok. When the local day rolls over,
// the day that just ended is finalised into Supabase (health_scores) BEFORE the
// raw localStorage logs are cleared — so the analytics history and the AI report
// keep a permanent record while today starts fresh.
const DAILY_KEYS = ['meals', 'activities', 'sleepLogs', 'mentalLogs'];

export const useDailyReset = () => {
  useEffect(() => {
    let midnightTimer: ReturnType<typeof setTimeout>;

    const rollOverIfNeeded = async () => {
      const today = bangkokDateStr();
      const lastActive = localStorage.getItem('lastActiveDate');

      if (!lastActive) {
        localStorage.setItem('lastActiveDate', today);
        return;
      }
      if (lastActive === today) return;

      // 1. Freeze the ending day's score into Supabase under ITS date (the raw
      //    logs still in localStorage belong to `lastActive`, not to `today`),
      //    and stash its total for the Home "vs yesterday" delta.
      const endingScore = calculateLongevityScore();
      try {
        if (endingScore.total > 0) {
          await syncDailyScoreToSupabase(endingScore, lastActive);
        }
      } catch (err) {
        console.error('[Daily Reset] final sync failed:', err);
      }
      localStorage.setItem('yesterdayScore', String(endingScore.total));

      // 2. Clear the raw daily logs (keep a running fasting timer alone).
      for (const key of DAILY_KEYS) {
        if (localStorage.getItem(key)) localStorage.setItem(key, '[]');
      }
      // Water is keyed by date, so old entries fall away on their own; drop any
      // stale non-dated key if present.
      if (localStorage.getItem('waterIntake')) localStorage.removeItem('waterIntake');

      localStorage.setItem('lastActiveDate', today);

      // 3. Recompute the UI to a fresh zero.
      window.dispatchEvent(new Event('healthDataUpdated'));
    };

    const scheduleMidnight = () => {
      clearTimeout(midnightTimer);
      midnightTimer = setTimeout(async () => {
        await rollOverIfNeeded();
        scheduleMidnight();
      }, msUntilNextBangkokMidnight() + 2000);
    };

    void rollOverIfNeeded();
    scheduleMidnight();

    const onFocus = () => void rollOverIfNeeded();
    const safety = setInterval(() => void rollOverIfNeeded(), 5 * 60 * 1000);
    window.addEventListener('focus', onFocus);

    return () => {
      clearTimeout(midnightTimer);
      clearInterval(safety);
      window.removeEventListener('focus', onFocus);
    };
  }, []);
};
