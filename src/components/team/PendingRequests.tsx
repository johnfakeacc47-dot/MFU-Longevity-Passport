// QA-008: incoming teammate requests waiting on this user's approval. See
// supabase/migrations/0013_team_request_approval.sql — adding a teammate files a
// request instead of linking accounts instantly; this is where the target
// reviews and accepts/declines it.
import React, { useState } from 'react';
import { Check, X } from 'lucide-react';
import { useLanguage } from '../../contexts/LanguageContext';
import { respondToTeamRequest, type PendingTeamRequest } from '../../services/teamInvite';
import { ICON_PROPS } from '../v2';

interface Props {
  requests: PendingTeamRequest[];
  onResolved: () => void;
}

export const PendingRequests: React.FC<Props> = ({ requests, onResolved }) => {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    setError(null);
    try {
      const ok = await respondToTeamRequest(id, accept);
      if (!ok) { setError(t('team.errGeneric')); return; }
      onResolved();
    } catch (err) {
      console.error('respondToTeamRequest threw:', err);
      setError(t('team.errGeneric'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2 className="v2-h2">{t('team.pendingRequests')}</h2>
      {error && <p className="v2-alert v2-alert--error" role="alert">{error}</p>}
      <div className="v2-group">
        {requests.map((req) => (
          <div key={req.requestId} className="v2-row">
            {req.requesterAvatarUrl
              ? <img src={req.requesterAvatarUrl} alt="" className="v2-thumb" style={{ borderRadius: '50%' }} />
              : <span className="v2-avatar">{req.requesterName[0]?.toUpperCase() ?? '?'}</span>}
            <span className="v2-row-main">
              <span className="v2-row-title">{req.requesterName}</span>
              <span className="v2-row-sub">{t('team.wantsToAddYouSuffix')}</span>
            </span>
            <span className="v2-stepper">
              <button type="button" className="v2-step-btn" disabled={busyId === req.requestId}
                onClick={() => respond(req.requestId, false)} aria-label={t('team.decline')}>
                <X size={20} {...ICON_PROPS} />
              </button>
              <button type="button" className="v2-step-btn v2-step-btn--primary" disabled={busyId === req.requestId}
                onClick={() => respond(req.requestId, true)} aria-label={t('team.accept')}>
                <Check size={20} {...ICON_PROPS} />
              </button>
            </span>
          </div>
        ))}
      </div>
    </section>
  );
};
