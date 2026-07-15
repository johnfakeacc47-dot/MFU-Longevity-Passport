import React from 'react';
import { FaCheckCircle, FaRegCircle, FaFire, FaTrophy, FaUtensils, FaDumbbell, FaBed, FaBrain } from 'react-icons/fa';
import type { DailyGoalsResult, DailyGoalItem } from '../../utils/healthCoach';

interface DailyGoalsCardProps {
  goals: DailyGoalsResult;
  streakDays: number;
  onNavigate: (page: any) => void;
  onOpenFoodRecognition: () => void;
  t: (key: string) => string;
}

const PILLAR_ICONS = {
  nutrition: FaUtensils,
  exercise: FaDumbbell,
  sleep: FaBed,
  mental: FaBrain,
};

const PILLAR_COLORS = {
  nutrition: '#10B981',
  exercise: '#F59E0B',
  sleep: '#6366F1',
  mental: '#8B5CF6',
};

const PILLAR_NAV = {
  nutrition: null,
  exercise: 'activity',
  sleep: 'sleep',
  mental: 'mental-health',
};

export const DailyGoalsCard: React.FC<DailyGoalsCardProps> = ({
  goals,
  streakDays,
  onNavigate,
  onOpenFoodRecognition,
  t,
}) => {
  const { items, completedCount, totalCount, isAllCompleted } = goals;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  const handleItemClick = (item: DailyGoalItem) => {
    if (item.id === 'nutrition') {
      onOpenFoodRecognition();
    } else {
      const navTarget = PILLAR_NAV[item.id];
      if (navTarget) onNavigate(navTarget as any);
    }
  };

  return (
    <section className="coach-card daily-goals-card">
      <div className="goals-header">
        <div className="goals-header-left">
          <FaTrophy className="goals-icon" />
          <div>
            <h3 className="coach-card-title">{t('goal.todayTitle')}</h3>
            <span className="coach-card-subtitle">{completedCount} / {totalCount} {t('home.todayLongevityScore').split(' ')[0]}</span>
          </div>
        </div>
        <div className="streak-pill">
          <FaFire className="streak-flame" />
          <span className="streak-text">{streakDays} {t('streak.days')}</span>
        </div>
      </div>

      <div className="goals-progress-bar">
        <div className="goals-progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      {isAllCompleted ? (
        <div className="goals-congrats-banner">
          <FaCheckCircle className="congrats-icon" />
          <p className="congrats-text">{t('goal.completedCongrats')}</p>
        </div>
      ) : null}

      <div className="goals-list">
        {items.map(item => {
          const Icon = PILLAR_ICONS[item.id];
          const color = PILLAR_COLORS[item.id];

          return (
            <button
              key={item.id}
              className={`goal-item ${item.completed ? 'goal-completed' : ''}`}
              onClick={() => handleItemClick(item)}
            >
              <div className="goal-item-left">
                <div className="goal-checkbox" style={{ color: item.completed ? color : '#9CA3AF' }}>
                  {item.completed ? <FaCheckCircle /> : <FaRegCircle />}
                </div>
                <div className="goal-icon-wrap" style={{ backgroundColor: `${color}15` }}>
                  <Icon style={{ color }} />
                </div>
                <div className="goal-info">
                  <span className="goal-title">{t(item.titleKey)}</span>
                  <span className="goal-target">{t(item.targetTextKey)}</span>
                </div>
              </div>
              <div className="goal-item-right">
                {item.currentText && (
                  <span className={`goal-val ${item.completed ? 'val-done' : ''}`}>
                    {item.currentText}
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
};
