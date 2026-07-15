import React, { useState, useEffect } from 'react'
import './App.css'
import { Login } from './pages/Login'
import { Home } from './pages/Home'
import { Eating } from './pages/Eating'
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
import { MentalHealth } from './pages/MentalHealth'
import { LanguageProvider } from './contexts/LanguageContext'
import { ThemeProvider } from './contexts/ThemeContext'
import { Settings } from './pages/Settings'
import { calculateLongevityScore } from './utils/longevityScore'
import { syncDailyScoreToSupabase, supabase } from './services/supabaseClient'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { FoodRecognition } from './components/FoodRecognition'

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

type PageType = 'login' | 'home' | 'eating' | 'eating-food-log' | 'eating-macros' | 'eating-water' | 'eating-schedule' | 'eating-history' | 'dashboard' | 'team' | 'profile' | 'edit-profile' | 'activity' | 'sleep' | 'mental-health' | 'user-management' | 'privacy-settings' | 'set-goals' | 'about-tracker' | 'settings'

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('login')
  const [showFoodRecognition, setShowFoodRecognition] = useState(false)
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  // FIX: Track auth loading state to prevent login flash bug
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  useEffect(() => {
    // FIX: Validate session with Supabase instead of just checking localStorage token
    const initAuth = async () => {
      try {
        // Check local dev session first (Bypass Supabase for Dev Mode)
        const isDevSession =
          localStorage.getItem('userId') === 'dev-user' ||
          localStorage.getItem('authToken') === 'dev-mock-token';

        if (isDevSession) {
          const savedPage = localStorage.getItem('currentPage') as PageType;
          if (savedPage && savedPage !== 'login') {
            setCurrentPage(savedPage);
          } else {
            setCurrentPage('home');
          }
          setIsAuthLoading(false);
          return;
        }

        if (supabase) {
          const { data: { session } } = await supabase.auth.getSession()
          if (session) {
            // Valid live session found — restore saved page
            const savedPage = localStorage.getItem('currentPage') as PageType
            if (savedPage && savedPage !== 'login') {
              setCurrentPage(savedPage)
            } else {
              setCurrentPage('home')
            }
          } else {
            // No valid session — ensure we're on login, clear stale tokens
            localStorage.removeItem('authToken')
            localStorage.removeItem('currentPage')
            setCurrentPage('login')
          }
        } else {
          // Supabase not configured — use legacy localStorage token
          const token = localStorage.getItem('authToken')
          const savedPage = localStorage.getItem('currentPage') as PageType
          if (token) {
            setCurrentPage(savedPage && savedPage !== 'login' ? savedPage : 'home')
          } else {
            setCurrentPage('login')
          }
        }
      } catch (err) {
        console.error('Auth init error:', err)
        setCurrentPage('login')
      } finally {
        setIsAuthLoading(false)
      }
    }

    initAuth()

    // Listen for auth state changes (crucial for OAuth redirects)
    let subscription: any = null
    if (supabase) {
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        if (session) {
          localStorage.setItem('authToken', session.access_token)
          localStorage.setItem('userEmail', session.user.email || '')
          localStorage.setItem('userId', session.user.id)
          // Only redirect on new sign-in events, not on session restore
          if (event === 'SIGNED_IN') {
            handleLoginSuccess()
          }
        } else if (event === 'SIGNED_OUT') {
          handleLogout()
        }
      })
      subscription = data.subscription
    }

    // Auto-sync calculated longevity score to Supabase when offline logs change
    const handleHealthUpdate = async () => {
      try {
        const currentScore = calculateLongevityScore()
        await syncDailyScoreToSupabase(currentScore)
      } catch (error) {
        console.error('Failed to auto-sync score to Supabase:', error)
      }
    }

    window.addEventListener('healthDataUpdated', handleHealthUpdate)

    return () => {
      window.removeEventListener('healthDataUpdated', handleHealthUpdate)
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  function handleLoginSuccess() {
    setCurrentPage('home')
    setShowPwaPrompt(false)
    setTimeout(() => setShowPwaPrompt(true), 50)
  }

  function handleLogout() {
    localStorage.removeItem('authToken')
    localStorage.removeItem('currentPage')
    localStorage.removeItem('userEmail')
    localStorage.removeItem('userId')
    localStorage.removeItem('profileData')
    setCurrentPage('login')
  }

  function handleNavigate(page: PageType) {
    // "บันทึกอาหาร" card → open AI Food Recognition overlay directly
    if (page === 'eating-food-log') {
      localStorage.setItem('currentPage', 'eating')
      setCurrentPage('eating')
      setShowFoodRecognition(true)
      return
    }
    localStorage.setItem('currentPage', page)
    setCurrentPage(page)
  }

  // Show a centered spinner while validating session
  if (isAuthLoading) {
    return (
      <div className="auth-loading-screen">
        <div className="auth-loading-logo">
          <div className="auth-loading-ring" />
          <span className="auth-loading-text">MFU</span>
        </div>
        <p className="auth-loading-sub">Longevity Passport</p>
      </div>
    )
  }

  const renderPage = () => {
    switch (currentPage) {
      case 'login':
        return <Login onLoginSuccess={handleLoginSuccess} />
      case 'home':
        return <Home onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} onLogout={handleLogout} />
      case 'eating':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="dashboard" />
      case 'eating-food-log':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="food-log" />
      case 'eating-macros':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="macros" />
      case 'eating-water':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="water" />
      case 'eating-schedule':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="schedule" />
      case 'eating-history':
        return <Eating onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} view="history" />
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
      case 'mental-health':
        return <MentalHealth onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'privacy-settings':
        return <PrivacySettings onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'set-goals':
        return <SetGoals onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'about-tracker':
        return <AboutTracker onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      case 'user-management':
        return (
          <div style={{ minHeight: '100vh' }}>
            <UserManagement onNavigate={handleNavigate} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
          </div>
        )
      case 'settings':
        return <Settings onNavigate={handleNavigate} currentPage={currentPage} onOpenFoodRecognition={() => setShowFoodRecognition(true)} />
      default:
        return <Login onLoginSuccess={handleLoginSuccess} />
    }
  }

  return (
    <ThemeProvider>
      <LanguageProvider>
        <div className="app-container">
          {renderPage()}
          {showFoodRecognition && (
            <FoodRecognitionErrorBoundary onClose={() => setShowFoodRecognition(false)}>
              <FoodRecognition 
                onClose={() => setShowFoodRecognition(false)} 
                onSuccess={() => {
                  setShowFoodRecognition(false);
                  handleNavigate('eating');
                  window.dispatchEvent(new CustomEvent('eatingResetView'));
                }}
              />
            </FoodRecognitionErrorBoundary>
          )}
          <PWAInstallPrompt triggerOnLogin={showPwaPrompt} />
        </div>
      </LanguageProvider>
    </ThemeProvider>
  )
}

export default App
