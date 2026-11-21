// Mental-health log page: mood / stress / energy / note form, 7-day summary + chart, mood history.
// Storage is unchanged (localStorage `mentalLogs`, one entry per day, older days kept).
// Sleep data is handled by components/SleepLog.tsx and is never touched here.
import React, { useEffect, useMemo, useState } from 'react';
import { Smile } from 'lucide-react';
import { PageHeader, IconChip, Group, Row, ICON_PROPS } from './v2';
import { MiniBars, lastDays, dayKeyOf, average } from './LogCharts';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeGetItem } from '../utils/safeStorage';
import type { MentalLog as MentalEntry } from '../utils/longevityScore';
import type { PageType } from '../types/pages';

type MoodType = MentalEntry['mood'];

// 1–5 faces in the reference map onto the existing 5-step mood enum.
const MOODS: { n: number; value: MoodType; key: string }[] = [
  { n: 1, value: 'awful',   key: 'v2.mood1' },
  { n: 2, value: 'bad',     key: 'v2.mood2' },
  { n: 3, value: 'neutral', key: 'v2.mood3' },
  { n: 4, value: 'good',    key: 'v2.mood4' },
  { n: 5, value: 'great',   key: 'v2.mood5' },
];
const moodNum = (m: MoodType) => MOODS.find((x) => x.value === m)?.n ?? 3;

interface Props {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

export const MentalLog: React.FC<Props> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  useSEO(`${t('v2.mentalPageTitle')} · MFU Longevity Passport`, 'Log how you feel today and review your last days.');

  const [logs, setLogs] = useState<MentalEntry[]>([]);
  const [mood, setMood] = useState<MoodType>('neutral');
  const [stress, setStress] = useState(5);
  const [energy, setEnergy] = useState(6);
  const [note, setNote] = useState('');
  const [touched, setTouched] = useState(false);
  const [todayLog, setTodayLog] = useState<MentalEntry | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const reload = () => {
    const all = safeGetItem<MentalEntry[]>('mentalLogs', []);
    setLogs([...all].sort((a, b) => +new Date(b.timestamp) - +new Date(a.timestamp)));
    return all;
  };

  // Load history and prefill today's entry if one exists.
  useEffect(() => {
    const all = reload();
    const existing = all.find((l) => new Date(l.timestamp).getTime() >= startOfToday());
    if (existing) {
      setTodayLog(existing);
      setMood(existing.mood); setStress(existing.stress); setEnergy(existing.energy); setNote(existing.note || '');
    }
  }, []);

  const notify = () => {
    window.dispatchEvent(new Event('healthDataUpdated'));
    window.dispatchEvent(new Event('storage'));
  };

  const save = () => {
    if (!touched) return;
    const entry: MentalEntry = { mood, stress, energy, note: note.trim() || undefined, timestamp: new Date().toISOString() };
    const older = safeGetItem<MentalEntry[]>('mentalLogs', []).filter((l) => new Date(l.timestamp).getTime() < startOfToday());
    localStorage.setItem('mentalLogs', JSON.stringify([entry, ...older]));
    setTodayLog(entry); reload();
    setTouched(false); notify();
    setJustSaved(true);
    window.setTimeout(() => setJustSaved(false), 2200);
  };

  const removeToday = () => {
    const older = safeGetItem<MentalEntry[]>('mentalLogs', []).filter((l) => new Date(l.timestamp).getTime() < startOfToday());
    localStorage.setItem('mentalLogs', JSON.stringify(older));
    setTodayLog(null); setMood('neutral'); setStress(5); setEnergy(6); setNote(''); setTouched(false);
    reload(); notify();
  };

  const locale = language === 'th' ? 'th-TH' : 'en-US';
  const days = useMemo(() => lastDays(7, locale), [locale]);
  const perDay = useMemo(() => days.map((d) => logs.find((l) => dayKeyOf(l.timestamp) === d.key) ?? null), [days, logs]);
  const moodVals = perDay.map((x) => (x ? moodNum(x.mood) : null));
  const logged = perDay.filter((x): x is MentalEntry => !!x);
  const avgStress = average(logged.map((x) => x.stress));
  const avgEnergy = average(logged.map((x) => x.energy));
  const round1 = (v: number | null) => (v === null ? '–' : `${Math.round(v * 10) / 10}/10`);
  const history = logs.slice(0, 7);
  const moodN = moodNum(mood);
  const moodLabel = (m: MoodType) => t(MOODS.find((x) => x.value === m)?.key ?? 'v2.mood3');

