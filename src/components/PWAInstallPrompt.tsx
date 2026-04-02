import React, { useState, useEffect, useRef } from 'react';

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

// ── Helpers ───────────────────────────────────────────────────────────────────
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as unknown as Record<string, unknown>).standalone === true;

const getDeviceType = (): 'ios' | 'android' | 'desktop' => {
  const ua = window.navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

const STORAGE_KEY = 'pwaPromptDismissed';

// ── Component ─────────────────────────────────────────────────────────────────
export const PWAInstallPrompt: React.FC<PWAInstallPromptProps> = ({ triggerOnLogin = false }) => {
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
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
      setCanPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', () => {
      localStorage.setItem(STORAGE_KEY, 'true');
      animateClose();
    });
    return () => window.removeEventListener('beforeinstallprompt', handler);
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

  const handleLater = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    animateClose();
  };

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

  const canNativeInstall = deviceType !== 'ios' && canPrompt;

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
        padding: '0 12px 20px',
        animation: closing ? 'pwaSlideDown 0.4s cubic-bezier(0.4,0,1,1) forwards' : 'pwaSlideUp 0.45s cubic-bezier(0.16,1,0.3,1) forwards',
        pointerEvents: 'none',
      }}>
        <div style={{
          pointerEvents: 'auto',
          width: '100%',
          maxWidth: '420px',
          background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '28px',
          border: '1px solid rgba(255,255,255,0.55)',
          boxShadow: '0 20px 60px rgba(17,30,50,0.18), 0 0 0 0.5px rgba(255,255,255,0.6) inset',
          padding: '28px 24px 20px',
          textAlign: 'center',
        }}>
          {/* ── Logo ── */}
          <div style={{
            width: '72px', height: '72px',
            margin: '0 auto 18px',
            background: 'linear-gradient(135deg, #d1fae5, #eff6ff)',
            borderRadius: '20px',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 0 6px rgba(16,185,129,0.10), 0 8px 24px rgba(16,185,129,0.2)',
            border: '1px solid rgba(255,255,255,0.7)',
            fontSize: '38px',
            lineHeight: 1,
          }}>
            🫀
          </div>

          {/* ── Header ── */}
          <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 900, color: '#0f1a0f', letterSpacing: '-0.4px' }}>
            Add to Home Screen
          </h2>
          <p style={{ margin: '0 0 22px', fontSize: '13.5px', color: '#6b7280', lineHeight: 1.55, fontWeight: 500 }}>
            Install <strong style={{ color: '#0f1a0f' }}>MFU Longevity Passport</strong> for offline access and push notifications.
          </p>

          {/* ── Platform Instructions ── */}
          {deviceType === 'ios' && (
            <div style={{
              background: 'rgba(240,253,244,0.8)', border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: '16px', padding: '16px', marginBottom: '20px', textAlign: 'left',
            }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Steps to Install</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { n: '1', icon: '⬆️', text: <>Tap the <strong>Share</strong> button at the bottom of Safari</> },
                  { n: '2', icon: '➕', text: <>Scroll down and tap <strong>"Add to Home Screen"</strong></> },
                ].map(step => (
                  <div key={step.n} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '14px', flexShrink: 0,
                    }}>{step.icon}</div>
                    <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.4 }}>{step.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {deviceType === 'android' && !canNativeInstall && (
            <div style={{
              background: 'rgba(240,253,244,0.8)', border: '1px solid rgba(16,185,129,0.15)',
              borderRadius: '16px', padding: '16px', marginBottom: '20px', textAlign: 'left',
            }}>
              <p style={{ margin: '0 0 12px', fontSize: '11px', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Steps to Install</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {[
                  { icon: '⋮', text: <>Tap the <strong>Menu</strong> (three dots) in the top right</> },
                  { icon: '📲', text: <>Tap <strong>"Install App"</strong> or <strong>"Add to Home Screen"</strong></> },
                ].map((step, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '50%',
                      background: 'white', boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: i === 0 ? '18px' : '14px', fontWeight: 900,
                      flexShrink: 0, color: '#374151',
                    }}>{step.icon}</div>
                    <span style={{ fontSize: '13px', color: '#374151', lineHeight: 1.4 }}>{step.text}</span>
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
                onClick={handleInstallNow}
                style={{
                  width: '100%', padding: '15px',
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.30)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  letterSpacing: '-0.2px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
              >
                🚀 Install Now
              </button>
            ) : (
              <button
                onClick={handleDone}
                style={{
                  width: '100%', padding: '15px',
                  background: 'linear-gradient(135deg, #10b981, #06b6d4)',
                  color: 'white', border: 'none', borderRadius: '16px',
                  fontSize: '15px', fontWeight: 800, cursor: 'pointer',
                  boxShadow: '0 8px 24px rgba(16,185,129,0.30)',
                  letterSpacing: '-0.2px',
                }}
              >
                ✅ Done, I've Added It!
              </button>
            )}

            <button
              onClick={handleLater}
              style={{
                width: '100%', padding: '12px',
                background: 'transparent', color: '#9ca3af',
                border: 'none', borderRadius: '14px',
                fontSize: '13px', fontWeight: 600, cursor: 'pointer',
              }}
            >
              Maybe Later
            </button>
          </div>

          {/* ── Bottom hint ── */}
          <p style={{ margin: '12px 0 0', fontSize: '11px', color: '#d1d5db', fontWeight: 500 }}>
            You won't see this again once installed.
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
