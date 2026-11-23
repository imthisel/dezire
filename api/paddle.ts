/**
 * Paddle webhook: keeps each account's access in step with what it paid for.
 * Set it up in Paddle → Developer tools → Notifications with the URL https://YOUR-SITE/api/paddle and these events
 * (see SETUP-PAYMENTS.md):
 * - subscription.* : the Yearly plan (access until the next renewal)
 * - transaction.completed : a Lifetime purchase (a one-time payment) turns on `lifetime`
 * - adjustment.created, adjustment.updated : a full refund or chargeback of that Lifetime payment turns it off again
 * Writes subscriptions/{uid} in Firestore, which the app and the Firestore rules read to decide who may use Dizayr.
 *
 * Protections:
 * - Only requests signed with PADDLE_WEBHOOK_SECRET are accepted (checked before anything is read or parsed), and only
 *   recent ones, so an old message can't be replayed.
 * - Sandbox and live are separate Paddle accounts with separate secrets, so with the live secret set, sandbox
 *   (fake card) payments are refused and can't unlock real accounts.
 * - Bodies over 512 KB and malformed JSON are refused.
 * - The account id is checked to be a real Firebase uid shape, so it can't point anywhere else in the database.
 * - One subscription can never undo another: the account id comes from the checkout, which anyone can edit in their
 *   browser, so a stranger could start (and cancel) a subscription "for" someone else. An event from a different
 *   subscription than the one on the account only applies when it gives at least as much access, so it can add access
 *   but never take it away.
 * - Events that arrive out of order never overwrite newer ones.
 * - Lifetime is only taken away by a refund of the very payment that gave it (its transaction id is kept).
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import {
  accessFor, lifetimePurchase, takesPaymentBack, validSignature,
  type PaddleAdjustment, type PaddleSubscription, type PaddleTransaction,
} from './_lib/subscription.js'
import { paddle, paddleId, paddleSandbox } from './_lib/paddle.js'

type Payload<T = unknown> = { event_id?: string; event_type: string; occurred_at?: string; data: T }

const MAX_BODY = 512 * 1024

function db() {
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')
    if (sa.private_key) sa.private_key = String(sa.private_key).replace(/\\n/g, '\n')
    initializeApp({ credential: cert(sa) })
  }
  return getFirestore()
}

const ts = (d: Date | null) => (d ? Timestamp.fromDate(d) : null)
const text = (body: string, status: number) => new Response(body, { status, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' } })
/** Firebase uids: letters, digits, - and _ only, so one can never be a path like "x/../other". */
const validUid = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)

/** The customer's email, for the admin page. Paddle's subscription events don't include it; optional, never blocks the update. */
async function emailOf(customerId: string): Promise<string | null> {
  if (!process.env.PADDLE_API_KEY) return null
  try {
    const c = await paddle<{ email?: string }>(`/customers/${encodeURIComponent(customerId)}`)
    return typeof c.email === 'string' ? c.email.slice(0, 320) : null
  } catch (e) {
    console.warn('Could not look up the Paddle customer email', customerId, e)
    return null
  }
}

