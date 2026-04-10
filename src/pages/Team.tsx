import React, { useState, useEffect } from 'react';
import { FaCheck, FaCircle, FaLock, FaUsers } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';
import { BottomNav } from '../components/BottomNav';
import { getLeaderboard, getChallengeStatus, isSupabaseConfigured, inviteTeamMemberByEmail, getMyTeamLeaderboard, getCurrentUserProfile } from '../services/supabaseClient';
import { BackButton } from '../components/BackButton';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile'

interface TeamProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const Team: React.FC<TeamProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'myTeam' | 'allTeams'>('myTeam');
  const [isScorePublic, setIsScorePublic] = useState(false);
  const { t } = useLanguage();

  const currentDayIndex = new Date().getDay(); // 0 (Sun) to 6 (Sat)
  const adjustedCurrentDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
  const todayDate = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const [allTeamsData, setAllTeamsData] = useState<any[]>([]);
  const [myTeamData, setMyTeamData] = useState<any[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [weekDays, setWeekDays] = useState([
    { day: 'Mon', completed: false },
    { day: 'Tue', completed: false },
    { day: 'Wed', completed: false },
    { day: 'Thu', completed: false },
    { day: 'Fri', completed: false },
    { day: 'Sat', completed: false },
    { day: 'Sun', completed: false },
  ]);

  const CHALLENGE_GOAL = 500;
  const teamTotalPoints = myTeamData.reduce((sum, member) => sum + (member.rawPoints || 0), 0);
  const progressPercent = Math.min((teamTotalPoints / CHALLENGE_GOAL) * 100, 100);
  const isChallengeCompleted = teamTotalPoints >= CHALLENGE_GOAL;

  const fetchData = async () => {
    if (isSupabaseConfigured()) {
      try {
        // Get current user's sharing preference
        const profile = await getCurrentUserProfile();
        if (profile) {
          setIsScorePublic(profile.is_score_public ?? false);
        }

        const leaderboard = await getLeaderboard();
        setAllTeamsData(leaderboard.map((m: any) => ({
          id: m.id,
          name: m.name,
          points: m.is_score_public ? (m.total_points || 0) : null,
          rawPoints: m.total_points || 0,
          avatar: m.avatar_url,
          rank: m.role || 'Member',
          isPublic: m.is_score_public ?? false,
        })));

        const myTeam = await getMyTeamLeaderboard();
        setMyTeamData(myTeam.map((m: any) => ({
          id: m.id,
          name: m.name,
          points: m.is_score_public ? (m.total_points || 0) : null,
          rawPoints: m.total_points || 0,
          avatar: m.avatar_url,
          rank: m.role || 'Member',
          isPublic: m.is_score_public ?? false,
        })));

        const challenges = await getChallengeStatus();
        if (challenges && challenges.length > 0) {
          const updatedWeekDays = weekDays.map(wd => {
            const found = challenges.find((c: any) => c.day_name === wd.day);
            return found ? { ...wd, completed: found.completed } : wd;
          });
          setWeekDays(updatedWeekDays);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleInvite = async () => {
    const email = prompt("Enter member email to invite:");
    if (email) {
      setIsInviting(true);
      const res = await inviteTeamMemberByEmail(email.trim());
      setIsInviting(false);
      
      if (res.success) {
        alert(`Invitation successful. They have been added to your team.`);
        fetchData();
      } else {
        alert(`Error: ${res.error}`);
      }
    }
  };

  const displayData = activeLeaderboardTab === 'myTeam' ? myTeamData : allTeamsData;

  return (
    <div className="team-container">
      <header className="team-top-header">
        <BackButton onClick={() => onNavigate('home')} ariaLabel="Go back to home" />
        <h1 className="header-title team-header-title">{t('team.title')}</h1>
        <button className="team-action-btn" onClick={handleInvite} aria-label="Invite members">
          <FaUsers aria-hidden="true" />
        </button>
      </header>

      <div className="team-content page-content">
        <div className="members-info">
          <div className="members-count">{myTeamData.length} {t('team.members')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', color: '#1976D2' }}>{todayDate}</div>
          </div>
        </div>

        <div className="team-score-card glass-card">
          <div className="score-header">
            <div className="score-info">
              <div className="score-label">{t('team.teamScore')}</div>
              <div className="score-value">{teamTotalPoints.toLocaleString()}</div>
            </div>
            <button className="invite-btn" onClick={handleInvite} disabled={isInviting}>
              <span className="plus-icon">+</span>
              <div className="invite-text">
                <div className="invite-label">Invite</div>
                <div className="invite-sublabel">Members</div>
              </div>
            </button>
          </div>
        </div>

        <div className="challenge-card glass-card">
          <h3 className="challenge-title">
            {isChallengeCompleted ? 'Challenge Completed!' : t('team.challengeTitle')}
          </h3>
          <p className="challenge-description">
            {isChallengeCompleted 
              ? 'Amazing work! Your team reached the 500 point goal. Keep up the longevity habits!' 
              : `Team has earned ${teamTotalPoints} / ${CHALLENGE_GOAL} points this week.`}
          </p>
          <p className="challenge-join">{t('team.joinChallenge')}</p>
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ 
                width: `${progressPercent}%`,
                transition: 'width 1.5s cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            ></div>
          </div>
          <div className="week-days">
            {weekDays.map((day, index) => (
              <div key={index} className="day-item">
                <div className={`day-circle ${day.completed ? 'completed' : ''} ${index === adjustedCurrentDayIndex ? 'current-day' : ''}`}>
                  {day.completed ? <span className="check-mark"><FaCheck aria-hidden="true" /></span> : (index === adjustedCurrentDayIndex ? <FaCircle size={10} aria-hidden="true" /> : '')}
                </div>
                <div className="day-label" style={{ fontWeight: index === adjustedCurrentDayIndex ? '700' : '400' }}>
                  {day.day}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="leaderboard-section glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="leaderboard-title" style={{ margin: 0 }}>{t('team.leaderboard')}</h3>
            {!isScorePublic && (
              <span style={{ fontSize: '11px', color: '#1976D2', fontStyle: 'italic' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}><FaLock /> Your score is private</span>
              </span>
            )}
          </div>

          <div className="leaderboard-tabs">
            <button 
              className={`leaderboard-tab ${activeLeaderboardTab === 'myTeam' ? 'active' : ''}`}
              onClick={() => setActiveLeaderboardTab('myTeam')}
            >
              {t('team.myTeam')}
            </button>
            <button 
              className={`leaderboard-tab ${activeLeaderboardTab === 'allTeams' ? 'active' : ''}`}
              onClick={() => setActiveLeaderboardTab('allTeams')}
            >
              {t('team.allTeams')}
            </button>
          </div>
          <div className="leaderboard-list">
            {displayData.length > 0 ? (
              displayData.map((member, index) => (
                <div key={member.id} className="leaderboard-item">
                  <div className="member-rank">{index + 1}.</div>
                  <div className="member-avatar">{member.avatar}</div>
                  <div className="member-info">
                    <div className="member-name-line">
                      <span className="member-name">{member.name} {member.rank}</span>
                      {member.tag && <span className="member-tag">{member.tag}</span>}
                    </div>
                    <div className="member-points">
                      {member.isPublic ? `${member.points} pts` : (
                        <span style={{ color: '#1976D2', fontStyle: 'italic', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><FaLock /> Private</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#1976D2', fontStyle: 'italic', fontSize: '14px' }}>
                No members in this team yet. Invite your friends!
              </div>
            )}
          </div>
        </div>
      </div>

      <BottomNav active="team" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
