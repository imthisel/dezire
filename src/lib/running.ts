import type { Item, RunningCosts } from './types'

/** Fuel a year, in money: the km driven ÷ km per litre × the price of a litre (0 until all three are known). */
export const fuelPerYear = (r: RunningCosts) => (r.kmPerYear > 0 && r.kmPerLiter > 0 && r.fuelPrice > 0 ? (r.kmPerYear / r.kmPerLiter) * r.fuelPrice : 0)

/** Litres of fuel a year (0 until km per year and km per litre are known). */
export const litersPerYear = (r: RunningCosts) => (r.kmPerYear > 0 && r.kmPerLiter > 0 ? r.kmPerYear / r.kmPerLiter : 0)

/** Maintenance + fuel, a year. */
export const runningPerYear = (r: RunningCosts) => r.maintenance + fuelPerYear(r)

/** A vehicle's yearly running cost, or 0 when none was set. */
export const itemRunning = (i: Item) => (i.category === 'vehicle' && i.running ? runningPerYear(i.running) : 0)

const num = (v: unknown, max: number) => Math.min(max, Math.max(0, Math.round((Number(v) || 0) * 100) / 100))

/** Tidies typed or loaded running costs; null when nothing useful is in them. */
export function cleanRunning(r: unknown): RunningCosts | null {
  if (!r || typeof r !== 'object') return null
  const x = r as Record<string, unknown>
  const out: RunningCosts = {
    maintenance: num(x.maintenance, 1e10),
    kmPerYear: num(x.kmPerYear, 1e7),
    kmPerLiter: num(x.kmPerLiter, 1000),
    fuelPrice: num(x.fuelPrice, 1e6),
  }
  return out.maintenance || out.kmPerYear || out.kmPerLiter ? out : null
}

// The price of a litre is usually the same for every car: the last one typed is offered for the next.
const FUEL_KEY = 'dizayr-fuel-price'
export function lastFuelPrice() {
  try {
    return Number(localStorage.getItem(FUEL_KEY)) || 0
  } catch {
    return 0
  }
}
export function rememberFuelPrice(p: number) {
  try {
    if (p > 0) localStorage.setItem(FUEL_KEY, String(p))
  } catch {
    // Not remembered; fine.
  }
}
