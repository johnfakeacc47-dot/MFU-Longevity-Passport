// The current user's Longevity Garden growth stage, from all-time points
// (profiles.total_points — server-authoritative, only ever grows). Shared
// by every place that shows "your" tree (Home hero, Dashboard garden view)
// so they don't each duplicate the same fetch.
import { useEffect, useState } from 'react';
import { getCurrentUserProfile, isSupabaseConfigured } from '../services/supabaseClient';
import { stageFromPoints, type GrowthStage } from '../utils/growthStage';

export function useGrowthStage(): { stage: GrowthStage; totalPoints: number | null } {
  const [totalPoints, setTotalPoints] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!isSupabaseConfigured()) return;
      getCurrentUserProfile()
        .then((profile) => { if (!cancelled && profile) setTotalPoints(profile.total_points ?? 0); })
        .catch(() => {});
    };
    load();
    window.addEventListener('healthDataUpdated', load);
    return () => { cancelled = true; window.removeEventListener('healthDataUpdated', load); };
  }, []);

  return { stage: stageFromPoints(totalPoints ?? 0), totalPoints };
}
