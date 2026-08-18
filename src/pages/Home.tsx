import React, { useState, useEffect, useMemo } from 'react';
import {
  FaUser, FaUtensils, FaDumbbell, FaBed, FaBrain,
  FaArrowUp, FaArrowDown, FaChevronRight,
} from 'react-icons/fa';

import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { BottomNav } from '../components/BottomNav';
import { ScoreRing } from '../components/ScoreRing';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  calculateLongevityScore,
  getScoreColor,
  getScoreLabelKey,
  getPillarStatusKey,
} from '../utils/longevityScore';
import { supabase, isSupabaseConfigured, getTodayHealthScore } from '../services/supabaseClient';
import '../styles/Home.css';
import '../styles/Coach.css';
import {
  getLongevityIndex,
  getDailyGoals,
  getHealthStreak,
  getAICoachAdvice,
  getTodayTimeline,
} from '../utils/healthCoach';
import { LongevityIndexCard } from '../components/coach/LongevityIndexCard';
import { DailyGoalsCard } from '../components/coach/DailyGoalsCard';
import { AICoachCard } from '../components/coach/AICoachCard';
import { TimelineCard } from '../components/coach/TimelineCard';

type PageType =
  | 'login' | 'home' | 'eating' | 'dashboard' | 'team'
  | 'profile' | 'edit-profile' | 'activity' | 'sleep' | 'mental-health' | 'eating-food-log' | 'eating-macros' | 'eating-water' | 'eating-schedule' | 'eating-history';

interface HomeProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
  onLogout: () => void;
}

// ── Greeting (i18n) ────────────────────────────────────────────
function getGreetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'home.greetingMorning';
  if (h < 18) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

