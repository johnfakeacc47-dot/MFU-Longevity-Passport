// ui_ref2 "เพิ่มเพื่อนร่วมทีม": full-screen sheet with a handle search tab and a QR
// scan tab, plus my own QR + share link. Props and service calls are unchanged
// (previewHandle / requestTeamMemberByHandle / buildInviteUrl).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import { Search, Camera, Share2, Check, Copy } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { PageHeader, Segmented, ICON_PROPS } from '../v2';
import {
  requestTeamMemberByHandle, buildInviteUrl, normalizeHandle, previewHandle,
  type HandlePreview, type InviteReason,
} from '../../services/teamInvite';

const PENDING_KEY = 'pendingTeamAdd';

// Invite codes look like "swift-lotus-73" — typing the hyphens means detouring
// to the symbols keyboard on mobile (QA-007). Auto-format as they type instead:
// lowercase, drop anything that isn't a letter/digit/space/hyphen, and turn
// spaces into hyphens automatically.
const formatHandleInput = (raw: string): string =>
  raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s-]+/g, '-')
    .replace(/^-+/, '');

const reasonKey = (r?: InviteReason): string => {
  switch (r) {
    case 'not_found': return 'team.errNotFound';
    case 'self': return 'team.errSelf';
    case 'already_member': return 'team.errAlready';
    case 'already_requested': return 'team.errAlreadyRequested';
    case 'recently_declined': return 'team.errRecentlyDeclined';
    case 'rate_limited': return 'team.errRateLimited';
    default: return 'team.errGeneric';
  }
};

/** Controlled QR image (inline SVG — no network, CSP-safe). */
export const QrSvg: React.FC<{ text: string }> = ({ text }) => {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 0, scalable: true });
  }, [text]);
  return <div className="v2-qr-box" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
};

// Minimal typing for the (not yet in lib.dom) BarcodeDetector API.
interface BarcodeDetectorLike { detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]> }
type BarcodeDetectorCtor = new (opts?: { formats?: string[] }) => BarcodeDetectorLike;

/** Pulls the invite code out of a scanned QR (our invite URL, or a bare code). */
const handleFromScan = (raw: string): string => {
  try {
    const u = new URL(raw);
    return normalizeHandle(u.searchParams.get('add') ?? '');
  } catch {
    return normalizeHandle(raw);
  }
};

interface Props {
  myHandle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
}

