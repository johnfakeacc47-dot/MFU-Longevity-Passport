-- 0004_profile_goal_activity.sql
-- The Profile / Set Goals screens write `goal` and `activity_level`, but the
-- columns never existed — every save failed the whole upsert with
-- "Unable to save data, please try again" (QA-007). Add them as plain,
-- self-editable text columns and grant them to `authenticated` (the column
-- grants on `profiles` are explicit lists, so new columns must be named).

alter table public.profiles
  add column if not exists goal text,
  add column if not exists activity_level text;

grant insert (goal, activity_level) on public.profiles to authenticated;
grant update (goal, activity_level) on public.profiles to authenticated;
