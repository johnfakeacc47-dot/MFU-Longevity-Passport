import React, { useState, useEffect } from 'react';
import { LuMoon, LuSun, LuStar, LuTrash2, LuPlus, LuX, LuBedDouble } from 'react-icons/lu';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/EmptyState';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { SleepQualityIndicator, calculateSleepQuality } from '../components/SleepQualityIndicator';

type PageType = 'home' | 'profile' | 'team' | 'eating' | 'dashboard' | 'activity' | 'sleep';

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

const QUALITY_COLORS = ['', '#ef4444','#ef4444','#f97316','#f97316','#f59e0b','#84cc16','#22c55e','#10b981','#10b981','#06b6d4'];

export const Sleep: React.FC<SleepProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  useSEO(`${t('sleep.title')} · MFU Longevity Passport`, 'Log and review your sleep quality and duration.');
  const [sleepLogs, setSleepLogs]   = useState<SleepLog[]>([]);
  const [showModal, setShowModal]   = useState(false);
  const [bedtime, setBedtime]       = useState('22:00');
  const [waketime, setWaketime]     = useState('06:30');
  const [weekAvg, setWeekAvg]       = useState({ hours: 0, quality: 0 });

  const loadSleepLogs = React.useCallback(async () => {
    if (isApiConfigured && !isSupabaseConfigured()) {
      try {
        const to = new Date(); const from = new Date();
        from.setDate(to.getDate() - 30);
        const data = await healthApi.getSleepHistory(from.toISOString(), to.toISOString());
        const norm = (Array.isArray(data) ? data : []).map((item: any) => ({
          id: item.id,
          bedtime:  item.bedtime  ? new Date(item.bedtime).toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit' }) : '22:00',
          waketime: item.waketime ? new Date(item.waketime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '06:00',
          duration: item.duration ? Math.round((item.duration / 60) * 10) / 10 : 0,
          quality:  item.quality || 0,
          timestamp: item.createdAt,
          date: new Date(item.createdAt).toLocaleDateString('th-TH'),
        }));
        setSleepLogs(norm); return;
      } catch (e) {
        console.error('Sleep API error:', e);
      }
    }
    const saved = localStorage.getItem('sleepLogs');
    if (saved) setSleepLogs(safeParse(saved, []));
  }, []);

  const calcWeekAvg = React.useCallback(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const wk = sleepLogs.filter(l => new Date(l.timestamp) >= cutoff);
    if (wk.length === 0) { setWeekAvg({ hours: 0, quality: 0 }); return; }
    setWeekAvg({
      hours:   Math.round((wk.reduce((s, l) => s + l.duration, 0) / wk.length) * 10) / 10,
      quality: Math.round((wk.reduce((s, l) => s + l.quality, 0)  / wk.length) * 10) / 10,
    });
  }, [sleepLogs]);

  useEffect(() => { loadSleepLogs(); }, [loadSleepLogs]);
  useEffect(() => { calcWeekAvg(); }, [calcWeekAvg]);

  const calcDuration = (bed: string, wake: string): number => {
    const [bH, bM] = bed.split(':').map(Number);
    const [wH, wM] = wake.split(':').map(Number);
    const bedMin = bH * 60 + bM;
    let wakeMin = wH * 60 + wM;
    if (wakeMin < bedMin) wakeMin += 1440;
    return Math.round(((wakeMin - bedMin) / 60) * 10) / 10;
  };

  const logSleep = async () => {
    const duration = calcDuration(bedtime, waketime);
    const { score: calculatedQuality } = calculateSleepQuality(duration, bedtime);
    const newLog: SleepLog = {
      id: Date.now(), bedtime, waketime, duration, quality: calculatedQuality,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('th-TH'),
    };
    const updated = [newLog, ...sleepLogs];
    setSleepLogs(updated);
    localStorage.setItem('sleepLogs', JSON.stringify(updated));
    if (isApiConfigured && !isSupabaseConfigured()) {
      try {
        const now = new Date();
        const [bH, bM] = bedtime.split(':').map(Number);
        const [wH, wM] = waketime.split(':').map(Number);
        const bedT = new Date(now); bedT.setHours(bH, bM, 0, 0);
        const wakeT = new Date(now); wakeT.setHours(wH, wM, 0, 0);
        if (wakeT < bedT) wakeT.setDate(wakeT.getDate() + 1);
        await healthApi.logSleep({ bedtime: bedT.toISOString(), waketime: wakeT.toISOString(), duration: Math.round(duration * 60), quality: calculatedQuality });
      } catch (e) {
        console.error('Failed to log sleep API:', e);
      }
    }
    window.dispatchEvent(new Event('healthDataUpdated'));
    setShowModal(false);
    setBedtime('22:00'); setWaketime('06:30');
  };

  const deleteSleepLog = (id: number | string) => {
    const updated = sleepLogs.filter(l => l.id !== id);
    setSleepLogs(updated);
    localStorage.setItem('sleepLogs', JSON.stringify(updated));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const duration = calcDuration(bedtime, waketime);
  const hoursTarget = 8;
  const sleepPct = weekAvg.hours ? Math.min((weekAvg.hours / hoursTarget) * 100, 100) : 0;

  return (
    <div className="sleep-v2">
      <header className="sleep-header-v2">
        <BackButton onClick={() => onNavigate('home')} ariaLabel={t('sleep.back')} />
        <h1 className="sleep-header-title">{t('sleep.title')}</h1>
        <button className="sleep-add-btn" onClick={() => setShowModal(true)} aria-label="Log sleep">
          <LuPlus />
        </button>
      </header>

      <div className="sleep-content-v2 page-content">

        {/* ── Weekly Stats ── */}
        <div className="sleep-stats-row">
          <div className="sleep-stat-card">
            <div className="sleep-stat-icon"><LuMoon /></div>
            <div className="sleep-stat-body">
              <div className="sleep-stat-value">{weekAvg.hours || '--'}<span className="sleep-stat-unit">h</span></div>
              <div className="sleep-stat-label">{t('sleep.avgHours')}</div>
            </div>
            <div className="sleep-stat-ring">
              <svg width="48" height="48" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="#e2e8f0" strokeWidth="4" />
                <circle cx="24" cy="24" r="20" fill="none" stroke="#3b82f6" strokeWidth="4"
                  strokeLinecap="round"
                  strokeDasharray={2 * Math.PI * 20}
                  strokeDashoffset={2 * Math.PI * 20 * (1 - sleepPct / 100)}
                  transform="rotate(-90 24 24)" />
              </svg>
            </div>
          </div>

          <div className="sleep-stat-card">
            <div className="sleep-stat-icon" style={{ color: QUALITY_COLORS[Math.round(weekAvg.quality)] || '#64748b' }}>
              <LuStar />
            </div>
            <div className="sleep-stat-body">
              <div className="sleep-stat-value" style={{ color: QUALITY_COLORS[Math.round(weekAvg.quality)] || '#0f172a' }}>
                {weekAvg.quality || '--'}
                {weekAvg.quality > 0 && <span className="sleep-stat-unit">/10</span>}
              </div>
              <div className="sleep-stat-label">{t('sleep.avgQuality')}</div>
            </div>
          </div>
        </div>

        {/* ── Log Button ── */}
        <button className="sleep-log-btn-v2" onClick={() => setShowModal(true)}>
          <LuBedDouble className="sleep-log-btn-icon" />
          {t('sleep.logSleep')}
        </button>

        {/* ── History ── */}
        <div className="sleep-history-v2">
          <h2 className="sleep-section-title">{t('sleep.history')}</h2>
          {sleepLogs.length === 0 ? (
            <EmptyState
              icon={<LuBedDouble className="empty-state-lucide" />}
              title={t('sleep.noLogs')}
              description={t('sleep.emptyDesc')}
              action={t('sleep.emptyAction')}
              onAction={() => setShowModal(true)}
            />
          ) : (
            <div className="sleep-list-v2">
              {sleepLogs.map((log) => (
                <div key={log.id} className="sleep-item-v2">
                  <div className="sleep-item-header-v2">
                    <span className="sleep-item-date">
                      {new Date(log.timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                    </span>
                    <div className="sleep-item-actions">
                      <span
                        className="sleep-quality-badge"
                        style={{ background: `${QUALITY_COLORS[Math.round(log.quality)]}18`, color: QUALITY_COLORS[Math.round(log.quality)] }}
                      >
                        ★ {log.quality}/10
                      </span>
                      <button className="sleep-delete-btn" onClick={() => deleteSleepLog(log.id)} aria-label="Delete">
                        <LuTrash2 />
                      </button>
                    </div>
                  </div>
                  <div className="sleep-item-timeline">
                    <div className="sleep-tl-point">
                      <LuMoon className="sleep-tl-icon" style={{ color: '#3b82f6' }} />
                      <div className="sleep-tl-time">{log.bedtime}</div>
                      <div className="sleep-tl-label">{t('sleep.bedtime')}</div>
                    </div>
                    <div className="sleep-tl-bar">
                      <div className="sleep-tl-line" />
                      <div className="sleep-tl-duration">{log.duration}h</div>
                    </div>
                    <div className="sleep-tl-point">
                      <LuSun className="sleep-tl-icon" style={{ color: '#f59e0b' }} />
                      <div className="sleep-tl-time">{log.waketime}</div>
                      <div className="sleep-tl-label">{t('sleep.wakeup')}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Sleep Modal ── */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="modal-card modal-card--sleep" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3 className="modal-title">{t('sleep.logSleep')}</h3>
              <button className="modal-close-btn" onClick={() => setShowModal(false)}><LuX /></button>
            </div>

            <div className="modal-body">
              <div className="sleep-modal-time-row">
                <div className="sleep-modal-time-field">
                  <label className="modal-label"><LuMoon style={{ color: '#3b82f6' }} /> {t('sleep.bedtime')}</label>
                  <input type="time" value={bedtime} onChange={(e) => setBedtime(e.target.value)} className="modal-time-input" />
                </div>
                <div className="sleep-modal-time-arrow">→</div>
                <div className="sleep-modal-time-field">
                  <label className="modal-label"><LuSun style={{ color: '#f59e0b' }} /> {t('sleep.waketime')}</label>
                  <input type="time" value={waketime} onChange={(e) => setWaketime(e.target.value)} className="modal-time-input" />
                </div>
              </div>

              {/* Readonly Auto Sleep Quality Indicator */}
              <div style={{ marginTop: 20, marginBottom: 24 }}>
                <SleepQualityIndicator duration={duration} bedtime={bedtime} />
              </div>

              <button className="modal-submit-btn" onClick={logSleep}>{t('sleep.logButton')}</button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="dashboard" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
