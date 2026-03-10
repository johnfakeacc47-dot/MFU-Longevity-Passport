import React, { useState, useEffect } from 'react';

// Extend the Event interface to include the prompt method for beforeinstallprompt
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export const InstallPrompt: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if the app is already running in standalone mode (iOS or Android PWA)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    
    // Only set up listeners if we are NOT already installed
    if (!isStandalone) {
      const handleBeforeInstallPrompt = (e: Event) => {
        // Prevent the mini-infobar from appearing on mobile
        e.preventDefault();
        // Stash the event so it can be triggered later.
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        // Update UI notify the user they can install the PWA
        setIsVisible(true);
      };

      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

      // Listen for when the app is successfully installed
      window.addEventListener('appinstalled', () => {
        setIsVisible(false);
        setDeferredPrompt(null);
        console.log('PWA was installed');
      });

      return () => {
        window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    
    // Show the install prompt
    deferredPrompt.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again, throw it away
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <div 
      className="pwa-install-prompt"
      style={{
        position: 'fixed',
        bottom: '80px', // Just above potential bottom navigation bars
        left: '50%',
        transform: 'translateX(-50%)',
        backgroundColor: '#ffffff',
        padding: '12px 20px',
        borderRadius: '30px',
        boxShadow: '0 4px 15px rgba(0, 0, 0, 0.15)',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        zIndex: 9999,
        border: '1px solid #eaeaea',
        width: 'max-content',
        maxWidth: '90vw'
      }}
    >
      <div style={{ flex: 1 }}>
        <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#333' }}>Install Passport</p>
        <p style={{ margin: 0, fontSize: '12px', color: '#666' }}>Add to home screen for faster access</p>
      </div>
      <button 
        onClick={handleInstallClick}
        style={{
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          padding: '8px 16px',
          borderRadius: '20px',
          fontWeight: 'bold',
          cursor: 'pointer',
          fontSize: '13px'
        }}
      >
        Install
      </button>
      <button 
        onClick={() => setIsVisible(false)}
        style={{
          background: 'none',
          border: 'none',
          color: '#999',
          fontSize: '18px',
          cursor: 'pointer',
          padding: '0 4px'
        }}
        aria-label="Dismiss install prompt"
      >
        ×
      </button>
    </div>
  );
};
