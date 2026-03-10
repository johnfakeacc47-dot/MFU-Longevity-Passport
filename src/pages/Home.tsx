import React, { useState, useEffect } from 'react';

import { useLanguage } from '../contexts/LanguageContext';
import { calculateLongevityScore } from '../utils/longevityScore';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { isSupabaseConfigured, getTodayHealthScore } from '../services/supabaseClient';

type PageType =
  | 'login'
  | 'home'
  | 'fasting'
  | 'dashboard'
  | 'team'
  | 'profile'
  | 'edit-profile'
  | 'activity'
  | 'sleep';

interface HomeProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
  onLogout: () => void;
}

export const Home: React.FC<HomeProps> = ({ onNavigate, onOpenFoodRecognition, onLogout }) => {
  const { t } = useLanguage();
  const [score, setScore] = useState(calculateLongevityScore());
  const [currentTipIndex, setCurrentTipIndex] = useState(0);

  const tips = [
    'home.tip1',
    'home.tip2',
    'home.tip3',
    'home.tip4',
    'home.tip5',
    'home.tip6',
    'home.tip7',
  ];

  useEffect(() => {
    const fetchScore = async () => {
      // 1. Try Supabase first if configured
      if (isSupabaseConfigured()) {
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
      }

      // 2. Fallback to API or Local
      if (isApiConfigured) {
        try {
          console.log('Fetching score from API with token:', !!localStorage.getItem('authToken'));
          const data = await healthApi.getTodayScore();
          console.log('Score from API:', data);
          setScore(data);
          return;
        } catch (error) {
          console.error('Failed to load score from API', error);
        }
      }

      console.log('Using local score calculation');
      setScore(calculateLongevityScore());
    };

    fetchScore();

    // Update score every minute
    const scoreInterval = setInterval(() => {
      fetchScore();
    }, 60000);

    // Rotate tips every 15 seconds
    const tipInterval = setInterval(() => {
      setCurrentTipIndex((prev) => (prev + 1) % tips.length);
    }, 15000);

    const handleHealthUpdate = () => {
      console.log('healthDataUpdated event received');
      fetchScore();
    };

    window.addEventListener('healthDataUpdated', handleHealthUpdate);
    window.addEventListener('storage', handleHealthUpdate);

    return () => {
      clearInterval(scoreInterval);
      clearInterval(tipInterval);
      window.removeEventListener('healthDataUpdated', handleHealthUpdate);
      window.removeEventListener('storage', handleHealthUpdate);
    };
  }, []);

  const totalPillars = score.sleep + score.nutrition + score.fasting + score.activity;
  const chartBackground = totalPillars > 0
    ? (() => {
        const sleepAngle = (score.sleep / totalPillars) * 360;
        const nutritionAngle = (score.nutrition / totalPillars) * 360;
        const fastingAngle = (score.fasting / totalPillars) * 360;

        const sleepEnd = sleepAngle;
        const nutritionEnd = sleepEnd + nutritionAngle;
        const fastingEnd = nutritionEnd + fastingAngle;

        return `conic-gradient(
          #fbcf54 0deg ${sleepEnd}deg,
          #6ae375 ${sleepEnd}deg ${nutritionEnd}deg,
          #34c2d1 ${nutritionEnd}deg ${fastingEnd}deg,
          #ef6f68 ${fastingEnd}deg 360deg
        )`;
      })()
    : 'conic-gradient(#e3e3e3 0deg 360deg)';

  const todaySummary = {
    ifProtocol: '16:8',
    calories: 1850,
  };

  return (
    <div className="home-container">
      <div className="home-content page-content">
        <header className="home-hero">
          <div className="home-hero-main">
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="home-brand">MFU</span>
                {isSupabaseConfigured() ? (
                  <span className="bg-green-100 text-green-700 text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                    SYNCED
                  </span>
                ) : (
                  <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    OFFLINE
                  </span>
                )}
              </div>
              <h1>Longevity Passport</h1>
              <p className="home-tagline">Your daily health insights in one place.</p>
            </div>
          </div>
          <div className="home-hero-actions">
            <button className="hero-btn ghost" onClick={() => onNavigate('dashboard')}>
              View Dashboard
            </button>
            <button className="hero-btn" onClick={() => onNavigate('profile')}>
              My Profile
            </button>
            <button className="hero-btn ghost" onClick={onLogout} style={{ background: '#ff6b6b', color: 'white' }}>
              Logout
            </button>
          </div>
        </header>

        {/* ===== Score Card ===== */}
        <section className="chart-card">
          <div className="donut-chart">
            <div className="chart-circle" style={{ background: chartBackground }}>
              <div className="chart-inner">
                <div className="chart-value">{score.total}</div>
                <div className="chart-label">{t('home.longevityScore')}</div>
              </div>
            </div>

            <div className="chart-legend">
              <div className="legend-item">
                <span className="dot dot-yellow" />
                <span className="legend-text">{t('home.sleep')} {score.sleep}</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-green" />
                <span className="legend-text">{t('home.nutrition')} {score.nutrition}</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-blue" />
                <span className="legend-text">{t('home.fasting')} {score.fasting}</span>
              </div>
              <div className="legend-item">
                <span className="dot dot-red" />
                <span className="legend-text">{t('home.activity')} {score.activity}</span>
              </div>
            </div>
          </div>
        </section>

        {/* ===== Quick Actions ===== */}
        <section className="action-row">
          <button
            className="action-card food-card"
            aria-label={t('home.foodRecognition')}
            onClick={onOpenFoodRecognition}
          >
            <div className="action-icon">📷</div>
            <div className="action-title">{t('home.foodRecognition')}</div>
            <div className="action-hint">{t('home.food')}</div>
          </button>

          <button
            className="action-card fasting-card"
            aria-label={t('home.fastingTimer')}
            onClick={() => onNavigate('fasting')}
          >
            <div className="action-icon">⏰</div>
            <div className="action-title">{t('home.fastingTimer')}</div>
            <div className="action-hint">{t('home.fasting')}</div>
          </button>
        </section>

        {/* ===== Activity & Sleep Actions ===== */}
        <section className="action-row secondary-actions">
          <button
            className="action-card activity-card"
            aria-label="Activity Tracking"
            onClick={() => onNavigate('activity')}
          >
            <div className="action-icon">💪</div>
            <div className="action-title">{t('activity.title')}</div>
            <div className="action-hint">{t('home.exercise')}</div>
          </button>

          <button
            className="action-card sleep-card"
            aria-label="Sleep Tracking"
            onClick={() => onNavigate('sleep')}
          >
            <div className="action-icon">😴</div>
            <div className="action-title">{t('sleep.title')}</div>
            <div className="action-hint">{t('home.sleep')}</div>
          </button>
        </section>

        {/* ===== Daily Tip ===== */}
        <section className="tip-card">
          <div className="tip-icon">💡</div>
          <div className="tip-text">
            <div className="tip-title">{t('home.dailyTip')}</div>
            <div className="tip-body">
              {t(tips[currentTipIndex])}
            </div>
          </div>
        </section>

        {/* ===== Summary ===== */}
        <section className="summary-card">
          <div className="summary-header">{t('home.todaySummary')}</div>
          <div className="summary-grid">
            <div className="summary-box">
              <div className="summary-value">{todaySummary.ifProtocol}</div>
              <div className="summary-label">{t('home.ifToday')}</div>
            </div>
            <div className="summary-box">
              <div className="summary-value">
                {todaySummary.calories.toLocaleString()}
              </div>
              <div className="summary-label">{t('home.calories')}</div>
            </div>
          </div>
        </section>
      </div>

      {/* ===== Bottom Navigation ===== */}
      <footer className="bottom-nav">
        <button
          className="nav-icon active"
          onClick={() => onNavigate('home')}
        >
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>

        <button
          className="nav-icon"
          onClick={onOpenFoodRecognition}
        >
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>

        <button
          className="nav-icon"
          onClick={() => onNavigate('dashboard')}
        >
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>

        <button
          className="nav-icon"
          onClick={() => onNavigate('team')}
        >
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>

        <button
          className="nav-icon"
          onClick={() => onNavigate('profile')}
        >
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>

    </div>
  );
};
