import { StrictMode, Suspense, lazy } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'
import { startApp } from './appUpdate'
import { startHistory } from './history'
import { isGoogleReturn } from './googleRedirect'
import { SigningIn } from './components/SigningIn'

/** The admin page (/admin) is its own small app, downloaded only by whoever opens it. */
const isAdmin = /^\/admin(\/|$)/.test(location.pathname)
const AdminApp = lazy(() => import('./admin/AdminApp'))
/** /auth: Google coming back from a phone's sign-in (see googleRedirect.ts); only that is done here. */
const isSignInReturn = isGoogleReturn()

// Installing as an app, and offering updates whenever a new version is pushed.
if (!isAdmin && !isSignInReturn) startApp()

// Ctrl+Z / Ctrl+Shift+Z for any change to your plan.
if (!isAdmin && !isSignInReturn) startHistory()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isSignInReturn ? (
      <SigningIn />
    ) : isAdmin ? (
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
