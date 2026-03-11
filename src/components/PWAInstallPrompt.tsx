import React, { useState, useEffect } from 'react';

export const PWAInstallPrompt: React.FC = () => {
  const [showPrompt, setShowPrompt] = useState(false);
  const [deviceType, setDeviceType] = useState<'ios' | 'android' | 'other'>('other');

  useEffect(() => {
    // Check if app is already installed (standalone mode)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const hasDismissed = localStorage.getItem('pwaPromptDismissed') === 'true';

    if (!isStandalone && !hasDismissed) {
      // Determine device type
      const userAgent = window.navigator.userAgent.toLowerCase();
      if (/iphone|ipad|ipod/.test(userAgent)) {
        setDeviceType('ios');
      } else if (/android/.test(userAgent)) {
        setDeviceType('android');
      }
      
      // Delay slightly so it doesn't snap instantly on navigation (better UX)
      const timer = setTimeout(() => {
        setShowPrompt(true);
      }, 1500); // 1.5s delay after dashboard loads
      
      return () => clearTimeout(timer);
    }
  }, []);

  const handleDismiss = () => {
    localStorage.setItem('pwaPromptDismissed', 'true');
    setShowPrompt(false);
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in" style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div className="bg-white/95 backdrop-blur-xl rounded-3xl p-6 shadow-2xl max-w-sm w-full border border-white/50 text-center" style={{ animation: 'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)' }}>
        <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-inner border border-purple-50">
          <span className="text-3xl drop-shadow-sm">📱</span>
        </div>
        
        <h2 className="text-xl font-black text-gray-900 mb-2 tracking-tight">Add to Home Screen</h2>
        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
          Install the <strong>MFU Longevity Passport</strong> app for quick access, offline tracking, and push notifications!
        </p>

        <div className="bg-gray-50/80 rounded-2xl p-4 mb-6 border border-gray-100 text-left shadow-sm">
          {deviceType === 'ios' ? (
             <div className="text-sm text-gray-700 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-purple-600 shrink-0">1</div>
                 <span>Tap the <b>Share</b> icon <br/><span className="text-xs text-gray-500 font-medium tracking-tight">at the bottom of Safari</span></span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-purple-600 shrink-0">2</div>
                 <span>Scroll and tap <br/><b>"Add to Home Screen"</b> ➕</span>
               </div>
             </div>
          ) : deviceType === 'android' ? (
             <div className="text-sm text-gray-700 flex flex-col gap-4">
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-purple-600 shrink-0">1</div>
                 <span>Tap the <b>Menu</b> icon <br/><span className="text-xs text-gray-500 font-medium tracking-tight">three dots in top right</span></span>
               </div>
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center font-bold text-purple-600 shrink-0">2</div>
                 <span>Tap <b>"Install App"</b> <br/>or "Add to Home Screen"</span>
               </div>
             </div>
          ) : (
             <div className="text-sm text-gray-700 flex flex-col gap-3">
               <div className="flex items-center gap-3">
                 <span className="text-2xl">💡</span>
                 <span>Install this app on your device for the best experience. Look for an <b>"Install"</b> or <b>"Add to Home Screen"</b> option in your browser menu.</span>
               </div>
             </div>
          )}
        </div>

        <div className="flex flex-col gap-3">
          <button 
            onClick={handleDismiss}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm shadow-xl shadow-purple-200 active:scale-95 transition-transform"
          >
            Done
          </button>
          <button 
            onClick={handleDismiss}
            className="w-full py-3 rounded-xl bg-transparent text-gray-500 font-bold text-xs active:scale-95 transition-transform hover:bg-gray-50"
          >
            Maybe Later
          </button>
        </div>
      </div>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(20px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>
    </div>
  );
};
