// Celebratory popup for the moment a badge is newly unlocked (see
// checkForNewlyUnlockedBadges() in src/utils/healthCoach.ts and its App.tsx
// wiring). Purely a same-session "you're open right now" flourish — the
// actual record of the achievement is the notification fired alongside it
// (notify_badge_unlocked), which is what a closed app relies on.
import React, { useEffect } from 'react';
import { Award, Brain, Dumbbell, Moon, Salad, Trophy } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import type { BadgeItem } from '../utils/healthCoach';
import '../styles/BadgeUnlockPopup.css';

interface Props {
  badge: BadgeItem;
  onClose: () => void;
}

const AUTO_DISMISS_MS = 6000;

export const BadgeUnlockPopup: React.FC<Props> = ({ badge, onClose }) => {
  const { t } = useLanguage();

  useEffect(() => {
    const timer = window.setTimeout(onClose, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [badge.id, onClose]);

  return (
    <div className="badge-popup-overlay" onClick={onClose}>
      <div className="badge-popup-card" onClick={(e) => e.stopPropagation()}>
        <div className="badge-popup-glow" />
        <Trophy className="badge-popup-trophy" size={32} strokeWidth={1.8} />
        <p className="badge-popup-kicker">{t('badge.unlockedPopupTitle')}</p>
        <div className="badge-popup-icon" aria-hidden="true">
          {badge.icon === 'footprints' ? <Dumbbell size={36} strokeWidth={1.8} /> :
           badge.icon === 'moon' ? <Moon size={36} strokeWidth={1.8} /> :
           badge.icon === 'salad' ? <Salad size={36} strokeWidth={1.8} /> :
           badge.icon === 'brain' ? <Brain size={36} strokeWidth={1.8} /> :
           badge.icon === 'award' ? <Award size={36} strokeWidth={1.8} /> :
           <Trophy size={36} strokeWidth={1.8} />}
        </div>
        <h3 className="badge-popup-title">{t(badge.titleKey)}</h3>
        <p className="badge-popup-desc">{t(badge.descKey)}</p>
        <button type="button" className="badge-popup-cta" onClick={onClose}>
          {t('badge.unlockedPopupCta')}
        </button>
      </div>
    </div>
  );
};
