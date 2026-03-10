import React, { useState, useEffect } from 'react';

import { useLanguage } from '../contexts/LanguageContext';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { getCurrentUserProfile, startFastingTimer, stopFastingTimer, syncDailyScoreToSupabase, getTodayHealthScore, isSupabaseConfigured } from '../services/supabaseClient';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'activity' | 'sleep'

interface FastingProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const Fasting: React.FC<FastingProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const [selectedHours, setSelectedHours] = useState<number>(16);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [targetSeconds, setTargetSeconds] = useState<number>(16 * 3600);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [showCustomModal, setShowCustomModal] = useState<boolean>(false);
  const [customHours, setCustomHours] = useState<number>(16);
  const { t } = useLanguage();

  // Load saved fasting state from Supabase on mount
  useEffect(() => {
    const loadState = async () => {
      // 1. Request notification permissions right away
      if ('Notification' in window && Notification.permission !== 'granted') {
        Notification.requestPermission();
      }

      const profile = await getCurrentUserProfile();
      if (profile && profile.fasting_start_time && profile.fasting_target_hours) {
        const start = new Date(profile.fasting_start_time);
        const targetSecs = profile.fasting_target_hours * 3600;
        const now = new Date();
        const elapsed = Math.floor((now.getTime() - start.getTime()) / 1000);
        
        if (elapsed < targetSecs) {
          setSelectedHours(profile.fasting_target_hours);
          setTargetSeconds(targetSecs);
          setElapsedSeconds(elapsed);
          setStartTime(start);
          setIsRunning(true);
        } else {
          // Timer finished while offline. Calculate points and clear.
          await finishFasting(profile.fasting_target_hours);
        }
      }
    };
    loadState();
  }, []);

  // Removed the localStorage useEffect

  const playNotificationSound = () => {
    // A simple polite bell sound using an oscillator beep as fallback:
    // We'll use a standard browser beep fallback since a real base64 WAV is too long. Let's just create an oscillator beep:
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5
    gain.gain.setValueAtTime(0.1, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, ctx.currentTime + 1);
    osc.start();
    osc.stop(ctx.currentTime + 1);
  };

  const notifyUser = (message: string) => {
    playNotificationSound();
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('MFU Longevity Passport', { body: message, icon: '/vite.svg' });
    } else {
      alert(message);
    }
  };

  const finishFasting = async (hoursFasted: number) => {
    setIsRunning(false);
    setElapsedSeconds(0);
    setStartTime(null);

    await stopFastingTimer();
    
    // Add points to health_scores for today. Rough logic: 1 hour = 2 points, max 40.
    const earnedPoints = Math.min(Math.round(hoursFasted * 2), 40);
    
    const todayScore = await getTodayHealthScore();
    if (todayScore) {
      await syncDailyScoreToSupabase({
        ...todayScore,
        fasting: Math.min((todayScore.fasting || 0) + earnedPoints, 40),
        total: Math.min((todayScore.total || 0) + earnedPoints, 100) // Rough recalculation
      });
    }

    notifyUser(`Fasting complete! You fasted for ${hoursFasted} hours.`);
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  useEffect(() => {
    let interval: number | undefined;
    if (isRunning && startTime) {
      interval = window.setInterval(() => {
        setElapsedSeconds(() => {
          const now = new Date();
          const actualElapsed = Math.floor((now.getTime() - startTime.getTime()) / 1000);
          
          if (actualElapsed >= targetSeconds) {
            clearInterval(interval);
            finishFasting(selectedHours);
            return targetSeconds;
          }
          return actualElapsed;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isRunning, targetSeconds, startTime, selectedHours]);

  const startFasting = async (hours: number) => {
    setSelectedHours(hours);
    setTargetSeconds(hours * 3600);
    setElapsedSeconds(0);
    setStartTime(new Date());
    setIsRunning(true);

    try {
      if (isSupabaseConfigured()) {
        await startFastingTimer(hours);
      } else if (isApiConfigured) {
        await healthApi.startFasting({
          protocol: `${hours}:${Math.max(0, 24 - hours)}`,
        });
      }
      window.dispatchEvent(new Event('healthDataUpdated'));
    } catch (error) {
      console.error('Failed to start fasting timer', error);
      window.dispatchEvent(new Event('healthDataUpdated'));
    }
  };

  const stopFasting = async () => {
    const elapsedHours = elapsedSeconds / 3600;
    if (elapsedHours < 1) {
      // Don't award points if less than an hour
      setIsRunning(false);
      setElapsedSeconds(0);
      setStartTime(null);
      if (isSupabaseConfigured()) {
        await stopFastingTimer();
      } else if (isApiConfigured) {
        await healthApi.stopFasting();
      }
      notifyUser("Fasting stopped early. No points awarded.");
    } else {
      await finishFasting(Math.floor(elapsedHours));
    }
  };

  const startCustomFasting = () => {
    startFasting(customHours);
    setShowCustomModal(false);
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const getProgressPercent = () => (elapsedSeconds / targetSeconds) * 100;

  const formatTime24 = (date: Date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const getEndTime = () => {
    if (!startTime) {
      const now = new Date();
      const end = new Date(now.getTime() + targetSeconds * 1000);
      return formatTime24(end);
    }
    const end = new Date(startTime.getTime() + targetSeconds * 1000);
    return formatTime24(end);
  };

  const getStartTime = () => {
    if (!startTime) {
      const now = new Date();
      return formatTime24(now);
    }
    return formatTime24(startTime);
  };

  return (
    <div className="fasting-container">
      <header className="fasting-header">
        <button className="back-btn" onClick={() => onNavigate('home')}>←</button>
        <h1 className="header-title">{t('fasting.title')}</h1>
        <button className="timer-btn">⏱</button>
      </header>

      <div className="fasting-content page-content">
        <div className="timer-circle-wrapper">
          <svg className="progress-ring" width="280" height="280">
            <circle
              className="progress-ring-bg"
              cx="140"
              cy="140"
              r="130"
            />
            <circle
              className="progress-ring-fill"
              cx="140"
              cy="140"
              r="130"
              style={{
                strokeDasharray: `${2 * Math.PI * 130}`,
                strokeDashoffset: `${2 * Math.PI * 130 * (1 - getProgressPercent() / 100)}`
              }}
            />
          </svg>
          <div className="timer-inner">
            <div className="timer-label">{t('fasting.fasting')}</div>
            <div className="timer-display">{formatTime(elapsedSeconds)}</div>
            <button className="custom-btn" onClick={() => setShowCustomModal(true)} disabled={isRunning}>✏️ Custom</button>
          </div>
        </div>

        <div className="timer-info-row">
          <div className="info-left">
            <div className="info-label">{t('fasting.fasting')} {elapsedSeconds > 0 ? Math.floor(elapsedSeconds / 3600) : 4} of {selectedHours} {t('home.hours')}</div>
          </div>
          <div className="info-right">
            <div className="info-time">{getEndTime()}</div>
          </div>
        </div>

        <div className="time-range">
          <div className="time-start">{t('fasting.start')} {getStartTime()}</div>
          <div className="time-end">{t('fasting.end')} {getEndTime()}</div>
        </div>

        <div className="preset-buttons">
          <button 
            className={`preset-btn ${selectedHours === 14 && !isRunning ? 'active' : ''}`}
            onClick={() => startFasting(14)}
            disabled={isRunning}
          >
            14:10
          </button>
          <button 
            className={`preset-btn ${selectedHours === 16 && !isRunning ? 'active' : ''}`}
            onClick={() => startFasting(16)}
            disabled={isRunning}
          >
            16:8
          </button>
          <button 
            className={`preset-btn ${selectedHours === 18 && !isRunning ? 'active' : ''}`}
            onClick={() => startFasting(18)}
            disabled={isRunning}
          >
            18:6
          </button>
          <button 
            className={`preset-btn ${selectedHours === 20 && !isRunning ? 'active' : ''}`}
            onClick={() => startFasting(20)}
            disabled={isRunning}
          >
            20:4
          </button>
        </div>

        {isRunning && (
          <div className="stop-button-wrapper">
            <button className="stop-btn" onClick={stopFasting}>
              ⏸️ Stop Fasting
            </button>
          </div>
        )}

        <div className="achievement-card glass-card">
          <div className="achievement-title">{t('fasting.achievement')}</div>
          <div className="achievement-text">{t('fasting.achievementText')}</div>
        </div>

        {/* Educational Content */}
        <div className="glass-card p-6 rounded-3xl mt-6">
          <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest mb-4">Fast Protocols & Benefits</h3>
          <div className="space-y-4">
            <div className="flex gap-4 items-start">
              <span className="text-xl">⚖️</span>
              <div>
                <div className="font-bold text-xs text-gray-800">14:10 - Metabolic Rest</div>
                <p className="text-[10px] text-gray-500">Perfect for beginners. Stabilizes blood sugar and improves digestion.</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="text-xl">🔥</span>
              <div>
                <div className="font-bold text-xs text-gray-800">16:8 - Fat Burning</div>
                <p className="text-[10px] text-gray-500">The "Gold Standard". Shifts the body into fat-burning mode (Ketosis).</p>
              </div>
            </div>
            <div className="flex gap-4 items-start">
              <span className="text-xl">🧹</span>
              <div>
                <div className="font-bold text-xs text-gray-800">18:6 - Autophagy</div>
                <p className="text-[10px] text-gray-500">Triggers cellular "cleanup" to remove damaged molecules and proteins.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="bottom-nav">
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon active" onClick={onOpenFoodRecognition}>
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
        <button className="nav-icon" onClick={() => onNavigate('profile')}>
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>

      {showCustomModal && (
        <div className="custom-modal-overlay" onClick={() => setShowCustomModal(false)}>
          <div className="custom-modal" onClick={(e) => e.stopPropagation()}>
            <h3>Select Custom Fasting Time</h3>
            <div className="custom-time-picker">
              <label htmlFor="customHours">Hours:</label>
              <input
                id="customHours"
                type="number"
                min="1"
                max="48"
                value={customHours}
                onChange={(e) => setCustomHours(parseInt(e.target.value) || 1)}
              />
            </div>
            <div className="custom-modal-buttons">
              <button className="modal-btn cancel-btn" onClick={() => setShowCustomModal(false)}>
                Cancel
              </button>
              <button className="modal-btn start-btn" onClick={startCustomFasting}>
                Start
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
