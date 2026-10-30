/**
 * What Dizayr costs. Prices are only shown here; what people are actually charged is set in Lemon Squeezy,
 * so keep the two the same. Checkout links come from the hosting environment (see README → Payments).
 */
export type PlanId = 'semiannual' | 'annual'

export type Plan = {
  id: PlanId
  name: string
  /** What's charged each time, in US dollars */
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
  /** Lemon Squeezy checkout link for this plan */
  checkoutUrl: string
}

export const TRIAL_DAYS = 7

export const PLANS: Record<PlanId, Plan> = {
  annual: {
    id: 'annual',
    name: 'Yearly',
    price: 20,
    compareAt: 40,
    every: 'per year',
    months: 12,
    badge: '50% off',
    perks: ['Unlimited modes'],
    checkoutUrl: import.meta.env.VITE_LS_CHECKOUT_ANNUAL ?? '',
  },
  semiannual: {
    id: 'semiannual',
    name: '6 months',
    price: 15,
    every: 'every 6 months',
    months: 6,
    perks: ['2 modes (your main plan + 1 more)'],
    checkoutUrl: import.meta.env.VITE_LS_CHECKOUT_SEMIANNUAL ?? '',
  },
}

/** "$1.67" a month */
export const perMonth = (p: Plan) => `$${(p.price / p.months).toFixed(2)}`

/** Your Lemon Squeezy store's billing page, where subscribers update their card, switch plans or cancel. */
export function billingUrl() {
  const set = import.meta.env.VITE_LS_STORE_URL as string | undefined
  const from = set || PLANS.annual.checkoutUrl || PLANS.semiannual.checkoutUrl
  try {
    return from ? `${new URL(from).origin}/billing` : ''
  } catch {
    return ''
  }
}
