import React, { useState } from 'react';
import { FaTrophy, FaLock, FaCheckCircle, FaUtensils, FaDumbbell, FaBed, FaBrain } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAchievements } from '../../utils/healthCoach';
import type { BadgeItem } from '../../utils/healthCoach';
import '../../styles/Profile.css';

export const AchievementsGrid: React.FC = () => {
  const { t } = useLanguage();
  const badges = getAchievements();
  const [filterCat, setFilterCat] = useState<string>('all');

  const categories = [
    { key: 'all', labelKey: 'common.all', icon: <FaTrophy /> },
    { key: 'nutrition', labelKey: 'dashboard.labelNutrition', icon: <FaUtensils /> },
    { key: 'exercise', labelKey: 'dashboard.labelExercise', icon: <FaDumbbell /> },
    { key: 'sleep', labelKey: 'dashboard.labelSleep', icon: <FaBed /> },
    { key: 'mental', labelKey: 'dashboard.labelMental', icon: <FaBrain /> },
  ];

  const getBadgeCategory = (id: string): string => {
    if (id === 'log7d' || id === 'cal7d') return 'nutrition';
    if (id === 'ex100m') return 'exercise';
    if (id === 'sleep10d') return 'sleep';
    return 'mental';
  };

  const filteredBadges = filterCat === 'all'
    ? badges
    : badges.filter(b => getBadgeCategory(b.id) === filterCat);

  const unlockedCount = badges.filter(b => b.unlocked).length;

  return (
    <div className="pv2-card pv2-achievements-section">
      <div className="pv2-card-header">
        <FaTrophy className="pv2-card-icon" style={{ color: '#EAB308' }} />
        <div>
          <h3 className="pv2-card-title">{t('badge.title')}</h3>
          <p className="pv2-achieve-sub">
            {unlockedCount} / {badges.length} {t('common.recorded')}
          </p>
        </div>
      </div>

      <div className="pv2-achieve-tabs">
        {categories.map(cat => (
          <button
            key={cat.key}
            type="button"
            className={`pv2-achieve-tab ${filterCat === cat.key ? 'active' : ''}`}
            onClick={() => setFilterCat(cat.key)}
          >
            <span className="tab-ico">{cat.icon}</span>
            <span>{t(cat.labelKey)}</span>
          </button>
        ))}
      </div>

      <div className="pv2-achieve-grid-layout">
        {filteredBadges.map((badge: BadgeItem) => (
          <div
            key={badge.id}
            className={`pv2-badge-box ${badge.unlocked ? 'is-unlocked' : 'is-locked'}`}
          >
            <div className="pv2-badge-icon-circle">
              {badge.unlocked ? (
                <span className="badge-emoji">{badge.icon}</span>
              ) : (
                <FaLock className="locked-icon" />
              )}
            </div>

            <div className="pv2-badge-info">
              <h4 className="pv2-badge-title">
                {t(badge.titleKey)}
                {badge.unlocked && <FaCheckCircle className="check-ico" />}
              </h4>
              <p className="pv2-badge-desc">{t(badge.descKey)}</p>
              {badge.unlocked && (
                <span className="pv2-badge-date">
                  {t('common.unlocked') || 'Unlocked'}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
