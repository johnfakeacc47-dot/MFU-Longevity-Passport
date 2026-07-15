import React from 'react';
import { FaRobot, FaStar, FaUtensils, FaDumbbell, FaBed, FaBrain } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getWeeklyAIReport } from '../../utils/healthCoach';
import '../../styles/Coach.css';

export const WeeklyAIReportCard: React.FC = () => {
  const { language, t } = useLanguage();
  const report = getWeeklyAIReport(language);

  return (
    <div className="coach-card ai-report-card">
      <div className="coach-card-header">
        <div className="coach-card-title-row">
          <span className="coach-card-icon" style={{ color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.12)' }}>
            <FaRobot />
          </span>
          <div>
            <h3 className="coach-card-title">{t('coach.aiReportTitle')}</h3>
            <p className="coach-card-subtitle">{t('dashboard.aiPeriodReportSub')}</p>
          </div>
        </div>
      </div>

      <div className="ai-report-banner">
        <div className="ai-report-badge"><FaStar style={{ color: '#F59E0B' }} /> AI ANALYSIS</div>
        <p className="ai-report-summary">{report.summaryText}</p>
      </div>

      <div className="ai-report-stats-grid">
        <div className="ai-stat-box">
          <span className="ai-stat-label">{t('dashboard.avgLongevityScore')} (7D)</span>
          <span className="ai-stat-val total">{report.avgTotal} / 100</span>
        </div>

        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#10B981' }}><FaUtensils /></span>
          <span className="ai-stat-label">{t('dashboard.labelNutrition')}</span>
          <span className="ai-stat-val">{report.avgNutrition} / 25</span>
        </div>

        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#F59E0B' }}><FaDumbbell /></span>
          <span className="ai-stat-label">{t('dashboard.labelExercise')}</span>
          <span className="ai-stat-val">{report.avgExercise} / 25</span>
        </div>

        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#3B82F6' }}><FaBed /></span>
          <span className="ai-stat-label">{t('dashboard.labelSleep')}</span>
          <span className="ai-stat-val">{report.avgSleep} / 25</span>
        </div>

        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#8B5CF6' }}><FaBrain /></span>
          <span className="ai-stat-label">{t('dashboard.labelMental')}</span>
          <span className="ai-stat-val">{report.avgMental} / 25</span>
        </div>
      </div>
    </div>
  );
};
