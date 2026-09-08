import React, { useState, useEffect, Suspense, lazy } from 'react'
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
import { Settings } from './pages/Settings'
import { calculateLongevityScore } from './utils/longevityScore'
import { syncDailyScoreToSupabase, supabase } from './services/supabaseClient'
import { pullDailyLogs, schedulePushDailyLogs } from './services/dailyLogsSync'
import { PWAInstallPrompt } from './components/PWAInstallPrompt'
import { useDailyReset } from './hooks/useDailyReset'

// FoodRecognition pulls in TensorFlow.js (~1 MB gzip). Load it only when the
// camera is actually opened, so it stays out of every page's critical path.
const FoodRecognition = lazy(() =>
  import('./components/FoodRecognition').then((m) => ({ default: m.FoodRecognition })),
)

// Chat widget is lazy too — it's a secondary surface, not needed for first paint.
const HealthChatWidget = lazy(() =>
  import('./components/chat/HealthChatWidget').then((m) => ({ default: m.HealthChatWidget })),
)

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

// A shared invite link looks like `/?add=swift-lotus-73`. Capture the handle into
// localStorage (the Team page's TeamInvite picks it up), then scrub it from the
// URL so it isn't re-processed or leaked into history/analytics.
function consumeAddParam(): boolean {
  try {
    const params = new URLSearchParams(window.location.search)
    const handle = params.get('add')
    if (!handle) return false
    localStorage.setItem('pendingTeamAdd', handle.trim().toLowerCase())
    window.history.replaceState({}, '', window.location.pathname)
    return true
  } catch {
    return false
  }
}

function App() {
  const [currentPage, setCurrentPage] = useState<PageType>('login')
  const [showFoodRecognition, setShowFoodRecognition] = useState(false)
  const [showPwaPrompt, setShowPwaPrompt] = useState(false)
  // FIX: Track auth loading state to prevent login flash bug
  const [isAuthLoading, setIsAuthLoading] = useState(true)

  // Clears yesterday's meals/activities/sleep logs on day rollover so they
  // don't keep bleeding into "today's" score. Previously written but never wired up.
  useDailyReset()

  useEffect(() => {
    // FIX: Validate session with Supabase instead of just checking localStorage token
    const initAuth = async () => {
      try {
        const hasPendingAdd = consumeAddParam()
        // Local dev session (bypasses Supabase). Gated on import.meta.env.DEV so
        // this branch is removed from production builds — a hand-crafted
        // localStorage 'dev-user' / 'dev-mock-token' entry cannot grant a
        // session on the live site.
        const isDevSession =
          import.meta.env.DEV &&
          (localStorage.getItem('userId') === 'dev-user' ||
            localStorage.getItem('authToken') === 'dev-mock-token');

        if (isDevSession) {
          const savedPage = localStorage.getItem('currentPage') as PageType;
          if (hasPendingAdd) {
            setCurrentPage('team');
          } else if (savedPage && savedPage !== 'login') {
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
            if (hasPendingAdd) {
              setCurrentPage('team')
            } else if (savedPage && savedPage !== 'login') {
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
            setCurrentPage(hasPendingAdd ? 'team' : (savedPage && savedPage !== 'login' ? savedPage : 'home'))
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

    // Auto-sync the score rollup + push the raw daily logs (debounced) whenever
    // the local logs change, so other devices on the same account catch up.
    const handleHealthUpdate = async () => {
      try {
        const currentScore = calculateLongevityScore()
        await syncDailyScoreToSupabase(currentScore)
      } catch (error) {
        console.error('Failed to auto-sync score to Supabase:', error)
      }
      schedulePushDailyLogs()
    }

    window.addEventListener('healthDataUpdated', handleHealthUpdate)

    // Pull raw logs from other devices once the session is confirmed.
    if (supabase) {
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) void pullDailyLogs()
      })
    }

    return () => {
      window.removeEventListener('healthDataUpdated', handleHealthUpdate)
      if (subscription) {
        subscription.unsubscribe()
      }
    }
  }, [])

  function handleLoginSuccess() {
    // Arrived via a `/?add=<handle>` invite link → land on Team so TeamInvite
    // can pick up the pending handle and open the add dialog.
    const landing: PageType = localStorage.getItem('pendingTeamAdd') ? 'team' : 'home'
    localStorage.setItem('currentPage', landing)
    setCurrentPage(landing)
    setShowPwaPrompt(false)
    setTimeout(() => setShowPwaPrompt(true), 50)
    void pullDailyLogs() // catch up on logs from this account's other devices
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
    <LanguageProvider>
      <div className="app-container">
        {renderPage()}
        {showFoodRecognition && (
          <FoodRecognitionErrorBoundary onClose={() => setShowFoodRecognition(false)}>
            <Suspense fallback={<div className="loading-overlay" />}>
              <FoodRecognition
                onClose={() => setShowFoodRecognition(false)}
                onSuccess={() => {
                  setShowFoodRecognition(false);
                  handleNavigate('eating');
                  window.dispatchEvent(new CustomEvent('eatingResetView'));
                }}
              />
            </Suspense>
          </FoodRecognitionErrorBoundary>
        )}
        <PWAInstallPrompt triggerOnLogin={showPwaPrompt} />
        <Suspense fallback={null}>
          <HealthChatWidget hidden={currentPage === 'login' || showFoodRecognition} />
        </Suspense>
      </div>
    </LanguageProvider>
  )
}

export default App
