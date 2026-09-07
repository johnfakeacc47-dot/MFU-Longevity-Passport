// Add-a-teammate by short handle ("swift-lotus-73") or QR code.
//
// Both calls go through SECURITY DEFINER RPCs (see supabase/migrations/0002_user_handles.sql):
// RLS on `profiles` hides every user whose score is private, so a plain
// `.eq('handle', ...)` select would fail for almost everyone — the same wall
// that broke the old email-based invite.
import { supabase } from './supabaseClient';

// Public origin the QR deep link points at. Kept here (not an env var) because
// it must be a stable, shareable URL regardless of where the app is served.
const INVITE_ORIGIN = 'https://mfu-longevity-passport.vercel.app';

export type InviteReason =
  | 'unauthenticated'
  | 'not_found'
  | 'self'
  | 'already_member'
  | 'error';

export interface HandlePreview {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface AddMemberResult {
  ok: boolean;
  reason?: InviteReason;
  name?: string;
  avatarUrl?: string | null;
}

/** Lowercase, strip a leading "@", drop whitespace. */
export const normalizeHandle = (raw: string): string =>
  raw.trim().toLowerCase().replace(/^@+/, '').replace(/\s+/g, '');

/** The URL a teammate's QR code encodes — opens the app and pre-fills the add flow. */
export const buildInviteUrl = (handle: string): string =>
  `${INVITE_ORIGIN}/?add=${encodeURIComponent(normalizeHandle(handle))}`;

/** Read-only lookup for the "Add <name>?" confirmation step. */
export const previewHandle = async (handle: string): Promise<HandlePreview | null> => {
  if (!supabase) return null;
  const h = normalizeHandle(handle);
  if (!h) return null;

  const { data, error } = await supabase.rpc('find_profile_by_handle', { p_handle: h });
  if (error) {
    console.error('previewHandle failed:', error);
    return null;
  }
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { id: row.id, name: row.name || 'MFU member', avatarUrl: row.avatar_url ?? null };
};

/** Resolve the handle and insert the caller's team_members row in one server round-trip. */
export const addTeamMemberByHandle = async (handle: string): Promise<AddMemberResult> => {
  if (!supabase) return { ok: false, reason: 'error' };
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'not_found' };

  const { data, error } = await supabase.rpc('add_team_member_by_handle', { p_handle: h });
  if (error || !data) {
    console.error('addTeamMemberByHandle failed:', error);
    return { ok: false, reason: 'error' };
  }
  return {
    ok: Boolean(data.ok),
    reason: data.reason as InviteReason | undefined,
    name: data.name,
    avatarUrl: data.avatar_url ?? null,
  };
};
