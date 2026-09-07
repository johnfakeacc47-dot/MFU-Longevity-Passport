// supabase/functions/admin-users/index.ts
//
// Admin user-management Edge Function. Replaces the frontend `adminSupabase`
// (service_role) client that was being bundled into the SPA. Every privileged
// operation runs here, after verifying the caller is an authenticated user whose
// profiles.role === 'admin'.
//
// Requests (POST JSON body; GET is treated as { action: 'list' }):
//   { action: 'list' }
//   { action: 'create', email, name, role, faculty?, department?, mfuId? }
//   { action: 'update', id, name?, role?, faculty?, department?, email? }
//   { action: 'delete', id }
// Responses: 2xx { users } | { user } | { success:true };  errors: { error: string }
//
// Auto-injected env (verify with `supabase secrets list`):
//   SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
// Operator-set env (`supabase secrets set`):
//   ALLOWED_ORIGINS        comma-separated origin allowlist; fallback http://localhost:5173
//   DEFAULT_USER_PASSWORD  password for admin-created accounts; fallback 'Password123!'

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type AdminClient = ReturnType<typeof createClient>

// ---------- CORS (origin allowlist) ----------
const DEV_ORIGIN_FALLBACK = 'http://localhost:5173'

function getAllowedOrigins(): string[] {
  const raw = Deno.env.get('ALLOWED_ORIGINS')
  if (!raw) return [DEV_ORIGIN_FALLBACK]
  const list = raw.split(',').map((o) => o.trim()).filter(Boolean)
  return list.length > 0 ? list : [DEV_ORIGIN_FALLBACK]
}

function buildCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin')
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Vary': 'Origin',
  }
  if (origin && getAllowedOrigins().includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin
  }
  return headers
}

function json(body: unknown, status: number, req: Request): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...buildCorsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// ---------- helpers ----------
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
const VALID_ROLES = ['student', 'staff', 'admin']
const PROFILE_COLUMNS = 'id, email, name, mfu_id, role, faculty, department, created_at'

async function listAllAuthUsers(admin: AdminClient): Promise<any[]> {
  const users: any[] = []
  let page = 1
  const perPage = 1000
  while (page <= 50) { // hard cap ~50k users
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    users.push(...data.users)
    if (data.users.length < perPage) break
    page++
  }
  return users
}

// ---------- action handlers ----------
async function handleList(admin: AdminClient, req: Request): Promise<Response> {
  const { data: profiles, error: profErr } = await admin.from('profiles').select(PROFILE_COLUMNS)
  if (profErr) return json({ error: profErr.message }, 400, req)

  let authUsers: any[] = []
  try {
    authUsers = await listAllAuthUsers(admin)
  } catch (e) {
    console.error('listUsers failed:', e instanceof Error ? e.message : e) // non-fatal
  }

  const authById = new Map(authUsers.map((u) => [u.id, u]))
  const seen = new Set<string>()
  const merged = (profiles ?? []).map((p: any) => {
    seen.add(p.id)
    const au = authById.get(p.id)
    return {
      id: p.id,
      email: p.email ?? au?.email ?? '',
      name: p.name ?? '',
      mfu_id: p.mfu_id ?? null,
      role: p.role ?? 'student',
      faculty: p.faculty ?? '',
      department: p.department ?? '',
      created_at: p.created_at ?? au?.created_at ?? null,
      last_sign_in_at: au?.last_sign_in_at ?? null,
    }
  })
  for (const au of authUsers) { // auth users with no profile row
    if (seen.has(au.id)) continue
    merged.push({
      id: au.id,
      email: au.email ?? '',
      name: (au.user_metadata?.name as string) ?? '',
      mfu_id: null,
      role: 'student',
      faculty: '',
      department: '',
      created_at: au.created_at ?? null,
      last_sign_in_at: au.last_sign_in_at ?? null,
    })
  }
  return json({ users: merged }, 200, req)
}

async function handleCreate(admin: AdminClient, body: any, req: Request): Promise<Response> {
  const email = typeof body.email === 'string' ? body.email.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const role = typeof body.role === 'string' ? body.role : ''
  const faculty = typeof body.faculty === 'string' ? body.faculty : null
  const department = typeof body.department === 'string' ? body.department : null
  const mfuId = typeof body.mfuId === 'string' ? body.mfuId
    : (typeof body.mfu_id === 'string' ? body.mfu_id : null)

  if (!email || !name || !role) return json({ error: 'email, name and role are required' }, 400, req)
  if (!VALID_ROLES.includes(role)) return json({ error: 'role must be student, staff or admin' }, 400, req)

  const defaultPassword = Deno.env.get('DEFAULT_USER_PASSWORD') ?? 'Password123!'

  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password: defaultPassword,
    email_confirm: true,
  })
  if (authError || !authData?.user) {
    return json({ error: authError?.message ?? 'Failed to create authentication user' }, 400, req)
  }
  const newId = authData.user.id

  // NOTE: supabase/create_profile_trigger.sql (on_auth_user_created) may have
  // already inserted a profiles row. upsert works whether or not it is deployed.
  const { data: profileRecord, error: profileError } = await admin
    .from('profiles')
    .upsert(
      {
        id: newId,
        email,
        name,
        role,
        faculty,
        department,
        mfu_id: mfuId,
        total_points: 0,
        longevity_score: 0,
      },
      { onConflict: 'id' },
    )
    .select(PROFILE_COLUMNS)
    .single()

  if (profileError) {
    try {
      await admin.auth.admin.deleteUser(newId) // rollback the orphan auth user
    } catch (rb) {
      console.error('rollback deleteUser failed:', rb instanceof Error ? rb.message : rb)
    }
    return json({ error: profileError.message }, 400, req)
  }
  return json({ user: profileRecord }, 201, req)
}

