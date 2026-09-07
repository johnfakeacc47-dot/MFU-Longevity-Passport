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

const updateSW = registerSW({
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
