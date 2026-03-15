import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getCurrentUserProfile, updateScoreVisibility, deleteUserAccount } from '../services/supabaseClient';

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker';

interface PrivacySettingsProps {
  onNavigate: (page: PageType) => void;
  onOpenFoodRecognition: () => void;
}

export const PrivacySettings: React.FC<PrivacySettingsProps> = ({ onNavigate, onOpenFoodRecognition }) => {
  const { t } = useLanguage();
  const [shareScore, setShareScore] = useState(false);
  const [shareHabits, setShareHabits] = useState(false);
  const [anonymousAI, setAnonymousAI] = useState(true);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteStep, setDeleteStep] = useState<1 | 2>(1);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load the real setting from Supabase on mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const profile = await getCurrentUserProfile();
        if (profile) {
          setShareScore(profile.is_score_public ?? false);
        }
      } catch (error) {
        console.error('Error loading profile:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleShareToggle = (checked: boolean) => {
    if (checked) {
      // Show confirmation modal before enabling
      setShowConfirmModal(true);
    } else {
      // Disable directly
      confirmShareChange(false);
    }
  };

  const confirmShareChange = async (isPublic: boolean) => {
    try {
      await updateScoreVisibility(isPublic);
      setShareScore(isPublic);
      setShowConfirmModal(false);

      if (isPublic) {
        // Send push notification
        if ('Notification' in window && Notification.permission === 'granted') {
          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready.then((registration) => {
              registration.showNotification('Privacy Updated 🛡️', {
                body: 'You are now sharing your longevity score with your team. You can disable this anytime in settings.',
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
              });
            });
          } else {
            new Notification('Privacy Updated 🛡️', {
              body: 'You are now sharing your longevity score with your team. You can disable this anytime in settings.',
              icon: '/pwa-192x192.png',
            });
          }
        }
      }
    } catch (error) {
      console.error('Error updating score visibility:', error);
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 1) {
      setDeleteStep(2);
      return;
    }
    // Step 2 confirmed — proceed with deletion
    setIsDeleting(true);
    try {
      // Part 1: Delete data from tables
      await deleteUserAccount();

      // Part 2: Call Edge Function to delete auth user
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const session = JSON.parse(localStorage.getItem('sb-' + new URL(supabaseUrl).hostname.split('.')[0] + '-auth-token') || '{}');
      const accessToken = session?.access_token;

      if (supabaseUrl && accessToken) {
        await fetch(`${supabaseUrl}/functions/v1/delete-user`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // Clear local storage and redirect
      localStorage.clear();
      onNavigate('login');
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('Failed to delete account. Please try again.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
      setDeleteStep(1);
    }
  };

  return (
    <div className="profile-container pb-24 premium-gradient" style={{ minHeight: '100vh' }}>
      <header className="profile-top-header" style={{ background: 'transparent', border: 'none' }}>
        <button className="back-btn" onClick={() => onNavigate('profile')}>←</button>
        <h1 className="header-title text-gradient">Privacy & Data</h1>
        <div style={{ width: 44 }} />
      </header>

      <div className="profile-content page-content p-4 space-y-6">
        {/* Main Controls */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-6">
            <span className="section-icon">🛡️</span>
            <span className="section-title text-black font-bold">Sharing Preferences</span>
          </div>

          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm text-gray-900">Share Longevity Score</div>
                <div className="text-sm text-gray-500 mt-1">Allow team members to see your overall score.</div>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={shareScore}
                  disabled={isLoading}
                  onChange={(e) => handleShareToggle(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/50">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm text-gray-900">Share Detailed Habits</div>
                <div className="text-sm text-gray-500 mt-1">Visible to team members during shared missions.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={shareHabits} onChange={(e) => setShareHabits(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>

            <div className="flex justify-between items-center pt-4 border-t border-white/50">
              <div className="flex-1 pr-4">
                <div className="font-bold text-sm text-gray-900">AI Model Contribution</div>
                <div className="text-sm text-gray-500 mt-1">Share anonymous corrections to improve food recognition.</div>
              </div>
              <label className="toggle-switch">
                <input type="checkbox" checked={anonymousAI} onChange={(e) => setAnonymousAI(e.target.checked)} />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </div>

        {/* Your Rights Section */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon">📜</span>
            <span className="section-title text-black font-bold">Your Rights (PDPA)</span>
          </div>
          <div className="grid grid-cols-1 gap-4 mt-4">
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="text-sm font-bold text-gray-800">Right to Access</div>
              <p className="text-xs text-gray-600 mt-1">You can request a copy of all personal data we store about you at any time.</p>
            </div>
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="text-sm font-bold text-gray-800">Right to Erasure</div>
              <p className="text-xs text-gray-600 mt-1">You have the right to request permanent deletion of your health records.</p>
            </div>
            <div className="bg-white/40 p-3 rounded-xl border border-white/60">
              <div className="text-sm font-bold text-gray-800">Data Portability</div>
              <p className="text-xs text-gray-600 mt-1">Export your activity and nutrition history in standard digital formats.</p>
            </div>
          </div>
        </div>

        {/* Policy Summary */}
        <div className="glass-card p-6 rounded-2xl" style={{ padding: '1.5rem', height: 'auto', minHeight: 'fit-content' }}>
          <div className="section-header mb-4">
            <span className="section-icon">📋</span>
            <span className="section-title text-black font-bold">Policy Summary</span>
          </div>
          <p className="text-sm text-gray-600 leading-relaxed break-words" style={{ overflowWrap: 'break-word' }}>
            The MFU Longevity Passport collects health-related data solely to calculate your longevity score and provide personalized wellness insights. 
            <br/><br/>
            We use industry-standard encryption to protect your data. Your specific health logs are <strong>never</strong> shared with third parties without your explicit consent.
          </p>
          <button className="mt-4 text-xs font-bold text-purple-700 underline">Read Full Privacy Policy</button>
        </div>

        {/* Danger Zone */}
        <div className="p-6 rounded-2xl border-2 border-dashed border-red-200 bg-red-50/30" style={{ padding: '1.5rem' }}>
          <h3 className="text-sm font-bold text-red-600 mb-2">Danger Zone</h3>
          <p className="text-sm text-gray-500 mb-4 break-words" style={{ overflowWrap: 'break-word' }}>Deleting your account will remove all health history from our servers. This action is irreversible.</p>
          <button 
            className="w-full py-3 rounded-xl bg-red-600 text-white text-sm font-bold shadow-lg shadow-red-200 active:scale-95 transition-transform mt-6"
            style={{ marginTop: '1.5rem' }}
            onClick={() => { setDeleteStep(1); setShowDeleteModal(true); }}
          >
            Delete My Account & Data
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={() => setShowConfirmModal(false)}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(16px)',
              borderRadius: '24px', padding: '28px', maxWidth: '360px', width: '100%',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.15)',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>🤝</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1a2e', marginBottom: '8px' }}>
              Share with Team?
            </h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
              Your current longevity score will be visible to your team members.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmModal(false)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid #ddd', background: '#f5f5f5',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#555',
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => confirmShareChange(true)}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: 'none', background: 'linear-gradient(135deg, #11a164, #0d8f58)',
                  color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(17,161,100,0.3)',
                }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Double-Confirmation Modal */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 9999, padding: '20px',
          }}
          onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }}
        >
          <div
            style={{
              background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(16px)',
              borderRadius: '24px', padding: '28px', maxWidth: '360px', width: '100%',
              border: '1px solid rgba(255,255,255,0.4)',
              boxShadow: '0 16px 48px rgba(0,0,0,0.2)',
              textAlign: 'center',
              animation: 'slideUp 0.3s ease-out',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>{deleteStep === 1 ? '⚠️' : '🚨'}</div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: '#dc2626', marginBottom: '8px' }}>
              {deleteStep === 1 ? 'Delete Account?' : 'Are you absolutely sure?'}
            </h3>
            <p style={{ fontSize: '14px', color: '#666', lineHeight: 1.6, marginBottom: '24px' }}>
              {deleteStep === 1
                ? 'This will permanently delete your account and all longevity data.'
                : 'This action is permanent and all your longevity data will be lost. This cannot be undone.'}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteStep(1); }}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: '1px solid #ddd', background: '#f5f5f5',
                  fontSize: '14px', fontWeight: 600, cursor: 'pointer', color: '#555',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={isDeleting}
                style={{
                  flex: 1, padding: '12px', borderRadius: '12px',
                  border: 'none', background: deleteStep === 1 ? '#ef4444' : '#dc2626',
                  color: 'white', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(220,38,38,0.3)',
                  opacity: isDeleting ? 0.6 : 1,
                }}
              >
                {isDeleting ? 'Deleting...' : (deleteStep === 1 ? 'Yes, Delete' : 'Permanently Delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      <footer className="bottom-nav glass-card" style={{ borderBottom: 'none', borderLeft: 'none', borderRight: 'none' }}>
        <button className="nav-icon" onClick={() => onNavigate('home')}>
          <span className="nav-emoji">🏠</span>
          <span className="nav-label">{t('nav.home')}</span>
        </button>
        <button className="nav-icon" onClick={onOpenFoodRecognition}>
          <span className="nav-emoji">🍽️</span>
          <span className="nav-label">{t('nav.fasting')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('dashboard')}>
          <span className="nav-emoji">📊</span>
          <span className="nav-label">{t('nav.dashboard')}</span>
        </button>
        <button className="nav-icon" onClick={() => onNavigate('team')}>
          <span className="nav-emoji">👥</span>
          <span className="nav-label">{t('nav.team')}</span>
        </button>
        <button className="nav-icon active" onClick={() => onNavigate('profile')}>
          <span className="nav-emoji">👤</span>
          <span className="nav-label">{t('nav.profile')}</span>
        </button>
      </footer>
    </div>
  );
};
