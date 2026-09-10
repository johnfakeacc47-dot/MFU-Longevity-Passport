// TodayPlant — Home-screen hero: fetches the all-time growth stage
// (profiles.total_points) and pairs it with today's 4-pillar breakdown
// (passed in — Home already fetches that for the score ring).
import React, { useEffect, useState } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GardenPlant, type GardenBreakdown } from './GardenPlant';
import { stageFromPoints, STAGE_NAME_KEYS, type GrowthStage } from '../../utils/growthStage';
import { getCurrentUserProfile, isSupabaseConfigured } from '../../services/supabaseClient';
import '../../styles/Garden.css';

// Mirrors the thresholds in growthStage.ts — kept alongside them for the
// "N pts to next stage" caption.
const NEXT_THRESHOLD: Record<GrowthStage, number | null> = { 0: 20, 1: 150, 2: 500, 3: 1800, 4: null };

interface TodayPlantProps {
  breakdown: GardenBreakdown;
}

export const TodayPlant: React.FC<TodayPlantProps> = ({ breakdown }) => {
  const { t } = useLanguage();
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

  const stage = stageFromPoints(totalPoints ?? 0);
  const nextThreshold = NEXT_THRESHOLD[stage];
  const remaining = nextThreshold !== null && totalPoints !== null ? Math.max(0, nextThreshold - totalPoints) : null;

  return (
    <section className="garden-hero-card" aria-label={t('garden.title')}>
      <div className="garden-hero-readout">
        <span className="garden-hero-stage">{t(STAGE_NAME_KEYS[stage])}</span>
        {remaining !== null ? (
          <span>{remaining} {t('garden.nextStageIn')} {t(STAGE_NAME_KEYS[(stage + 1) as GrowthStage])}</span>
        ) : (
          <span>{t('garden.fullyGrown')}</span>
        )}
      </div>
      <GardenPlant breakdown={breakdown} stage={stage} size={180} title={t('garden.title')} />
      <p className="garden-hero-caption">{t('garden.subtitle')}</p>
    </section>
  );
};
