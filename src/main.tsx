import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import '@mantine/core/styles.css'
import { MantineProvider } from '@mantine/core'
import './index.css'
import App from './App.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { ThemeProvider, useTheme } from './contexts/ThemeContext'

// Register Service Worker for PWA
import { registerSW } from 'virtual:pwa-register'

// A browser normally re-checks a service worker for updates on navigation —
// but a PWA launched from an iPhone home-screen icon isn't a fresh
// navigation the way reopening a browser tab is, and iOS's own automatic
// check is notoriously unreliable for standalone-mode PWAs. Without an
// explicit poll, an update can sit on the server indefinitely with no
// client ever noticing — which is exactly why "reinstall to get updates"
// was the only thing that worked. This is vite-plugin-pwa's own documented
// fix: periodically re-fetch the SW script (bypassing HTTP cache) and ask
// the registration to check itself against it.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000 // 1 hour

const updateSW = registerSW({
  onRegisteredSW(swScriptUrl, registration) {
    if (!registration) return

    const checkForUpdate = async () => {
      if (registration.installing || !navigator.onLine) return
      try {
        const resp = await fetch(swScriptUrl, {
          cache: 'no-store',
          headers: { 'cache': 'no-store', 'cache-control': 'no-cache' },
        })
        if (resp.status === 200) await registration.update()
      } catch {
        /* offline or a blip — next check tries again */
      }
    }

    // Most sessions here are short (log a meal, close) — a purely hourly
    // interval could go a long time without ever firing. Check once right
    // away on every open, then keep polling for whoever leaves it open.
    void checkForUpdate()
    setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS)
  },
  onNeedRefresh() {
    if (confirm('New content available. Reload?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('App ready to work offline')
  },
})

function ThemedProviders() {
  const { resolvedTheme } = useTheme()

  return (
    <MantineProvider forceColorScheme={resolvedTheme}>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
      <Analytics />
    </MantineProvider>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <ThemedProviders />
    </ThemeProvider>
  </StrictMode>,
)
