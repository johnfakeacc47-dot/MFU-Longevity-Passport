import React, { useState } from 'react';
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
} from 'react-icons/fa';
import '../styles/Settings.css';

interface SettingsProps {
  onNavigate: (page: any) => void;
  currentPage?: string;
  onOpenFoodRecognition?: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate, onOpenFoodRecognition = () => {} }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  useSEO(`${t('settings.title')} · MFU Longevity Passport`, 'Configure app preferences and account options.');

  const [fastingAlert, setFastingAlert] = useState<boolean>(true);
  const [activityAlert, setActivityAlert] = useState<boolean>(true);
  const [mealAlert, setMealAlert] = useState<boolean>(true);

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
                <strong>{t('settings.fastingAlert')}</strong>
                <span>{t('settings.fastingAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={fastingAlert}
                  onChange={(e) => setFastingAlert(e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.activityAlert')}</strong>
                <span>{t('settings.activityAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={activityAlert}
                  onChange={(e) => setActivityAlert(e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.mealAlert')}</strong>
                <span>{t('settings.mealAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={mealAlert}
                  onChange={(e) => setMealAlert(e.target.checked)}
                />
                <span className="slider round" />
              </label>
            </div>
          </div>
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
