import React, { useState, useEffect } from 'react';
import { FaCheck, FaCrown, FaLock, FaUserPlus, FaUser } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import { TeamInvite } from '../components/team/TeamInvite';
import { GardenPlant } from '../components/garden/GardenPlant';
import { stageFromPoints } from '../utils/growthStage';
import '../styles/Garden.css';
import {
  getLeaderboard, getChallengeStatus, isSupabaseConfigured,
  getMyTeamLeaderboard, getCurrentUserProfile, getTodayHealthScore,
} from '../services/supabaseClient';

// health_scores RLS is "own rows only" (supabase/migrations/0001_enable_rls.sql),
// so a teammate's real *daily* pillar breakdown isn't visible to us — only
// their all-time total_points is, and only when they've opted into
// is_score_public. So the Team Garden shows each member's real growth
// *stage* (their honestly-earned tree size) against one steady, non-
// personal reference day, rather than guessing at data we can't see.
const TEAM_GARDEN_REFERENCE = { nutrition: 15, exercise: 15, sleep: 15, mental: 15 };

type PageType = 'login' | 'home' | 'eating' | 'dashboard' | 'team' | 'profile' | 'edit-profile';

interface TeamProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const RANK_MEDALS = ['🥇', '🥈', '🥉'];
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export const Team: React.FC<TeamProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const [activeTab, setActiveTab] = useState<'myTeam' | 'allTeams'>('myTeam');
  const [isScorePublic, setIsScorePublic] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [myHandle, setMyHandle] = useState<string | null>(null);
  const [myId, setMyId] = useState<string | null>(null);
  // Real today breakdown for *my own* row only — the Team Garden falls
  // back to TEAM_GARDEN_REFERENCE for everyone else since RLS doesn't
  // expose a teammate's real daily pillars, but there's no reason my own
  // tree here should look different from the one on Home.
  const [myBreakdown, setMyBreakdown] = useState<typeof TEAM_GARDEN_REFERENCE | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const { t } = useLanguage();
  useSEO(`${t('team.title')} · MFU Longevity Passport`, 'Join wellness challenges and compare progress with your team.');

  const currentDayIndex = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  // null = not loaded yet (show skeleton); [] = loaded and genuinely empty.
  const [allTeamsData, setAllTeamsData] = useState<any[] | null>(null);
  const [myTeamData, setMyTeamData] = useState<any[] | null>(null);
  const [weekDays, setWeekDays] = useState(DAYS.map(d => ({ day: d, completed: false })));

  const CHALLENGE_GOAL = 500;
  const teamPoints = (myTeamData ?? []).reduce((s, m) => s + (m.rawPoints || 0), 0);
  const progressPct = Math.min((teamPoints / CHALLENGE_GOAL) * 100, 100);
  const challengeDone = teamPoints >= CHALLENGE_GOAL;

  const fetchData = async () => {
    if (!isSupabaseConfigured()) { setIsLoading(false); return; }
    try {
      const mapMember = (m: any) => ({
        id: m.id, name: m.name || t('team.unknownMember'),
        points: m.is_score_public ? (m.total_points || 0) : null,
        rawPoints: m.total_points || 0,
        avatar: m.avatar_url,
        role: m.role || 'Member',
        isPublic: m.is_score_public ?? false,
      });

      // One parallel round instead of five sequential awaits.
      const [profile, lb, myT, challenges, todayScore] = await Promise.all([
        getCurrentUserProfile(),
        getLeaderboard(),
        getMyTeamLeaderboard(),
        getChallengeStatus(),
        getTodayHealthScore(),
      ]);

      if (profile) {
        setIsScorePublic(profile.is_score_public ?? false);
        setMyHandle(profile.handle ?? null);
        setMyId(profile.id ?? null);
      }
      if (todayScore) {
        setMyBreakdown({
          nutrition: todayScore.nutrition ?? 0,
          exercise: todayScore.activity ?? 0,
          sleep: todayScore.sleep ?? 0,
          mental: todayScore.fasting ?? 0,
        });
      }
      setAllTeamsData((lb ?? []).map(mapMember));
      setMyTeamData((myT ?? []).map(mapMember));

      if (challenges?.length > 0) {
        setWeekDays(DAYS.map(d => {
          const found = challenges.find((c: any) => c.day_name === d);
          return { day: d, completed: found?.completed ?? false };
        }));
      }
    } catch (err) {
      console.error('Team fetch error:', err);
      setAllTeamsData((prev) => prev ?? []);
      setMyTeamData((prev) => prev ?? []);
    } finally {
      setIsLoading(false);
    }
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { fetchData(); }, []);

  const handleInvite = () => setShowInvite(true);

  const displayData = activeTab === 'myTeam' ? myTeamData : allTeamsData;

  return (
    <div className="team-v2">
      <header className="team-header-v2">
        <BackButton onClick={() => onNavigate('home')} ariaLabel="Go back" />
        <h1 className="team-header-title">{t('team.title')}</h1>
        <button className="team-invite-icon-btn" onClick={handleInvite} aria-label="Invite member">
          <FaUserPlus />
        </button>
      </header>

      <div className="team-content-v2 page-content">
        {isLoading ? (
          <LoadingSkeleton type="list" />
        ) : (
          <>
            {/* ── Team Score Hero ── */}
            <div className="team-score-hero">
              <div className="team-score-left">
                <div className="team-score-members">{(myTeamData ?? []).length} {t('team.members')} · {todayDate}</div>
                <div className="team-score-total">{teamPoints.toLocaleString()}</div>
                <div className="team-score-label">{t('team.teamScore')}</div>
              </div>
              <button className="team-invite-btn" onClick={handleInvite}>
                <FaUserPlus /> {t('team.addTeammate')}
              </button>
            </div>

            {/* ── Invite by QR / code ── */}
            <TeamInvite
              myHandle={myHandle}
              open={showInvite}
              onOpenChange={setShowInvite}
              onMemberAdded={fetchData}
            />

            {/* ── Challenge Card ── */}
            <div className={`team-challenge-card ${challengeDone ? 'team-challenge-card--done' : ''}`}>
              <div className="team-challenge-header">
                <h3 className="team-challenge-title">
                  {challengeDone ? `🎉 ${t('team.challengeDone')}` : t('team.challengeTitle')}
                </h3>
                <span className="team-challenge-points">{teamPoints} / {CHALLENGE_GOAL} {t('common.pts')}</span>
              </div>
              <p className="team-challenge-desc">
                {challengeDone ? t('team.challengeDoneDesc') : t('team.joinChallenge')}
              </p>
              <div className="team-progress-bar">
                <div className="team-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>

              {/* Week Days */}
              <div className="team-week-days">
                {weekDays.map((day, i) => (
                  <div key={i} className="team-day">
                    <div className={`team-day-circle ${day.completed ? 'team-day-circle--done' : ''} ${i === currentDayIndex ? 'team-day-circle--today' : ''}`}>
                      {day.completed ? <FaCheck className="team-day-check" /> : (i === currentDayIndex ? '•' : '')}
                    </div>
                    <div className={`team-day-label ${i === currentDayIndex ? 'team-day-label--today' : ''}`}>{day.day}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Leaderboard ── */}
            <div className="team-leaderboard-section">
              <div className="team-lb-header">
                <h3 className="team-lb-title">{t('team.leaderboard')}</h3>
                {!isScorePublic && (
                  <span className="team-private-note"><FaLock /> {t('team.scorePrivate')}</span>
                )}
              </div>

              <div className="team-lb-tabs">
                <button
                  className={`team-lb-tab ${activeTab === 'myTeam' ? 'team-lb-tab--active' : ''}`}
                  onClick={() => setActiveTab('myTeam')}
                >
                  {t('team.myTeam')}
                </button>
                <button
                  className={`team-lb-tab ${activeTab === 'allTeams' ? 'team-lb-tab--active' : ''}`}
                  onClick={() => setActiveTab('allTeams')}
                >
                  {t('team.allTeams')}
                </button>
              </div>

              {displayData === null ? (
                <LoadingSkeleton type="list" />
              ) : displayData.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title={t('team.noMembers')}
                  description={t('team.noMembersDesc')}
                  action={t('team.inviteMembers')}
                  onAction={handleInvite}
                />
              ) : (
                <>
                  <div className="team-garden-row">
                    {displayData.map((member) => {
                      // My own row always shows my real stage/today, same as
                      // Home — privacy settings govern what *others* see
                      // about me, not what I see about myself. Everyone
                      // else's private row stays a generic silhouette.
                      const isMe = member.id === myId;
                      const visible = isMe || member.isPublic;
                      return (
                        <div key={member.id} className={`team-garden-cell ${!visible ? 'is-private' : ''}`}>
                          <GardenPlant
                            breakdown={isMe && myBreakdown ? myBreakdown : TEAM_GARDEN_REFERENCE}
                            stage={visible ? stageFromPoints(member.rawPoints) : 1}
                            size={48}
                          />
                          <span className="team-garden-name">{visible ? member.name : t('team.private')}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="team-lb-list">
                  {displayData.map((member, i) => (
                    <div key={member.id} className={`team-lb-card ${i < 3 ? 'team-lb-card--top' : ''}`}>
                      <div className="team-lb-rank">
                        {i < 3 ? (
                          <span className="team-lb-medal">{RANK_MEDALS[i]}</span>
                        ) : (
                          <span className="team-lb-rank-num">{i + 1}</span>
                        )}
                      </div>
                      <div className="team-lb-avatar">
                        {member.avatar
                          ? <img src={member.avatar} alt={member.name} className="team-lb-avatar-img" />
                          : <div className="team-lb-avatar-placeholder">{member.name?.[0]?.toUpperCase() ?? <FaUser className="team-lb-default-icon" />}</div>
                        }
                      </div>
                      <div className="team-lb-info">
                        <div className="team-lb-name">{member.name}</div>
                        <div className="team-lb-role">{member.role}</div>
                      </div>
                      <div className="team-lb-points">
                        {member.isPublic ? (
                          <>
                            <span className="team-lb-points-val">{member.points?.toLocaleString()}</span>
                            <span className="team-lb-pts-label">pts</span>
                          </>
                        ) : (
                          <span className="team-lb-private"><FaLock /> {t('team.private')}</span>
                        )}
                        {i === 0 && <FaCrown className="team-lb-crown" />}
                      </div>
                    </div>
                  ))}
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav active="team" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
