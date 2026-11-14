/**
 * What Dizayr costs. Prices are only shown here; what people are actually charged is set in Paddle,
 * so keep the two the same. Paddle price ids come from the hosting environment (see SETUP-PAYMENTS.md).
 */
export type PlanId = 'semiannual' | 'annual'

export type Plan = {
  id: PlanId
  name: string
  /** What's charged each time, in US dollars, tax included */
  price: number
  /** Shown crossed out next to the price. Must be a real regular price you charge(d), or leave it out. */
  compareAt?: number
  /** "every 6 months", "per year" */
  every: string
  /** Months each payment covers (for the per-month price) */
  months: number
  badge?: string
  /** What's included on this plan beyond the basics, e.g. how many modes */
  perks: string[]
  /** Paddle price id for this plan (pri_…) */
  priceId: string
}

export const TRIAL_DAYS = 7

export const PLANS: Record<PlanId, Plan> = {
  annual: {
    id: 'annual',
    name: 'Yearly',
    price: 22,
    every: 'per year',
    months: 12,
    perks: ['Unlimited Wants and Needs modes'],
    priceId: import.meta.env.VITE_PADDLE_PRICE_ANNUAL ?? '',
  },
  semiannual: {
    id: 'semiannual',
    name: '6 months',
    price: 16,
    every: 'every 6 months',
    months: 6,
    perks: ['2 Wants modes + 2 Needs modes'],
    priceId: import.meta.env.VITE_PADDLE_PRICE_SEMIANNUAL ?? '',
  },
}

/** "$22", "$2.67": whole dollars stay whole, anything else shows cents. */
export function dollars(n: number) {
  const cents = Math.round(n * 100)
  const opts = cents % 100 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }
  return `$${(cents / 100).toLocaleString('en-US', opts)}`
}

/** "$1.83" a month */
export const perMonth = (p: Plan) => dollars(p.price / p.months)

/** Payments are set up: the Paddle client token and both price ids are in this build. */
export const paymentsReady = () => !!(import.meta.env.VITE_PADDLE_CLIENT_TOKEN && PLANS.annual.priceId && PLANS.semiannual.priceId)
