import { create } from 'zustand'
import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { db } from './lib/firebase'
import { PLANS, TRIAL_DAYS, type PlanId } from './lib/plans'
import { toast } from './toast'

/**
 * Who may use the app. Each account has a document `subscriptions/{uid}`:
 * - `trialStartedAt`: written once by the app on the first sign-in (the Firestore rules only allow it to be "now",
 *   and never changed afterwards), so the free trial can't be restarted.
 * - `accessUntil`, `plan`, `status`…: written only by the payment webhook (api/lemonsqueezy.ts) when someone pays.
 * - `lifetime: true`: set by hand in the Firebase console (e.g. for the owner).
 * The Firestore rules check the same thing before letting anyone read or save their data.
 */
export type AccessState = 'checking' | 'trial' | 'paid' | 'lifetime' | 'ended'

type SubDoc = {
  trialStartedAt?: Timestamp
  accessUntil?: Timestamp | null
  lifetime?: boolean
  plan?: PlanId | null
  status?: string
  renewsAt?: Timestamp | null
  endsAt?: Timestamp | null
}

interface AccessStore {
  state: AccessState
  /** When the free trial ends (ms), once known */
  trialEndsAt: number | null
  /** Paid until (ms) */
  paidUntil: number | null
  plan: PlanId | null
  /** Lemon Squeezy status: active, cancelled, past_due… */
  status: string | null
  /** A payment just went through; waiting for it to be confirmed */
  activating: boolean
  /** The plans window is open (from the trial banner or the account menu) */
  plansOpen: boolean
}

export const useAccess = create<AccessStore>(() => ({
  state: 'checking',
  trialEndsAt: null,
  paidUntil: null,
  plan: null,
  status: null,
  activating: false,
  plansOpen: false,
}))

export const openPlans = (open = true) => useAccess.setState({ plansOpen: open })

const DAY = 86_400_000
let stop: (() => void) | null = null
let timer: ReturnType<typeof setTimeout> | undefined

/** Follows the account's access, calling `onChange(true/false)` whenever being allowed in changes. */
export function watchAccess(user: User, onChange: (allowed: boolean) => void) {
  stopAccess()
  const ref = doc(db!, 'subscriptions', user.uid)
  let creating = false
  let allowed: boolean | null = null
  const report = (next: boolean) => {
    if (next !== allowed) {
      allowed = next
      onChange(next)
    }
  }

  const unsub = onSnapshot(
    ref,
    { includeMetadataChanges: true },
    (snap) => {
      // The trial being started: wait until the server has it (the rules check it before the data can be read).
      if (snap.metadata.hasPendingWrites) return
      if (!snap.exists()) {
        // Not known yet (only this device's copy so far): offline, let them use what's on the device; online, wait for the server.
        if (snap.metadata.fromCache) {
          if (!navigator.onLine) {
            useAccess.setState({ state: 'trial' })
            report(true)
          }
          return
        }
        // First time here: start the free trial.
        if (!creating) {
          creating = true
          setDoc(ref, { trialStartedAt: serverTimestamp() }).catch((e) => {
            console.error(e)
            toast.error('Could not start your free trial. Check your connection and reload.')
          })
        }
        return
      }
      const d = snap.data() as SubDoc
      const now = Date.now()
      const trialEndsAt = d.trialStartedAt ? d.trialStartedAt.toMillis() + TRIAL_DAYS * DAY : null
      const paidUntil = d.accessUntil ? d.accessUntil.toMillis() : null
      const state: AccessState = d.lifetime
        ? 'lifetime'
        : paidUntil && paidUntil > now
          ? 'paid'
          : trialEndsAt && trialEndsAt > now
            ? 'trial'
            : 'ended'
      const was = useAccess.getState()
      if (was.activating && state === 'paid') toast.success("You're all set. Thank you for joining Dizayr!")
      useAccess.setState({
        state,
        trialEndsAt,
        paidUntil,
        plan: d.plan ?? null,
        status: d.status ?? null,
        activating: was.activating && state !== 'paid',
      })
      report(state !== 'ended')

      // Look again the moment the trial or the paid time runs out.
      clearTimeout(timer)
      const next = [paidUntil, trialEndsAt].filter((t): t is number => !!t && t > now).sort((a, b) => a - b)[0]
      if (next) timer = setTimeout(() => {
        const s = useAccess.getState()
        const t = Date.now()
        const left = (s.paidUntil ?? 0) > t ? 'paid' : (s.trialEndsAt ?? 0) > t ? 'trial' : s.state === 'lifetime' ? 'lifetime' : 'ended'
        useAccess.setState({ state: left })
        report(left !== 'ended')
      }, Math.min(next - now + 1000, 2 ** 31 - 1))

      // Chose a plan before signing in: go straight to paying for it.
      const intent = takeIntent()
      if (intent && state !== 'paid' && state !== 'lifetime') void openCheckout(intent, user)
    },
    (e) => {
      console.error(e)
      // Can't tell (e.g. rules not published yet): don't lock anyone out because of it.
      useAccess.setState({ state: 'trial' })
      report(true)
    },
  )
  stop = () => {
    unsub()
    clearTimeout(timer)
  }
}

