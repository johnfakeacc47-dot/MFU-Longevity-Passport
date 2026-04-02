import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface AboutTrackerProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const AboutTracker: React.FC<AboutTrackerProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();

  const pillars = [
    { title: 'Nutrition', emoji: '🥗', desc: 'Personalized AI-tracking to optimize nutrient density and caloric balance.', color: '#4caf50' },
    { title: 'Fasting', emoji: '⏳', desc: 'Harnessing autophagy and metabolic flexibility through structured windows.', color: '#2196f3' },
    { title: 'Activity', emoji: '🏃', desc: 'Enhancing mitochondrial health and VO2 max via consistent movement.', color: '#ff9800' },
    { title: 'Sleep', emoji: '😴', desc: 'Critical regenerative phases for cognitive health and DNA repair.', color: '#673ab7' },
  ];

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <button className="back-btn" onClick={() => onNavigate('profile')} aria-label="Go back to profile">←</button>
        <h1 className="header-title text-gradient">The Science</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-8">
        {/* University Info */}
        <div className="flex flex-col items-center justify-center text-center py-8">
          <div className="w-24 h-24 bg-white/50 backdrop-blur-md rounded-3xl flex items-center justify-center mb-4 shadow-xl border border-white">
            <span className="text-5xl">🎓</span>
          </div>
          <h2 className="text-2xl font-black text-gray-900 leading-tight">MFU Longevity Passport</h2>
          <p className="text-gray-500 text-sm mt-2">Mae Fah Luang University Research Project</p>
        </div>

        {/* The 4 Pillars */}
        <div className="space-y-4">
          <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest pl-2">The Four Pillars</h3>
          <div className="grid grid-cols-2 gap-4">
            {pillars.map((pillar) => (
              <div key={pillar.title} className="glass-card p-4 rounded-2xl flex flex-col items-center text-center" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
                <span className="text-4xl mb-3">{pillar.emoji}</span>
                <div className="font-bold text-base text-gray-900">{pillar.title}</div>
                <p className="text-xs text-gray-500 mt-2 leading-relaxed break-words" style={{ overflowWrap: 'break-word' }}>{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scientific Foundation */}
        <div className="glass-card p-6 rounded-3xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon">🔬</span>
            <span className="section-title text-gray-900 font-bold">Research Methodology</span>
          </div>
          <div className="space-y-4 text-sm text-gray-600 leading-relaxed break-words" style={{ overflowWrap: 'break-word' }}>
            <p>
              Our Longevity Score is derived from the **"Blue Zones"** lifestyle research and modern geroscience. We analyze real-time data to provide a holistic view of your health trajectory.
            </p>
            <p>
              Developed by the **School of Information Technology** and **School of Medicine** at MFU, this platform integrates advanced AI and clinical insights to democratize longevity.
            </p>
          </div>
        </div>

        {/* Legal/Links */}
        <div className="pt-6 border-t border-gray-200 flex flex-wrap justify-center gap-4 text-xs font-bold text-blue-600 uppercase tracking-tighter">
          <button className="hover:underline" aria-label="View Terms of Service">Terms of Service</button>
          <span>•</span>
          <button className="hover:underline" aria-label="View Privacy Policy">Privacy Policy (PDPA)</button>
          <span>•</span>
          <button className="hover:underline" aria-label="View API Documentation">API Documentation</button>
        </div>

        <div className="text-center text-xs text-gray-400 pb-10">
          © 2026 Mae Fah Luang University. All rights reserved.
        </div>
      </div>

      <footer className="bottom-nav glass-card" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <button className="nav-icon" onClick={() => onNavigate('home')} aria-label="Home">
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition} aria-label="Food Recognition">
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('dashboard')} aria-label="Dashboard">
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('team')} aria-label="My Team">
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('profile')} aria-label="Profile">
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
