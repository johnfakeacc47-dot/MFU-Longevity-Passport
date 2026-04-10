import React, { useState, useEffect } from 'react';
import { FaBed, FaCalendarAlt, FaClock, FaLightbulb, FaMoon, FaPen, FaStar, FaSun, FaTimes, FaTrash } from 'react-icons/fa';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';

import { useLanguage } from '../contexts/LanguageContext';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { isSupabaseConfigured } from '../services/supabaseClient';

type PageType = 'home' | 'profile' | 'team' | 'fasting' | 'dashboard' | 'activity' | 'sleep';

interface SleepProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

interface SleepLog {
  id: number | string;
  bedtime: string;
  waketime: string;
  duration: number;
  quality: number;
  timestamp: string;
  date: string;
}

export const Sleep: React.FC<SleepProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [bedtime, setBedtime] = useState('22:00');
  const [waketime, setWaketime] = useState('06:00');
  const [quality, setQuality] = useState(7);
  const [weekAverage, setWeekAverage] = useState({ hours: 0, quality: 0 });

  useEffect(() => {
    loadSleepLogs();
  }, []);

  useEffect(() => {
    calculateWeekAverage();
  }, [sleepLogs]);

  const loadSleepLogs = async () => {
    // If we've fully moved to Supabase and don't have a sleep history table yet, rely on localStorage
    if (isApiConfigured && !isSupabaseConfigured()) {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        const data = await healthApi.getSleepHistory(
          from.toISOString(),
          to.toISOString(),
        );
        const normalized = (Array.isArray(data) ? data : []).map((item) => ({
          id: item.id,
          bedtime: item.bedtime
            ? new Date(item.bedtime).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '22:00',
          waketime: item.waketime
            ? new Date(item.waketime).toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : '06:00',
          duration: item.duration ? Math.round((item.duration / 60) * 10) / 10 : 0,
          quality: item.quality || 0,
          timestamp: item.createdAt,
          date: new Date(item.createdAt).toLocaleDateString('th-TH'),
        }));
        setSleepLogs(normalized);
        return;
      } catch (error) {
        console.error('Failed to load sleep logs from API', error);
      }
    }

    const saved = localStorage.getItem('sleepLogs');
    if (saved) {
      setSleepLogs(JSON.parse(saved));
    }
  };

  const calculateWeekAverage = () => {
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
    
    const weekLogs = sleepLogs.filter(
      log => new Date(log.timestamp) >= oneWeekAgo
    );

    if (weekLogs.length === 0) {
      setWeekAverage({ hours: 0, quality: 0 });
      return;
    }

    const totalHours = weekLogs.reduce((sum, log) => sum + log.duration, 0);
    const totalQuality = weekLogs.reduce((sum, log) => sum + log.quality, 0);
    
    setWeekAverage({
      hours: Math.round((totalHours / weekLogs.length) * 10) / 10,
      quality: Math.round((totalQuality / weekLogs.length) * 10) / 10
    });
  };

  const calculateDuration = (bedtime: string, waketime: string): number => {
    const [bedHour, bedMin] = bedtime.split(':').map(Number);
    const [wakeHour, wakeMin] = waketime.split(':').map(Number);
    
    let bedMinutes = bedHour * 60 + bedMin;
    let wakeMinutes = wakeHour * 60 + wakeMin;
    
    // If wake time is earlier than bed time, it's next day
    if (wakeMinutes < bedMinutes) {
      wakeMinutes += 24 * 60;
    }
    
    const durationMinutes = wakeMinutes - bedMinutes;
    return Math.round((durationMinutes / 60) * 10) / 10;
  };

  const logSleep = async () => {
    const duration = calculateDuration(bedtime, waketime);
    const durationMinutes = Math.round(duration * 60);
    
    const newLog: SleepLog = {
      id: Date.now(),
      bedtime,
      waketime,
      duration,
      quality,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('th-TH'),
    };

    const updatedLogs = [newLog, ...sleepLogs];
    setSleepLogs(updatedLogs);
    localStorage.setItem('sleepLogs', JSON.stringify(updatedLogs));

    if (isApiConfigured && !isSupabaseConfigured()) {
      try {
        const now = new Date();
      const [bedHour, bedMin] = bedtime.split(':').map(Number);
      const [wakeHour, wakeMin] = waketime.split(':').map(Number);
      const bedTime = new Date(now);
      bedTime.setHours(bedHour, bedMin, 0, 0);
      const wakeTime = new Date(now);
      wakeTime.setHours(wakeHour, wakeMin, 0, 0);
      if (wakeTime < bedTime) {
        wakeTime.setDate(wakeTime.getDate() + 1);
      }

      await healthApi.logSleep({
        bedtime: bedTime.toISOString(),
        waketime: wakeTime.toISOString(),
        duration: durationMinutes,
        quality,
      });
      // Trigger score refresh after successful API call
      window.dispatchEvent(new Event('healthDataUpdated'));
    } catch (error) {
      console.error('Failed to sync sleep log to API', error);
      // Still trigger refresh for localStorage fallback
      window.dispatchEvent(new Event('healthDataUpdated'));
    }
  } else {
    // Trigger score refresh for localStorage fallback (no API)
    window.dispatchEvent(new Event('healthDataUpdated'));
  }

  setShowModal(false);
    setBedtime('22:00');
    setWaketime('06:00');
    setQuality(7);
  };

  const deleteSleepLog = (id: number | string) => {
    const updatedLogs = sleepLogs.filter(log => log.id !== id);
    setSleepLogs(updatedLogs);
    localStorage.setItem('sleepLogs', JSON.stringify(updatedLogs));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const getQualityColor = (quality: number): string => {
    if (quality >= 8) return '#1976D2';
    if (quality >= 6) return '#1E88E5';
    return '#1565C0';
  };

  const getQualityLabel = (quality: number): string => {
    if (quality >= 8) return t('sleep.excellent');
    if (quality >= 6) return t('sleep.good');
    if (quality >= 4) return t('sleep.fair');
    return t('sleep.poor');
  };

  const getSleepTip = (): string => {
    if (weekAverage.hours === 0) return t('sleep.tip1');
    if (weekAverage.hours < 7) return t('sleep.tip2');
    if (weekAverage.quality < 6) return t('sleep.tip3');
    if (weekAverage.hours > 9) return t('sleep.tip4');
    return t('sleep.tip5');
  };

  return (
    <div className="sleep-page">
      <div className="sleep-header">
        <BackButton onClick={() => onNavigate('home')} ariaLabel={t('sleep.back')} />
        <h1>{t('sleep.title')}</h1>
      </div>

      <div className="sleep-content page-content">

      {/* Week Summary */}
      <div className="week-summary">
        <div className="summary-card">
          <div className="summary-icon"><FaBed /></div>
          <div className="summary-content">
            <div className="summary-value">{weekAverage.hours || '--'}</div>
            <div className="summary-label">{t('sleep.avgHours')}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon"><FaStar /></div>
          <div className="summary-content">
            <div className="summary-value">{weekAverage.quality || '--'}</div>
            <div className="summary-label">{t('sleep.avgQuality')}</div>
          </div>
        </div>
      </div>

      {/* Sleep Tip */}
      <div className="sleep-tip">
        <div className="tip-icon"><FaLightbulb /></div>
        <div className="tip-content">
          <div className="tip-title">{t('sleep.tipTitle')}</div>
          <div className="tip-text">{getSleepTip()}</div>
        </div>
      </div>

      {/* Log Sleep Button */}
      <button className="log-sleep-btn" onClick={() => setShowModal(true)}>
        <span className="btn-icon"><FaPen /></span>
        {t('sleep.logSleep')}
      </button>

      {/* Sleep History */}
      <div className="sleep-history">
        <h2>{t('sleep.history')}</h2>
        {sleepLogs.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaMoon /></div>
            <p>{t('sleep.noLogs')}</p>
          </div>
        ) : (
          <div className="sleep-list">
            {sleepLogs.map((log) => (
              <div key={log.id} className="sleep-item">
                <div className="sleep-item-header">
                  <div className="sleep-date">
                    <span className="date-icon"><FaCalendarAlt /></span>
                    {new Date(log.timestamp).toLocaleDateString('th-TH', {
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric'
                    })}
                  </div>
                  <button
                    className="delete-sleep-btn"
                    onClick={() => deleteSleepLog(log.id)}
                  >
                    <FaTrash />
                  </button>
                </div>
                
                <div className="sleep-item-content">
                  <div className="sleep-times">
                    <div className="time-block">
                      <span className="time-icon"><FaMoon /></span>
                      <div>
                        <div className="time-label">{t('sleep.bedtime')}</div>
                        <div className="time-value">{log.bedtime}</div>
                      </div>
                    </div>
                    <div className="time-arrow">→</div>
                    <div className="time-block">
                      <span className="time-icon"><FaSun /></span>
                      <div>
                        <div className="time-label">{t('sleep.waketime')}</div>
                        <div className="time-value">{log.waketime}</div>
                      </div>
                    </div>
                  </div>

                  <div className="sleep-details">
                    <div className="detail-item">
                      <span className="detail-icon"><FaClock /></span>
                      <span className="detail-text">
                        {log.duration} {t('sleep.hours')}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-icon"><FaStar /></span>
                      <span 
                        className="detail-text quality-badge"
                        style={{ color: getQualityColor(log.quality) }}
                      >
                        {getQualityLabel(log.quality)} ({log.quality}/10)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Sleep Modal */}
      {showModal && (
        <div className="sleep-modal-overlay">
          <div className="sleep-modal">
            <div className="modal-header">
              <h3>{t('sleep.logSleep')}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="modal-content">
              {/* Bedtime */}
              <div className="time-input-group">
                <label>{t('sleep.bedtime')}</label>
                <input
                  type="time"
                  value={bedtime}
                  onChange={(e) => setBedtime(e.target.value)}
                  className="time-input"
                />
              </div>

              {/* Wake Time */}
              <div className="time-input-group">
                <label>{t('sleep.waketime')}</label>
                <input
                  type="time"
                  value={waketime}
                  onChange={(e) => setWaketime(e.target.value)}
                  className="time-input"
                />
              </div>

              {/* Duration Display */}
              <div className="duration-display">
                <span className="duration-icon"><FaClock /></span>
                <span className="duration-text">
                  {t('sleep.duration')}: <strong>{calculateDuration(bedtime, waketime)}</strong> {t('sleep.hours')}
                </span>
              </div>

              {/* Quality Slider */}
              <div className="quality-input">
                <label>{t('sleep.quality')}</label>
                <div className="quality-slider">
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={quality}
                    onChange={(e) => setQuality(Number(e.target.value))}
                  />
                  <div 
                    className="quality-value"
                    style={{ color: getQualityColor(quality) }}
                  >
                    {quality}/10 - {getQualityLabel(quality)}
                  </div>
                </div>
                <div className="quality-scale">
                  <span>{t('sleep.poor')}</span>
                  <span>{t('sleep.fair')}</span>
                  <span>{t('sleep.good')}</span>
                  <span>{t('sleep.excellent')}</span>
                </div>
              </div>

              <button className="log-btn" onClick={logSleep}>
                {t('sleep.logButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="dashboard" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
