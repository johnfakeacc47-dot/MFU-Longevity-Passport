import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getLeaderboard, getChallengeStatus, seedDatabase, isSupabaseConfigured, inviteTeamMemberByEmail, getMyTeamLeaderboard } from '../services/supabaseClient';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile'

interface TeamProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const Team: React.FC<TeamProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const [activeLeaderboardTab, setActiveLeaderboardTab] = useState<'myTeam' | 'allTeams'>('myTeam');
  const [isConsentGiven, setIsConsentGiven] = useState(false);
  const { t } = useLanguage();

  const currentDayIndex = new Date().getDay(); // 0 (Sun) to 6 (Sat)
  // Convert JS day (Sun=0) to our weekDays array (Mon=0)
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
  const [isSeeding, setIsSeeding] = useState(false);

  const fetchData = async () => {
    if (isSupabaseConfigured()) {
      try {
        const leaderboard = await getLeaderboard();
        setAllTeamsData(leaderboard.map((m: any) => ({
          id: m.id,
          name: m.name,
          points: m.total_points || 0,
          avatar: m.avatar_url,
          rank: m.role || 'Member'
        })));

        const myTeam = await getMyTeamLeaderboard();
        setMyTeamData(myTeam.map((m: any) => ({
          id: m.id,
          name: m.name,
          points: m.total_points || 0,
          avatar: m.avatar_url,
          rank: m.role || 'Member'
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

  const handleSeed = async () => {
    if (confirm('This will seed the database with mock users and scores. Continue?')) {
      try {
        setIsSeeding(true);
        const result = await seedDatabase();
        if (result && result.success) {
          alert('Data seeded successfully! Refreshing view...');
          await fetchData();
        }
      } catch (error) {
        console.error('Seeding failed:', error);
        alert('Seeding failed. Please check your Supabase connection and SQL schema.');
      } finally {
        setIsSeeding(false);
      }
    }
  };

  const handleInvite = async () => {
    const email = prompt("Enter member email to invite:");
    if (email) {
      setIsInviting(true);
      const res = await inviteTeamMemberByEmail(email.trim());
      setIsInviting(false);
      
      if (res.success) {
        alert(`Invitation successful. They have been added to your team.`);
        fetchData(); // Refresh UI to show new member
      } else {
        alert(`Error: ${res.error}`);
      }
    }
  };

  const teamScore = myTeamData.reduce((sum, member) => sum + (member.points || 0), 0);
  const displayData = activeLeaderboardTab === 'myTeam' ? myTeamData : allTeamsData;

  const handleToggleConsent = () => {
    setIsConsentGiven(!isConsentGiven);
  };

  return (
    <div className="team-container">
      <header className="team-top-header">
        <button className="back-btn" onClick={() => onNavigate('home')}>←</button>
        <h1 className="header-title">{t('team.title')}</h1>
        <button className="add-members-btn" onClick={handleInvite}>👥+</button>
      </header>

      <div className="team-content page-content">
        <div className="members-info">
          <div className="members-count">{myTeamData.length} {t('team.members')}</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
            <div style={{ fontSize: '12px', color: '#666' }}>{todayDate}</div>
            <button 
              onClick={handleSeed} 
              disabled={isSeeding}
              style={{ fontSize: '10px', background: '#f0f0f0', border: '1px solid #ddd', borderRadius: '4px', padding: '2px 6px', cursor: 'pointer' }}
            >
              {isSeeding ? 'Seeding...' : 'Seed Everything ⚡'}
            </button>
          </div>
        </div>

        <div className="team-score-card glass-card">
          <div className="score-header">
            <div className="score-info">
              <div className="score-label">{t('team.teamScore')}</div>
              <div className="score-value">{teamScore.toLocaleString()}</div>
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
          <h3 className="challenge-title">{t('team.challengeTitle')}</h3>
          <p className="challenge-description">
            {t('team.challengeDesc')}
          </p>
          <p className="challenge-join">{t('team.joinChallenge')}</p>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: '57%' }}></div>
          </div>
          <div className="week-days">
            {weekDays.map((day, index) => (
              <div key={index} className="day-item">
                <div className={`day-circle ${day.completed ? 'completed' : ''} ${index === adjustedCurrentDayIndex ? 'current-day' : ''}`}>
                  {day.completed ? <span className="check-mark">✓</span> : (index === adjustedCurrentDayIndex ? '●' : '')}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#666', cursor: 'pointer' }}>
              <input type="checkbox" checked={isConsentGiven} onChange={handleToggleConsent} />
              Share my score
            </label>
          </div>

          {!isConsentGiven ? (
            <div style={{ padding: '20px', textAlign: 'center', background: '#f9f9f9', borderRadius: '12px', border: '1px dashed #ccc' }}>
              <p style={{ fontSize: '13px', color: '#666', marginBottom: '12px' }}>
                You must give consent to share your longevity score with the team to view the leaderboard.
              </p>
              <button 
                onClick={handleToggleConsent}
                style={{ background: '#764ba2', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', cursor: 'pointer', fontSize: '14px' }}
              >
                Allow Sharing
              </button>
            </div>
          ) : (
            <>
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
                        <div className="member-points">{member.points} pts</div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ padding: '20px', textAlign: 'center', color: '#888', fontStyle: 'italic', fontSize: '14px' }}>
                    No members in this team yet. Invite your friends!
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      <footer className="bottom-nav">
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition}>
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('dashboard')}>
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('team')}>
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('profile')}>
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
