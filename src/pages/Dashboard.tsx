import React, { useState, useEffect } from 'react';
import {
  FaBed,
  FaClock,
  FaDumbbell,
  FaUtensils,
  FaBrain,
  FaFire,
  FaRunning,
  FaTint,
  FaHeartbeat,
  FaRobot,
  FaCheckCircle,
  FaCalendarAlt,
  FaArrowUp,
  FaArrowDown,
  FaArrowRight,
  FaChartLine,
} from 'react-icons/fa';

import { useLanguage } from '../contexts/LanguageContext';
import { getScoreColor } from '../utils/longevityScore';
import { getAnalyticsData } from '../utils/analyticsScore';
import type { TimeRangeFilter, AnalyticsResult } from '../utils/analyticsScore';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { AnalyticsChart } from '../components/AnalyticsChart';
import { HealthCalendarSection } from '../components/coach/HealthCalendarSection';
import { WeeklyChallengesCard } from '../components/coach/WeeklyChallengesCard';
import { WeeklyAIReportCard } from '../components/coach/WeeklyAIReportCard';
import '../styles/Dashboard.css';

type PageType =
  | 'login'
  | 'home'
  | 'eating'
  | 'dashboard'
  | 'team'
  | 'profile'
  | 'edit-profile'
  | 'activity'
  | 'sleep';

interface DashboardProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const PILLAR_ICONS: Record<string, React.ReactNode> = {
  nutrition: <FaUtensils />,
  exercise: <FaDumbbell />,
  sleep: <FaBed />,
  mental: <FaBrain />,
};

const PILLAR_COLORS: Record<string, string> = {
  nutrition: '#10B981',
  exercise: '#F59E0B',
  sleep: '#3B82F6',
  mental: '#8B5CF6',
};

