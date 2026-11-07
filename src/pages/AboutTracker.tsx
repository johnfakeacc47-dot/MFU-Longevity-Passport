import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { FaBed, FaDumbbell, FaFlask, FaGraduationCap, FaHourglassHalf, FaLeaf } from 'react-icons/fa';
import { BackButton } from '../components/BackButton';

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface AboutTrackerProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const PILLARS = [
  { key: 'nutrition', icon: <FaLeaf />,          titleKey: 'aboutTracker.pillarNutrition', descKey: 'aboutTracker.pillarNutritionDesc' },
  { key: 'fasting',   icon: <FaHourglassHalf />, titleKey: 'aboutTracker.pillarFasting',   descKey: 'aboutTracker.pillarFastingDesc' },
  { key: 'activity',  icon: <FaDumbbell />,      titleKey: 'aboutTracker.pillarActivity',  descKey: 'aboutTracker.pillarActivityDesc' },
  { key: 'sleep',     icon: <FaBed />,           titleKey: 'aboutTracker.pillarSleep',     descKey: 'aboutTracker.pillarSleepDesc' },
] as const;

export const AboutTracker: React.FC<AboutTrackerProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  useSEO(`${t('aboutTracker.title')} · MFU Longevity Passport`, 'Learn the science behind the Longevity Passport scoring system.');

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('profile')} ariaLabel={t('common.back')} />
        <h1 className="header-title text-gradient">{t('aboutTracker.title')}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4">
        {/* University Info */}
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-24 h-24 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 shadow-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
            <span className="text-5xl" style={{ color: 'var(--accent)' }}><FaGraduationCap /></span>
          </div>
          <h2 className="text-2xl font-black leading-tight">MFU Longevity Passport</h2>
          <p className="text-sm mt-2" style={{ color: 'var(--text-secondary)' }}>{t('aboutTracker.subtitle')}</p>
        </div>

        {/* The 4 Pillars */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest pl-2" style={{ color: 'var(--text-secondary)' }}>{t('aboutTracker.pillarsHeading')}</h3>
          <div className="grid grid-cols-2 gap-4">
            {PILLARS.map((pillar) => (
              <div key={pillar.key} className="glass-card p-4 rounded-2xl flex flex-col items-center text-center" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
                <span className="text-4xl mb-3" style={{ color: 'var(--accent)' }}>{pillar.icon}</span>
                <div className="font-bold text-base">{t(pillar.titleKey)}</div>
                <p className="text-xs mt-2 leading-relaxed break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>{t(pillar.descKey)}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scientific Foundation */}
        <div className="glass-card p-6 rounded-3xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon"><FaFlask /></span>
            <span className="section-title font-bold">{t('aboutTracker.methodHeading')}</span>
          </div>
          <div className="space-y-4 text-sm leading-relaxed break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>
            {/* Emphasised fragments are separate keys so each language keeps its own word order. */}
            <p>
              {t('aboutTracker.methodP1a')}<strong>{t('aboutTracker.methodP1b')}</strong>{t('aboutTracker.methodP1c')}
            </p>
            <p>
              {t('aboutTracker.methodP2a')}<strong>{t('aboutTracker.methodP2b')}</strong>{t('aboutTracker.methodP2c')}<strong>{t('aboutTracker.methodP2d')}</strong>{t('aboutTracker.methodP2e')}
            </p>
          </div>
        </div>

        {/* Legal/Links */}
        <div className="pt-6 border-t flex flex-wrap justify-center gap-4 text-xs font-bold uppercase tracking-tighter" style={{ borderTopColor: 'var(--border-glass)', color: 'var(--text-accent)' }}>
          <button type="button" className="hover:underline" style={{ color: 'inherit' }} onClick={() => onNavigate('privacy-settings')}>
            {t('aboutTracker.privacyPolicy')}
          </button>
        </div>

        <div className="text-center text-xs pb-10" style={{ color: 'var(--text-secondary)' }}>
          {t('aboutTracker.copyright')}
        </div>
      </div>

      <BottomNav
        active="profile"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
      />
    </div>
  );
};
