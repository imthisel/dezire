import { create } from 'zustand'

/*
 * The About page's currency: pesos, or US dollars at a fixed rate. Every example on the page is planned in pesos; in dollars
 * the amounts are only shown (and typed) converted, so switching back and forth never changes the plan itself.
 * The About page re-renders when it changes, so every amount follows.
 */

export type AboutCurrency = 'PHP' | 'USD'

/** Pesos per US dollar: the BSP reference rate for November 24, 2026. */
export const PHP_PER_USD = 63.85

const KEY = 'dizayr-about-currency'
const saved = (): AboutCurrency => {
  try {
    return localStorage.getItem(KEY) === 'USD' ? 'USD' : 'PHP'
  } catch {
    return 'PHP'
  }
}

export const useAboutCurrency = create<{ cur: AboutCurrency }>(() => ({ cur: saved() }))

export function setAboutCurrency(cur: AboutCurrency) {
  useAboutCurrency.setState({ cur })
  try {
    localStorage.setItem(KEY, cur)
  } catch {
    // Not remembered for next time; fine.
  }
}

const usd = () => useAboutCurrency.getState().cur === 'USD'
/** "₱" or "$" */
export const curSymbol = () => (usd() ? '$' : '₱')
/** A peso amount in the currency shown. */
export const toShown = (php: number) => (usd() ? php / PHP_PER_USD : php)
/** An amount typed in the currency shown, back in pesos. */
export const fromShown = (n: number) => (usd() ? Math.round(n * PHP_PER_USD) : n)

/** "₱1,250,000" or "$19,577" (whole units), "−" for less than zero. Takes pesos. */
export function fmtMoney(php: number) {
  const n = toShown(php)
  return `${n < -0.5 ? '−' : ''}${curSymbol()}${Math.round(Math.abs(n)).toLocaleString('en-US')}`
}

/** "₱1.3M", "$850K". Takes pesos. */
export function fmtShort(php: number) {
  const n = toShown(php)
  const a = Math.abs(n)
  const sign = n < -0.5 ? '−' : ''
  const s = curSymbol()
  if (a >= 1e9) return `${sign}${s}${+(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${sign}${s}${+(a / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${sign}${s}${+(a / 1e3).toFixed(1)}K`
  return fmtMoney(php)
}
