import crypto from 'node:crypto'

/** Lemon Squeezy signs each webhook: an HMAC-SHA256 hex digest of the raw body with your signing secret, in X-Signature. */
export function validSignature(rawBody: string, signature: string | null, secret: string) {
  if (!signature || !secret) return false
  const digest = Buffer.from(crypto.createHmac('sha256', secret).update(rawBody).digest('hex'), 'utf8')
  const given = Buffer.from(signature, 'utf8')
  return digest.length === given.length && crypto.timingSafeEqual(digest, given)
}

/** After a renewal date, a few days' grace while the payment goes through, so nobody is locked out by a slow bank. */
const GRACE_MS = 3 * 86_400_000

export type SubscriptionAttributes = {
  status: string
  renews_at: string | null
  ends_at: string | null
  trial_ends_at?: string | null
  variant_id: number | string
  variant_name?: string
  customer_id: number | string
  user_email?: string
  test_mode?: boolean
  updated_at: string
}

export type Access = {
  plan: 'annual' | 'semiannual' | null
  status: string
  /** Until when the account may be used (null: not at all) */
  accessUntil: Date | null
  renewsAt: Date | null
  endsAt: Date | null
}

const date = (s: string | null | undefined) => (s ? new Date(s) : null)

/**
 * What a Lemon Squeezy subscription means for access:
 * - active / on_trial / past_due (a renewal is being retried): until the next renewal, plus a few days' grace
 * - cancelled: until the end of the time already paid for (ends_at)
 * - paused / unpaid / expired: no access
 */
export function accessFor(a: SubscriptionAttributes, variants: { annual?: string; semiannual?: string }): Access {
  const renewsAt = date(a.renews_at)
  const endsAt = date(a.ends_at)
  let accessUntil: Date | null = null
  if (a.status === 'active' || a.status === 'past_due' || a.status === 'on_trial') {
    const next = a.status === 'on_trial' ? date(a.trial_ends_at) ?? renewsAt : renewsAt
    accessUntil = next ? new Date(next.getTime() + GRACE_MS) : null
  } else if (a.status === 'cancelled') accessUntil = endsAt
  const v = String(a.variant_id)
  const name = (a.variant_name ?? '').toLowerCase()
  const plan =
    v === variants.annual || /year|annual|12/.test(name) ? 'annual' : v === variants.semiannual || /6|six|semi/.test(name) ? 'semiannual' : null
  return { plan, status: a.status, accessUntil, renewsAt, endsAt }
}
