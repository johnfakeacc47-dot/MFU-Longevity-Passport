import React, { useState } from 'react';
import { FaBed, FaBolt, FaHourglassHalf, FaRunning } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';

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

  const healthPotential = getHealthPotential();
  const fastingPct = Math.round(((fastingGoal - 12) / (22 - 12)) * 100);
  const sleepPct = Math.round(((sleepGoal - 4) / (10 - 4)) * 100);
  const activityPct = Math.round(((activityGoal - 15) / (120 - 15)) * 100);

  const potentialTone =
    healthPotential >= 85 ? 'Excellent' :
    healthPotential >= 60 ? 'Strong' :
    healthPotential >= 35 ? 'Building' : 'Starter';

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('profile')} ariaLabel="Go back to profile" />
        <h1 className="header-title text-gradient">Set Health Goals</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-6">
        {/* Health Potential Indicator */}
        <div
          className="glass-card p-6 rounded-2xl"
          style={{
            padding: '1.5rem',
            height: 'auto',
            minHeight: 'fit-content',
            background: 'linear-gradient(160deg, rgba(255,255,255,0.92), rgba(225,242,255,0.92))',
            border: '1px solid rgba(148, 200, 255, 0.45)'
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-sm font-black text-blue-700 uppercase tracking-wider mb-1">Longevity Potential</div>
              <div className="text-xs text-blue-500">Based on your current daily targets</div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-black text-blue-700" style={{ background: 'rgba(33, 150, 243, 0.14)' }}>
              {potentialTone}
            </div>
          </div>

          <div className="flex items-end justify-between mb-3">
            <div className="text-4xl font-black text-blue-700 leading-none">{healthPotential}%</div>
            <div className="text-xs font-bold text-blue-500 uppercase tracking-wider">Projected health arc</div>
          </div>

          <div className="w-full bg-gray-200 h-2 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-blue-800 transition-all duration-500"
              style={{ width: `${healthPotential}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(33, 150, 243, 0.08)' }}>
              <div className="text-[10px] text-blue-500 uppercase font-black">Fasting</div>
              <div className="text-sm font-black text-blue-700">{fastingGoal}h</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(33, 150, 243, 0.08)' }}>
              <div className="text-[10px] text-blue-500 uppercase font-black">Sleep</div>
              <div className="text-sm font-black text-blue-700">{sleepGoal}h</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: 'rgba(33, 150, 243, 0.08)' }}>
              <div className="text-[10px] text-blue-500 uppercase font-black">Activity</div>
              <div className="text-sm font-black text-blue-700">{activityGoal}m</div>
            </div>
          </div>
        </div>

        {/* Fasting Goal */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content', border: '1px solid rgba(148, 200, 255, 0.5)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon"><FaHourglassHalf /></span>
              <span className="section-title text-black font-bold">Fasting Window</span>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">{fastingGoal} hrs</span>
          </div>
          <input 
            type="range" min="12" max="22" step="1" 
            className="w-full accent-blue-700 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={fastingGoal}
            onChange={(e) => setFastingGoal(parseInt(e.target.value))}
          />
          <div className="h-1.5 rounded-full bg-blue-100 mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-sky-500 to-blue-700 transition-all duration-500" style={{ width: `${fastingPct}%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>12h</span>
            <span>16h (Optimal)</span>
            <span>22h</span>
          </div>
          <div className="mt-4 p-3 bg-blue-50/60 rounded-xl border border-blue-200/60">
            <p className="text-sm text-blue-800 leading-tight">
              <strong>Tip:</strong> 16+ hours promotes <strong>autophagy</strong>, a key cellular cleanup process linked to longevity.
            </p>
          </div>
        </div>

        {/* Sleep Goal */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content', border: '1px solid rgba(148, 200, 255, 0.5)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon"><FaBed /></span>
              <span className="section-title text-black font-bold">Sleep Target</span>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">{sleepGoal} hrs</span>
          </div>
          <input 
            type="range" min="4" max="10" step="0.5" 
            className="w-full accent-blue-700 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={sleepGoal}
            onChange={(e) => setSleepGoal(parseFloat(e.target.value))}
          />
          <div className="h-1.5 rounded-full bg-blue-100 mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-700 transition-all duration-500" style={{ width: `${sleepPct}%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>4h</span>
            <span>8h (Recommended)</span>
            <span>10h</span>
          </div>
          <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100/60">
            <p className="text-sm text-blue-700 leading-tight">
              <strong>Science:</strong> Consistent 7-9 hours of sleep is crucial for cognitive preservation and DNA repair.
            </p>
          </div>
        </div>

        {/* Activity Goal */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content', border: '1px solid rgba(148, 200, 255, 0.5)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon"><FaRunning /></span>
              <span className="section-title text-black font-bold">Active Minutes</span>
            </div>
            <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-lg">{activityGoal} min</span>
          </div>
          <input 
            type="range" min="15" max="120" step="5" 
            className="w-full accent-blue-600 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            value={activityGoal}
            onChange={(e) => setActivityGoal(parseInt(e.target.value))}
          />
          <div className="h-1.5 rounded-full bg-blue-100 mt-3 overflow-hidden">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-700 transition-all duration-500" style={{ width: `${activityPct}%` }}></div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-2">
            <span>15m</span>
            <span>45m+ (Moderate)</span>
            <span>120m</span>
          </div>
          <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100/50">
            <p className="text-sm text-blue-700 leading-tight">
              <strong>Impact:</strong> Target 150+ minutes of moderate activity per week to maintain metabolic health.
            </p>
          </div>
        </div>

        <button
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-800 text-white font-black text-sm shadow-xl shadow-blue-200 active:scale-[0.98] transition-all"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px' }}
          onClick={saveGoals}
        >
          <FaBolt aria-hidden="true" />
          Save My Strategy
        </button>
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
