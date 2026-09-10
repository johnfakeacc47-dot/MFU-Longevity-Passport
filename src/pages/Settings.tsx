import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { useTheme } from '../contexts/ThemeContext';
import type { Theme } from '../contexts/ThemeContext';
import { BottomNav } from '../components/BottomNav';
import { BackButton } from '../components/BackButton';
import {
  FaGlobe,
  FaPalette,
  FaBell,
  FaShieldAlt,
  FaBullseye,
  FaUsers,
  FaInfoCircle,
  FaSignOutAlt,
  FaCheck,
  FaSun,
  FaMoon,
  FaDesktop,
  FaChevronRight,
  FaMobileAlt,
} from 'react-icons/fa';
import {
  getNotificationPreferences, updateNotificationPreference, subscribeToPush, isPushSubscribed,
  type NotificationPrefs,
} from '../services/notifications';
import '../styles/Settings.css';

const DEFAULT_PREFS: NotificationPrefs = {
  mealReminder: true, waterReminder: true, sleepReminder: true,
  activityReminder: true, fastingReminder: true, teamNotifs: true, challengeNotifs: true,
};

interface SettingsProps {
  onNavigate: (page: any) => void;
  currentPage?: string;
  onOpenFoodRecognition?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate, onOpenFoodRecognition = () => {} }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  useSEO(`${t('settings.title')} · MFU Longevity Passport`, 'Configure app preferences and account options.');

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
    if (pushSupported) isPushSubscribed().then(setPushEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePref = (key: keyof NotificationPrefs, checked: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: checked }));
    void updateNotificationPreference(key, checked);
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    const ok = await subscribeToPush();
    setPushEnabled(ok);
    setPushBusy(false);
  };

  const handleLogout = () => {
    if (window.confirm(t('settings.logoutConfirm'))) {
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userEmail');
      onNavigate('login');
    }
  };

  return (
    <div className="settings-page">
      {/* Header */}
      <header className="pv2-header">
        <BackButton onClick={() => onNavigate('profile')} ariaLabel={t('common.back') || 'Go back'} />
        <h1 className="pv2-header-title">{t('settings.title')}</h1>
        <div style={{ width: 44 }} />
      </header>

      <main className="settings-content">
        {/* Language Section */}
        <section className="settings-section card">
          <div className="section-header">
            <div className="section-icon text-blue-500">
              <FaGlobe />
            </div>
            <div>
              <h2>{t('settings.language')}</h2>
              <p>{t('settings.languageDesc')}</p>
            </div>
          </div>
          
          <div className="options-grid">
            <button
              type="button"
              className={`option-btn ${language === 'th' ? 'active' : ''}`}
              onClick={() => setLanguage('th')}
            >
              <div className="option-badge bg-blue-500/15 text-blue-500 border border-blue-500/30">
                TH
              </div>
              <span className="option-label">{t('settings.languageThai')}</span>
              {language === 'th' && (
                <span className="check-badge">
                  <FaCheck />
                </span>
              )}
            </button>

            <button
              type="button"
              className={`option-btn ${language === 'en' ? 'active' : ''}`}
              onClick={() => setLanguage('en')}
            >
              <div className="option-badge bg-blue-500/15 text-blue-500 border border-blue-500/30">
                EN
              </div>
              <span className="option-label">{t('settings.languageEnglish')}</span>
              {language === 'en' && (
                <span className="check-badge">
                  <FaCheck />
                </span>
              )}
            </button>
          </div>
        </section>

        {/* Appearance Section */}
        <section className="settings-section card">
          <div className="section-header">
            <div className="section-icon text-purple-500">
              <FaPalette />
            </div>
            <div>
              <h2>{t('settings.appearance')}</h2>
              <p>{t('settings.appearanceDesc')}</p>
            </div>
          </div>

          <div className="options-grid theme-grid">
            <button
              type="button"
              className={`option-btn ${theme === 'light' ? 'active' : ''}`}
              onClick={() => setTheme('light' as Theme)}
            >
              <span className="option-icon text-amber-500">
                <FaSun />
              </span>
              <span className="option-label">{t('settings.themeLight')}</span>
              {theme === 'light' && (
                <span className="check-badge">
                  <FaCheck />
                </span>
              )}
            </button>

            <button
              type="button"
              className={`option-btn ${theme === 'dark' ? 'active' : ''}`}
              onClick={() => setTheme('dark' as Theme)}
            >
              <span className="option-icon text-blue-400">
                <FaMoon />
              </span>
              <span className="option-label">{t('settings.themeDark')}</span>
              {theme === 'dark' && (
                <span className="check-badge">
                  <FaCheck />
                </span>
              )}
            </button>

            <button
              type="button"
              className={`option-btn ${theme === 'system' ? 'active' : ''}`}
              onClick={() => setTheme('system' as Theme)}
            >
              <span className="option-icon text-slate-400">
                <FaDesktop />
              </span>
              <span className="option-label">{t('settings.themeSystem')}</span>
              {theme === 'system' && (
                <span className="check-badge">
                  <FaCheck />
                </span>
              )}
            </button>
          </div>
        </section>

        {/* Notifications Section */}
        <section className="settings-section card">
          <div className="section-header">
            <div className="section-icon text-amber-500">
              <FaBell />
            </div>
            <div>
              <h2>{t('settings.notifications')}</h2>
            </div>
          </div>

          <div className="toggle-list">
            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.mealAlert')}</strong>
                <span>{t('settings.mealAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.mealReminder} onChange={(e) => togglePref('mealReminder', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.waterAlert')}</strong>
                <span>{t('settings.waterAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.waterReminder} onChange={(e) => togglePref('waterReminder', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.sleepAlert')}</strong>
                <span>{t('settings.sleepAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.sleepReminder} onChange={(e) => togglePref('sleepReminder', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.activityAlert')}</strong>
                <span>{t('settings.activityAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.activityReminder} onChange={(e) => togglePref('activityReminder', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.fastingAlert')}</strong>
                <span>{t('settings.fastingAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.fastingReminder} onChange={(e) => togglePref('fastingReminder', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.teamAlert')}</strong>
                <span>{t('settings.teamAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.teamNotifs} onChange={(e) => togglePref('teamNotifs', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.challengeAlert')}</strong>
                <span>{t('settings.challengeAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.challengeNotifs} onChange={(e) => togglePref('challengeNotifs', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>
          </div>
        </section>

        {/* Push Notifications */}
        <section className="settings-section card">
          <div className="section-header">
            <div className="section-icon text-blue-500">
              <FaMobileAlt />
            </div>
            <div>
              <h2>{t('settings.pushEnable')}</h2>
              <p>{t('settings.pushEnableDesc')}</p>
            </div>
          </div>
          {!pushSupported ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{t('settings.pushUnsupported')}</p>
          ) : pushEnabled ? (
            <div className="toggle-item">
              <div className="toggle-info"><strong style={{ color: 'var(--color-success, #10B981)' }}>{t('settings.pushEnabled')}</strong></div>
              <FaCheck style={{ color: 'var(--color-success, #10B981)' }} />
            </div>
          ) : (
            <button type="button" className="btn" onClick={handleEnablePush} disabled={pushBusy} style={{ width: '100%' }}>
              {pushBusy ? t('common.loading') : t('settings.pushEnableBtn')}
            </button>
          )}
        </section>

        {/* Additional Settings / Links */}
        <section className="settings-section card">
          <div className="settings-links">
            <button className="settings-link-btn" onClick={() => onNavigate('privacy-settings')}>
              <div className="flex items-center gap-3">
                <span className="settings-link-icon text-emerald-500 bg-emerald-500/15">
                  <FaShieldAlt />
                </span>
                <span>{t('settings.privacy')}</span>
              </div>
              <FaChevronRight className="text-slate-400 text-sm" />
            </button>

            <button className="settings-link-btn" onClick={() => onNavigate('set-goals')}>
              <div className="flex items-center gap-3">
                <span className="settings-link-icon text-red-500 bg-red-500/15">
                  <FaBullseye />
                </span>
                <span>{t('settings.setGoals')}</span>
              </div>
              <FaChevronRight className="text-slate-400 text-sm" />
            </button>

            <button className="settings-link-btn" onClick={() => onNavigate('team')}>
              <div className="flex items-center gap-3">
                <span className="settings-link-icon text-indigo-500 bg-indigo-500/15">
                  <FaUsers />
                </span>
                <span>{t('nav.team') || (language === 'th' ? 'ทีม และความท้าทาย' : 'Team & Challenges')}</span>
              </div>
              <FaChevronRight className="text-slate-400 text-sm" />
            </button>

            <button className="settings-link-btn" onClick={() => alert(`${t('settings.about')} v3.0`)}>
              <div className="flex items-center gap-3">
                <span className="settings-link-icon text-sky-500 bg-sky-500/15">
                  <FaInfoCircle />
                </span>
                <span>{t('settings.about')}</span>
              </div>
              <FaChevronRight className="text-slate-400 text-sm" />
            </button>
          </div>
        </section>

        {/* Logout Section */}
        <section className="settings-logout-section">
          <button type="button" className="logout-btn flex items-center justify-center gap-2.5" onClick={handleLogout}>
            <FaSignOutAlt className="text-lg" />
            <span>{t('settings.logout')}</span>
          </button>
          <div className="app-version-info">
            Longevity Passport {t('settings.version')} 3.0.0
          </div>
        </section>
      </main>

      <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
