import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

const calcDuration = (bed: string, wake: string): number => {
  const [bH, bM] = bed.split(':').map(Number);
  const [wH, wM] = wake.split(':').map(Number);
  const b = bH * 60 + bM;
  let w = wH * 60 + wM;
  if (w < b) w += 24 * 60;
  return Math.round(((w - b) / 60) * 10) / 10;
};

const getQualityColor = (q: number) => (q >= 8 ? '#22c55e' : q >= 6 ? '#f59e0b' : '#ef4444');
const getQualityLabel = (q: number) => (q >= 8 ? 'Excellent' : q >= 6 ? 'Good' : q >= 4 ? 'Fair' : 'Poor');

// ─── Interactive Sleep Clock ─────────────────────────────────────────────────

const CX = 130;
const CY = 130;
const R = 100;
const STROKE = 16;
const HANDLE_R = 18;
const VIEW = 260;

// ── 12-hour helpers ──────────────────────────────────────────────────────────

/** Convert 24-hr "HH:MM" to 12-hr clock angle (one full circle = 12hr) */
const timeToAngle12 = (t24: string): number => {
  const [h, m] = t24.split(':').map(Number);
  const h12 = h % 12; // 0-11
  return ((h12 * 60 + m) / (12 * 60)) * 360 - 90;
};

