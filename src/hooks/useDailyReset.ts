import { useEffect } from 'react';
import { bangkokDateStr, msUntilNextBangkokMidnight } from '../utils/bangkokTime';
import { calculateLongevityScore } from '../utils/longevityScore';
import { syncDailyScoreToSupabase } from '../services/supabaseClient';

// The score resets to 0 at 00:00 Asia/Bangkok. When the day rolls over we freeze
// the ending day's score into Supabase (health_scores) and stash "yesterday's"
// total — but we DON'T touch the raw localStorage logs. `calculateLongevityScore`
// and the daily aggregates already filter every log to "today" by timestamp, so
// keeping the full history is both harmless to the score and required for the
// "This week / This month" views (QA-005).

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

      // 2. Drop only the legacy non-dated water key if present (dated waterLogs
      //    roll over on their own). Raw logs are kept — see the note above.
      if (localStorage.getItem('waterIntake')) localStorage.removeItem('waterIntake');

      localStorage.setItem('lastActiveDate', today);

      // 3. Recompute the UI — today's logs are empty, so it drops to a fresh zero.
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
