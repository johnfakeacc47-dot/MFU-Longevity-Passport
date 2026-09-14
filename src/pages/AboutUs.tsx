import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { FaEnvelope, FaPhone, FaExternalLinkAlt, FaBook, FaHeart } from 'react-icons/fa';

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile'
  | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker' | 'about-garden' | 'about-us' | 'settings';

interface AboutUsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const REPO_URL = 'https://github.com/johnfakeacc47-dot/MFU-Longevity-Passport';

interface Person {
  name: string;
  roleKey: string;
  email: string;
  phone?: string;
  link?: string;
}

const ADVISOR: Person = {
  name: 'Vittayasak Rujivorakul',
  roleKey: 'aboutUs.advisorRole',
  email: 'vittayasak@mfu.ac.th',
  phone: '053916809',
  link: 'https://en.mfu.ac.th/about-mfu/administration/executive-staff/president-vice-president.html',
};

const STUDENTS: Person[] = [
  { name: 'Myat Kaung Thant', roleKey: 'aboutUs.studentRole', email: '6431503120@lamduan.mfu.ac.th' },
  { name: 'Phorn Potjanasuj', roleKey: 'aboutUs.studentRole', email: '6631503029@lamduan.mfu.ac.th' },
  { name: 'Phichayathida Laeae', roleKey: 'aboutUs.studentRole', email: '6631503030@lamduan.mfu.ac.th' },
];

const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export const AboutUs: React.FC<AboutUsProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  useSEO(`${t('aboutUs.title')} · MFU Longevity Passport`, 'The team and mission behind MFU Longevity Passport.');

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('settings')} ariaLabel={t('common.back')} />
        <h1 className="header-title text-gradient">{t('aboutUs.title')}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-8">
        {/* Hero */}
        <div className="flex flex-col items-center justify-center text-center py-4">
          <img src="/mfu-logo.png" alt="Mae Fah Luang University" className="about-us-crest" />
          <h2 className="text-2xl font-black leading-tight mt-3">MFU Longevity Passport</h2>
          <p className="text-sm mt-2 max-w-sm" style={{ color: 'var(--text-secondary)' }}>{t('aboutUs.heroSubtitle')}</p>
        </div>

        {/* Mission */}
        <div className="glass-card p-6 rounded-3xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon"><FaHeart /></span>
            <span className="section-title font-bold">{t('aboutUs.missionHeading')}</span>
          </div>
          <p className="text-sm leading-relaxed break-words" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>
            {t('aboutUs.missionBody')}
          </p>
        </div>

        {/* Team */}
        <div className="space-y-4">
          <h3 className="text-sm font-black uppercase tracking-widest pl-2" style={{ color: 'var(--text-secondary)' }}>
            {t('aboutUs.teamHeading')}
          </h3>

          {/* Org chart: advisor at the top, all 3 students one level below,
              connected by lines. Collapses to a single connected column on
              narrow screens rather than trying to force 3 cramped columns. */}
          <div className="org-chart">
            <a
              href={ADVISOR.link}
              target="_blank"
              rel="noopener noreferrer"
              className="about-us-person about-us-person--advisor org-chart-advisor"
            >
              <span className="about-us-avatar about-us-avatar--advisor">{initialsOf(ADVISOR.name)}</span>
              <span className="about-us-person-text">
                <span className="about-us-person-name">{ADVISOR.name}</span>
                <span className="about-us-person-role">{t(ADVISOR.roleKey)}</span>
                <span className="about-us-person-contacts">
                  <span className="about-us-contact"><FaEnvelope /> {ADVISOR.email}</span>
                  {ADVISOR.phone && (
                    <span className="about-us-contact"><FaPhone /> {ADVISOR.phone.replace(/^0(\d{2})(\d{3})(\d{4})$/, '0 $1 $2 $3')}</span>
                  )}
                </span>
              </span>
              <FaExternalLinkAlt className="about-us-external-icon" />
            </a>

            <div className="org-chart-trunk" aria-hidden="true" />

            <div className="org-chart-children">
              {STUDENTS.map((s) => (
                <div key={s.email} className="org-chart-child">
                  <span className="org-chart-child-stub" aria-hidden="true" />
                  <a href={`mailto:${s.email}`} className="about-us-person about-us-person--student">
                    <span className="about-us-avatar">{initialsOf(s.name)}</span>
                    <span className="about-us-person-text">
                      <span className="about-us-person-name">{s.name}</span>
                      <span className="about-us-person-role">{t(s.roleKey)}</span>
                      <span className="about-us-contact"><FaEnvelope /> {s.email}</span>
                    </span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Documentation */}
        <div className="glass-card p-6 rounded-3xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon"><FaBook /></span>
            <span className="section-title font-bold">{t('aboutUs.documentationHeading')}</span>
          </div>
          <p className="text-sm leading-relaxed break-words mb-4" style={{ overflowWrap: 'break-word', color: 'var(--text-secondary)' }}>
            {t('aboutUs.documentationDesc')}
          </p>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="pv-policy-link">
            {t('aboutUs.viewSource')}
            <FaExternalLinkAlt />
          </a>
        </div>

        <div className="text-center text-xs pb-10" style={{ color: 'var(--text-secondary)' }}>
          {t('aboutUs.footerLine')}
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
