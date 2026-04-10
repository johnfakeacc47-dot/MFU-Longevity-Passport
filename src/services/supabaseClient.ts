import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Create a single supabase client for interacting with your database
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

// Create an admin client for protected operations like user creation
const supabaseServiceRoleKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY;
export const adminSupabase = supabaseUrl && supabaseServiceRoleKey
  ? createClient(supabaseUrl, supabaseServiceRoleKey)
  : null;

// Helper to check if Supabase is configured
export const isSupabaseConfigured = () => {
    return !!supabase;
};

// --- Seed Data ---
export const seedDatabase = async () => {
  if (!supabase) return;

  const mockUsers = [
    { name: 'John Doe', email: 'john@mfu.ac.th', mfu_id: '643010001', role: 'student', total_points: 8750, avatar_url: '' },
    { name: 'Somchai Rakdee', email: 'somchai@mfu.ac.th', mfu_id: '643010002', role: 'staff', total_points: 7200, avatar_url: '' },
    { name: 'Admin User', email: 'admin@mfu.ac.th', mfu_id: 'admin01', role: 'admin', total_points: 9500, avatar_url: '' },
  ];

  // 1. Seed Profiles
  for (const user of mockUsers) {
    const { data: existing } = await supabase.from('profiles').select('id').eq('email', user.email).maybeSingle();
    
    if (!existing) {
      const { data: inserted, error } = await supabase.from('profiles').insert([user]).select();
      
      if (error) {
        console.error('Error seeding profile:', error);
      }
      
      if (inserted && inserted[0]) {
        const userId = inserted[0].id;
        
        // 2. Seed Health Scores (Today)
        await supabase.from('health_scores').insert([{
          user_id: userId,
          date: new Date().toISOString().split('T')[0],
          sleep: 22,
          nutrition: 18,
          fasting: 20,
          activity: 15,
          total: 75
        }]);

        // 3. Seed Challenges (Mon-Fri)
        const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
        const challengePayload = [];
        for (let i = 0; i < 5; i++) {
          challengePayload.push({
            user_id: userId,
            day_name: days[i],
            completed: true
          });
        }
        await supabase.from('challenges').insert(challengePayload);
      }
    }
  }
  return { success: true };
};

// --- Data Fetching Helpers ---
export const getLeaderboard = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('profiles')
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

  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('health_scores')
    .select('*')
    .eq('user_id', user.id)
    .eq('date', today)
    .single();

  if (error) {
    if (error.code !== 'PGRST116') console.error('Error fetching health score:', error);
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
  const { data, error } = await supabase.from('profiles').select('*');
  if (error) return [];
  return data;
};

export const createProfile = async (profile: any) => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('profiles')
        .insert([{
            name: profile.name,
            email: profile.email,
            role: profile.role,
            faculty: profile.faculty,
            department: profile.department,
            mfu_id: profile.mfuId,
            total_points: 0,
            longevity_score: 0
        }])
        .select()
        .single();
    
    if (error) {
        console.error('Error creating profile:', error);
        throw error;
    }
    return data;
};

// Admin function to fully establish a user (Auth + Profile data)
export const adminCreateUser = async (profileData: any) => {
    if (!adminSupabase || !supabase) {
        throw new Error('Admin Supabase client is not configured. Check VITE_SUPABASE_SERVICE_ROLE_KEY.');
    }

    // 1. Create User in Auth Database via Admin API
    const defaultPassword = 'Password123!'; // Default password for manually created accounts
    const { data: authData, error: authError } = await adminSupabase.auth.admin.createUser({
        email: profileData.email,
        password: defaultPassword,
        email_confirm: true, // Auto-confirm so they can login immediately
    });

    if (authError) {
        console.error('Admin Create Auth User Error:', authError);
        throw authError; // Usually "Email already registered"
    }

    if (!authData.user) {
        throw new Error('Failed to create authentication user.');
    }

    // 2. Insert into public.profiles table using the generated Auth ID
    const { data: profileRecord, error: profileError } = await adminSupabase
        .from('profiles')
        .insert([{
            id: authData.user.id,
            name: profileData.name,
            email: profileData.email,
            role: profileData.role,
            faculty: profileData.faculty,
            department: profileData.department,
            mfu_id: profileData.mfuId,
            total_points: 0,
            longevity_score: 0
        }])
        .select()
        .single();

    if (profileError) {
        // Rollback: Attempt to delete the auth user if profile creation fails
        await adminSupabase.auth.admin.deleteUser(authData.user.id);
        console.error('Admin Create Profile Error:', profileError);
        throw profileError;
    }

    return profileRecord;
};

export const updateProfile = async (id: string, updates: any) => {
    if (!supabase) return null;
    const { data, error } = await supabase
        .from('profiles')
        .update({
            name: updates.name,
            email: updates.email,
            role: updates.role,
            faculty: updates.faculty,
            department: updates.department,
            mfu_id: updates.mfuId // Ensure mapping back to DB
        })
        .eq('id', id)
        .select()
        .single();
    
    if (error) {
        console.error('Error updating profile:', error);
        throw error;
    }
    return data;
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
      name: updates.fullName, // Map UI 'fullName' to DB 'name'
      birth_date: updates.birthDate || null,
      gender: updates.gender,
      height_cm: updates.heightCm ? Number(updates.heightCm) : null,
      weight_kg: updates.weightKg ? Number(updates.weightKg) : null,
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

export const deleteProfile = async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
    
    if (error) {
        console.error('Error deleting profile:', error);
        throw error;
    }
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

  // 3. Update the user's lifetime total_points in the profiles table for leaderboards
  const { data: allScores } = await supabase
    .from('health_scores')
    .select('total')
    .eq('user_id', user.id);

  if (allScores) {
    const lifetimePoints = allScores.reduce((sum, record) => sum + (record.total || 0), 0);
    await supabase
      .from('profiles')
      .update({ total_points: lifetimePoints })
      .eq('id', user.id);
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
      .eq(table === 'team_members' ? 'user_id' : 'id', user.id);

    if (error) {
      console.error(`Error deleting from ${table}:`, error);
      throw error;
    }
  }

  return { success: true, userId: user.id };
};
