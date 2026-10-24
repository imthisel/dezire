import { initializeApp } from 'firebase/app'
import { browserLocalPersistence, browserPopupRedirectResolver, GoogleAuthProvider, indexedDBLocalPersistence, initializeAuth } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore'

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname)

/** Values come from .env.local (locally) or the hosting provider's environment variables. */
const config = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  // When deployed, sign-in runs through this site's own /__/auth (proxied to Firebase in vercel.json).
  // Mobile browsers partition storage per site, so a sign-in on firebaseapp.com loses its state
  // ("missing initial state") when it comes back here.
  authDomain: isLocal ? import.meta.env.VITE_FIREBASE_AUTH_DOMAIN : location.host,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const firebaseConfigured = Object.values(config).every(Boolean)

const app = firebaseConfigured ? initializeApp(config) : null

/**
 * Stays signed in on this device until you sign out: the sign-in is kept in the browser's lasting storage
 * (IndexedDB, or localStorage where that isn't available), never only for the open tab.
 */
export const auth = app
  ? initializeAuth(app, { persistence: [indexedDBLocalPersistence, browserLocalPersistence], popupRedirectResolver: browserPopupRedirectResolver })
  : null
export const googleProvider = new GoogleAuthProvider()
googleProvider.setCustomParameters({ prompt: 'select_account' })

/** Firestore with an offline cache, so edits made without internet are kept and uploaded later. */
export const db = app
  ? initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  : null
