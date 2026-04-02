import React, { useState, useEffect } from 'react';

import { useLanguage } from '../contexts/LanguageContext';
import { calculateLongevityScore, getScoreColor, getScoreLabel, LONGEVITY_FACTORS } from '../utils/longevityScore';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { supabase, isSupabaseConfigured, getTodayHealthScore, getCurrentUserProfile } from '../services/supabaseClient';
import { calculateBMI, getBMICategory, calculateBMR, calculateDailyCalorieNeeds, estimateFutureWeight } from '../utils/healthCalculations';
import { Icon } from '../components/Icon';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'activity' | 'sleep'

interface DashboardProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(calculateLongevityScore());
  const [isLiveDB, setIsLiveDB] = useState(false);
  const [profile, setProfile] = useState<{ weight_kg?: number; height_cm?: number; gender?: string } | null>(null);

  useEffect(() => {
    const fetchScore = async () => {
      // 1. Try Supabase first if configured
      if (isSupabaseConfigured()) {
        const { data: { user } } = await supabase!.auth.getUser();
        setIsLiveDB(!!user);

        const dbScore = await getTodayHealthScore();
        if (dbScore) {
          setScore({
            sleep: dbScore.sleep,
            nutrition: dbScore.nutrition,
            fasting: dbScore.fasting,
            activity: dbScore.activity,
            total: dbScore.total
          });
          
          const dbProfile = await getCurrentUserProfile();
          if (dbProfile) setProfile(dbProfile);
          return;
        }
      } else {
        setIsLiveDB(false);
      }

      // 2. Fallback to API or Local
      if (isApiConfigured) {
        try {
          const data = await healthApi.getTodayScore();
          setScore(data);
          return;
        } catch (error) {
          console.error('Failed to load score from API', error);
        }
      }

      setScore(calculateLongevityScore());
    };

    fetchScore();

    // Recalculate score every minute
    const interval = setInterval(() => {
      fetchScore();
    }, 60000);
    const handleHealthUpdate = () => {
      fetchScore();
    };

    window.addEventListener('healthDataUpdated', handleHealthUpdate);
    window.addEventListener('storage', handleHealthUpdate);

    return () => {
      clearInterval(interval);
      window.removeEventListener('healthDataUpdated', handleHealthUpdate);
      window.removeEventListener('storage', handleHealthUpdate);
    };
  }, []);

  const scoreLabelKey = (() => {
    const label = getScoreLabel(score.total);
    if (label === 'Excellent') return 'longevity.excellent';
    if (label === 'Good') return 'longevity.good';
    if (label === 'Fair') return 'longevity.fair';
    return 'longevity.needsImprovement';
  })();

  const getPillarStatusKey = (value: number) => {
    if (value >= 20) return 'excellent';
    if (value >= 15) return 'good';
    if (value >= 10) return 'fair';
    return 'poor';
  };

  const getPillarRecommendationKey = (pillar: 'sleep' | 'nutrition' | 'fasting' | 'activity', value: number) => {
    const status = getPillarStatusKey(value);
    return `dashboard.${pillar}.${status}`;
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-top-header">
        <button className="back-btn" onClick={() => onNavigate('home')} aria-label="Go back home">←</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 className="header-title">{t('dashboard.title')}</h1>
          {isLiveDB ? (
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              {t('home.synced')}
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              {t('home.offline')}
            </div>
          )}
        </div>
        <button className="menu-btn" aria-label="Open menu">⋮</button>
      </header>
      

      <div className="dashboard-content page-content">
        {/* Longevity Score Card */}
        <div className="longevity-score-card">
          <div className="score-header">
            <h2>{t('longevity.title')}</h2>
            <div className="score-date">
              {new Date().toLocaleDateString(t('locale') || 'en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </div>
          </div>
          
          <div className="score-display">
            <div className="score-circle" style={{ borderColor: getScoreColor(score.total) }}>
              <div className="score-value" style={{ color: getScoreColor(score.total) }}>
                {score.total}
              </div>
              <div className="score-label">{t(scoreLabelKey)}</div>
            </div>
            
            <div className="score-breakdown">
              <div className="breakdown-title">{t('longevity.breakdown')} · 4 Pillars · 25pts each</div>
              {LONGEVITY_FACTORS.map((factor) => {
                const value = (score as unknown as Record<string, number>)[factor.key] ?? 0;
                return (
                  <div className="breakdown-item" key={factor.key}>
                    <div className="breakdown-label" title={factor.description}>
                      <Icon name={factor.key as React.ComponentProps<typeof Icon>['name']} size={16} className="mr-2" color={factor.color} />
                      {t(`dashboard.${factor.key}`)}
                    </div>
                    <div className="breakdown-bar">
                      <div
                        className={`breakdown-fill ${factor.key}`}
                        style={{ width: `${(value / 25) * 100}%`, backgroundColor: factor.color }}
                      />
                    </div>
                    <div className="breakdown-score" style={{ color: factor.color }}>{value}/25</div>
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Trend Sparkline */}
          <div className="mt-4 pt-4 border-t border-blue-100/30">
            <div className="flex justify-between items-center mb-2">
              <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{t('dashboard.weekly')} {t('dashboard.total')} Trend</span>
              <span className="text-[10px] font-bold text-green-500">{t('dashboard.vsLastWeek').replace('{percent}', '+12%')}</span>
            </div>
            <svg viewBox="0 0 100 20" className="w-full h-8 overflow-visible">
              <path
                d="M 0,15 L 15,12 L 30,17 L 45,10 L 60,11 L 75,5 L 90,8 L 100,2"
                fill="none"
                stroke="#0ea5e9"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="100" cy="2" r="1.5" fill="#0ea5e9" />
            </svg>
          </div>
        </div>

        {/* Health Summary Card (BMI & Calories) */}
        <div className="mb-6 p-6 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Icon name="health" size={20} color="#0ea5e9" />
            <h3 className="text-sm font-bold text-gray-900 tracking-wide">{t('dashboard.healthInsights')}</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-5 bg-gray-50 rounded-xl">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('dashboard.currentBMI')}</div>
              <div className="text-2xl font-black text-gray-900 leading-none mb-1">
                {profile?.weight_kg && profile?.height_cm ? calculateBMI(profile.weight_kg, profile.height_cm) : '--'}
              </div>
              <div className="text-[12px] font-medium text-blue-600">
                {profile?.weight_kg && profile?.height_cm ? t(getBMICategory(calculateBMI(profile.weight_kg, profile.height_cm)!)) : t('dashboard.setWeightInProfile')}
              </div>
            </div>
            <div className="p-5 bg-gray-50 rounded-xl">
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider mb-1">{t('dashboard.dailyCalories')}</div>
              <div className="text-2xl font-black text-gray-900 leading-none mb-1">
                {profile?.weight_kg && profile?.height_cm ? calculateDailyCalorieNeeds(calculateBMR(profile.weight_kg, profile.height_cm, 20, profile.gender || 'male')!) : '1,850'}
              </div>
              <div className="text-[12px] font-medium text-emerald-600">{t('dashboard.kcalPerDayTarget')}</div>
            </div>
          </div>
          
          {/* Future Weight Projection */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="activity" size={14} color="#0ea5e9" />
              <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">{t('dashboard.futureProjection')}</span>
            </div>
            <p className="text-xs text-gray-600 leading-relaxed">
              {t('dashboard.futureProjectionDesc')} 
              <span className="ml-1 font-bold text-gray-900 text-sm">
                {profile?.weight_kg ? estimateFutureWeight(profile.weight_kg, 500, 4) : '--'} kg
              </span>
            </p>
          </div>
        </div>



        {/* Scoring Explanation Section */}
        <div className="mb-6 p-6 rounded-xl bg-white shadow-sm">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="health" size={20} color="#0ea5e9" />
            <h3 className="text-sm font-bold text-gray-900 tracking-wide">{t('dashboard.howScoringWorks')}</h3>
          </div>
          <p className="text-xs text-gray-600 mb-6 leading-relaxed">
            {t('dashboard.scoringDesc')}
          </p>
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div>
                <span className="text-sm font-semibold text-gray-800">80 - 100</span>
              </div>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-md">{t('longevity.excellent')}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div>
                <span className="text-sm font-semibold text-gray-800">60 - 79</span>
              </div>
              <span className="text-xs font-semibold text-amber-600 bg-amber-50 px-3 py-1.5 rounded-md">{t('longevity.good')}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-2.5 h-2.5 rounded-full bg-rose-500"></div>
                <span className="text-sm font-semibold text-gray-800">{t('dashboard.below60')}</span>
              </div>
              <span className="text-xs font-semibold text-rose-600 bg-rose-50 px-3 py-1.5 rounded-md">{t('dashboard.needsFocus')}</span>
            </div>
          </div>
        </div>

        <div className="section-title">{t('dashboard.summary')}</div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">{t('dashboard.sleep')}</h4>
            <div className="metric-score">
              <span className="score-value">{score.sleep}</span>
              <span className={`score-trend ${getPillarStatusKey(score.sleep) === 'poor' ? 'down' : 'up'}`}>
                {getPillarStatusKey(score.sleep) === 'poor' ? '📉' : '📈'} {t(`dashboard.status.${getPillarStatusKey(score.sleep)}`)}
              </span>
            </div>
          </div>
          <p className="metric-description">{t(getPillarRecommendationKey('sleep', score.sleep))}</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">{t('dashboard.nutrition')}</h4>
            <div className="metric-score">
              <span className="score-value">{score.nutrition}</span>
              <span className={`score-trend ${getPillarStatusKey(score.nutrition) === 'poor' ? 'down' : 'up'}`}>
                {getPillarStatusKey(score.nutrition) === 'poor' ? '📉' : '📈'} {t(`dashboard.status.${getPillarStatusKey(score.nutrition)}`)}
              </span>
            </div>
          </div>
          <p className="metric-description">{t(getPillarRecommendationKey('nutrition', score.nutrition))}</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">{t('dashboard.fasting')}</h4>
            <div className="metric-score">
              <span className="score-value">{score.fasting}</span>
              <span className={`score-trend ${getPillarStatusKey(score.fasting) === 'poor' ? 'down' : 'up'}`}>
                {getPillarStatusKey(score.fasting) === 'poor' ? '📉' : '📈'} {t(`dashboard.status.${getPillarStatusKey(score.fasting)}`)}
              </span>
            </div>
          </div>
          <p className="metric-description">{t(getPillarRecommendationKey('fasting', score.fasting))}</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <h4 className="metric-title">{t('dashboard.exercise')}</h4>
            <div className="metric-score">
              <span className="score-value">{score.activity}</span>
              <span className={`score-trend ${getPillarStatusKey(score.activity) === 'poor' ? 'down' : 'up'}`}>
                {getPillarStatusKey(score.activity) === 'poor' ? '📉' : '📈'} {t(`dashboard.status.${getPillarStatusKey(score.activity)}`)}
              </span>
            </div>
          </div>
          <p className="metric-description">{t(getPillarRecommendationKey('activity', score.activity))}</p>
        </div>
      </div>

      <footer className="bottom-nav">
        <button className="nav-icon" onClick={() => onNavigate('home')} aria-label="Home">
          <Icon name="home" size={24} color="#718096" />
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition} aria-label="Food Recognition">
          <Icon name="nutrition" size={24} color="#718096" />
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('dashboard')} aria-label="Dashboard">
          <Icon name="chart" size={24} color="#0ea5e9" />
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('team')} aria-label="My Team">
          <Icon name="team" size={24} color="#718096" />
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('profile')} aria-label="Profile">
          <Icon name="profile" size={24} color="#718096" />
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