// ── Pillar config (4 pillars, each /25) ───────────────────────
const PILLARS = [
  {
    key:   'nutrition' as const,
    labelKey: 'home.nutrition',
    icon:  FaUtensils,
    color: '#10B981',
    bg:    'rgba(16,185,129,0.10)',
    nav:   'eating' as PageType,
    isFood: false,
  },
  {
    key:   'exercise' as const,
    labelKey: 'home.activity',
    icon:  FaDumbbell,
    color: '#F59E0B',
    bg:    'rgba(245,158,11,0.10)',
    nav:   'activity' as PageType,
    isFood: false,
  },
  {
    key:   'sleep' as const,
    labelKey: 'home.sleep',
    icon:  FaBed,
    color: '#3B82F6',
    bg:    'rgba(59,130,246,0.10)',
    nav:   'sleep' as PageType,
    isFood: false,
  },
  {
    key:   'mental' as const,
    labelKey: 'home.mentalHealth',
    icon:  FaBrain,
    color: '#8B5CF6',
    bg:    'rgba(139,92,246,0.10)',
    nav:   'mental-health' as PageType,
    isFood: false,
  },
] as const;
// ── Component ──────────────────────────────────────────────────
export const Home: React.FC<HomeProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t, language } = useLanguage();
  useSEO(t('home.title'), 'Your daily longevity score, goals, and AI health coach at a glance.');
  const [score,     setScore]     = useState(calculateLongevityScore());
  const [isLoading, setIsLoading] = useState(true);
  const [isLiveDB,  setIsLiveDB]  = useState(false);
  const [userName,  setUserName]  = useState('');
  const [yesterday, setYesterday] = useState<number | null>(null);

  const scoreColor    = getScoreColor(score.total);
  const scoreLabelKey = getScoreLabelKey(score.total);
  const delta         = yesterday !== null ? score.total - yesterday : null;

  // Re-map pillar keys for ScoreRing (Unified 4 pillars: nutrition, exercise, sleep, mental)
  const ringScore = useMemo(() => ({
    nutrition: score.nutrition ?? 0,
    exercise:  score.exercise ?? score.activity ?? 0,
    sleep:     score.sleep ?? 0,
    mental:    score.mental ?? 0,
    activity:  score.exercise ?? score.activity ?? 0,
    fasting:   score.fasting ?? 0,
    total:     score.total,
  }), [score]);

  const indexData = useMemo(() => getLongevityIndex(ringScore as any), [ringScore]);
  // `score` isn't read directly below — these helpers pull fresh data straight from
  // localStorage — but it's kept as the recompute trigger so goals/streak/timeline
  // refresh whenever the score changes (e.g. after logging a meal or workout).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const dailyGoals = useMemo(() => getDailyGoals(), [score]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const healthStreak = useMemo(() => getHealthStreak(), [score]);
  const aiCoachAdvice = useMemo(() => getAICoachAdvice(language, ringScore as any), [language, ringScore]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const todayTimeline = useMemo(() => getTodayTimeline(language), [language, score]);


  // ── Fetch ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchScore = async () => {
      try {
        const storedYesterday = localStorage.getItem('yesterdayScore');
        if (storedYesterday) setYesterday(Number(storedYesterday));
        if (isSupabaseConfigured()) {
          const { data: { user } } = await supabase!.auth.getUser();
          setIsLiveDB(!!user);
          if (user) {
            const stored = localStorage.getItem('profileData');
            if (stored) setUserName(safeParse<any>(stored, {}).fullName || user.email?.split('@')[0] || '');
            else        setUserName(user.email?.split('@')[0] || '');
          }
          const dbScore = await getTodayHealthScore();
          if (dbScore) {
            setScore({ nutrition: dbScore.nutrition, exercise: dbScore.activity, sleep: dbScore.sleep, mental: dbScore.fasting ?? 0, total: dbScore.total, activity: dbScore.activity, fasting: 0 });
            return;
          }
        } else {
          const stored = localStorage.getItem('profileData');
          if (stored) setUserName(safeParse<any>(stored, {}).fullName || '');
        }
        setScore(calculateLongevityScore());
      } finally {
        setIsLoading(false);
      }
    };

    fetchScore();
    const interval = setInterval(fetchScore, 60000);
    const onUpdate = () => fetchScore();
    window.addEventListener('healthDataUpdated', onUpdate);
    window.addEventListener('storage', onUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('healthDataUpdated', onUpdate);
      window.removeEventListener('storage', onUpdate);
    };
  }, []);

  // Date formatted per language
  const today = new Date().toLocaleDateString(
    language === 'th' ? 'th-TH' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  const lastUpdatedTime = new Date().toLocaleTimeString(
    language === 'th' ? 'th-TH' : 'en-US',
    { hour: '2-digit', minute: '2-digit' },
  );

  const avatarLetter = userName ? userName[0].toUpperCase() : null;

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="home-v2">

      {/* ══ HEADER ══════════════════════════════════════════════ */}
      <header className="hd-header">
        <div className="hd-header-left">
          <p className="hd-greeting">
            {t(getGreetingKey())}
            {userName && <span className="hd-user-name">, {userName}</span>}
          </p>
          <p className="hd-date">{today}</p>
        </div>
        <div className="hd-header-right">
          {isLiveDB && (
            <div className="hd-live-badge">
              <span className="hd-live-dot" />{t('home.live')}
            </div>
          )}
          <button className="hd-avatar-btn" onClick={() => onNavigate('profile')} aria-label={t('nav.profile')}>
            {avatarLetter
              ? <span className="hd-avatar-letter">{avatarLetter}</span>
              : <FaUser className="hd-avatar-icon" />
            }
          </button>
        </div>
      </header>

      <div className="hd-content page-content">

        {/* ══ 1. SCORE HERO ════════════════════════════════════ */}
        <section className="hd-card hd-score-hero">
          <p className="hd-score-eyebrow">{t('home.todayLongevityScore')}</p>

          {isLoading ? (
            <LoadingSkeleton type="ring" />
          ) : (
            <div className="hd-hero-layout">
              {/* Left: Ring */}
              <div className="hd-hero-ring-col">
                <ScoreRing score={ringScore} size={160} animated scoreLabel={t('longevity.ringLabel')} t={t} />
              </div>

              {/* Right: Meta info */}
              <div className="hd-hero-meta-col">
                <span className="hd-score-grade" style={{ color: scoreColor }}>
                  {t(scoreLabelKey)}
                </span>

                {delta !== null && (
                  <span className={`hd-score-delta ${delta >= 0 ? 'hd-delta--up' : 'hd-delta--down'}`}>
                    {delta >= 0 ? <FaArrowUp /> : <FaArrowDown />}
                    {Math.abs(delta)} {t('home.vsYesterday')}
                  </span>
                )}

                <div className="hd-last-updated">
                  <span className="hd-last-updated-label">{t('home.lastUpdated')}</span>
                  <span className="hd-last-updated-time">{lastUpdatedTime}</span>
                </div>
              </div>
            </div>
          )}
        </section>

        {!isLoading && (
          <LongevityIndexCard indexData={indexData} t={t} />
        )}

        {/* ══ 2. FOUR PILLAR CARDS (SHORTCUTS) ═════════════════════════════ */}
        <section>
          <h2 className="hd-section-title">{t('home.healthScoreSection')}</h2>
          <div className="hd-pillar-grid">
            {PILLARS.map(({ key, labelKey, icon: Icon, color, bg, nav, isFood }) => {
              const rawKey = key === 'exercise' ? (score.exercise !== undefined ? 'exercise' : 'activity') : key;
              const val    = (score as any)[rawKey] ?? 0;
              const { labelKey: statusLabelKey, color: statusColor } = getPillarStatusKey(val);

              return (
                <button
                  key={key}
                  className="hd-pillar-card hd-pillar-shortcut"
                  onClick={() => isFood ? onOpenFoodRecognition() : nav && onNavigate(nav)}
                  aria-label={`${t(labelKey)} shortcut`}
                >
                  <div className="hd-pillar-shortcut-top">
                    <div className="hd-pillar-icon-wrap" style={{ background: bg }}>
                      <Icon className="hd-pillar-icon" style={{ color }} />
                    </div>
                    <FaChevronRight className="hd-pillar-arrow" />
                  </div>
                  <div className="hd-pillar-info">
                    <div className="hd-pillar-name">{t(labelKey)}</div>
                    <span
                      className="hd-pillar-status"
                      style={{
                        color: val === 0 ? 'var(--text-tertiary)' : statusColor,
                        fontWeight: val === 0 ? 600 : 700,
                      }}
                    >
                      {val === 0 ? t('home.tapToLog') : t(statusLabelKey)}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {!isLoading && (
          <DailyGoalsCard
            goals={dailyGoals}
            streakDays={healthStreak.streakDays}
            onNavigate={onNavigate}
            onOpenFoodRecognition={onOpenFoodRecognition}
            t={t}
          />
        )}

        {/* ══ 3. AI HEALTH COACH & TIMELINE ═══════════════════ */}
        {!isLoading && (
          <>
            <AICoachCard advice={aiCoachAdvice} t={t} />
            <TimelineCard events={todayTimeline} t={t} />
          </>
        )}

        <div style={{ height: 8 }} />
      </div>

      <BottomNav
        active="home"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
      />
    </div>
  );
};
