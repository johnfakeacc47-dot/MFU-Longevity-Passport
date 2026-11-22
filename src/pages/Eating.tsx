import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { Activity, Utensils, Smile, Moon, Droplet, Timer, Camera, Plus, Minus, Play, Square, Check, Target, Info } from 'lucide-react';
import { useSEO } from '../hooks/useSEO';
import { safeGetItem, safeSetItem } from '../utils/safeStorage';
import type { MealLog, Macros } from '../utils/longevityScore';
import { getTodayWater, saveTodayWater } from '../utils/healthCoach';
import { mealDisplayName } from '../utils/foodNames';
import { scheduleFastingAlarm, cancelFastingAlarm } from '../services/notifications';
import { startFastingTimer, stopFastingTimer } from '../services/supabaseClient';
import { FaTrash, FaPencil, FaCheck, FaXmark, FaRotateLeft } from 'react-icons/fa6';
import { TopBar } from '../components/TopBar';
import { PageHeader, Group, Row, Chip, IconChip, ProgressBar, ScoreArc, ICON_PROPS } from '../components/v2';
import type { Pillar } from '../components/v2';
import { getTodaySummary, splitHours } from '../utils/todaySummary';
import { ScanCard } from '../components/ScanCard';
import '../styles/components/eating.css';

// ─── Types ────────────────────────────────────────────────────────────────────
import type { PageType } from '../types/pages';

type SubView = 'dashboard' | 'food-log' | 'macros' | 'water' | 'schedule' | 'history';
type HistoryFilter = 'today' | 'week' | 'month';

interface EatingProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
  view?: SubView;
}

interface FastingSession {
  startTime: string;
  endTime: string;
  targetHours: number;
  actualHours: number;
}

// ─── Daily nutrition targets ──────────────────────────────────────────────────
const DEFAULT_TARGETS = {
  calories: 2000,
  protein: 80,   // g
  carbs: 220,    // g
  fat: 60,       // g
  sugar: 50,     // g
  fiber: 25,     // g
  sodium: 2300,  // mg
  water: 8,      // glasses
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const todayStart = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d.getTime(); };

const fmtTime = (ts: string, isTh: boolean) =>
  new Date(ts).toLocaleTimeString(isTh ? 'th-TH' : 'en-US', { hour: '2-digit', minute: '2-digit' });

const fmtDate = (ts: string, isTh: boolean) =>
  new Date(ts).toLocaleDateString(isTh ? 'th-TH' : 'en-US', { weekday: 'short', month: 'short', day: 'numeric' });

// Fasting protocols → hours fasted. Kept as data (not parsed from the label) so
// 'OMAD' can't turn into NaN (it used to via Number('OMAD'.split(':')[0])).
const SCHEDULES: { id: string; fastHours: number }[] = [
  { id: '12:12', fastHours: 12 },
  { id: '14:10', fastHours: 14 },
  { id: '16:8',  fastHours: 16 },
  { id: '18:6',  fastHours: 18 },
  { id: '20:4',  fastHours: 20 },
  { id: 'OMAD',  fastHours: 23 },
];
const MIN_FAST_HOURS = 1;
const MAX_FAST_HOURS = 23;
const clampFastHours = (n: number) =>
  Number.isFinite(n) ? Math.min(MAX_FAST_HOURS, Math.max(MIN_FAST_HOURS, Math.round(n))) : MIN_FAST_HOURS;
const isValidFastHours = (n: number) => Number.isFinite(n) && n >= MIN_FAST_HOURS && n <= MAX_FAST_HOURS;

