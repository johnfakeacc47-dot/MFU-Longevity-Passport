import React from 'react';
import { LuClock3, LuActivity, LuInfo, LuCircleCheck, LuCircleAlert } from 'react-icons/lu';
import { useLanguage } from '../contexts/LanguageContext';

export interface QualityResult {
  score: number;       // 1 - 10
  labelEn: string;     // Very Poor, Poor, Fair, Good, Excessive
  labelTh: string;     // แย่มาก, แย่, พอใช้, ดี, มากเกินไป
  color: string;       // Hex color for badge / indicator
  bgLight: string;     // Soft background color
  insightKey: string;  // i18n key for the smart health insight
  levelIndex: number;  // 0: Very Poor, 1: Poor, 2: Fair, 3: Good, 4: Excessive
}

export function calculateSleepQuality(duration: number, bedtime: string): QualityResult {
  const [bH] = bedtime.split(':').map(Number);
  // Check if bedtime is late (between 01:00 and 04:59 AM)
  const isLateBedtime = bH >= 1 && bH < 5;

  if (duration < 5) {
    return {
      score: 2,
      labelEn: 'Very Poor',
      labelTh: 'แย่มาก',
      color: '#ef4444', // red-500
      bgLight: '#fef2f2',
      insightKey: 'sq.insightVeryPoor',
      levelIndex: 0,
    };
  } else if (duration < 6) {
    return {
      score: 4,
      labelEn: 'Poor',
      labelTh: 'แย่',
      color: '#f97316', // orange-500
      bgLight: '#fff7ed',
      insightKey: isLateBedtime ? 'sq.insightPoorLate' : 'sq.insightPoor',
      levelIndex: 1,
    };
  } else if (duration < 7) {
    return {
      score: 6,
      labelEn: 'Fair',
      labelTh: 'พอใช้',
      color: '#eab308', // yellow-500
      bgLight: '#fefce8',
      insightKey: isLateBedtime ? 'sq.insightFairLate' : 'sq.insightFair',
      levelIndex: 2,
    };
  } else if (duration <= 9) {
    // 7 to 9 hours is optimal!
    const isOptimalRange = duration >= 7.5 && duration <= 8.5 && !isLateBedtime;
    return {
      score: isOptimalRange ? 10 : 9,
      labelEn: 'Good',
      labelTh: 'ดี',
      color: '#10b981', // emerald-500
      bgLight: '#ecfdf5',
      insightKey: isLateBedtime ? 'sq.insightGoodLate' : 'sq.insightGood',
      levelIndex: 3,
    };
  } else {
    // > 9 hours
    return {
      score: 7,
      labelEn: 'Excessive',
      labelTh: 'มากเกินไป',
      color: '#06b6d4', // cyan-500
      bgLight: '#ecfeff',
      insightKey: 'sq.insightExcessive',
      levelIndex: 4,
    };
  }
}

interface SleepQualityIndicatorProps {
  duration: number;
  bedtime: string;
}

const SEGMENT_KEYS = ['sq.veryPoor', 'sq.poor', 'sq.fair', 'sq.good', 'sq.excessive'];

export const SleepQualityIndicator: React.FC<SleepQualityIndicatorProps> = ({ duration, bedtime }) => {
  const { t, language } = useLanguage();
  const quality = calculateSleepQuality(duration, bedtime);
  const qualityLabel = language === 'th' ? quality.labelTh : quality.labelEn;

  return (
    <div className="sleep-quality-card">
      {/* Header Info */}
      <div className="sq-info-grid">
        <div className="sq-info-item">
          <div className="sq-label">
            <LuClock3 className="sq-icon" />
            <span>{t('sq.duration')}</span>
          </div>
          <div className="sq-value">
            <strong>{duration}</strong> <span className="sq-unit">{t('sq.hours')}</span>
          </div>
        </div>

        <div className="sq-info-item">
          <div className="sq-label">
            <LuActivity className="sq-icon" style={{ color: quality.color }} />
            <span>{t('sq.autoQuality')}</span>
          </div>
          <div className="sq-value-badge-wrap">
            <span
              className="sq-badge"
              style={{
                backgroundColor: quality.bgLight,
                color: quality.color,
                borderColor: `${quality.color}40`,
              }}
            >
              ★ {qualityLabel} ({quality.score}/10)
            </span>
          </div>
        </div>
      </div>

      {/* Readonly Segmented Progress / Indicator */}
      <div className="sq-segmented-wrap">
        <div className="sq-bars">
          {SEGMENT_KEYS.map((key, idx) => {
            const isActive = idx === quality.levelIndex;
            return (
              <div
                key={key}
                className={`sq-bar-segment ${isActive ? 'sq-bar--active' : ''}`}
                style={{
                  backgroundColor: isActive ? quality.color : '#e2e8f0',
                  boxShadow: isActive ? `0 0 10px ${quality.color}60` : 'none',
                }}
              />
            );
          })}
        </div>

        <div className="sq-labels">
          {SEGMENT_KEYS.map((key, idx) => {
            const isActive = idx === quality.levelIndex;
            return (
              <span
                key={key}
                className={`sq-label-item ${isActive ? 'sq-label--active' : ''}`}
                style={{ color: isActive ? quality.color : '#94a3b8' }}
              >
                {t(key)}
              </span>
            );
          })}
        </div>
      </div>

      {/* Smart Health Insight */}
      <div className="sq-insight-box" style={{ backgroundColor: quality.bgLight, borderColor: `${quality.color}30` }}>
        <div className="sq-insight-icon" style={{ color: quality.color }}>
          {quality.levelIndex === 3 ? <LuCircleCheck /> : quality.levelIndex <= 1 ? <LuCircleAlert /> : <LuInfo />}
        </div>
        <div className="sq-insight-text">
          <span className="sq-insight-title" style={{ color: quality.color }}>
            ● {t('sq.qualityIndicator')}
          </span>
          <p className="sq-insight-desc">{t(quality.insightKey)}</p>
        </div>
      </div>
    </div>
  );
};
