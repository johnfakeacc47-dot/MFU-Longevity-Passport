import { createClient } from '@supabase/supabase-js';
import { bangkokDateStr } from '../utils/bangkokTime';
import { getTodayAggregates } from '../utils/dailyAggregates';
import type { LongevityBreakdown } from '../utils/longevityScore';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
    return !!supabase;
};

async function callAdminUsers(payload: Record<string, unknown>): Promise<any> {
  if (!supabase) throw new Error('Supabase not configured');
  const { data, error } = await supabase.functions.invoke('admin-users', { body: payload });
  if (error) {
    let msg = error.message;
    try {
      const ctx = (error as any).context;
      if (ctx && typeof ctx.json === 'function') {
        const body = await ctx.json();
        if (body?.error) msg = body.error;
      }
    } catch { /* keep msg */ }
    throw new Error(msg);
  }
  return data;
}

// --- Data Fetching Helpers ---
export const getLeaderboard = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('leaderboard_profiles')
    .select('id, name, total_points, avatar_url, role, is_score_public')
    .order('total_points', { ascending: false });
  
  if (error) {
    console.error('Error fetching leaderboard:', error);
    return [];
  }
  return data;
};

// Team invites are handled by handle/QR code — see services/teamInvite.ts, which
// calls the add_team_member_by_handle RPC. The old email lookup was removed: RLS
// on `profiles` hides any user whose score is private, so `.eq('email', …)`
// returned nothing for almost everyone.

export const getMyTeamLeaderboard = async () => {
  if (!supabase) return [];
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  // 1. Get member IDs
  const { data: teamMembers, error: teamError } = await supabase
    .from('team_members')
    .select('member_id')
    .eq('user_id', user.id);

  if (teamError) {
    console.error('Error fetching team members:', teamError);
    return [];
  }

  // Include the current user in their own team leaderboard
  const memberIds = teamMembers.map(tm => tm.member_id);
  memberIds.push(user.id);

  // 2. Fetch profiles for all member IDs. `profiles` (not the public-only
  // `leaderboard_profiles` view) -- "My Team" is a mutual, opted-in
  // relationship (see migration 0006/0007), so a teammate who hasn't made
  // their score public should still show up here, just with points
  // hidden -- mapMember() below already does that. leaderboard_profiles
  // stays reserved for the actual public "All Teams" leaderboard.
  const { data: profiles, error: profilesError } = await supabase
    .from('profiles')
    .select('id, name, total_points, avatar_url, role, is_score_public')
    .in('id', memberIds)
    .order('total_points', { ascending: false });

  if (profilesError) {
    console.error('Error fetching team profiles:', profilesError);
    return [];
  }

  return profiles;
};

export const getTodayHealthScore = async () => {
  if (!supabase) return null;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('health_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', bangkokDateStr())
    .maybeSingle();

  if (error) {
    console.error('Error fetching health score:', error);
    return null;
  }
  return data;
};

export const getChallengeStatus = async () => {
  if (!supabase) return [];
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('challenges')
    .select('day_name, completed')
    .eq('user_id', user.id);

  if (error) {
    console.error('Error fetching challenges:', error);
    return [];
  }
  return data;
};

export const getAllProfiles = async () => {
  if (!supabase) return [];
  try {
    const data = await callAdminUsers({ action: 'list' });
    return data?.users ?? [];
  } catch (e) {
    console.error('Error fetching profiles:', e);
    return [];
  }
};

// Admin function to fully establish a user (Auth + Profile data)
export const adminCreateUser = async (profileData: any) => {
  const data = await callAdminUsers({
    action: 'create',
    email: profileData.email,
    name: profileData.name,
    role: profileData.role,
    faculty: profileData.faculty,
    department: profileData.department,
    mfuId: profileData.mfuId,
  });
  return data.user; // { id, email, name, mfu_id, role, faculty, department, created_at }
};

export const updateProfile = async (id: string, updates: any) => {
  const data = await callAdminUsers({
    action: 'update',
    id,
    name: updates.name,
    role: updates.role,
    faculty: updates.faculty,
    department: updates.department,
    email: updates.email,
  });
  return data.user;
};

export const getCurrentUserProfile = async () => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (error) {
    console.error('Error fetching current user profile:', error);
    return null;
  }
  return data;
};

