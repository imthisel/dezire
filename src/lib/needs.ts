import type { Expense, ExpenseCategory, ModeKind, NeedBudget, NeedRhythm, NeedsPlan } from './types'
import { periodDays, type Period } from './expenses'

/**
 * Needs modes: weekly and monthly budgets for everyday spending. What was spent always comes from Expenses, so nothing is
 * entered twice, and a need is simply an expense category with a budget and a rhythm.
 *
 * The rhythm is what keeps the week honest: the week counts weekly needs only (a month's rent paid on Tuesday doesn't
 * ruin that week), and the month counts every need.
 */

export const modeKind = (m: { kind?: ModeKind } | undefined): ModeKind => (m?.kind === 'needs' ? 'needs' : 'wants')

/** What a new Needs mode starts with, among the categories that exist. No amounts: those are yours to set. */
const STARTERS: { id: string; rhythm: NeedRhythm }[] = [
  { id: 'groceries', rhythm: 'week' },
  { id: 'food', rhythm: 'week' },
  { id: 'transport', rhythm: 'week' },
  { id: 'bills', rhythm: 'month' },
  { id: 'health', rhythm: 'month' },
]

export function starterNeeds(cats: ExpenseCategory[]): NeedsPlan {
  const list = STARTERS.filter((s) => cats.some((c) => c.id === s.id))
  return {
    weekly: 0,
    monthly: 0,
    cats: list.map((s) => s.id),
    budgets: Object.fromEntries(list.map((s) => [s.id, { amount: 0, rhythm: s.rhythm }])),
  }
}

const amount = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100)

/** Cleans up a Needs plan from a backup file or the cloud. */
export function parseNeeds(raw: unknown): NeedsPlan {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cats = Array.isArray(r.cats) ? [...new Set(r.cats.filter((c): c is string => typeof c === 'string' && !!c))] : []
  const saved = (r.budgets && typeof r.budgets === 'object' ? r.budgets : {}) as Record<string, Partial<NeedBudget> | undefined>
  const budgets: Record<string, NeedBudget> = {}
  // Every saved one, not only the current needs: taking a need out and adding it back later keeps its budget.
  for (const id of new Set([...cats, ...Object.keys(saved)])) budgets[id] = { amount: amount(saved[id]?.amount), rhythm: saved[id]?.rhythm === 'month' ? 'month' : 'week' }
  return { weekly: amount(r.weekly), monthly: amount(r.monthly), cats, budgets }
}

export const budgetOf = (plan: NeedsPlan, id: string): NeedBudget => plan.budgets[id] ?? { amount: 0, rhythm: 'week' }

/** The needs in the plan whose category still exists, in order. */
export const needsIn = (plan: NeedsPlan, cats: ExpenseCategory[]) =>
  plan.cats.flatMap((id) => {
    const cat = cats.find((c) => c.id === id)
    return cat ? [{ cat, ...budgetOf(plan, id) }] : []
  })

/** Adds up spending per category for a stretch of days. */
export function spentByCat(expenses: Expense[], p: Pick<Period, 'start' | 'end'>) {
  const out = new Map<string, number>()
  for (const e of expenses) if (e.date >= p.start && e.date <= p.end) out.set(e.category, (out.get(e.category) ?? 0) + e.amount)
  return out
}

export const DAYS_IN_WEEK = 7

/** What the weekly needs add up to, for when no weekly budget of your own is set. */
export const weekFromNeeds = (plan: NeedsPlan) => plan.cats.reduce((n, id) => n + (budgetOf(plan, id).rhythm === 'week' ? budgetOf(plan, id).amount : 0), 0)

/** What every need adds up to over month `p`: monthly ones as they are, weekly ones for the days that month has. */
export const monthFromNeeds = (plan: NeedsPlan, p: Period) =>
  plan.cats.reduce((n, id) => {
    const b = budgetOf(plan, id)
    return n + (b.rhythm === 'month' ? b.amount : (b.amount * periodDays(p)) / DAYS_IN_WEEK)
  }, 0)

/** The weekly total: your own when set, otherwise what the needs add up to. */
export const weekBudget = (plan: NeedsPlan) => plan.weekly || weekFromNeeds(plan)
export const monthBudget = (plan: NeedsPlan, p: Period) => plan.monthly || monthFromNeeds(plan, p)

/** Spending on needs with the given rhythm (all of them when not given). */
export function spentOnNeeds(plan: NeedsPlan, cats: ExpenseCategory[], spent: Map<string, number>, rhythm?: NeedRhythm) {
  return needsIn(plan, cats).reduce((n, x) => n + (!rhythm || x.rhythm === rhythm ? (spent.get(x.cat.id) ?? 0) : 0), 0)
}

export type Pace = 'none' | 'good' | 'fast' | 'over'

/**
 * How spending compares with the budget and with how much of the period has gone by. "Fast" needs a real gap, so a single
 * ordinary purchase early in the week doesn't raise a flag.
 */
export function paceOf(spent: number, budget: number, elapsed: number): Pace {
  if (budget <= 0) return 'none'
  if (spent > budget + 1e-9) return 'over'
  return spent / budget > elapsed + 0.15 ? 'fast' : 'good'
}
