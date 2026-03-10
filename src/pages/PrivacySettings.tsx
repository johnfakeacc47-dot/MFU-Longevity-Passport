import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface PrivacySettingsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [shareScore, setShareScore] = useState(true);
  const [shareHabits, setShareHabits] = useState(false);
  const [anonymousAI, setAnonymousAI] = useState(true);

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <button className="back-btn" onClick={() => onNavigate('profile')}>←</button>
        <h1 className="header-title text-gradient">Privacy & Data</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-6">
        {/* Main Controls */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="section-header mb-6">
            <span className="section-icon">🛡️</span>
            <span className="section-title text-black font-bold">Sharing Preferences</span>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm text-gray-900">Share Longevity Score</div>
                <div className="text-xs text-gray-500 mt-1">Allow team members to see your overall score.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={shareScore} onChange={(e) => setShareScore(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/50">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm text-gray-900">Share Detailed Habits</div>
                <div className="text-xs text-gray-500 mt-1">Visible to team members during shared missions.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={shareHabits} onChange={(e) => setShareHabits(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/50">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm text-gray-900">AI Model Contribution</div>
                <div className="text-xs text-gray-500 mt-1">Share anonymous corrections to improve food recognition.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={anonymousAI} onChange={(e) => setAnonymousAI(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Your Rights Section */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="section-header mb-4">
            <span className="section-icon">📜</span>
            <span className="section-title text-black font-bold">Your Rights (PDPA)</span>
          </div>
          <div className="grid grid-cols-1 gap-4 mt-4">
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="text-xs font-bold text-gray-800">Right to Access</div>
              <p className="text-[11px] text-gray-600 mt-1">You can request a copy of all personal data we store about you at any time.</p>
            </div>
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="text-xs font-bold text-gray-800">Right to Erasure</div>
              <p className="text-[11px] text-gray-600 mt-1">You have the right to request permanent deletion of your health records.</p>
            </div>
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="text-xs font-bold text-gray-800">Data Portability</div>
              <p className="text-[11px] text-gray-600 mt-1">Export your activity and nutrition history in standard digital formats.</p>
            </div>
          </div>
        </div>

        {/* Policy Summary */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="section-header mb-4">
            <span className="section-icon">📋</span>
            <span className="section-title text-black font-bold">Policy Summary</span>
          </div>
          <p className="text-xs text-gray-600 leading-relaxed">
            The MFU Longevity Passport collects health-related data solely to calculate your longevity score and provide personalized wellness insights. 
            <br/><br/>
            We use industry-standard encryption to protect your data. Your specific health logs are <strong>never</strong> shared with third parties without your explicit consent.
          </p>
          <button className="mt-4 text-xs font-bold text-purple-700 underline">Read Full Privacy Policy</button>
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/30">
          <h3 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h3>
          <p className="text-xs text-gray-500 mb-4">Deleting your account will remove all health history from our servers. This action is irreversible.</p>
          <button className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-200 active:scale-95 transition-transform">
            Delete My Account & Data
          </button>
        </div>
      </div>

      <footer className="bottom-nav glass-card" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition}>
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('dashboard')}>
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('team')}>
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('profile')}>
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};