export const updateCurrentUserProfile = async (updates: any) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // The profile row is created by the handle_new_user() trigger on signup, so
  // this is always an UPDATE. (An upsert would try the INSERT path first, which
  // RLS blocks for regular users → "Unable to save data" — QA-007.)
  // Only send fields the caller actually provided, so a partial save doesn't
  // wipe fields it didn't touch.
  const map: Array<[string, string, (v: any) => unknown]> = [
    ['fullName', 'name', (v) => v],
    ['birthDate', 'birth_date', (v) => v || null],
    ['gender', 'gender', (v) => v],
    ['heightCm', 'height_cm', (v) => (v ? Number(v) : null)],
    ['weightKg', 'weight_kg', (v) => (v ? Number(v) : null)],
    ['activityLevel', 'activity_level', (v) => v || null],
    ['goal', 'goal', (v) => v || null],
    ['address', 'address', (v) => v],
    ['country', 'country', (v) => v],
    ['idType', 'id_type', (v) => v],
    ['idNumber', 'id_number', (v) => v],
    ['phone', 'phone', (v) => v],
  ];
  const patch: Record<string, unknown> = {};
  for (const [src, col, coerce] of map) {
    if (updates[src] !== undefined) patch[col] = coerce(updates[src]);
  }
  if (Object.keys(patch).length === 0) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update(patch)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating current user profile:', error);
    throw error;
  }
  return data;
};

export const updateUserGoalAndActivity = async (
  goal: string,
  activityLevel: string
) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({ goal, activity_level: activityLevel })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating goal/activity:', error);
    return null;
  }
  return data;
};

export const deleteProfile = async (id: string) => {
  await callAdminUsers({ action: 'delete', id });
};

// health_scores is one authoritative row per user per Bangkok-local day: the
// 4-pillar score breakdown + that day's numeric aggregates. Written on every
// `healthDataUpdated` and once more by the daily reset before it clears the
// raw logs. Column mapping (historical names): activity=exercise, fasting=mental.
export const syncDailyScoreToSupabase = async (
  score: LongevityBreakdown,
  dateOverride?: string,
) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const agg = getTodayAggregates();

  const { data, error } = await supabase
    .from('health_scores')
    .upsert(
      {
        user_id: user.id,
        date: dateOverride ?? bangkokDateStr(),
        nutrition: score.nutrition,
        sleep: score.sleep,
        activity: score.exercise,
        fasting: score.mental,
        total: score.total,
        ...agg,
      },
      { onConflict: 'user_id,date' },
    )
    .select()
    .single();

  if (error) {
    console.error('Error syncing daily score to Supabase:', error);
    return null;
  }
  return data;
};

// Historical daily rows for a Bangkok-date range (inclusive), oldest first.
export const getHealthHistory = async (fromDate: string, toDate: string) => {
  if (!supabase) return [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('health_scores')
    .select('*')
    .eq('user_id', user.id)
    .gte('date', fromDate)
    .lte('date', toDate)
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching health history:', error);
    return [];
  }
  return data ?? [];
};

export const startFastingTimer = async (targetHours: number) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      fasting_start_time: new Date().toISOString(),
      fasting_target_hours: targetHours
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error starting fasting timer in Supabase:', error);
    throw error;
  }
  return data;
};

export const stopFastingTimer = async () => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({
      fasting_start_time: null,
      fasting_target_hours: null
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error stopping fasting timer in Supabase:', error);
    throw error;
  }
  return data;
};

// --- Score Visibility ---
export const updateScoreVisibility = async (isPublic: boolean) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .update({ is_score_public: isPublic })
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    console.error('Error updating score visibility:', error);
    throw error;
  }
  return data;
};

// ── Account Deletion (Part 1: Data) ──────────────────────────
export const deleteUserAccount = async () => {
  if (!supabase) throw new Error('Supabase not configured');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  // Delete in order to respect potential foreign-key constraints
  const tables = ['team_members', 'health_scores', 'profiles'] as const;

  for (const table of tables) {
    const { error } = await supabase
      .from(table)
      .delete()
      .eq(table === 'profiles' ? 'id' : 'user_id', user.id);

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }
  }

  return { success: true, userId: user.id };
};
