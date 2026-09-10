import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { FaChevronRight } from 'react-icons/fa';
import { GardenPlant } from '../components/garden/GardenPlant';
import { STAGE_NAME_KEYS, type GrowthStage } from '../utils/growthStage';

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile'
  | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker' | 'about-garden' | 'settings';

interface AboutGardenProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

// One "good day" breakdown, reused across every preview tree on this page —
// this is an explainer, not live data, so it stays constant throughout.
const GOOD_DAY = { nutrition: 22, exercise: 21, sleep: 23, mental: 20 };

const PILLARS = [
  { key: 'soil', color: '#10B981', titleKey: 'aboutGarden.pillarSoilTitle', descKey: 'aboutGarden.pillarSoilDesc' },
  { key: 'branches', color: '#F59E0B', titleKey: 'aboutGarden.pillarBranchesTitle', descKey: 'aboutGarden.pillarBranchesDesc' },
  { key: 'bloom', color: '#3B82F6', titleKey: 'aboutGarden.pillarBloomTitle', descKey: 'aboutGarden.pillarBloomDesc' },
  { key: 'aura', color: '#8B5CF6', titleKey: 'aboutGarden.pillarAuraTitle', descKey: 'aboutGarden.pillarAuraDesc' },
] as const;

const STAGE_DESC_KEYS: Record<GrowthStage, string> = {
  0: 'aboutGarden.stageSeedDesc',
  1: 'aboutGarden.stageSproutDesc',
  2: 'aboutGarden.stageSaplingDesc',
  3: 'aboutGarden.stageYoungTreeDesc',
  4: 'aboutGarden.stageMatureTreeDesc',
};

export const AboutGarden: React.FC<AboutGardenProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  useSEO(`${t('aboutGarden.title')} · MFU Longevity Passport`, 'How the Longevity Garden turns your 4 health pillars into a growing Lamduan tree.');

  const whereRows: Array<{ key: string; labelKey: string; page: PageType }> = [
    { key: 'home', labelKey: 'aboutGarden.whereHome', page: 'home' },
    { key: 'dashboard', labelKey: 'aboutGarden.whereDashboard', page: 'dashboard' },
    { key: 'team', labelKey: 'aboutGarden.whereTeam', page: 'team' },
  ];

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('profile')} ariaLabel="Go back to profile" />
        <h1 className="header-title text-gradient">{t('aboutGarden.title')}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-8">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center text-center py-4">
          <GardenPlant breakdown={GOOD_DAY} stage={4} size={140} title={t('aboutGarden.title')} />
          <h2 className="text-2xl font-black leading-tight mt-2">{t('aboutGarden.heroTitle')}</h2>
          <p className="text-sm mt-2 max-w-sm" style={{ color: 'var(--text-secondary)' }}>{t('aboutGarden.heroSubtitle')}</p>
        </div>

        {/* The 4 pillars */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest pl-2" style={{ color: 'var(--text-secondary)' }}>
            {t('aboutGarden.pillarsHeading')}
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {PILLARS.map((p) => (
              <div key={p.key} className="glass-card p-4 rounded-2xl" style={{ padding: '1.25rem', height: 'auto', minHeight: 'fit-content' }}>
                <span className="inline-block w-3 h-3 rounded-full mb-3" style={{ background: p.color }} />
                <div className="font-bold text-sm">{t(p.titleKey)}</div>
                <p className="text-xs mt-2 leading-relaxed break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>
                  {t(p.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Growth stage vs. today's pillars */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest pl-2" style={{ color: 'var(--text-secondary)' }}>
            {t('aboutGarden.growthHeading')}
          </h3>
          <div className="glass-card p-6 rounded-3xl space-y-4" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
            <div>
              <div className="font-bold text-sm">{t('aboutGarden.growthStageTitle')}</div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('aboutGarden.growthStageDesc')}</p>
            </div>
            <div>
              <div className="font-bold text-sm">{t('aboutGarden.growthTodayTitle')}</div>
              <p className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{t('aboutGarden.growthTodayDesc')}</p>
            </div>
          </div>
        </div>

        {/* The 5 stages */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest pl-2" style={{ color: 'var(--text-secondary)' }}>
            {t('aboutGarden.stagesHeading')}
          </h3>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {([0, 1, 2, 3, 4] as GrowthStage[]).map((stage) => (
              <div key={stage} className="flex flex-col items-center gap-1" style={{ minWidth: 84 }}>
                <div className="glass-card rounded-2xl flex items-center justify-center" style={{ width: 84, height: 96 }}>
                  <GardenPlant breakdown={GOOD_DAY} stage={stage} size={56} />
                </div>
                <span className="text-xs font-bold text-center">{t(STAGE_NAME_KEYS[stage])}</span>
                <span className="text-[11px] text-center leading-tight" style={{ color: 'var(--text-secondary)' }}>{t(STAGE_DESC_KEYS[stage])}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Where to find it */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest pl-2" style={{ color: 'var(--text-secondary)' }}>
            {t('aboutGarden.whereHeading')}
          </h3>
          <div className="glass-card rounded-3xl overflow-hidden" style={{ height: 'auto', minHeight: 'fit-content' }}>
            {whereRows.map((row, i) => (
              <button
                key={row.key}
                type="button"
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
                style={{ borderTop: i === 0 ? 'none' : '1px solid var(--border-glass)' }}
                onClick={() => onNavigate(row.page)}
              >
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{t(row.labelKey)}</span>
                <FaChevronRight className="text-slate-400 text-sm flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>

      <BottomNav
        active="profile"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
        className="bottom-nav glass-card"
      />
    </div>
  );
};
