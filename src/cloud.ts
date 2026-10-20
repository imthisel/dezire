import { create } from 'zustand'
import { onAuthStateChanged, signInWithPopup, signInWithRedirect, signOut as fbSignOut, type User } from 'firebase/auth'
import { doc, getDoc, getDocFromCache, onSnapshot, serverTimestamp, setDoc, waitForPendingWrites, type DocumentReference, type DocumentSnapshot } from 'firebase/firestore'
import { auth, db, googleProvider } from './lib/firebase'
import { useStore } from './store'
import type { Expense } from './lib/types'
import { toast } from './toast'

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
  const { months, kinds, goals, goalAreas, sources, birthday, yearNotes, currency, expenses, expenseCats, places } = useStore.getState()
  return { months, kinds, goals, goalAreas, sources, birthday, yearNotes, currency, expenses: expenses.map(compact), expenseCats, places }
}

/** An expense without its empty fields, to keep the saved document small (they come back as '' when loaded). */
const compact = (e: Expense) => {
  const out: Partial<Expense> = { id: e.id, date: e.date, amount: e.amount, createdAt: e.createdAt }
  if (e.name) out.name = e.name
  if (e.category) out.category = e.category
  if (e.place) out.place = e.place
  if (e.notes) out.notes = e.notes
  return out
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

/** How long to wait for the server at start-up before opening with the copy saved on this device. */
const SERVER_WAIT = 4000

/**
 * The account's data: from the server when it answers quickly, otherwise the copy Firebase keeps on this device
 * (which already includes edits made offline). Live updates from the server follow either way.
 */
async function load(ref: DocumentReference): Promise<DocumentSnapshot> {
  const cached = () => getDocFromCache(ref)
  if (!navigator.onLine) return cached().catch(() => getDoc(ref))
  const server = getDoc(ref)
  const slow = new Promise<null>((resolve) => setTimeout(() => resolve(null), SERVER_WAIT))
  try {
    const snap = await Promise.race([server, slow])
    if (snap) return snap
  } catch {
    // Server unreachable: use this device's copy below.
  }
  try {
    return await cached()
  } catch {
    return server // Nothing on this device yet: the server is the only place it can come from.
  }
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
    const snap = await load(ref)
    if (useCloud.getState().user?.uid !== user.uid) return // signed out or switched while loading
    if (snap.exists()) apply(snap.data().data)
    // First sign-in: whatever was already in this browser becomes the account's starting data.
    else await setDoc(ref, { data: snapshot(), clientId, updatedAt: serverTimestamp() })
  } catch (e) {
    console.error(e)
    useCloud.setState({
      ready: true,
      loadError: navigator.onLine
        ? 'Could not load your data. Check your internet connection and try again.'
        : "You're offline, and your data isn't saved on this device yet. Connect to the internet once and Obseszion will work offline after that.",
    })
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
  // Edits made with no connection; once back online and uploaded, say so.
  let offlineEdits = false
  const unsubStore = useStore.subscribe((s, prev) => {
    if (applyingRemote) return
    if (s.months === prev.months && s.kinds === prev.kinds && s.goals === prev.goals && s.goalAreas === prev.goalAreas && s.sources === prev.sources && s.birthday === prev.birthday && s.yearNotes === prev.yearNotes && s.currency === prev.currency && s.expenses === prev.expenses && s.expenseCats === prev.expenseCats && s.places === prev.places) return
    pending = true
    if (!navigator.onLine) offlineEdits = true
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
  const onOnline = () => {
    useCloud.setState((s) => (s.status === 'offline' ? { status: 'saving' } : {}))
    void save()
    // Firebase uploads the edits it kept while offline by itself; wait for that to finish.
    waitForPendingWrites(db!)
      .then(() => {
        if (useCloud.getState().user?.uid !== user.uid) return
        if (!pending) useCloud.setState({ status: 'saved' })
        if (offlineEdits) toast.success('Back online · your offline changes are saved.')
        offlineEdits = false
      })
      .catch(() => {})
  }
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
