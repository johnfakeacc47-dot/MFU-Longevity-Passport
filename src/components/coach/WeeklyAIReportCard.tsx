import React, { useEffect, useState } from 'react';
import { FaRobot, FaStar, FaUtensils, FaDumbbell, FaBed, FaBrain, FaSyncAlt, FaCheck, FaArrowUp } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { getWeeklyAIReport } from '../../utils/healthCoach';
import { getHealthInsights, type HealthInsightsResult } from '../../services/healthInsightsApi';
import '../../styles/Coach.css';

const PILLAR_LABEL: Record<string, { th: string; en: string }> = {
  eating: { th: 'การกิน', en: 'Eating' },
  exercise: { th: 'ออกกำลังกาย', en: 'Exercise' },
  sleep: { th: 'การนอน', en: 'Sleep' },
  mental: { th: 'สุขภาพจิต', en: 'Mental' },
};

export const WeeklyAIReportCard: React.FC = () => {
  const { language, t } = useLanguage();
  const isTh = language === 'th';
  const rule = getWeeklyAIReport(language);

  const [ai, setAi] = useState<HealthInsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (force = false) => {
    if (force) setRefreshing(true);
    else setLoading(true);
    setErr(null);
    try {
      setAi(await getHealthInsights('week', { force, lang: language }));
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  const avg = ai?.averages;
  const rep = ai?.enoughData ? ai.report : undefined;
  const stats = {
    total: avg?.total ?? rule.avgTotal,
    nutrition: avg?.nutrition ?? rule.avgNutrition,
    exercise: avg?.exercise ?? rule.avgExercise,
    sleep: avg?.sleep ?? rule.avgSleep,
    mental: avg?.mental ?? rule.avgMental,
  };

  const summary = rep?.headline
    ?? (ai && ai.enoughData === false
      ? (isTh
          ? `ยังบันทึกข้อมูลเพียง ${ai.loggedDays ?? 0} วันในรอบ 7 วัน ต้องมีอย่างน้อย 3 วันเพื่อให้ AI สรุปให้`
          : `Only ${ai.loggedDays ?? 0} day(s) logged this week — AI needs at least 3 to write a summary.`)
      : rule.summaryText);

  const relative = ai?.generatedAt
    ? new Date(ai.generatedAt).toLocaleDateString(isTh ? 'th-TH' : 'en-US', { month: 'short', day: 'numeric' })
    : null;

  return (
    <div className="coach-card ai-report-card">
      <div className="coach-card-header">
        <div className="coach-card-title-row">
          <span className="coach-card-icon" style={{ color: '#8B5CF6', background: 'rgba(139, 92, 246, 0.12)' }}>
            <FaRobot />
          </span>
          <div>
            <h3 className="coach-card-title">{t('coach.aiReportTitle')}</h3>
            <p className="coach-card-subtitle">
              {rep
                ? (isTh ? `วิเคราะห์ด้วย AI${relative ? ` · ${relative}` : ''}` : `AI analysis${relative ? ` · ${relative}` : ''}`)
                : t('dashboard.aiPeriodReportSub')}
            </p>
          </div>
        </div>
        {rep && (
          <button
            className="ai-report-refresh"
            onClick={() => void load(true)}
            disabled={refreshing}
            aria-label="Refresh AI report"
          >
            <FaSyncAlt className={refreshing ? 'spin' : ''} />
          </button>
        )}
      </div>

      <div className="ai-report-banner" style={loading ? { opacity: 0.55 } : undefined}>
        <div className="ai-report-badge">
          <FaStar style={{ color: '#F59E0B' }} /> {rep ? 'AI ANALYSIS' : (isTh ? 'สรุปเบื้องต้น' : 'SUMMARY')}
          {rep && rep.scoreTrend === 'improving' && <FaArrowUp style={{ color: '#10B981', marginLeft: 6 }} />}
        </div>
        <p className="ai-report-summary">{loading ? (isTh ? 'กำลังโหลด...' : 'Loading…') : summary}</p>

        {rep && (
          <div className="ai-report-detail">
            {rep.whatsWorking.length > 0 && (
              <ul className="ai-report-list ai-report-list--good">
                {rep.whatsWorking.map((s, i) => (
                  <li key={`w${i}`}><FaCheck /> {s}</li>
                ))}
              </ul>
            )}
            {rep.whatToImprove.length > 0 && (
              <ul className="ai-report-list ai-report-list--improve">
                {rep.whatToImprove.map((s, i) => (
                  <li key={`i${i}`}><FaArrowUp /> {s}</li>
                ))}
              </ul>
            )}
            {rep.suggestions.length > 0 && (
              <div className="ai-report-suggestions">
                {rep.suggestions.map((s, i) => (
                  <div key={`s${i}`} className="ai-report-suggestion">
                    <span className="ai-report-suggestion-pillar">
                      {isTh ? PILLAR_LABEL[s.pillar]?.th : PILLAR_LABEL[s.pillar]?.en}
                    </span>
                    <span className="ai-report-suggestion-action">{s.action}</span>
                    <span className="ai-report-suggestion-why">{s.why}</span>
                  </div>
                ))}
              </div>
            )}
            {rep.focusNext && (
              <p className="ai-report-focus">
                <strong>{isTh ? 'โฟกัสต่อไป:' : 'Focus next:'}</strong> {rep.focusNext}
              </p>
            )}
          </div>
        )}
        {err && <p className="ai-report-err">{err}</p>}
      </div>

      <div className="ai-report-stats-grid">
        <div className="ai-stat-box">
          <span className="ai-stat-label">{t('dashboard.avgLongevityScore')} (7D)</span>
          <span className="ai-stat-val total">{stats.total} / 100</span>
        </div>
        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#10B981' }}><FaUtensils /></span>
          <span className="ai-stat-label">{t('dashboard.labelNutrition')}</span>
          <span className="ai-stat-val">{stats.nutrition} / 25</span>
        </div>
        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#F59E0B' }}><FaDumbbell /></span>
          <span className="ai-stat-label">{t('dashboard.labelExercise')}</span>
          <span className="ai-stat-val">{stats.exercise} / 25</span>
        </div>
        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#3B82F6' }}><FaBed /></span>
          <span className="ai-stat-label">{t('dashboard.labelSleep')}</span>
          <span className="ai-stat-val">{stats.sleep} / 25</span>
        </div>
        <div className="ai-stat-box">
          <span className="ai-stat-icon" style={{ color: '#8B5CF6' }}><FaBrain /></span>
          <span className="ai-stat-label">{t('dashboard.labelMental')}</span>
          <span className="ai-stat-val">{stats.mental} / 25</span>
        </div>
      </div>
    </div>
  );
};