  return (
    <div className="v2-page v2-page--single">
      <PageHeader title={t('v2.mentalPageTitle')} onBack={() => onNavigate('eating')} backLabel={t('common.back')} />

      {/* ── Last 7 days ── */}
      <section className="v2-card" aria-label={t('v2.last7days')}>
        <div className="v2-stat-row">
          <div><span className="v2-label">{t('v2.avgStress')}</span><b className="v2-stat-num v2-tnum">{round1(avgStress)}</b></div>
          <div><span className="v2-label">{t('v2.avgEnergy')}</span><b className="v2-stat-num v2-tnum">{round1(avgEnergy)}</b></div>
          <div><span className="v2-label">{t('v2.daysLogged')}</span><b className="v2-stat-num v2-tnum">{logged.length}/7</b></div>
        </div>
        {logged.length === 0
          ? <p className="v2-muted">{t('v2.noMoodYet')}</p>
          : <MiniBars days={days} values={moodVals} max={5} ariaLabel={`${t('v2.moodHistory')} · ${t('v2.last7days')}`}
              format={(v) => moodLabel(MOODS.find((x) => x.n === v)?.value ?? 'neutral')} />}
      </section>

      {/* ── Form ── */}
      <div className="v2-form-title">
        <IconChip pillar="mind"><Smile size={22} {...ICON_PROPS} /></IconChip>
        <h2 className="v2-h2">{t('v2.howFeel')}</h2>
      </div>
      <div className="v2-mood" role="radiogroup" aria-label={t('v2.howFeel')}>
        {MOODS.map((x) => (
          <button key={x.n} type="button" role="radio" aria-checked={moodN === x.n}
            className={moodN === x.n ? 'is-on' : ''}
            onClick={() => { setMood(x.value); setTouched(true); }}>
            <b>{x.n}</b><span>{t(x.key)}</span>
          </button>
        ))}
      </div>

      <div className="v2-field">
        <div className="v2-slider-head">
          <label className="v2-label" htmlFor="stress">{t('v2.stressLevel')}</label>
          <b className="v2-tnum">{stress} / 10</b>
        </div>
        <input id="stress" type="range" min={1} max={10} value={stress} className="v2-range"
          onChange={(e) => { setStress(Number(e.target.value)); setTouched(true); }} />
        <div className="v2-slider-ends"><span>{t('v2.relaxed')}</span><span>{t('v2.veryStressed')}</span></div>
      </div>

      <div className="v2-field">
        <div className="v2-slider-head">
          <label className="v2-label" htmlFor="energy">{t('v2.energyLevel')}</label>
          <b className="v2-tnum">{energy} / 10</b>
        </div>
        <input id="energy" type="range" min={1} max={10} value={energy} className="v2-range"
          onChange={(e) => { setEnergy(Number(e.target.value)); setTouched(true); }} />
        <div className="v2-slider-ends"><span>{t('v2.lowEnergy')}</span><span>{t('v2.highEnergy')}</span></div>
      </div>

      <div className="v2-field">
        <label className="v2-label" htmlFor="note">{t('v2.noteOptional')}</label>
        <textarea id="note" className="v2-input" value={note} maxLength={500}
          onChange={(e) => { setNote(e.target.value); setTouched(true); }} />
      </div>

      {todayLog && (
        <button type="button" className="v2-link" style={{ alignSelf: 'flex-start' }} onClick={removeToday}>
          {t('v2.deleteTodayMood')}
        </button>
      )}

      {/* ── History ── */}
      {history.length > 0 && (
        <>
          <h2 className="v2-h2">{t('v2.moodHistory')}</h2>
          <Group>
            {history.map((l) => (
              <Row key={l.timestamp} pillar="mind" icon={<Smile size={20} {...ICON_PROPS} />}
                title={moodLabel(l.mood)}
                sub={`${new Date(l.timestamp).toLocaleDateString(locale, { day: 'numeric', month: 'short' })} · ${t('v2.stress')} ${l.stress}/10 · ${t('v2.energyShort')} ${l.energy}/10${l.note ? ` · ${l.note}` : ''}`} />
            ))}
          </Group>
        </>
      )}

      <div className="v2-sticky-cta">
        <button type="button" className="v2-btn v2-btn--primary" onClick={save} disabled={!touched}>
          {justSaved ? t('v2.saved') : t('common.save')}
        </button>
      </div>
    </div>
  );
};
