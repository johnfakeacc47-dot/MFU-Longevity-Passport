import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuMessageCircle, LuX, LuSend, LuTrash2, LuSparkles, LuRefreshCw } from 'react-icons/lu';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  streamChat, loadChatHistory, clearChatHistory, type ChatMessage,
} from '../../services/healthChatApi';
import '../../styles/HealthChat.css';

interface Props {
  /** Hide entirely (e.g. on the login screen). */
  hidden?: boolean;
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

// On phones Enter should insert a newline (there is a visible send button);
// on keyboards Enter sends and Shift+Enter breaks the line.
const isTouchDevice = () =>
  typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

export const HealthChatWidget: React.FC<Props> = ({ hidden }) => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the stream ended early but we already have partial text: the
  // bubble stays, with a note + retry instead of a silently cut-off answer.
  const [interrupted, setInterrupted] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // Bumped by handleClear so an in-flight send knows its result is stale.
  const clearSeq = useRef(0);

  const scrollToEnd = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  }, []);

  // Load persisted history the first time the panel opens.
  useEffect(() => {
    if (!open || loadedHistory) return;
    setLoadedHistory(true);
    loadChatHistory().then((h) => {
      if (h.length) { setMessages(h); scrollToEnd(); }
    });
  }, [open, loadedHistory, scrollToEnd]);

  useEffect(() => () => abortRef.current?.abort(), []);

  // Auto-grow the textarea with its content, capped at INPUT_MAX_HEIGHT.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, INPUT_MAX_HEIGHT)}px`;
    el.style.overflowY = el.scrollHeight > INPUT_MAX_HEIGHT ? 'auto' : 'hidden';
  }, [input, open]);

  const runStream = async (history: ChatMessage[]) => {
    const seq = clearSeq.current;
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
    setSending(false);

    // The chat was cleared while streaming: nothing left to annotate.
    if (clearSeq.current !== seq) return;

    if (!res.ok && !res.text) {
      // drop the empty assistant bubble, surface the error
      setMessages((prev) => prev.slice(0, -1));
      setError(t(errKey(res.error)));
    } else if (res.error && res.text) {
      setInterrupted(true);
      scrollToEnd();
    }
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setInput('');
    await runStream([...messages, { role: 'user', content: text }]);
  };

  // Re-ask the last user question, replacing the cut-off reply.
  const retryLast = async () => {
    if (sending) return;
    const lastUserIdx = messages.map((m) => m.role).lastIndexOf('user');
    if (lastUserIdx === -1) return;
    await runStream(messages.slice(0, lastUserIdx + 1));
  };

  const handleClear = async () => {
    const ok = await clearChatHistory();
    if (!ok) {
      setError(t('chat.errClear'));
      return;
    }
    clearSeq.current += 1;
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setMessages([]);
    setError(null);
    setInterrupted(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !isTouchDevice()) { e.preventDefault(); void send(); }
  };

  if (hidden) return null;

  const lastIdx = messages.length - 1;

  return (
    <>
      {!open && (
        <button
          type="button"
          className="chat-fab"
          onClick={() => setOpen(true)}
          aria-label={t('chat.open')}
        >
          <LuMessageCircle />
        </button>
      )}

      {open && (
        <div className="chat-sheet-overlay" onClick={() => setOpen(false)}>
          <div className="chat-sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={t('chat.title')}>
            <header className="chat-sheet-head">
              <div className="chat-sheet-title">
                <span className="chat-sheet-icon"><LuSparkles /></span>
                <div>
                  <h3>{t('chat.title')}</h3>
                  <p>{t('chat.subtitle')}</p>
                </div>
              </div>
              <div className="chat-sheet-actions">
                {messages.length > 0 && (
                  <button type="button" className="chat-icon-btn" onClick={() => void handleClear()} aria-label={t('chat.clear')}>
                    <LuTrash2 />
                  </button>
                )}
                <button type="button" className="chat-icon-btn" onClick={() => setOpen(false)} aria-label={t('common.close')}>
                  <LuX />
                </button>
              </div>
            </header>

            <div className="chat-messages" ref={scrollRef}>
              {messages.length === 0 && (
                <div className="chat-empty">
                  <span className="chat-empty-icon"><LuSparkles /></span>
                  <p>{t('chat.emptyTitle')}</p>
                  <span className="chat-empty-hint">{t('chat.emptyHint')}</span>
                </div>
              )}
              {messages.map((m, i) => (
                <React.Fragment key={i}>
                  <div className={`chat-bubble chat-bubble--${m.role}`}>
                    {m.content || (m.role === 'assistant' && sending
                      ? <span className="chat-typing"><i /><i /><i /></span>
                      : '')}
                  </div>
                  {interrupted && i === lastIdx && m.role === 'assistant' && (
                    <button
                      type="button"
                      className="chat-error"
                      onClick={() => void retryLast()}
                      disabled={sending}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        alignSelf: 'flex-start', cursor: 'pointer', font: 'inherit',
                        fontSize: 12, textAlign: 'left',
                      }}
                    >
                      <LuRefreshCw aria-hidden="true" />
                      <span>{t('chat.interrupted')}</span>
                    </button>
                  )}
                </React.Fragment>
              ))}
              {error && <div className="chat-error" role="alert">{error}</div>}
            </div>

            <div className="chat-disclaimer">{t('chat.disclaimer')}</div>

            <form
              className="chat-input-row"
              onSubmit={(e) => { e.preventDefault(); void send(); }}
            >
              <textarea
                ref={inputRef}
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('chat.placeholder')}
                rows={1}
                aria-label={t('chat.placeholder')}
                style={{ maxHeight: INPUT_MAX_HEIGHT, resize: 'none' }}
              />
              <button type="submit" className="chat-send-btn" disabled={sending || !input.trim()} aria-label={t('chat.send')}>
                <LuSend />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