export const TeamInvite: React.FC<Props> = ({ myHandle, open, onOpenChange, onMemberAdded }) => {
  const { t } = useLanguage();
  const [tab, setTab] = useState<'handle' | 'scan'>('handle');
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<HandlePreview | null>(null);
  const [status, setStatus] = useState<'idle' | 'looking' | 'adding' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);
  // 'pending' — a request was filed. 'accepted' — a crossed request (they'd
  // already asked to add me) resolved instantly (see request_team_member_by_handle()).
  const [doneStatus, setDoneStatus] = useState<'pending' | 'accepted' | null>(null);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Deep link: App.tsx stashes ?add=<handle> here; pick it up and pre-fill.
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      localStorage.removeItem(PENDING_KEY);
      setInput(pending);
      onOpenChange(true);
    }
  }, [onOpenChange]);

  // Reset transient state whenever the sheet closes.
  useEffect(() => {
    if (!open) {
      setPreview(null); setStatus('idle'); setError(null); setDoneStatus(null); setTab('handle'); setScanMsg(null);
    }
  }, [open]);

  const inviteUrl = myHandle ? buildInviteUrl(myHandle) : '';

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) await navigator.share({ title: t('team.addTeammate'), url: inviteUrl });
      else await copy(inviteUrl);
    } catch { /* user cancelled */ }
  };

  const lookup = async (code: string) => {
    const h = normalizeHandle(code);
    if (!h) return;
    setStatus('looking'); setError(null); setPreview(null);
    const res = await previewHandle(h);
    setStatus('idle');
    if (res.kind === 'found') { setPreview(res.profile); return; }
    // Only a genuine miss is "code not found"; an RPC/network failure gets the generic message.
    setError(t(res.kind === 'not_found' ? 'team.errNotFound' : 'team.errGeneric'));
  };

  const handleAdd = async () => {
    const h = normalizeHandle(input);
    if (!h) return;
    setStatus('adding'); setError(null);
    const res = await requestTeamMemberByHandle(h);
    if (res.ok) {
      setStatus('done');
      setDoneStatus(res.status ?? 'pending');
      // Only a crossed-request accept changes "My Team" right away.
      if (res.status === 'accepted') onMemberAdded();
      setTimeout(() => { onOpenChange(false); setInput(''); }, 1400);
    } else {
      setStatus('idle');
      setError(t(reasonKey(res.reason)));
    }
  };

  // ── QR scan tab: native BarcodeDetector over the rear camera ──────────────
  useEffect(() => {
    if (!open || tab !== 'scan') return;
    const Detector = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor }).BarcodeDetector;
    if (!Detector || !navigator.mediaDevices?.getUserMedia) { setScanMsg(t('v2.scanUnsupported')); return; }
    setScanMsg(null);
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const detector = new Detector({ formats: ['qr_code'] });

    const tick = async () => {
      const v = videoRef.current;
      if (stopped || !v) return;
      try {
        if (v.readyState >= 2) {
          const found = await detector.detect(v);
          const code = found[0] ? handleFromScan(found[0].rawValue) : '';
          if (code) {
            stopped = true;
            setInput(code); setTab('handle');
            void lookup(code);
            return;
          }
        }
      } catch { /* a frame failed to decode — try the next one */ }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((s) => {
        if (stopped) { s.getTracks().forEach((tr) => tr.stop()); return; }
        stream = s;
        if (videoRef.current) { videoRef.current.srcObject = s; void videoRef.current.play().catch(() => undefined); }
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setScanMsg(t('v2.cameraDenied')));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, tab]);

  if (!open) return null;

  return (
    <div className="v2-sheet" role="dialog" aria-modal="true" aria-label={t('team.addTeammate')}>
      <div className="v2-page v2-page--nonav" style={{ minHeight: '100%' }}>
        <PageHeader title={t('team.addTeammate')} onBack={() => onOpenChange(false)} backLabel={t('team.cancel')} />

        <Segmented value={tab} onChange={(v) => setTab(v as 'handle' | 'scan')} options={[
          { value: 'handle', label: <><Search size={18} {...ICON_PROPS} /> {t('v2.handle')}</> },
          { value: 'scan', label: <><Camera size={18} {...ICON_PROPS} /> {t('v2.scanQr')}</> },
        ]} />

        {tab === 'handle' ? (
          <>
            <div className="v2-input-wrap">
              <Search className="v2-input-icon" size={20} {...ICON_PROPS} />
              <input
                id="team-handle-input"
                className="v2-input v2-input--icon"
                style={{ borderColor: 'var(--v2-primary)' }}
                value={input}
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={t('team.codePlaceholder')}
                aria-label={t('team.addByCode')}
                onChange={(e) => { setInput(formatHandleInput(e.target.value)); setPreview(null); setError(null); }}
                onKeyDown={(e) => { if (e.key === 'Enter') void lookup(input); }}
              />
            </div>

            {!preview && status !== 'done' && (
              <button type="button" className="v2-btn v2-btn--primary" disabled={status === 'looking' || !normalizeHandle(input)} onClick={() => void lookup(input)}>
                {status === 'looking' ? t('team.adding') : t('team.lookUp')}
              </button>
            )}

            {preview && (
              <div className="v2-group">
                <div className="v2-row">
                  {/^https?:\/\//.test(preview.avatarUrl ?? '')
                    ? <img src={preview.avatarUrl as string} alt="" className="v2-thumb" style={{ borderRadius: '50%' }} />
                    : <span className="v2-avatar">{preview.name[0]?.toUpperCase()}</span>}
                  <span className="v2-row-main">
                    <span className="v2-row-title">{preview.name}</span>
                    <span className="v2-row-sub">@{normalizeHandle(input)}</span>
                  </span>
                  {status !== 'done' && (
                    <button type="button" className="v2-btn v2-btn--primary v2-btn--sm" disabled={status === 'adding'} onClick={handleAdd}>
                      {status === 'adding' ? t('team.sending') : t('v2.add')}
                    </button>
                  )}
                </div>
              </div>
            )}

            {error && <p className="v2-alert v2-alert--error" role="alert">{error}</p>}
            {status === 'done' && (
              <p className="v2-alert v2-alert--ok" role="status">
                {doneStatus === 'accepted' ? t('team.nowTeammates') : t('team.requestSent')}
              </p>
            )}
          </>
        ) : (
          <div className="v2-scan" style={{ minHeight: 320 }}>
            <video ref={videoRef} muted playsInline aria-label={t('v2.scanQr')} />
            <span className="v2-corner v2-corner--tl" /><span className="v2-corner v2-corner--tr" />
            <span className="v2-corner v2-corner--bl" /><span className="v2-corner v2-corner--br" />
            {scanMsg && <p className="v2-muted" style={{ position: 'relative', zIndex: 3, textAlign: 'center', padding: '0 32px' }}>{scanMsg}</p>}
          </div>
        )}

        <div className="v2-divider">{t('v2.orScanMine')}</div>

        {myHandle ? (
          <section className="v2-card v2-qr">
            <QrSvg text={inviteUrl} />
            <button type="button" className="v2-link" style={{ fontSize: 20, fontWeight: 700, color: 'var(--v2-text)', display: 'inline-flex', gap: 8, alignItems: 'center' }}
              onClick={() => void copy(myHandle)} aria-label={t('team.copyCode')}>
              @{myHandle} {copied ? <Check size={18} {...ICON_PROPS} /> : <Copy size={18} {...ICON_PROPS} />}
            </button>
            <p className="v2-muted">{t('v2.qrOnlyForTeam')}</p>
          </section>
        ) : (
          <p className="v2-muted" style={{ textAlign: 'center' }}>{t('v2.noHandleYet')}</p>
        )}

        <div className="v2-sticky-cta">
          <button type="button" className="v2-btn v2-btn--ghost" onClick={handleShare} disabled={!myHandle}>
            <Share2 size={20} {...ICON_PROPS} /> {copied ? t('team.copied') : t('v2.shareInvite')}
          </button>
        </div>
      </div>
    </div>
  );
};
