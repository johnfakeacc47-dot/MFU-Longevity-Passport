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
  getNotificationPreferences, updateNotificationPreference, subscribeToPush, unsubscribeFromPush, isPushSubscribed,
  type NotificationPrefs,
} from '../services/notifications';
import { ConfirmDialog } from '../components/ConfirmDialog';
import '../styles/Settings.css';

const APP_VERSION = '3.0.0';

const DEFAULT_PREFS: NotificationPrefs = {
  mealReminder: true, waterReminder: true, sleepReminder: true,
  activityReminder: true, fastingReminder: true, teamNotifs: true, challengeNotifs: true,
  badgeNotifs: true,
};

interface SettingsProps {
  onNavigate: (page: any) => void;
  currentPage?: string;
  onOpenFoodRecognition?: () => void;
  /** Wired from App — ends the Supabase session and clears local state. */
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate, onOpenFoodRecognition = () => {}, onLogout }) => {
  const { language, setLanguage, t } = useLanguage();
  const { theme, setTheme } = useTheme();
  useSEO(`${t('settings.title')} · MFU Longevity Passport`, 'Configure app preferences and account options.');

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
    if (pushSupported) isPushSubscribed().then(setPushEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePref = async (key: keyof NotificationPrefs, checked: boolean) => {
    // Optimistic flip, but revert (and say so) if the server write fails —
    // the old fire-and-forget left the switch showing a state that was never saved.
    const previous = prefs[key];
    setPrefError(null);
    setPrefs((prev) => ({ ...prev, [key]: checked }));
    try {
      await updateNotificationPreference(key, checked);
    } catch (err) {
      console.error('updateNotificationPreference failed:', err);
      setPrefs((prev) => ({ ...prev, [key]: previous }));
      setPrefError(t('settings.prefSaveFailed'));
    }
  };

  const handleEnablePush = async () => {
    setPushBusy(true);
    setPushError(null);
    const res = await subscribeToPush();
    if (res.ok) {
      setPushEnabled(true);
    } else {
      setPushEnabled(false);
      setPushError(
        res.reason === 'permission_denied' ? t('settings.pushErrDenied')
        : res.reason === 'timeout' ? t('settings.pushErrTimeout')
        : t('settings.pushErrGeneric'),
      );
    }
    setPushBusy(false);
  };

  const handleDisablePush = async () => {
    setPushBusy(true);
    setPushError(null);
    try {
      await unsubscribeFromPush();
    } catch (err) {
      console.error('unsubscribeFromPush failed:', err);
    }
    // Re-check rather than assume — if the browser refused to unsubscribe the card should still say "enabled".
    setPushEnabled(await isPushSubscribed());
    setPushBusy(false);
  };

  const handleLogout = () => setShowLogoutConfirm(true);

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

            <div className="toggle-item">
              <div className="toggle-info">
                <strong>{t('settings.badgeAlert')}</strong>
                <span>{t('settings.badgeAlertDesc')}</span>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={prefs.badgeNotifs} onChange={(e) => togglePref('badgeNotifs', e.target.checked)} />
                <span className="slider round" />
              </label>
            </div>
          </div>
          {prefError && (
            <p role="alert" style={{ color: 'var(--color-danger, #EF4444)', fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>{prefError}</p>
          )}
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
            <>
              <div className="toggle-item">
                <div className="toggle-info"><strong style={{ color: 'var(--color-success, #10B981)' }}>{t('settings.pushEnabled')}</strong></div>
                <FaCheck style={{ color: 'var(--color-success, #10B981)' }} />
              </div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDisablePush}
                disabled={pushBusy}
                style={{ width: '100%', marginTop: 10 }}
              >
                {pushBusy ? t('common.loading') : t('settings.pushDisableBtn')}
              </button>
              {pushError && (
                <p role="alert" style={{ color: 'var(--color-danger, #EF4444)', fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>{pushError}</p>
              )}
            </>
          ) : (
            <>
              <button type="button" className="btn" onClick={handleEnablePush} disabled={pushBusy} style={{ width: '100%' }}>
                {pushBusy ? t('common.loading') : t('settings.pushEnableBtn')}
              </button>
              {pushError && (
                <p style={{ color: 'var(--color-danger, #EF4444)', fontSize: 12.5, marginTop: 10, lineHeight: 1.5 }}>{pushError}</p>
              )}
            </>
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
                <span>{t('nav.team')}</span>
              </div>
              <FaChevronRight className="text-slate-400 text-sm" />
            </button>

            <button className="settings-link-btn" onClick={() => onNavigate('about-us')}>
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
            {t('settings.versionLine').replace('{version}', APP_VERSION)}
          </div>
        </section>
      </main>

      <ConfirmDialog
        open={showLogoutConfirm}
        icon={<FaSignOutAlt />}
        title={t('settings.logoutTitle')}
        message={t('settings.logoutConfirm')}
        confirmLabel={t('settings.logout')}
        cancelLabel={t('common.cancel')}
        variant="danger"
        onConfirm={() => { setShowLogoutConfirm(false); onLogout(); }}
        onClose={() => setShowLogoutConfirm(false)}
      />

      <BottomNav active="profile" onNavigate={onNavigate} onOpenFoodRecognition={onOpenFoodRecognition} t={t} />
    </div>
  );
};
