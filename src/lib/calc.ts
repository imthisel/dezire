import type { Category, Item, MonthData, Trend } from './types'
import { TOTAL_MONTHS, fromIndex, keyOf } from './time'

export interface MonthCalc {
  index: number
  key: string
  year: number
  month: number
  /** Goal to make: worked out from the net worth goal when there is one, otherwise the typed goal */
  goal: number
  /** Net worth wanted by the end of the month (null = not set) */
  netWorthGoal: number | null
  goalFromNetWorth: boolean
  budget: number
  /** Effective earned for this month (actual, or the goal if nothing was entered) */
  earned: number
  earnedFromGoal: boolean
  spent: number
  itemCount: number
  cumGoal: number
  cumBudget: number
  cumEarned: number
  cumSpent: number
  /** Money left = total earned − total spent */
  cash: number
  /** Current value of everything bought so far */
  assets: number
  netWorth: number
  hasData: boolean
}

/**
 * What a month lets you spend: its budget, capped by what you earned
 * (or your goal to make when nothing was entered). No budget = nothing allowed.
 */
export function spendLimit(m: MonthData, goal = m.goal) {
  const earned = m.earned ?? (goal > 0 ? goal : Infinity)
  return Math.min(Math.max(0, m.budget), earned)
}

/** Items that push their month past its limit (in list order). These show in red. `goal` = the month's effective goal. */
export function overLimitIds(m: MonthData | undefined, goal?: number): Set<string> {
  const ids = new Set<string>()
  if (!m) return ids
  const limit = spendLimit(m, goal)
  let run = 0
  for (const it of m.items) {
    run += it.price
    if (run > limit + 1e-9) ids.add(it.id)
  }
  return ids
}

/** Value of an item after it has been held for `monthsHeld` months. */
export function valueAfter(item: Item, monthsHeld: number) {
  const years = Math.max(0, monthsHeld) / 12
  const r = Math.min(Math.max(item.rate || 0, 0), 100) / 100
  if (item.trend === 'appreciating') return item.price * (1 + r) ** years
  if (item.trend === 'depreciating') return item.price * (1 - r) ** years
  return item.price
}

export function computeAll(months: Record<string, MonthData>): MonthCalc[] {
  const assets = new Float64Array(TOTAL_MONTHS)
  for (let i = 0; i < TOTAL_MONTHS; i++) {
    const m = months[keyOf(i)]
    if (!m) continue
    for (const item of m.items) {
      for (let t = i; t < TOTAL_MONTHS; t++) assets[t] += valueAfter(item, t - i)
    }
  }

  const out: MonthCalc[] = []
  let cumGoal = 0, cumBudget = 0, cumEarned = 0, cumSpent = 0
  for (let i = 0; i < TOTAL_MONTHS; i++) {
    const key = keyOf(i)
    const m = months[key]
    const budget = m?.budget ?? 0
    const earnedRaw = m?.earned ?? null
    const items = m?.items ?? []
    const spent = items.reduce((s, it) => s + it.price, 0)
    // A net worth goal decides the goal to make: whatever is still missing at the end of the month.
    // (Things bought this month don't change it: the cash spent becomes an asset of the same value.)
    const netWorthGoal = m?.netWorthGoal ?? null
    const goal =
      netWorthGoal !== null
        ? Math.max(0, Math.round((netWorthGoal - (cumEarned - cumSpent - spent + assets[i])) * 100) / 100)
        : (m?.goal ?? 0)
    const earned = earnedRaw ?? goal
    cumGoal += goal
    cumBudget += budget
    cumEarned += earned
    cumSpent += spent
    const cash = cumEarned - cumSpent
    const { year, month } = fromIndex(i)
    out.push({
      index: i, key, year, month, goal, netWorthGoal, goalFromNetWorth: netWorthGoal !== null, budget, earned,
      earnedFromGoal: earnedRaw === null,
      spent, itemCount: items.length,
      cumGoal, cumBudget, cumEarned, cumSpent, cash,
      assets: assets[i],
      netWorth: cash + assets[i],
      hasData: goal > 0 || budget > 0 || earnedRaw !== null || netWorthGoal !== null || items.length > 0,
    })
  }
  return out
}

export function lastDataIndex(plan: MonthCalc[], fallback: number) {
  for (let i = plan.length - 1; i >= 0; i--) if (plan[i].hasData) return i
  return fallback
}

export interface Portfolio {
  byCategory: Record<Category, { value: number; cost: number; count: number }>
  byTrend: Record<Trend, number>
  value: number
  cost: number
}

/** Items bought from month `from` up to `asOf`, valued as of `asOf`. */
export function portfolioAt(months: Record<string, MonthData>, asOf: number, from = 0): Portfolio {
  const p: Portfolio = {
    byCategory: {
      property: { value: 0, cost: 0, count: 0 },
      vehicle: { value: 0, cost: 0, count: 0 },
      status: { value: 0, cost: 0, count: 0 },
      other: { value: 0, cost: 0, count: 0 },
    },
    byTrend: { appreciating: 0, depreciating: 0, stable: 0 },
    value: 0,
    cost: 0,
  }
  for (let i = from; i <= asOf; i++) {
    const m = months[keyOf(i)]
    if (!m) continue
    for (const it of m.items) {
      const v = valueAfter(it, asOf - i)
      const c = p.byCategory[it.category]
      c.value += v
      c.cost += it.price
      c.count++
      p.byTrend[it.trend]++
      p.value += v
      p.cost += it.price
    }
  }
  return p
}
