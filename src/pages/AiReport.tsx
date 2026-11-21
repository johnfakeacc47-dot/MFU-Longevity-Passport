// ui_ref2 "รายงานสุขภาพจาก AI" — weekly report. Uses the existing `health-insights`
// Edge Function client (healthInsightsApi) with the rule-based weekly summary
// (healthCoach.getWeeklyAIReport) as the fallback when there isn't enough data.
import React, { useCallback, useEffect, useState } from 'react';
import { Sparkle, Check, Target, RefreshCw, Share2, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { getWeeklyAIReport } from '../utils/healthCoach';
import { getHealthInsights, type HealthInsightsResult } from '../services/healthInsightsApi';
import { PageHeader, IconBtn, ICON_PROPS } from '../components/v2';
import type { PageType } from '../types/pages';

interface Props {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const AiReport: React.FC<Props> = ({ onNavigate }) => {
  const { language, t } = useLanguage();
  const isTh = language === 'th';
  useSEO(`${t('v2.weeklyReportTitle')} · MFU Longevity Passport`, 'Your AI-written weekly health summary.');
  const rule = getWeeklyAIReport(language);

  const [ai, setAi] = useState<HealthInsightsResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareNote, setShareNote] = useState<'copied' | 'failed' | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async (force = false) => {
    if (force) setRefreshing(true); else setLoading(true);
    setErr(null);
    try {
      setAi(await getHealthInsights('week', { force, lang: language }));
    } catch (e) {
      // The message is whatever the Edge Function / SDK said — log it, never show it.
      console.error('getHealthInsights failed:', e);
      setErr((e as Error).message === 'quota_exceeded' ? t('ai.quotaReached') : t('ai.reportFailed'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [language, t]);

  useEffect(() => { void load(false); }, [load]);

  const rep = ai?.enoughData ? ai.report : undefined;
  const fmtDay = (iso?: string) => iso ? new Date(iso).toLocaleDateString(isTh ? 'th-TH' : 'en-US', { day: 'numeric', month: 'long' }) : '';
  const range = ai?.period ? `${fmtDay(ai.period.start)} – ${fmtDay(ai.period.end)}` : t('v2.last7Days');
  const created = ai?.generatedAt
    ? new Date(ai.generatedAt).toLocaleString(isTh ? 'th-TH' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    : null;

  const summary = rep?.headline
    ?? (ai && ai.enoughData === false
      ? (isTh
        ? `ยังบันทึกข้อมูลเพียง ${ai.loggedDays ?? 0} วันในรอบ 7 วัน ต้องมีอย่างน้อย 3 วันเพื่อให้ AI สรุปให้`
        : `Only ${ai.loggedDays ?? 0} day(s) logged this week — AI needs at least 3 to write a summary.`)
      : rule.summaryText);

  const share = async () => {
    const text = [summary, ...(rep?.whatsWorking ?? [])].join('\n');
    try {
      if (navigator.share) { await navigator.share({ title: t('v2.weeklyReportTitle'), text }); return; }
      await navigator.clipboard.writeText(text);
      setShareNote('copied');
    } catch (e) {
      if ((e as Error)?.name === 'AbortError') return; // user closed the share sheet
      setShareNote('failed');
    }
  };
  useEffect(() => {
    if (!shareNote) return;
    const id = window.setTimeout(() => setShareNote(null), 2400);
    return () => window.clearTimeout(id);
  }, [shareNote]);

  return (
    <div className="v2-page v2-page--nonav">
      <PageHeader title={t('v2.weeklyReportTitle')} onBack={() => onNavigate('dashboard')} backLabel={t('common.back')}
        right={<IconBtn label={t('v2.share')} onClick={share}>{shareNote === 'copied' ? <Check size={20} {...ICON_PROPS} /> : <Share2 size={20} {...ICON_PROPS} />}</IconBtn>} />
      {shareNote && (
        <div className={`v2-alert ${shareNote === 'copied' ? 'v2-alert--ok' : 'v2-alert--error'}`} role="status" aria-live="polite">
          {shareNote === 'copied' ? t('v2.copied') : t('v2.copyFailed')}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="v2-ai-tag"><Sparkle size={18} {...ICON_PROPS} /> {t('v2.aiSummaryTag')}</span>
        <p className="v2-muted">{range}{created ? ` · ${t('v2.createdAt')} ${created}` : ''}</p>
      </div>

      {loading ? (
        <div className="v2-empty"><span className="v2-spinner" role="status" aria-label={t('v2.loading')} /></div>
      ) : (
        <>
          <p className="v2-lead">{summary}</p>
          {err && <div className="v2-alert v2-alert--error" role="alert">{err}</div>}

          {rep && (
            <>
              <hr className="v2-rule" />
              {rep.whatsWorking.length > 0 && (
                <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 className="v2-h2">{t('v2.wentWell')}</h2>
                  <ul className="v2-list">
                    {rep.whatsWorking.map((x, i) => <li key={i} className="ok"><Check size={20} {...ICON_PROPS} /><span>{x}</span></li>)}
                  </ul>
                </section>
              )}
              {rep.whatToImprove.length > 0 && (
                <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 className="v2-h2">{t('v2.toImprove')}</h2>
                  <ul className="v2-list">
                    {rep.whatToImprove.map((x, i) => <li key={i} className="warn"><Target size={20} {...ICON_PROPS} /><span>{x}</span></li>)}
                  </ul>
                </section>
              )}
              {(rep.suggestions.length > 0 || rep.focusNext) && (
                <section style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <h2 className="v2-h2">{t('v2.nextWeek')}</h2>
                  <ul className="v2-list">
                    {rep.suggestions.map((s, i) => (
                      <li key={i}><span className="v2-num">{i + 1}</span><span>{s.action}{s.why ? ` — ${s.why}` : ''}</span></li>
                    ))}
                    {rep.focusNext && !rep.suggestions.length && <li><span className="v2-num">1</span><span>{rep.focusNext}</span></li>}
                  </ul>
                </section>
              )}
            </>
          )}
        </>
      )}

      <div className="v2-sticky-cta" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <p className="v2-note"><Info size={18} {...ICON_PROPS} /><span>{t('v2.medicalDisclaimer')}</span></p>
        <button type="button" className="v2-btn v2-btn--ghost" onClick={() => load(true)} disabled={refreshing || loading}>
          <RefreshCw size={18} {...ICON_PROPS} /> {refreshing ? t('v2.loading') : t('v2.regenerate')}
        </button>
      </div>
    </div>
  );
};
