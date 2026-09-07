import React, { useState, useEffect } from 'react';
import { FaGrinStars, FaSmile, FaMeh, FaFrown, FaAngry, FaHistory, FaBrain } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getMoodHistory } from '../../utils/healthCoach';
import type { MoodHistoryItem } from '../../utils/healthCoach';
import '../../styles/Coach.css';

export const MoodHistoryCard: React.FC = () => {
  const { t } = useLanguage();
  const [history, setHistory] = useState<MoodHistoryItem[]>([]);

  useEffect(() => {
    // getMoodHistory already reads from mentalLogs and sorts them by date descending
    setHistory(getMoodHistory().slice(0, 7));
  }, []);

  const getMoodIcon = (mood: string) => {
    switch (mood) {
      case 'great': return <FaGrinStars style={{ color: '#10B981' }} />;
      case 'good': return <FaSmile style={{ color: '#22C55E' }} />;
      case 'neutral': return <FaMeh style={{ color: '#F59E0B' }} />;
      case 'bad': return <FaFrown style={{ color: '#F97316' }} />;
      case 'awful': return <FaAngry style={{ color: '#EF4444' }} />;
      default: return <FaMeh style={{ color: '#F59E0B' }} />;
    }
  };

  const getMoodLabel = (mood: string) => {
    switch (mood) {
      case 'great': return t('mental.moodGreat');
      case 'good': return t('mental.moodGood');
      case 'neutral': return t('mental.moodNeutral');
      case 'bad': return t('mental.moodBad');
      case 'awful': return t('mental.moodAwful');
      default: return mood;
    }
  };

  const calcScore = (log: MoodHistoryItem) => {
    const moodMap: Record<string, number> = { great: 10, good: 8, neutral: 6, bad: 3, awful: 0 };
    const moodScore = moodMap[log.mood] ?? 6;
    const stressScore = Math.round(((10 - log.stress) / 9) * 8);
    const energyScore = Math.round((log.energy / 10) * 7);
    return Math.min(25, moodScore + stressScore + energyScore);
  };

  return (
    <div className="coach-card mood-history-card">
      <div className="coach-card-header">
        <div className="coach-card-title-row">
          <span className="coach-card-icon" style={{ color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.14)' }}>
            <FaHistory />
          </span>
          <div>
            <h3 className="coach-card-title">{t('mental.title')} History (7D)</h3>
            <p className="coach-card-subtitle">{history.length} {t('common.recorded')}</p>
          </div>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="mood-empty-box">
          <FaBrain style={{ fontSize: 24, color: '#9CA3AF' }} />
          <p>{t('timeline.noLogs')}</p>
        </div>
      ) : (
        <div className="mood-history-list">
          {history.map((log) => {
            const isToday = new Date(log.timestamp).toISOString().split('T')[0] === new Date().toISOString().split('T')[0];
            const dateLabel = isToday ? t('common.today') : log.dateStr;

            return (
              <div key={log.id} className="mood-history-item">
                <div className="mood-item-icon">
                  {getMoodIcon(log.mood)}
                </div>
                <div className="mood-item-content">
                  <div className="mood-item-top">
                    <span className="mood-item-date">{dateLabel}</span>
                    <span className="mood-item-score">{calcScore(log)} / 25</span>
                  </div>
                  <div className="mood-item-label">{getMoodLabel(log.mood)}</div>
                  {log.note && <p className="mood-item-note">"{log.note}"</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
