// QA-008: incoming teammate requests waiting on this user's approval. See
// supabase/migrations/0013_team_request_approval.sql — adding a teammate now
// files a request instead of linking accounts instantly; this is where the
// target reviews and accepts/declines it. Reuses the .team-lb-* card styling
// (leaderboard rows) so it reads as part of the same page, not a bolted-on
// widget.
import React, { useState } from 'react';
import { FaCheck, FaTimes, FaUser } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { respondToTeamRequest, type PendingTeamRequest } from '../../services/teamInvite';

interface Props {
  requests: PendingTeamRequest[];
  onResolved: () => void;
}

export const PendingRequests: React.FC<Props> = ({ requests, onResolved }) => {
  const { t } = useLanguage();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (requests.length === 0) return null;

  const respond = async (id: string, accept: boolean) => {
    setBusyId(id);
    await respondToTeamRequest(id, accept);
    setBusyId(null);
    onResolved();
  };

  return (
    <div className="team-leaderboard-section">
      <div className="team-lb-header">
        <h3 className="team-lb-title">{t('team.pendingRequests')}</h3>
      </div>
      <div className="team-lb-list">
        {requests.map((req) => (
          <div key={req.requestId} className="team-lb-card">
            <div className="team-lb-avatar">
              {req.requesterAvatarUrl ? (
                <img src={req.requesterAvatarUrl} alt="" className="team-lb-avatar-img" />
              ) : (
                <div className="team-lb-avatar-placeholder">
                  {req.requesterName[0]?.toUpperCase() ?? <FaUser className="team-lb-default-icon" />}
                </div>
              )}
            </div>
            <div className="team-lb-info">
              <div className="team-lb-name">{req.requesterName}</div>
              <div className="team-lb-role">{t('team.wantsToAddYouSuffix')}</div>
            </div>
            <div className="team-pending-actions">
              <button
                type="button"
                className="team-pending-btn team-pending-btn--accept"
                disabled={busyId === req.requestId}
                onClick={() => respond(req.requestId, true)}
                aria-label={t('team.accept')}
              >
                <FaCheck />
              </button>
              <button
                type="button"
                className="team-pending-btn team-pending-btn--decline"
                disabled={busyId === req.requestId}
                onClick={() => respond(req.requestId, false)}
                aria-label={t('team.decline')}
              >
                <FaTimes />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
