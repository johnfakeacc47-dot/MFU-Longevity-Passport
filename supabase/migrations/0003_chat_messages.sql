-- 0003_chat_messages.sql
-- Persistent history for the AI health-coach chat. One row per turn, immutable.
-- RLS: a user sees and writes only their own messages; admins can read all.

create table if not exists public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null check (char_length(content) <= 8000),
  created_at timestamptz not null default now()
);

create index if not exists chat_messages_user_created_idx
  on public.chat_messages (user_id, created_at);

alter table public.chat_messages enable row level security;

create policy chat_messages_own on public.chat_messages
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy chat_messages_admin_all on public.chat_messages
  for select
  using (public.is_admin());

-- No UPDATE grant: messages are append-only.
revoke all on public.chat_messages from anon, public;
grant select, insert, delete on public.chat_messages to authenticated;
