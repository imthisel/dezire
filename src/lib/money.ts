/** Everything is stored and entered in Philippine Pesos. */
export const PESO = '₱'
/** Default exchange rate: ₱62.70 = $1 (so ₱100,000 ≈ $1,595). Editable in the header. */
export const DEFAULT_USD_RATE = 62.7

/**
 * Parses things like "100000", "100,000", "100k", "1.5m", "$2b".
 * Returns null for empty input and NaN for invalid input.
 */
export function parseMoney(input: string): number | null {
  const t = input.trim().toLowerCase().replace(/[,\s]/g, '').replace(/^[$₱€£¥₹]/, '')
  if (!t) return null
  const m = t.match(/^(\d+\.?\d*|\.\d+)([kmb])?$/)
  if (!m) return NaN
  const mult = m[2] === 'k' ? 1e3 : m[2] === 'm' ? 1e6 : m[2] === 'b' ? 1e9 : 1
  return Math.round(parseFloat(m[1]) * mult * 100) / 100
}

/** Smaller text for long amounts, so ₱12,500,000 still fits a small box in full instead of being cut off. */
export const fitText = (text: string) => (text.length > 12 ? 'text-xs' : text.length > 10 ? 'text-[13px]' : 'text-sm')

export const plain = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })

const compact1 = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 })
const compact2 = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 2 })

export function fmt(n: number, symbol: string, compact = false) {
  const neg = n < -0.005
  const a = Math.abs(n)
  let s: string
  if (compact && a >= 1000) s = (a >= 1e6 ? compact2 : compact1).format(a)
  else s = a.toLocaleString('en-US', { maximumFractionDigits: a < 100 ? 2 : 0 })
  return `${neg ? '−' : ''}${symbol}${s}`
}

/** Peso amount → US dollars, using `rate` pesos per dollar. */
export const fmtUsd = (pesos: number, rate: number, compact = false) => fmt(rate > 0 ? pesos / rate : 0, '$', compact)
