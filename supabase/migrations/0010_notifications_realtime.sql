-- Lets the client subscribe to live INSERTs on notifications (NotificationBell
-- — see src/components/notifications/NotificationBell.tsx) instead of only
-- polling. RLS still applies to what a realtime subscriber actually receives.
alter publication supabase_realtime add table public.notifications;
