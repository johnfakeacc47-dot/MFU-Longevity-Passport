import React, { useEffect, useState } from 'react';
import { FaCalendarAlt, FaTimes, FaUtensils, FaDumbbell, FaBed, FaBrain, FaThLarge, FaSeedling } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getHealthCalendar } from '../../utils/healthCoach';
import type { CalendarDayItem } from '../../utils/healthCoach';
import { getHealthCalendarData } from '../../utils/analyticsScore';
import { bangkokDateStr } from '../../utils/bangkokTime';
import { GardenPlant } from '../garden/GardenPlant';
import { useGrowthStage } from '../../hooks/useGrowthStage';
import '../../styles/Coach.css';
import '../../styles/Garden.css';

type CalendarView = 'grid' | 'garden';

export const HealthCalendarSection: React.FC = () => {
  const { t } = useLanguage();
  const [selectedDay, setSelectedDay] = useState<CalendarDayItem | null>(null);
  const [view, setView] = useState<CalendarView>('grid');
  const { stage } = useGrowthStage();
  // Same Supabase history as the trend chart; localStorage calendar is the offline fallback.
  const [calendarDays, setCalendarDays] = useState<CalendarDayItem[]>(() => getHealthCalendar(30));

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      getHealthCalendarData(30)
        .then((r) => { if (!cancelled && r.days.length) setCalendarDays(r.days); })
        .catch(() => { if (!cancelled) setCalendarDays(getHealthCalendar(30)); });
    };
    load();
    window.addEventListener('healthDataUpdated', load);
    return () => {
      cancelled = true;
      window.removeEventListener('healthDataUpdated', load);
    };
  }, []);

  const getStatusColor = (status: CalendarDayItem['status']) => {
    switch (status) {
      case 'good': return '#10B981'; // green
      case 'medium': return '#F59E0B'; // yellow
      case 'bad': return '#EF4444'; // red
      default: return '#9CA3AF'; // grey empty
    }
  };

  const getStatusText = (status: CalendarDayItem['status']) => {
    switch (status) {
      case 'good': return t('calendar.good');
      case 'medium': return t('calendar.medium');
      case 'bad': return t('calendar.bad');
      default: return t('score.notRecorded');
    }
  };

  return (
    <div className="coach-card calendar-card">
      <div className="coach-card-header">
        <div className="coach-card-title-row">
          <span className="coach-card-icon" style={{ color: '#3B82F6', background: 'rgba(59, 130, 246, 0.12)' }}>
            <FaCalendarAlt />
          </span>
          <div>
            <h3 className="coach-card-title">{t('calendar.title')}</h3>
            <p className="coach-card-subtitle">{view === 'grid' ? t('calendar.tapHint') : t('calendar.gardenHint')}</p>
          </div>
        </div>
        <div className="calendar-view-toggle" role="group" aria-label={t('calendar.viewToggleLabel')}>
          <button type="button" className={view === 'grid' ? 'is-active' : ''} onClick={() => setView('grid')} aria-pressed={view === 'grid'}>
            <FaThLarge /> {t('calendar.gridView')}
          </button>
          <button type="button" className={view === 'garden' ? 'is-active' : ''} onClick={() => setView('garden')} aria-pressed={view === 'garden'}>
            <FaSeedling /> {t('calendar.gardenView')}
          </button>
        </div>
      </div>

      {view === 'grid' ? (
        <>
          <div className="calendar-legend">
            <span className="legend-item"><i className="legend-dot good" /> {t('calendar.good')}</span>
            <span className="legend-item"><i className="legend-dot medium" /> {t('calendar.medium')}</span>
            <span className="legend-item"><i className="legend-dot bad" /> {t('calendar.bad')}</span>
            <span className="legend-item"><i className="legend-dot empty" /> {t('score.notRecorded')}</span>
          </div>

          <div className="calendar-grid">
            {calendarDays.map((day) => {
              const color = getStatusColor(day.status);
              const isToday = day.dateStr === bangkokDateStr();
              return (
                <button
                  key={day.dateStr}
                  type="button"
                  className={`calendar-day-cell ${day.status} ${isToday ? 'is-today' : ''}`}
                  onClick={() => setSelectedDay(day)}
                  title={`${day.dateStr}: ${day.score > 0 ? `${day.score}/100` : t('score.notRecorded')}`}
                >
                  <span className="day-num">{day.dayNum}</span>
                  <span className="day-status-dot" style={{ backgroundColor: color }} />
                </button>
              );
            })}
          </div>
        </>
      ) : (
        // Same 30 days, same growth stage throughout — only each day's own
        // 4 pillars change how that day's tree looks.
        <div className="calendar-garden-row">
          {calendarDays.map((day) => {
            const isToday = day.dateStr === bangkokDateStr();
            return (
              <button
                key={day.dateStr}
                type="button"
                className={`calendar-garden-cell ${isToday ? 'is-today' : ''}`}
                onClick={() => setSelectedDay(day)}
                title={`${day.dateStr}: ${day.score > 0 ? `${day.score}/100` : t('score.notRecorded')}`}
              >
                <GardenPlant
                  breakdown={{ nutrition: day.nutrition, exercise: day.exercise, sleep: day.sleep, mental: day.mental }}
                  stage={stage}
                  size={52}
                />
                <span className="calendar-garden-daynum">{day.dayNum}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      {selectedDay && (
        <div className="calendar-modal-overlay" onClick={() => setSelectedDay(null)}>
          <div className="calendar-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="calendar-modal-header">
              <h4>{t('calendar.modalTitle')} - {selectedDay.dateStr}</h4>
              <button type="button" className="calendar-modal-close" onClick={() => setSelectedDay(null)}>
                <FaTimes />
              </button>
            </div>

            <div className="calendar-modal-body">
              <div className="modal-score-banner" style={{ borderColor: getStatusColor(selectedDay.status) }}>
                <div className="modal-score-num" style={{ color: getStatusColor(selectedDay.status) }}>
                  {selectedDay.score > 0 ? `${selectedDay.score}/100` : '-'}
                </div>
                <div className="modal-score-status">
                  {getStatusText(selectedDay.status)}
                </div>
              </div>

              <div className="modal-pillars-grid">
                <div className="modal-pillar-item">
                  <span className="modal-pillar-icon" style={{ color: '#10B981' }}><FaUtensils /></span>
                  <div>
                    <div className="modal-pillar-label">{t('dashboard.labelNutrition')}</div>
                    <div className="modal-pillar-val">{selectedDay.nutrition || 0} / 25</div>
                  </div>
                </div>

                <div className="modal-pillar-item">
                  <span className="modal-pillar-icon" style={{ color: '#F59E0B' }}><FaDumbbell /></span>
                  <div>
                    <div className="modal-pillar-label">{t('dashboard.labelExercise')}</div>
                    <div className="modal-pillar-val">{selectedDay.exercise || 0} / 25</div>
                  </div>
                </div>

                <div className="modal-pillar-item">
                  <span className="modal-pillar-icon" style={{ color: '#3B82F6' }}><FaBed /></span>
                  <div>
                    <div className="modal-pillar-label">{t('dashboard.labelSleep')}</div>
                    <div className="modal-pillar-val">{selectedDay.sleep || 0} / 25</div>
                  </div>
                </div>

                <div className="modal-pillar-item">
                  <span className="modal-pillar-icon" style={{ color: '#8B5CF6' }}><FaBrain /></span>
                  <div>
                    <div className="modal-pillar-label">{t('dashboard.labelMental')}</div>
                    <div className="modal-pillar-val">{selectedDay.mental || 0} / 25</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