/** Convert drag angle to a 12-hr "HH:MM" string (01-12) */
const angleToTime12 = (deg: number): string => {
  const norm = ((deg + 90) % 360 + 360) % 360;
  const totalMin = Math.round((norm / 360) * 12 * 60);
  const h = Math.floor(totalMin / 60) % 12 || 12; // 0 → 12
  const m = totalMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

/** Convert 12-hr string + period to 24-hr "HH:MM" */
const to24hr = (t12: string, period: 'AM' | 'PM'): string => {
  const [h, m] = t12.split(':').map(Number);
  let hour = h % 12;
  if (period === 'PM') hour += 12;
  return `${String(hour).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};


const degToRad = (d: number) => (d * Math.PI) / 180;
const radToDeg = (r: number) => (r * 180) / Math.PI;

const ptOnCircle = (angleDeg: number) => ({
  x: CX + R * Math.cos(degToRad(angleDeg)),
  y: CY + R * Math.sin(degToRad(angleDeg)),
});

const arcPath = (startDeg: number, endDeg: number): string => {
  let end = endDeg;
  if (end <= startDeg) end += 360;
  const large = end - startDeg > 180 ? 1 : 0;
  const s = ptOnCircle(startDeg);
  const e = ptOnCircle(end);
  return `M ${s.x} ${s.y} A ${R} ${R} 0 ${large} 1 ${e.x} ${e.y}`;
};

interface DragClockProps {
  bedtime: string;       // 24-hr "HH:MM"
  waketime: string;      // 24-hr "HH:MM"
  bedPeriod: 'AM' | 'PM';
  wakePeriod: 'AM' | 'PM';
  duration: number;
  onBedtimeChange: (t24: string) => void;
  onWaketimeChange: (t24: string) => void;
}

const DragClock: React.FC<DragClockProps> = ({ bedtime, waketime, bedPeriod, wakePeriod, duration, onBedtimeChange, onWaketimeChange }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragging = useRef<'bed' | 'wake' | null>(null);

  const bedAngle = timeToAngle12(bedtime);
  const wakeAngle = timeToAngle12(waketime);

  const hours = Math.floor(duration);
  const mins = Math.round((duration - hours) * 60);

  const getSVGAngle = useCallback((clientX: number, clientY: number): number => {
    const svg = svgRef.current;
    if (!svg) return 0;
    const rect = svg.getBoundingClientRect();
    const scaleX = VIEW / rect.width;
    const scaleY = VIEW / rect.height;
    const x = (clientX - rect.left) * scaleX - CX;
    const y = (clientY - rect.top) * scaleY - CY;
    return radToDeg(Math.atan2(y, x));
  }, []);

  const onPointerDown = useCallback((handle: 'bed' | 'wake') => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    dragging.current = handle;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return;
    const angle = getSVGAngle(e.clientX, e.clientY);
    const t12 = angleToTime12(angle);
    if (dragging.current === 'bed') onBedtimeChange(to24hr(t12, bedPeriod));
    else onWaketimeChange(to24hr(t12, wakePeriod));
  }, [getSVGAngle, onBedtimeChange, onWaketimeChange, bedPeriod, wakePeriod]);

  const onPointerUp = useCallback(() => { dragging.current = null; }, []);

  const bedPt = ptOnCircle(bedAngle);
  const wakePt = ptOnCircle(wakeAngle);


  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${VIEW} ${VIEW}`}
      width="100%"
      style={{ touchAction: 'none', userSelect: 'none', maxWidth: 300, display: 'block', margin: '0 auto' }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <defs>
        <linearGradient id="arc-grad" gradientUnits="userSpaceOnUse" x1={CX - R} y1={CY} x2={CX + R} y2={CY + R}>
          <stop offset="0%" stopColor="#4f46e5" />
          <stop offset="100%" stopColor="#818cf8" />
        </linearGradient>
        <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="3" stdDeviation="4" floodColor="#0ea5e9" floodOpacity="0.35" />
        </filter>
      </defs>

      {/* Outer track */}
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="#e8e8f4" strokeWidth={STROKE} />

      {/* ── Detailed tick marks (minor: every 30min, major: every hour) ── */}
      {Array.from({ length: 48 }, (_, i) => {
        const isHour = i % 2 === 0; // every 2 half-ticks = 1 hour
        const angle = degToRad((i / 48) * 360 - 90);
        const outer = R + STROKE / 2 - 1;
        const inner = outer - (isHour ? 8 : 4);
        return (
          <line
            key={i}
            x1={CX + inner * Math.cos(angle)} y1={CY + inner * Math.sin(angle)}
            x2={CX + outer * Math.cos(angle)} y2={CY + outer * Math.sin(angle)}
            stroke={isHour ? '#b0b0cc' : '#d8d8ec'}
            strokeWidth={isHour ? 1.5 : 0.8}
          />
        );
      })}

      {/* ── 12-hour clock face labels ── */}
      {[12, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((num, i) => {
        // Each of 12 positions = 30° = 2 hours in our 24hr system
        const angle = degToRad(i * 30 - 90);
        const dist = R - STROKE / 2 - 14;
        const isMain = i % 3 === 0; // 12, 3, 6, 9 positions
        return (
          <text
            key={num}
            x={CX + dist * Math.cos(angle)}
            y={CY + dist * Math.sin(angle) + 4}
            textAnchor="middle"
            fontSize={isMain ? '10' : '8'}
            fontWeight={isMain ? '800' : '500'}
            fill={isMain ? '#0ea5e9' : '#94a3b8'}
            fontFamily="Inter,sans-serif"
          >
            {num}
          </text>
        );
      })}

      {/* ── Sleep arc (on top of ticks, under labels + handles) ── */}
      <path
        d={arcPath(bedAngle, wakeAngle)}
        fill="none"
        stroke="url(#arc-grad)"
        strokeWidth={STROKE}
        strokeLinecap="round"
      />

      {/* Center text */}
      <text x={CX} y={CY - 10} textAnchor="middle" fontSize="36" fontWeight="900" fill="#1e1b4b" fontFamily="Inter,sans-serif">
        {hours}hr
      </text>
      <text x={CX} y={CY + 16} textAnchor="middle" fontSize="16" fontWeight="700" fill="#0ea5e9" fontFamily="Inter,sans-serif">
        {mins}min
      </text>

      {/* ── Bedtime handle (moon, indigo) ── */}
      <circle
        cx={bedPt.x} cy={bedPt.y}
        r={HANDLE_R}
        fill="#4f46e5"
        filter="url(#shadow)"
        style={{ cursor: 'grab' }}
        onPointerDown={onPointerDown('bed')}
      />
      <text x={bedPt.x} y={bedPt.y + 5} textAnchor="middle" fontSize="14" style={{ pointerEvents: 'none' }}>🌙</text>

      {/* ── Wake time handle (alarm, amber) ── */}
      <circle
        cx={wakePt.x} cy={wakePt.y}
        r={HANDLE_R}
        fill="#f59e0b"
        filter="url(#shadow)"
        style={{ cursor: 'grab' }}
        onPointerDown={onPointerDown('wake')}
      />
      <text x={wakePt.x} y={wakePt.y + 5} textAnchor="middle" fontSize="13" style={{ pointerEvents: 'none' }}>⏰</text>
    </svg>
  );
};



// ─── Sparkline Stage Chart ───────────────────────────────────────────────────

const SleepStageChart: React.FC<{ logs: SleepLog[] }> = ({ logs }) => {
  if (logs.length === 0) return (
    <div style={{ textAlign: 'center', color: '#94a3b8', padding: '24px 0', fontSize: 13 }}>No data yet — log your sleep to see stages.</div>
  );

  const recent = logs.slice(0, 8).reverse();
  const W = 280;
  const H = 60;
  const points = recent.map((l, i) => {
    const x = (i / (recent.length - 1)) * W;
    const y = H - (l.quality / 10) * H;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        {['Awake', 'Light sleep', 'Deep sleep'].map(s => (
          <span key={s} style={{ fontSize: 9, color: '#94a3b8', fontWeight: 700 }}>{s}</span>
        ))}
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points={points} fill="none" stroke="#0ea5e9" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {recent.map((l, i) => {
          const x = (i / (recent.length - 1)) * W;
          const y = H - (l.quality / 10) * H;
          return <circle key={l.id} cx={x} cy={y} r="3.5" fill="#0ea5e9" />;
        })}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        {recent.map((l, i) => (
          <span key={i} style={{ fontSize: 9, color: '#94a3b8' }}>
            {new Date(l.timestamp).toLocaleDateString('en-GB', { day: 'numeric', month: 'numeric' })}
          </span>
        ))}
      </div>
    </div>
  );
};

// ─── Main Component ──────────────────────────────────────────────────────────

export const Sleep: React.FC<SleepProps> = ({ onNavigate }) => {
  const [sleepLogs, setSleepLogs] = useState<SleepLog[]>([]);
  const [bedtime, setBedtime] = useState('22:00');
  const [waketime, setWaketime] = useState('06:00');
  const [quality, setQuality] = useState(7);
  const [activeTab, setActiveTab] = useState<'journal' | 'statistics'>('journal');

  // AM/PM derived from the stored 24-hr states (kept in sync)
  const bedPeriod: 'AM' | 'PM' = parseInt(bedtime) < 12 ? 'AM' : 'PM';
  const wakePeriod: 'AM' | 'PM' = parseInt(waketime) < 12 ? 'AM' : 'PM';

  const toggleBedPeriod = () => {
    const [h, m] = bedtime.split(':').map(Number);
    const newH = h < 12 ? h + 12 : h - 12;
    setBedtime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };
  const toggleWakePeriod = () => {
    const [h, m] = waketime.split(':').map(Number);
    const newH = h < 12 ? h + 12 : h - 12;
    setWaketime(`${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  };

  async function loadSleepLogs() {
    if (isApiConfigured && !isSupabaseConfigured()) {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        const data = await healthApi.getSleepHistory(from.toISOString(), to.toISOString());
        const normalized = (Array.isArray(data) ? data : []).map((item: { id: string | number; bedtime?: string; waketime?: string; duration?: number; quality?: number; createdAt: string }) => ({
          id: item.id,
          bedtime: item.bedtime ? new Date(item.bedtime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '22:00',
          waketime: item.waketime ? new Date(item.waketime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '06:00',
          duration: item.duration ? Math.round((item.duration / 60) * 10) / 10 : 0,
          quality: item.quality || 0,
          timestamp: item.createdAt,
          date: new Date(item.createdAt).toLocaleDateString('th-TH'),
        }));
        setSleepLogs(normalized);
        return;
      } catch { /* fall through */ }
    }
    const saved = localStorage.getItem('sleepLogs');
    if (saved) setSleepLogs(JSON.parse(saved));
  }

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadSleepLogs(); }, []);

  const logSleep = async () => {
    const duration = calcDuration(bedtime, waketime);
    const newLog: SleepLog = {
      id: Date.now(), bedtime, waketime, duration, quality,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('th-TH'),
    };
    const updated = [newLog, ...sleepLogs];
    setSleepLogs(updated);
    localStorage.setItem('sleepLogs', JSON.stringify(updated));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const deleteLog = (id: number | string) => {
    const updated = sleepLogs.filter(l => l.id !== id);
    setSleepLogs(updated);
    localStorage.setItem('sleepLogs', JSON.stringify(updated));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  // Latest log for "today" card
  const latest = sleepLogs[0] || null;
  const todayDur = latest ? calcDuration(latest.bedtime, latest.waketime) : 8;
  const todayBed = latest?.bedtime || '22:00';
  const todayWake = latest?.waketime || '06:00';

  const weekAvg = useMemo(() => {
    const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 7);
    const week = sleepLogs.filter(l => new Date(l.timestamp) >= cutoff);
    if (!week.length) return { hours: 0, quality: 0 };
    return {
      hours: Math.round((week.reduce((s, l) => s + l.duration, 0) / week.length) * 10) / 10,
      quality: Math.round((week.reduce((s, l) => s + l.quality, 0) / week.length) * 10) / 10,
    };
  }, [sleepLogs]);

  const sleepTip = weekAvg.hours === 0 ? 'Start tracking sleep to unlock personalised insights.'
    : weekAvg.hours < 7 ? 'You\'re sleeping under 7h. Aim for 7–9h to maximise recovery and longevity.'
    : weekAvg.quality < 6 ? 'Sleep quality is low. Avoid screens 1h before bed and keep your room cool.'
    : weekAvg.hours > 9 ? 'Oversleeping may signal insufficient deep sleep. Try a consistent wake-up time.'
    : '✓ Great sleep this week! Keep your bedtime consistent to maintain healthy circadian rhythm.';

  // Day selector (last 5 days)
  const last5 = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (4 - i));
    return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }), day: d.getDate() };
  });

  return (
    <div style={{ minHeight: '100vh', background: '#f5f5fa', fontFamily: 'Inter, sans-serif' }}>
      {/* ── Header ─────────────────────────────────── */}
      <div style={{ padding: '20px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#1e1b4b' }}>Today</div>
          <div style={{ fontSize: 13, color: '#94a3b8', marginTop: 2 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
        </div>
        <button
          onClick={() => onNavigate('home')}
          style={{ background: '#e0f2fe', border: 'none', borderRadius: 12, padding: '8px 14px', color: '#0ea5e9', fontWeight: 700, cursor: 'pointer', fontSize: 13 }}
        >
          ← Back
        </button>
      </div>

      {/* ── Hero Card: Clock + Inline Controls ──────── */}
      <div style={{ margin: '16px 16px 0', background: 'white', borderRadius: 28, padding: '24px 20px', boxShadow: '0 4px 24px rgba(99,102,241,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <DragClock
            bedtime={bedtime}
            waketime={waketime}
            bedPeriod={bedPeriod}
            wakePeriod={wakePeriod}
            duration={calcDuration(bedtime, waketime)}
            onBedtimeChange={setBedtime}
            onWaketimeChange={setWaketime}
          />
        </div>

        {/* Inline time controls with AM/PM toggle */}
        <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
          {/* Bedtime */}
          <div style={{ flex: 1, background: '#f8f9ff', borderRadius: 18, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>🌙 Bedtime</div>
            <input
              type="time"
              value={bedtime}
              onChange={e => setBedtime(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 20, fontWeight: 900, color: '#4f46e5', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
              {(['AM', 'PM'] as const).map(p => (
                <button key={p} onClick={bedPeriod !== p ? toggleBedPeriod : undefined}
                  style={{ flex: 1, padding: '4px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                    background: bedPeriod === p ? '#4f46e5' : '#e8e8f8',
                    color: bedPeriod === p ? 'white' : '#94a3b8' }}>{p}</button>
              ))}
            </div>
          </div>
          {/* Wake time */}
          <div style={{ flex: 1, background: '#fffbeb', borderRadius: 18, padding: '12px 14px' }}>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>☀️ Wake up</div>
            <input
              type="time"
              value={waketime}
              onChange={e => setWaketime(e.target.value)}
              style={{ width: '100%', border: 'none', background: 'transparent', fontSize: 20, fontWeight: 900, color: '#f59e0b', outline: 'none', boxSizing: 'border-box', textAlign: 'center' }}
            />
            <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
              {(['AM', 'PM'] as const).map(p => (
                <button key={p} onClick={wakePeriod !== p ? toggleWakePeriod : undefined}
                  style={{ flex: 1, padding: '4px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 800,
                    background: wakePeriod === p ? '#f59e0b' : '#e8e8f8',
                    color: wakePeriod === p ? 'white' : '#94a3b8' }}>{p}</button>
              ))}
            </div>
          </div>
        </div>

        {/* Quality bar */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>✨ Sleep Quality</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: getQualityColor(quality) }}>{quality}/10 — {getQualityLabel(quality)}</span>
          </div>
          <input
            type="range" min="1" max="10" value={quality}
            onChange={e => setQuality(Number(e.target.value))}
            style={{ width: '100%', accentColor: getQualityColor(quality) }}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#94a3b8', marginTop: 3 }}>
            <span>😫 Poor</span><span>😴 Fair</span><span>😊 Good</span><span>🌟 Excellent</span>
          </div>
        </div>

        {/* Save button */}
        <button
          onClick={logSleep}
          style={{ marginTop: 16, width: '100%', background: 'linear-gradient(135deg,#0ea5e9,#38bdf8)', border: 'none', borderRadius: 16, padding: '14px', color: 'white', fontWeight: 800, fontSize: 15, cursor: 'pointer', letterSpacing: 0.5 }}
        >
          Save Sleep Log
        </button>
      </div>

      {/* ── Tabs ── Journal / Statistics ──────────── */}
      <div style={{ margin: '16px 16px 0', background: 'white', borderRadius: 28, boxShadow: '0 4px 24px rgba(99,102,241,0.06)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', borderBottom: '1px solid #f1f5f9' }}>
          {(['journal', 'statistics'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: 1, padding: '14px 0', border: 'none', background: 'transparent', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, textTransform: 'capitalize',
                color: activeTab === tab ? '#0ea5e9' : '#94a3b8',
                borderBottom: activeTab === tab ? '2.5px solid #0ea5e9' : '2.5px solid transparent',
              }}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* ── Journal Tab ── */}
        {activeTab === 'journal' && (
          <div style={{ padding: '16px 20px 20px' }}>
            {/* Day selector */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              {last5.map((d, i) => (
                <div key={i} style={{
                  flex: 1, textAlign: 'center', borderRadius: 14,
                  background: i === 4 ? '#0ea5e9' : '#f0f9ff',
                  padding: '8px 4px',
                }}>
                  <div style={{ fontSize: 9, fontWeight: 700, color: i === 4 ? 'rgba(255,255,255,0.8)' : '#94a3b8', textTransform: 'uppercase' }}>{d.label}</div>
                  <div style={{ fontSize: 16, fontWeight: 900, color: i === 4 ? 'white' : '#1e1b4b', marginTop: 2 }}>{d.day}</div>
                </div>
              ))}
            </div>

            {/* Quick stats for today */}
            {latest && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
                {[
                  { label: 'In Bed', value: `${Math.floor(todayDur)}h ${Math.round((todayDur % 1) * 60)}m`, icon: '🛏', color: '#0ea5e9' },
                  { label: 'Asleep', value: `${Math.floor(todayDur - 0.3)}h ${Math.round(((todayDur - 0.3) % 1) * 60)}m`, icon: '😴', color: '#f59e0b' },
                  { label: 'Went to bed', value: todayBed, icon: '🌙', color: '#10b981' },
                  { label: 'Wake up', value: todayWake, icon: '☀️', color: '#fb923c' },
                ].map(item => (
                  <div key={item.label} style={{ background: '#f8f9ff', borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{item.icon}</span>
                    <div>
                      <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{item.label}</div>
                      <div style={{ fontSize: 14, fontWeight: 800, color: item.color }}>{item.value}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Sleep tips */}
            <div style={{ background: '#ede9fe', borderRadius: 18, padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{ fontSize: 22, flexShrink: 0 }}>💡</div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#0ea5e9', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 1 }}>Sleep Tip</div>
                <div style={{ fontSize: 13, color: '#4338ca', lineHeight: 1.5 }}>{sleepTip}</div>
              </div>
            </div>
          </div>
        )}

        {/* ── Statistics Tab ── */}
        {activeTab === 'statistics' && (
          <div style={{ padding: '16px 20px 20px' }}>
            {/* Week averages */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <div style={{ flex: 1, background: '#f8f9ff', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Avg. Hours</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: '#0ea5e9', marginTop: 2 }}>{weekAvg.hours || '--'}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>7-day average</div>
              </div>
              <div style={{ flex: 1, background: '#f8f9ff', borderRadius: 16, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>Avg. Quality</div>
                <div style={{ fontSize: 26, fontWeight: 900, color: weekAvg.quality >= 7 ? '#22c55e' : weekAvg.quality >= 5 ? '#f59e0b' : '#ef4444', marginTop: 2 }}>
                  {weekAvg.quality || '--'}
                </div>
                <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 2 }}>out of 10</div>
              </div>
            </div>

            {/* Sleep stage sparkline */}
            <div style={{ background: '#f8f9ff', borderRadius: 18, padding: '16px' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#1e1b4b', marginBottom: 12 }}>Sleep quality trend</div>
              <SleepStageChart logs={sleepLogs} />
            </div>
          </div>
        )}
      </div>

      {/* ── History List ─────────────────────────────── */}
      <div style={{ margin: '16px 16px 100px' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: '#1e1b4b', marginBottom: 12 }}>Recent Logs</div>
        {sleepLogs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#94a3b8' }}>
            <div style={{ fontSize: 40, marginBottom: 8 }}>🌙</div>
            <div style={{ fontSize: 14, fontWeight: 600 }}>No sleep logs yet.</div>
          </div>
        ) : sleepLogs.slice(0, 7).map(log => (
          <div key={log.id} style={{ background: 'white', borderRadius: 18, padding: '14px 16px', marginBottom: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.04)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 44, height: 44, borderRadius: 14, background: '#ede9fe', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🌙</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1e1b4b' }}>
                  {log.bedtime} → {log.waketime}
                </div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>
                  {new Date(log.timestamp).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })} · {log.duration}h
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 12, fontWeight: 800, color: getQualityColor(log.quality), background: `${getQualityColor(log.quality)}18`, padding: '3px 9px', borderRadius: 20 }}>
                {log.quality}/10
              </span>
              <button onClick={() => deleteLog(log.id)} style={{ background: '#fee2e2', border: 'none', borderRadius: 10, width: 30, height: 30, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🗑</button>
            </div>
          </div>
        ))}
      </div>


    </div>
  );
};
