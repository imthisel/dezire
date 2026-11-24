import crypto from 'node:crypto'

/** How old a signed message may be. Paddle's own SDK allows 5 seconds; a little more allows for clock drift and slow starts. */
const MAX_AGE_SEC = 5 * 60

/**
 * Paddle signs each webhook in the Paddle-Signature header: `ts=1671552777;h1=<hex>`. h1 is an HMAC-SHA256 of
 * `${ts}:${rawBody}` with the notification destination's secret key (pdl_ntfset_…). While a secret is being rotated
 * there can be more than one h1: any match is enough.
 */
export function validSignature(rawBody: string, header: string | null, secret: string, now = Date.now()) {
  if (!header || !secret) return false
  let ts = ''
  const given: string[] = []
  for (const part of header.split(';')) {
    const i = part.indexOf('=')
    if (i < 0) continue
    const k = part.slice(0, i).trim()
    const v = part.slice(i + 1).trim()
    if (k === 'ts') ts = v
    else if (k === 'h1') given.push(v)
  }
  if (!/^\d{1,12}$/.test(ts) || !given.length) return false
  // Too old (or from the future): could be a replay of an old message.
  if (Math.abs(now / 1000 - Number(ts)) > MAX_AGE_SEC) return false
  const digest = Buffer.from(crypto.createHmac('sha256', secret).update(`${ts}:${rawBody}`, 'utf8').digest('hex'), 'utf8')
  return given.some((h) => {
    const b = Buffer.from(h, 'utf8')
    return b.length === digest.length && crypto.timingSafeEqual(b, digest)
  })
}

/** After a renewal date, a few days' grace while the payment goes through, so nobody is locked out by a slow bank. */
const GRACE_MS = 3 * 86_400_000

/** The parts of a Paddle subscription (the `data` of every subscription.* webhook) that decide access. */
export type PaddleSubscription = {
  id: string
  status: 'active' | 'trialing' | 'past_due' | 'paused' | 'canceled' | string
  customer_id: string
  custom_data?: Record<string, unknown> | null
  next_billed_at: string | null
  current_billing_period: { starts_at: string; ends_at: string } | null
  scheduled_change: { action: 'cancel' | 'pause' | 'resume' | string; effective_at: string } | null
  canceled_at?: string | null
  items: { status?: string; price: { id: string; billing_cycle?: { interval: string; frequency: number } | null } }[]
  updated_at: string
}

export type Access = {
  plan: 'annual' | null
  /**
   * In the app's words (src/billing.ts and the admin page read these): active, on_trial, past_due,
   * cancelled (still paid up, ends at endsAt), paused, expired.
   */
  status: string
  /** Until when the account may be used (null: not at all) */
  accessUntil: Date | null
  renewsAt: Date | null
  endsAt: Date | null
}

const date = (s: string | null | undefined) => {
  const d = s ? new Date(s) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

/**
 * Which plan a subscription is. Yearly is the only subscription sold now (Lifetime is a one-time payment, see
 * lifetimePurchase), so any subscription that bills counts as Yearly: by its price id when set, otherwise by how often it bills.
 */
function planOf(s: PaddleSubscription, prices: { annual?: string }): Access['plan'] {
  const items = s.items ?? []
  const live = items.filter((i) => i.status !== 'inactive')
  for (const i of live.length ? live : items) {
    if (i.price?.id && i.price.id === prices.annual) return 'annual'
    if (i.price?.billing_cycle) return 'annual'
  }
  return null
}

/**
 * What a Paddle subscription means for access:
 * - active / trialing / past_due (a renewal is being retried): until the next renewal, plus a few days' grace
 * - active but set to cancel (or pause) at the end of the period: until then, shown as "cancelled"
 * - paused / canceled: no access (Paddle only marks it canceled once the paid time is over, or on an immediate cancel)
 */
export function accessFor(s: PaddleSubscription, prices: { annual?: string }): Access {
  const plan = planOf(s, prices)
  const periodEnd = date(s.current_billing_period?.ends_at)
  if (s.status === 'active' || s.status === 'trialing' || s.status === 'past_due') {
    const change = s.scheduled_change
    if (change && (change.action === 'cancel' || change.action === 'pause')) {
      const endsAt = date(change.effective_at) ?? periodEnd
      return { plan, status: 'cancelled', accessUntil: endsAt, renewsAt: null, endsAt }
    }
    const next = date(s.next_billed_at) ?? periodEnd
    return {
      plan,
      status: s.status === 'trialing' ? 'on_trial' : s.status,
      accessUntil: next ? new Date(next.getTime() + GRACE_MS) : null,
      renewsAt: next,
      endsAt: null,
    }
  }
  if (s.status === 'paused') return { plan, status: 'paused', accessUntil: null, renewsAt: null, endsAt: null }
  return { plan, status: 'expired', accessUntil: null, renewsAt: null, endsAt: date(s.canceled_at) }
}

// ---- Lifetime: a one-time payment ----

/** The parts of a Paddle transaction (the `data` of transaction.* webhooks) that matter for Lifetime. */
export type PaddleTransaction = {
  id: string
  status: 'draft' | 'ready' | 'billed' | 'paid' | 'completed' | 'canceled' | 'past_due' | string
  customer_id: string | null
  subscription_id?: string | null
  custom_data?: Record<string, unknown> | null
  items: { price: { id: string; billing_cycle?: { interval: string; frequency: number } | null } | null }[]
  billed_at?: string | null
  updated_at: string
}

/** The parts of a Paddle adjustment (the `data` of adjustment.* webhooks): refunds and chargebacks. */
export type PaddleAdjustment = {
  id: string
  action: 'refund' | 'credit' | 'chargeback' | 'chargeback_reverse' | 'chargeback_warning' | string
  /** full or partial (missing on older events: treated as full) */
  type?: 'full' | 'partial' | string
  transaction_id: string
  status: 'pending_approval' | 'approved' | 'rejected' | 'reversed' | string
  updated_at: string
}

/**
 * Whether a transaction is a paid Lifetime purchase: completed (or paid), not part of a subscription, and for the
 * Lifetime price. When the price id isn't configured, a one-time price (no billing cycle) counts as Lifetime.
 */
export function lifetimePurchase(t: PaddleTransaction, lifetimePrice: string | undefined) {
  if (t.status !== 'completed' && t.status !== 'paid') return false
  if (t.subscription_id) return false
  return (t.items ?? []).some((i) => {
    const p = i.price
    if (!p) return false
    return lifetimePrice ? p.id === lifetimePrice : !p.billing_cycle
  })
}

/** Whether an adjustment takes a whole payment back (an approved full refund, or a chargeback). */
export function takesPaymentBack(a: PaddleAdjustment) {
  if (a.action === 'chargeback') return true
  return a.action === 'refund' && a.status === 'approved' && a.type !== 'partial'
}
