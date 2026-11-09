import type { Expense, ExpenseCategory, ModeInfo, ModeKind, MonthData, NeedItem, NeedsPlan } from './types'
import { addDays, daysInMonth, fromKey, parseExpenses } from './expenses'
import { MONTHS_SHORT } from './time'

/**
 * Needs modes: everyday spending, laid out like the Overview but month → week → items. A mode keeps its own items, apart from
 * Expenses. Ticking one sends it across as a linked expense; the two then stay the same until it's unticked. Each month has a budget.
 */

export const modeKind = (m: { kind?: ModeKind } | undefined): ModeKind => (m?.kind === 'needs' ? 'needs' : 'wants')

/** What a new Needs mode offers when adding something, among the categories that exist. */
const STARTERS = ['groceries', 'food', 'transport', 'bills', 'health']

export const starterNeeds = (cats: ExpenseCategory[]): NeedsPlan => ({ monthly: 0, monthBudgets: {}, cats: STARTERS.filter((id) => cats.some((c) => c.id === id)), items: [] })

const amount = (v: unknown) => Math.max(0, Math.round((Number(v) || 0) * 100) / 100)

/** Cleans up a Needs plan from a backup file, the cloud or this browser. */
export function parseNeeds(raw: unknown): NeedsPlan {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const cats = Array.isArray(r.cats) ? [...new Set(r.cats.filter((c): c is string => typeof c === 'string' && !!c))] : []
  const saved = (r.monthBudgets && typeof r.monthBudgets === 'object' ? r.monthBudgets : {}) as Record<string, unknown>
  const monthBudgets: Record<string, number> = {}
  for (const [k, v] of Object.entries(saved)) if (/^\d{4}-\d{2}$/.test(k) && v != null && Number.isFinite(Number(v))) monthBudgets[k] = amount(v)
  return { monthly: amount(r.monthly), monthBudgets, cats, items: parseNeedItems(r.items) }
}

function parseNeedItems(list: unknown): NeedItem[] {
  if (!Array.isArray(list)) return []
  return list.flatMap((x: { expenseId?: unknown }) => parseExpenses([x]).map((e) => (typeof x?.expenseId === 'string' && x.expenseId ? { ...e, expenseId: x.expenseId } : e)))
}

/** The same plan for another mode: its items start out of Expenses, so one expense never has two items. */
export const unlinkedCopy = (plan: NeedsPlan): NeedsPlan => ({ ...structuredClone(plan), items: plan.items.map(({ expenseId: _link, ...i }) => i) })

/** Is this item (a Needs item, or a Wants item marked spent) in Expenses? `ids`: the id of every expense. */
export const isSent = (item: { expenseId?: string }, ids: Set<string>) => !!item.expenseId && ids.has(item.expenseId)

/** Months with every item's link to Expenses dropped: for copies, so a copy never claims the original's expense. */
export function unlinkedMonths(months: Record<string, MonthData>): Record<string, MonthData> {
  const out: Record<string, MonthData> = {}
  for (const [k, m] of Object.entries(months)) out[k] = { ...m, items: m.items.map(({ expenseId: _link, ...i }) => i) }
  return out
}

/**
 * The day a Wants item is recorded as spent: today, unless its month is already over (then that month's last day,
 * so it lands in the month it was planned for). The date can be changed in Expenses afterwards.
 */
export function spentDay(monthKey: string, today: string) {
  if (monthKey >= today.slice(0, 7)) return today
  const [y, m] = monthKey.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return `${monthKey}-${String(last).padStart(2, '0')}`
}

/** The expense category a Wants purchase goes in: one named like “Wants”, “Want” or “Wishlist” if there is one, else none. */
export const wantsCategory = (cats: ExpenseCategory[]) => cats.find((c) => /^(wants?|wish ?list|dreams?)$/i.test(c.label.trim()))?.id ?? ''

/** Expenses that could be brought into a plan: in its categories, and not already an item in any Needs mode. */
export function importable(expenses: Expense[], plan: NeedsPlan, modes: ModeInfo[]) {
  const linked = new Set(modes.flatMap((m) => m.needs?.items.flatMap((i) => i.expenseId ?? []) ?? []))
  const offered = new Set(plan.cats)
  return expenses.filter((e) => offered.has(e.category) && !linked.has(e.id))
}

/** A month's budget: its own when set, otherwise the usual one. */
export const budgetFor = (plan: NeedsPlan, key: string) => plan.monthBudgets[key] ?? plan.monthly

/**
 * One week of a month. Every month has exactly four: the 1st–7th, 8th–14th and 15th–21st, then the 22nd to the month's
 * last day (so the days a fifth week would have get folded into Week 4).
 */
export type NeedWeek = { n: number; start: string; end: string }

export function weeksOfMonth(key: string): NeedWeek[] {
  const [y, m] = key.split('-').map(Number)
  const day = (d: number) => `${key}-${String(d).padStart(2, '0')}`
  return [
    { n: 1, start: day(1), end: day(7) },
    { n: 2, start: day(8), end: day(14) },
    { n: 3, start: day(15), end: day(21) },
    { n: 4, start: day(22), end: day(daysInMonth(y, m - 1)) },
  ]
}

/** The week a day falls in. */
export const weekOfDay = (day: string) => weeksOfMonth(day.slice(0, 7)).find((w) => day >= w.start && day <= w.end)!

/** Every day of a week. */
export function daysOfWeek(w: Pick<NeedWeek, 'start' | 'end'>) {
  const out: string[] = []
  for (let k = w.start; k <= w.end; k = addDays(k, 1)) out.push(k)
  return out
}

/** "Nov 1 – 7", "Nov 22 – 30". */
export function weekLabel(w: Pick<NeedWeek, 'start' | 'end'>) {
  const a = fromKey(w.start)
  const b = fromKey(w.end)
  const month = MONTHS_SHORT[a.getMonth()]
  return w.start === w.end ? `${month} ${a.getDate()}` : `${month} ${a.getDate()} – ${b.getDate()}`
}

/** Moving to another week keeps the weekday (every week has at least seven days, so it's always there). */
export function sameWeekdayIn(day: string, w: Pick<NeedWeek, 'start' | 'end'>) {
  const weekday = fromKey(day).getDay()
  const days = daysOfWeek(w)
  return days.find((k) => fromKey(k).getDay() === weekday) ?? (weekday < fromKey(days[0]).getDay() ? days[0] : days[days.length - 1])
}

/** The plan's items by month ("2027-03"), in date order. */
export function needsByMonth(plan: NeedsPlan) {
  const out = new Map<string, NeedItem[]>()
  for (const e of plan.items) {
    const k = e.date.slice(0, 7)
    const list = out.get(k)
    if (list) list.push(e)
    else out.set(k, [e])
  }
  for (const list of out.values()) list.sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
  return out
}
