/**
 * Billing actions for a signed-in subscriber, through Paddle's API.
 *
 * POST /api/billing with `Authorization: Bearer <Firebase ID token>` and a JSON body:
 * - { action: 'portal' }          → { url }  a link to their Paddle customer portal (card, invoices, cancel), already
 *                                           signed in. Links are short-lived, so a fresh one is made each time.
 * - { action: 'preview_upgrade' } → { amount, currency }  what moving from 6 months to Yearly charges now (lowest unit, e.g. cents)
 * - { action: 'upgrade' }         → { ok: true }  moves them to Yearly, charging the prorated difference now. The
 *                                           webhook (api/paddle.ts) then updates their access as usual.
 *
 * Paddle's customer portal can't change plans, which is why the upgrade lives here.
 * The ID token proves who's asking: it's checked by Google (Identity Toolkit accounts:lookup), so only the account's
 * owner can see or change its billing. The Paddle customer and subscription come from subscriptions/{uid}, which
 * only the webhook writes. Needs PADDLE_API_KEY (server only), FIREBASE_SERVICE_ACCOUNT, VITE_FIREBASE_API_KEY and
 * VITE_PADDLE_PRICE_ANNUAL.
 */
import { firebase } from './_lib/admin.js'
import { PaddleError, paddle, paddleId } from './_lib/paddle.js'
import type { PaddleSubscription } from './_lib/subscription.js'

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

type Preview = { immediate_transaction?: { currency_code?: string; details?: { totals?: { grand_total?: string } } } | null }

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

    if (action === 'preview_upgrade' || action === 'upgrade') {
      const annual = process.env.VITE_PADDLE_PRICE_ANNUAL ?? ''
      if (!annual) return json({ error: 'not_configured' }, 503)
      if (!paddleId(subscriptionId, 'sub')) return json({ error: 'no_subscription' }, 404)
      // Ask Paddle rather than trusting our copy: only a running 6-month subscription that isn't set to end can move up.
      const s = await paddle<PaddleSubscription>(`/subscriptions/${subscriptionId}`)
      if (s.status !== 'active' && s.status !== 'trialing') return json({ error: 'not_active' }, 409)
      if (s.scheduled_change) return json({ error: 'scheduled_change' }, 409)
      if (s.items?.some((i) => i.price?.id === annual)) return json({ error: 'already_annual' }, 409)
      const change = {
        items: [{ price_id: annual, quantity: 1 }],
        // Credit for the unused 6-month time, the rest charged now. If the payment fails, nothing changes.
        proration_billing_mode: 'prorated_immediately',
        on_payment_failure: 'prevent_change',
      }
      if (action === 'preview_upgrade') {
        const p = await paddle<Preview>(`/subscriptions/${subscriptionId}/preview`, { method: 'PATCH', body: change })
        const total = Number(p.immediate_transaction?.details?.totals?.grand_total)
        return json({ amount: Number.isFinite(total) ? total : null, currency: p.immediate_transaction?.currency_code ?? null })
      }
      await paddle(`/subscriptions/${subscriptionId}`, { method: 'PATCH', body: change })
      return json({ ok: true })
    }

    return json({ error: 'bad_action' }, 400)
  } catch (e) {
    console.error('billing', e)
    if (e instanceof PaddleError && e.status === 404) return json({ error: 'no_customer' }, 404)
    // Paddle refuses changes it can't make right now (e.g. a renewal is minutes away, or the payment was declined).
    if (e instanceof PaddleError && (e.status === 400 || e.status === 409 || e.status === 422)) return json({ error: 'refused' }, 409)
    return json({ error: 'server_error' }, 500)
  }
}

/** Anything but POST is refused. */
export const GET = () => json({ error: 'method_not_allowed' }, 405)
