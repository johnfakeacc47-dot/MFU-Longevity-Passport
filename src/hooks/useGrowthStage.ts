// The current user's Longevity Garden growth stage, from all-time points
// (profiles.total_points — server-authoritative, only ever grows). Shared
// by every place that shows "your" tree (Home hero, Dashboard garden view)
// so they don't each duplicate the same fetch.
import { useEffect, useState } from 'react';
import { getCurrentUserProfile, isSupabaseConfigured } from '../services/supabaseClient';
import { stageFromPoints, type GrowthStage } from '../utils/growthStage';

export function useGrowthStage(): { stage: GrowthStage; totalPoints: number | null; loading: boolean } {
  const [totalPoints, setTotalPoints] = useState<number | null>(null);
  // True only until the first fetch settles — lets callers show a proper
  // loading state instead of flashing "Seed" (totalPoints starts null)
  // before the real stage arrives. Stays false on later refreshes so a
  // background healthDataUpdated doesn't re-trigger a loading flicker.
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      if (!isSupabaseConfigured()) { setLoading(false); return; }
      getCurrentUserProfile()
        .then((profile) => {
          if (cancelled) return;
          if (profile) setTotalPoints(profile.total_points ?? 0);
          setLoading(false);
        })
        .catch(() => { if (!cancelled) setLoading(false); });
    };
    load();
    window.addEventListener('healthDataUpdated', load);
    return () => { cancelled = true; window.removeEventListener('healthDataUpdated', load); };
  }, []);

  return { stage: stageFromPoints(totalPoints ?? 0), totalPoints, loading };
}
