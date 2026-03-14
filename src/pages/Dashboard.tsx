import React, { useState, useEffect } from 'react';

import { useLanguage } from '../contexts/LanguageContext';
import { calculateLongevityScore, getScoreColor, getScoreLabel } from '../utils/longevityScore';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { supabase, isSupabaseConfigured, getTodayHealthScore } from '../services/supabaseClient';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'activity' | 'sleep'

interface DashboardProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(calculateLongevityScore());
  const [isLiveDB, setIsLiveDB] = useState(false);

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
        <button className="back-btn" onClick={() => onNavigate('home')}>←</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h1 className="header-title">{t('dashboard.title')}</h1>
          {isLiveDB ? (
            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
              Live DB
            </div>
          ) : (
            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-bold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-orange-500"></span>
              Offline
            </div>
          )}
        </div>
        <button className="menu-btn">⋮</button>
      </header>
      

      <div className="dashboard-content page-content">
        {/* Longevity Score Card */}
        <div className="longevity-score-card">
          <div className="score-header">
            <h2>{t('longevity.title')}</h2>
            <div className="score-date">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
          </div>
          
          <div className="score-display">
            <div className="score-circle" style={{ borderColor: getScoreColor(score.total) }}>
              <div className="score-value" style={{ color: getScoreColor(score.total) }}>
                {score.total}
              </div>
              <div className="score-label">{t(scoreLabelKey)}</div>
            </div>
            
            <div className="score-breakdown">
              <div className="breakdown-title">{t('longevity.breakdown')}</div>
              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span className="breakdown-icon">🍽️</span>
                  {t('longevity.nutrition')}
                </div>
                <div className="breakdown-bar">
                  <div 
                    className="breakdown-fill nutrition"
                    style={{ width: `${(score.nutrition / 25) * 100}%` }}
                  />
                </div>
                <div className="breakdown-score">{score.nutrition}/25</div>
              </div>
              
              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span className="breakdown-icon">⏰</span>
                  {t('longevity.fasting')}
                </div>
                <div className="breakdown-bar">
                  <div 
                    className="breakdown-fill fasting"
                    style={{ width: `${(score.fasting / 25) * 100}%` }}
                  />
                </div>
                <div className="breakdown-score">{score.fasting}/25</div>
              </div>
              
              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span className="breakdown-icon">💪</span>
                  {t('longevity.activity')}
                </div>
                <div className="breakdown-bar">
                  <div 
                    className="breakdown-fill activity"
                    style={{ width: `${(score.activity / 25) * 100}%` }}
                  />
                </div>
                <div className="breakdown-score">{score.activity}/25</div>
              </div>
              
              <div className="breakdown-item">
                <div className="breakdown-label">
                  <span className="breakdown-icon">😴</span>
                  {t('longevity.sleep')}
                </div>
                <div className="breakdown-bar">
                  <div 
                    className="breakdown-fill sleep"
                    style={{ width: `${(score.sleep / 25) * 100}%` }}
                  />
                </div>
                <div className="breakdown-score">{score.sleep}/25</div>
              </div>
            </div>
          </div>
        </div>

        <div className="section-title">{t('dashboard.overallStats')}</div>

        <div className="overall-stats-card">
          <div className="overall-score">
            <div className="overall-score-label">{t('longevity.score')}</div>
            <div className="overall-score-value" style={{ color: getScoreColor(score.total) }}>
              {score.total}
            </div>
            <div className="overall-score-status">{t(scoreLabelKey)}</div>
          </div>
          <div className="overall-grid">
            <div className="overall-item">
              <span className="overall-icon">🍽️</span>
              <span className="overall-label">{t('longevity.nutrition')}</span>
              <span className="overall-value">{score.nutrition}/25</span>
            </div>
            <div className="overall-item">
              <span className="overall-icon">⏰</span>
              <span className="overall-label">{t('longevity.fasting')}</span>
              <span className="overall-value">{score.fasting}/25</span>
            </div>
            <div className="overall-item">
              <span className="overall-icon">💪</span>
              <span className="overall-label">{t('longevity.activity')}</span>
              <span className="overall-value">{score.activity}/25</span>
            </div>
            <div className="overall-item">
              <span className="overall-icon">😴</span>
              <span className="overall-label">{t('longevity.sleep')}</span>
              <span className="overall-value">{score.sleep}/25</span>
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
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition}>
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('dashboard')}>
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('team')}>
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('profile')}>
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
