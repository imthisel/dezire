import { create } from 'zustand'
import { doc, onSnapshot, serverTimestamp, setDoc, type Timestamp } from 'firebase/firestore'
import type { User } from 'firebase/auth'
import { auth, db } from './lib/firebase'
import { PLANS, TRIAL_DAYS, paymentsReady, type PlanId } from './lib/plans'
import { toast } from './toast'

/**
 * Who may use the app. Each account has a document `subscriptions/{uid}`:
 * - `trialStartedAt`: written once by the app on the first sign-in (the Firestore rules only allow it to be "now",
 *   and never changed afterwards), so the free trial can't be restarted.
 * - `accessUntil`, `plan`, `status`…: written only by the payment webhook (api/paddle.ts) for the Yearly subscription.
 * - `lifetime: true`: written by the webhook when Lifetime is bought (with `lifetimeTransactionId`), or set from the
 *   admin page or by hand in the Firebase console (e.g. for the owner).
 * - `compUntil`: free membership until then, given from the admin page (api/admin.ts).
 * The Firestore rules check the same thing before letting anyone read or save their data.
 */
/** `comp`: a free membership given from the admin page, until `compUntil`. */
export type AccessState = 'checking' | 'trial' | 'paid' | 'comp' | 'lifetime' | 'ended'

type SubDoc = {
  trialStartedAt?: Timestamp
  accessUntil?: Timestamp | null
  lifetime?: boolean
  compUntil?: Timestamp | null
  /** The subscription's plan (only Yearly is a subscription) */
  plan?: 'annual' | null
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
  /** Free membership until (ms) */
  compUntil: number | null
  plan: 'annual' | null
  /** Subscription status (see api/_lib/subscription.ts): active, cancelled, past_due… */
  status: string | null
  /** A payment just went through; waiting for it to be confirmed */
  activating: boolean
  /** The plans window is open (from the trial banner or the account menu) */
  plansOpen: boolean
  /** A new account with no free trial, because this device's was already used (see trialEndedHere) */
  trialUsedHere: boolean
}

export const useAccess = create<AccessStore>(() => ({
  state: 'checking',
  trialEndsAt: null,
  paidUntil: null,
  compUntil: null,
  plan: null,
  status: null,
  activating: false,
  plansOpen: false,
  trialUsedHere: false,
}))

export const openPlans = (open = true) => useAccess.setState({ plansOpen: open })

const DAY = 86_400_000

// ---- The free trial on this device ----

const TRIAL_ENDED = 'dizayr-trial-ended'
/**
 * Whether a free trial has already run out on this device (this browser), whichever account it was. The About page
 * sends "Try it free" to the plans instead, and a new account signed in here doesn't get another trial.
 * Kept in localStorage: a light guard for honest use, not a lock (the server's record per account is the real one).
 */
