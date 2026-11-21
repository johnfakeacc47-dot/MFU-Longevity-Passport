// Sleep log page: bedtime / wake time / quality form, 7-night summary + chart, history with delete.
// Storage, scoring and API calls are unchanged from the former combined screen
// (localStorage `sleepLogs`, plus the Nest health API when Supabase is not the backend).
// Mental-health data is handled by components/MentalLog.tsx and is never touched here.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Moon, Trash2 } from 'lucide-react';
import { PageHeader, Chip, IconChip, Group, Row, ICON_PROPS } from './v2';
import { MiniBars, lastDays, dayKeyOf, average } from './LogCharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { calculateSleepQuality } from './SleepQualityIndicator';
import type { PageType } from '../types/pages';

interface SleepEntry {
  id: number | string;
  bedtime: string;
  waketime: string;
  duration: number;
  quality: number;
  timestamp: string;
  date: string;
}

// Sleep quality chips -> the stored 1–10 quality score.
const QUALITIES: { score: number; key: string }[] = [
  { score: 2, key: 'v2.q1' }, { score: 4, key: 'v2.q2' }, { score: 6, key: 'v2.q3' },
  { score: 8, key: 'v2.q4' }, { score: 10, key: 'v2.q5' },
];
const nearestQuality = (score: number) =>
  QUALITIES.reduce((best, q) => (Math.abs(q.score - score) < Math.abs(best.score - score) ? q : best), QUALITIES[0]).score;

// The backend exposes POST + GET for sleep only (no DELETE), so delete is hidden in API mode.
const usesHealthApi = isApiConfigured && !isSupabaseConfigured();

const calcDuration = (bed: string, wake: string): number => {
  const [bH, bM] = bed.split(':').map(Number);
  const [wH, wM] = wake.split(':').map(Number);
  const bedMin = bH * 60 + bM;
  let wakeMin = wH * 60 + wM;
  if (wakeMin < bedMin) wakeMin += 1440;
  return Math.round(((wakeMin - bedMin) / 60) * 10) / 10;
};
const hm = (hours: number) => ({ h: Math.floor(hours), m: Math.round((hours - Math.floor(hours)) * 60) });

interface Props {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const SleepLog: React.FC<Props> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  useSEO(`${t('v2.sleepPageTitle')} · MFU Longevity Passport`, 'Log your sleep and review your last nights.');

  const [logs, setLogs] = useState<SleepEntry[]>([]);
  const [bedtime, setBedtime] = useState('22:00');
  const [waketime, setWaketime] = useState('06:30');
  const [qualityOverride, setQualityOverride] = useState<number | null>(null);
  const [touched, setTouched] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadLogs = useCallback(async () => {
    if (usesHealthApi) {
      try {
        const to = new Date(); const from = new Date();
        from.setDate(to.getDate() - 30);
        const data = await healthApi.getSleepHistory(from.toISOString(), to.toISOString());
        const norm: SleepEntry[] = (Array.isArray(data) ? data : []).map((item: any) => ({
          id: item.id,
          bedtime:  item.bedtime  ? new Date(item.bedtime).toLocaleTimeString('en-GB',  { hour: '2-digit', minute: '2-digit' }) : '22:00',
          waketime: item.waketime ? new Date(item.waketime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '06:00',
          duration: item.duration ? Math.round((item.duration / 60) * 10) / 10 : 0,
          quality:  item.quality || 0,
          timestamp: item.createdAt,
          date: new Date(item.createdAt).toLocaleDateString('th-TH'),
        }));
        setLogs(norm); return;
      } catch (e) {
        console.error('Sleep API error:', e);
      }
    }
    const saved = localStorage.getItem('sleepLogs');
    if (saved) setLogs(safeParse(saved, []));
  }, []);
  useEffect(() => { void loadLogs(); }, [loadLogs]);

  const duration = calcDuration(bedtime, waketime);
  const durationInvalid = duration <= 0;
  const autoQuality = useMemo(() => (durationInvalid ? 2 : calculateSleepQuality(duration, bedtime).score), [duration, durationInvalid, bedtime]);
  const selectedQuality = qualityOverride ?? nearestQuality(autoQuality);
  const storedQuality = qualityOverride ?? autoQuality;
  const { h, m } = hm(duration);

  const save = async () => {
    if (durationInvalid || saving) return;
    setSaving(true); setSyncError(null);
    const entry: SleepEntry = {
      id: Date.now(), bedtime, waketime, duration, quality: storedQuality,
      timestamp: new Date().toISOString(), date: new Date().toLocaleDateString('th-TH'),
    };
    const updated = [entry, ...logs];
    setLogs(updated);
    localStorage.setItem('sleepLogs', JSON.stringify(updated));
    if (usesHealthApi) {
      try {
        const now = new Date();
        const [bH, bM] = bedtime.split(':').map(Number);
        const [wH, wM] = waketime.split(':').map(Number);
        const bedT = new Date(now); bedT.setHours(bH, bM, 0, 0);
        const wakeT = new Date(now); wakeT.setHours(wH, wM, 0, 0);
        if (wakeT < bedT) wakeT.setDate(wakeT.getDate() + 1);
        await healthApi.logSleep({ bedtime: bedT.toISOString(), waketime: wakeT.toISOString(), duration: Math.round(duration * 60), quality: storedQuality });
      } catch (e) {
        console.error('Failed to log sleep API:', e);
        setSyncError(t('sleep.syncFailed'));
      }
    }
    setTouched(false); setQualityOverride(null); setSaving(false);
    window.dispatchEvent(new Event('healthDataUpdated'));
    window.dispatchEvent(new Event('storage'));
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2200);
  };

