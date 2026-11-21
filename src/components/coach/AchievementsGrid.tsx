import React, { useState } from 'react';
import { Award, Brain, CheckCircle2, Dumbbell, LockKeyhole, Moon, Salad, Trophy, Utensils } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { getAchievements } from '../../utils/healthCoach';
import type { BadgeItem } from '../../utils/healthCoach';
import '../../styles/Profile.css';

export const AchievementsGrid: React.FC = () => {
  const { t } = useLanguage();
  const badges = getAchievements();
  const [filterCat, setFilterCat] = useState<string>('all');

  const categories = [
    { key: 'all', labelKey: 'common.all', icon: <Trophy size={16} strokeWidth={1.8} /> },
    { key: 'nutrition', labelKey: 'dashboard.labelNutrition', icon: <Utensils size={16} strokeWidth={1.8} /> },
    { key: 'exercise', labelKey: 'dashboard.labelExercise', icon: <Dumbbell size={16} strokeWidth={1.8} /> },
    { key: 'sleep', labelKey: 'dashboard.labelSleep', icon: <Moon size={16} strokeWidth={1.8} /> },
    { key: 'mental', labelKey: 'dashboard.labelMental', icon: <Brain size={16} strokeWidth={1.8} /> },
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
        <Trophy className="pv2-card-icon" size={18} strokeWidth={1.8} />
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

      <div className="pv2-achieve-list-layout">
        {filteredBadges.map((badge: BadgeItem) => (
          <div
            key={badge.id}
            className={`pv2-badge-box ${badge.unlocked ? 'is-unlocked' : 'is-locked'}`}
          >
            <div className="pv2-badge-icon-circle">
              {badge.unlocked ? (
                badge.icon === 'footprints' ? <Dumbbell size={22} strokeWidth={1.8} /> :
                badge.icon === 'moon' ? <Moon size={22} strokeWidth={1.8} /> :
                badge.icon === 'salad' ? <Salad size={22} strokeWidth={1.8} /> :
                <Award size={22} strokeWidth={1.8} />
              ) : (
                <LockKeyhole className="locked-icon" size={16} strokeWidth={1.8} />
              )}
            </div>

            <div className="pv2-badge-info">
              <h4 className="pv2-badge-title">
                {t(badge.titleKey)}
                {badge.unlocked && <CheckCircle2 className="check-ico" size={14} strokeWidth={1.8} />}
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