export function trialEndedHere() {
  try {
    return localStorage.getItem(TRIAL_ENDED) === '1'
  } catch {
    return false
  }
}
function markTrialEndedHere() {
  try {
    localStorage.setItem(TRIAL_ENDED, '1')
  } catch {
    // Not remembered: the account's own record still stops the trial restarting.
  }
}

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
        // First time here, on a device whose free trial has already run out: no second trial, straight to the plans.
        // (A plan bought later creates the record, and they're let in.)
        if (!creating && trialEndedHere()) {
          useAccess.setState({ state: 'ended', trialEndsAt: null, trialUsedHere: true })
          report(false)
          const intent = takeIntent()
          if (intent) void openCheckout(intent, user)
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
      const compUntil = d.compUntil ? d.compUntil.toMillis() : null
      const state: AccessState = d.lifetime
        ? 'lifetime'
        : compUntil && compUntil > now
          ? 'comp'
          : paidUntil && paidUntil > now
          ? 'paid'
          : trialEndsAt && trialEndsAt > now
            ? 'trial'
            : 'ended'
      const was = useAccess.getState()
      const unlocked = state === 'paid' || state === 'lifetime'
      if (was.activating && unlocked)
        toast.success(state === 'lifetime' ? 'Lifetime unlocked. Dizayr is yours for good. Thank you!' : "You're all set. Thank you for joining Dizayr!")
      useAccess.setState({
        state,
        trialEndsAt,
        paidUntil,
        compUntil,
        plan: d.plan ?? null,
        status: d.status ?? null,
        activating: was.activating && !unlocked,
        trialUsedHere: false,
      })
      report(state !== 'ended')
      // The trial ran out on this account: this device remembers it (see trialEndedHere).
      if (state === 'ended' && trialEndsAt) markTrialEndedHere()

      // Look again the moment the trial or the paid time runs out.
      clearTimeout(timer)
      const next = [compUntil, paidUntil, trialEndsAt].filter((t): t is number => !!t && t > now).sort((a, b) => a - b)[0]
      if (next) timer = setTimeout(() => {
        const s = useAccess.getState()
        const t = Date.now()
        const left =
          s.state === 'lifetime' ? 'lifetime' : (s.compUntil ?? 0) > t ? 'comp' : (s.paidUntil ?? 0) > t ? 'paid' : (s.trialEndsAt ?? 0) > t ? 'trial' : 'ended'
        useAccess.setState({ state: left })
        report(left !== 'ended')
        if (left === 'ended' && s.trialEndsAt) markTrialEndedHere()
      }, Math.min(next - now + 1000, 2 ** 31 - 1))

      // Chose a plan before signing in: go straight to paying for it.
      const intent = takeIntent()
      // (Lifetime can still be bought on Yearly; nothing more can be bought once on Lifetime or a free membership.)
      if (intent && state !== 'comp' && state !== 'lifetime' && !(intent === 'annual' && state === 'paid')) void openCheckout(intent, user)
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
  useAccess.setState({ state: 'checking', trialEndsAt: null, paidUntil: null, compUntil: null, plan: null, status: null, activating: false, plansOpen: false, trialUsedHere: false })
}

/** Days left in the free trial (rounded up), or null when not on the trial. */
export function trialDaysLeft() {
  const { state, trialEndsAt } = useAccess.getState()
  return state === 'trial' && trialEndsAt ? Math.max(0, Math.ceil((trialEndsAt - Date.now()) / DAY)) : null
}

// ---- Choosing a plan before signing in ----

const INTENT = 'dizayr-plan-intent'
/**
 * Kept in localStorage (not sessionStorage), so it survives the trip to Google and back on phones, whichever tab Google
 * comes back in. Only for a while: a plan picked and then left isn't bought by surprise much later.
 */
const INTENT_FOR = 30 * 60_000
export function rememberIntent(plan: PlanId) {
  try {
    localStorage.setItem(INTENT, JSON.stringify({ plan, at: Date.now() }))
  } catch {
    // Not remembered: they can pick it again after signing in.
  }
}
/** Forgets a plan picked before signing in (e.g. the Google window was closed), so checkout doesn't pop up later. */
export function forgetIntent() {
  try {
    localStorage.removeItem(INTENT)
    sessionStorage.removeItem(INTENT) // kept there by older versions
  } catch {
    // Nothing remembered.
  }
}
function takeIntent(): PlanId | null {
  try {
    const raw = localStorage.getItem(INTENT)
    forgetIntent()
    const { plan, at } = JSON.parse(raw ?? 'null') ?? {}
    return (plan === 'annual' || plan === 'lifetime') && Date.now() - at < INTENT_FOR ? plan : null
  } catch {
    return null
  }
}

// ---- Checkout (Paddle) ----

type PaddleEvent = { name?: string; data?: unknown }
type PaddleJs = {
  Environment: { set: (env: 'sandbox') => void }
  Initialize: (o: { token: string; eventCallback?: (e: PaddleEvent) => void; checkout?: { settings?: Record<string, unknown> } }) => void
  Checkout: {
    open: (o: {
      items: { priceId: string; quantity: number }[]
      customer?: { email: string }
      customData?: Record<string, string>
      settings?: Record<string, unknown>
    }) => void
    close: () => void
  }
}
declare global {
  interface Window {
    Paddle?: PaddleJs
  }
}

