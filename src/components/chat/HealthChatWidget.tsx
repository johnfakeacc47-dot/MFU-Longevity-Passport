import React, { useCallback, useEffect, useRef, useState } from 'react';
import { LuMessageCircle, LuX, LuSend, LuTrash2, LuSparkles } from 'react-icons/lu';
import { useLanguage } from '../../contexts/LanguageContext';
import {
  streamChat, loadChatHistory, clearChatHistory, type ChatMessage,
} from '../../services/healthChatApi';
import '../../styles/HealthChat.css';

interface Props {
  /** Hide entirely (e.g. on the login screen). */
  hidden?: boolean;
}

const errKey = (code?: string): string => {
  switch (code) {
    case 'not-authenticated': return 'chat.errAuth';
    case 'not-configured': return 'chat.errConfig';
    case 'network': return 'chat.errNetwork';
    default: return 'chat.errGeneric';
  }
};

export const HealthChatWidget: React.FC<Props> = ({ hidden }) => {
  const { t, language } = useLanguage();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [loadedHistory, setLoadedHistory] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError(null);
    setInput('');
    const nextHistory: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages([...nextHistory, { role: 'assistant', content: '' }]);
    setSending(true);
    scrollToEnd();

    abortRef.current = new AbortController();
    const res = await streamChat(nextHistory, language === 'th' ? 'th' : 'en', (chunk) => {
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

    if (!res.ok && !res.text) {
      // drop the empty assistant bubble, surface the error
      setMessages((prev) => prev.slice(0, -1));
      setError(t(errKey(res.error)));
    }
  };

  const handleClear = async () => {
    abortRef.current?.abort();
    await clearChatHistory();
    setMessages([]);
    setError(null);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void send(); }
  };

  if (hidden) return null;

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
                  <button type="button" className="chat-icon-btn" onClick={handleClear} aria-label={t('chat.clear')}>
                    <LuTrash2 />
                  </button>
                )}
                <button type="button" className="chat-icon-btn" onClick={() => setOpen(false)} aria-label={t('common.close') || 'Close'}>
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
                <div key={i} className={`chat-bubble chat-bubble--${m.role}`}>
                  {m.content || (m.role === 'assistant' && sending
                    ? <span className="chat-typing"><i /><i /><i /></span>
                    : '')}
                </div>
              ))}
              {error && <div className="chat-error">{error}</div>}
            </div>

            <div className="chat-disclaimer">{t('chat.disclaimer')}</div>

            <form
              className="chat-input-row"
              onSubmit={(e) => { e.preventDefault(); void send(); }}
            >
              <textarea
                className="chat-input"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('chat.placeholder')}
                rows={1}
                disabled={sending}
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
