import React, { useEffect, useRef, useState } from 'react';
import { FaBed, FaBolt, FaCheckCircle, FaHourglassHalf, FaRunning } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { USER_GOALS_KEY, readUserGoals, type UserGoals } from '../utils/userGoals';

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface SetGoalsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const SetGoals: React.FC<SetGoalsProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t, language } = useLanguage();
  const isTh = language === 'th';
  useSEO(`${t('setGoals.title')} · MFU Longevity Passport`, 'Set and adjust your personal health goals.');
  // Clamped to the slider ranges, so a stale/hand-edited value can't land a
  // thumb outside its track. The coach reads the same store (utils/userGoals).
  const [initial] = useState<UserGoals>(readUserGoals);
  const [fastingGoal, setFastingGoal] = useState(initial.fastingHours);
  const [sleepGoal, setSleepGoal] = useState(initial.sleepHours);
  const [activityGoal, setActivityGoal] = useState(initial.activityMinutes);
  const [saveState, setSaveState] = useState<'idle' | 'saved' | 'error'>('idle');
  const navTimer = useRef<number | null>(null);

  useEffect(() => () => { if (navTimer.current) window.clearTimeout(navTimer.current); }, []);

  const saveGoals = () => {
    const goals: UserGoals = {
      fastingHours: fastingGoal,
      sleepHours: sleepGoal,
      activityMinutes: activityGoal,
      updatedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(USER_GOALS_KEY, JSON.stringify(goals));
    } catch (err) {
      console.error('Failed to save goals:', err);
      setSaveState('error');
      return;
    }
    // Same event the loggers fire, so Home/Dashboard recompute against the new targets.
    window.dispatchEvent(new CustomEvent('healthDataUpdated'));
    setSaveState('saved');
    // Let the confirmation be seen before leaving the page.
    navTimer.current = window.setTimeout(() => onNavigate('profile'), 1200);
  };

  const getHealthPotential = () => {
    let score = 0;
    if (fastingGoal >= 16) score += 34;
    if (sleepGoal >= 7 && sleepGoal <= 9) score += 33;
    if (activityGoal >= 45) score += 33;
    return score;
  };

  const healthPotential = getHealthPotential();
  const fastingPct = Math.round(((fastingGoal - 12) / (22 - 12)) * 100);
  const sleepPct = Math.round(((sleepGoal - 4) / (10 - 4)) * 100);
  const activityPct = Math.round(((activityGoal - 15) / (120 - 15)) * 100);

  const potentialTone = isTh
    ? (healthPotential >= 85 ? 'ยอดเยี่ยม' : healthPotential >= 60 ? 'แข็งแกร่ง' : healthPotential >= 35 ? 'กำลังพัฒนา' : 'เริ่มต้น')
    : (healthPotential >= 85 ? 'Excellent' : healthPotential >= 60 ? 'Strong' : healthPotential >= 35 ? 'Building' : 'Starter');

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <BackButton onClick={() => onNavigate('profile')} ariaLabel={t('common.back')} />
        <h1 className="header-title text-gradient">{isTh ? 'ตั้งเป้าหมายสุขภาพ' : 'Set Health Goals'}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4">
        {/* Health Potential Indicator */}
        <div
          className="glass-card p-6 rounded-2xl"
          style={{
            padding: '1.5rem',
            height: 'auto',
            minHeight: 'fit-content',
            border: '1px solid var(--border-glass)'
          }}
        >
          <div className="flex justify-between items-start mb-4">
            <div>
              <div className="text-sm font-black uppercase tracking-wider mb-1" style={{ color: 'var(--text-accent)' }}>{isTh ? 'ศักยภาพการชะลอวัย' : 'Longevity Potential'}</div>
              <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'ประเมินจากเป้าหมายประจำวันของคุณ' : 'Based on your current daily targets'}</div>
            </div>
            <div className="px-3 py-1 rounded-full text-xs font-black" style={{ background: 'rgba(33, 150, 243, 0.14)', color: 'var(--text-accent)' }}>
              {potentialTone}
            </div>
          </div>

          <div className="flex items-end justify-between mb-3">
            <div className="text-4xl font-black leading-none" style={{ color: 'var(--text-primary, #1d4ed8)' }}>{healthPotential}%</div>
            <div className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-accent, #3b82f6)' }}>{isTh ? 'แนวโน้มสุขภาพในอนาคต' : 'Projected health arc'}</div>
          </div>

          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-soft, #e5e7eb)' }}>
            <div 
              className="h-full bg-gradient-to-r from-blue-600 to-blue-800 transition-all duration-500"
              style={{ width: `${healthPotential}%` }}
            ></div>
          </div>

          <div className="grid grid-cols-3 gap-2 mt-4">
            <div className="rounded-xl p-2 text-center" style={{ background: 'var(--surface-soft, rgba(33, 150, 243, 0.08))' }}>
              <div className="text-[10px] uppercase font-black" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'อดอาหาร' : 'Fasting'}</div>
              <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{fastingGoal} {isTh ? 'ชม.' : 'h'}</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: 'var(--surface-soft, rgba(33, 150, 243, 0.08))' }}>
              <div className="text-[10px] uppercase font-black" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'การนอน' : 'Sleep'}</div>
              <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{sleepGoal} {isTh ? 'ชม.' : 'h'}</div>
            </div>
            <div className="rounded-xl p-2 text-center" style={{ background: 'var(--surface-soft, rgba(33, 150, 243, 0.08))' }}>
              <div className="text-[10px] uppercase font-black" style={{ color: 'var(--text-secondary)' }}>{isTh ? 'ออกกำลังกาย' : 'Activity'}</div>
              <div className="text-sm font-black" style={{ color: 'var(--text-primary)' }}>{activityGoal} {isTh ? 'นาที' : 'm'}</div>
            </div>
          </div>
        </div>

        {/* Fasting Goal */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content', border: '1px solid var(--border-glass)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon"><FaHourglassHalf /></span>
              <span className="section-title font-bold" style={{ color: 'var(--text-primary)' }}>{isTh ? 'ช่วงเวลาอดอาหาร' : 'Fasting Window'}</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--surface-soft)', color: 'var(--color-primary, #3b82f6)' }}>{fastingGoal} {isTh ? 'ชม.' : 'hrs'}</span>
          </div>
          {/* One control: the range paints its own filled track (.sg-range)
              rather than stacking a second progress bar under it. */}
          <input
            type="range" min="12" max="22" step="1"
            className="sg-range"
            style={{ '--sg-pct': `${fastingPct}%` } as React.CSSProperties}
            aria-label={isTh ? 'ช่วงเวลาอดอาหาร' : 'Fasting Window'}
            value={fastingGoal}
            onChange={(e) => setFastingGoal(parseInt(e.target.value))}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <span>12 {isTh ? 'ชม.' : 'h'}</span>
            <span>{isTh ? '16 ชม. (เหมาะสม)' : '16h (Optimal)'}</span>
            <span>22 {isTh ? 'ชม.' : 'h'}</span>
          </div>
          <div className="mt-4 p-3 rounded-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
            <p className="text-sm leading-tight" style={{ color: 'var(--text-secondary)' }}>
              {isTh ? (
                <><strong>คำแนะนำ:</strong> การอดอาหาร 16+ ชั่วโมงช่วยกระตุ้นกระบวนการ <strong>Autophagy</strong> ซึ่งช่วยทำความสะอาดและซ่อมแซมเซลล์ที่เชื่อมโยงกับการชะลอวัย</>
              ) : (
                <><strong>Tip:</strong> 16+ hours promotes <strong>autophagy</strong>, a key cellular cleanup process linked to longevity.</>
              )}
            </p>
          </div>
        </div>

        {/* Sleep Goal */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content', border: '1px solid var(--border-glass)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon"><FaBed /></span>
              <span className="section-title font-bold" style={{ color: 'var(--text-primary)' }}>{isTh ? 'เป้าหมายการนอนหลับ' : 'Sleep Target'}</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--surface-soft)', color: 'var(--color-primary, #3b82f6)' }}>{sleepGoal} {isTh ? 'ชม.' : 'hrs'}</span>
          </div>
          {/* One control: the range paints its own filled track (.sg-range)
              rather than stacking a second progress bar under it. */}
          <input
            type="range" min="4" max="10" step="0.5"
            className="sg-range"
            style={{ '--sg-pct': `${sleepPct}%` } as React.CSSProperties}
            aria-label={isTh ? 'เป้าหมายการนอนหลับ' : 'Sleep Target'}
            value={sleepGoal}
            onChange={(e) => setSleepGoal(parseFloat(e.target.value))}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <span>4 {isTh ? 'ชม.' : 'h'}</span>
            <span>{isTh ? '8 ชม. (แนะนำ)' : '8h (Recommended)'}</span>
            <span>10 {isTh ? 'ชม.' : 'h'}</span>
          </div>
          <div className="mt-4 p-3 rounded-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
            <p className="text-sm leading-tight" style={{ color: 'var(--text-secondary)' }}>
              {isTh ? (
                <><strong>ข้อมูลวิทยาศาสตร์:</strong> การนอนหลับ 7-9 ชั่วโมงอย่างสม่ำเสมอมีความสำคัญต่อการฟื้นฟูสมองและซ่อมแซม DNA</>
              ) : (
                <><strong>Science:</strong> Consistent 7-9 hours of sleep is crucial for cognitive preservation and DNA repair.</>
              )}
            </p>
          </div>
        </div>

        {/* Activity Goal */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content', border: '1px solid var(--border-glass)' }}>
          <div className="flex justify-between items-center mb-4">
            <div className="section-header">
              <span className="section-icon"><FaRunning /></span>
              <span className="section-title font-bold" style={{ color: 'var(--text-primary)' }}>{isTh ? 'เวลาออกกำลังกาย' : 'Active Minutes'}</span>
            </div>
            <span className="text-xs font-bold px-2 py-1 rounded-lg" style={{ background: 'var(--surface-soft)', color: 'var(--color-primary, #3b82f6)' }}>{activityGoal} {isTh ? 'นาที' : 'min'}</span>
          </div>
          {/* One control: the range paints its own filled track (.sg-range)
              rather than stacking a second progress bar under it. */}
          <input
            type="range" min="15" max="120" step="5"
            className="sg-range"
            style={{ '--sg-pct': `${activityPct}%` } as React.CSSProperties}
            aria-label={isTh ? 'เวลาออกกำลังกาย' : 'Active Minutes'}
            value={activityGoal}
            onChange={(e) => setActivityGoal(parseInt(e.target.value))}
          />
          <div className="flex justify-between text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
            <span>15 {isTh ? 'นาที' : 'm'}</span>
            <span>{isTh ? '45+ นาที (ปานกลาง)' : '45m+ (Moderate)'}</span>
            <span>120 {isTh ? 'นาที' : 'm'}</span>
          </div>
          <div className="mt-4 p-3 rounded-xl border" style={{ background: 'var(--surface-soft)', borderColor: 'var(--border-glass)' }}>
            <p className="text-sm leading-tight" style={{ color: 'var(--text-secondary)' }}>
              {isTh ? (
                <><strong>ผลลัพธ์:</strong> ออกกำลังกายระดับปานกลาง 150+ นาทีต่อสัปดาห์ช่วยรักษาสมดุลระบบเผาผลาญและสุขภาพหัวใจ</>
              ) : (
                <><strong>Impact:</strong> Target 150+ minutes of moderate activity per week to maintain metabolic health.</>
              )}
            </p>
          </div>
        </div>

        <button
          type="button"
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-blue-700 to-blue-800 text-white font-black text-sm active:scale-[0.98] transition-all"
          style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', boxShadow: '0 8px 24px rgba(25,118,210,0.30)' }}
          onClick={saveGoals}
          disabled={saveState === 'saved'}
        >
          {saveState === 'saved' ? <FaCheckCircle aria-hidden="true" /> : <FaBolt aria-hidden="true" />}
          {isTh ? 'บันทึกเป้าหมายของฉัน' : 'Save My Strategy'}
        </button>

        {saveState !== 'idle' && (
          <p
            role="status"
            className="text-sm font-bold text-center"
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 12,
              color: saveState === 'saved' ? 'var(--color-success, #10B981)' : 'var(--color-danger, #EF4444)',
              background: saveState === 'saved' ? 'rgba(16,185,129,0.12)' : 'var(--color-danger-soft, rgba(239,68,68,0.12))',
            }}
          >
            {saveState === 'saved' ? t('setGoals.saved') : t('setGoals.saveFailed')}
          </p>
        )}
      </div>

      <BottomNav
        active="profile"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
      />
    </div>
  );
};