export const Dashboard: React.FC<DashboardProps> = ({
  onNavigate,
  onOpenFoodRecognition,
}) => {
  const { language, t } = useLanguage();
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('week');
  const [customStart, setCustomStart] = useState<string>(() =>
    new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0]
  );
  const [customEnd, setCustomEnd] = useState<string>(() =>
    new Date().toISOString().split('T')[0]
  );
  const [activeTab, setActiveTab] = useState<'nutrition' | 'exercise' | 'sleep' | 'mental'>('nutrition');
  const [data, setData] = useState<AnalyticsResult>(() =>
    getAnalyticsData('week', undefined, undefined, 25, language)
  );

  useEffect(() => {
    const updateData = () => {
      setData(getAnalyticsData(timeRange, customStart, customEnd, 25, language));
    };
    updateData();

    const handleUpdate = () => updateData();
    window.addEventListener('healthDataUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('healthDataUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [timeRange, customStart, customEnd, language]);

  const {
    currentAvg,
    deltaPercent,
    trendPoints,
    healthSummary,
    goalAchievement,
    improvementAnalysis,
    aiReport,
    achievements,
  } = data;

  const totalScoreColor = getScoreColor(currentAvg.total);

  const getStatusLabel = (val: number) => {
    if (val >= 20) return { label: t('dashboard.status.excellent'), color: '#10B981' };
    if (val >= 15) return { label: t('dashboard.status.good'),      color: '#22C55E' };
    if (val >= 10) return { label: t('dashboard.status.fair'),      color: '#F59E0B' };
    return { label: t('dashboard.status.needsWork'), color: '#F97316' };
  };

  const getDeltaBadge = (pct: number) => {
    if (pct > 0) {
      return (
        <span className="ana-delta-badge up">
          <FaArrowUp /> +{pct}% {t('dashboard.betterThanLast')}
        </span>
      );
    }
    if (pct < 0) {
      return (
        <span className="ana-delta-badge down">
          <FaArrowDown /> {pct}% {t('dashboard.needsImprovement')}
        </span>
      );
    }
    return (
      <span className="ana-delta-badge stable">
        <FaArrowRight /> {t('dashboard.stableTrend')}
      </span>
    );
  };

  return (
    <div className="dashboard-v2 ana-page">
      <header className="eating-header page-header dashboard-top-header">
        <BackButton onClick={() => onNavigate('home')} ariaLabel={t('common.back')} />
        <h1 className="eating-header-title">{t('dashboard.historicalTrend')}</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="ana-content page-content">
        {/* ── 1. Filter Bar ── */}
        <section className="ana-filter-section">
          <div className="ana-filter-bar">
            {(['today', 'week', 'month', 'quarter', 'year', 'custom'] as TimeRangeFilter[]).map(
              (range) => {
                const labelMap: Record<TimeRangeFilter, string> = {
                  today:   t('dashboard.filterToday'),
                  week:    t('dashboard.filterWeek'),
                  month:   t('dashboard.filterMonth'),
                  quarter: t('dashboard.filterQuarter'),
                  year:    t('dashboard.filterYear'),
                  custom:  t('dashboard.filterCustom'),
                };
                return (
                  <button
                    key={range}
                    type="button"
                    className={`ana-filter-btn ${timeRange === range ? 'active' : ''}`}
                    onClick={() => setTimeRange(range)}
                  >
                    {labelMap[range]}
                  </button>
                );
              }
            )}
          </div>

          {/* Custom Date Inputs if selected */}
          {timeRange === 'custom' && (
            <div className="ana-custom-dates">
              <div className="ana-date-field">
                <label><FaCalendarAlt /> {t('dashboard.filterStart')}</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div className="ana-date-field">
                <label><FaCalendarAlt /> {t('dashboard.filterEnd')}</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </section>

        {/* ── 2. Overall Longevity Score Card ── */}
        <section className="ana-card ana-hero-card">
          <div className="ana-hero-header">
            <div>
              <h2 className="ana-card-title">{t('dashboard.avgLongevityScore')}</h2>
              <p className="ana-card-subtitle">
                {data.startDateStr} to {data.endDateStr}
              </p>
            </div>
          </div>

          <div className="ana-hero-body">
            <div className="ana-score-ring-wrap">
              <div
                className="ana-score-ring"
                style={{
                  borderColor: `${totalScoreColor}33`,
                  boxShadow: `0 0 36px ${totalScoreColor}22`,
                }}
              >
                <span className="ana-ring-num" style={{ color: totalScoreColor }}>
                  {currentAvg.total}
                </span>
                <span className="ana-ring-denom">/ 100</span>
              </div>
            </div>

            <div className="ana-hero-delta-wrap">
              {getDeltaBadge(deltaPercent)}
              <p className="ana-hero-note">
                {t('dashboard.heroNote')}
              </p>
            </div>
          </div>
        </section>

        {/* ── 3. Score Overview (4 Pillars) ── */}
        <section className="ana-card ana-overview-card">
          <h2 className="ana-card-title">{t('dashboard.scoreOverview')}</h2>
          <p className="ana-card-subtitle">{t('dashboard.scoreOverviewSub')}</p>

          <div className="ana-overview-grid">
            {[
              { key: 'nutrition', labelKey: 'dashboard.labelNutrition', val: currentAvg.nutrition },
              { key: 'exercise',  labelKey: 'dashboard.labelExercise',  val: currentAvg.exercise  },
              { key: 'sleep',     labelKey: 'dashboard.labelSleep',     val: currentAvg.sleep     },
              { key: 'mental',    labelKey: 'dashboard.labelMental',    val: currentAvg.mental    },
            ].map((item) => {
              const st = getStatusLabel(item.val);
              const color = PILLAR_COLORS[item.key];
              const pct = (item.val / 25) * 100;

              return (
                <div key={item.key} className="ana-overview-item">
                  <div className="ana-overview-top">
                    <span className="ana-overview-label">
                      <span className="ana-pillar-icon" style={{ color }}>
                        {PILLAR_ICONS[item.key]}
                      </span>
                      {t(item.labelKey)}
                    </span>
                    <span className="ana-overview-score" style={{ color }}>
                      {item.val} <small>/ 25</small>
                    </span>
                  </div>

                  <div className="ana-progress-track">
                    <div
                      className="ana-progress-fill"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>

                  <div className="ana-overview-bot">
                    <span className="ana-status-tag" style={{ color: st.color }}>
                      {st.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 3.5 Health Calendar (30-Day Heatmap) ── */}
        <HealthCalendarSection />

        {/* ── 4. Health Trend (Overall Line Chart) ── */}
        <section className="ana-card ana-chart-section">
          <div className="ana-chart-header">
            <div>
              <h2 className="ana-card-title">{t('dashboard.overallTrend')}</h2>
              <p className="ana-card-subtitle">{t('dashboard.overallTrendSub')}</p>
            </div>
            <span className="ana-chart-badge">{t('dashboard.max100')}</span>
          </div>

          <AnalyticsChart
            data={trendPoints}
            activeKey="total"
            color="#0284C7"
            maxVal={100}
          />
        </section>

        {/* ── 5. Individual Trend (Tabs + Line Chart) ── */}
        <section className="ana-card ana-chart-section">
          <div className="ana-chart-header">
            <div>
              <h2 className="ana-card-title">{t('dashboard.individualTrend')}</h2>
              <p className="ana-card-subtitle">{t('dashboard.individualTrendSub')}</p>
            </div>
          </div>

          {/* Pillar Tabs */}
          <div className="ana-pillar-tabs">
            {[
              { key: 'nutrition', labelKey: 'dashboard.labelNutrition', icon: <FaUtensils /> },
              { key: 'exercise',  labelKey: 'dashboard.labelExercise',  icon: <FaDumbbell /> },
              { key: 'sleep',     labelKey: 'dashboard.labelSleep',     icon: <FaBed /> },
              { key: 'mental',    labelKey: 'dashboard.labelMental',    icon: <FaBrain /> },
            ].map((tab) => {
              const isActive = activeTab === tab.key;
              const color = PILLAR_COLORS[tab.key];
              return (
                <button
                  key={tab.key}
                  type="button"
                  className={`ana-pillar-tab ${isActive ? 'active' : ''}`}
                  style={isActive ? { borderColor: color, color: color, backgroundColor: `${color}14` } : undefined}
                  onClick={() => setActiveTab(tab.key as any)}
                >
                  <span className="tab-icon">{tab.icon}</span>
                  <span>{t(tab.labelKey)}</span>
                </button>
              );
            })}
          </div>

          <AnalyticsChart
            data={trendPoints}
            activeKey={activeTab}
            color={PILLAR_COLORS[activeTab]}
            maxVal={25}
          />
        </section>

        {/* ── 6. Health Summary (Real Averages) ── */}
        <section className="ana-card ana-summary-card">
          <h2 className="ana-card-title">{t('dashboard.healthSummary')}</h2>
          <p className="ana-card-subtitle">{t('dashboard.healthSummarySub')}</p>

          <div className="ana-summary-grid">
            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#10B981', background: '#10B98114' }}>
                <FaUtensils />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgCaloriesIntake')}</span>
                <span className="ana-sum-val">{healthSummary.avgCaloriesIntake.toLocaleString()} <small>kcal</small></span>
              </div>
            </div>

            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#F59E0B', background: '#F59E0B14' }}>
                <FaFire />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgCaloriesBurned')}</span>
                <span className="ana-sum-val">{healthSummary.avgCaloriesBurned.toLocaleString()} <small>kcal</small></span>
              </div>
            </div>

            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#3B82F6', background: '#3B82F614' }}>
                <FaBed />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgSleepHours')}</span>
                <span className="ana-sum-val">{healthSummary.avgSleepHours} <small>hrs</small></span>
              </div>
            </div>

            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#8B5CF6', background: '#8B5CF614' }}>
                <FaChartLine />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgMoodScore')}</span>
                <span className="ana-sum-val">{healthSummary.avgMoodScore} <small>/ 10 ({healthSummary.avgMoodLabel})</small></span>
              </div>
            </div>

            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#EF4444', background: '#EF444414' }}>
                <FaHeartbeat />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgStressLevel')}</span>
                <span className="ana-sum-val">{healthSummary.avgStressLevel} <small>/ 10</small></span>
              </div>
            </div>

            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#06B6D4', background: '#06B6D414' }}>
                <FaTint />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgWaterIntake')}</span>
                <span className="ana-sum-val">{healthSummary.avgWaterIntake} <small>glasses</small></span>
              </div>
            </div>

            <div className="ana-sum-box">
              <div className="ana-sum-icon" style={{ color: '#22C55E', background: '#22C55E14' }}>
                <FaRunning />
              </div>
              <div className="ana-sum-info">
                <span className="ana-sum-label">{t('dashboard.avgProteinIntake')}</span>
                <span className="ana-sum-val">{healthSummary.avgProteinIntake} <small>g</small></span>
              </div>
            </div>
          </div>
        </section>

        {/* ── 7. Goal Achievement ── */}
        <section className="ana-card ana-goals-card">
          <h2 className="ana-card-title">{t('dashboard.goalAchievement')}</h2>
          <p className="ana-card-subtitle">{t('dashboard.goalAchievementSub')}</p>

          <div className="ana-goals-list">
            {[
              { label: t('dashboard.goalCalories'),  pct: goalAchievement.caloriesProgress, color: '#10B981' },
              { label: t('dashboard.goalExercise'),  pct: goalAchievement.exerciseProgress, color: '#F59E0B' },
              { label: t('dashboard.goalSleep'),     pct: goalAchievement.sleepProgress,    color: '#3B82F6' },
            ].map((goal, idx) => (
              <div key={idx} className="ana-goal-item">
                <div className="ana-goal-header">
                  <span>{goal.label}</span>
                  <span className="ana-goal-pct">{goal.pct}%</span>
                </div>
                <div className="ana-progress-track">
                  <div
                    className="ana-progress-fill"
                    style={{ width: `${goal.pct}%`, backgroundColor: goal.color }}
                  />
                </div>
              </div>
            ))}

            <div className="ana-goal-overall">
              <div className="ana-goal-header">
                <strong>{t('dashboard.goalOverall')}</strong>
                <strong className="ana-overall-pct" style={{ color: '#0284C7' }}>
                  {goalAchievement.overallProgress}%
                </strong>
              </div>
              <div className="ana-progress-track ana-track-lg">
                <div
                  className="ana-progress-fill"
                  style={{ width: `${goalAchievement.overallProgress}%`, backgroundColor: '#0284C7' }}
                />
              </div>
            </div>
          </div>
        </section>

        {/* ── 8. Improvement Analysis ── */}
        <section className="ana-card ana-improve-card">
          <h2 className="ana-card-title">{t('dashboard.improvementAnalysis')}</h2>
          <p className="ana-card-subtitle">{t('dashboard.improvementAnalysisSub')}</p>

          <div className="ana-improve-grid">
            {improvementAnalysis.map((item) => {
              const isUp = item.status === 'improved';
              const isDown = item.status === 'decreased';
              const color = isUp ? '#10B981' : isDown ? '#EF4444' : '#F59E0B';
              const bg = isUp ? '#10B98112' : isDown ? '#EF444412' : '#F59E0B12';

              return (
                <div key={item.key} className="ana-improve-box" style={{ backgroundColor: bg, borderColor: `${color}33` }}>
                  <div className="ana-improve-top">
                    <span className="ana-improve-pillar">{item.pillar}</span>
                    <span className="ana-improve-delta" style={{ color }}>
                      {item.delta > 0 ? `+${item.delta}` : item.delta} pts
                    </span>
                  </div>
                  <div className="ana-improve-status" style={{ color }}>
                    {isUp ? <FaArrowUp /> : isDown ? <FaArrowDown /> : <FaArrowRight />}
                    <span>{item.label}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ── 9. AI Period Analysis Card ── */}
        <section className="ana-card ana-ai-card">
          <div className="ana-ai-header">
            <div className="ana-ai-icon-wrap">
              <FaRobot />
            </div>
            <div>
              <h2 className="ana-card-title">{t('dashboard.aiPeriodReport')}</h2>
              <p className="ana-card-subtitle">{t('dashboard.aiPeriodReportSub')}</p>
            </div>
          </div>
          <div className="ana-ai-body">
            <p className="ana-ai-paragraph">{aiReport}</p>
          </div>
        </section>

        {/* ── 9.5 Weekly AI Report & Weekly Challenges ── */}
        <WeeklyAIReportCard />
        <WeeklyChallengesCard />

        {/* ── 10. Achievements Card ── */}
        <section className="ana-card ana-achieve-card">
          <h2 className="ana-card-title">{t('dashboard.earnedAchievements')}</h2>
          <p className="ana-card-subtitle">{t('dashboard.earnedAchievementsSub')}</p>

          <div className="ana-achieve-grid">
            {achievements.map((ach) => (
              <div
                key={ach.id}
                className={`ana-achieve-box ${ach.isCompleted ? 'completed' : 'pending'}`}
              >
                <div className="ana-achieve-icon">
                  {ach.isCompleted ? <FaCheckCircle style={{ color: '#10B981' }} /> : <FaClock style={{ color: '#94A3B8' }} />}
                </div>
                <div className="ana-achieve-info">
                  <h4 className="ana-achieve-title">{ach.title}</h4>
                  <span className="ana-achieve-status">{ach.status}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <BottomNav
        active="dashboard"
        onNavigate={onNavigate}
        onOpenFoodRecognition={onOpenFoodRecognition}
        t={t}
      />
    </div>
  );
};
