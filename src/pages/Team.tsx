import React, { useState, useEffect, useMemo } from 'react';
import { TopBar } from '../components/TopBar';
import { CircleAlert, PartyPopper, UsersRound, QrCode, Flag, Check, Lock, Shield, Plus } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { Group, Row, Chip, IconBtn, IconChip, ICON_PROPS } from '../components/v2';
import { TeamInvite, QrSvg } from '../components/team/TeamInvite';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { buildInviteUrl } from '../services/teamInvite';
import { PendingRequests } from '../components/team/PendingRequests';
import {
  getLeaderboard, getChallengeStatus, isSupabaseConfigured,
  getMyTeamLeaderboard, getCurrentUserProfile, getTodayHealthScore,
} from '../services/supabaseClient';
import { listPendingTeamRequests, type PendingTeamRequest } from '../services/teamInvite';

import type { PageType } from '../types/pages';

interface TeamProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

// Internal day ids — they match `challenges.day_name` from the server, so they
// stay English. What the user *sees* is `dayLabels` (Intl, current language).
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const Team: React.FC<TeamProps> = ({ onNavigate }) => {
  const [activeTab, setActiveTab] = useState<'myTeam' | 'allTeams'>('myTeam');
  const [isScorePublic, setIsScorePublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  // True when a leaderboard call failed — the lists then hold [] (or stale
  // data) and the empty slot shows a "couldn't load / retry" state instead of
  // claiming the team has no members.
  const [loadError, setLoadError] = useState(false);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [qrMember, setQrMember] = useState<{ name: string; handle: string } | null>(null);
  const [pendingRequests, setPendingRequests] = useState<PendingTeamRequest[]>([]);
  const { t, language } = useLanguage();
  const locale = language === 'th' ? 'th-TH' : 'en-US';
  useSEO(`${t('team.title')} · MFU Longevity Passport`, 'Join wellness challenges and compare progress with your team.');

  const currentDayIndex = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  // Short weekday names in the current language (2024-01-01 is a Monday).
  const dayLabels = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return DAYS.map((_, i) => fmt.format(new Date(2024, 0, 1 + i)));
  }, [locale]);

  // null = not loaded yet (show skeleton); [] = loaded and genuinely empty.
  const [allTeamsData, setAllTeamsData] = useState<any[] | null>(null);
  const [myTeamData, setMyTeamData] = useState<any[] | null>(null);
  const [weekDays, setWeekDays] = useState(DAYS.map(d => ({ day: d, completed: false })));

  const daysLeft = 6 - currentDayIndex;
  const CHALLENGE_GOAL = 500;
  const teamPoints = (myTeamData ?? []).reduce((s, m) => s + (m.rawPoints || 0), 0);
  const progressPct = Math.min((teamPoints / CHALLENGE_GOAL) * 100, 100);
  const challengeDone = teamPoints >= CHALLENGE_GOAL;

  const fetchData = async () => {
    setLoadError(false);
    if (!isSupabaseConfigured()) {
      // No backend: resolve the lists to "genuinely empty" rather than leaving
      // them null, which would keep the leaderboard skeleton up forever.
      setAllTeamsData([]);
      setMyTeamData([]);
      setIsLoading(false);
      return;
    }
    try {
      const mapMember = (m: any) => ({
        id: m.id, name: m.name || t('team.unknownMember'),
        points: m.is_score_public ? (m.total_points || 0) : null,
        rawPoints: m.total_points || 0,
        avatar: m.avatar_url,
        role: m.role || t('team.roleMember'),
        isPublic: m.is_score_public ?? false,
        // get_team_profiles() returns each teammate's invite handle; the public leaderboard view does not.
        handle: (m.handle as string | null | undefined) ?? null,
      });

      // One parallel round instead of six sequential awaits. allSettled so one
      // failing call (e.g. pending requests) doesn't blank the whole page.
      const [profileR, lbR, myTR, challengesR, todayScoreR, pendingR] = await Promise.allSettled([
        getCurrentUserProfile(),
        getLeaderboard(),
        getMyTeamLeaderboard(),
        getChallengeStatus(),
        getTodayHealthScore(),
        listPendingTeamRequests(),
      ]);
      const settled = [profileR, lbR, myTR, challengesR, todayScoreR, pendingR];
      settled.forEach((r) => { if (r.status === 'rejected') console.error('Team fetch error:', r.reason); });

      if (pendingR.status === 'fulfilled') setPendingRequests(pendingR.value);

      if (profileR.status === 'fulfilled' && profileR.value) {
        const profile = profileR.value;
        setIsScorePublic(profile.is_score_public ?? false);
        setMyHandle(profile.handle ?? null);
        setMyId(profile.id ?? null);
      }
      // The two leaderboards are the page's core: a failure there is an error
      // state, not "no members". Keep whatever was shown before (or []).
      if (lbR.status === 'fulfilled') setAllTeamsData((lbR.value ?? []).map(mapMember));
      else { setLoadError(true); setAllTeamsData((prev) => prev ?? []); }
      if (myTR.status === 'fulfilled') setMyTeamData((myTR.value ?? []).map(mapMember));
      else { setLoadError(true); setMyTeamData((prev) => prev ?? []); }

      if (challengesR.status === 'fulfilled' && challengesR.value?.length > 0) {
        const challenges = challengesR.value;
        setWeekDays(DAYS.map(d => {
          const found = challenges.find((c: any) => c.day_name === d);
          return { day: d, completed: found?.completed ?? false };
        }));
      }
    } catch (err) {
      console.error('Team fetch error:', err);
      setLoadError(true);
      setAllTeamsData((prev) => prev ?? []);
      setMyTeamData((prev) => prev ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const handleInvite = () => setShowInvite(true);
  const handleRetry = () => { setIsLoading(true); void fetchData(); };

  const displayData = activeTab === 'myTeam' ? myTeamData : allTeamsData;
  const myRow = (myTeamData ?? []).find((m) => m.id === myId);
  const myPoints = myRow?.rawPoints ?? 0;
  const memberCount = (myTeamData ?? []).length;
  const [showAll, setShowAll] = useState(false);
  const visibleRows = (displayData ?? []).slice(0, showAll ? undefined : 3);
  const toChars = (s: string) => (s || '?').trim().slice(0, 2).toUpperCase();

  return (
    <div className="v2-page">
      <TopBar title={t('team.title')} onNavigate={onNavigate}
        actions={<IconBtn label={t('team.addTeammate')} onClick={handleInvite}><QrCode size={22} {...ICON_PROPS} /></IconBtn>} />

      {isLoading ? (
        <div className="v2-empty"><span className="v2-spinner" role="status" aria-label={t('v2.loading')} /></div>
      ) : (
        <>
          <Group>
            <Row pillar="water" icon={<UsersRound size={22} {...ICON_PROPS} />} title={t('team.myTeam')}
              sub={`${t('v2.members')} ${memberCount} ${t('v2.people')}${myHandle ? ` · @${myHandle}` : ''}`}
              chevron onClick={() => setActiveTab('myTeam')} />
          </Group>

          {/* ── Pending requests (QA-008) ── */}
          <PendingRequests requests={pendingRequests} onResolved={fetchData} />

          {/* ── Challenge ── */}
          <section className="v2-card" aria-label={t('team.challengeTitle')}>
            <div className="v2-flag">
              <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                {challengeDone ? <PartyPopper size={18} {...ICON_PROPS} /> : <Flag size={18} {...ICON_PROPS} />}
                {challengeDone ? t('team.challengeDone') : t('team.challengeTitle')}
              </span>
              <span>{daysLeft} {t('v2.daysLeft')}</span>
            </div>
            <p className="v2-h2" style={{ fontSize: 20 }}>{challengeDone ? t('team.challengeDoneDesc') : t('team.joinChallenge')}</p>
            <div className="v2-big">{teamPoints.toLocaleString(locale)} <small>/ {CHALLENGE_GOAL.toLocaleString(locale)} {t('common.pts')}</small></div>
            <div className="v2-bar v2-bar--act" style={{ height: 4 }} role="progressbar" aria-valuenow={Math.round(progressPct)} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${progressPct}%` }} />
            </div>
            <div className="v2-row-top">
              <span className="v2-muted">{t('v2.youContributed')} {myPoints.toLocaleString(locale)} {t('common.pts')}</span>
              <span className="v2-muted v2-tnum">{Math.round(progressPct)}%</span>
            </div>
            <div className="v2-week" aria-label={t('team.challengeTitle')}>
              {weekDays.map((day, i) => (
                <span key={i} className={`v2-day ${day.completed ? 'is-done' : ''} ${i === currentDayIndex ? 'is-today' : ''}`}>
                  <i>{day.completed ? <Check size={14} {...ICON_PROPS} /> : null}</i>
                  <em>{dayLabels[i] ?? day.day}</em>
                </span>
              ))}
            </div>
          </section>

          {/* ── Members ── */}
          <div className="v2-section-head">
            <h2 className="v2-h2">{t('v2.membersTitle')}</h2>
            {displayData && displayData.length > 3 && (
              <button type="button" className="v2-link" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t('v2.showLess') : `${t('v2.viewAll')} ${displayData.length} ${t('v2.people')}`}
              </button>
            )}
          </div>
          <div className="v2-chips">
            <Chip on={activeTab === 'myTeam'} onClick={() => setActiveTab('myTeam')}>{t('team.myTeam')}</Chip>
            <Chip on={activeTab === 'allTeams'} onClick={() => setActiveTab('allTeams')}>{t('team.allTeams')}</Chip>
          </div>

          {displayData === null ? (
            <div className="v2-empty"><span className="v2-spinner" role="status" aria-label={t('v2.loading')} /></div>
          ) : displayData.length === 0 && loadError ? (
            <div className="v2-empty">
              <IconChip pillar="danger" size="lg"><CircleAlert size={24} {...ICON_PROPS} /></IconChip>
              <p className="v2-muted">{t('team.loadError')}</p>
              <button type="button" className="v2-btn v2-btn--primary v2-btn--sm" onClick={handleRetry}>{t('team.retry')}</button>
            </div>
          ) : displayData.length === 0 ? (
            <div className="v2-empty">
              <IconChip pillar="water" size="lg"><UsersRound size={24} {...ICON_PROPS} /></IconChip>
              <p style={{ fontWeight: 700 }}>{t('team.noMembers')}</p>
              <p className="v2-muted">{t('team.noMembersDesc')}</p>
            </div>
          ) : (
            <Group>
              {visibleRows.map((member) => {
                // I always see my own real score; privacy only hides it from *others*.
                const isMe = member.id === myId;
                const showPoints = isMe || member.isPublic;
                return (
                  <div key={member.id} className="v2-row">
                    {member.avatar
                      ? <img src={member.avatar} alt="" className="v2-thumb" style={{ borderRadius: '50%', width: 44, height: 44 }} />
                      : <span className="v2-avatar">{toChars(member.name)}</span>}
                    <span className="v2-row-main">
                      <span className="v2-row-title">{member.name}</span>
                      <span className="v2-row-sub">{member.role}</span>
                    </span>
                    {(() => {
                      const handle = isMe ? (myHandle ?? member.handle) : member.handle;
                      return handle ? (
                        <button type="button" className="v2-iconbtn v2-iconbtn--sm" aria-label={`${t('v2.memberQr')} · ${member.name}`}
                          onClick={() => setQrMember({ name: member.name, handle })}>
                          <QrCode size={18} {...ICON_PROPS} />
                        </button>
                      ) : null;
                    })()}
                    <span style={{ textAlign: 'right' }}>
                      {showPoints ? (
                        <>
                          <span className="v2-row-val" style={{ display: 'block' }}>{member.rawPoints.toLocaleString(locale)}</span>
                          <span className="v2-row-sub">{t('common.pts')}</span>
                        </>
                      ) : (
                        <span className="v2-row-sub" style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><Lock size={14} {...ICON_PROPS} /> {t('team.private')}</span>
                      )}
                    </span>
                  </div>
                );
              })}
            </Group>
          )}

          {!isScorePublic && (
            <p className="v2-note"><Shield size={18} {...ICON_PROPS} /><span>{t('team.scorePrivate')}</span></p>
          )}

          <button type="button" className="v2-btn v2-btn--ghost" onClick={handleInvite}>
            <Plus size={20} {...ICON_PROPS} /> {t('team.addTeammate')}
          </button>
        </>
      )}

      <ConfirmDialog
        open={!!qrMember}
        title={qrMember ? `${t('v2.memberQr')} · ${qrMember.name}` : ''}
        message={qrMember && (
          <div style={{ display: 'grid', justifyItems: 'center', gap: 10 }}>
            <QrSvg text={buildInviteUrl(qrMember.handle)} />
            <b style={{ fontSize: 18 }}>@{qrMember.handle}</b>
            <span className="v2-muted">{t('v2.memberQrHint')}</span>
          </div>
        )}
        confirmLabel={t('common.close')}
        onConfirm={() => setQrMember(null)}
        onClose={() => setQrMember(null)}
      />
      <TeamInvite myHandle={myHandle} open={showInvite} onOpenChange={setShowInvite} onMemberAdded={fetchData} />

    </div>
  );
};
