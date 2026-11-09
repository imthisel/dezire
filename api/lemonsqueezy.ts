/**
 * Lemon Squeezy webhook: keeps each account's access in step with its subscription.
 * Set it up in Lemon Squeezy → Settings → Webhooks with the URL https://YOUR-SITE/api/lemonsqueezy and the
 * subscription_* events (see README → Payments). Writes subscriptions/{uid} in Firestore, which the app and the
 * Firestore rules read to decide who may use Dizayr.
 *
 * Protections:
 * - Only requests signed with LEMONSQUEEZY_WEBHOOK_SECRET are accepted (checked before anything is read or parsed).
 * - Bodies over 512 KB and malformed JSON are refused.
 * - The account id is checked to be a real Firebase uid shape, so it can't point anywhere else in the database.
 * - One subscription can never undo another: the account id comes from the checkout link, which anyone can edit, so a
 *   stranger could start (and cancel) a subscription "for" someone else. An event from a different subscription than
 *   the one on the account only applies when it gives at least as much access, so it can add access but never take it away.
 * - Test-mode payments (fake cards) only unlock accounts outside production, unless LS_ALLOW_TEST_MODE=1 is set.
 * - Events that arrive out of order never overwrite newer ones.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { accessFor, validSignature, type SubscriptionAttributes } from './_lib/subscription.js'

type Payload = {
  meta: { event_name: string; custom_data?: { user_id?: unknown } }
  data: { id: string; type: string; attributes: SubscriptionAttributes }
}

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
/** Test payments unlock accounts only in preview / local builds, or when switched on on purpose. */
const testModeAllowed = () => process.env.LS_ALLOW_TEST_MODE === '1' || process.env.VERCEL_ENV !== 'production'

export async function POST(request: Request) {
  const secret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? ''
  if (!secret) {
    console.error('LEMONSQUEEZY_WEBHOOK_SECRET is not set')
    return text('Not configured', 503)
  }
  if (Number(request.headers.get('content-length') ?? 0) > MAX_BODY) return text('Too large', 413)
  const raw = await request.text()
  if (raw.length > MAX_BODY) return text('Too large', 413)
  if (!validSignature(raw, request.headers.get('x-signature'), secret)) return text('Invalid signature', 401)

  let body: Payload
  try {
    body = JSON.parse(raw) as Payload
  } catch {
    return text('Bad request', 400)
  }
  // Only subscriptions decide access (orders and invoices come with their own subscription_* event).
  if (body?.data?.type !== 'subscriptions' || !body.data.attributes || !body.data.id) return text('Ignored', 200)

  const a = body.data.attributes
  if (a.test_mode && !testModeAllowed()) {
    console.warn('Ignored a test-mode subscription event in production', body.meta?.event_name)
    return text('Test mode ignored', 200)
  }

  const store = db()
  const subscriptionId = String(body.data.id)
  // The account it belongs to: passed into the checkout by the app; otherwise found from an earlier event.
  let uid: unknown = body.meta?.custom_data?.user_id
  if (!validUid(uid)) {
    const found = await store.collection('subscriptions').where('subscriptionId', '==', subscriptionId).limit(1).get()
    uid = found.docs[0]?.id
  }
  if (!validUid(uid)) {
    console.error('Lemon Squeezy webhook without a valid user', body.meta?.event_name, subscriptionId)
    // 200 so Lemon Squeezy doesn't keep retrying something that can't be matched.
    return text('No user for this subscription', 200)
  }

  const access = accessFor(a, { annual: process.env.LS_VARIANT_ANNUAL, semiannual: process.env.LS_VARIANT_SEMIANNUAL })
  const at = new Date(a.updated_at)
  if (Number.isNaN(at.getTime())) return text('Bad request', 400)
  const ref = store.collection('subscriptions').doc(uid)

  await store.runTransaction(async (tx) => {
    const now = await tx.get(ref)
    const current = now.get('subscriptionId') as string | undefined
    if (current === subscriptionId) {
      // Events can arrive out of order: never let an older one overwrite a newer one.
      const seen = now.get('lsUpdatedAt') as Timestamp | undefined
      if (seen && seen.toMillis() > at.getTime()) return
    } else if (current) {
      // Another subscription is on this account. This one only replaces it when it gives at least as much access.
      const theirs = (now.get('accessUntil') as Timestamp | null | undefined)?.toMillis() ?? 0
      const mine = access.accessUntil?.getTime() ?? 0
      if (theirs > Date.now() && mine < theirs) {
        console.warn('Kept the current subscription; ignored a weaker one', { uid, current, incoming: subscriptionId, event: body.meta?.event_name })
        return
      }
    }
    tx.set(
      ref,
      {
        plan: access.plan,
        status: access.status,
        accessUntil: ts(access.accessUntil),
        renewsAt: ts(access.renewsAt),
        endsAt: ts(access.endsAt),
        subscriptionId,
        customerId: String(a.customer_id),
        variantId: String(a.variant_id),
        email: typeof a.user_email === 'string' ? a.user_email.slice(0, 320) : null,
        testMode: !!a.test_mode,
        lsUpdatedAt: Timestamp.fromDate(at),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })

  return text('OK', 200)
}

/** Anything but POST is refused. */
export const GET = () => text('Method not allowed', 405)
