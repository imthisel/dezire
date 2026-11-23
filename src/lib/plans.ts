/**
 * What Dizayr costs. Prices are only shown here; what people are actually charged is set in Paddle,
 * so keep the two the same. Paddle price ids come from the hosting environment (see SETUP-PAYMENTS.md).
 */
export type PlanId = 'annual' | 'lifetime'

export type Plan = {
  id: PlanId
  name: string
  /** What's charged, in US dollars, tax included */
  price: number
  /** Shown crossed out next to the price. Must be a real regular price you charge(d), or leave it out. */
  compareAt?: number
  /** "per year", "once" */
  every: string
  /** Months each payment covers (for the per-month price); null for a one-time payment */
  months: number | null
  badge?: string
  /** What's included on this plan beyond the basics, e.g. how many modes */
  perks: string[]
  /** Paddle price id for this plan (pri_…) */
  priceId: string
}

export const TRIAL_DAYS = 14

export const PLANS: Record<PlanId, Plan> = {
  annual: {
    id: 'annual',
    name: 'Yearly',
    price: 24.99,
    every: 'per year',
    months: 12,
    perks: ['Unlimited Wants and Needs modes'],
    priceId: import.meta.env.VITE_PADDLE_PRICE_ANNUAL ?? '',
  },
  lifetime: {
    id: 'lifetime',
    name: 'Lifetime',
    price: 149,
    every: 'once',
    months: null,
    perks: ['Pay once, never again', 'Unlimited Wants and Needs modes'],
    priceId: import.meta.env.VITE_PADDLE_PRICE_LIFETIME ?? '',
  },
}

/** The order plans are shown in. */
export const PLAN_ORDER: PlanId[] = ['annual', 'lifetime']

/** "$20", "$2.33": whole dollars stay whole, anything else shows cents. */
export function dollars(n: number) {
  const cents = Math.round(n * 100)
  const opts = cents % 100 ? { minimumFractionDigits: 2, maximumFractionDigits: 2 } : { maximumFractionDigits: 0 }
  return `$${(cents / 100).toLocaleString('en-US', opts)}`
}

/** "$2.08" a month (only for plans that renew) */
export const perMonth = (p: Plan) => (p.months ? dollars(p.price / p.months) : dollars(p.price))

/** Payments are set up: the Paddle client token and both price ids are in this build. */
export const paymentsReady = () => !!(import.meta.env.VITE_PADDLE_CLIENT_TOKEN && PLANS.annual.priceId && PLANS.lifetime.priceId)
