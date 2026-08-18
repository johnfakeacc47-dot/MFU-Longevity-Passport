import React, { useState, useEffect, useMemo } from 'react';
import { FaBicycle, FaDumbbell, FaFire, FaRunning, FaStopwatch, FaSwimmer, FaTimes, FaTrash, FaWalking, FaYinYang, FaArrowLeft, FaHeartbeat } from 'react-icons/fa';
import { BottomNav } from '../components/BottomNav';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { safeParse } from '../utils/safeStorage';
import { healthApi, isApiConfigured } from '../services/healthApi';
import '../styles/components/activity.css'; // Will create this

type PageType = 'home' | 'profile' | 'team' | 'eating' | 'dashboard' | 'activity' | 'sleep';

interface ActivityProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

interface ActivityLog {
  id: number | string;
  type: string;
  duration: number; // in minutes
  caloriesBurned: number;
  timestamp: string;
  date: string;
}

const ACTIVITY_TYPES = [
  { type: 'walking',  Icon: FaWalking,  calPerMin: 4,  color: '#10B981', bg: '#D1FAE5', impactTH: 'เสริมสร้างหัวใจและข้อต่อ', impactEN: 'Boosts heart health & joints' },
  { type: 'running',  Icon: FaRunning,  calPerMin: 10, color: '#EF4444', bg: '#FEE2E2', impactTH: 'เพิ่มความอึดของระบบไหลเวียนเลือด', impactEN: 'Improves cardiovascular endurance' },
  { type: 'cycling',  Icon: FaBicycle,  calPerMin: 8,  color: '#F59E0B', bg: '#FEF3C7', impactTH: 'ลดความเสี่ยงโรคหัวใจและหลอดเลือด', impactEN: 'Reduces cardiovascular disease risk' },
  { type: 'strength', Icon: FaDumbbell, calPerMin: 6,  color: '#3B82F6', bg: '#DBEAFE', impactTH: 'รักษามวลกล้ามเนื้อและกระดูก', impactEN: 'Preserves muscle mass & bone density' },
  { type: 'yoga',     Icon: FaYinYang,  calPerMin: 3,  color: '#8B5CF6', bg: '#EDE9FE', impactTH: 'เพิ่มความยืดหยุ่นและลดความเครียด', impactEN: 'Enhances flexibility & reduces stress' },
  { type: 'swimming', Icon: FaSwimmer,  calPerMin: 11, color: '#06B6D4', bg: '#CFFAFE', impactTH: 'การออกกำลังกายแบบไร้แรงกระแทก', impactEN: 'Zero-impact full body workout' },
];