let paddleJs: Promise<PaddleJs | null> | null = null
/** Loads Paddle.js (the checkout window) the first time it's needed. It can only be set up once per page. */
function loadPaddle(): Promise<PaddleJs | null> {
  paddleJs ??= new Promise<PaddleJs | null>((resolve) => {
    const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN as string | undefined
    if (!token) return resolve(null)
    const done = () => {
      const p = window.Paddle
      if (!p) return resolve(null)
      if (import.meta.env.VITE_PADDLE_ENV === 'sandbox') p.Environment.set('sandbox')
      p.Initialize({
        token,
        // One-page: everything on one screen, no "Continue" steps (easiest on a phone).
        checkout: { settings: { displayMode: 'overlay', variant: 'one-page', theme: 'dark', locale: 'en', allowLogout: false } },
        eventCallback: (e) => {
          if (e.name === 'checkout.completed') {
            useAccess.setState({ activating: true })
            toast.success('Payment received! Activating your plan…')
          }
        },
      })
      resolve(p)
    }
    const s = document.createElement('script')
    s.src = 'https://cdn.paddle.com/paddle/v2/paddle.js'
    s.async = true
    s.onload = done
    s.onerror = () => resolve(null)
    document.head.appendChild(s)
    setTimeout(() => resolve(null), 10_000)
  }).then((p) => {
    // Didn't load (offline, blocked): try again next time instead of giving up for good.
    if (!p) paddleJs = null
    return p
  })
  return paddleJs
}

/** Opens checkout for `plan`, filled in with the account's email and linked to it so the payment unlocks it. */
export async function openCheckout(plan: PlanId, user: User) {
  const priceId = PLANS[plan].priceId
  if (!priceId || !paymentsReady()) return toast.error('Payments aren’t set up yet. Please try again soon.')
  const paddle = await loadPaddle()
  if (!paddle) return toast.error('Couldn’t open the checkout. Check your connection (or turn off an ad blocker for this site) and try again.')
  paddle.Checkout.open({
    items: [{ priceId, quantity: 1 }],
    ...(user.email ? { customer: { email: user.email } } : {}),
    // Copied onto the subscription (Yearly) or the payment (Lifetime), so the webhook (api/paddle.ts) knows which account to unlock.
    customData: { user_id: user.uid },
  })
}

/** Calls api/billing.ts as the signed-in user. Throws an Error whose message is the server's error code. */
async function billingApi<T>(action: 'portal'): Promise<T> {
  const user = auth?.currentUser
  if (!user) throw new Error('signed_out')
  const res = await fetch('/api/billing', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  })
  const body = (await res.json().catch(() => ({}))) as T & { error?: string }
  if (!res.ok) throw new Error(body.error ?? 'server_error')
  return body
}

/**
 * Opens the Paddle customer portal (card, invoices, cancel) for the signed-in subscriber, already signed in.
 * The tab is opened right away, while the click still counts, so browsers don't block it as a pop-up; it's
 * pointed at the portal once the server has made the link.
 */
export async function openBilling() {
  const tab = window.open('', '_blank')
  if (tab) tab.opener = null
  try {
    const body = await billingApi<{ url?: string }>('portal')
    if (!body.url) throw new Error('server_error')
    if (tab) tab.location.href = body.url
    else window.location.href = body.url
  } catch (e) {
    tab?.close()
    const code = e instanceof Error ? e.message : ''
    toast.error(
      code === 'no_customer'
        ? 'There’s no payment on this account yet. If you paid with a different email, contact support.'
        : 'Couldn’t open your billing page. Please try again in a moment.',
    )
  }
}

/**
 * How many modes the account can use in each section (Wants, Needs): 1 during the free trial (or once it's over),
 * unlimited on Yearly, Lifetime or a free membership. While access is being checked, nothing is limited.
 */
export function modeLimit(s: Pick<AccessStore, 'state'> = useAccess.getState()) {
  return s.state === 'trial' || s.state === 'ended' ? 1 : Infinity
}
export const useModeLimit = () => useAccess((s) => modeLimit(s))
