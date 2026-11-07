import React, { useState, useEffect, useRef } from 'react';
import { FaArrowUp, FaCheckCircle, FaDownload, FaHeart, FaMobileAlt, FaPlus } from 'react-icons/fa';
import { useLanguage } from '../contexts/LanguageContext';

// ── Types ─────────────────────────────────────────────────────────────────────
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

interface PWAInstallPromptProps {
  /** Set to true right after a successful login to trigger the sheet */
  triggerOnLogin?: boolean;
}

type StandaloneNavigator = Navigator & { standalone?: boolean };

// ── Helpers ───────────────────────────────────────────────────────────────────
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as StandaloneNavigator).standalone === true;

const getDeviceType = (): 'ios' | 'android' | 'desktop' => {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

const STORAGE_KEY = 'pwaPromptDismissed';

/**
 * Locale strings mark emphasis with **double asterisks** (e.g. 'Tap the
 * **Share** button'), so translators can move the bold word freely. Render
 * those runs as <strong>.
 */
function renderBold(text: string): React.ReactNode {
  const parts = text.split('**');
  if (parts.length === 1) return text;
  return parts.map((part, i) =>
    i % 2 === 1
      ? <strong key={i} style={{ color: 'var(--text-primary)' }}>{part}</strong>
      : <React.Fragment key={i}>{part}</React.Fragment>,
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ triggerOnLogin = false }) => {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [deviceType] = useState(getDeviceType);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  function animateClose() {
    setClosing(true);
    setTimeout(() => { setVisible(false); setClosing(false); }, 400);
  }

  // Intercept Chrome's native beforeinstallprompt event
  useEffect(() => {
    if (isStandalone()) return;
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e as BeforeInstallPromptEvent;
    };
    const onInstalled = () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      animateClose();
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  // Trigger: show after login (once), not in standalone mode
  useEffect(() => {
    if (!triggerOnLogin) return;
    if (isStandalone()) return;
    if (localStorage.getItem(STORAGE_KEY) === 'true') return;

    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, [triggerOnLogin]);

  const handleDone = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    animateClose();
  };

  const handleLater = () => animateClose();

  const handleInstallNow = async () => {
    if (deferredPromptRef.current) {
      await deferredPromptRef.current.prompt();
      const { outcome } = await deferredPromptRef.current.userChoice;
      if (outcome === 'accepted') localStorage.setItem(STORAGE_KEY, 'true');
      deferredPromptRef.current = null;
    }
    animateClose();
  };

  if (!visible) return null;

  const canNativeInstall = deviceType !== 'ios' && deferredPromptRef.current !== null;

  const stepCardStyle: React.CSSProperties = {
    background: 'var(--surface-soft)', border: '1px solid var(--border-glass)',
    borderRadius: '16px', padding: '16px', marginBottom: '20px', textAlign: 'left',
  };
  const stepTitleStyle: React.CSSProperties = {
    margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: 'var(--text-secondary)',
    textTransform: 'uppercase', letterSpacing: '0.08em',
  };
  const stepBubbleStyle: React.CSSProperties = {
    width: '28px', height: '28px', borderRadius: '50%',
    background: 'var(--surface-solid)', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '14px', flexShrink: 0, color: 'var(--accent-dark)',
  };
  const stepTextStyle: React.CSSProperties = { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.4 };

  const iosSteps = [
    { icon: <FaArrowUp />, text: t('pwa.iosStep1') },
    { icon: <FaPlus />, text: t('pwa.iosStep2') },
  ];
  const androidSteps = [
    { icon: '⋮', text: t('pwa.androidStep1') },
    { icon: <FaMobileAlt />, text: t('pwa.androidStep2') },
  ];

  return (
    <>
      {/* ── Backdrop ── */}
      <div
        onClick={handleLater}
        style={{
          position: 'fixed', inset: 0, zIndex: 9998,
          background: 'rgba(0,0,0,0.35)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          animation: closing ? 'pwaFadeOut 0.35s ease forwards' : 'pwaFadeIn 0.3s ease forwards',
        }}
      />

      {/* ── Sheet ── */}
      <div style={{
        position: 'fixed',
        bottom: 0, left: 0, right: 0,
        zIndex: 9999,
        display: 'flex',
        justifyContent: 'center',
        // Keep the sheet clear of the iPhone home indicator / Android gesture bar.
        padding: '0 12px calc(20px + env(safe-area-inset-bottom, 0px))',
        animation: closing ? 'pwaSlideDown 0.4s cubic-bezier(0.4,0,1,1) forwards' : 'pwaSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        pointerEvents: 'none',
      }}>
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="pwa-install-title"
          style={{
            pointerEvents: 'auto',
            width: '100%',
            maxWidth: '420px',
            background: 'var(--surface-solid)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            borderRadius: '28px',
            border: '1px solid var(--border-glass)',
            boxShadow: '0 20px 60px rgba(17,30,50,0.25)',
            padding: '28px 24px 20px',
            textAlign: 'center',
          }}
        >
          {/* ── Logo ── */}
          <div aria-hidden="true" style={{
            width: '72px', height: '72px',
            margin: '0 auto 18px',
            background: 'var(--surface-soft)',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 6px rgba(25,118,210,0.10), 0 8px 24px rgba(25,118,210,0.2)',
            border: '1px solid var(--border-glass)',
            fontSize: '38px',
            lineHeight: 1,
            color: 'var(--accent)',
          }}>
            <FaHeart />
          </div>

          {/* ── Header ── */}
          <h2 id="pwa-install-title" style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.4px' }}>
            {t('pwa.title')}
          </h2>
          <p style={{ margin: '0 0 22px', fontSize: '13.5px', color: 'var(--text-secondary)', lineHeight: 1.55, fontWeight: 500 }}>
            {renderBold(t('pwa.body'))}
          </p>

          {/* ── Platform Instructions ── */}
          {deviceType === 'ios' && (
            <div style={stepCardStyle}>
              <p style={stepTitleStyle}>{t('pwa.stepsTitle')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {iosSteps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={stepBubbleStyle}>{step.icon}</div>
                    <span style={stepTextStyle}>{renderBold(step.text)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deviceType === 'android' && !canNativeInstall && (
            <div style={stepCardStyle}>
              <p style={stepTitleStyle}>{t('pwa.stepsTitle')}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {androidSteps.map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ ...stepBubbleStyle, fontSize: i === 0 ? '18px' : '14px', fontWeight: 900 }}>{step.icon}</div>
                    <span style={stepTextStyle}>{renderBold(step.text)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Buttons ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {/* Primary: install now if Chrome supports it */}
            {canNativeInstall ? (
              <button
                type="button"
                onClick={handleInstallNow}
                style={{
                  width: '100%', padding: '15px',
                  background: 'linear-gradient(135deg, #1976D2, #1565C0)',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(25,118,210,0.30)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  letterSpacing: '-0.2px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
              >
                <FaDownload aria-hidden="true" /> {t('pwa.installNow')}
              </button>
            ) : (
              <button
                type="button"
                onClick={handleDone}
                style={{
                  width: '100%', padding: '15px',
                  background: 'linear-gradient(135deg, #1976D2, #1565C0)',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(25,118,210,0.30)',
                  letterSpacing: '-0.2px',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                }}
              >
                <FaCheckCircle aria-hidden="true" /> {t('pwa.done')}
              </button>
            )}

            <button
              type="button"
              onClick={handleLater}
              style={{
                width: '100%', padding: '12px',
                background: 'transparent', color: 'var(--accent-dark)',
                border: 'none', borderRadius: '14px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              {t('pwa.later')}
            </button>
          </div>

          {/* ── Bottom hint ── */}
          <p style={{ margin: '12px 0 0', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>
            {t('pwa.hint')}
          </p>
        </div>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes pwaFadeIn    { from { opacity: 0 } to { opacity: 1 } }
        @keyframes pwaFadeOut   { from { opacity: 1 } to { opacity: 0 } }
        @keyframes pwaSlideUp   { from { opacity: 0; transform: translateY(60px) scale(0.97) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes pwaSlideDown { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(60px) scale(0.97) } }
      `}</style>
    </>
  );
};
