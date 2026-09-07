import React, { useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { FaTimes, FaUserPlus, FaCopy, FaCheck, FaShareAlt, FaQrcode } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  addTeamMemberByHandle, buildInviteUrl, normalizeHandle, previewHandle,
  type HandlePreview, type InviteReason,
} from '../../services/teamInvite';

const PENDING_KEY = 'pendingTeamAdd';

const reasonKey = (r?: InviteReason): string => {
  switch (r) {
    case 'not_found': return 'team.errNotFound';
    case 'self': return 'team.errSelf';
    case 'already_member': return 'team.errAlready';
    default: return 'team.errGeneric';
  }
};

/** Controlled QR image (inline SVG — no network, CSP-safe). */
const QrSvg: React.FC<{ text: string }> = ({ text }) => {
  const svg = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    return qr.createSvgTag({ cellSize: 5, margin: 2, scalable: true });
  }, [text]);
  return <div className="team-qr-svg" aria-hidden dangerouslySetInnerHTML={{ __html: svg }} />;
};

interface Props {
  myHandle: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMemberAdded: () => void;
}

export const TeamInvite: React.FC<Props> = ({ myHandle, open, onOpenChange, onMemberAdded }) => {
  const { t } = useLanguage();
  const [copied, setCopied] = useState(false);
  const [input, setInput] = useState('');
  const [preview, setPreview] = useState<HandlePreview | null>(null);
  const [status, setStatus] = useState<'idle' | 'looking' | 'adding' | 'done'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Deep link: App.tsx stashes ?add=<handle> here; pick it up and pre-fill.
  useEffect(() => {
    const pending = localStorage.getItem(PENDING_KEY);
    if (pending) {
      localStorage.removeItem(PENDING_KEY);
      setInput(pending);
      onOpenChange(true);
    }
  }, [onOpenChange]);

  // Reset transient state whenever the modal closes.
  useEffect(() => {
    if (!open) {
      setPreview(null); setStatus('idle'); setError(null);
    }
  }, [open]);

  const inviteUrl = myHandle ? buildInviteUrl(myHandle) : '';

  const handleCopy = async () => {
    if (!myHandle) return;
    try {
      await navigator.clipboard.writeText(myHandle);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch { /* clipboard blocked */ }
  };

  const handleShare = async () => {
    if (!inviteUrl) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: t('team.addTeammate'), url: inviteUrl });
      } else {
        await navigator.clipboard.writeText(inviteUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }
    } catch { /* user cancelled */ }
  };

  const handleLookup = async () => {
    const h = normalizeHandle(input);
    if (!h) return;
    setStatus('looking'); setError(null); setPreview(null);
    const p = await previewHandle(h);
    if (!p) { setStatus('idle'); setError(t('team.errNotFound')); return; }
    setPreview(p);
    setStatus('idle');
  };

  const handleAdd = async () => {
    const h = normalizeHandle(input);
    if (!h) return;
    setStatus('adding'); setError(null);
    const res = await addTeamMemberByHandle(h);
    if (res.ok) {
      setStatus('done');
      onMemberAdded();
      setTimeout(() => { onOpenChange(false); setInput(''); }, 1200);
    } else {
      setStatus('idle');
      setError(t(reasonKey(res.reason)));
    }
  };

  return (
    <>
      <div className="team-invite-card">
        <div className="team-invite-card-head">
          <span className="team-invite-card-icon"><FaQrcode /></span>
          <div>
            <h3 className="team-invite-card-title">{t('team.inviteCode')}</h3>
            <p className="team-invite-card-sub">{t('team.inviteCodeHint')}</p>
          </div>
        </div>

        {myHandle ? (
          <>
            <div className="team-qr-wrap">
              <QrSvg text={inviteUrl} />
            </div>
            <div className="team-handle-row">
              <code className="team-handle">{myHandle}</code>
              <button type="button" className="team-handle-btn" onClick={handleCopy}>
                {copied ? <FaCheck /> : <FaCopy />} {copied ? t('team.copied') : t('team.copyCode')}
              </button>
            </div>
            <div className="team-invite-actions">
              <button type="button" className="team-invite-share" onClick={handleShare}>
                <FaShareAlt /> {t('team.shareInvite')}
              </button>
              <button type="button" className="team-invite-add" onClick={() => onOpenChange(true)}>
                <FaUserPlus /> {t('team.addTeammate')}
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="team-invite-add team-invite-add--full" onClick={() => onOpenChange(true)}>
            <FaUserPlus /> {t('team.addTeammate')}
          </button>
        )}
      </div>

      {open && (
        <div className="modal-overlay" onClick={() => onOpenChange(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-v2">
              <h3 className="modal-title">{t('team.addTeammate')}</h3>
              <button type="button" className="modal-close-btn" onClick={() => onOpenChange(false)} aria-label={t('team.cancel')}>
                <FaTimes />
              </button>
            </div>
            <div className="modal-body">
              <div className="modal-field">
                <label className="modal-label" htmlFor="team-handle-input">{t('team.addByCode')}</label>
                <input
                  id="team-handle-input"
                  className="modal-input"
                  value={input}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder={t('team.codePlaceholder')}
                  onChange={(e) => { setInput(e.target.value); setPreview(null); setError(null); }}
                  onKeyDown={(e) => { if (e.key === 'Enter') void handleLookup(); }}
                />
              </div>

              {preview && (
                <div className="team-add-preview">
                  {/^https?:\/\//.test(preview.avatarUrl ?? '')
                    ? <img src={preview.avatarUrl as string} alt="" className="team-add-preview-avatar" />
                    : <span className="team-add-preview-avatar team-add-preview-avatar--ph">{preview.name[0]?.toUpperCase()}</span>}
                  <span className="team-add-preview-name">{preview.name}</span>
                </div>
              )}

              {error && <p className="team-add-error">{error}</p>}
              {status === 'done' && <p className="team-add-success">{t('team.addSuccess')}</p>}

              {preview ? (
                <button type="button" className="modal-submit-btn" disabled={status === 'adding'} onClick={handleAdd}>
                  {status === 'adding' ? t('team.adding') : t('team.addToTeam')}
                </button>
              ) : (
                <button type="button" className="modal-submit-btn" disabled={status === 'looking' || !normalizeHandle(input)} onClick={handleLookup}>
                  {status === 'looking' ? t('team.adding') : t('team.lookUp')}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
