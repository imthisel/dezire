import type { Expense, ExpenseCategory, ModeInfo, ModeKind, NeedItem, NeedsPlan } from './types'
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

/** Is this item in Expenses? `ids`: the id of every expense. */
export const isSent = (item: NeedItem, ids: Set<string>) => !!item.expenseId && ids.has(item.expenseId)

/** Expenses that could be brought into a plan: in its categories, and not already an item in any Needs mode. */
export function importable(expenses: Expense[], plan: NeedsPlan, modes: ModeInfo[]) {
  const linked = new Set(modes.flatMap((m) => m.needs?.items.flatMap((i) => i.expenseId ?? []) ?? []))
  const offered = new Set(plan.cats)
  return expenses.filter((e) => offered.has(e.category) && !linked.has(e.id))
}

/** A month's budget: its own when set, otherwise the usual one. */
export const budgetFor = (plan: NeedsPlan, key: string) => plan.monthBudgets[key] ?? plan.monthly

/** One week of a month. Weeks always run Sunday to Saturday, cut off at the month's edges so every day is in exactly one. */
export type NeedWeek = { n: number; start: string; end: string }

export function weeksOfMonth(key: string): NeedWeek[] {
  const [y, m] = key.split('-').map(Number)
  const last = `${key}-${String(daysInMonth(y, m - 1)).padStart(2, '0')}`
  const out: NeedWeek[] = []
  let start = `${key}-01`
  while (start <= last) {
    const saturday = addDays(start, 6 - fromKey(start).getDay())
    const end = saturday < last ? saturday : last
    out.push({ n: out.length + 1, start, end })
    start = addDays(end, 1)
  }
  return out
}

/** The week a day falls in. */
export const weekOfDay = (day: string) => weeksOfMonth(day.slice(0, 7)).find((w) => day >= w.start && day <= w.end)!

/** Every day of a week. */
export function daysOfWeek(w: Pick<NeedWeek, 'start' | 'end'>) {
  const out: string[] = []
  for (let k = w.start; k <= w.end; k = addDays(k, 1)) out.push(k)
  return out
}

/** "Nov 1 – 7", "Nov 29 – 30", or "May 1" for a one-day week. */
export function weekLabel(w: Pick<NeedWeek, 'start' | 'end'>) {
  const a = fromKey(w.start)
  const b = fromKey(w.end)
  const month = MONTHS_SHORT[a.getMonth()]
  return w.start === w.end ? `${month} ${a.getDate()}` : `${month} ${a.getDate()} – ${b.getDate()}`
}

/** Moving to another week keeps the weekday where it can; a cut-off week uses its nearest day. */
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