async function handleUpdate(admin: AdminClient, body: any, req: Request): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : ''
  if (!UUID_RE.test(id)) return json({ error: 'valid id is required' }, 400, req)

  const updates: Record<string, unknown> = {}
  if (typeof body.name === 'string') updates.name = body.name
  if (typeof body.role === 'string') {
    if (!VALID_ROLES.includes(body.role)) return json({ error: 'role must be student, staff or admin' }, 400, req)
    updates.role = body.role
  }
  if (typeof body.faculty === 'string') updates.faculty = body.faculty
  if (typeof body.department === 'string') updates.department = body.department
  if (typeof body.email === 'string') updates.email = body.email.trim()

  if (Object.keys(updates).length === 0) return json({ error: 'no updatable fields supplied' }, 400, req)

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select(PROFILE_COLUMNS)
    .maybeSingle()
  if (error) return json({ error: error.message }, 400, req)
  if (!data) return json({ error: 'user not found' }, 404, req)

  if (typeof updates.email === 'string') { // keep auth email in sync (non-fatal)
    const { error: authErr } = await admin.auth.admin.updateUserById(id, { email: updates.email as string })
    if (authErr) console.error('auth email sync failed:', authErr.message)
  }
  return json({ user: data }, 200, req)
}

async function handleDelete(admin: AdminClient, body: any, callerId: string, req: Request): Promise<Response> {
  const id = typeof body.id === 'string' ? body.id : ''
  if (!UUID_RE.test(id)) return json({ error: 'valid id is required' }, 400, req)
  if (id === callerId) return json({ error: 'you cannot delete your own account' }, 400, req)

  // Remove dependent rows first, in case FKs are not ON DELETE CASCADE.
  // Each step is best-effort; log & continue on error.
  const steps = [
    () => admin.from('team_members').delete().eq('user_id', id),
    () => admin.from('team_members').delete().eq('member_id', id),
    () => admin.from('health_scores').delete().eq('user_id', id),
    () => admin.from('challenges').delete().eq('user_id', id),
    () => admin.from('profiles').delete().eq('id', id),
  ]
  for (const step of steps) {
    const { error } = await step()
    if (error) console.error('delete dependent row failed:', error.message)
  }

  const { error } = await admin.auth.admin.deleteUser(id)
  if (error) return json({ error: error.message }, 400, req)
  return json({ success: true }, 200, req)
}

// ---------- entrypoint ----------
serve(async (req: Request) => {
  const cors = buildCorsHeaders(req)

  if (req.method === 'OPTIONS') {
    if (!cors['Access-Control-Allow-Origin']) return new Response('Origin not allowed', { status: 403 })
    return new Response('ok', { headers: cors })
  }
  if (req.method !== 'GET' && req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405, req)
  }

  try {
    // 1. AuthN — require a bearer token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader || !authHeader.toLowerCase().startsWith('bearer ')) {
      return json({ error: 'Missing or malformed Authorization header' }, 401, req)
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error('missing SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY')
      return json({ error: 'Server is not configured' }, 500, req)
    }

    // 2. Identify caller with a user-scoped client (RLS enforced)
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Invalid or expired token' }, 401, req)

    // 3. AuthZ — caller must be an admin in profiles
    const { data: profile, error: profileError } = await userClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle()
    if (profileError) {
      console.error('role lookup failed:', profileError.message)
      return json({ error: 'Could not verify permissions' }, 403, req)
    }
    if (!profile || profile.role !== 'admin') {
      return json({ error: 'Forbidden: admin access required' }, 403, req)
    }

    // 4. Only now create the privileged client
    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    // 5. Dispatch
    let body: any = {}
    if (req.method === 'POST') {
      try { body = await req.json() } catch { body = {} }
    }
    const action: string = req.method === 'GET' ? 'list' : String(body.action ?? '')

    switch (action) {
      case 'list':   return await handleList(admin, req)
      case 'create': return await handleCreate(admin, body, req)
      case 'update': return await handleUpdate(admin, body, req)
      case 'delete': return await handleDelete(admin, body, user.id, req)
      default:       return json({ error: `Unknown action: ${action || '(none)'}` }, 400, req)
    }
  } catch (err) {
    // Never leak stack traces to the client.
    console.error('admin-users unhandled error:', err instanceof Error ? (err.stack ?? err.message) : err)
    return json({ error: 'Internal Server Error' }, 500, req)
  }
})
