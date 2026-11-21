// Notification preferences (reached from Profile → "การแจ้งเตือน"). Same services as
// before: notification prefs, web-push subscribe/unsubscribe. Language, theme and
// logout now live on the combined Profile & settings screen (ui_ref2).
import React, { useState, useEffect } from 'react';
import { Utensils, Droplet, Moon, Activity, Timer, UsersRound, Flag, Award, BellRing } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { PageHeader, Group, Row, Toggle, ICON_PROPS } from '../components/v2';
import { ThemeCustomizer } from '../components/ThemeCustomizer';
import {
  getNotificationPreferences, updateNotificationPreference, subscribeToPush, unsubscribeFromPush, isPushSubscribed,
  type NotificationPrefs,
} from '../services/notifications';
import type { PageType } from '../types/pages';

const DEFAULT_PREFS: NotificationPrefs = {
  mealReminder: true, waterReminder: true, sleepReminder: true,
  activityReminder: true, fastingReminder: true, teamNotifs: true, challengeNotifs: true,
  badgeNotifs: true,
};

interface SettingsProps {
  onNavigate: (page: PageType) => void;
  currentPage?: string;
  onOpenFoodRecognition?: () => void;
  /** Wired from App — ends the Supabase session and clears local state. */
  onLogout: () => void;
}

export const Settings: React.FC<SettingsProps> = ({ onNavigate }) => {
  const { t } = useLanguage();
  useSEO(`${t('settings.title')} · MFU Longevity Passport`, 'Configure app preferences and account options.');

  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);
  const [prefError, setPrefError] = useState<string | null>(null);
  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;

  useEffect(() => {
    getNotificationPreferences().then(setPrefs);
    if (pushSupported) isPushSubscribed().then(setPushEnabled);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const togglePref = async (key: keyof NotificationPrefs, checked: boolean) => {
    // Optimistic flip, but revert (and say so) if the server write fails.
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

  const togglePush = async (next: boolean) => {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    if (next) {
      const res = await subscribeToPush();
      setPushEnabled(res.ok);
      if (!res.ok) {
        setPushError(
          res.reason === 'permission_denied' ? t('settings.pushErrDenied')
          : res.reason === 'timeout' ? t('settings.pushErrTimeout')
          : t('settings.pushErrGeneric'),
        );
      }
    } else {
      try { await unsubscribeFromPush(); } catch (err) { console.error('unsubscribeFromPush failed:', err); }
      // Re-check rather than assume — if the browser refused, the toggle should still say "enabled".
      setPushEnabled(await isPushSubscribed());
    }
    setPushBusy(false);
  };

  const items: { key: keyof NotificationPrefs; icon: React.ReactNode; title: string; desc: string }[] = [
    { key: 'mealReminder', icon: <Utensils size={22} {...ICON_PROPS} />, title: t('settings.mealAlert'), desc: t('settings.mealAlertDesc') },
    { key: 'waterReminder', icon: <Droplet size={22} {...ICON_PROPS} />, title: t('settings.waterAlert'), desc: t('settings.waterAlertDesc') },
    { key: 'sleepReminder', icon: <Moon size={22} {...ICON_PROPS} />, title: t('settings.sleepAlert'), desc: t('settings.sleepAlertDesc') },
    { key: 'activityReminder', icon: <Activity size={22} {...ICON_PROPS} />, title: t('settings.activityAlert'), desc: t('settings.activityAlertDesc') },
    { key: 'fastingReminder', icon: <Timer size={22} {...ICON_PROPS} />, title: t('settings.fastingAlert'), desc: t('settings.fastingAlertDesc') },
    { key: 'teamNotifs', icon: <UsersRound size={22} {...ICON_PROPS} />, title: t('settings.teamAlert'), desc: t('settings.teamAlertDesc') },
    { key: 'challengeNotifs', icon: <Flag size={22} {...ICON_PROPS} />, title: t('settings.challengeAlert'), desc: t('settings.challengeAlertDesc') },
    { key: 'badgeNotifs', icon: <Award size={22} {...ICON_PROPS} />, title: t('settings.badgeAlert'), desc: t('settings.badgeAlertDesc') },
  ];

  return (
    <div className="v2-page v2-page--nonav">
      <PageHeader title={t('settings.title')} onBack={() => onNavigate('profile')} backLabel={t('common.back')} />

      <ThemeCustomizer />

      <h2 className="v2-h2">{t('v2.notifSection')}</h2>

      {pushSupported && (
        <Group>
          <Row pillar="water" icon={<BellRing size={22} {...ICON_PROPS} />} title={t('settings.pushEnable')}
            sub={pushError ?? (pushEnabled ? t('settings.pushEnabled') : t('settings.pushEnableDesc'))}
            end={<Toggle on={pushEnabled} onChange={(v) => void togglePush(v)} label={t('settings.pushEnable')} />} />
        </Group>
      )}

      {prefError && <p className="v2-alert v2-alert--error" role="alert">{prefError}</p>}

      <Group>
        {items.map((it) => (
          <Row key={it.key} pillar="water" icon={it.icon} title={it.title} sub={it.desc}
            end={<Toggle on={prefs[it.key]} onChange={(v) => void togglePref(it.key, v)} label={it.title} />} />
        ))}
      </Group>
    </div>
  );
};
