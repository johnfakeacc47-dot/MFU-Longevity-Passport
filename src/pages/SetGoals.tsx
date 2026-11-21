// ui_ref2 "เป้าหมาย". Same store as before (utils/userGoals — the coach reads it):
// fasting window, sleep target and daily activity minutes. The list shows today's
// real progress against each target; the form below edits one target at a time.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, Moon, Timer, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { PageHeader, Group, Row, Chip, ProgressBar, ICON_PROPS } from '../components/v2';
import type { Pillar } from '../components/v2';
import { USER_GOALS_KEY, GOAL_RANGES, readUserGoals, type UserGoals } from '../utils/userGoals';
import { getTodaySummary } from '../utils/todaySummary';
import type { PageType } from '../types/pages';

interface SetGoalsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

type GoalKey = 'activityMinutes' | 'sleepHours' | 'fastingHours';

const fastedHoursNow = (): number => {
  if (localStorage.getItem('fastingActive') !== 'true') return 0;
  const st = localStorage.getItem('fastingStartTime');
  if (!st) return 0;
  return Math.max(0, (Date.now() - new Date(st).getTime()) / 3600000);
};

export const SetGoals: React.FC<SetGoalsProps> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const isTh = language === 'th';
  useSEO(`${t('setGoals.title')} · MFU Longevity Passport`, 'Set and adjust your personal health goals.');

  // Clamped to the allowed ranges, so a stale/hand-edited value can't escape them.
  const [goals, setGoals] = useState<UserGoals>(readUserGoals);
  const [filter, setFilter] = useState<'active' | 'done'>('active');
  const [category, setCategory] = useState<GoalKey>('activityMinutes');
  const [draft, setDraft] = useState<string>(String(goals.activityMinutes));
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current) window.clearTimeout(timer.current); }, []);

  const summary = useMemo(() => getTodaySummary(), []);

  const items = useMemo(() => {
    const act = summary.activeMinutes;
    const slp = summary.sleepHours ?? 0;
    const fast = fastedHoursNow();
    const pct = (v: number, g: number) => Math.max(0, Math.min(100, Math.round((v / g) * 100)));
    return [
      {
        key: 'activityMinutes' as GoalKey, pillar: 'act' as Pillar, icon: <Activity size={22} {...ICON_PROPS} />,
        title: isTh ? `ออกกำลังกายวันละ ${goals.activityMinutes} นาที` : `${goals.activityMinutes} minutes of activity a day`,
        pct: pct(act, goals.activityMinutes),
        sub: isTh ? `วันนี้ ${act} นาที` : `Today ${act} min`,
      },
      {
        key: 'sleepHours' as GoalKey, pillar: 'sleep' as Pillar, icon: <Moon size={22} {...ICON_PROPS} />,
        title: isTh ? `นอนให้ได้ ${goals.sleepHours} ชั่วโมง` : `Sleep ${goals.sleepHours} hours`,
        pct: pct(slp, goals.sleepHours),
        sub: isTh ? `คืนล่าสุด ${slp ? slp.toFixed(1) : 0} ชม.` : `Last night ${slp ? slp.toFixed(1) : 0} h`,
      },
      {
        key: 'fastingHours' as GoalKey, pillar: 'water' as Pillar, icon: <Timer size={22} {...ICON_PROPS} />,
        title: isTh ? `ช่วงอดอาหาร ${goals.fastingHours} ชั่วโมง` : `${goals.fastingHours}-hour fasting window`,
        pct: pct(fast, goals.fastingHours),
        sub: fast > 0 ? (isTh ? `ผ่านมา ${fast.toFixed(1)} ชม.` : `${fast.toFixed(1)} h so far`) : (isTh ? 'ยังไม่ได้เริ่มจับเวลา' : 'Timer not started'),
      },
    ];
  }, [goals, summary, isTh]);

  const active = items.filter((i) => i.pct < 100);
  const done = items.filter((i) => i.pct >= 100);
  const shown = filter === 'active' ? active : done;

  const pickCategory = (key: GoalKey) => { setCategory(key); setDraft(String(goals[key])); setSaveState('idle'); };

  const range = GOAL_RANGES[category];
  const unit = category === 'activityMinutes' ? (isTh ? 'นาที' : 'min') : (isTh ? 'ชม.' : 'h');
  const step = category === 'sleepHours' ? 0.5 : 1;
  const value = Number(draft);
  const valid = Number.isFinite(value) && value >= range.min && value <= range.max;

  const save = () => {
    if (!valid) return;
    const next: UserGoals = { ...goals, [category]: value, updatedAt: new Date().toISOString() };
    try {
      localStorage.setItem(USER_GOALS_KEY, JSON.stringify(next));
    } catch (err) {
      console.error('Failed to save goals:', err);
      setSaveState('error');
      return;
    }
    setGoals(next);
    // Same event the loggers fire, so Home/Dashboard recompute against the new targets.
    window.dispatchEvent(new CustomEvent('healthDataUpdated'));
    setSaveState('saved');
  };

  const cats: { key: GoalKey; label: string }[] = [
    { key: 'activityMinutes', label: isTh ? 'กิจกรรม' : 'Activity' },
    { key: 'sleepHours', label: isTh ? 'การนอน' : 'Sleep' },
    { key: 'fastingHours', label: isTh ? 'อดอาหาร' : 'Fasting' },
  ];

  return (
    <div className="v2-page v2-page--nonav">
      <PageHeader title={t('v2.myGoals')} onBack={() => onNavigate('dashboard')} backLabel={t('common.back')} />

      <div className="v2-chips">
        <Chip on={filter === 'active'} onClick={() => setFilter('active')}>{isTh ? `กำลังทำ ${active.length}` : `In progress ${active.length}`}</Chip>
        <Chip on={filter === 'done'} onClick={() => setFilter('done')}>{isTh ? `สำเร็จแล้ว ${done.length}` : `Completed ${done.length}`}</Chip>
      </div>

      {shown.length === 0 ? (
        <p className="v2-muted" style={{ padding: '8px 4px' }}>{filter === 'active' ? t('v2.allGoalsDone') : t('v2.noGoalsDone')}</p>
      ) : (
        <Group>
          {shown.map((g) => (
            <Row key={g.key} className="v2-goal-row" pillar={g.pillar} icon={g.icon} title={g.title}
              value={<span className="v2-goal-pct">{g.pct}%</span>}>
              <ProgressBar value={g.pct} pillar={g.pillar} label={g.title} />
              <span className="v2-row-sub">{g.sub}</span>
            </Row>
          ))}
        </Group>
      )}

      <hr className="v2-rule" />
      <h2 className="v2-h2">{t('v2.adjustGoal')}</h2>

      <div className="v2-field">
        <span className="v2-label">{t('v2.category')}</span>
        <div className="v2-chips" role="group" aria-label={t('v2.category')}>
          {cats.map((c) => <Chip key={c.key} on={category === c.key} onClick={() => pickCategory(c.key)}>{c.label}</Chip>)}
        </div>
      </div>

      <div className="v2-field">
        <label className="v2-label" htmlFor="goal-target">{t('v2.targetPerDay')}</label>
        <div className="v2-input-wrap">
          <input id="goal-target" className="v2-input" type="number" inputMode="decimal" min={range.min} max={range.max} step={step}
            value={draft} onChange={(e) => { setDraft(e.target.value); setSaveState('idle'); }} aria-invalid={!valid}
            style={{ paddingRight: 64 }} />
          <span className="v2-input-suffix">{unit}</span>
        </div>
        <span className="v2-muted" style={{ fontSize: 13 }}>{t('v2.allowedRange')} {range.min}–{range.max} {unit}</span>
      </div>

      {saveState === 'saved' && <div className="v2-alert v2-alert--ok" role="status">{t('setGoals.saved')}</div>}
      {saveState === 'error' && <div className="v2-alert v2-alert--error" role="alert">{t('v2.saveFailed')}</div>}

      <div className="v2-sticky-cta">
        <button type="button" className="v2-btn v2-btn--primary" onClick={save} disabled={!valid}>
          <Plus size={20} {...ICON_PROPS} /> {t('v2.saveGoal')}
        </button>
      </div>
    </div>
  );
};
