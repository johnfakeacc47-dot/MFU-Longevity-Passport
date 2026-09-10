// TodayPlant — Home-screen hero: pairs the all-time growth stage with
// today's 4-pillar breakdown (passed in — Home already fetches that for
// the score ring).
import React from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { GardenPlant, type GardenBreakdown } from './GardenPlant';
import { useGrowthStage } from '../../hooks/useGrowthStage';
import { STAGE_NAME_KEYS, type GrowthStage } from '../../utils/growthStage';
import '../../styles/Garden.css';

// Mirrors the thresholds in growthStage.ts — kept alongside them for the
// "N pts to next stage" caption.
const NEXT_THRESHOLD: Record<GrowthStage, number | null> = { 0: 20, 1: 150, 2: 500, 3: 1800, 4: null };

interface TodayPlantProps {
  breakdown: GardenBreakdown;
  /** Home is still fetching today's score — show the loading shape instead
   *  of a premature (all-zero) tree, same as the score ring beside it. */
  isLoading?: boolean;
}

export const TodayPlant: React.FC<TodayPlantProps> = ({ breakdown, isLoading = false }) => {
  const { t } = useLanguage();
  const { stage, totalPoints, loading: stageLoading } = useGrowthStage();
  const loading = isLoading || stageLoading;

  const nextThreshold = NEXT_THRESHOLD[stage];
  const remaining = nextThreshold !== null && totalPoints !== null ? Math.max(0, nextThreshold - totalPoints) : null;

  if (loading) {
    return (
      <section className="garden-hero-card" aria-label={t('garden.title')} aria-busy="true">
        <div className="garden-hero-readout">
          <span className="garden-hero-skeleton-line garden-hero-skeleton-line--stage" />
        </div>
        <div className="garden-hero-skeleton-shape" />
        <span className="garden-hero-skeleton-line garden-hero-skeleton-line--caption-1" />
        <span className="garden-hero-skeleton-line garden-hero-skeleton-line--caption-2" />
      </section>
    );
  }

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
