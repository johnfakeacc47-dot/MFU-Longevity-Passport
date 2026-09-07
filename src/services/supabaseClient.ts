import { createClient } from '@supabase/supabase-js';

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

export const inviteTeamMemberByEmail = async (email: string) => {
  if (!supabase) return { success: false, error: 'Database not configured' };
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Not authenticated' };

  // 1. Find user by email
  const { data: memberProfile, error: userError } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', email)
    .maybeSingle();

  if (userError || !memberProfile) {
    return { success: false, error: 'User not found in the system. They must register via MFU SSO first.' };
  }

  if (memberProfile.id === user.id) {
    return { success: false, error: 'You cannot invite yourself.' };
  }

  // 2. Add to team_members
  const { error: inviteError } = await supabase
    .from('team_members')
    .insert([{
      user_id: user.id,
      member_id: memberProfile.id
    }]);

  if (inviteError) {
    if (inviteError.code === '23505') { // Unique violation
      return { success: false, error: 'User is already in your team.' };
    }
    console.error('Error inviting team member:', inviteError);
    return { success: false, error: 'Failed to send invite.' };
  }

  return { success: true };
};

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

  // 2. Fetch profiles for all member IDs
  const { data: profiles, error: profilesError } = await supabase
    .from('leaderboard_profiles')
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

  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('health_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
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

  const { data, error } = await supabase
    .from('profiles')
    .upsert({
      id: user.id,
      email: user.email,
      name: updates.fullName,
      birth_date: updates.birthDate || null,
      gender: updates.gender,
      height_cm: updates.heightCm ? Number(updates.heightCm) : null,
      weight_kg: updates.weightKg ? Number(updates.weightKg) : null,
      activity_level: updates.activityLevel || null,
      goal: updates.goal || null,
      address: updates.address,
      country: updates.country,
      id_type: updates.idType,
      id_number: updates.idNumber,
      phone: updates.phone,
    }, { onConflict: 'id' })
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

export const syncDailyScoreToSupabase = async (score: {
  sleep: number;
  nutrition: number;
  fasting: number;
  activity: number;
  total: number;
}) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Removed the destructive upsert here. Profiles are handled during login.

  const today = new Date().toISOString().split('T')[0];

  // 2. Bulletproof: Manually check if today's score exists to bypass the need for setting up a UNIQUE constraint in SQL
  const { data: existing } = await supabase
    .from('health_scores')
    .select('id')
    .eq('user_id', user.id)
    .eq('date', today)
    .maybeSingle();

  let result;

  if (existing) {
    // Update existing score for today
    result = await supabase
      .from('health_scores')
      .update({
        sleep: score.sleep,
        nutrition: score.nutrition,
        fasting: score.fasting,
        activity: score.activity,
        total: score.total
      })
      .eq('id', existing.id)
      .select()
      .single();
  } else {
    // Insert new score for today
    result = await supabase
      .from('health_scores')
      .insert({
        user_id: user.id,
        date: today,
        sleep: score.sleep,
        nutrition: score.nutrition,
        fasting: score.fasting,
        activity: score.activity,
        total: score.total
      })
      .select()
      .single();
  }

  if (result.error) {
    console.error('Error syncing daily score to Supabase:', result.error);
    return null;
  }

  return result.data;
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
