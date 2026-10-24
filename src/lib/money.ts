/** A currency as shown in the app: its sign (₱) and short code (PHP). */
export type Currency = { symbol: string; code: string }
/** The second currency amounts are also shown in. `rate` = main-currency units per 1 of it. */
export type AltCurrency = Currency & { rate: number; show: boolean }
/** Every amount is stored and entered in the main currency; the alternative one is only for display. */
export type Currencies = { main: Currency; alt: AltCurrency }

/** Default: Philippine Pesos, also shown in US dollars at ₱62.70 = $1 (so ₱100,000 ≈ $1,595). */
export const DEFAULT_CURRENCIES: Currencies = {
  main: { symbol: '₱', code: 'PHP' },
  alt: { symbol: '$', code: 'USD', rate: 62.7, show: true },
}

/** Common currencies offered as one-tap choices in the currency settings. */
export const CURRENCY_PRESETS: Currency[] = [
  { symbol: '₱', code: 'PHP' },
  { symbol: '$', code: 'USD' },
  { symbol: '€', code: 'EUR' },
  { symbol: '£', code: 'GBP' },
  { symbol: '¥', code: 'JPY' },
  { symbol: '₩', code: 'KRW' },
  { symbol: 'S$', code: 'SGD' },
  { symbol: 'A$', code: 'AUD' },
  { symbol: 'C$', code: 'CAD' },
  { symbol: '₹', code: 'INR' },
  { symbol: 'د.إ', code: 'AED' },
  { symbol: '₿', code: 'BTC' },
]

const str = (v: unknown, max: number, fallback: string) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : fallback)

/** Reads saved currency settings, falling back to the defaults. `legacyRate` is the old "pesos per US dollar" setting. */
export function parseCurrencies(raw: unknown, legacyRate?: unknown): Currencies {
  const d = DEFAULT_CURRENCIES
  const r = (raw && typeof raw === 'object' ? raw : {}) as { main?: Record<string, unknown>; alt?: Record<string, unknown> }
  const main = r.main ?? {}
  const alt = r.alt ?? {}
  const rate = Number(alt.rate) > 0 ? Number(alt.rate) : Number(legacyRate) > 0 ? Number(legacyRate) : d.alt.rate
  return {
    main: { symbol: str(main.symbol, 4, d.main.symbol), code: str(main.code, 5, d.main.code).toUpperCase() },
    alt: {
      symbol: str(alt.symbol, 4, d.alt.symbol),
      code: str(alt.code, 5, d.alt.code).toUpperCase(),
      rate,
      show: typeof alt.show === 'boolean' ? alt.show : true,
    },
  }
}

/**
 * Parses things like "100000", "100,000", "100k", "1.5m", "$2b".
 * Returns null for empty input and NaN for invalid input.
 */
export function parseMoney(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/[,\s]/g, '').replace(/^(?:[a-z]{0,2}\$|[₱€£¥₹₩₿])/, '')
  if (!t) return null
  const m = t.match(/^(\d+\.?\d*|\.\d+)([kmb])?$/)
  if (!m) return NaN
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1
  return Math.round(parseFloat(m[1]) * mult * 100) / 100
}

/** Smaller text for long amounts, so ₱12,500,000 still fits a small box in full instead of being cut off. */
export const fitText = (text: string) => (text.length > 12 ? 'text-xs' : text.length > 10 ? 'text-[13px]' : 'text-sm')

// Made once and reused: building a number formatter for every amount shown is slow, and a page can show thousands.
const whole = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
const cents = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })

export const plain = (n: number) => cents.format(n)

const compact1 = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const compact2 = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export function fmt(n: number, symbol: string, compact = false) {
  const neg = n < -0.005
  const a = Math.abs(n)
  let s: string
  if (compact && a >= 1000) s = (a >= 1e6 ? compact2 : compact1).format(a)
  else s = (a < 100 ? cents : whole).format(a)
  return `${neg ? '−' : ''}${symbol}${s}`
}

/** Main-currency amount → alternative currency, using `rate` main units per 1 alternative unit. */
export const fmtAlt = (n: number, alt: AltCurrency, compact = false) => fmt(alt.rate > 0 ? n / alt.rate : 0, alt.symbol, compact)
