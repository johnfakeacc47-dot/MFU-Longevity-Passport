import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface SetGoalsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const SetGoals: React.FC<SetGoalsProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [fastingGoal, setFastingGoal] = useState(16);
  const [sleepGoal, setSleepGoal] = useState(8);
  const [activityGoal, setActivityGoal] = useState(30);

  const saveGoals = () => {
    alert('Goals saved successfully!');
    onNavigate('profile');
  };

  const getHealthPotential = () => {
    let score = 0;
    if (fastingGoal >= 16) score += 34;
    if (sleepGoal >= 7 && sleepGoal <= 9) score += 33;
    if (activityGoal >= 45) score += 33;
    return score;
  };

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <button className="back-btn" onClick={() => onNavigate('profile')}>←</button>
        <h1 className="header-title text-gradient">Set Health Goals</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-6">
        {/* Health Potential Indicator */}
        <div className="glass-card p-6 rounded-2xl text-center">
          <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Longevity Potential</div>
          <div className="text-4xl font-black text-purple-700 mb-1">{getHealthPotential()}%</div>
          <div className="text-[10px] text-gray-400">Based on your current daily targets</div>
          <div className="w-full bg-gray-200 h-1.5 rounded-full mt-4 overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-purple-500 to-indigo-600 transition-all duration-500"
              style={{ width: `${getHealthPotential()}%` }}
            ></div>
          </div>
        </div>

        {/* Fasting Goal */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon">⏳</span>
              <span className="section-title text-black font-bold">Fasting Window</span>
            </div>
            <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-1 rounded-lg">{fastingGoal} hrs</span>
          </div>
          <input 
            type="range" min="12" max="22" step="1" 
            className="w-full accent-purple-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={fastingGoal}
            onChange={(e) => setFastingGoal(parseInt(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-2">
            <span>12h</span>
            <span>16h (Optimal)</span>
            <span>22h</span>
          </div>
          <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
            <p className="text-[11px] text-blue-700 leading-tight">
              <strong>Tip:</strong> 16+ hours promotes <strong>autophagy</strong>, a key cellular cleanup process linked to longevity.
            </p>
          </div>
        </div>

        {/* Sleep Goal */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon">😴</span>
              <span className="section-title text-black font-bold">Sleep Target</span>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">{sleepGoal} hrs</span>
          </div>
          <input 
            type="range" min="4" max="10" step="0.5" 
            className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={sleepGoal}
            onChange={(e) => setSleepGoal(parseFloat(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-2">
            <span>4h</span>
            <span>8h (Recommended)</span>
            <span>10h</span>
          </div>
          <div className="mt-4 p-3 bg-indigo-50/50 rounded-xl border border-indigo-100/50">
            <p className="text-[11px] text-indigo-700 leading-tight">
              <strong>Science:</strong> Consistent 7-9 hours of sleep is crucial for cognitive preservation and DNA repair.
            </p>
          </div>
        </div>

        {/* Activity Goal */}
        <div className="glass-card p-6 rounded-2xl">
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon">🏃</span>
              <span className="section-title text-black font-bold">Active Minutes</span>
            </div>
            <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-1 rounded-lg">{activityGoal} min</span>
          </div>
          <input 
            type="range" min="15" max="120" step="5" 
            className="w-full accent-green-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={activityGoal}
            onChange={(e) => setActivityGoal(parseInt(e.target.value))}
          />
          <div className="flex justify-between text-[10px] text-gray-400 mt-2">
            <span>15m</span>
            <span>45m+ (Moderate)</span>
            <span>120m</span>
          </div>
          <div className="mt-4 p-3 bg-green-50/50 rounded-xl border border-green-100/50">
            <p className="text-[11px] text-green-700 leading-tight">
              <strong>Impact:</strong> Target 150+ minutes of moderate activity per week to maintain metabolic health.
            </p>
          </div>
        </div>

        <button className="w-full py-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-purple-200 active:scale-[0.98] transition-all" onClick={saveGoals}>
          Save My Strategy
        </button>
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
