import React, { useState, useEffect } from 'react';
import { FaBicycle, FaChartBar, FaCircle, FaDumbbell, FaFire, FaRunning, FaStopwatch, FaSwimmer, FaTimes, FaTrash, FaWalking, FaYinYang } from 'react-icons/fa';
import { BottomNav } from '../components/BottomNav';

import { useLanguage } from '../contexts/LanguageContext';
import { healthApi, isApiConfigured } from '../services/healthApi';
import { BackButton } from '../components/BackButton';

type PageType = 'home' | 'profile' | 'team' | 'fasting' | 'dashboard' | 'activity' | 'sleep';

interface ActivityProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

interface ActivityLog {
  id: number | string;
  type: string;
  duration: number;
  caloriesBurned: number;
  timestamp: string;
  date: string;
}

interface ActivityType {
  type: string;
  icon: React.ReactNode;
  caloriesPerMin: number;
  name: string;
}

export const Activity: React.FC<ActivityProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState('');
  const [duration, setDuration] = useState(30);
  const [todayTotal, setTodayTotal] = useState({ minutes: 0, calories: 0 });

  useEffect(() => {
    loadActivities();
  }, []);

  useEffect(() => {
    calculateTodayTotal();
  }, [activities]);

  async function loadActivities() {
    if (isApiConfigured) {
      try {
        const to = new Date();
        const from = new Date();
        from.setDate(to.getDate() - 30);
        const data = await healthApi.getActivityHistory(
          from.toISOString(),
          to.toISOString(),
        );
        const normalized = (Array.isArray(data) ? data : []).map((item) => ({
          id: item.id,
          type: item.type,
          duration: item.duration,
          caloriesBurned: item.caloriesBurned || 0,
          timestamp: item.createdAt,
          date: new Date(item.createdAt).toLocaleDateString('th-TH'),
        }));
        setActivities(normalized);
        return;
      } catch (error) {
        console.error('Failed to load activities from API', error);
      }
    }

    const saved = localStorage.getItem('activities');
    if (saved) {
      setActivities(JSON.parse(saved));
    }
  }

  function calculateTodayTotal() {
    const today = new Date().toDateString();
    const todayActivities = activities.filter(
      a => new Date(a.timestamp).toDateString() === today
    );
    const minutes = todayActivities.reduce((sum, a) => sum + a.duration, 0);
    const calories = todayActivities.reduce((sum, a) => sum + a.caloriesBurned, 0);
    setTodayTotal({ minutes, calories });
  }

  const activityTypes: ActivityType[] = [
    { type: 'walking', icon: <FaWalking />, caloriesPerMin: 4, name: t('activity.walking') },
    { type: 'running', icon: <FaRunning />, caloriesPerMin: 10, name: t('activity.running') },
    { type: 'cycling', icon: <FaBicycle />, caloriesPerMin: 8, name: t('activity.cycling') },
    { type: 'strength', icon: <FaDumbbell />, caloriesPerMin: 6, name: t('activity.strength') },
    { type: 'yoga', icon: <FaYinYang />, caloriesPerMin: 3, name: t('activity.yoga') },
    { type: 'swimming', icon: <FaSwimmer />, caloriesPerMin: 11, name: t('activity.swimming') },
  ];

  const openActivityModal = (type: string) => {
    setSelectedActivity(type);
    setDuration(30);
    setShowModal(true);
  };

  const logActivity = async () => {
    if (!selectedActivity) return;

    const activityType = activityTypes.find(a => a.type === selectedActivity);
    if (!activityType) return;

    const caloriesBurned = Math.round(activityType.caloriesPerMin * duration);
    
    const newActivity: ActivityLog = {
      id: Date.now(),
      type: selectedActivity,
      duration,
      caloriesBurned,
      timestamp: new Date().toISOString(),
      date: new Date().toLocaleDateString('th-TH'),
    };

    const updatedActivities = [newActivity, ...activities];
    setActivities(updatedActivities);
    localStorage.setItem('activities', JSON.stringify(updatedActivities));

    try {
      await healthApi.logActivity({
        type: selectedActivity,
        duration,
        caloriesBurned,
      });
      // Trigger score refresh after successful API call
      window.dispatchEvent(new Event('healthDataUpdated'));
    } catch (error) {
      console.error('Failed to sync activity to API', error);
      // Still trigger refresh for localStorage fallback
      window.dispatchEvent(new Event('healthDataUpdated'));
    }

    setShowModal(false);
    setSelectedActivity('');
  };

  const deleteActivity = (id: number | string) => {
    const updatedActivities = activities.filter(a => a.id !== id);
    setActivities(updatedActivities);
    localStorage.setItem('activities', JSON.stringify(updatedActivities));
    window.dispatchEvent(new Event('healthDataUpdated'));
  };

  const getActivityIcon = (type: string) => activityTypes.find(a => a.type === type)?.icon || <FaRunning />;

  const getActivityName = (type: string) => {
    return activityTypes.find(a => a.type === type)?.name || type;
  };

  return (
    <div className="activity-page">
      <div className="activity-header">
        <BackButton onClick={() => onNavigate('home')} ariaLabel={t('activity.back')} />
        <h1>{t('activity.title')}</h1>
      </div>

      <div className="activity-content page-content">

      {/* Today's Summary */}
      <div className="today-summary">
        <div className="summary-card">
          <div className="summary-icon"><FaStopwatch /></div>
          <div className="summary-content">
            <div className="summary-value">{todayTotal.minutes}</div>
            <div className="summary-label">{t('activity.minutesToday')}</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon"><FaFire /></div>
          <div className="summary-content">
            <div className="summary-value">{todayTotal.calories}</div>
            <div className="summary-label">{t('activity.caloriesBurned')}</div>
          </div>
        </div>
      </div>

      {/* Quick Log Buttons */}
      <div className="quick-log-section">
        <h2>{t('activity.quickLog')}</h2>
        <div className="activity-grid">
          {activityTypes.map((activity) => (
            <button
              key={activity.type}
              className="activity-btn"
              onClick={() => openActivityModal(activity.type)}
            >
              <div className="activity-icon">{activity.icon}</div>
              <div className="activity-name">{activity.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Activity History */}
      <div className="activity-history">
        <h2>{t('activity.history')}</h2>
        {activities.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon"><FaChartBar /></div>
            <p>{t('activity.noActivities')}</p>
          </div>
        ) : (
          <div className="activity-list">
            {activities.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div className="activity-item-icon">
                  {getActivityIcon(activity.type)}
                </div>
                <div className="activity-item-content">
                  <div className="activity-item-header">
                    <span className="activity-item-name">
                      {getActivityName(activity.type)}
                    </span>
                    <span className="activity-item-date">
                      {new Date(activity.timestamp).toLocaleTimeString('th-TH', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                  <div className="activity-item-details">
                    <span>{activity.duration} {t('activity.minutes')}</span>
                    <span><FaCircle size={6} aria-hidden="true" /></span>
                    <span>{activity.caloriesBurned} {t('activity.kcal')}</span>
                  </div>
                </div>
                <button
                  className="delete-activity-btn"
                  onClick={() => deleteActivity(activity.id)}
                >
                  <FaTrash />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>

      {/* Activity Modal */}
      {showModal && (
        <div className="activity-modal-overlay">
          <div className="activity-modal">
            <div className="modal-header">
              <h3>{t('activity.logActivity')}</h3>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <FaTimes aria-hidden="true" />
              </button>
            </div>
            <div className="modal-content">
              <div className="activity-type-display">
                <span className="activity-type-icon">
                  {getActivityIcon(selectedActivity)}
                </span>
                <span className="activity-type-name">
                  {getActivityName(selectedActivity)}
                </span>
              </div>

              <div className="duration-input">
                <label>{t('activity.duration')}</label>
                <div className="duration-slider">
                  <input
                    type="range"
                    min="5"
                    max="180"
                    step="5"
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                  />
                  <div className="duration-value">{duration} {t('activity.minutes')}</div>
                </div>
              </div>

              <div className="calories-estimate">
                <span className="estimate-label">{t('activity.estimatedCalories')}:</span>
                <span className="estimate-value">
                  {Math.round((activityTypes.find(a => a.type === selectedActivity)?.caloriesPerMin || 5) * duration)} {t('activity.kcal')}
                </span>
              </div>

              <button className="log-btn" onClick={logActivity}>
                {t('activity.logButton')}
              </button>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="dashboard" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
