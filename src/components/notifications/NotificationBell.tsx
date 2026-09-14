// Bell icon + slide-in panel: the in-app notification center. Always works
// (reads straight from the notifications table), independent of whether the
// visitor ever granted browser/push permission — that's what makes push an
// enhancement here rather than the only way to see a notification.
import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  FaBell, FaUtensils, FaTint, FaMoon, FaRunning, FaClock, FaUserPlus,
  FaCheckCircle, FaTrophy, FaMobileAlt, FaChevronRight, FaSpinner,
} from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import {
  fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead,
  isPushSubscribed, subscribeToPush,
  type AppNotification,
} from '../../services/notifications';
import '../../styles/Notifications.css';

const TYPE_PAGE: Record<string, string> = {
  teammate_added: 'team',
  team_request: 'team',
  team_request_accepted: 'team',
  challenge_complete: 'team',
  badge_unlocked: 'profile',
  reminder_meal: 'eating',
  reminder_water: 'eating',
  reminder_activity: 'activity',
  reminder_sleep: 'sleep',
  reminder_fasting: 'eating',
};

// One badge look per notification type — the panel used to be plain bold
// title + gray body for everything, which read as flat and made a run of
// same-type reminders (e.g. 5x "Stay hydrated" from the 2-hourly nudge)
// blur together into a wall of identical text.
const TYPE_ICON: Record<string, { icon: React.ComponentType; color: string }> = {
  reminder_meal:          { icon: FaUtensils,    color: '#F97316' },
  reminder_water:         { icon: FaTint,        color: '#0EA5E9' },
  reminder_sleep:         { icon: FaMoon,        color: '#8B5CF6' },
  reminder_activity:      { icon: FaRunning,     color: '#10B981' },
  reminder_fasting:       { icon: FaClock,       color: '#F59E0B' },
  teammate_added:         { icon: FaUserPlus,    color: '#3B82F6' },
  team_request:           { icon: FaUserPlus,    color: '#3B82F6' },
  team_request_accepted:  { icon: FaCheckCircle, color: '#10B981' },
  challenge_complete:     { icon: FaTrophy,      color: '#EAB308' },
  badge_unlocked:         { icon: FaTrophy,      color: '#EAB308' },
};
const DEFAULT_TYPE_ICON = { icon: FaBell, color: '#64748B' };

interface NotifGroup {
  ids: string[];
  type: string;
  title: string;
  body: string;
  count: number;
  latestCreatedAt: string;
  read: boolean;
}

// Consecutive same-type-and-title notifications collapse into one row with a
// "×N" count instead of N nearly-identical rows — the reminder system fires
// the same nudge repeatedly (by design, every 2h for water) until you act,
// so the raw feed was mostly duplicates.
function groupNotifications(items: AppNotification[]): NotifGroup[] {
  const groups: NotifGroup[] = [];
  for (const n of items) {
    const last = groups[groups.length - 1];
    if (last && last.type === n.type && last.title === n.title) {
      last.ids.push(n.id);
      last.count += 1;
      last.read = last.read && n.read;
    } else {
      groups.push({ ids: [n.id], type: n.type, title: n.title, body: n.body, count: 1, latestCreatedAt: n.createdAt, read: n.read });
    }
  }
  return groups;
}

interface NotificationBellProps {
  onNavigate: (page: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const pushSupported = typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const [pushEnabled, setPushEnabled] = useState<boolean | null>(null); // null = not checked yet
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  const refreshCount = useCallback(() => {
    fetchUnreadCount().then(setUnread);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    refreshCount();
    if (pushSupported) isPushSubscribed().then(setPushEnabled);
    const interval = window.setInterval(refreshCount, 60_000);

    let channel: ReturnType<NonNullable<typeof supabase>['channel']> | null = null;
    supabase?.auth.getUser().then(({ data: { user } }) => {
      if (!user || !supabase) return;
      channel = supabase
        .channel('notifications-bell')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
          () => refreshCount(),
        )
        .subscribe();
    });

    return () => {
      window.clearInterval(interval);
      if (channel) supabase?.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshCount]);

  const openPanel = async () => {
    setOpen(true);
    setItems(await fetchNotifications(30));
  };

  const groups = useMemo(() => groupNotifications(items), [items]);

  const handleGroupClick = async (g: NotifGroup) => {
    if (!g.read) {
      await Promise.all(g.ids.map((id) => markNotificationRead(id)));
      setItems((prev) => prev.map((x) => (g.ids.includes(x.id) ? { ...x, read: true } : x)));
      refreshCount(); // re-derive from the server rather than guess how many of this group were already read
    }
    const page = TYPE_PAGE[g.type];
    if (page) { onNavigate(page); setOpen(false); }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
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

  const timeAgo = (iso: string): string => {
    const mins = Math.floor((new Date().getTime() - new Date(iso).getTime()) / 60_000);
    if (mins < 1) return language === 'th' ? 'เมื่อสักครู่' : 'just now';
    if (mins < 60) return language === 'th' ? `${mins} นาทีที่แล้ว` : `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return language === 'th' ? `${hrs} ชม.ที่แล้ว` : `${hrs}h ago`;
    return language === 'th' ? `${Math.floor(hrs / 24)} วันที่แล้ว` : `${Math.floor(hrs / 24)}d ago`;
  };

  return (
    <>
      <button type="button" className="notif-bell-btn" onClick={openPanel} aria-label={t('notifications.title')}>
        <FaBell />
        {unread > 0 && <span className="notif-bell-badge">{unread > 9 ? '9+' : unread}</span>}
      </button>

      {open && createPortal(
        <div className="notif-panel-overlay" onClick={() => setOpen(false)}>
          <div className="notif-panel" onClick={(e) => e.stopPropagation()}>
            <div className="notif-panel-header">
              <h3>{t('notifications.title')}</h3>
              {unread > 0 && (
                <button type="button" className="notif-mark-all" onClick={handleMarkAll}>{t('notifications.markAllRead')}</button>
              )}
            </div>
            <div className="notif-panel-body">
              {pushSupported && pushEnabled === false && (
                <>
                  <button type="button" className="notif-push-banner" onClick={handleEnablePush} disabled={pushBusy}>
                    <span className="notif-push-banner-icon"><FaMobileAlt /></span>
                    <span className="notif-push-banner-text">
                      <strong>{t('notifications.enablePushTitle')}</strong>
                      <span>{t('settings.pushEnableDesc')}</span>
                    </span>
                    {pushBusy ? <FaSpinner className="notif-push-spin" /> : <FaChevronRight className="notif-push-banner-chevron" />}
                  </button>
                  {pushError && <p className="notif-push-error">{pushError}</p>}
                </>
              )}

              {groups.length === 0 ? (
                <p className="notif-empty">{t('notifications.empty')}</p>
              ) : (
                groups.map((g) => {
                  const { icon: Icon, color } = TYPE_ICON[g.type] ?? DEFAULT_TYPE_ICON;
                  return (
                    <button
                      key={g.ids[0]}
                      type="button"
                      className={`notif-item ${g.read ? '' : 'is-unread'}`}
                      onClick={() => handleGroupClick(g)}
                    >
                      <span className="notif-item-icon" style={{ color, background: `${color}26` }}>
                        <Icon />
                      </span>
                      <div className="notif-item-main">
                        <span className="notif-item-title-row">
                          <span className="notif-item-title">{g.title}</span>
                          {g.count > 1 && <span className="notif-item-count">×{g.count}</span>}
                        </span>
                        <span className="notif-item-body">{g.body}</span>
                      </div>
                      <span className="notif-item-time">{timeAgo(g.latestCreatedAt)}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
