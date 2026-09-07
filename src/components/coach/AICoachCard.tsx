import React from 'react';
import { FaRobot, FaStar, FaCheck, FaExclamationCircle } from 'react-icons/fa';
import type { AICoachAdvice } from '../../utils/healthCoach';

interface AICoachCardProps {
  advice: AICoachAdvice;
  t: (key: string) => string;
}

const PILLAR_COLORS: Record<string, string> = {
  nutrition: '#10B981',
  exercise: '#F59E0B',
  sleep: '#6366F1',
  mental: '#8B5CF6',
};

export const AICoachCard: React.FC<AICoachCardProps> = ({ advice, t }) => {
  const { summaryTitle, summaryText, recommendations } = advice;

  return (
    <section className="coach-card ai-coach-card">
      <div className="coach-header">
        <div className="coach-header-left">
          <div className="coach-avatar">
            <FaRobot className="coach-robot-icon" />
          </div>
          <div>
            <div className="coach-title-row">
              <h3 className="coach-card-title">{summaryTitle}</h3>
              <span className="ai-coach-badge">
                <FaStar className="badge-sparkle" /> {t('coach.badge')}
              </span>
            </div>
            <p className="coach-summary-text">{summaryText}</p>
          </div>
        </div>
      </div>

      <div className="coach-recommendations-list">
        {recommendations.map((rec, idx) => {
          const color = PILLAR_COLORS[rec.pillar] || '#3B82F6';
          const isPraise = rec.type === 'praise';

          return (
            <div
              key={idx}
              className={`coach-rec-item ${isPraise ? 'rec-praise' : 'rec-action'}`}
              style={{ borderLeftColor: color }}
            >
              <div className="rec-icon" style={{ color: isPraise ? '#10B981' : '#F59E0B' }}>
                {isPraise ? <FaCheck /> : <FaExclamationCircle />}
              </div>
              <div className="rec-content">
                <span className="rec-pillar-tag" style={{ color, backgroundColor: `${color}18` }}>
                  {t(`home.${rec.pillar}`)}
                </span>
                <p className="rec-text">{rec.text}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