export async function POST(request: Request) {
  const secret = process.env.PADDLE_WEBHOOK_SECRET ?? ''
  if (!secret) {
    console.error('PADDLE_WEBHOOK_SECRET is not set')
    return text('Not configured', 503)
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return text('Too large', 413)
  const raw = await request.text()
  if (raw.length > MAX_BODY) return text('Too large', 413)
  if (!validSignature(raw, request.headers.get('paddle-signature'), secret)) return text('Invalid signature', 401)

  let body: Payload
  try {
    body = JSON.parse(raw) as Payload
  } catch {
    return text('Bad request', 400)
  }
  const type = typeof body?.event_type === 'string' ? body.event_type : ''
  if (!body?.data || typeof body.data !== 'object') return text('Ignored', 200)
  if (type.startsWith('subscription.')) return handleSubscription(body as Payload<PaddleSubscription>)
  // Subscription payments come with their own subscription.* event; only one-time (Lifetime) payments are handled here.
  if (type === 'transaction.completed' || type === 'transaction.paid') return handleTransaction(body as Payload<PaddleTransaction>)
  if (type === 'adjustment.created' || type === 'adjustment.updated') return handleAdjustment(body as Payload<PaddleAdjustment>)
  return text('Ignored', 200)
}

/** The account a payment belongs to: passed into the checkout by the app (customData.user_id). */
const uidOf = (custom: Record<string, unknown> | null | undefined): string | null => (validUid(custom?.user_id) ? custom!.user_id : null)

/** A Yearly subscription started, renewed, changed, was cancelled… */
async function handleSubscription(body: Payload<PaddleSubscription>) {
  const s = body.data
  if (!s?.id || !s.status) return text('Ignored', 200)

  const store = db()
  const subscriptionId = String(s.id)
  // The account it belongs to: passed into the checkout by the app (customData.user_id); otherwise found from an earlier event.
  let uid: unknown = uidOf(s.custom_data)
  if (!validUid(uid)) {
    const found = await store.collection('subscriptions').where('subscriptionId', '==', subscriptionId).limit(1).get()
    uid = found.docs[0]?.id
  }
  if (!validUid(uid)) {
    console.error('Paddle webhook without a valid user', body.event_type, subscriptionId)
    // 200 so Paddle doesn't keep retrying something that can't be matched.
    return text('No user for this subscription', 200)
  }

  const access = accessFor(s, { annual: process.env.VITE_PADDLE_PRICE_ANNUAL })
  const at = new Date(s.updated_at ?? body.occurred_at ?? '')
  if (Number.isNaN(at.getTime())) return text('Bad request', 400)
  const ref = store.collection('subscriptions').doc(uid)
  const customerId = String(s.customer_id ?? '')

  let changed = false
  await store.runTransaction(async (tx) => {
    changed = false
    const now = await tx.get(ref)
    const current = now.get('subscriptionId') as string | undefined
    if (current === subscriptionId) {
      // Events can arrive out of order: never let an older one overwrite a newer one.
      const seen = now.get('paddleUpdatedAt') as Timestamp | undefined
      if (seen && seen.toMillis() > at.getTime()) return
    } else if (current) {
      // Another subscription is on this account. This one only replaces it when it gives at least as much access.
      const theirs = (now.get('accessUntil') as Timestamp | null | undefined)?.toMillis() ?? 0
      const mine = access.accessUntil?.getTime() ?? 0
      if (theirs > Date.now() && mine < theirs) {
        console.warn('Kept the current subscription; ignored a weaker one', { uid, current, incoming: subscriptionId, event: body.event_type })
        return
      }
    }
    tx.set(
      ref,
      {
        plan: access.plan,
        status: access.status,
        paddleStatus: String(s.status),
        accessUntil: ts(access.accessUntil),
        renewsAt: ts(access.renewsAt),
        endsAt: ts(access.endsAt),
        subscriptionId,
        customerId,
        priceId: s.items?.[0]?.price?.id ?? null,
        testMode: paddleSandbox(),
        paddleUpdatedAt: Timestamp.fromDate(at),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    changed = true
  })

  // The email is only for the admin page, so it's looked up after access is saved and never holds it up.
  if (changed && customerId) {
    const email = await emailOf(customerId)
    if (email) await ref.set({ email }, { merge: true })
  }

  return text('OK', 200)
}

/**
 * A one-time payment went through. When it's the Lifetime price, the account gets lifetime access for good, and a
 * Yearly subscription it already has is set to stop renewing (so nobody pays twice).
 */
async function handleTransaction(body: Payload<PaddleTransaction>) {
  const t = body.data
  if (!t?.id || !lifetimePurchase(t, process.env.VITE_PADDLE_PRICE_LIFETIME)) return text('Ignored', 200)
  const uid = uidOf(t.custom_data)
  if (!uid) {
    console.error('Lifetime payment without a valid user', t.id)
    // 200 so Paddle doesn't keep retrying something that can't be matched. Fix by hand (admin page → Make lifetime).
    return text('No user for this payment', 200)
  }

  const store = db()
  const ref = store.collection('subscriptions').doc(uid)
  const customerId = t.customer_id ? String(t.customer_id) : ''
  let subscriptionToStop: string | null = null
  let changed = false
  await store.runTransaction(async (tx) => {
    subscriptionToStop = null
    changed = false
    const now = await tx.get(ref)
    // The same payment again (transaction.paid, then .completed, or a retry): nothing new.
    if (now.get('lifetimeTransactionId') === t.id && now.get('lifetime') === true) return
    const sub = now.get('subscriptionId') as string | undefined
    const status = now.get('status') as string | undefined
    if (sub && (status === 'active' || status === 'on_trial' || status === 'past_due')) subscriptionToStop = sub
    const paidAt = new Date(t.billed_at ?? t.updated_at ?? '')
    tx.set(
      ref,
      {
        lifetime: true,
        lifetimeTransactionId: t.id,
        lifetimePaidAt: Number.isNaN(paidAt.getTime()) ? FieldValue.serverTimestamp() : Timestamp.fromDate(paidAt),
        lifetimePriceId: t.items?.find((i) => i.price)?.price?.id ?? null,
        // Lets them open their receipts in the Paddle portal. A subscriber already has the same customer.
        ...(customerId && !now.get('customerId') ? { customerId } : {}),
        testMode: paddleSandbox(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
    changed = true
  })
  if (!changed) return text('OK', 200)

  // Already on Yearly: stop it renewing. Best effort: it never holds up the Lifetime access itself.
  const stop = subscriptionToStop as string | null
  if (stop && paddleId(stop, 'sub') && process.env.PADDLE_API_KEY) {
    try {
      await paddle(`/subscriptions/${stop}/cancel`, { method: 'POST', body: { effective_from: 'next_billing_period' } })
    } catch (e) {
      console.error('Lifetime bought, but the Yearly subscription could not be set to stop renewing. Cancel it in Paddle by hand.', stop, e)
    }
  }
  if (customerId) {
    const email = await emailOf(customerId)
    if (email) await ref.set({ email }, { merge: true })
  }
  return text('OK', 200)
}

/** A refund or chargeback. When it takes back the whole Lifetime payment, lifetime access ends. */
async function handleAdjustment(body: Payload<PaddleAdjustment>) {
  const a = body.data
  if (!a?.transaction_id || !takesPaymentBack(a)) return text('Ignored', 200)
  const store = db()
  const found = await store.collection('subscriptions').where('lifetimeTransactionId', '==', String(a.transaction_id)).limit(1).get()
  const doc = found.docs[0]
  // Not a Lifetime payment (a Yearly refund ends the subscription, which comes as its own subscription.* event).
  if (!doc || doc.get('lifetime') !== true) return text('Ignored', 200)
  await doc.ref.set(
    { lifetime: false, lifetimeRefundedAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() },
    { merge: true },
  )
  console.warn('Lifetime taken back after a refund or chargeback', { uid: doc.id, transaction: a.transaction_id, adjustment: a.id })
  return text('OK', 200)
}

/** Anything but POST is refused. */
export const GET = () => text('Method not allowed', 405)
