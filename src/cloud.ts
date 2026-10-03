import { create } from 'zustand'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc, onSnapshot, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db, googleProvider } from './lib/firebase'
import { useStore } from './store'

export type SaveStatus = 'saved' | 'saving' | 'offline' | 'error'

interface CloudState {
  user: User | null
  /** false until we know who is signed in and their data has been loaded */
  ready: boolean
  status: SaveStatus
  loadError: string | null
}

export const useCloud = create<CloudState>(() => ({ user: null, ready: false, status: 'saved', loadError: null }))

/** Identifies this browser tab, so it can ignore its own saves when they come back from the server. */
const clientId = Math.random().toString(36).slice(2)
const SAVE_DELAY = 800

/** The part of the app's state that belongs to the account. */
const snapshot = () => {
  const { months, goals, areaLabels, usdRate } = useStore.getState()
  return { months, goals, areaLabels, usdRate }
}

let stopSync: (() => Promise<void>) | null = null
let started = false

export function startCloud() {
  if (!auth || !db || started) return
  started = true
  onAuthStateChanged(auth, (user) => {
    void stopSync?.()
    stopSync = null
    if (!user) return useCloud.setState({ user: null, ready: true, loadError: null })
    useCloud.setState({ user, ready: false, loadError: null })
    void connect(user)
  })
}

async function connect(user: User) {
  const ref = doc(db!, 'users', user.uid)
  let applyingRemote = false

  const apply = (data: unknown) => {
    applyingRemote = true
    try {
      useStore.getState().importData(data)
    } finally {
      applyingRemote = false
    }
  }

  try {
    const snap = await getDoc(ref)
    if (useCloud.getState().user?.uid !== user.uid) return // signed out or switched while loading
    if (snap.exists()) apply(snap.data().data)
    // First sign-in: whatever was already in this browser becomes the account's starting data.
    else await setDoc(ref, { data: snapshot(), clientId, updatedAt: serverTimestamp() })
  } catch (e) {
    console.error(e)
    useCloud.setState({ ready: true, loadError: 'Could not load your data. Check your internet connection and try again.' })
    return
  }

  // Autosave: write a moment after the last change.
  let timer: ReturnType<typeof setTimeout> | undefined
  let pending = false
  const save = async () => {
    clearTimeout(timer)
    if (!pending) return
    pending = false
    useCloud.setState({ status: navigator.onLine ? 'saving' : 'offline' })
    try {
      await setDoc(ref, { data: snapshot(), clientId, updatedAt: serverTimestamp() })
      if (!pending) useCloud.setState({ status: 'saved' })
    } catch (e) {
      console.error(e)
      useCloud.setState({ status: 'error' })
    }
  }
  const unsubStore = useStore.subscribe((s, prev) => {
    if (applyingRemote) return
    if (s.months === prev.months && s.goals === prev.goals && s.areaLabels === prev.areaLabels && s.usdRate === prev.usdRate) return
    pending = true
    useCloud.setState({ status: navigator.onLine ? 'saving' : 'offline' })
    clearTimeout(timer)
    timer = setTimeout(save, SAVE_DELAY)
  })

  // Live updates from the same account on other devices / tabs.
  const unsubRemote = onSnapshot(ref, (snap) => {
    if (snap.metadata.hasPendingWrites || !snap.exists()) return
    const d = snap.data()
    if (d.clientId !== clientId && !pending) apply(d.data)
  })

  // Don't lose the last edit when the tab is closed or hidden.
  const flush = () => document.visibilityState === 'hidden' && void save()
  const onOnline = () => useCloud.setState((s) => (s.status === 'offline' ? { status: pending ? 'saving' : 'saved' } : {}))
  const onOffline = () => useCloud.setState({ status: 'offline' })
  document.addEventListener('visibilitychange', flush)
  window.addEventListener('online', onOnline)
  window.addEventListener('offline', onOffline)

  stopSync = async () => {
    unsubStore()
    unsubRemote()
    document.removeEventListener('visibilitychange', flush)
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
    await save()
  }
  useCloud.setState({ ready: true, status: navigator.onLine ? 'saved' : 'offline' })
}

export async function signIn() {
  if (!auth) return
  try {
    await signInWithPopup(auth, googleProvider)
  } catch (e) {
    const code = (e as { code?: string }).code
    if (code === 'auth/popup-blocked') return signInWithRedirect(auth, googleProvider)
    if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
    throw e
  }
}

/** Signs out and clears this browser, so the next person to sign in here never sees this account's data. */
export async function signOut() {
  if (!auth) return
  await stopSync?.()
  stopSync = null
  await fbSignOut(auth)
  useStore.getState().resetAll()
}

export function retryLoad() {
  const user = useCloud.getState().user
  if (!user) return
  useCloud.setState({ ready: false, loadError: null })
  void connect(user)
}
