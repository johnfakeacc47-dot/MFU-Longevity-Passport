// ui_ref2 "AI Health Coach" as a full screen (bottom-nav tab). Same engine as the
// former floating chat widget: services/healthChatApi (streamChat / history / clear).
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { TopBar } from '../components/TopBar';
import { Send, Trash2, RefreshCw } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useSEO } from '../hooks/useSEO';
import { streamChat, loadChatHistory, clearChatHistory, type ChatMessage } from '../services/healthChatApi';
import { IconBtn, Chip, ICON_PROPS } from '../components/v2';
import type { PageType } from '../types/pages';

interface Props {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

const INPUT_MAX_HEIGHT = 120;

const errKey = (code?: string): string => {
  switch (code) {
    case 'not-authenticated': return 'chat.errAuth';
    case 'not-configured': return 'chat.errConfig';
    case 'network': return 'chat.errNetwork';
    case 'quota_exceeded': return 'ai.quotaReached';
    default: return 'chat.errGeneric';
  }
};

// On phones Enter inserts a newline (there is a visible send button).
const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const Coach: React.FC<Props> = ({ onNavigate }) => {
  const { t, language } = useLanguage();
  useSEO(`${t('chat.title')} · MFU Longevity Passport`, 'Ask the AI health coach about your data, goals and team.');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Stream ended early with partial text: keep the bubble, offer a retry.
  const [interrupted, setInterrupted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const clearSeq = useRef(0);
  // Synchronous lock: `sending` state lags a render, so a fast double Enter/click could submit twice.
  const sendingRef = useRef(false);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  useEffect(() => {
    loadChatHistory().then((h) => { if (h.length) { setMessages(h); scrollToEnd(); } });
  }, [scrollToEnd]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Auto-grow the textarea with its content.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
  }, [input]);

  const runStream = async (history: ChatMessage[]) => {
    const seq = clearSeq.current;
    sendingRef.current = true;
    setError(null);
    setInterrupted(false);
    setMessages([...history, { role: 'assistant', content: '' }]);
    setSending(true);
    scrollToEnd();

    abortRef.current = new AbortController();
    const res = await streamChat(history, language === 'th' ? 'th' : 'en', (chunk) => {
      if (clearSeq.current !== seq) return;
      setMessages((prev) => {
        const copy = prev.slice();
        const last = copy[copy.length - 1];
        if (last?.role === 'assistant') copy[copy.length - 1] = { ...last, content: last.content + chunk };
        return copy;
      });
      scrollToEnd();
    }, abortRef.current.signal);
    abortRef.current = null;
    sendingRef.current = false;
    setSending(false);

    if (clearSeq.current !== seq) return;
    if (!res.ok && !res.text) {
      setMessages((prev) => prev.slice(0, -1));
      setError(t(errKey(res.error)));
    } else if (res.error && res.text) {
      setInterrupted(true);
      scrollToEnd();
    }
  };

  const sendText = async (raw: string) => {
    const text = raw.trim();
    if (!text || sending || sendingRef.current) return;
    sendingRef.current = true;
    setInput('');
    await runStream([...messages, { role: 'user', content: text }]);
  };

  const retryLast = async () => {
    if (sending || sendingRef.current) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;
    await runStream(messages.slice(0, lastUserIdx + 1));
  };

  const handleClear = async () => {
    const ok = await clearChatHistory();
    if (!ok) { setError(t('chat.errClear')); return; }
    clearSeq.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    sendingRef.current = false;
    setSending(false); setMessages([]); setError(null); setInterrupted(false);
  };

  // Keep the composer above the on-screen keyboard (iOS ignores interactive-widget).
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const apply = () => document.documentElement.style.setProperty('--vvh', `${Math.round(vv.height)}px`);
    apply();
    vv.addEventListener('resize', apply);
    return () => { vv.removeEventListener('resize', apply); document.documentElement.style.removeProperty('--vvh'); };
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice()) { e.preventDefault(); void sendText(input); }
  };

  const lastIdx = messages.length - 1;
  const quick = [t('v2.quick.summary'), t('v2.quick.sleep'), t('v2.quick.exercise')];

  return (
    <div className="v2-page v2-chat-page">
      <TopBar title={t('v2.coachName')} subtitle={t('v2.coachSub')} onNavigate={onNavigate}
        actions={messages.length > 0 ? (
          <IconBtn label={t('chat.clear')} onClick={() => void handleClear()}><Trash2 size={20} {...ICON_PROPS} /></IconBtn>
        ) : undefined} />

      <div className="v2-chat-scroll" ref={scrollRef} aria-live="polite">
        {messages.length === 0 && (
          <div className="v2-chat-stamp">
            <p style={{ fontWeight: 700, color: 'var(--v2-text)', marginBottom: 6 }}>{t('chat.emptyTitle')}</p>
            <p>{t('chat.emptyHint')}</p>
          </div>
        )}
        {messages.map((m, i) => (
          <React.Fragment key={i}>
            {m.content ? (
              <div className={`v2-bubble ${m.role === 'user' ? 'v2-bubble--me' : 'v2-bubble--ai'}`}>{m.content}</div>
            ) : (m.role === 'assistant' && sending ? <span className="v2-typing" aria-label={t('v2.loading')}><i /><i /><i /></span> : null)}
            {interrupted && i === lastIdx && m.role === 'assistant' && (
              <button type="button" className="v2-link" style={{ alignSelf: 'flex-start', display: 'inline-flex', gap: 6, alignItems: 'center' }}
                onClick={() => void retryLast()} disabled={sending}>
                <RefreshCw size={14} {...ICON_PROPS} /> {t('chat.interrupted')}
              </button>
            )}
          </React.Fragment>
        ))}
        {error && <div className="v2-alert v2-alert--error" role="alert">{error}</div>}
      </div>

      <div className="v2-chat-foot">
        <div className="v2-chips" style={{ gap: 8 }}>
          {quick.map((q) => <Chip key={q} onClick={() => void sendText(q)} disabled={sending}>{q}</Chip>)}
        </div>
        <form className="v2-chat-send" onSubmit={(e) => { e.preventDefault(); void sendText(input); }}>
          <textarea
            ref={inputRef}
            className="v2-input"
            rows={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={t('v2.askPlaceholder')}
            aria-label={t('v2.askPlaceholder')}
          />
          <button type="submit" className="v2-send" disabled={sending || !input.trim()} aria-label={t('chat.send')}>
            <Send size={22} {...ICON_PROPS} />
          </button>
        </form>
        <p className="v2-chat-note">{t('v2.coachDisclaimer')}</p>
      </div>

    </div>
  );
};
