// Bell icon + slide-in panel: the in-app notification center. Always works
// (reads straight from the notifications table), independent of whether the
// visitor ever granted browser/push permission — that's what makes push an
// enhancement here rather than the only way to see a notification.
import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { FaBell } from 'react-icons/fa';
import { useLanguage } from '../../contexts/LanguageContext';
import { supabase, isSupabaseConfigured } from '../../services/supabaseClient';
import {
  fetchNotifications, fetchUnreadCount, markNotificationRead, markAllNotificationsRead,
  type AppNotification,
} from '../../services/notifications';
import '../../styles/Notifications.css';

const TYPE_PAGE: Record<string, string> = {
  teammate_added: 'team',
  challenge_complete: 'team',
  reminder_meal: 'eating',
  reminder_water: 'eating',
  reminder_activity: 'activity',
  reminder_sleep: 'sleep',
  reminder_fasting: 'eating',
};

interface NotificationBellProps {
  onNavigate: (page: any) => void;
}

export const NotificationBell: React.FC<NotificationBellProps> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [unread, setUnread] = useState(0);

  const refreshCount = useCallback(() => {
    fetchUnreadCount().then(setUnread);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    refreshCount();
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
  }, [refreshCount]);

  const openPanel = async () => {
    setOpen(true);
    setItems(await fetchNotifications(30));
  };

  const handleItemClick = async (n: AppNotification) => {
    if (!n.read) {
      await markNotificationRead(n.id);
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
    }
    const page = TYPE_PAGE[n.type];
    if (page) { onNavigate(page); setOpen(false); }
  };

  const handleMarkAll = async () => {
    await markAllNotificationsRead();
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    setUnread(0);
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
              {items.length === 0 ? (
                <p className="notif-empty">{t('notifications.empty')}</p>
              ) : (
                items.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className={`notif-item ${n.read ? '' : 'is-unread'}`}
                    onClick={() => handleItemClick(n)}
                  >
                    <div className="notif-item-main">
                      <span className="notif-item-title">{n.title}</span>
                      <span className="notif-item-body">{n.body}</span>
                    </div>
                    <span className="notif-item-time">{timeAgo(n.createdAt)}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
};
