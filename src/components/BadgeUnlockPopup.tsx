// Celebratory popup for the moment a badge is newly unlocked (see
// checkForNewlyUnlockedBadges() in src/utils/healthCoach.ts and its App.tsx
// wiring). Purely a same-session "you're open right now" flourish — the
// actual record of the achievement is the notification fired alongside it
// (notify_badge_unlocked), which is what a closed app relies on.
import React, { useEffect } from 'react';
import { FaTrophy } from 'react-icons/fa';
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
        <FaTrophy className="badge-popup-trophy" />
        <p className="badge-popup-kicker">{t('badge.unlockedPopupTitle')}</p>
        <div className="badge-popup-emoji">{badge.icon}</div>
        <h3 className="badge-popup-title">{t(badge.titleKey)}</h3>
        <p className="badge-popup-desc">{t(badge.descKey)}</p>
        <button type="button" className="badge-popup-cta" onClick={onClose}>
          {t('badge.unlockedPopupCta')}
        </button>
      </div>
    </div>
  );
};
