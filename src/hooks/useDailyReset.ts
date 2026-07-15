import { useEffect } from 'react';

export const useDailyReset = () => {
  useEffect(() => {
    const checkAndResetDailyData = () => {
      const todayString = new Date().toISOString().split('T')[0];
      const lastActiveDate = localStorage.getItem('lastActiveDate');

      if (lastActiveDate && lastActiveDate !== todayString) {
        console.log(`[Daily Reset] Transitioning from ${lastActiveDate} to ${todayString}. Clearing old logs.`);
        
        // We only clear out daily event logs to save local space.
        // Supabase already safely stores the calculated `health_scores` on every edit.
        // We intentionally leave fastingState alone if they are currently having a running timer.
        
        let shouldDispatch = false;
        
        // Clean up arrays
        const keysToReset = ['meals', 'activities', 'sleepLogs'];
        keysToReset.forEach(key => {
          const data = localStorage.getItem(key);
          if (data && data !== '[]') {
            // we could filter for today's items, but for simplicity, we just clear everything.
            // If the user hasn't opened the app since yesterday, there are no today's items anyway.
            const items = JSON.parse(data);
            const todayTimestamp = new Date();
            todayTimestamp.setHours(0, 0, 0, 0);
            
            // Only keep items that actually happened today
            const filtered = items.filter((item: { timestamp: string | number | Date }) => new Date(item.timestamp).getTime() >= todayTimestamp.getTime());
            
            if (filtered.length !== items.length) {
              localStorage.setItem(key, JSON.stringify(filtered));
              shouldDispatch = true;
            }
          }
        });

        // Clean up offline queue if it gets too large or just let it sync normally.
        // (Leaving offline queue as-is so we don't drop pending requests).

        if (shouldDispatch) {
          window.dispatchEvent(new Event('healthDataUpdated'));
        }
      }

      // Always update last active date to today
      if (lastActiveDate !== todayString) {
        localStorage.setItem('lastActiveDate', todayString);
      }
    };

    // Run on initial mount
    checkAndResetDailyData();

    // Optionally check if the user leaves the tab open overnight
    // We check every minute
    const interval = setInterval(checkAndResetDailyData, 60000);

    // Run also when window gets focus
    window.addEventListener('focus', checkAndResetDailyData);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkAndResetDailyData);
    };
  }, []);
};
