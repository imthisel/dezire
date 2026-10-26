/**
 * Lemon Squeezy webhook: keeps each account's access in step with its subscription.
 * Set it up in Lemon Squeezy → Settings → Webhooks with the URL https://YOUR-SITE/api/lemonsqueezy and the
 * subscription_* events (see README → Payments). Writes subscriptions/{uid} in Firestore, which the app and the
 * Firestore rules read to decide who may use Dizayr.
 */
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore'
import { accessFor, validSignature, type SubscriptionAttributes } from './_lib/subscription.js'

type Payload = {
  meta: { event_name: string; custom_data?: { user_id?: string } }
  data: { id: string; type: string; attributes: SubscriptionAttributes }
}

function db() {
  if (!getApps().length) initializeApp({ credential: cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}')) })
  return getFirestore()
}

const ts = (d: Date | null) => (d ? Timestamp.fromDate(d) : null)

export async function POST(request: Request) {
  const raw = await request.text()
  if (!validSignature(raw, request.headers.get('x-signature'), process.env.LEMONSQUEEZY_WEBHOOK_SECRET ?? '')) {
    return new Response('Invalid signature', { status: 401 })
  }

  const body = JSON.parse(raw) as Payload
  // Only subscriptions decide access (orders and invoices come with their own subscription_* event).
  if (body.data?.type !== 'subscriptions') return new Response('Ignored', { status: 200 })

  const store = db()
  const subscriptionId = String(body.data.id)
  // The account it belongs to: passed into the checkout by the app; otherwise found from an earlier event.
  let uid = body.meta.custom_data?.user_id
  if (!uid) {
    const found = await store.collection('subscriptions').where('subscriptionId', '==', subscriptionId).limit(1).get()
    uid = found.docs[0]?.id
  }
  if (!uid) {
    console.error('Lemon Squeezy webhook without a user', body.meta.event_name, subscriptionId)
    // 200 so Lemon Squeezy doesn't keep retrying something that can't be matched.
    return new Response('No user for this subscription', { status: 200 })
  }

  const a = body.data.attributes
  const access = accessFor(a, { annual: process.env.LS_VARIANT_ANNUAL, semiannual: process.env.LS_VARIANT_SEMIANNUAL })
  const ref = store.collection('subscriptions').doc(uid)

  await store.runTransaction(async (tx) => {
    const now = await tx.get(ref)
    // Events can arrive out of order: never let an older one overwrite a newer one.
    const seen = now.get('lsUpdatedAt') as Timestamp | undefined
    const at = new Date(a.updated_at)
    if (seen && now.get('subscriptionId') === subscriptionId && seen.toMillis() > at.getTime()) return
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
        email: a.user_email ?? null,
        testMode: !!a.test_mode,
        lsUpdatedAt: Timestamp.fromDate(at),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    )
  })

  return new Response('OK', { status: 200 })
}
