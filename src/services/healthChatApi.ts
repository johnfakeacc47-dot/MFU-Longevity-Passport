// AI health-coach chat. Talks to the `health-chat` Edge Function, which streams
// the reply and grounds it in the user's own logged data. History lives in the
// `chat_messages` table (RLS: per-user).
import { supabase } from './supabaseClient';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const FN_URL = `${import.meta.env.VITE_SUPABASE_URL ?? ''}/functions/v1/health-chat`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const MAX_TURNS_SENT = 16;

/** Load the persisted conversation, oldest first. */
export const loadChatHistory = async (limit = 50): Promise<ChatMessage[]> => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('chat_messages')
    .select('role, content, created_at')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return data
    .reverse()
    .map((r) => ({ role: r.role as 'user' | 'assistant', content: r.content }));
};

/** Wipe the caller's chat history. */
export const clearChatHistory = async (): Promise<boolean> => {
  if (!supabase) return false;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;
  const { error } = await supabase.from('chat_messages').delete().eq('user_id', user.id);
  return !error;
};

export interface StreamChatResult {
  ok: boolean;
  text: string;
  error?: string;
}

/**
 * Send `history` (ending with the new user message) and stream the reply.
 * `onToken` fires for each chunk; the full text is also returned.
 */
export const streamChat = async (
  history: ChatMessage[],
  lang: 'en' | 'th',
  onToken: (chunk: string) => void,
  signal?: AbortSignal,
): Promise<StreamChatResult> => {
  if (!supabase || !FN_URL.startsWith('http')) {
    return { ok: false, text: '', error: 'not-configured' };
  }
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { ok: false, text: '', error: 'not-authenticated' };

  const messages = history.slice(-MAX_TURNS_SENT).map((m) => ({ role: m.role, content: m.content }));

  let res: Response;
  try {
    res = await fetch(FN_URL, {
      method: 'POST',
      signal,
      headers: {
        Authorization: `Bearer ${session.access_token}`,
        apikey: ANON_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages, lang }),
    });
  } catch (e) {
    if ((e as Error).name === 'AbortError') return { ok: false, text: '', error: 'aborted' };
    return { ok: false, text: '', error: 'network' };
  }

  if (!res.ok || !res.body) {
    let msg = `http-${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch { /* keep code */ }
    return { ok: false, text: '', error: msg };
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = '';
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      if (chunk) {
        full += chunk;
        onToken(chunk);
      }
    }
  } catch (e) {
    if ((e as Error).name === 'AbortError') return { ok: full.length > 0, text: full, error: 'aborted' };
    return { ok: full.length > 0, text: full, error: 'stream' };
  }
  return { ok: true, text: full };
};
