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
  | 'already_requested'
  | 'error';

export interface HandlePreview {
  id: string;
  name: string;
  avatarUrl: string | null;
}

export interface RequestMemberResult {
  ok: boolean;
  reason?: InviteReason;
  name?: string;
  avatarUrl?: string | null;
  /** 'accepted' only for a crossed request (they'd already asked to add you) —
   *  see request_team_member_by_handle() in 0013_team_request_approval.sql. */
  status?: 'pending' | 'accepted';
}

export interface PendingTeamRequest {
  requestId: string;
  requesterId: string;
  requesterName: string;
  requesterAvatarUrl: string | null;
  createdAt: string;
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

// QA-008: this used to insert the caller's team_members row directly (instant
// add, no consent from the other side — and the RLS policy that allowed it
// let anyone insert that edge from the client with no RPC at all). Now it
// only files a pending request and notifies the target; see
// respond_team_request() for the accept/decline side.
export const requestTeamMemberByHandle = async (handle: string): Promise<RequestMemberResult> => {
  if (!supabase) return { ok: false, reason: 'error' };
  const h = normalizeHandle(handle);
  if (!h) return { ok: false, reason: 'not_found' };

  const { data, error } = await supabase.rpc('request_team_member_by_handle', { p_handle: h });
  if (error || !data) {
    console.error('requestTeamMemberByHandle failed:', error);
    return { ok: false, reason: 'error' };
  }
  return {
    ok: Boolean(data.ok),
    reason: data.reason as InviteReason | undefined,
    name: data.name,
    avatarUrl: data.avatar_url ?? null,
    status: data.status as 'pending' | 'accepted' | undefined,
  };
};

/** Incoming pending requests — the "Pending requests" section on the Team page. */
export const listPendingTeamRequests = async (): Promise<PendingTeamRequest[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase.rpc('list_pending_team_requests');
  if (error) {
    console.error('listPendingTeamRequests failed:', error);
    return [];
  }
  return (data ?? []).map((row: any) => ({
    requestId: row.request_id,
    requesterId: row.requester_id,
    requesterName: row.requester_name || 'MFU member',
    requesterAvatarUrl: row.requester_avatar_url ?? null,
    createdAt: row.created_at,
  }));
};

/** Accept or decline one pending request. */
export const respondToTeamRequest = async (requestId: string, accept: boolean): Promise<boolean> => {
  if (!supabase) return false;
  const { data, error } = await supabase.rpc('respond_team_request', {
    p_request_id: requestId,
    p_accept: accept,
  });
  if (error || !data) {
    console.error('respondToTeamRequest failed:', error);
    return false;
  }
  return Boolean(data.ok);
};
