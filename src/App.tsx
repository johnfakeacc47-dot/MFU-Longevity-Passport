import React, { useState, lazy, Suspense, useEffect } from 'react'
import './App.css'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Fasting } from './pages/Fasting'
import { Dashboard } from './pages/Dashboard'
import { Team } from './pages/Team'
import { Profile } from './pages/Profile'
import { EditProfile } from './pages/EditProfile'
import { Activity } from './pages/Activity'
import { Sleep } from './pages/Sleep'
import UserManagement from './pages/UserManagement'
import { PrivacySettings } from './pages/PrivacySettings'
import { SetGoals } from './pages/SetGoals'
import { AboutTracker } from './pages/AboutTracker'
import { LanguageProvider } from './contexts/LanguageContext'
import { calculateLongevityScore } from './utils/longevityScore'
import { syncDailyScoreToSupabase, supabase } from './services/supabaseClient'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'

const FoodRecognition = lazy(() => import('./components/FoodRecognition').then(module => ({ default: module.FoodRecognition })))

class FoodRecognitionErrorBoundary extends React.Component<
  { onClose: () => void; children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  constructor(props: { onClose: () => void; children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, message: '' }
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="loading-overlay">
          <div>
            <div>Food Recognition failed to load.</div>
            <div style={{ marginTop: 8, fontSize: 14 }}>{this.state.message}</div>
            <button
              style={{ marginTop: 16, padding: '8px 14px', borderRadius: 8, border: 'none', cursor: 'pointer' }}
              onClick={this.props.onClose}
            >
              Close
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

const FoodRecognitionFallback = () => (
  <div className="loading-overlay">
    Loading Food Recognition...
  </div>
)

type PageType = 'login' | 'home' | 'fasting' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'activity' | 'sleep' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('login')
  const [showFoodRecognition, setShowFoodRecognition] = useState(false)
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)

  // Restore session on page refresh
  useEffect(() => {
    const token = localStorage.getItem('authToken');
    const savedPage = localStorage.getItem('currentPage') as PageType;
    if (token) {
      if (savedPage && savedPage !== 'login') {
        setCurrentPage(savedPage);
      } else {
        setCurrentPage('home');
      }
    }

    // Listen for auth state changes (crucial for OAuth redirects)
    const { data: { subscription } } = supabase!.auth.onAuthStateChange((event, session) => {
      if (session) {
        localStorage.setItem('authToken', session.access_token);
        localStorage.setItem('userEmail', session.user.email || '');
        localStorage.setItem('userId', session.user.id);
        
        // If we are on the login page, move to home after session is established
        if (currentPage === 'login') {
          handleLoginSuccess();
        }
      } else if (event === 'SIGNED_OUT') {
        handleLogout();
      }
    });

    // Auto-sync calculated longevity score to Supabase when offline logs change
    const handleHealthUpdate = async () => {
      try {
        const currentScore = calculateLongevityScore();
        await syncDailyScoreToSupabase(currentScore);
      } catch (error) {
        console.error('Failed to auto-sync score to Supabase:', error);
      }
    };

    window.addEventListener('healthDataUpdated', handleHealthUpdate);

    return () => {
      window.removeEventListener('healthDataUpdated', handleHealthUpdate);
      subscription.unsubscribe();
    };
  }, []);

  const handleLoginSuccess = () => {
    setCurrentPage('home');
    // Trigger install prompt once after every successful login
    setShowPwaPrompt(false);
    setTimeout(() => setShowPwaPrompt(true), 50); // brief reset so prop re-fires
  };

  const handleLogout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('currentPage');
    localStorage.removeItem('userEmail');
    localStorage.removeItem('userId');
    localStorage.removeItem('profileData');
    setCurrentPage('login');
  };

  const handleNavigate = (page: PageType) => {
    localStorage.setItem('currentPage', page);
    setCurrentPage(page);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />
      case 'home':
        return <Home onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} onLogout={handleLogout} />
      case 'fasting':
        return <Fasting onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'dashboard':
        return <Dashboard onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'team':
        return <Team onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'profile':
        return <Profile onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} onLogout={handleLogout} />
      case 'edit-profile':
        return <EditProfile onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'activity':
        return <Activity onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'sleep':
        return <Sleep onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'privacy-settings':
        return <PrivacySettings onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'set-goals':
        return <SetGoals onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'about-tracker':
        return <AboutTracker onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'user-management':
        return (
          <div style={{ minHeight: '100vh', background: '#f5f5f5' }}>
            <UserManagement onNavigate={handleNavigate} />
          </div>
        )
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />
    }
  }

  return (
    <LanguageProvider>
      <div className="app-container">
        {renderPage()}
        {showFoodRecognition && (
          <FoodRecognitionErrorBoundary onClose={() => setShowFoodRecognition(false)}>
            <Suspense fallback={<FoodRecognitionFallback />}>
              <FoodRecognition onClose={() => setShowFoodRecognition(false)} />
            </Suspense>
          </FoodRecognitionErrorBoundary>
        )}
        <PWAInstallPrompt triggerOnLogin={showPwaPrompt} />
      </div>
    </LanguageProvider>
  )
}

export default App
