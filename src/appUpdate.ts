import { create } from 'zustand'
import { toast } from './toast'

/**
 * Installing Dizayr as an app, and keeping it up to date.
 *
 * - Every deploy has a version (the commit it was built from), written into the app and into /version.json.
 *   The app compares the two when it opens, when it comes back to the screen, and every 15 minutes. When the site has a
 *   newer version than the one running (e.g. the app was left open, or opened offline), it offers "Update now".
 * - After an update, a short "Dizayr was updated" note confirms it.
 * - Install: browsers that can install (Chrome, Edge, Android…) hand over an install prompt, kept here for the
 *   Download buttons; elsewhere (iPhone, Safari, Firefox) the buttons show the steps instead.
 * Saved data is untouched by all of this: it lives in the account and in this browser's storage, as before.
 */

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

export type Platform = 'ios' | 'android' | 'desktop'

interface AppState {
  /** The version running now */
  version: string
  builtAt: string
  /** A newer version is on the site */
  update: { version: string; builtAt: string } | null
  /** Hidden for now ("Later"); shown again on the next check that finds an update */
  snoozed: boolean
  checking: boolean
  /** Running as an installed app (its own window / home screen icon) */
  installed: boolean
  /** The browser offered to install (one tap) */
  canInstall: boolean
  /** The "how to install" window is open */
  guideOpen: boolean
}

export const useApp = create<AppState>(() => ({
  version: __APP_VERSION__,
  builtAt: __APP_BUILT__,
  update: null,
  snoozed: false,
  checking: false,
  installed: false,
  canInstall: false,
  guideOpen: false,
}))

let installPrompt: InstallPrompt | null = null
const SEEN = 'dizayr-app-version'
const EVERY = 15 * 60_000

export const platform = (): Platform => {
  const ua = navigator.userAgent
  if (/iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'ios'
  if (/Android/.test(ua)) return 'android'
  return 'desktop'
}

const standalone = () =>
  matchMedia('(display-mode: standalone)').matches ||
  matchMedia('(display-mode: window-controls-overlay)').matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true

/** Starts watching for installs and updates. Call once at start-up. */
export function startApp() {
  useApp.setState({ installed: standalone() })
  matchMedia('(display-mode: standalone)').addEventListener?.('change', () => useApp.setState({ installed: standalone() }))

  window.addEventListener('beforeinstallprompt', (e) => {
    // Keep the browser's offer for the Download buttons instead of its own banner.
    e.preventDefault()
    installPrompt = e as InstallPrompt
    useApp.setState({ canInstall: true })
  })
  window.addEventListener('appinstalled', () => {
    installPrompt = null
    useApp.setState({ canInstall: false, installed: true, guideOpen: false })
    toast.success('Dizayr is installed. Open it from your home screen or apps.')
  })

  if (__APP_VERSION__ === 'dev') return

  // Just updated: say so (not on the very first visit).
  try {
    const seen = localStorage.getItem(SEEN)
    if (seen && seen !== __APP_VERSION__) setTimeout(() => toast.success('Dizayr was updated to the latest version.'), 1200)
    localStorage.setItem(SEEN, __APP_VERSION__)
  } catch {
    // Not remembered; fine.
  }

  void checkForUpdate()
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void checkForUpdate())
  window.addEventListener('online', () => void checkForUpdate())
  setInterval(() => document.visibilityState === 'visible' && void checkForUpdate(), EVERY)
}

/** Asks the site which version is newest. `manual`: from the Check for updates button, so it always answers. */
export async function checkForUpdate(manual = false) {
  if (__APP_VERSION__ === 'dev') {
    if (manual) toast.info('Updates are checked on the live site, not while developing.')
    return
  }
  if (!navigator.onLine) {
    if (manual) toast.info('You’re offline. Dizayr will check for updates when you’re back online.')
    return
  }
  useApp.setState({ checking: true })
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok) throw new Error(String(res.status))
    const latest = (await res.json()) as { version: string; builtAt: string }
    const newer = latest.version && latest.version !== __APP_VERSION__
    useApp.setState({ update: newer ? latest : null, snoozed: newer && !manual ? useApp.getState().snoozed : false })
    if (manual && !newer) toast.success('You’re on the latest version.')
  } catch {
    if (manual) toast.error('Couldn’t check for updates. Try again in a moment.')
  } finally {
    useApp.setState({ checking: false })
  }
}

/** Opens the newest version: saves it for offline first (so even a slow connection opens it), then reloads. */
export async function applyUpdate() {
  const sw = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
  const worker = sw?.active
  if (worker) {
    await new Promise<void>((resolve) => {
      const ch = new MessageChannel()
      ch.port1.onmessage = () => resolve()
      worker.postMessage({ type: 'update' }, [ch.port2])
      setTimeout(resolve, 6000)
    })
    await sw.update().catch(() => {})
  }
  location.reload()
}

export const snoozeUpdate = () => useApp.setState({ snoozed: true })

/** Download / Install: the browser's own install window when it offers one, otherwise the steps for this device. */
export async function installApp() {
  if (installPrompt) {
    const p = installPrompt
    installPrompt = null
    useApp.setState({ canInstall: false })
    await p.prompt()
    const { outcome } = await p.userChoice
    if (outcome === 'dismissed') {
      // It can only be used once; the browser offers a new one later.
      toast.info('No problem. You can install Dizayr any time from here.')
    }
    return
  }
  useApp.setState({ guideOpen: true })
}

export const closeGuide = () => useApp.setState({ guideOpen: false })
