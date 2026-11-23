/**
 * Billing actions for a signed-in subscriber, through Paddle's API.
 *
 * POST /api/billing with `Authorization: Bearer <Firebase ID token>` and a JSON body:
 * - { action: 'portal' } → { url }  a link to their Paddle customer portal (card, invoices, receipts, cancel), already
 *                                 signed in. Links are short-lived, so a fresh one is made each time.
 *
 * The ID token proves who's asking: it's checked by Google (Identity Toolkit accounts:lookup), so only the account's
 * owner can see or change its billing. The Paddle customer and subscription come from subscriptions/{uid}, which
 * only the webhook writes. Needs PADDLE_API_KEY (server only), FIREBASE_SERVICE_ACCOUNT and VITE_FIREBASE_API_KEY.
 */
import { firebase } from './_lib/admin.js'
import { PaddleError, paddle, paddleId } from './_lib/paddle.js'

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } })

/** The uid the ID token belongs to, or null if it's missing, expired or not from this Firebase project. */
async function uidFromToken(request: Request): Promise<string | null> {
  const token = /^Bearer (.{20,4096})$/.exec(request.headers.get('authorization') ?? '')?.[1]
  const key = process.env.VITE_FIREBASE_API_KEY
  if (!token || !key) return null
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(key)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken: token }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!res.ok) return null
  const body = (await res.json().catch(() => ({}))) as { users?: { localId?: string; disabled?: boolean }[] }
  const u = body.users?.[0]
  return u?.localId && !u.disabled ? u.localId : null
}

export async function POST(request: Request) {
  try {
    if (!process.env.PADDLE_API_KEY) return json({ error: 'not_configured' }, 503)
    const uid = await uidFromToken(request)
    if (!uid) return json({ error: 'signed_out' }, 401)
    const { action } = ((await request.json().catch(() => ({}))) ?? {}) as { action?: unknown }

    const { db } = await firebase()
    const sub = await db.collection('subscriptions').doc(uid).get()
    const customerId = sub.get('customerId') as unknown
    const subscriptionId = sub.get('subscriptionId') as unknown

    if (action === 'portal') {
      if (!paddleId(customerId, 'ctm')) return json({ error: 'no_customer' }, 404)
      const session = await paddle<{ urls?: { general?: { overview?: string } } }>(`/customers/${customerId}/portal-sessions`, {
        method: 'POST',
        body: paddleId(subscriptionId, 'sub') ? { subscription_ids: [subscriptionId] } : {},
      })
      const url = session.urls?.general?.overview
      if (!url || !url.startsWith('https://')) throw new Error('Paddle returned no portal link')
      return json({ url })
    }

    return json({ error: 'bad_action' }, 400)
  } catch (e) {
    console.error('billing', e)
    if (e instanceof PaddleError && e.status === 404) return json({ error: 'no_customer' }, 404)
    return json({ error: 'server_error' }, 500)
  }
}

/** Anything but POST is refused. */
export const GET = () => json({ error: 'method_not_allowed' }, 405)
