import React, { useState, useEffect } from 'react';
import { TopBar } from '../components/TopBar';
import { Activity, Leaf, Smile, Moon, TrendingUp, TrendingDown, Sparkle, Target, RefreshCw } from 'lucide-react';

import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { getAnalyticsData, emptyAnalytics } from '../utils/analyticsScore';
import type { TimeRangeFilter, AnalyticsResult } from '../utils/analyticsScore';
import { Chip, Group, Row, ProgressBar, IconChip, ICON_PROPS } from '../components/v2';
import type { Pillar } from '../components/v2';
import { toPct } from '../utils/todaySummary';

import type { PageType } from '../types/pages';

interface DashboardProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const RANGES: { id: TimeRangeFilter; labelKey: string }[] = [
  { id: 'week', labelKey: 'v2.range7' },
  { id: 'month', labelKey: 'v2.range30' },
  { id: 'quarter', labelKey: 'v2.range90' },
];

type PillarKey = 'nutrition' | 'exercise' | 'mental' | 'sleep';
const PILLAR_ROWS: { key: PillarKey; pillar: Pillar; titleKey: string; icon: React.ReactNode }[] = [
  { key: 'exercise', pillar: 'act',   titleKey: 'v2.pillar.activity', icon: <Activity size={22} {...ICON_PROPS} /> },
  { key: 'nutrition', pillar: 'food', titleKey: 'v2.pillar.food',     icon: <Leaf size={22} {...ICON_PROPS} /> },
  { key: 'mental',   pillar: 'mind',  titleKey: 'v2.pillar.mind',     icon: <Smile size={22} {...ICON_PROPS} /> },
  { key: 'sleep',    pillar: 'sleep', titleKey: 'v2.pillar.sleep',    icon: <Moon size={22} {...ICON_PROPS} /> },
];

const fmtDelta = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0');

export const Dashboard: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { language, t } = useLanguage();
  useSEO(`${t('dashboard.title')} · MFU Longevity Passport`, 'Analytics and trends across all your health pillars.');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('week');
  // Only used by the 'custom' range, which this screen no longer exposes; kept so
  // getAnalyticsData keeps its original signature.
  const customStart = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const customEnd = new Date().toISOString().split('T')[0];
  const [data, setData] = useState<AnalyticsResult>(() => emptyAnalytics('week', language));
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  // Bumped by the retry button to re-run the effect below.
  const [retryTick, setRetryTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const updateData = async () => {
      setIsLoading(true);
      try {
        const result = await getAnalyticsData(timeRange, customStart, customEnd, 25, language);
        if (!cancelled) { setData(result); setLoadError(false); }
      } catch (err) {
        console.error('Dashboard: getAnalyticsData failed:', err);
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    void updateData();
    const handleUpdate = () => void updateData();
    window.addEventListener('healthDataUpdated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener('healthDataUpdated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRange, language, retryTick]);

  const { currentAvg, prevAvg, trendPoints, improvementAnalysis, loggedDays } = data;
  const totalDelta = Math.round(currentAvg.total - prevAvg.total);
  const hasPrev = prevAvg.total > 0;
  const periodLabel = timeRange === 'week' ? t('v2.avg7') : timeRange === 'month' ? t('v2.avg30') : t('v2.avg90');
  const prevLabel = timeRange === 'week' ? t('v2.fromLastWeek') : t('v2.fromPrevPeriod');

  // Bars: latest logged day is highlighted, like the reference.
  const maxTotal = Math.max(100, ...trendPoints.map((p) => p.total));
  let peakIdx = -1;
  trendPoints.forEach((p, i) => { if (p.total > 0) peakIdx = i; });
  const dense = trendPoints.length > 10;

  return (
    <div className="v2-page">
      <TopBar title={t('v2.dashboardTitle')} subtitle={t('v2.dashboardSubtitle')} onNavigate={onNavigate} />
      <div className="v2-chips v2-toolbar">
        {RANGES.map((r) => (
          <Chip key={r.id} on={timeRange === r.id} onClick={() => setTimeRange(r.id)}>{t(r.labelKey)}</Chip>
        ))}
      </div>

      {loadError && (
        <div className="v2-alert v2-alert--error" role="alert">
          <span style={{ flex: 1 }}>{t('v2.loadFailed')}</span>
          <button type="button" className="v2-link" onClick={() => setRetryTick((n) => n + 1)}>
            <RefreshCw size={14} {...ICON_PROPS} /> {t('common.retry')}
          </button>
        </div>
      )}

      <section className="v2-card" aria-busy={isLoading}>
        <span className="v2-muted">{periodLabel}</span>
        <div className="v2-row-top" style={{ alignItems: 'flex-end' }}>
          <span className="v2-bignum v2-tnum">{isLoading ? '–' : Math.round(currentAvg.total)}</span>
          {hasPrev && !isLoading && (
            <span className={`v2-trend ${totalDelta < 0 ? 'v2-trend--down' : ''}`} style={{ fontSize: 16 }}>
              {totalDelta >= 0 ? <TrendingUp size={18} {...ICON_PROPS} /> : <TrendingDown size={18} {...ICON_PROPS} />}
              {fmtDelta(totalDelta)} {prevLabel}
            </span>
          )}
        </div>

        {trendPoints.length === 0 || loggedDays === 0 ? (
          <p className="v2-muted" style={{ padding: '24px 0' }}>{t('v2.noTrendData')}</p>
        ) : (
          <>
            <div className="v2-bars" role="img" aria-label={periodLabel}>
              {trendPoints.map((p, i) => (
                <div key={p.dateStr} className={`v2-bars-col ${i === peakIdx ? 'is-peak' : ''}`} style={dense ? { gap: 0 } : undefined}>
                  {i === peakIdx && <em style={{ bottom: `calc(${(p.total / maxTotal) * 100}% + 4px)` }}>{Math.round(p.total)}</em>}
                  <i style={{ height: `${Math.max(2, (p.total / maxTotal) * 100)}%`, maxWidth: dense ? 10 : 34 }} />
                </div>
              ))}
            </div>
            {!dense && (
              <div className="v2-bars-days">
                {trendPoints.map((p) => <span key={p.dateStr}>{p.label}</span>)}
              </div>
            )}
          </>
        )}
      </section>

      <h2 className="v2-h2">{t('v2.pillarAverages')}</h2>
      <Group>
        {PILLAR_ROWS.map((r) => {
          const val = toPct(currentAvg[r.key]);
          const imp = improvementAnalysis.find((x) => x.key === r.key);
          const d = imp ? Math.round(imp.delta * 4) : 0;
          return (
            <div key={r.key} className="v2-avg-row">
              <IconChip pillar={r.pillar}>{r.icon}</IconChip>
              <span className="v2-avg-name">{t(r.titleKey)}</span>
              <ProgressBar value={val} pillar={r.pillar} label={t(r.titleKey)} />
              <span className="n v2-tnum">{isLoading ? '–' : val}</span>
              <span className="d v2-tnum">{hasPrev ? fmtDelta(d) : ''}</span>
            </div>
          );
        })}
      </Group>

      <Group>
        <Row pillar="water" icon={<Sparkle size={22} {...ICON_PROPS} />} title={t('v2.weeklyReport')} sub={t('v2.weeklyReportSub')}
          chevron onClick={() => onNavigate('ai-report')} />
        <Row pillar="water" icon={<Target size={22} {...ICON_PROPS} />} title={t('v2.myGoals')} sub={t('v2.myGoalsSub')}
          chevron onClick={() => onNavigate('set-goals')} />
      </Group>

    </div>
  );
};