export function stopAccess() {
  stop?.()
  stop = null
  useAccess.setState({ state: 'checking', trialEndsAt: null, paidUntil: null, plan: null, status: null, activating: false, plansOpen: false })
}

/** Days left in the free trial (rounded up), or null when not on the trial. */
export function trialDaysLeft() {
  const { state, trialEndsAt } = useAccess.getState()
  return state === 'trial' && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / DAY)) : null
}

// ---- Choosing a plan before signing in ----

const INTENT = 'dizayr-plan-intent'
export function rememberIntent(plan: PlanId) {
  try {
    sessionStorage.setItem(INTENT, plan)
  } catch {
    // Not remembered: they can pick it again after signing in.
  }
}
/** Forgets a plan picked before signing in (e.g. the Google window was closed), so checkout doesn't pop up later. */
export function forgetIntent() {
  try {
    sessionStorage.removeItem(INTENT)
  } catch {
    // Nothing remembered.
  }
}
function takeIntent(): PlanId | null {
  try {
    const p = sessionStorage.getItem(INTENT)
    sessionStorage.removeItem(INTENT)
    return p === 'annual' || p === 'semiannual' ? p : null
  } catch {
    return null
  }
}

// ---- Checkout (Lemon Squeezy) ----

type Lemon = {
  Setup: (o: { eventHandler: (e: { event: string; data?: unknown }) => void }) => void
  Url: { Open: (url: string) => void; Close: () => void }
}
declare global {
  interface Window {
    LemonSqueezy?: Lemon
    createLemonSqueezy?: () => void
  }
}

let lemon: Promise<Lemon | null> | null = null
/** Loads Lemon Squeezy's checkout window script the first time it's needed. */
function loadLemon(): Promise<Lemon | null> {
  lemon ??= new Promise((resolve) => {
    const done = () => {
      window.createLemonSqueezy?.()
      const ls = window.LemonSqueezy
      if (!ls) return resolve(null)
      ls.Setup({
        eventHandler: (e) => {
          if (e.event === 'Checkout.Success') {
            useAccess.setState({ activating: true })
            toast.success('Payment received! Activating your plan…')
          }
        },
      })
      resolve(ls)
    }
    const s = document.createElement('script')
    s.src = 'https://app.lemonsqueezy.com/js/lemon.js'
    s.defer = true
    s.onload = done
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
    setTimeout(() => resolve(window.LemonSqueezy ?? null), 8000)
  })
  return lemon
}

/** Opens checkout for `plan`, filled in with the account's email and linked to it so the payment unlocks it. */
export async function openCheckout(plan: PlanId, user: User) {
  const base = PLANS[plan].checkoutUrl
  if (!base) return toast.error('Payments aren’t set up yet. Please try again soon.')
  const url = new URL(base)
  if (user.email) url.searchParams.set('checkout[email]', user.email)
  if (user.displayName) url.searchParams.set('checkout[name]', user.displayName)
  url.searchParams.set('checkout[custom][user_id]', user.uid)
  const ls = await loadLemon()
  // The checkout window over the page; if it can't load, the full checkout page instead.
  if (ls) ls.Url.Open(url.toString())
  else window.location.href = url.toString()
}
