import React, { useState, useEffect } from 'react';
import {
  FaBrain, FaSmile, FaMeh, FaFrown, FaAngry, FaGrinStars,
  FaBolt, FaLeaf, FaChevronLeft, FaCheckCircle, FaTrash,
} from 'react-icons/fa';
import { BottomNav } from '../components/BottomNav';
import { useLanguage } from '../contexts/LanguageContext';
import { getPillarStatusKey } from '../utils/longevityScore';
import type { MentalLog } from '../utils/longevityScore';
import { MoodHistoryCard } from '../components/coach/MoodHistoryCard';
import '../styles/MentalHealth.css';

type PageType = 'home' | 'profile' | 'team' | 'eating' | 'dashboard' | 'activity' | 'sleep' | 'mental-health' | 'eating-food-log' | 'eating-macros' | 'eating-water' | 'eating-schedule' | 'eating-history';

interface MentalHealthProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

type MoodType = MentalLog['mood'];

// Mood icon config — labels handled via i18n
const MOOD_OPTIONS: { value: MoodType; labelKey: string; icon: React.ElementType; color: string; bg: string }[] = [
  { value: 'great',   labelKey: 'mental.moodGreat',   icon: FaGrinStars, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
  { value: 'good',    labelKey: 'mental.moodGood',    icon: FaSmile,     color: '#22C55E', bg: 'rgba(34,197,94,0.12)'  },
  { value: 'neutral', labelKey: 'mental.moodNeutral', icon: FaMeh,       color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
  { value: 'bad',     labelKey: 'mental.moodBad',     icon: FaFrown,     color: '#F97316', bg: 'rgba(249,115,22,0.12)' },
  { value: 'awful',   labelKey: 'mental.moodAwful',   icon: FaAngry,     color: '#EF4444', bg: 'rgba(239,68,68,0.12)'  },
];

function calcMentalScore(log: MentalLog): number {
  const moodMap: Record<MoodType, number> = { great: 10, good: 8, neutral: 6, bad: 3, awful: 0 };
  const moodScore   = moodMap[log.mood];
  const stressScore = Math.round(((10 - log.stress) / 9) * 8);
  const energyScore = Math.round((log.energy / 10) * 7);
  return Math.min(25, moodScore + stressScore + energyScore);
}

const SliderRow: React.FC<{
  label: string; sublabel: string; value: number;
  min: number; max: number; color: string;
  icon: React.ElementType;
  onChange: (v: number) => void;
  lowLabel: string; midLabel: string; highLabel: string;
}> = ({ label, sublabel, value, min, max, color, icon: Icon, onChange, lowLabel, midLabel, highLabel }) => {
  const pct = ((value - min) / (max - min)) * 100;
  const levelLabel = value <= 3 ? `${value} ${lowLabel}` : value <= 6 ? `${value} ${midLabel}` : `${value} ${highLabel}`;
  return (
    <div className="mh-slider-row">
      <div className="mh-slider-header">
        <div className="mh-slider-left">
          <div className="mh-slider-icon-wrap" style={{ background: `${color}14` }}>
            <Icon className="mh-slider-icon" style={{ color }} />
          </div>
          <div>
            <div className="mh-slider-label">{label}</div>
            <div className="mh-slider-sub">{sublabel}</div>
          </div>
        </div>
        <span className="mh-slider-value" style={{ color }}>{levelLabel}</span>
      </div>
      <div className="mh-slider-track-wrap">
        <input
          type="range" min={min} max={max} value={value}
          className="mh-slider-input"
          style={{ '--slider-pct': `${pct}%`, '--slider-color': color } as React.CSSProperties}
          onChange={e => onChange(Number(e.target.value))}
        />
      </div>
      <div className="mh-slider-ticks">
        <span>{min}</span>
        <span>{Math.round((min + max) / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
};

export const MentalHealth: React.FC<MentalHealthProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t, language } = useLanguage();
  const [mood,   setMood]   = useState<MoodType>('neutral');
  const [stress, setStress] = useState(5);
  const [energy, setEnergy] = useState(6);
  const [note,   setNote]   = useState('');
  const [saved,  setSaved]  = useState(false);
  const [todayLog, setTodayLog] = useState<MentalLog | null>(null);

  useEffect(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ts    = today.getTime();
    const logs: MentalLog[] = JSON.parse(localStorage.getItem('mentalLogs') || '[]');
    const existing = logs.find(l => new Date(l.timestamp).getTime() >= ts);
    if (existing) {
      setTodayLog(existing);
      setMood(existing.mood);
      setStress(existing.stress);
      setEnergy(existing.energy);
      setNote(existing.note || '');
      setSaved(true);
    }
  }, []);

  const previewScore = calcMentalScore({ mood, stress, energy, timestamp: '' });
  const { labelKey: statusLabelKey, color: statusColor } = getPillarStatusKey(previewScore);

  const handleSave = () => {
    const log: MentalLog = {
      mood, stress, energy,
      note: note.trim() || undefined,
      timestamp: new Date().toISOString(),
    };
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ts    = today.getTime();
    const logs: MentalLog[] = JSON.parse(localStorage.getItem('mentalLogs') || '[]');
    const filtered = logs.filter(l => new Date(l.timestamp).getTime() < ts);
    localStorage.setItem('mentalLogs', JSON.stringify([log, ...filtered]));
    setTodayLog(log);
    setSaved(true);
    window.dispatchEvent(new Event('healthDataUpdated'));
    window.dispatchEvent(new Event('storage'));
  };

  const handleDelete = () => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const ts    = today.getTime();
    const logs: MentalLog[] = JSON.parse(localStorage.getItem('mentalLogs') || '[]');
    const filtered = logs.filter(l => new Date(l.timestamp).getTime() < ts);
    localStorage.setItem('mentalLogs', JSON.stringify(filtered));
    setTodayLog(null);
    setSaved(false);
    setMood('neutral');
    setStress(5);
    setEnergy(6);
    setNote('');
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  // AI Insight text — bilingual
  const aiInsightText = () => {
    if (language === 'th') {
      if (mood === 'great' || mood === 'good') {
        return `อารมณ์ดีมากวันนี้! ลองจับคู่กับ${energy >= 7 ? 'การออกกำลังกาย' : 'การเดินสั้นๆ'} เพื่อเพิ่มพลังให้คะแนนสุขภาพโดยรวม`;
      } else if (mood === 'neutral') {
        return stress > 6
          ? 'ระดับความเครียดค่อนข้างสูง ลองหายใจลึกๆ 5 นาทีหรือเดินออกไปรับอากาศบริสุทธิ์สักครู่'
          : 'วันที่พอดีๆ แค่การขอบคุณเล็กๆ น้อยๆ ก็สามารถเปลี่ยนอารมณ์ได้เสมอ';
      } else {
        return 'วันที่ยากลำบาก — ไม่เป็นไร การนอนหลับพักผ่อนที่ดีคืนนี้คือสิ่งที่ทรงพลังที่สุดสำหรับการฟื้นฟูร่างกายและจิตใจ';
      }
    } else {
      if (mood === 'great' || mood === 'good') {
        return `Great mood today! Pair it with a ${energy >= 7 ? 'workout' : 'short walk'} to amplify the positive effects on your longevity score.`;
      } else if (mood === 'neutral') {
        return stress > 6
          ? 'Your stress level is elevated. Try 5 minutes of deep breathing or a short walk to reset.'
          : 'A balanced day. Even small acts of gratitude can shift mood over time.';
      } else {
        return "Tough day — that's okay. Quality sleep tonight is the most powerful recovery tool you have.";
      }
    }
  };

  const selectedMood = MOOD_OPTIONS.find(m => m.value === mood)!;

  const dateStr = new Date().toLocaleDateString(
    language === 'th' ? 'th-TH' : 'en-US',
    { weekday: 'short', month: 'short', day: 'numeric' },
  );

  return (
    <div className="mental-health-page">

      {/* ── Header ── */}
      <header className="mh-header">
        <button className="mh-back-btn" onClick={() => onNavigate('home')} aria-label={t('common.back')}>
          <FaChevronLeft />
        </button>
        <div className="mh-header-center">
          <h1 className="mh-header-title">{t('mental.title')}</h1>
          <p className="mh-header-sub">{dateStr}</p>
        </div>
        <div className="mh-header-score-badge">
          <span className="mh-header-score-num" style={{ color: statusColor }}>{previewScore}</span>
          <span className="mh-header-score-denom">/25</span>
        </div>
      </header>

      <div className="mh-content page-content">

        {/* ── Score preview ── */}
        <div className="mh-score-card mh-card">
          <div className="mh-score-top">
            <div className="mh-score-icon-wrap">
              <FaBrain className="mh-score-icon" />
            </div>
            <div>
              <div className="mh-score-title">{t('mental.score')}</div>
              <div className="mh-score-status" style={{ color: statusColor }}>{t(statusLabelKey)}</div>
            </div>
          </div>
          <div className="mh-score-ring-row">
            <span className="mh-score-number" style={{ color: statusColor }}>{previewScore}</span>
            <span className="mh-score-max">/25</span>
          </div>
          <div className="mh-score-bar-track">
            <div className="mh-score-bar-fill" style={{ width: `${(previewScore / 25) * 100}%`, background: statusColor }} />
          </div>
          {saved && todayLog && (
            <div className="mh-saved-chip">
              <FaCheckCircle className="mh-saved-icon" />
              {t('mental.recordedToday')}
            </div>
          )}
        </div>

        {/* ── Mood Selector ── */}
        <div className="mh-card">
          <h2 className="mh-card-title">{t('mental.howFeeling')}</h2>
          <div className="mh-mood-grid">
            {MOOD_OPTIONS.map(opt => {
              const Icon = opt.icon;
              const isActive = mood === opt.value;
              return (
                <button
                  key={opt.value}
                  className={`mh-mood-btn ${isActive ? 'mh-mood-btn--active' : ''}`}
                  style={isActive ? { background: opt.bg, borderColor: opt.color } : {}}
                  onClick={() => { setMood(opt.value); setSaved(false); }}
                  aria-label={t(opt.labelKey)}
                  aria-pressed={isActive}
                >
                  <Icon className="mh-mood-icon" style={{ color: isActive ? opt.color : undefined }} />
                  <span className="mh-mood-label" style={{ color: isActive ? opt.color : undefined }}>
                    {t(opt.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Sliders ── */}
        <div className="mh-card">
          <h2 className="mh-card-title">{t('mental.rateDay')}</h2>
          <div className="mh-sliders">
            <SliderRow
              label={t('mental.stressLevel')}
              sublabel={t('mental.stressSub')}
              value={stress} min={1} max={10} color="#EF4444"
              icon={FaBolt}
              onChange={v => { setStress(v); setSaved(false); }}
              lowLabel={t('mental.stressLow')}
              midLabel={t('common.moderate')}
              highLabel={t('mental.stressHigh')}
            />
            <SliderRow
              label={t('mental.energyLevel')}
              sublabel={t('mental.energySub')}
              value={energy} min={1} max={10} color="#10B981"
              icon={FaLeaf}
              onChange={v => { setEnergy(v); setSaved(false); }}
              lowLabel={t('common.low')}
              midLabel={t('common.moderate')}
              highLabel={t('common.high')}
            />
          </div>
        </div>

        {/* ── Journal Note ── */}
        <div className="mh-card">
          <h2 className="mh-card-title">
            {t('mental.journal')} <span className="mh-optional">({t('mental.optional')})</span>
          </h2>
          <textarea
            className="mh-journal-input"
            placeholder={t('mental.journalPlaceholder')}
            value={note}
            rows={3}
            onChange={e => { setNote(e.target.value); setSaved(false); }}
          />
        </div>

        {/* ── AI Tip ── */}
        <div className="mh-card mh-ai-card">
          <div className="mh-ai-header">
            <div className="mh-ai-badge">AI</div>
            <span className="mh-ai-label">{t('mental.aiInsight')}</span>
          </div>
          <p className="mh-ai-text">{aiInsightText()}</p>
        </div>

        {/* ── Mood History (7D) ── */}
        <MoodHistoryCard />

        {/* ── Actions ── */}
        <div className="mh-actions">
          <button
            className="mh-save-btn"
            onClick={handleSave}
            style={{ background: selectedMood.color }}
          >
            <selectedMood.icon className="mh-save-btn-icon" />
            {saved ? t('mental.update') : t('mental.save')}
          </button>
          {saved && (
            <button className="mh-delete-btn" onClick={handleDelete} aria-label={t('common.delete')}>
              <FaTrash />
            </button>
          )}
        </div>

      </div>

      <BottomNav
        active="home"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
      />
    </div>
  );
};
