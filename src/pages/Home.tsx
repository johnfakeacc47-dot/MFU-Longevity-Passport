import React, { useState, useEffect, useMemo } from 'react';
import { Activity, Utensils, Smile, Moon, Droplet, Camera, TrendingUp, TrendingDown } from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { TopBar } from '../components/TopBar';
import { Group, Row, ProgressBar, Chip, ScoreArc, ICON_PROPS } from '../components/v2';
import {
  calculateLongevityScore,
  getScoreLabelKey,
} from '../utils/longevityScore';
import { isSupabaseConfigured, getTodayHealthScore } from '../services/supabaseClient';
import { saveTodayWater } from '../utils/healthCoach';
import { getTodaySummary, splitHours, toPct } from '../utils/todaySummary';

import type { PageType } from '../types/pages';

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

// ── Component ──────────────────────────────────────────────────
export const Home: React.FC<HomeProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t, language } = useLanguage();
  useSEO(t('home.title'), 'Your daily longevity score, goals, and AI health coach at a glance.');
  const [score,     setScore]     = useState(calculateLongevityScore());
  const [isLoading, setIsLoading] = useState(true);
  const [yesterday, setYesterday] = useState<number | null>(null);
  // Bumped after a quick-log so the summary re-reads localStorage.
  const [logTick, setLogTick] = useState(0);

  const scoreLabelKey = getScoreLabelKey(score.total);
  const delta         = yesterday !== null ? score.total - yesterday : null;

  // Pillar scores are 0–25 internally; the redesigned UI shows 0–100.
  const pct = useMemo(() => ({
    exercise: toPct(score.exercise ?? score.activity),
    nutrition: toPct(score.nutrition),
    mental: toPct(score.mental),
    sleep: toPct(score.sleep),
  }), [score]);
  // Today's real logs for the pillar sub-lines; `score` is the recompute trigger.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const summary = useMemo(() => getTodaySummary(), [score, logTick]);

  // ── Fetch ───────────────────────────────────────────────────
  useEffect(() => {
    const fetchScore = async () => {
      try {
        const storedYesterday = localStorage.getItem('yesterdayScore');
        if (storedYesterday) setYesterday(Number(storedYesterday));
        if (isSupabaseConfigured()) {
          const dbScore = await getTodayHealthScore();
          if (dbScore) {
            setScore({ nutrition: dbScore.nutrition, exercise: dbScore.activity, sleep: dbScore.sleep, mental: dbScore.fasting ?? 0, total: dbScore.total, activity: dbScore.activity, fasting: 0 });
            return;
          }
        }
        setScore(calculateLongevityScore());
      } catch (err) {
        // Network/auth hiccup: keep whatever is on screen and fall back to the locally computed score.
        console.error('Home: fetchScore failed, using local score:', err);
        setScore(calculateLongevityScore());
      } finally {
        setIsLoading(false);
      }
    };

    fetchScore();
    const interval = setInterval(fetchScore, 60000);
    const onUpdate = () => { fetchScore(); setLogTick((n) => n + 1); };
    window.addEventListener('healthDataUpdated', onUpdate);
    window.addEventListener('storage', onUpdate);
    // Name edits on the Profile page apply immediately (QA-004).
    window.addEventListener('profileUpdated', onUpdate);
    return () => {
      clearInterval(interval);
      window.removeEventListener('healthDataUpdated', onUpdate);
      window.removeEventListener('storage', onUpdate);
      window.removeEventListener('profileUpdated', onUpdate);
    };
  }, []);

  const today = new Date().toLocaleDateString(
    language === 'th' ? 'th-TH' : 'en-US',
    { weekday: 'long', month: 'long', day: 'numeric' },
  );

  const sleepParts = summary.sleepHours !== null ? splitHours(summary.sleepHours) : null;
  const moodLabel = summary.mood ? t(`mental.mood${summary.mood[0].toUpperCase()}${summary.mood.slice(1)}`) : null;
  const empty = t('v2.noRecordYet');

  const pillars = [
    {
      key: 'act' as const, title: t('v2.pillar.activity'), icon: <Activity size={22} {...ICON_PROPS} />, value: pct.exercise, go: 'activity' as PageType,
      sub: summary.activeMinutes > 0 ? `${summary.activeMinutes} ${t('v2.unit.min')} · ~${summary.caloriesOut} kcal` : empty,
    },
    {
      key: 'food' as const, title: t('v2.pillar.food'), icon: <Utensils size={22} {...ICON_PROPS} />, value: pct.nutrition, go: 'eating-history' as PageType,
      sub: summary.meals > 0 ? `${summary.meals} ${t('v2.unit.meal')} · ~${summary.calories.toLocaleString()} kcal` : empty,
    },
    {
      key: 'mind' as const, title: t('v2.pillar.mind'), icon: <Smile size={22} {...ICON_PROPS} />, value: pct.mental, go: 'mental-health' as PageType,
      sub: moodLabel ? `${moodLabel}${summary.stress !== null ? ` · ${t('v2.stress')} ${summary.stress}/10` : ''}` : empty,
    },
    {
      key: 'sleep' as const, title: t('v2.pillar.sleep'), icon: <Moon size={22} {...ICON_PROPS} />, value: pct.sleep, go: 'sleep' as PageType,
      sub: sleepParts ? `${sleepParts.h} ${t('v2.unit.hr')} ${sleepParts.m} ${t('v2.unit.minShort')}` : empty,
    },
  ];

  const addWater = () => { saveTodayWater(1); setLogTick((n) => n + 1); };

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="v2-page">
      <TopBar title={t(getGreetingKey())} subtitle={today} onNavigate={onNavigate} />

      <section className="v2-score" aria-live="polite">
        <div className="v2-ring">
          <ScoreArc value={isLoading ? 0 : score.total} />
          <div className="v2-ring-center">
            <span className="v2-ring-num v2-tnum">{isLoading ? '–' : score.total}</span>
            <span className="v2-ring-of">{t('v2.outOf100')}</span>
          </div>
        </div>
        <div className="v2-score-copy">
          <span className="v2-caps">{t('v2.longevityToday')}</span>
          {delta !== null ? (
            <span className={`v2-trend ${delta < 0 ? 'v2-trend--down' : ''}`}>
              {delta >= 0 ? <TrendingUp size={20} {...ICON_PROPS} /> : <TrendingDown size={20} {...ICON_PROPS} />}
              {delta >= 0 ? t('v2.up') : t('v2.down')} {Math.abs(delta)} {t('v2.fromYesterday')}
            </span>
          ) : (
            <span className="v2-trend">{t(scoreLabelKey)}</span>
          )}
          <p className="v2-muted">{t('v2.resetNote')}</p>
        </div>
      </section>

      <div className="v2-section-head">
        <h2 className="v2-h2">{t('v2.fourPillars')}</h2>
        <button type="button" className="v2-link" onClick={() => onNavigate('dashboard')}>{t('v2.seeTrend')}</button>
      </div>

      <Group>
        {pillars.map((p) => (
          <Row
            key={p.key}
            className="v2-pillar-row"
            pillar={p.key}
            icon={p.icon}
            title={p.title}
            value={p.value}
            onClick={() => onNavigate(p.go)}
          >
            <ProgressBar value={p.value} pillar={p.key} label={p.title} />
            <span className="v2-row-sub">{p.sub}</span>
          </Row>
        ))}
      </Group>

      <h2 className="v2-h2">{t('v2.quickLog')}</h2>
      <div className="v2-quick">
        <Chip onClick={addWater}>
          <Droplet size={20} {...ICON_PROPS} /> {t('v2.water')} 250 {t('v2.unit.ml')}
        </Chip>
        <Chip onClick={onOpenFoodRecognition}><Camera size={20} {...ICON_PROPS} /> {t('v2.scanFood')}</Chip>
        <Chip onClick={() => onNavigate('mental-health')}><Smile size={20} {...ICON_PROPS} /> {t('v2.mood')}</Chip>
      </div>

    </div>
  );
};
