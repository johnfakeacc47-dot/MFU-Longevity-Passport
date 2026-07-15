import React, { useState, useEffect } from 'react';
import { FaCheck, FaCrown, FaLock, FaUserPlus, FaUser } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import { EmptyState } from '../components/EmptyState';
import { LoadingSkeleton } from '../components/LoadingSkeleton';
import {
  getLeaderboard, getChallengeStatus, isSupabaseConfigured,
  inviteTeamMemberByEmail, getMyTeamLeaderboard, getCurrentUserProfile,
} from '../services/supabaseClient';

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
  const [isInviting, setIsInviting] = useState(false);
  const { t } = useLanguage();

  const currentDayIndex = (() => { const d = new Date().getDay(); return d === 0 ? 6 : d - 1; })();
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const [allTeamsData, setAllTeamsData] = useState<any[]>([]);
  const [myTeamData, setMyTeamData] = useState<any[]>([]);
  const [weekDays, setWeekDays] = useState(DAYS.map(d => ({ day: d, completed: false })));

  const CHALLENGE_GOAL = 500;
  const teamPoints = myTeamData.reduce((s, m) => s + (m.rawPoints || 0), 0);
  const progressPct = Math.min((teamPoints / CHALLENGE_GOAL) * 100, 100);
  const challengeDone = teamPoints >= CHALLENGE_GOAL;

  const fetchData = async () => {
    if (!isSupabaseConfigured()) { setIsLoading(false); return; }
    try {
      const profile = await getCurrentUserProfile();
      if (profile) setIsScorePublic(profile.is_score_public ?? false);

      const mapMember = (m: any) => ({
        id: m.id, name: m.name || 'Unknown',
        points: m.is_score_public ? (m.total_points || 0) : null,
        rawPoints: m.total_points || 0,
        avatar: m.avatar_url,
        role: m.role || 'Member',
        isPublic: m.is_score_public ?? false,
      });

      const lb = await getLeaderboard();
      const myT = await getMyTeamLeaderboard();
      setAllTeamsData(lb.map(mapMember));
      setMyTeamData(myT.map(mapMember));

      const challenges = await getChallengeStatus();
      if (challenges?.length > 0) {
        setWeekDays(DAYS.map(d => {
          const found = challenges.find((c: any) => c.day_name === d);
          return { day: d, completed: found?.completed ?? false };
        }));
      }
    } catch (err) {
      console.error('Team fetch error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleInvite = async () => {
    const email = prompt('Enter member email to invite:');
    if (!email) return;
    setIsInviting(true);
    const res = await inviteTeamMemberByEmail(email.trim());
    setIsInviting(false);
    if (res.success) { alert('Invitation successful!'); fetchData(); }
    else alert(`Error: ${res.error}`);
  };

  const displayData = activeTab === 'myTeam' ? myTeamData : allTeamsData;

  return (
    <div className="team-v2">
      <header className="team-header-v2">
        <BackButton onClick={() => onNavigate('home')} ariaLabel="Go back" />
        <h1 className="team-header-title">{t('team.title')}</h1>
        <button className="team-invite-icon-btn" onClick={handleInvite} aria-label="Invite member" disabled={isInviting}>
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
                <div className="team-score-members">{myTeamData.length} members · {todayDate}</div>
                <div className="team-score-total">{teamPoints.toLocaleString()}</div>
                <div className="team-score-label">{t('team.teamScore')}</div>
              </div>
              <button className="team-invite-btn" onClick={handleInvite} disabled={isInviting}>
                <FaUserPlus /> {isInviting ? 'Inviting...' : 'Invite'}
              </button>
            </div>

            {/* ── Challenge Card ── */}
            <div className={`team-challenge-card ${challengeDone ? 'team-challenge-card--done' : ''}`}>
              <div className="team-challenge-header">
                <h3 className="team-challenge-title">
                  {challengeDone ? '🎉 Challenge Completed!' : t('team.challengeTitle')}
                </h3>
                <span className="team-challenge-points">{teamPoints} / {CHALLENGE_GOAL} pts</span>
              </div>
              <p className="team-challenge-desc">
                {challengeDone
                  ? 'Amazing! Your team reached the 500 point goal. Keep the momentum!'
                  : t('team.joinChallenge')}
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
                  <span className="team-private-note"><FaLock /> Your score is private</span>
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

              {displayData.length === 0 ? (
                <EmptyState
                  icon="👥"
                  title="No members yet"
                  description="Invite friends to your team to start competing!"
                  action="Invite Members"
                  onAction={handleInvite}
                />
              ) : (
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
                          <span className="team-lb-private"><FaLock /> Private</span>
                        )}
                        {i === 0 && <FaCrown className="team-lb-crown" />}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <BottomNav active="team" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
