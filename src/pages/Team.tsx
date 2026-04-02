import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getLeaderboard, getChallengeStatus, isSupabaseConfigured, inviteTeamMemberByEmail, getMyTeamLeaderboard, getCurrentUserProfile } from '../services/supabaseClient';
import { Icon } from '../components/Icon';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile'

interface TeamProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

interface TeamMember { id: string; name: string; points: number | null; rawPoints: number; avatar: string; rank: string; isPublic: boolean; tag?: string; }

export const Team: React.FC<TeamProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'myTeam' | 'allTeams'>('myTeam');
  const [isScorePublic, setIsScorePublic] = useState(false);
  const { t } = useLanguage();

  const currentDayIndex = new Date().getDay(); // 0 (Sun) to 6 (Sat)
  const adjustedCurrentDayIndex = currentDayIndex === 0 ? 6 : currentDayIndex - 1;
  const todayDate = new Date().toLocaleDateString(t('locale') || 'en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  const [allTeamsData, setAllTeamsData] = useState<TeamMember[]>([]);
  const [myTeamData, setMyTeamData] = useState<TeamMember[]>([]);
  const [isInviting, setIsInviting] = useState(false);
  const [weekDays, setWeekDays] = useState([
    { day: 'Mon', key: 'team.mon', completed: false },
    { day: 'Tue', key: 'team.tue', completed: false },
    { day: 'Wed', key: 'team.wed', completed: false },
    { day: 'Thu', key: 'team.thu', completed: false },
    { day: 'Fri', key: 'team.fri', completed: false },
    { day: 'Sat', key: 'team.sat', completed: false },
    { day: 'Sun', key: 'team.sun', completed: false },
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
        setAllTeamsData(leaderboard.map((m: { id: string; name: string; is_score_public?: boolean; total_points?: number; avatar_url: string; role?: string; }) => ({
          id: m.id,
          name: m.name,
          points: m.is_score_public ? (m.total_points || 0) : null,
          rawPoints: m.total_points || 0,
          avatar: m.avatar_url,
          rank: m.role ? t('team.member') : t('team.member'), // Defaulting to localized 'Member'
          isPublic: m.is_score_public ?? false,
        })));

        const myTeam = await getMyTeamLeaderboard();
        setMyTeamData(myTeam.map((m: { id: string; name: string; is_score_public?: boolean; total_points?: number; avatar_url: string; role?: string; }) => ({
          id: m.id,
          name: m.name,
          points: m.is_score_public ? (m.total_points || 0) : null,
          rawPoints: m.total_points || 0,
          avatar: m.avatar_url,
          rank: m.role ? t('team.member') : t('team.member'), // Defaulting to localized 'Member'
          isPublic: m.is_score_public ?? false,
        })));

        const challenges = await getChallengeStatus();
        if (challenges && challenges.length > 0) {
          const updatedWeekDays = weekDays.map(wd => {
            const found = challenges.find((c: { day_name: string; completed: boolean }) => c.day_name === wd.day);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        <button className="back-btn" onClick={() => onNavigate('home')}>
          <Icon name="activity" size={20} className="rotate-180" />
        </button>
        <h1 className="header-title">{t('team.title')}</h1>
        <button className="add-members-btn" onClick={handleInvite}>
          <Icon name="team" size={20} color="#4f46e5" />
          <span className="font-black text-[18px] ml-1">+</span>
        </button>
      </header>

      <div className="team-content page-content">
        <div className="members-info">
          <div className="members-count">{myTeamData.length} {t('team.members')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{todayDate}</div>
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
                <div className="invite-label">{t('team.invite')}</div>
                <div className="invite-sublabel">{t('team.membersLabel')}</div>
              </div>
            </button>
          </div>
        </div>

        <div className="challenge-card glass-card">
          <h3 className="challenge-title">
            {isChallengeCompleted ? t('team.challengeCompleted') : t('team.challengeTitle')}
          </h3>
          <p className="challenge-description">
            {isChallengeCompleted 
              ? t('team.completedDesc') 
              : t('team.progressDesc').replace('{points}', teamTotalPoints.toString()).replace('{goal}', CHALLENGE_GOAL.toString())}
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
                  {day.completed ? <span className="check-mark">✓</span> : (index === adjustedCurrentDayIndex ? '●' : '')}
                </div>
                <div className="day-label" style={{ fontWeight: index === adjustedCurrentDayIndex ? '700' : '400' }}>
                  {t(day.key)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="leaderboard-section glass-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="leaderboard-title" style={{ margin: 0 }}>{t('team.leaderboard')}</h3>
            {!isScorePublic && (
              <span style={{ fontSize: '11px', color: '#999', fontStyle: 'italic' }}>
                🔒 {t('team.scorePrivate')}
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
                      {member.isPublic ? `${member.points} ${t('team.pts')}` : (
                        <span style={{ color: '#aaa', fontStyle: 'italic', fontSize: '12px' }}>🔒 {t('team.private')}</span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
                {t('team.noMembers')}
              </div>
            )}
          </div>
        </div>
      </div>

      <footer className="bottom-nav">
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <Icon name="home" size={24} color="#718096" />
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition}>
          <Icon name="nutrition" size={24} color="#718096" />
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('dashboard')}>
          <Icon name="activity" size={24} color="#718096" />
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('team')}>
          <Icon name="team" size={24} color="#0ea5e9" />
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('profile')}>
          <Icon name="profile" size={24} color="#718096" />
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
