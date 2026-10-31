import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startApp } from './appUpdate'

/** The admin page (/admin) is its own small app, downloaded only by whoever opens it. */
const isAdmin = /^\/admin(\/|$)/.test(location.pathname)
const AdminApp = lazy(() => import('./admin/AdminApp'))

// Installing as an app, and offering updates whenever a new version is pushed.
if (!isAdmin) startApp()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isAdmin ? (
      <Suspense fallback={null}>
        <AdminApp />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
)

// Lets the app open with no internet (see public/sw.js). Not in development, where files change all the time.
if (import.meta.env.PROD && !isAdmin && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(console.error))
}
