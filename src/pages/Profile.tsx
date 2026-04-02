import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { isSupabaseConfigured, getCurrentUserProfile } from '../services/supabaseClient';
import { Icon } from '../components/Icon';

import { useLanguage } from '../contexts/LanguageContext';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker'

interface ProfileProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
  onLogout: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ onNavigate, onOpenFoodRecognition, onLogout }) => {
  const [weightNotification, setWeightNotification] = useState(true);
  const [activityNotification, setActivityNotification] = useState(false);
  const [mealNotification, setMealNotification] = useState(true);
  const { language, setLanguage, t } = useLanguage();
  const [userRole, setUserRole] = useState<string>('student');
  const [profileData, setProfileData] = useState<{
    fullName?: string;
    email?: string;
    birthDate?: string;
    heightCm?: string;
    weightKg?: string;
  }>({});

  const requestNotificationPermission = async (callback: (granted: boolean) => void) => {
    if (!('Notification' in window)) {
      alert(t('profile.notSupported'));
      callback(false);
      return;
    }
    
    if (Notification.permission === 'granted') {
      callback(true);
      return;
    }
    
    if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      callback(permission === 'granted');
    } else {
      callback(false);
    }
  };

  const handleToggleNotification = (
    value: boolean, 
    setter: React.Dispatch<React.SetStateAction<boolean>>
  ) => {
    if (value) {
      requestNotificationPermission((granted) => {
        setter(granted);
      });
    } else {
      setter(false);
    }
  };



  const fetchProfileData = useCallback(async () => {
    // 1. Try Supabase First
    if (isSupabaseConfigured()) {
      const dbProfile = await getCurrentUserProfile();
      if (dbProfile) {
        setProfileData({
          fullName: dbProfile.name,
          email: dbProfile.email,
          birthDate: dbProfile.birth_date,
          heightCm: dbProfile.height_cm ? String(dbProfile.height_cm) : undefined,
          weightKg: dbProfile.weight_kg ? String(dbProfile.weight_kg) : undefined,
        });
        setUserRole(dbProfile.role || 'student'); // SECURE ROLE FETCH
        return; // Skip fallback
      }
      
      // If Supabase is active but no profile exists, it's a new user.
      const userEmail = localStorage.getItem('userEmail');
      setProfileData({
        fullName: t('profile.newUser'),
        email: userEmail || undefined
      });
      setUserRole('student'); // Default role
      return; // DO NOT fallback to local storage to prevent cross-contamination
    }

    // 2. Fallback to LocalStorage
    const stored = localStorage.getItem('profileData');
    if (stored) {
      setProfileData(JSON.parse(stored));
      // Try to get role from token if offline
      const token = localStorage.getItem('authToken');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          setUserRole(payload.role || 'student');
        } catch {
          setUserRole('student');
        }
      }
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchProfileData();
    
    // Listen for updates from EditProfile
    const handleProfileUpdate = () => fetchProfileData();
    window.addEventListener('profileUpdated', handleProfileUpdate);

    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, [fetchProfileData]);

  const ageYears = useMemo(() => {
    if (!profileData.birthDate) return null;
    const birth = new Date(profileData.birthDate);
    if (Number.isNaN(birth.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age -= 1;
    }
    return age;
  }, [profileData.birthDate]);

  const toggleLanguage = () => {
    setLanguage(language === 'th' ? 'en' : 'th');
  };

  const handleResetData = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      const confirmReset = window.confirm(t('profile.resetConfirm'));
      
      if (confirmReset) {
        localStorage.removeItem('meals');
        localStorage.removeItem('sleepLogs');
        localStorage.removeItem('activities');
        localStorage.removeItem('fastingState');
        localStorage.removeItem('aiFeedback');
        localStorage.removeItem('offlineQueue');
        alert(t('profile.resetSuccess'));
        onNavigate('home');
      } else {
        // Uncheck the toggle if they cancelled
        e.target.checked = false;
      }
    }
  };

  return (
    <div className="profile-container">
      <header className="profile-top-header">
        <button className="back-btn" onClick={() => onNavigate('home')}>
          <Icon name="activity" size={20} className="rotate-180" />
        </button>
        <h1 className="header-title">{t('profile.title')}</h1>
        <div className="header-spacer" style={{ width: 60 }} />
      </header>

      <div className="profile-content page-content">
        <div className="profile-card">
          <div className="profile-avatar">
            <div className="avatar-circle">P</div>
          </div>
          <h2 className="profile-name">{profileData.fullName || t('profile.newUser')}</h2>
          <p className="profile-email">
            {t('profile.email')} {profileData.email || t('profile.notSet')}
          </p>
        </div>

        <div className="info-section">
          <div className="section-header">
            <span className="section-icon">👤</span>
            <span className="section-title">{t('profile.personalInfo')}</span>
          </div>
          <div className="info-subtitle">{t('profile.fullName')}</div>

          <div className="body-metrics">
            <div className="metric-item">
              <div className="metric-label">{t('profile.age')}</div>
              <div className="metric-row">
                <span className="metric-icon">🎂</span>
                <div className="metric-value">{ageYears ?? '-'}</div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">{t('profile.weight')}</div>
              <div className="metric-row">
                <span className="metric-icon">⚖️</span>
                <div className="metric-value">{profileData.weightKg || '-'}</div>
              </div>
            </div>
            <div className="metric-item">
              <div className="metric-label">{t('profile.height')}</div>
              <div className="metric-row">
                <span className="metric-icon">📏</span>
                <div className="metric-value">{profileData.heightCm || '-'}</div>
              </div>
            </div>
          </div>

          <button className="update-profile-btn" onClick={() => onNavigate('edit-profile')}>
            {t('profile.updateProfile')}
          </button>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <span className="section-icon">🌐</span>
            <span className="section-title">{t('profile.language')}</span>
          </div>
          
          <button className="language-toggle-btn" onClick={toggleLanguage}>
            <div className="language-content">
              <span className="language-label">
                {language === 'th' ? t('profile.languageThai') : t('profile.languageEnglish')}
              </span>
              <span className="arrow">›</span>
            </div>
          </button>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <span className="section-icon">🍎</span>
            <span className="section-title">{t('profile.notificationSettings')}</span>
          </div>

          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-text">
                <div className="setting-title">{t('profile.fastingAlert')}</div>
                <div className="setting-description">{t('profile.fastingAlertDesc')}</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={weightNotification}
                  onChange={(e) => handleToggleNotification(e.target.checked, setWeightNotification)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-text">
                <div className="setting-title">{t('profile.activityAlert')}</div>
                <div className="setting-description">{t('profile.activityAlertDesc')}</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={activityNotification}
                  onChange={(e) => handleToggleNotification(e.target.checked, setActivityNotification)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="setting-item">
              <div className="setting-text">
                <div className="setting-title">{t('profile.mealAlert')}</div>
                <div className="setting-description">{t('profile.mealAlertDesc')}</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={mealNotification}
                  onChange={(e) => handleToggleNotification(e.target.checked, setMealNotification)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>


          </div>
        </div>

        <div className="settings-section">
          <div className="section-header">
            <span className="section-icon">🛠️</span>
            <span className="section-title">{t('profile.developerTools')}</span>
          </div>
          <div className="settings-list">
            <div className="setting-item">
              <div className="setting-text">
                <div className="setting-title" style={{ color: '#d32f2f' }}>{t('profile.resetData')}</div>
                <div className="setting-description">{t('profile.resetDataDesc')}</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  onChange={handleResetData}
                />
                <span className="toggle-slider" style={{ backgroundColor: '#ffcdd2' }}></span>
              </label>
            </div>
          </div>
        </div>

        <div className="menu-section">
          <button className="menu-item" onClick={() => onNavigate('privacy-settings')}>
            <span>{t('profile.privacySettings')}</span>
            <span className="arrow">›</span>
          </button>
          <button className="menu-item" onClick={() => onNavigate('set-goals')}>
            <span>{t('profile.setGoals')}</span>
            <span className="arrow">›</span>
          </button>
          <button className="menu-item" onClick={() => onNavigate('about-tracker')}>
            <span>{t('profile.aboutTracker')}</span>
            <span className="arrow">›</span>
          </button>
          {(userRole === 'admin' || profileData.email === '6631503029@lamduan.mfu.ac.th') && (
            <button className="menu-item admin-only" onClick={() => onNavigate('user-management')} style={{ borderLeft: '4px solid #4f46e5' }}>
              <span>👥 Manage Users</span>
              <span className="arrow">›</span>
            </button>
          )}
        </div>

        <button className="logout-btn" onClick={onLogout}>
          {t('profile.logout')}
        </button>

        <div className="version-info">
          {t('profile.version')} 1.0.0
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
        <button className="nav-icon" onClick={() => onNavigate('team')}>
          <Icon name="team" size={24} color="#718096" />
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('profile')}>
          <Icon name="profile" size={24} color="#0ea5e9" />
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