const fmtHMS = (sec: number) => {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// ─── Main Component ───────────────────────────────────────────────────────────
export const Eating: React.FC<EatingProps> = ({ onNavigate, onOpenFoodRecognition, view = 'dashboard' }) => {
  const { t, language } = useLanguage();
  const isTh = language === 'th';
  useSEO(`${t('food.title')} · MFU Longevity Passport`, 'Log meals, track macros, water intake, and your eating schedule.');
  const subView = view;

  // ── State ───────────────────────────────────────────────────────────────────
  const [meals, setMeals] = useState<MealLog[]>([]);
  const [selectedMeal, setSelectedMeal] = useState<{ meal: MealLog; globalIdx: number } | null>(null);
  const [editingMeal, setEditingMeal] = useState<MealLog | null>(null);
  const [water, setWater] = useState({ glasses: 0, target: DEFAULT_TARGETS.water });

  // Fasting
  const [fastHours, setFastHours] = useState(16);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [selectedSched, setSelectedSched] = useState('16:8');
  const [customHrs, setCustomHrs] = useState(16);
  const [fastHistory, setFastHistory] = useState<FastingSession[]>([]);

  // History Filter
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>('today');

  // ── Profile targets ─────────────────────────────────────────────────────────
  const targets = useMemo(() => {
    const profile = safeGetItem<any>('profileData', {});
    return { ...DEFAULT_TARGETS, calories: profile.targetCalories || DEFAULT_TARGETS.calories };
  }, []);

  // ── Loaders ─────────────────────────────────────────────────────────────────
  const loadMeals = useCallback(() => {
    const all = safeGetItem<MealLog[]>('meals', []);
    setMeals(all);
  }, []);

  const loadWater = useCallback(() => {
    const w = getTodayWater();
    setWater({ glasses: w.glasses, target: Math.round(w.targetMl / 250) || DEFAULT_TARGETS.water });
  }, []);

  const loadFasting = useCallback(() => {
    const active = localStorage.getItem('fastingActive') === 'true';
    const hist = safeGetItem<FastingSession[]>('fastingHistory', []);
    setFastHistory(hist.slice(-7).reverse());
    if (active) {
      const st = localStorage.getItem('fastingStartTime');
      // A stored "NaN" (from the old OMAD bug) made `elapsed < NaN` false and
      // auto-expired every fast on load — treat anything non-finite as 16 h.
      const storedHrs = Number(localStorage.getItem('fastingTargetHours') || '16');
      const hrs = isValidFastHours(storedHrs) ? storedHrs : 16;
      if (st) {
        const start = new Date(st);
        const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
        if (elapsed < hrs * 3600) {
          setStartTime(start); setFastHours(hrs); setElapsedSec(elapsed); setIsRunning(true);
          // Re-arm the local alarm — the service worker may have restarted
          // (losing its in-memory timer) since the fast began.
          void scheduleFastingAlarm(start.getTime() + hrs * 3600_000, hrs).catch(() => { /* notifications unavailable */ });
          return;
        }
        // Auto-complete expired fast
        const session: FastingSession = {
          startTime: st, endTime: new Date().toISOString(),
          targetHours: hrs, actualHours: +(elapsed / 3600).toFixed(1),
        };
        const updated = [...hist, session];
        localStorage.setItem('fastingHistory', JSON.stringify(updated));
        localStorage.removeItem('fastingActive');
        localStorage.removeItem('fastingStartTime');
        localStorage.removeItem('fastingTargetHours');
      }
    }
    setIsRunning(false); setStartTime(null); setElapsedSec(0);
  }, []);

  useEffect(() => {
    loadMeals(); loadWater(); loadFasting();
  }, [loadMeals, loadWater, loadFasting]);

  // Separate effect (keyed on `view`/`onNavigate`) so `onResetView` always closes over the
  // current subview instead of the one Eating first mounted with — a stale closure otherwise.
  useEffect(() => {
    const onUpdate = () => { loadMeals(); loadWater(); };
    const onResetView = () => {
      if (view !== 'dashboard') {
        onNavigate('eating');
      }
      loadMeals();
      loadWater();
    };
    window.addEventListener('healthDataUpdated', onUpdate);
    window.addEventListener('pageChange', onUpdate);
    window.addEventListener('eatingResetView', onResetView);
    return () => {
      window.removeEventListener('healthDataUpdated', onUpdate);
      window.removeEventListener('pageChange', onUpdate);
      window.removeEventListener('eatingResetView', onResetView);
    };
  }, [view, onNavigate, loadMeals, loadWater]);

  useEffect(() => {
    if (!isRunning || !startTime) return;
    const iv = window.setInterval(() =>
      setElapsedSec(Math.floor((Date.now() - startTime.getTime()) / 1000)), 1000);
    return () => window.clearInterval(iv);
  }, [isRunning, startTime]);

  // ── Derived totals (Today) ──────────────────────────────────────────────────
  const todayMeals = useMemo(() => {
    const ts = todayStart();
    return meals.map((m, i) => ({ meal: m, globalIdx: i })).filter(({ meal }) => new Date(meal.timestamp).getTime() >= ts);
  }, [meals]);

  const totalCals = todayMeals.reduce((s, { meal }) => s + (meal.calories || 0), 0);
  const macros = useMemo<Macros & { fiber: number }>(() => todayMeals.reduce(
    (a, { meal }) => ({
      protein: a.protein + (meal.macros?.protein || 0),
      carbs: a.carbs + (meal.macros?.carbs || 0),
      fat: a.fat + (meal.macros?.fat || 0),
      sugar: a.sugar + (meal.macros?.sugar || 0),
      sodium: a.sodium + (meal.macros?.sodium || 0),
      fiber: a.fiber + (meal.macros?.fiber || 0),
    }),
    { protein: 0, carbs: 0, fat: 0, sugar: 0, sodium: 0, fiber: 0 }
  ), [todayMeals]);

  const waterPct = Math.min((water.glasses / water.target) * 100, 100);
  const fastPct = fastHours > 0 ? Math.min((elapsedSec / (fastHours * 3600)) * 100, 100) : 0;
  const fastRem = Math.max(0, fastHours * 3600 - elapsedSec);

  // Nutrition Score & Insights
  const nutritionScoreData = useMemo(() => {
    let score = 100;
    const insights: { text: string; type: 'good' | 'warn' | 'neutral' }[] = [];

    if (totalCals === 0) {
      return { score: 0, insights: [{ text: isTh ? 'ยังไม่มีข้อมูลวันนี้' : 'No data today', type: 'neutral' }] };
    }

    if (totalCals > targets.calories * 1.1) {
      score -= 15;
      insights.push({ text: isTh ? 'แคลอรี่สูงกว่าเป้าหมาย' : 'Calories above target', type: 'warn' });
    } else if (totalCals >= targets.calories * 0.7) {
      insights.push({ text: isTh ? '✓ แคลอรี่เหมาะสม' : '✓ Appropriate calories', type: 'good' });
    }

    if (macros.protein >= targets.protein * 0.8) {
      insights.push({ text: isTh ? '✓ โปรตีนเพียงพอ' : '✓ Sufficient protein', type: 'good' });
    } else {
      score -= 10;
      insights.push({ text: isTh ? 'ควรเพิ่มโปรตีน' : 'Need more protein', type: 'warn' });
    }

    if (macros.sugar > targets.sugar) {
      score -= 15;
      insights.push({ text: isTh ? 'น้ำตาลสูงเกินไป' : 'Sugar is too high', type: 'warn' });
    }

    if (macros.fiber >= targets.fiber * 0.8) {
      insights.push({ text: isTh ? '✓ ใยอาหารดีเยี่ยม' : '✓ Excellent fiber', type: 'good' });
    }

    return { score: Math.max(0, score), insights };
  }, [totalCals, macros, targets, isTh]);

  // ── Meal CRUD ────────────────────────────────────────────────────────────────
  /** Returns false (and leaves UI state untouched) when the storage write failed. */
  const deleteMeal = (globalIdx: number): boolean => {
    const all = [...meals];
    all.splice(globalIdx, 1);
    if (!safeSetItem('meals', all)) return false;
    setMeals(all);
    window.dispatchEvent(new Event('healthDataUpdated'));
    setSelectedMeal(null);
    return true;
  };

  const saveMealEdit = (updated: MealLog, globalIdx: number) => {
    const all = [...meals];
    all[globalIdx] = updated;
    if (!safeSetItem('meals', all)) return; // storage full — keep the on-screen state untouched rather than claim the edit saved
    setMeals(all);
    window.dispatchEvent(new Event('healthDataUpdated'));
    setSelectedMeal(null);
    setEditingMeal(null);
  };

  const recalcCalories = (m: { protein: number; carbs: number; fat: number }) =>
    Math.round(m.protein * 4 + m.carbs * 4 + m.fat * 9);

  // ── Water controls ────────────────────────────────────────────────────────────
  const updateWater = (n: number) => {
    const clamped = Math.max(0, Math.min(20, n));
    const diff = clamped - water.glasses;
    saveTodayWater(diff);
    setWater(w => ({ ...w, glasses: clamped }));
  };

  // ── IF controls ───────────────────────────────────────────────────────────────
  const selectedFastHours = selectedSched === 'custom'
    ? customHrs
    : (SCHEDULES.find(sc => sc.id === selectedSched)?.fastHours ?? NaN);
  const canStartFasting = isValidFastHours(selectedFastHours);

  const startFasting = () => {
    const hrs = selectedFastHours;
    if (!isValidFastHours(hrs)) return;
    const now = new Date();
    setFastHours(hrs); setStartTime(now); setElapsedSec(0); setIsRunning(true);
    localStorage.setItem('fastingActive', 'true');
    localStorage.setItem('fastingStartTime', now.toISOString());
    localStorage.setItem('fastingTargetHours', String(hrs));
    window.dispatchEvent(new Event('healthDataUpdated'));

    // Local alarm — fires on this device the moment the fast completes.
    void scheduleFastingAlarm(now.getTime() + hrs * 3600_000, hrs).catch((err) => console.warn('scheduleFastingAlarm failed:', err));
    // Server copy — lets the scheduled reminder job catch the completion even
    // if this browser was closed before the local alarm could fire.
    startFastingTimer(hrs).catch((err) => console.error('startFastingTimer failed:', err));
  };

  const stopFasting = () => {
    const hist = safeGetItem<FastingSession[]>('fastingHistory', []);
    if (startTime) {
      const session: FastingSession = {
        startTime: startTime.toISOString(),
        endTime: new Date().toISOString(),
        targetHours: fastHours,
        actualHours: +(elapsedSec / 3600).toFixed(1),
      };
      hist.push(session);
      localStorage.setItem('fastingHistory', JSON.stringify(hist));
      setFastHistory([...hist].slice(-7).reverse());
    }
    setIsRunning(false); setStartTime(null); setElapsedSec(0);
    ['fastingActive', 'fastingStartTime', 'fastingTargetHours'].forEach(k => localStorage.removeItem(k));
    window.dispatchEvent(new Event('healthDataUpdated'));

    void cancelFastingAlarm().catch((err) => console.warn('cancelFastingAlarm failed:', err));
    stopFastingTimer().catch((err) => console.error('stopFastingTimer failed:', err));
  };

  const handleBack = () => {
    if (subView !== 'dashboard') onNavigate('eating');
    else onNavigate('home');
  };

  const TITLES: Record<SubView, string> = {
    dashboard: isTh ? 'บันทึกผลสุขภาพ' : 'Log Results',
    'food-log': isTh ? 'บันทึกอาหาร' : 'Food Log',
    macros: isTh ? 'สารอาหารประจำวัน' : 'Daily Nutrition',
    water: isTh ? 'น้ำดื่ม' : 'Hydration',
    schedule: isTh ? 'รูปแบบการกิน' : 'Eating Schedule',
    history: isTh ? 'ประวัติอาหาร' : 'Food History',
  };

  // ── v2 building blocks shared by the sub-views ─────────────────────────────
  const mealRow = (meal: MealLog, globalIdx: number, showDate: boolean) => (
    <button key={globalIdx} type="button" className="v2-row" onClick={() => setSelectedMeal({ meal, globalIdx })}>
      {meal.imageUrl
        ? <img src={meal.imageUrl} alt="" className="v2-thumb" />
        : <IconChip pillar="food" size="lg"><Utensils size={22} {...ICON_PROPS} /></IconChip>}
      <span className="v2-row-main">
        <span className="v2-row-top">
          <span className="v2-row-title">{mealDisplayName(meal, t, isTh ? 'มื้ออาหาร' : 'Meal', isTh)}</span>
          <span className="v2-row-val">{meal.calories} <small className="v2-unit">kcal</small></span>
        </span>
        <span className="v2-row-sub">
          {showDate ? fmtDate(meal.timestamp, isTh) : fmtTime(meal.timestamp, isTh)}
          {' · '}P {meal.macros?.protein ?? 0} · C {meal.macros?.carbs ?? 0} · F {meal.macros?.fat ?? 0} g
        </span>
      </span>
    </button>
  );

  const filterChips = (
    <div className="v2-chips">
      {(['today', 'week', 'month'] as HistoryFilter[]).map((f) => (
        <Chip key={f} on={historyFilter === f} onClick={() => setHistoryFilter(f)}>
          {f === 'today' ? (isTh ? 'วันนี้' : 'Today') : f === 'week' ? (isTh ? 'สัปดาห์นี้' : 'This week') : (isTh ? 'เดือนนี้' : 'This month')}
        </Chip>
      ))}
    </div>
  );

  const filterMeals = () => {
    const now = new Date();
    return meals.map((m, i) => ({ meal: m, globalIdx: i })).filter(({ meal }) => {
      const d = new Date(meal.timestamp);
      if (historyFilter === 'today') return d.toDateString() === now.toDateString();
      if (historyFilter === 'week') { const w = new Date(); w.setDate(now.getDate() - 7); return d >= w; }
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).sort((a, b) => new Date(b.meal.timestamp).getTime() - new Date(a.meal.timestamp).getTime());
  };

  // ══════════════════════════════════════════════
  // SUB-VIEW: Macros & Calories
  // ══════════════════════════════════════════════
  const renderMacros = () => {
    const rows = [
      { key: 'cal', label: isTh ? 'พลังงาน' : 'Calories', val: totalCals, target: targets.calories, unit: 'kcal', pillar: 'act' as Pillar },
      { key: 'protein', label: isTh ? 'โปรตีน' : 'Protein', val: macros.protein, target: targets.protein, unit: 'g', pillar: 'sleep' as Pillar },
      { key: 'carbs', label: isTh ? 'คาร์บ' : 'Carbs', val: macros.carbs, target: targets.carbs, unit: 'g', pillar: 'food' as Pillar },
      { key: 'fat', label: isTh ? 'ไขมัน' : 'Fat', val: macros.fat, target: targets.fat, unit: 'g', pillar: 'mind' as Pillar },
      { key: 'sugar', label: isTh ? 'น้ำตาล' : 'Sugar', val: macros.sugar, target: targets.sugar, unit: 'g', pillar: 'act' as Pillar },
      { key: 'fiber', label: isTh ? 'ใยอาหาร' : 'Fiber', val: macros.fiber, target: targets.fiber, unit: 'g', pillar: 'food' as Pillar },
      { key: 'sodium', label: isTh ? 'โซเดียม' : 'Sodium', val: macros.sodium, target: targets.sodium, unit: 'mg', pillar: 'water' as Pillar },
    ];
    return (
      <>
        <section className="v2-card">
          <div className="v2-row-top">
            <span className="v2-row-sub">{isTh ? 'คะแนนโภชนาการวันนี้' : 'Nutrition score today'}</span>
          </div>
          <div className="v2-bignum v2-tnum">{nutritionScoreData.score}<small className="v2-unit" style={{ fontSize: 18 }}> /100</small></div>
          <ul className="v2-list" style={{ marginTop: 6 }}>
            {nutritionScoreData.insights.map((ins, i) => (
              <li key={i} className={ins.type === 'good' ? 'ok' : ins.type === 'warn' ? 'warn' : ''}>
                {ins.type === 'good' ? <Check size={18} {...ICON_PROPS} /> : ins.type === 'warn' ? <Target size={18} {...ICON_PROPS} /> : <Info size={18} {...ICON_PROPS} />}
                <span>{ins.text.replace('✓ ', '')}</span>
              </li>
            ))}
          </ul>
        </section>
        <Group>
          {rows.map((r) => (
            <Row key={r.key} title={r.label} value={<>{r.val}<small className="v2-unit"> / {r.target} {r.unit}</small></>}>
              <ProgressBar value={(r.val / r.target) * 100} pillar={r.pillar} label={r.label} />
            </Row>
          ))}
        </Group>
      </>
    );
  };

  // ══════════════════════════════════════════════
  // SUB-VIEW: Food History
  // ══════════════════════════════════════════════
  const renderHistory = () => {
    const list = filterMeals();
    return (
      <>
        {filterChips}
        {list.length === 0 ? (
          <div className="v2-empty">
            <IconChip pillar="food" size="lg"><Utensils size={24} {...ICON_PROPS} /></IconChip>
            <p className="v2-muted">{isTh ? 'ยังไม่มีรายการอาหารในช่วงเวลานี้' : 'No meals recorded in this period.'}</p>
            <button type="button" className="v2-btn v2-btn--primary v2-btn--sm" onClick={() => onOpenFoodRecognition && onOpenFoodRecognition()}>
              <Camera size={18} {...ICON_PROPS} /> {isTh ? 'สแกนอาหาร' : 'Scan food'}
            </button>
          </div>
        ) : (
          <Group>{list.map(({ meal, globalIdx }) => mealRow(meal, globalIdx, historyFilter !== 'today'))}</Group>
        )}
      </>
    );
  };

  // ══════════════════════════════════════════════
  // SUB-VIEW: Water Tracker
  // ══════════════════════════════════════════════
  const renderWater = () => (
    <>
      <section className="v2-card">
        <div className="v2-bignum v2-tnum">{water.glasses * 250}<small className="v2-unit" style={{ fontSize: 18 }}> / {water.target * 250} {isTh ? 'มล.' : 'ml'}</small></div>
        <ProgressBar value={waterPct} pillar="water" label={isTh ? 'น้ำดื่ม' : 'Hydration'} />
        <p className="v2-muted">{water.glasses} / {water.target} {isTh ? 'แก้ว' : 'glasses'} · {Math.round(waterPct)}%</p>
      </section>
      <div className="v2-chips" role="group" aria-label={isTh ? 'จำนวนแก้ว' : 'Glasses'}>
        {Array.from({ length: water.target }).map((_, i) => (
          <button key={i} type="button" className={`v2-glass ${i < water.glasses ? 'is-on' : ''}`}
            onClick={() => updateWater(i + 1)} aria-label={`${(i + 1) * 250} ml`} aria-pressed={i < water.glasses}>
            <Droplet size={20} {...ICON_PROPS} />
          </button>
        ))}
      </div>
      <div className="v2-btn-row">
        <button type="button" className="v2-btn v2-btn--ghost" onClick={() => updateWater(water.glasses - 1)} disabled={water.glasses <= 0} aria-label={t('eating.a11yRemoveGlass')}>
          <Minus size={20} {...ICON_PROPS} />
        </button>
        <button type="button" className="v2-btn v2-btn--primary" style={{ flex: 3 }} onClick={() => updateWater(water.glasses + 1)}>
          <Plus size={20} {...ICON_PROPS} /> {isTh ? '1 แก้ว (250 มล.)' : '1 glass (250 ml)'}
        </button>
      </div>
    </>
  );

  // ══════════════════════════════════════════════
  // SUB-VIEW: IF Schedule
  // ══════════════════════════════════════════════
  const renderSchedule = () => {
    const remH = Math.floor(fastRem / 3600);
    const remM = Math.floor((fastRem % 3600) / 60);
    return (
      <>
        <div className="v2-chips">
          {SCHEDULES.map(({ id }) => (
            <Chip key={id} on={selectedSched === id} disabled={isRunning} onClick={() => { if (!isRunning) setSelectedSched(id); }}>{id}</Chip>
          ))}
          <Chip on={selectedSched === 'custom'} disabled={isRunning} onClick={() => { if (!isRunning) setSelectedSched('custom'); }}>{isTh ? 'กำหนดเอง' : 'Custom'}</Chip>
        </div>

        {selectedSched === 'custom' && !isRunning && (
          <div className="v2-field">
            <label className="v2-label" htmlFor="custom-fast">{isTh ? 'ชั่วโมงอดอาหาร' : 'Fasting hours'}</label>
            <input id="custom-fast" className="v2-input" type="number" min={MIN_FAST_HOURS} max={MAX_FAST_HOURS} step={1} value={customHrs}
              onChange={e => setCustomHrs(clampFastHours(Number(e.target.value)))} />
          </div>
        )}

        <section className="v2-card v2-fast">
          <div className="v2-ring v2-ring--lg">
            <ScoreArc value={fastPct} size={176} stroke={12} />
            <div className="v2-ring-center">
              {isRunning ? (
                <>
                  <span className="v2-caps">{isTh ? 'กำลังอดอาหาร' : 'Fasting'}</span>
                  <span className="v2-ring-num v2-tnum" style={{ fontSize: 30 }}>{fmtHMS(elapsedSec)}</span>
                  <span className="v2-ring-of">{isTh ? `เหลือ ${remH} ชม. ${remM} นาที` : `${remH}h ${remM}m left`}</span>
                </>
              ) : (
                <>
                  <span className="v2-caps">{isTh ? 'ช่วงกิน' : 'Eating'} {24 - (Number.isFinite(selectedFastHours) ? selectedFastHours : 0)} {isTh ? 'ชม.' : 'h'}</span>
                  <span className="v2-ring-num" style={{ fontSize: 34 }}>{selectedSched === 'custom' ? `${customHrs}h` : selectedSched}</span>
                  <span className="v2-ring-of">{isTh ? `เป้าหมาย ${Number.isFinite(selectedFastHours) ? selectedFastHours : 0} ชม.` : `Fast ${Number.isFinite(selectedFastHours) ? selectedFastHours : 0}h`}</span>
                </>
              )}
            </div>
          </div>
        </section>

        {!isRunning
          ? <button type="button" className="v2-btn v2-btn--primary" onClick={startFasting} disabled={!canStartFasting}><Play size={18} {...ICON_PROPS} /> {isTh ? 'เริ่มอดอาหาร' : 'Start fasting'}</button>
          : <button type="button" className="v2-btn v2-btn--ghost" onClick={stopFasting}><Square size={18} {...ICON_PROPS} /> {isTh ? 'หยุดและบันทึก' : 'Stop & save'}</button>}

        {fastHistory.length > 0 && (
          <>
            <h2 className="v2-h2">{isTh ? 'ประวัติการอดอาหาร' : 'Fasting history'}</h2>
            <Group>
              {fastHistory.map((s, i) => {
                const completed = s.actualHours >= s.targetHours;
                return (
                  <Row key={i} title={fmtDate(s.endTime, isTh)} value={`${s.actualHours} / ${s.targetHours} ${isTh ? 'ชม.' : 'h'}`}
                    sub={completed ? (isTh ? 'สำเร็จ' : 'Completed') : (isTh ? 'บางส่วน' : 'Partial')}
                    icon={completed ? <Check size={22} {...ICON_PROPS} /> : <Timer size={22} {...ICON_PROPS} />} pillar={completed ? 'water' : 'act'} />
                );
              })}
            </Group>
          </>
        )}
      </>
    );
  };

  // ══════════════════════════════════════════════
  // DAILY LOG (ui_ref2 "บันทึกวันนี้")
  // ══════════════════════════════════════════════
  const renderDashboard = () => {
    const summary = getTodaySummary();
    const sleepParts = summary.sleepHours !== null ? splitHours(summary.sleepHours) : null;
    const moodLabel = summary.mood ? t(`mental.mood${summary.mood[0].toUpperCase()}${summary.mood.slice(1)}`) : null;
    const none = t('v2.noRecordYet');
    const mealNames = todayMeals.slice(0, 2).map(({ meal }) => mealDisplayName(meal, t, isTh ? 'มื้ออาหาร' : 'Meal', isTh)).join(', ');
    const fastTarget = isRunning ? fastHours : (Number.isFinite(selectedFastHours) ? selectedFastHours : 16);
    const fastProto = selectedSched === 'custom' ? `${customHrs}:${24 - customHrs}` : selectedSched;

    return (
      <>
        <ScanCard onOpen={() => onOpenFoodRecognition && onOpenFoodRecognition()} />

        <h2 className="v2-h2">{isTh ? 'หมวดบันทึก' : 'Log categories'}</h2>
        <Group>
          <Row pillar="food" icon={<Utensils size={22} {...ICON_PROPS} />} title={isTh ? 'มื้ออาหาร' : 'Meals'} chevron
            sub={summary.meals > 0 ? `${mealNames} · ~${summary.calories.toLocaleString()} kcal` : none}
            onClick={() => onNavigate('eating-history')} />
          <Row pillar="act" icon={<Activity size={22} {...ICON_PROPS} />} title={isTh ? 'กิจกรรม' : 'Activity'} chevron
            sub={summary.activeMinutes > 0 ? `${summary.activeMinutes} ${isTh ? 'นาที' : 'min'} · ~${summary.caloriesOut} kcal` : none}
            onClick={() => onNavigate('activity')} />
          <Row pillar="sleep" icon={<Moon size={22} {...ICON_PROPS} />} title={isTh ? 'การนอน' : 'Sleep'} chevron
            sub={sleepParts ? `${sleepParts.h} ${isTh ? 'ชม.' : 'h'} ${sleepParts.m} ${isTh ? 'นาที' : 'min'}` : none}
            onClick={() => onNavigate('sleep')} />
          <Row pillar="mind" icon={<Smile size={22} {...ICON_PROPS} />} title={isTh ? 'จิตใจ' : 'Mind'} chevron
            sub={moodLabel ? `${moodLabel}${summary.stress !== null ? ` · ${isTh ? 'ความเครียด' : 'stress'} ${summary.stress}/10` : ''}` : none}
            onClick={() => onNavigate('mental-health')} />
          <Row pillar="water" icon={<Droplet size={22} {...ICON_PROPS} />} title={isTh ? 'น้ำดื่ม' : 'Water'}
            sub={`${(water.glasses * 250).toLocaleString()} / ${(water.target * 250).toLocaleString()} ${isTh ? 'มล.' : 'ml'}`}
            onClick={() => onNavigate('eating-water')}
            end={
              <span className="v2-stepper" onClick={(e) => e.stopPropagation()}>
                <button type="button" className="v2-step-btn" onClick={() => updateWater(water.glasses - 1)} disabled={water.glasses <= 0} aria-label={t('eating.a11yRemoveGlass')}><Minus size={20} {...ICON_PROPS} /></button>
                <button type="button" className="v2-step-btn v2-step-btn--primary" onClick={() => updateWater(water.glasses + 1)} aria-label={isTh ? 'เพิ่ม 1 แก้ว' : 'Add 1 glass'}><Plus size={20} {...ICON_PROPS} /></button>
              </span>
            } />
          <Row pillar="water" icon={<Timer size={22} {...ICON_PROPS} />}
            title={`${isTh ? 'การอดอาหาร' : 'Fasting'} ${fastProto}`}
            value={isRunning ? <span className="v2-time-accent">{fmtHMS(elapsedSec).slice(0, 5)}</span> : undefined}
            onClick={() => onNavigate('eating-schedule')}
            chevron={!isRunning}>
            {isRunning && <ProgressBar value={fastPct} pillar="water" label={isTh ? 'ความคืบหน้าการอดอาหาร' : 'Fasting progress'} />}
            <span className="v2-row-sub">
              {isRunning
                ? (isTh ? `เหลืออีก ${Math.floor(fastRem / 3600)} ชม. ${Math.floor((fastRem % 3600) / 60)} นาที จะครบช่วงอด` : `${Math.floor(fastRem / 3600)}h ${Math.floor((fastRem % 3600) / 60)}m until your fast completes`)
                : (isTh ? `แตะเพื่อเริ่มจับเวลา · เป้าหมาย ${fastTarget} ชม.` : `Tap to start · goal ${fastTarget}h`)}
            </span>
          </Row>
        </Group>
      </>
    );
  };

  const renderContent = () => {
    switch (subView) {
      case 'macros': return renderMacros();
      case 'water': return renderWater();
      case 'schedule': return renderSchedule();
      case 'history': return renderHistory();
      default: return renderDashboard();
    }
  };

  const dateLabel = new Date().toLocaleDateString(isTh ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="v2-page">
      {subView === 'dashboard' ? (
        <TopBar title={isTh ? 'บันทึกวันนี้' : 'Today’s log'} subtitle={dateLabel} onNavigate={onNavigate} />
      ) : (
        <PageHeader title={TITLES[subView]} onBack={handleBack} backLabel={t('common.back')} />
      )}
      {renderContent()}

      {/* Global Meal Modals for Dashboard and History */}
      {selectedMeal && !editingMeal && (
        <MealDetailModal
          meal={selectedMeal.meal}
          globalIdx={selectedMeal.globalIdx}
          isTh={isTh}
          onClose={() => setSelectedMeal(null)}
          onDelete={deleteMeal}
          onEdit={() => setEditingMeal({ ...selectedMeal.meal })}
        />
      )}
      {editingMeal && selectedMeal && (
        <MealEditModal
          meal={editingMeal}
          isTh={isTh}
          recalcCalories={recalcCalories}
          onClose={() => { setEditingMeal(null); setSelectedMeal(null); }}
          onSave={(updated: MealLog) => saveMealEdit(updated, selectedMeal.globalIdx)}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════

const MealDetailModal: React.FC<any> = ({ meal, globalIdx, isTh, onClose, onDelete, onEdit }) => {
  const { t } = useLanguage();
  // Two-step delete: first tap arms, second tap (within 3 s) deletes.
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteFailed, setDeleteFailed] = useState(false);
  const armTimer = useRef<number | null>(null);
  useEffect(() => () => { if (armTimer.current) window.clearTimeout(armTimer.current); }, []);

  const handleDeleteTap = () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      setDeleteFailed(false);
      armTimer.current = window.setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (armTimer.current) window.clearTimeout(armTimer.current);
    setConfirmDelete(false);
    const ok: boolean = onDelete(globalIdx);
    if (ok === false) setDeleteFailed(true);
  };

  const rows = [
    { label: isTh ? 'แคลอรี่' : 'Calories', val: `${meal.calories} kcal` },
    { label: isTh ? 'โปรตีน' : 'Protein', val: `${meal.macros?.protein ?? 0} g` },
    { label: isTh ? 'คาร์บ' : 'Carbs', val: `${meal.macros?.carbs ?? 0} g` },
    { label: isTh ? 'ไขมัน' : 'Fat', val: `${meal.macros?.fat ?? 0} g` },
    { label: isTh ? 'น้ำตาล' : 'Sugar', val: `${meal.macros?.sugar ?? 0} g` },
    { label: isTh ? 'ใยอาหาร' : 'Fiber', val: `${meal.macros?.fiber ?? 0} g` },
    { label: isTh ? 'โซเดียม' : 'Sodium', val: `${meal.macros?.sodium ?? 0} mg` },
  ];
  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal" onClick={e => e.stopPropagation()}>
        <div className="ev-modal-header">
          <button className="ev-modal-close" onClick={onClose} aria-label={t('common.close')}><FaXmark /></button>
          <h2>{mealDisplayName(meal, t, isTh ? 'มื้ออาหาร' : 'Meal', isTh)}</h2>
          <span className="ev-meal-time-badge">{fmtTime(meal.timestamp, isTh)}</span>
        </div>
        {meal.imageUrl && <img src={meal.imageUrl} alt={meal.foodName} className="ev-modal-img" />}
        <div className="ev-modal-rows">
          {rows.map(r => (
            <div key={r.label} className="ev-modal-row">
              <span>{r.label}</span><strong>{r.val}</strong>
            </div>
          ))}
        </div>
        {deleteFailed && (
          <p role="alert" style={{ color: 'var(--color-danger-text)', fontSize: '0.85rem', margin: '0 0 8px', textAlign: 'center' }}>
            {t('eating.deleteFailed')}
          </p>
        )}
        <div className="ev-modal-actions">
          <button className="ev-modal-btn edit" onClick={onEdit}><FaPencil /> {isTh ? 'แก้ไข' : 'Edit'}</button>
          <button className="ev-modal-btn del" onClick={handleDeleteTap} aria-live="polite">
            <FaTrash /> {confirmDelete ? t('eating.tapAgainDelete') : (isTh ? 'ลบ' : 'Delete')}
          </button>
        </div>
      </div>
    </div>
  );
};

// MealEditModal (Reused)
const MealEditModal: React.FC<any> = ({ meal, isTh, recalcCalories, onClose, onSave }) => {
  const { t } = useLanguage();
  // What the user currently sees as the name (foodKey / AI names take priority
  // over foodName in mealDisplayName) — so the field starts with the real name.
  const currentDisplayName = mealDisplayName(meal, t, meal.foodName || '', isTh);
  const [form, setForm] = useState({
    foodName: currentDisplayName, calories: meal.calories,
    protein: meal.macros?.protein ?? 0, carbs: meal.macros?.carbs ?? 0, fat: meal.macros?.fat ?? 0,
    sugar: meal.macros?.sugar ?? 0, fiber: meal.macros?.fiber ?? 0, sodium: meal.macros?.sodium ?? 0,
  });

  const handleMacroChange = (field: 'protein' | 'carbs' | 'fat', val: number) => {
    const next = { ...form, [field]: val };
    next.calories = recalcCalories({ protein: next.protein, carbs: next.carbs, fat: next.fat });
    setForm(next);
  };

  const handleSave = () => {
    const nextName = form.foodName.trim();
    const renamed = nextName !== '' && nextName !== currentDisplayName;
    // A custom name must win: drop the language-keyed fields that
    // mealDisplayName() would otherwise prefer over `foodName`.
    const base: MealLog = renamed
      ? (({ foodKey: _k, foodNameEn: _en, foodNameTh: _th, ...rest }) => rest)(meal as MealLog)
      : meal;
    onSave({
      ...base, foodName: renamed ? nextName : (meal.foodName ?? currentDisplayName), calories: form.calories,
      macros: { protein: form.protein, carbs: form.carbs, fat: form.fat, sugar: form.sugar, fiber: form.fiber, sodium: form.sodium },
    });
  };

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal--edit" onClick={e => e.stopPropagation()}>
        <div className="ev-modal-header">
          <button className="ev-modal-close" onClick={onClose} aria-label={t('common.close')}><FaXmark /></button>
          <h2>{isTh ? 'แก้ไขข้อมูล' : 'Edit'}</h2>
        </div>
        <div className="ev-edit-form">
          <label className="ev-edit-label">{isTh ? 'ชื่ออาหาร' : 'Name'}</label>
          <input className="ev-edit-input" value={form.foodName} onChange={e => setForm(f => ({ ...f, foodName: e.target.value }))} />

          <div className="ev-edit-cal-display">
            <span>{isTh ? 'แคลอรี่รวม' : 'Total Calories'}</span>
            <strong>{form.calories} kcal</strong>
          </div>

          {['protein', 'carbs', 'fat'].map((k) => (
            <div key={k} className="ev-edit-row">
              <label className="ev-edit-label">
                {k === 'protein' ? (isTh ? 'โปรตีน' : 'Protein') : k === 'carbs' ? (isTh ? 'คาร์โบไฮเดรต' : 'Carbs') : (isTh ? 'ไขมัน' : 'Fat')} (g)
              </label>
              <input type="number" min={0} className="ev-edit-input" value={(form as any)[k]} onChange={e => handleMacroChange(k as any, Number(e.target.value))} />
            </div>
          ))}
        </div>
        <div className="ev-modal-actions">
          <button className="ev-modal-btn cancel" onClick={onClose}><FaRotateLeft /> {isTh ? 'ยกเลิก' : 'Cancel'}</button>
          <button className="ev-modal-btn save" onClick={handleSave}><FaCheck /> {isTh ? 'บันทึก' : 'Save'}</button>
        </div>
      </div>
    </div>
  );
};
