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

/** A car with running costs and the months it's yours: from the month bought, up to (not including) `until` (month indexes). */
export type OwnedCar = { item: Item; from: number; until: number }

export type CarInYear = { item: Item; months: number; firstMonth: number; lastMonth: number; perYear: number; cost: number }
export type RunningYear = { year: number; total: number; cars: CarInYear[] }

/**
 * What the cars cost to run in each year, counting each car only for the months it's yours that year
 * (a car bought in May runs May–December; one sold at the June setup runs until May). `startYear`: the first year (index 0).
 */
export function runningByYear(cars: OwnedCar[], startYear: number, years: number): RunningYear[] {
  return Array.from({ length: years }, (_, y) => {
    const start = y * 12
    const list: CarInYear[] = []
    for (const c of cars) {
      const a = Math.max(start, c.from)
      const b = Math.min(start + 12, c.until)
      if (b <= a) continue
      const perYear = itemRunning(c.item)
      list.push({ item: c.item, months: b - a, firstMonth: a - start, lastMonth: b - 1 - start, perYear, cost: (perYear / 12) * (b - a) })
    }
    list.sort((p, q) => q.cost - p.cost)
    return { year: startYear + y, total: list.reduce((n, c) => n + c.cost, 0), cars: list }
  })
}
