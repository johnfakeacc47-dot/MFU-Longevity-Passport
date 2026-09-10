// Client side of the notification system — see
// supabase/migrations/0008_notifications.sql for the server side
// (notifications / push_subscriptions / notification_preferences tables,
// the notify()/check_team_challenge()/run_scheduled_reminders() functions,
// and the triggers that wire them together).
import { supabase, isSupabaseConfigured } from './supabaseClient';

export interface AppNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  read: boolean;
  createdAt: string;
}

export interface NotificationPrefs {
  mealReminder: boolean;
  waterReminder: boolean;
  sleepReminder: boolean;
  activityReminder: boolean;
  fastingReminder: boolean;
  teamNotifs: boolean;
  challengeNotifs: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  mealReminder: true, waterReminder: true, sleepReminder: true,
  activityReminder: true, fastingReminder: true, teamNotifs: true, challengeNotifs: true,
};

function mapNotification(row: any): AppNotification {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data ?? {},
    read: !!row.read,
    createdAt: row.created_at,
  };
}

export async function fetchNotifications(limit = 30): Promise<AppNotification[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) { console.error('fetchNotifications failed:', error); return []; }
  return (data ?? []).map(mapNotification);
}

export async function fetchUnreadCount(): Promise<number> {
  if (!supabase) return 0;
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('read', false);
  if (error) { console.error('fetchUnreadCount failed:', error); return 0; }
  return count ?? 0;
}

export async function markNotificationRead(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('notifications').update({ read: true }).eq('id', id);
  if (error) console.error('markNotificationRead failed:', error);
}

export async function markAllNotificationsRead(): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from('notifications').update({ read: true }).eq('read', false);
  if (error) console.error('markAllNotificationsRead failed:', error);
}

// ── Preferences ──────────────────────────────────────────────────────────

function prefsFromRow(row: any): NotificationPrefs {
  if (!row) return DEFAULT_PREFS;
  return {
    mealReminder: row.meal_reminder ?? true,
    waterReminder: row.water_reminder ?? true,
    sleepReminder: row.sleep_reminder ?? true,
    activityReminder: row.activity_reminder ?? true,
    fastingReminder: row.fasting_reminder ?? true,
    teamNotifs: row.team_notifs ?? true,
    challengeNotifs: row.challenge_notifs ?? true,
  };
}

const PREF_COLUMN: Record<keyof NotificationPrefs, string> = {
  mealReminder: 'meal_reminder',
  waterReminder: 'water_reminder',
  sleepReminder: 'sleep_reminder',
  activityReminder: 'activity_reminder',
  fastingReminder: 'fasting_reminder',
  teamNotifs: 'team_notifs',
  challengeNotifs: 'challenge_notifs',
};

export async function getNotificationPreferences(): Promise<NotificationPrefs> {
  if (!supabase) return DEFAULT_PREFS;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return DEFAULT_PREFS;
  const { data, error } = await supabase
    .from('notification_preferences')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle();
  if (error) { console.error('getNotificationPreferences failed:', error); return DEFAULT_PREFS; }
  return prefsFromRow(data);
}

export async function updateNotificationPreference(key: keyof NotificationPrefs, value: boolean): Promise<void> {
  if (!supabase) return;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const patch: Record<string, unknown> = { user_id: user.id, updated_at: new Date().toISOString() };
  patch[PREF_COLUMN[key]] = value;
  const { error } = await supabase.from('notification_preferences').upsert(patch, { onConflict: 'user_id' });
  if (error) console.error('updateNotificationPreference failed:', error);
}

// ── Browser notification permission ─────────────────────────────────────

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) return 'denied';
  if (Notification.permission !== 'default') return Notification.permission;
  try { return await Notification.requestPermission(); } catch { return 'denied'; }
}

// ── Web Push subscription ───────────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

/** True once this device already has an active push subscription. */
export async function isPushSubscribed(): Promise<boolean> {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    return !!sub;
  } catch {
    return false;
  }
}

export async function subscribeToPush(): Promise<boolean> {
  if (!isSupabaseConfigured() || !supabase) return false;
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidKey) { console.warn('VITE_VAPID_PUBLIC_KEY is not set — push notifications are disabled.'); return false; }

  const permission = await requestNotificationPermission();
  if (permission !== 'granted') return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    let sub = await registration.pushManager.getSubscription();
    if (!sub) {
      sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });
    }
    const subJson = sub.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: user.id,
      endpoint: sub.endpoint,
      p256dh: subJson.keys?.p256dh ?? '',
      auth: subJson.keys?.auth ?? '',
      last_seen_at: new Date().toISOString(),
    }, { onConflict: 'endpoint' });
    if (error) { console.error('saving push subscription failed:', error); return false; }
    return true;
  } catch (err) {
    console.error('subscribeToPush failed:', err);
    return false;
  }
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registration = await navigator.serviceWorker.ready;
    const sub = await registration.pushManager.getSubscription();
    if (sub) {
      if (supabase) await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint);
      await sub.unsubscribe();
    }
  } catch (err) {
    console.error('unsubscribeFromPush failed:', err);
  }
}

// ── Fasting alarm — local, via the service worker (see src/sw.ts) ────────
// Independent of Web Push: fires immediately from the SW's own 30s-interval
// check, no server round trip needed while the browser process is alive.

export async function scheduleFastingAlarm(endTimestamp: number, goalHours: number): Promise<void> {
  await requestNotificationPermission();
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'SCHEDULE_FASTING_ALARM', endTimestamp, goalHours });
}

export async function cancelFastingAlarm(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  registration.active?.postMessage({ type: 'CANCEL_FASTING_ALARM' });
}
