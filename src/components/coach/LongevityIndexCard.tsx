import React from 'react';
import { FaHeartbeat, FaArrowUp, FaArrowDown, FaMinus } from 'react-icons/fa';
import type { LongevityIndexResult } from '../../utils/healthCoach';

interface LongevityIndexCardProps {
  indexData: LongevityIndexResult;
  t: (key: string) => string;
}

export const LongevityIndexCard: React.FC<LongevityIndexCardProps> = ({ indexData, t }) => {
  const { score, levelKey, healthAge, realAge, ageDelta, trend, trendPercent } = indexData;

  const getLevelBadgeStyle = () => {
    if (score >= 85) return { bg: '#8B5CF6', color: '#FFFFFF', border: '1px solid #7C3AED' };
    if (score >= 70) return { bg: '#10B981', color: '#FFFFFF', border: '1px solid #059669' };
    if (score >= 50) return { bg: '#F59E0B', color: '#FFFFFF', border: '1px solid #D97706' };
    return { bg: '#EF4444', color: '#FFFFFF', border: '1px solid #DC2626' };
  };

  const badgeStyle = getLevelBadgeStyle();

  return (
    <section className="coach-card longevity-index-card">
      <div className="index-card-header">
        <div className="index-header-left">
          <FaHeartbeat className="index-icon" />
          <div>
            <h3 className="coach-card-title">{t('index.title')}</h3>
            <span className="coach-card-subtitle">{t(levelKey)}</span>
          </div>
        </div>
        <div className="index-level-badge" style={{ background: badgeStyle.bg, color: badgeStyle.color }}>
          {t(levelKey).split(' ')[0]}
        </div>
      </div>

      <div className="index-metrics-grid">
        <div className="index-metric-box">
          <span className="metric-label">{t('index.ageLabel')}</span>
          <div className="metric-val-row">
            <span className="metric-val">{healthAge}</span>
            <span className="metric-unit">/{realAge} {t('profile.summaryAgeUnit')}</span>
          </div>
          <span className={`metric-delta ${ageDelta < 0 ? 'delta-good' : ageDelta > 0 ? 'delta-bad' : 'delta-neutral'}`}>
            {ageDelta < 0 ? `${ageDelta} ${t('profile.summaryAgeUnit')} (${t('index.ageCompared')})` : ageDelta > 0 ? `+${ageDelta} ${t('profile.summaryAgeUnit')}` : t('index.trendStable')}
          </span>
        </div>

        <div className="index-metric-box">
          <span className="metric-label">{t('index.trendLabel')}</span>
          <div className="metric-val-row">
            {trend === 'up' && <FaArrowUp className="trend-icon trend-up" />}
            {trend === 'down' && <FaArrowDown className="trend-icon trend-down" />}
            {trend === 'stable' && <FaMinus className="trend-icon trend-stable" />}
            <span className="metric-val">{trend === 'stable' ? '-' : `${trendPercent}%`}</span>
          </div>
          <span className="metric-delta">
            {trend === 'up' ? t('index.trendUp') : trend === 'down' ? t('index.trendDown') : t('index.trendStable')}
          </span>
        </div>
      </div>
    </section>
  );
};