  const remove = (id: number | string) => {
    const updated = logs.filter((l) => l.id !== id);
    setLogs(updated);
    localStorage.setItem('sleepLogs', JSON.stringify(updated));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const days = useMemo(() => lastDays(7, locale), [locale]);
  // one value per calendar day: the most recent entry of that day
  const perDay = useMemo(() => days.map((d) => {
    const dayLogs = logs.filter((l) => dayKeyOf(l.timestamp) === d.key).sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp));
    return dayLogs[0] ?? null;
  }), [days, logs]);
  const durations = perDay.map((x) => (x ? x.duration : null));
  const loggedDur = durations.filter((x): x is number => x !== null);
  const avgDur = average(loggedDur);
  const avgQ = average(perDay.filter((x): x is SleepEntry => !!x && x.quality > 0).map((x) => x.quality));
  const avg = avgDur !== null ? hm(avgDur) : null;
  const recent = logs.slice(0, 10);

  return (
    <div className="v2-page v2-page--single">
      <PageHeader title={t('v2.sleepPageTitle')} onBack={() => onNavigate('eating')} backLabel={t('common.back')} />

      {/* ── Last 7 nights ── */}
      <section className="v2-card" aria-label={t('v2.last7days')}>
        <div className="v2-stat-row">
          <div><span className="v2-label">{t('v2.avgSleepHours')}</span>
            <b className="v2-stat-num v2-tnum">{avg ? `${avg.h} ${t('v2.unit.hr')} ${avg.m} ${t('v2.unit.minShort')}` : '–'}</b></div>
          <div><span className="v2-label">{t('v2.avgSleepQuality')}</span>
            <b className="v2-stat-num v2-tnum">{avgQ !== null ? `${Math.round(avgQ * 10) / 10}/10` : '–'}</b></div>
          <div><span className="v2-label">{t('v2.nightsLogged')}</span>
            <b className="v2-stat-num v2-tnum">{loggedDur.length}/7</b></div>
        </div>
        {loggedDur.length === 0
          ? <p className="v2-muted">{t('v2.noSleepYet')}</p>
          : <MiniBars days={days} values={durations} max={Math.max(10, ...loggedDur)} ariaLabel={`${t('v2.avgSleepHours')} · ${t('v2.last7days')}`} />}
      </section>

      {/* ── Form ── */}
      <div className="v2-form-title">
        <IconChip pillar="sleep"><Moon size={22} {...ICON_PROPS} /></IconChip>
        <h2 className="v2-h2">{t('v2.lastNight')}</h2>
      </div>
      <div className="v2-two">
        <div className="v2-field">
          <label className="v2-label" htmlFor="bedtime">{t('v2.bedtime')}</label>
          <input id="bedtime" type="time" className="v2-timeinput" value={bedtime}
            onChange={(e) => { setBedtime(e.target.value); setTouched(true); setQualityOverride(null); }} />
        </div>
        <div className="v2-field">
          <label className="v2-label" htmlFor="waketime">{t('v2.waketime')}</label>
          <input id="waketime" type="time" className="v2-timeinput" value={waketime}
            onChange={(e) => { setWaketime(e.target.value); setTouched(true); setQualityOverride(null); }} />
        </div>
      </div>
      <p className="v2-muted" aria-live="polite">
        {t('v2.total')} <b style={{ color: 'var(--v2-text)' }}>{durationInvalid ? '–' : `${h} ${t('v2.unit.hr')} ${m} ${t('v2.unit.minShort')}`}</b>
        {' · '}{t('v2.sleepGoal')}
      </p>
      <div className="v2-field v2-quality">
        <span className="v2-label">{t('v2.sleepQuality')}</span>
        <div className="v2-chips" role="group" aria-label={t('v2.sleepQuality')}>
          {QUALITIES.map((q) => (
            <Chip key={q.score} on={selectedQuality === q.score} onClick={() => { setQualityOverride(q.score); setTouched(true); }}>{t(q.key)}</Chip>
          ))}
        </div>
      </div>
      {syncError && <p className="v2-alert v2-alert--error" role="alert">{syncError}</p>}

      {/* ── History ── */}
      {recent.length > 0 && (
        <>
          <h2 className="v2-h2">{t('v2.sleepHistory')}</h2>
          <Group>
            {recent.map((l) => {
              const d = hm(l.duration);
              return (
                <Row key={l.id} pillar="sleep" icon={<Moon size={20} {...ICON_PROPS} />}
                  title={`${d.h} ${t('v2.unit.hr')} ${d.m} ${t('v2.unit.minShort')}`}
                  sub={`${l.bedtime} → ${l.waketime} · ${new Date(l.timestamp).toLocaleDateString(locale, { day: 'numeric', month: 'short' })}`}
                  end={!usesHealthApi ? (
                    <button type="button" className="v2-iconbtn" onClick={() => remove(l.id)} aria-label={t('common.delete')}>
                      <Trash2 size={18} {...ICON_PROPS} />
                    </button>
                  ) : undefined} />
              );
            })}
          </Group>
        </>
      )}

      <div className="v2-sticky-cta">
        <button type="button" className="v2-btn v2-btn--primary" onClick={() => void save()} disabled={!touched || durationInvalid || saving}>
          {justSaved ? t('v2.saved') : t('common.save')}
        </button>
      </div>
    </div>
  );
};