export const Activity: React.FC<ActivityProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t, language } = useLanguage();
  const isTh = language === 'th';
  useSEO(`${t('activity.title')} · MFU Longevity Passport`, 'Track workouts, steps, and daily physical activity.');

  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selected, setSelected] = useState('');
  
  // Flexible input state
  const [inputHours, setInputHours] = useState<number | ''>('');
  const [inputMinutes, setInputMinutes] = useState<number | ''>(30);

  const loadActivities = React.useCallback(async () => {
    if (isApiConfigured) {
      try {
        const to = new Date(); const from = new Date(); from.setDate(to.getDate() - 30);
        const data = await healthApi.getActivityHistory(from.toISOString(), to.toISOString());
        const norm = (Array.isArray(data) ? data : []).map((item: any) => ({
          id: item.id, type: item.type, duration: item.duration,
          caloriesBurned: item.caloriesBurned || 0,
          timestamp: item.createdAt,
          date: new Date(item.createdAt).toLocaleDateString('th-TH'),
        }));
        setActivities(norm); return;
      } catch (e) {
        console.error('Failed to load API activities:', e);
      }
    }
    const saved = localStorage.getItem('activities');
    if (saved) setActivities(safeParse(saved, []));
  }, []);

  useEffect(() => { loadActivities(); }, [loadActivities]);

  const todayActs = useMemo(() => {
    const today = new Date().toDateString();
    return activities.filter(a => new Date(a.timestamp).toDateString() === today);
  }, [activities]);

  const todayTotal = useMemo(() => ({
    minutes: todayActs.reduce((s, a) => s + a.duration, 0),
    calories: todayActs.reduce((s, a) => s + a.caloriesBurned, 0),
  }), [todayActs]);

  // Exercise Score (0-100) - e.g., 30 mins = 100
  const exerciseScore = Math.min(Math.round((todayTotal.minutes / 30) * 100), 100);

  const openModal = (type: string) => { 
    setSelected(type); 
    setInputHours(''); 
    setInputMinutes(30); 
    setShowModal(true); 
  };

  const getDurationInMinutes = () => {
    const hrs = typeof inputHours === 'number' ? inputHours : 0;
    const mins = typeof inputMinutes === 'number' ? inputMinutes : 0;
    return hrs * 60 + mins;
  };

  const selectedCfg = ACTIVITY_TYPES.find(a => a.type === selected);
  const currentDuration = getDurationInMinutes();
  const currentCalories = Math.round((selectedCfg?.calPerMin ?? 0) * currentDuration);

  const logActivity = async () => {
    if (!selected || currentDuration <= 0) return;
    
    const newAct: ActivityLog = {
      id: Date.now(), type: selected, duration: currentDuration, caloriesBurned: currentCalories,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('th-TH'),
    };
    
    const updated = [newAct, ...activities];
    setActivities(updated);
    localStorage.setItem('activities', JSON.stringify(updated));
    
    try {
      if (isApiConfigured) {
        await healthApi.logActivity({ type: selected, duration: currentDuration, caloriesBurned: currentCalories });
      }
    } catch (e) {
      console.error('Failed to log activity:', e);
    }
    window.dispatchEvent(new Event('healthDataUpdated'));
    setShowModal(false); 
    setSelected('');
  };

  const deleteActivity = (id: number | string) => {
    const updated = activities.filter(a => a.id !== id);
    setActivities(updated);
    localStorage.setItem('activities', JSON.stringify(updated));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const getLabel = (type: string) => t(`activity.${type}`) || type;

  return (
    <div className="activity-page">
      <header className="activity-header">
        <button className="back-btn" onClick={() => onNavigate('home')} aria-label={t('common.back')}>
          <FaArrowLeft />
        </button>
        <h1>{isTh ? 'การออกกำลังกาย' : 'Exercise'}</h1>
        <div style={{ width: 40 }} />
      </header>

      <main className="activity-main">
        
        {/* Today's Health Summary Hero */}
        <div className="ev-hero-summary exercise-hero">
          <div className="ev-hero-header">
            <h2>{isTh ? 'สรุปการเคลื่อนไหววันนี้' : "Today's Activity Summary"}</h2>
            <span className="ev-date-badge">{new Date().toLocaleDateString(isTh ? 'th-TH' : 'en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</span>
          </div>
          
          <div className="ev-hero-metrics">
            <div className="ev-hero-metric">
              <span className="ev-metric-val" style={{ color: exerciseScore >= 100 ? '#10B981' : '#3B82F6' }}>{exerciseScore}</span>
              <span className="ev-metric-label">{isTh ? 'คะแนน' : 'Score'}</span>
            </div>
            <div className="ev-hero-divider" />
            <div className="ev-hero-metric">
              <span className="ev-metric-val">{todayTotal.minutes} <small>min</small></span>
              <span className="ev-metric-label">{isTh ? 'เวลาขยับตัว' : 'Active Time'}</span>
            </div>
            <div className="ev-hero-divider" />
            <div className="ev-hero-metric">
              <span className="ev-metric-val">{todayTotal.calories} <small>kcal</small></span>
              <span className="ev-metric-label">{isTh ? 'เผาผลาญ' : 'Burned'}</span>
            </div>
          </div>
        </div>

        {/* Quick Log Cards */}
        <div className="ac-section">
          <h2 className="ac-section-title">{isTh ? 'บันทึกการออกกำลังกาย' : 'Log Activity'}</h2>
          <div className="ac-type-grid">
            {ACTIVITY_TYPES.map((act) => {
              const Icon = act.Icon;
              return (
                <button key={act.type} className="ac-type-card" style={{ '--card-color': act.color, '--card-bg': act.bg } as any} onClick={() => openModal(act.type)}>
                  <div className="ac-type-icon-wrap"><Icon className="ac-type-icon" /></div>
                  <div className="ac-type-label">{getLabel(act.type)}</div>
                  <div className="ac-type-cals">{act.calPerMin} kcal/min</div>
                </button>
              );
            })}
          </div>
        </div>

        {/* History */}
        <div className="ac-section">
          <h2 className="ac-section-title">{isTh ? 'ประวัติการทำกิจกรรม' : 'Activity History'}</h2>
          
          {activities.length === 0 ? (
            <div className="ac-empty">
              <FaRunning className="ac-empty-icon" />
              <p>{isTh ? 'ยังไม่มีประวัติการออกกำลังกาย' : 'No activity logged yet.'}</p>
            </div>
          ) : (
            <div className="ac-history-list">
              {activities.slice(0, 10).map((act) => {
                const cfg = ACTIVITY_TYPES.find(a => a.type === act.type);
                const Icon = cfg?.Icon ?? FaRunning;
                return (
                  <div key={act.id} className="ac-hist-card">
                    <div className="ac-hist-icon" style={{ background: cfg?.bg ?? '#f1f5f9', color: cfg?.color ?? '#64748b' }}>
                      <Icon />
                    </div>
                    <div className="ac-hist-body">
                      <div className="ac-hist-header">
                        <h4>{getLabel(act.type)}</h4>
                        <span className="ac-hist-time">{new Date(act.timestamp).toLocaleDateString(isTh ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute:'2-digit' })}</span>
                      </div>
                      <div className="ac-hist-meta">
                        <span>{act.duration} {isTh ? 'นาที' : 'min'}</span>
                        <span className="ac-hist-cals">{act.caloriesBurned} kcal</span>
                      </div>
                    </div>
                    <button className="ac-hist-del" onClick={() => deleteActivity(act.id)}>
                      <FaTrash />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>

      {/* Log Modal */}
      {showModal && (
        <div className="ac-modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="ac-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ac-modal-header">
              <h3>{isTh ? 'ระบุเวลา' : 'Enter Duration'}</h3>
              <button className="ac-modal-close" onClick={() => setShowModal(false)}><FaTimes /></button>
            </div>

            {selectedCfg && (
              <div className="ac-modal-hero" style={{ background: selectedCfg.bg, color: selectedCfg.color }}>
                <selectedCfg.Icon className="ac-modal-hero-icon" />
                <h4>{getLabel(selected)}</h4>
              </div>
            )}

            <div className="ac-modal-inputs">
              <div className="ac-input-group">
                <label>{isTh ? 'ชั่วโมง' : 'Hours'}</label>
                <input type="number" min="0" placeholder="0" value={inputHours} onChange={e => setInputHours(e.target.value ? Number(e.target.value) : '')} />
              </div>
              <div className="ac-input-separator">:</div>
              <div className="ac-input-group">
                <label>{isTh ? 'นาที' : 'Minutes'}</label>
                <input type="number" min="0" max="59" placeholder="0" value={inputMinutes} onChange={e => setInputMinutes(e.target.value ? Number(e.target.value) : '')} />
              </div>
            </div>

            <div className="ac-modal-stats">
              <div className="ac-stat-box">
                <FaStopwatch />
                <strong>{currentDuration}</strong>
                <span>{isTh ? 'นาทีรวม' : 'Total Mins'}</span>
              </div>
              <div className="ac-stat-box highlight">
                <FaFire />
                <strong>{currentCalories}</strong>
                <span>{isTh ? 'แคลอรี่เผาผลาญ' : 'Calories Burned'}</span>
              </div>
            </div>

            {selectedCfg && (
              <div className="ac-health-impact">
                <div className="ac-impact-title">
                  <FaHeartbeat /> {isTh ? 'ผลกระทบต่อสุขภาพ' : 'Health Impact'}
                </div>
                <div className="ac-impact-text">
                  {isTh ? selectedCfg.impactTH : selectedCfg.impactEN}
                </div>
              </div>
            )}

            <button className="ac-submit-btn" onClick={logActivity} disabled={currentDuration <= 0}>
              {isTh ? 'บันทึกการออกกำลังกาย' : 'Log Activity'}
            </button>
          </div>
        </div>
      )}

      <BottomNav active="dashboard" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
