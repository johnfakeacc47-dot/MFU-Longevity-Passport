import React from 'react';
import { FaTrophy, FaCheckCircle, FaRunning, FaBed, FaUtensils, FaBrain } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getWeeklyChallenges } from '../../utils/healthCoach';
import '../../styles/Coach.css';

export const WeeklyChallengesCard: React.FC = () => {
  const { t } = useLanguage();
  const challenges = getWeeklyChallenges();

  const getChallengeIcon = (id: string) => {
    switch (id) {
      case 'ex150': return <FaRunning style={{ color: '#F59E0B' }} />;
      case 'sleep23': return <FaBed style={{ color: '#3B82F6' }} />;
      case 'cal5d': return <FaUtensils style={{ color: '#10B981' }} />;
      case 'mental7d': return <FaBrain style={{ color: '#8B5CF6' }} />;
      default: return <FaTrophy style={{ color: '#EAB308' }} />;
    }
  };

  const completedCount = challenges.filter(c => c.completed).length;

  return (
    <div className="coach-card challenges-card">
      <div className="coach-card-header">
        <div className="coach-card-title-row">
          <span className="coach-card-icon" style={{ color: '#EAB308', background: 'rgba(234, 179, 8, 0.12)' }}>
            <FaTrophy />
          </span>
          <div>
            <h3 className="coach-card-title">{t('challenge.title')}</h3>
            <p className="coach-card-subtitle">
              {completedCount} / {challenges.length} {t('common.recorded')}
            </p>
          </div>
        </div>
      </div>

      <div className="challenges-list">
        {challenges.map((item) => (
          <div key={item.id} className={`challenge-item ${item.completed ? 'is-completed' : ''}`}>
            <div className="challenge-icon-wrap">
              {getChallengeIcon(item.id)}
            </div>

            <div className="challenge-content">
              <div className="challenge-top-row">
                <span className="challenge-title">{t(item.titleKey)}</span>
                <span className="challenge-status">
                  {item.completed ? (
                    <span className="completed-badge"><FaCheckCircle /> {t('common.recorded')}</span>
                  ) : (
                    <span className="progress-num">
                      {item.currentVal} / {item.targetVal} {t(item.unitKey)}
                    </span>
                  )}
                </span>
              </div>

              <p className="challenge-desc">{t(item.descKey)}</p>

              <div className="challenge-bar-bg">
                <div
                  className="challenge-bar-fill"
                  style={{
                    width: `${item.progress}%`,
                    backgroundColor: item.completed ? '#10B981' : '#EAB308',
                  }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
