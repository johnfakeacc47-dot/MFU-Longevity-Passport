import React, { useState, useEffect } from 'react';
import { FaTint, FaPlus, FaMinus, FaCheckCircle } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getTodayWater, saveTodayWater } from '../../utils/healthCoach';
import '../../styles/Coach.css';

export const WaterTrackerCard: React.FC = () => {
  const { t } = useLanguage();
  const [glasses, setGlasses] = useState<number>(0);
  const [target, setTarget] = useState<number>(8);

  useEffect(() => {
    const todayLog = getTodayWater();
    setGlasses(todayLog.glasses);
    setTarget(Math.round(todayLog.targetMl / 250) || 8);
  }, []);

  const handleUpdate = (newVal: number) => {
    const clamped = Math.max(0, Math.min(20, newVal));
    const diff = clamped - glasses;
    saveTodayWater(diff);
    setGlasses(clamped);
  };

  const progress = Math.min(100, Math.round((glasses / target) * 100));

  return (
    <div className="coach-card water-card">
      <div className="coach-card-header">
        <div className="coach-card-title-row">
          <span className="coach-card-icon" style={{ color: '#06B6D4', background: 'rgba(6, 182, 212, 0.14)' }}>
            <FaTint />
          </span>
          <div>
            <h3 className="coach-card-title">{t('water.title')}</h3>
            <p className="coach-card-subtitle">{t('water.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="water-content">
        <div className="water-main-display">
          <div className="water-count-box">
            <span className="water-num">{glasses}</span>
            <span className="water-target">/ {target} {t('water.glasses')}</span>
          </div>
          <span className="water-ml-approx">~{glasses * 250} ml</span>
        </div>

        <div className="water-progress-track">
          <div
            className="water-progress-fill"
            style={{ width: `${progress}%`, backgroundColor: '#06B6D4' }}
          />
        </div>

        <div className="water-glasses-row">
          {Array.from({ length: target }).map((_, idx) => (
            <button
              key={idx}
              type="button"
              className={`water-glass-dot ${idx < glasses ? 'filled' : ''}`}
              onClick={() => handleUpdate(idx + 1)}
              title={`Set to ${idx + 1} glasses`}
            >
              <FaTint />
            </button>
          ))}
        </div>

        <div className="water-controls">
          <button
            type="button"
            className="water-btn minus"
            onClick={() => handleUpdate(glasses - 1)}
            disabled={glasses <= 0}
          >
            <FaMinus />
          </button>
          <button
            type="button"
            className="water-btn plus"
            onClick={() => handleUpdate(glasses + 1)}
          >
            <FaPlus /> <span>+1 {t('water.glasses')}</span>
          </button>
        </div>

        {glasses >= target && (
          <div className="water-congrats">
            <FaCheckCircle style={{ color: '#06B6D4' }} />
            <span>{t('goal.congrats')}</span>
          </div>
        )}
      </div>
    </div>
  );
};
