import React, { useState, useEffect } from 'react';
import { useLanguage } from '../../contexts/LanguageContext';
import { FaPlay, FaStop, FaClockRotateLeft } from 'react-icons/fa6';

const SCHEDULES = [
  { id: '12:12', label: '12:12', fast: 12 },
  { id: '14:10', label: '14:10', fast: 14 },
  { id: '16:8',  label: '16:8',  fast: 16 },
  { id: '18:6',  label: '18:6',  fast: 18 },
  { id: '20:4',  label: '20:4',  fast: 20 },
  { id: 'OMAD',  label: 'OMAD',  fast: 23 },
  { id: 'custom',label: 'Custom',fast: 0  },
];

export const EatingScheduleCard: React.FC = () => {
  const { language } = useLanguage();
  const isTh = language === 'th';

  const [selectedSchedule, setSelectedSchedule] = useState('16:8');
  const [fastHours, setFastHours] = useState(16);
  const [customFastHours, setCustomFastHours] = useState(16);
  const [isRunning, setIsRunning] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Load from localStorage on mount
  useEffect(() => {
    const active = localStorage.getItem('fastingActive') === 'true';
    if (active) {
      const st = localStorage.getItem('fastingStartTime');
      const hours = Number(localStorage.getItem('fastingTargetHours') || '16');
      if (st) {
        const start = new Date(st);
        const elapsed = Math.floor((Date.now() - start.getTime()) / 1000);
        const targetSecs = hours * 3600;
        if (elapsed < targetSecs) {
          setStartTime(start);
          setFastHours(hours);
          setElapsedSeconds(elapsed);
          setIsRunning(true);
          const sched = SCHEDULES.find(s => s.fast === hours);
          setSelectedSchedule(sched ? sched.id : 'custom');
        } else {
          // Session expired — clear it
          localStorage.removeItem('fastingActive');
          localStorage.removeItem('fastingStartTime');
          localStorage.removeItem('fastingTargetHours');
        }
      }
    }
  }, []);

  // Tick counter
  useEffect(() => {
    let interval: number;
    if (isRunning && startTime) {
      interval = window.setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - startTime.getTime()) / 1000));
      }, 1000);
    }
    return () => window.clearInterval(interval);
  }, [isRunning, startTime]);

  const targetSeconds = fastHours * 3600;
  const progressPct = targetSeconds > 0 ? Math.min((elapsedSeconds / targetSeconds) * 100, 100) : 0;

  const handleSelectSchedule = (id: string, hours: number) => {
    if (isRunning) return;
    setSelectedSchedule(id);
    if (id !== 'custom') setFastHours(hours);
    else setFastHours(customFastHours);
  };

  const handleStart = () => {
    const hrs = selectedSchedule === 'custom' ? customFastHours : fastHours;
    const now = new Date();
    setStartTime(now);
    setFastHours(hrs);
    setElapsedSeconds(0);
    setIsRunning(true);
    localStorage.setItem('fastingActive', 'true');
    localStorage.setItem('fastingStartTime', now.toISOString());
    localStorage.setItem('fastingTargetHours', String(hrs));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const handleStop = () => {
    setIsRunning(false);
    setStartTime(null);
    setElapsedSeconds(0);
    localStorage.removeItem('fastingActive');
    localStorage.removeItem('fastingStartTime');
    localStorage.removeItem('fastingTargetHours');
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  };

  const SIZE = 160;
  const STROKE = 10;
  const R = (SIZE - STROKE) / 2;
  const CIRC = 2 * Math.PI * R;
  const dashOffset = CIRC * (1 - progressPct / 100);

  const isFasting = isRunning;
  const remaining = Math.max(0, targetSeconds - elapsedSeconds);

  return (
    <div className="eating-schedule-card">
      {/* Schedule chips */}
      <div className="schedule-options">
        {SCHEDULES.map(s => (
          <button
            key={s.id}
            className={`schedule-chip ${selectedSchedule === s.id ? 'active' : ''}`}
            onClick={() => handleSelectSchedule(s.id, s.fast)}
            disabled={isRunning}
          >
            {s.id === 'custom' ? (isTh ? 'กำหนดเอง' : 'Custom') : s.label}
          </button>
        ))}
      </div>

      {/* Custom input */}
      {selectedSchedule === 'custom' && !isRunning && (
        <div className="custom-schedule-input">
          <label>{isTh ? 'ระยะเวลาอดอาหาร (ชั่วโมง):' : 'Fasting duration (hours):'}</label>
          <input
            type="number"
            value={customFastHours}
            min={1} max={23}
            onChange={e => {
              const v = Number(e.target.value);
              setCustomFastHours(v);
              setFastHours(v);
            }}
          />
        </div>
      )}

      {/* Status ring */}
      <div className="schedule-status-display">
        <svg width={SIZE} height={SIZE} className="schedule-ring">
          <circle cx={SIZE/2} cy={SIZE/2} r={R} className="ring-bg" strokeWidth={STROKE} />
          <circle
            cx={SIZE/2} cy={SIZE/2} r={R}
            className="ring-progress"
            strokeWidth={STROKE}
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            transform={`rotate(-90 ${SIZE/2} ${SIZE/2})`}
          />
        </svg>
        <div className="status-text">
          {isFasting ? (
            <>
              <span className="status-label fasting">{isTh ? 'กำลังอดอาหาร' : 'Fasting'}</span>
              <span className="status-elapsed">{formatTime(elapsedSeconds)}</span>
              <span className="status-target">/ {fastHours} {isTh ? 'ชม.' : 'hrs'}</span>
              <span className="status-remaining">
                {isTh ? `เหลืออีก ${Math.floor(remaining/3600)} ชม. ${Math.floor((remaining%3600)/60)} นาที`
                       : `${Math.floor(remaining/3600)}h ${Math.floor((remaining%3600)/60)}m left`}
              </span>
            </>
          ) : (
            <>
              <span className="status-label eating">{isTh ? 'ช่วงกิน' : 'Eating Window'}</span>
              <span className="status-target">{24 - fastHours} {isTh ? 'ชม.' : 'hrs'}</span>
            </>
          )}
        </div>
      </div>

      {/* Controls */}
      <div className="schedule-actions">
        {!isRunning ? (
          <button className="start-btn" onClick={handleStart}>
            <FaPlay /> {isTh ? 'เริ่มอดอาหาร' : 'Start Fasting'}
          </button>
        ) : (
          <button className="stop-btn" onClick={handleStop}>
            <FaStop /> {isTh ? 'หยุด' : 'Stop'}
          </button>
        )}
        <button className="history-btn">
          <FaClockRotateLeft /> {isTh ? 'ประวัติ' : 'History'}
        </button>
      </div>
    </div>
  );
};
