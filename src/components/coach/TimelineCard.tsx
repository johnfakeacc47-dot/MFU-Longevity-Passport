import React from 'react';
import { FaClock } from 'react-icons/fa';
import type { TimelineEvent } from '../../utils/healthCoach';

interface TimelineCardProps {
  events: TimelineEvent[];
  t: (key: string) => string;
}

const PILLAR_COLORS: Record<string, string> = {
  nutrition: '#10B981',
  exercise: '#F59E0B',
  sleep: '#6366F1',
  mental: '#8B5CF6',
};

export const TimelineCard: React.FC<TimelineCardProps> = ({ events, t }) => {
  return (
    <section className="coach-card timeline-card">
      <div className="timeline-header">
        <div className="timeline-header-left">
          <FaClock className="timeline-icon" />
          <h3 className="coach-card-title">{t('timeline.title')}</h3>
        </div>
        <span className="timeline-count">{events.length}</span>
      </div>

      {events.length === 0 ? (
        <div className="timeline-empty-box">
          <p className="timeline-empty-text">{t('timeline.empty')}</p>
        </div>
      ) : (
        <div className="timeline-list">
          {events.map((ev, idx) => {
            const color = PILLAR_COLORS[ev.pillar] || '#3B82F6';
            return (
              <div key={ev.id} className="timeline-item">
                <div className="timeline-line-col">
                  <div className="timeline-dot" style={{ backgroundColor: color }}>
                    <span className="timeline-emoji">{ev.icon}</span>
                  </div>
                  {idx < events.length - 1 && <div className="timeline-connector" />}
                </div>
                <div className="timeline-content">
                  <div className="timeline-top-row">
                    <span className="timeline-item-title">{ev.title}</span>
                    <span className="timeline-time">{ev.time}</span>
                  </div>
                  <span className="timeline-detail">{ev.detail}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
