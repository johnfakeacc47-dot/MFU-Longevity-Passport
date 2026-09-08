import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeGetItem } from '../utils/safeStorage';
import type { MealLog, Macros } from '../utils/longevityScore';
import { getTodayWater, saveTodayWater } from '../utils/healthCoach';
import { mealDisplayName } from '../utils/foodNames';
import {
  FaUtensils, FaChartPie,
  FaClock, FaChevronRight, FaCamera, FaDroplet,
  FaTrash, FaPencil, FaCheck, FaXmark, FaRotateLeft, FaLeaf,
  FaFire, FaPlay, FaStop, FaBowlFood
} from 'react-icons/fa6';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import '../styles/components/eating.css';

// ─── Types ────────────────────────────────────────────────────────────────────
type PageType =
  | 'login' | 'home' | 'eating' | 'eating-food-log' | 'eating-macros'
  | 'eating-water' | 'eating-schedule' | 'eating-history' | 'dashboard'
  | 'team' | 'profile' | 'edit-profile' | 'activity' | 'sleep'
  | 'mental-health' | 'user-management' | 'privacy-settings'
  | 'set-goals' | 'about-tracker' | 'settings';

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

const fmtTime = (ts: string) =>
  new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const fmtDate = (ts: string) =>
  new Date(ts).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });

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
      const hrs = Number(localStorage.getItem('fastingTargetHours') || '16');
      if (st) {
        const start = new Date(st);
        const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
        if (elapsed < hrs * 3600) {
          setStartTime(start); setFastHours(hrs); setElapsedSec(elapsed); setIsRunning(true);
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
  const calPct = Math.min((totalCals / targets.calories) * 100, 100);
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
      insights.push({ text: isTh ? '⚠ แคลอรี่สูงกว่าเป้าหมาย' : '⚠ Calories above target', type: 'warn' });
    } else if (totalCals >= targets.calories * 0.7) {
      insights.push({ text: isTh ? '✓ แคลอรี่เหมาะสม' : '✓ Appropriate calories', type: 'good' });
    }

    if (macros.protein >= targets.protein * 0.8) {
      insights.push({ text: isTh ? '✓ โปรตีนเพียงพอ' : '✓ Sufficient protein', type: 'good' });
    } else {
      score -= 10;
      insights.push({ text: isTh ? '⚠ ควรเพิ่มโปรตีน' : '⚠ Need more protein', type: 'warn' });
    }

    if (macros.sugar > targets.sugar) {
      score -= 15;
      insights.push({ text: isTh ? '⚠ น้ำตาลสูงเกินไป' : '⚠ Sugar is too high', type: 'warn' });
    }

    if (macros.fiber >= targets.fiber * 0.8) {
      insights.push({ text: isTh ? '✓ ใยอาหารดีเยี่ยม' : '✓ Excellent fiber', type: 'good' });
    }

    return { score: Math.max(0, score), insights };
  }, [totalCals, macros, targets, isTh]);

  // ── Meal CRUD ────────────────────────────────────────────────────────────────
  const deleteMeal = (globalIdx: number) => {
    const all = [...meals];
    all.splice(globalIdx, 1);
    localStorage.setItem('meals', JSON.stringify(all));
    setMeals(all);
    window.dispatchEvent(new Event('healthDataUpdated'));
    setSelectedMeal(null);
  };

  const saveMealEdit = (updated: MealLog, globalIdx: number) => {
    const all = [...meals];
    all[globalIdx] = updated;
    localStorage.setItem('meals', JSON.stringify(all));
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
  const startFasting = () => {
    const now = new Date();
    const hrs = selectedSched === 'custom' ? customHrs : Number(selectedSched.split(':')[0]);
    setFastHours(hrs); setStartTime(now); setElapsedSec(0); setIsRunning(true);
    localStorage.setItem('fastingActive', 'true');
    localStorage.setItem('fastingStartTime', now.toISOString());
    localStorage.setItem('fastingTargetHours', String(hrs));
    window.dispatchEvent(new Event('healthDataUpdated'));
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
  };

  const handleBack = () => {
    if (subView !== 'dashboard') onNavigate('eating');
    else onNavigate('home');
  };

  const TITLES: Record<SubView, string> = {
    dashboard: isTh ? 'การกิน' : 'Nutrition',
    'food-log': isTh ? 'บันทึกอาหาร' : 'Food Log',
    macros: isTh ? 'สารอาหารประจำวัน' : 'Daily Nutrition',
    water: isTh ? 'น้ำดื่ม' : 'Hydration',
    schedule: isTh ? 'รูปแบบการกิน' : 'Eating Schedule',
    history: isTh ? 'ประวัติอาหาร' : 'Food History',
  };

  // ══════════════════════════════════════════════
  // SUB-VIEW: Macros & Calories (Premium Dashboard)
  // ══════════════════════════════════════════════
  const renderMacros = () => {
    const macroTotal = macros.protein + macros.carbs + macros.fat;
    const pPct = macroTotal > 0 ? (macros.protein / macroTotal) * 100 : 0;
    const cPct = macroTotal > 0 ? (macros.carbs / macroTotal) * 100 : 0;
    const fPct = macroTotal > 0 ? (macros.fat / macroTotal) * 100 : 0;

    const macroItems = [
      { key: 'protein', label: isTh ? 'Protein' : 'Protein', val: macros.protein, target: targets.protein, unit: 'g', color: '#3B82F6' },
      { key: 'carbs', label: isTh ? 'Carbs' : 'Carbs', val: macros.carbs, target: targets.carbs, unit: 'g', color: '#F59E0B' },
      { key: 'fat', label: isTh ? 'Fat' : 'Fat', val: macros.fat, target: targets.fat, unit: 'g', color: '#EF4444' },
    ];

    const microItems = [
      { key: 'sugar', label: isTh ? 'น้ำตาล' : 'Sugar', val: macros.sugar, target: targets.sugar, unit: 'g', color: '#EC4899' },
      { key: 'fiber', label: isTh ? 'ใยอาหาร' : 'Fiber', val: macros.fiber, target: targets.fiber, unit: 'g', color: '#10B981' },
      { key: 'sodium', label: isTh ? 'โซเดียม' : 'Sodium', val: macros.sodium, target: targets.sodium, unit: 'mg', color: '#8B5CF6' },
    ];

    return (
      <div className="ev-subview">
        {/* Nutrition Score */}
        <div className="ev-premium-card ev-score-card">
          <div className="ev-score-header">
            <h3>{isTh ? 'คะแนนโภชนาการ' : 'Nutrition Score'}</h3>
            <div className="ev-score-circle">
              <svg width="80" height="80" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" fill="none" stroke="var(--bg-primary)" strokeWidth="8" />
                <circle cx="40" cy="40" r="34" fill="none" stroke={nutritionScoreData.score >= 80 ? 'var(--color-success)' : nutritionScoreData.score >= 50 ? 'var(--color-warning)' : 'var(--color-danger)'} strokeWidth="8" strokeDasharray="213" strokeDashoffset={213 - (213 * nutritionScoreData.score) / 100} strokeLinecap="round" transform="rotate(-90 40 40)" style={{ transition: 'stroke-dashoffset 1s ease' }} />
              </svg>
              <span className="ev-score-text">{nutritionScoreData.score}</span>
            </div>
          </div>
          <div className="ev-insights">
            {nutritionScoreData.insights.map((ins, i) => (
              <div key={i} className={`ev-insight-item ${ins.type}`}>{ins.text}</div>
            ))}
          </div>
        </div>

        {/* Calories Progress */}
        <div className="ev-premium-card">
          <div className="ev-card-header">
            <h3>{isTh ? 'แคลอรี่' : 'Calories'}</h3>
            <span className="ev-card-target">{totalCals} / {targets.calories} kcal</span>
          </div>
          <div className="ev-progress-bar-wrap">
            <div className="ev-progress-fill" style={{ width: `${calPct}%`, background: '#F59E0B' }} />
          </div>
        </div>

        {/* Macro Balance & Progress */}
        <div className="ev-premium-card">
          <h3>{isTh ? 'สัดส่วนสารอาหารหลัก' : 'Macro Balance'}</h3>

          <div className="ev-macro-stacked-bar">
            {macroTotal > 0 ? (
              <>
                <div style={{ width: `${pPct}%`, background: '#3B82F6' }} title="Protein" />
                <div style={{ width: `${cPct}%`, background: '#F59E0B' }} title="Carbs" />
                <div style={{ width: `${fPct}%`, background: '#EF4444' }} title="Fat" />
              </>
            ) : (
              <div style={{ width: '100%', background: 'var(--bg-primary)' }} />
            )}
          </div>

          <div className="ev-macro-list">
            {macroItems.map(({ key, label, val, target, unit, color }) => (
              <div key={key} className="ev-macro-item">
                <div className="ev-macro-item-header">
                  <span className="ev-macro-dot" style={{ background: color }} />
                  <span className="ev-macro-label">{label}</span>
                  <span className="ev-macro-val">{val}{unit} <span className="ev-macro-target">/ {target}{unit}</span></span>
                </div>
                <div className="ev-progress-bar-wrap small">
                  <div className="ev-progress-fill" style={{ width: `${Math.min((val / target) * 100, 100)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Micro Nutrients */}
        <div className="ev-premium-card">
          <h3>{isTh ? 'สารอาหารอื่นๆ' : 'Other Nutrients'}</h3>
          <div className="ev-macro-list">
            {microItems.map(({ key, label, val, target, unit, color }) => (
              <div key={key} className="ev-macro-item">
                <div className="ev-macro-item-header">
                  <span className="ev-macro-label">{label}</span>
                  <span className="ev-macro-val">{val}{unit} <span className="ev-macro-target">/ {target}{unit}</span></span>
                </div>
                <div className="ev-progress-bar-wrap small">
                  <div className="ev-progress-fill" style={{ width: `${Math.min((val / target) * 100, 100)}%`, background: color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    );
  };

  // ══════════════════════════════════════════════
  // SUB-VIEW: Food History (Detailed & Filtered)
  // ══════════════════════════════════════════════
  const renderHistory = () => {
    const now = new Date();

    const filteredMeals = meals.map((m, i) => ({ meal: m, globalIdx: i })).filter(({ meal }) => {
      const mealDate = new Date(meal.timestamp);
      if (historyFilter === 'today') {
        return mealDate.toDateString() === now.toDateString();
      } else if (historyFilter === 'week') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return mealDate >= weekAgo;
      } else {
        return mealDate.getMonth() === now.getMonth() && mealDate.getFullYear() === now.getFullYear();
      }
    }).sort((a, b) => new Date(b.meal.timestamp).getTime() - new Date(a.meal.timestamp).getTime());

    return (
      <div className="ev-subview">
        <div className="ev-filter-tabs">
          <button className={`ev-filter-tab ${historyFilter === 'today' ? 'active' : ''}`} onClick={() => setHistoryFilter('today')}>
            {isTh ? 'วันนี้' : 'Today'}
          </button>
          <button className={`ev-filter-tab ${historyFilter === 'week' ? 'active' : ''}`} onClick={() => setHistoryFilter('week')}>
            {isTh ? 'สัปดาห์นี้' : 'This Week'}
          </button>
          <button className={`ev-filter-tab ${historyFilter === 'month' ? 'active' : ''}`} onClick={() => setHistoryFilter('month')}>
            {isTh ? 'เดือนนี้' : 'This Month'}
          </button>
        </div>

        {filteredMeals.length === 0 ? (
          <div className="ev-empty">
            <FaUtensils style={{ fontSize: '2rem', marginBottom: 10, color: 'var(--text-secondary)', opacity: 0.5 }} />
            <br />
            {isTh ? 'ยังไม่มีรายการอาหารในช่วงเวลานี้' : 'No meals recorded in this period.'}
          </div>
        ) : (
          <div className="ev-history-list">
            {filteredMeals.map(({ meal, globalIdx }) => (
              <div key={globalIdx} className="ev-hist-card" onClick={() => setSelectedMeal({ meal, globalIdx })}>
                {meal.imageUrl ? (
                  <img src={meal.imageUrl} alt={meal.foodName} className="ev-hist-img" />
                ) : (
                  <div className="ev-hist-img placeholder"><FaUtensils /></div>
                )}
                <div className="ev-hist-body">
                  <div className="ev-hist-header">
                    <h4>{mealDisplayName(meal, t, isTh ? 'มื้ออาหาร' : 'Meal')}</h4>
                    <span className="ev-hist-time">{historyFilter === 'today' ? fmtTime(meal.timestamp) : fmtDate(meal.timestamp)}</span>
                  </div>
                  <div className="ev-hist-cals">{meal.calories} kcal</div>
                  <div className="ev-hist-macros-text">
                    <span style={{ color: 'var(--color-info-text)' }}>P: {meal.macros?.protein ?? 0}g</span>
                    <span style={{ color: 'var(--color-warning-text)' }}>C: {meal.macros?.carbs ?? 0}g</span>
                    <span style={{ color: 'var(--color-danger-text)' }}>F: {meal.macros?.fat ?? 0}g</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

      </div>
    );
  };

  // ══════════════════════════════════════════════
  // SUB-VIEW: Water Tracker
  // ══════════════════════════════════════════════
  const renderWater = () => (
    <div className="ev-subview ev-water-full">
      <div className="ev-water-hero">
        <span className="ev-water-count">{water.glasses}</span>
        <span className="ev-water-unit">/ {water.target} {isTh ? 'แก้ว' : 'glasses'}</span>
        <span className="ev-water-ml">{water.glasses * 250} ml / {water.target * 250} ml</span>
      </div>

      <div className="ev-water-bar-wrap">
        <div className="ev-water-bar" style={{ width: `${waterPct}%` }} />
        <span className="ev-water-pct">{Math.round(waterPct)}%</span>
      </div>

      <div className="ev-water-dots">
        {Array.from({ length: water.target }).map((_, i) => (
          <button key={i}
            className={`ev-water-dot ${i < water.glasses ? 'filled' : ''}`}
            onClick={() => updateWater(i + 1)}
            title={`${(i + 1) * 250} ml`}
          >💧</button>
        ))}
      </div>

      <div className="ev-water-controls">
        <button className="ev-water-btn minus" onClick={() => updateWater(water.glasses - 1)} disabled={water.glasses <= 0}>−</button>
        <button className="ev-water-btn plus" onClick={() => updateWater(water.glasses + 1)}>
          + {isTh ? '1 แก้ว (250ml)' : '1 glass (250ml)'}
        </button>
      </div>
    </div>
  );

  // ══════════════════════════════════════════════
  // SUB-VIEW: IF Schedule
  // ══════════════════════════════════════════════
  const SCHEDULES = ['12:12', '14:10', '16:8', '18:6', '20:4', 'OMAD'];
  const renderSchedule = () => (
    <div className="ev-subview">
      <div className="ev-sched-chips">
        {SCHEDULES.map(s => (
          <button key={s}
            className={`ev-chip ${selectedSched === s ? 'active' : ''}`}
            onClick={() => { if (!isRunning) setSelectedSched(s); }}
            disabled={isRunning}
          >{s}</button>
        ))}
        <button
          className={`ev-chip ${selectedSched === 'custom' ? 'active' : ''}`}
          onClick={() => { if (!isRunning) setSelectedSched('custom'); }}
          disabled={isRunning}
        >{isTh ? 'กำหนดเอง' : 'Custom'}</button>
      </div>

      {selectedSched === 'custom' && !isRunning && (
        <div className="ev-custom-input">
          <label>{isTh ? 'ชั่วโมงอดอาหาร:' : 'Fasting hours:'}</label>
          <input type="number" min={1} max={23} value={customHrs}
            onChange={e => setCustomHrs(Number(e.target.value))} />
        </div>
      )}

      <div className="ev-fast-ring-wrap">
        <FastRing
          pct={fastPct} elapsed={elapsedSec} target={fastHours}
          remaining={fastRem} isTh={isTh} running={isRunning} protocol={selectedSched}
        />
      </div>

      <div className="ev-sched-btns">
        {!isRunning
          ? <button className="ev-start-btn" onClick={startFasting}><FaPlay style={{ fontSize: '11px' }} /> {isTh ? 'เริ่มอดอาหาร' : 'Start Fasting'}</button>
          : <button className="ev-stop-btn" onClick={stopFasting}><FaStop style={{ fontSize: '11px' }} /> {isTh ? 'หยุดและบันทึก' : 'Stop & Save'}</button>
        }
      </div>

      {fastHistory.length > 0 && (
        <div className="ev-fast-history">
          <h3 className="ev-section-title">{isTh ? 'ประวัติการอดอาหาร' : 'Fasting History'}</h3>
          {fastHistory.map((s, i) => {
            const completed = s.actualHours >= s.targetHours;
            return (
              <div key={i} className={`ev-fast-hist-row ${completed ? 'completed' : 'partial'}`}>
                <div>
                  <span className="ev-fh-date">{fmtDate(s.endTime)}</span>
                  <span className={`ev-fh-badge ${completed ? 'done' : 'miss'}`}>
                    {completed ? (isTh ? 'สำเร็จ' : 'Done') : (isTh ? 'บางส่วน' : 'Partial')}
                  </span>
                </div>
                <span className="ev-fh-hrs">{s.actualHours}h / {s.targetHours}h</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  // ══════════════════════════════════════════════
  // DASHBOARD
  // ══════════════════════════════════════════════
  const renderDashboard = () => {
    const now = new Date();
    const filteredMeals = meals.map((m, i) => ({ meal: m, globalIdx: i })).filter(({ meal }) => {
      const mealDate = new Date(meal.timestamp);
      if (historyFilter === 'today') return mealDate.toDateString() === now.toDateString();
      if (historyFilter === 'week') {
        const weekAgo = new Date(); weekAgo.setDate(now.getDate() - 7);
        return mealDate >= weekAgo;
      }
      return mealDate.getMonth() === now.getMonth() && mealDate.getFullYear() === now.getFullYear();
    }).sort((a, b) => new Date(b.meal.timestamp).getTime() - new Date(a.meal.timestamp).getTime());

    return (
      <div className="ev-dashboard">
        {/* Hero Section: Nutrition Assistant Score & AI Insights */}
        <div className="ev-hero-summary ev-hero-nutrition">
          <div className="ev-hero-header">
            <div>
              <h2>{isTh ? 'ผู้ช่วยโภชนาการส่วนตัว AI' : 'AI Nutrition Assistant'}</h2>
              <span className="ev-date-badge">{new Date().toLocaleDateString(isTh ? 'th-TH' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
            </div>
            <div className="ev-hero-score-pill" onClick={() => onNavigate('eating-macros')} style={{ cursor: 'pointer' }}>
              <span className="ev-score-val">{nutritionScoreData.score}</span>
              <span className="ev-score-unit">/100 {isTh ? 'คะแนน' : 'pts'}</span>
            </div>
          </div>

          {/* AI Insights Box */}
          <div className="ev-insights-box">
            <div className="ev-insights-header">
              <FaLeaf style={{ color: 'var(--color-success)' }} />
              <strong>{isTh ? 'วิเคราะห์และคำแนะนำสารอาหารจาก AI' : 'AI Insights & Recommendations'}</strong>
            </div>
            <div className="ev-insights-list">
              {nutritionScoreData.insights.map((s, i) => (
                <span key={i} className={`ev-insight-chip ${s.type}`}>{s.text}</span>
              ))}
            </div>
            <p className="ev-ai-coach-text">
              {totalCals === 0
                ? (isTh ? 'เริ่มต้นวันใหม่ด้วยมื้ออาหารที่มีประโยชน์ ถ่ายรูปมื้อแรกของคุณเพื่อให้ AI วิเคราะห์สารอาหารได้ทันทีครับ!' : 'Start your day with a nutritious meal! Snap a photo of your first meal for instant AI analysis.')
                : macros.protein < targets.protein * 0.8
                  ? (isTh ? `มื้อถัดไปแนะนำเพิ่มโปรตีนอีกประมาณ ${Math.max(0, Math.round(targets.protein - macros.protein))}g (เช่น ไก่ ไข่ ปลา หรือเต้าหู้) เพื่อช่วยรักษามวลกล้ามเนื้อและระบบเผาผลาญ` : `Consider adding ~${Math.max(0, Math.round(targets.protein - macros.protein))}g of protein in your next meal (chicken, eggs, or fish) to support muscle health.`)
                  : (isTh ? 'โภชนาการและสารอาหารวันนี้สมดุลยอดเยี่ยม! รักษาสัดส่วนอาหารที่ดีและดื่มน้ำให้เพียงพอตลอดวันนะครับ' : 'Excellent macro balance today! Keep up this great proportion and stay well hydrated.')}
            </p>
          </div>
        </div>

        {/* Primary Action Button (+ บันทึกอาหาร) triggering FoodRecognition directly */}
        <button className="ev-action-hero-btn" onClick={() => onOpenFoodRecognition && onOpenFoodRecognition()}>
          <div className="ev-action-icon-wrap">
            <FaCamera className="ev-action-camera" />
          </div>
          <div className="ev-action-text">
            <h3>{isTh ? '+ บันทึกอาหารด้วยกล้อง AI' : '+ Log Food (AI Recognition)'}</h3>
            <p>{isTh ? `วิเคราะห์แคลอรี่และ P/C/F อัตโนมัติ • วันนี้บันทึกแล้ว ${todayMeals.length} มื้อ` : `Instant AI macro analysis • Logged today: ${todayMeals.length} meals`}</p>
          </div>
          <FaChevronRight className="ev-chevron" />
        </button>

        {/* Macro Breakdown Card (All-in-one Dashboard) */}
        <div className="ev-premium-card ev-dashboard-macros" onClick={() => onNavigate('eating-macros')} style={{ cursor: 'pointer' }}>
          <div className="ev-card-section-header">
            <div className="ev-header-title">
              <FaChartPie style={{ color: 'var(--color-warning)' }} />
              <h3>{isTh ? 'สัดส่วนสารอาหารหลัก' : 'Macronutrient Breakdown'}</h3>
            </div>
            <span className="ev-see-more">{isTh ? 'ดูรายละเอียด >' : 'View details >'}</span>
          </div>

          <div className="ev-dashboard-macro-grid">
            <div className="ev-macro-dash-item">
              <div className="ev-macro-dash-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                  <FaFire style={{ color: 'var(--color-warning)' }} /> {isTh ? 'พลังงานรวม' : 'Calories'}
                </span>
                <strong>{totalCals} <small>/ {targets.calories} kcal</small></strong>
              </div>
              <div className="ev-progress-bar-wrap">
                <div className="ev-progress-fill" style={{ width: `${calPct}%`, background: 'var(--color-warning)' }} />
              </div>
            </div>

            <div className="ev-macro-dash-item">
              <div className="ev-macro-dash-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-info)' }}>
                  <FaUtensils style={{ color: 'var(--color-info)' }} /> {isTh ? 'โปรตีน' : 'Protein'}
                </span>
                <strong>{macros.protein} <small>/ {targets.protein} g</small></strong>
              </div>
              <div className="ev-progress-bar-wrap">
                <div className="ev-progress-fill" style={{ width: `${Math.min((macros.protein / targets.protein) * 100, 100)}%`, background: 'var(--color-info)' }} />
              </div>
            </div>

            <div className="ev-macro-dash-item">
              <div className="ev-macro-dash-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-success)' }}>
                  <FaBowlFood style={{ color: 'var(--color-success)' }} /> {isTh ? 'คาร์โบไฮเดรต' : 'Carbs'}
                </span>
                <strong>{macros.carbs} <small>/ {targets.carbs} g</small></strong>
              </div>
              <div className="ev-progress-bar-wrap">
                <div className="ev-progress-fill" style={{ width: `${Math.min((macros.carbs / targets.carbs) * 100, 100)}%`, background: 'var(--color-success)' }} />
              </div>
            </div>

            <div className="ev-macro-dash-item">
              <div className="ev-macro-dash-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: 'var(--color-danger)' }}>
                  <FaDroplet style={{ color: 'var(--color-danger)' }} /> {isTh ? 'ไขมัน' : 'Fat'}
                </span>
                <strong>{macros.fat} <small>/ {targets.fat} g</small></strong>
              </div>
              <div className="ev-progress-bar-wrap">
                <div className="ev-progress-fill" style={{ width: `${Math.min((macros.fat / targets.fat) * 100, 100)}%`, background: 'var(--color-danger)' }} />
              </div>
            </div>
          </div>
        </div>

        {/* Integrated Food History right on Dashboard */}
        <div className="ev-premium-card ev-dashboard-history">
          <div className="ev-card-section-header">
            <div className="ev-header-title">
              <FaUtensils style={{ color: 'var(--color-success)' }} />
              <h3>{isTh ? 'ประวัติการกิน' : 'Food History'}</h3>
            </div>
            <span className="ev-see-more" onClick={() => onNavigate('eating-history')}>{isTh ? 'ดูทั้งหมด >' : 'View all >'}</span>
          </div>

          <div className="ev-filter-tabs compact">
            <button className={`ev-filter-tab ${historyFilter === 'today' ? 'active' : ''}`} onClick={() => setHistoryFilter('today')}>
              {isTh ? 'วันนี้' : 'Today'}
            </button>
            <button className={`ev-filter-tab ${historyFilter === 'week' ? 'active' : ''}`} onClick={() => setHistoryFilter('week')}>
              {isTh ? 'สัปดาห์นี้' : 'This Week'}
            </button>
            <button className={`ev-filter-tab ${historyFilter === 'month' ? 'active' : ''}`} onClick={() => setHistoryFilter('month')}>
              {isTh ? 'เดือนนี้' : 'This Month'}
            </button>
          </div>

          {filteredMeals.length === 0 ? (
            <div className="ev-empty compact">
              <FaUtensils style={{ fontSize: '1.5rem', marginBottom: 8, color: 'var(--text-secondary)', opacity: 0.4 }} />
              <p>{isTh ? 'ยังไม่มีรายการอาหารในช่วงเวลานี้' : 'No meals recorded right now.'}</p>
              <button className="ev-quick-log-btn" onClick={() => onOpenFoodRecognition && onOpenFoodRecognition()}>
                + {isTh ? 'ถ่ายรูปบันทึกมื้ออาหารทันที' : 'Log your meal now'}
              </button>
            </div>
          ) : (
            <div className="ev-history-list compact">
              {filteredMeals.slice(0, 6).map(({ meal, globalIdx }) => (
                <div key={globalIdx} className="ev-hist-card" onClick={() => setSelectedMeal({ meal, globalIdx })}>
                  {meal.imageUrl ? (
                    <img src={meal.imageUrl} alt={meal.foodName} className="ev-hist-img" />
                  ) : (
                    <div className="ev-hist-img placeholder"><FaUtensils /></div>
                  )}
                  <div className="ev-hist-body">
                    <div className="ev-hist-header">
                      <h4>{mealDisplayName(meal, t, isTh ? 'มื้ออาหาร' : 'Meal')}</h4>
                      <span className="ev-hist-time">{historyFilter === 'today' ? fmtTime(meal.timestamp) : fmtDate(meal.timestamp)}</span>
                    </div>
                    <div className="ev-hist-cals">{meal.calories} kcal</div>
                    <div className="ev-hist-macros-text">
                      <span style={{ color: 'var(--color-info-text)' }}>P: {meal.macros?.protein ?? 0}g</span>
                      <span style={{ color: 'var(--color-warning-text)' }}>C: {meal.macros?.carbs ?? 0}g</span>
                      <span style={{ color: 'var(--color-danger-text)' }}>F: {meal.macros?.fat ?? 0}g</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Secondary Summary Grid: Hydration & IF Fasting */}
        <div className="ev-secondary-grid">
          {/* Hydration Card */}
          <div className="ev-secondary-card" onClick={() => onNavigate('eating-water')}>
            <div className="ev-sec-card-top">
              <div className="ev-sec-icon" style={{ background: 'var(--color-cyan-soft)', color: 'var(--color-cyan)' }}>
                <FaDroplet />
              </div>
              <div className="ev-sec-info">
                <h4>{isTh ? 'น้ำดื่มวันนี้' : 'Hydration'}</h4>
                <strong>{water.glasses} <small>/ {water.target} {isTh ? 'แก้ว' : 'glasses'}</small></strong>
              </div>
            </div>
            <div className="ev-progress-bar-wrap small">
              <div className="ev-progress-fill" style={{ width: `${waterPct}%`, background: 'var(--color-cyan)' }} />
            </div>
            <div className="ev-sec-card-actions" onClick={e => e.stopPropagation()}>
              <button className="ev-sec-btn minus" onClick={() => updateWater(water.glasses - 1)} disabled={water.glasses <= 0}>−</button>
              <button className="ev-sec-btn plus" onClick={() => updateWater(water.glasses + 1)}>+ {isTh ? 'เพิ่ม 1 แก้ว' : '+1 Glass'}</button>
            </div>
          </div>

          {/* IF Fasting Card */}
          <div className="ev-secondary-card" onClick={() => onNavigate('eating-schedule')}>
            <div className="ev-sec-card-top">
              <div className="ev-sec-icon" style={{ background: 'var(--color-warning-soft)', color: 'var(--color-warning)' }}>
                <FaClock />
              </div>
              <div className="ev-sec-info">
                <h4>{isTh ? 'เวลาเว้นอาหาร (IF)' : 'Intermittent Fasting'}</h4>
                <strong>{isRunning ? `${isTh ? 'กำลังเว้นมื้อ' : 'Fasting'} ${fmtHMS(elapsedSec)}` : `${isTh ? 'สูตร' : 'Plan'} ${selectedSched}`}</strong>
              </div>
            </div>
            <div className="ev-progress-bar-wrap small">
              <div className="ev-progress-fill" style={{ width: `${fastPct}%`, background: 'var(--color-warning)' }} />
            </div>
            <div className="ev-sec-card-actions" onClick={e => e.stopPropagation()}>
              {!isRunning ? (
                <button className="ev-sec-btn fast-start" onClick={startFasting}><FaPlay style={{ fontSize: '10px' }} /> {isTh ? 'เริ่มจับเวลา IF' : 'Start Fasting'}</button>
              ) : (
                <button className="ev-sec-btn fast-stop" onClick={stopFasting}><FaStop style={{ fontSize: '10px' }} /> {isTh ? 'หยุดและบันทึก' : 'Stop & Save'}</button>
              )}
            </div>
          </div>
        </div>

      </div>
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

  return (
    <div className="eating-page">
      <header className="eating-header page-header">
        <BackButton onClick={handleBack} ariaLabel={t('common.back')} />
        <h1 className="eating-header-title">{TITLES[subView]}</h1>
        <div style={{ width: 40 }} />
      </header>
      <main className="eating-main page-content">{renderContent()}</main>

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

      {subView === 'dashboard' && (
        <BottomNav
          active="eating"
          onNavigate={onNavigate}
          onOpenFoodRecognition={onOpenFoodRecognition}
          t={t}
        />
      )}
    </div>
  );
};

// ══════════════════════════════════════════════
// SUB-COMPONENTS
// ══════════════════════════════════════════════

// FastRing
const FastRing: React.FC<any> = ({ pct, elapsed, target, running, isTh, protocol }) => {
  const S = 180, ST = 12, R = (S - ST) / 2, C = 2 * Math.PI * R;
  const rem = Math.max(0, target * 3600 - elapsed);
  const remH = Math.floor(rem / 3600), remM = Math.floor((rem % 3600) / 60);
  return (
    <div className="ev-fast-ring-wrap">
      <svg width={S} height={S} style={{ display: 'block' }}>
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke="var(--bg-primary)" strokeWidth={ST} />
        <circle cx={S / 2} cy={S / 2} r={R} fill="none" stroke={running ? '#F59E0B' : '#3B82F6'} strokeWidth={ST}
          strokeDasharray={`${C}`} strokeDashoffset={C * (1 - pct / 100)}
          strokeLinecap="round" transform={`rotate(-90 ${S / 2} ${S / 2})`}
          style={{ transition: 'stroke-dashoffset 1s linear' }} />
      </svg>
      <div className="ev-fast-center">
        {running ? (
          <>
            <span className="ev-fast-status">{isTh ? 'กำลังอดอาหาร' : 'Fasting'}</span>
            <span className="ev-fast-time">{fmtHMS(elapsed)}</span>
            <span className="ev-fast-rem">{isTh ? `เหลือ ${remH} ชม. ${remM} นาที` : `${remH}h ${remM}m left`}</span>
          </>
        ) : (
          <>
            <span className="ev-fast-status eating">{isTh ? 'ช่วงกิน' : 'Eating'} {24 - target} {isTh ? 'ชม.' : 'h'}</span>
            <span className="ev-fast-time">{protocol}</span>
            <span className="ev-fast-rem">{isTh ? `เป้าหมาย ${target} ชม.` : `Fast ${target}h`}</span>
          </>
        )}
      </div>
    </div>
  );
};

// MealDetailModal (Reused)
const MealDetailModal: React.FC<any> = ({ meal, globalIdx, isTh, onClose, onDelete, onEdit }) => {
  const { t } = useLanguage();
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
          <button className="ev-modal-close" onClick={onClose}><FaXmark /></button>
          <h2>{mealDisplayName(meal, t, isTh ? 'มื้ออาหาร' : 'Meal')}</h2>
          <span className="ev-meal-time-badge">{fmtTime(meal.timestamp)}</span>
        </div>
        {meal.imageUrl && <img src={meal.imageUrl} alt={meal.foodName} className="ev-modal-img" />}
        <div className="ev-modal-rows">
          {rows.map(r => (
            <div key={r.label} className="ev-modal-row">
              <span>{r.label}</span><strong>{r.val}</strong>
            </div>
          ))}
        </div>
        <div className="ev-modal-actions">
          <button className="ev-modal-btn edit" onClick={onEdit}><FaPencil /> {isTh ? 'แก้ไข' : 'Edit'}</button>
          <button className="ev-modal-btn del" onClick={() => onDelete(globalIdx)}><FaTrash /> {isTh ? 'ลบ' : 'Delete'}</button>
        </div>
      </div>
    </div>
  );
};

// MealEditModal (Reused)
const MealEditModal: React.FC<any> = ({ meal, isTh, recalcCalories, onClose, onSave }) => {
  const [form, setForm] = useState({
    foodName: meal.foodName || '', calories: meal.calories,
    protein: meal.macros?.protein ?? 0, carbs: meal.macros?.carbs ?? 0, fat: meal.macros?.fat ?? 0,
    sugar: meal.macros?.sugar ?? 0, fiber: meal.macros?.fiber ?? 0, sodium: meal.macros?.sodium ?? 0,
  });

  const handleMacroChange = (field: 'protein' | 'carbs' | 'fat', val: number) => {
    const next = { ...form, [field]: val };
    next.calories = recalcCalories({ protein: next.protein, carbs: next.carbs, fat: next.fat });
    setForm(next);
  };

  const handleSave = () => {
    onSave({
      ...meal, foodName: form.foodName, calories: form.calories,
      macros: { protein: form.protein, carbs: form.carbs, fat: form.fat, sugar: form.sugar, fiber: form.fiber, sodium: form.sodium },
    });
  };

  return (
    <div className="ev-modal-backdrop" onClick={onClose}>
      <div className="ev-modal ev-modal--edit" onClick={e => e.stopPropagation()}>
        <div className="ev-modal-header">
          <button className="ev-modal-close" onClick={onClose}><FaXmark /></button>
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
