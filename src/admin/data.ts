import type { Expense, ExpenseCategory, Goal, GoalAreaDef, IncomeSource, Item, ItemKind, MonthData, Task, TaskKind } from '../lib/types'
import { DEFAULT_GOAL_AREAS, DEFAULT_KINDS } from '../lib/meta'
import { DEFAULT_CURRENCIES, parseCurrencies, type Currencies } from '../lib/money'
import { computeAll } from '../lib/calc'
import { DEFAULT_EXPENSE_CATS, parseExpenseCats, parseExpenses } from '../lib/expenses'
import { DEFAULT_TASK_KINDS, parseTaskKinds, parseTasks } from '../lib/tasks'
import { TRIAL_DAYS } from '../lib/plans'
import type { Sub, UserRow } from './api'

const DAY = 86_400_000

// ---------------------------------------------------------------- membership

export type Membership = 'lifetime' | 'comp' | 'paid' | 'trial' | 'expired' | 'new'

/** Same order of precedence as the app itself (src/billing.ts). */
export function membershipOf(s: Sub, now = Date.now()): Membership {
  if (s.lifetime) return 'lifetime'
  if ((s.compUntil ?? 0) > now) return 'comp'
  if ((s.accessUntil ?? 0) > now) return 'paid'
  if (s.trialStartedAt == null) return 'new'
  return trialEnds(s)! > now ? 'trial' : 'expired'
}

export const trialEnds = (s: Pick<Sub, 'trialStartedAt'>) => (s.trialStartedAt == null ? null : s.trialStartedAt + TRIAL_DAYS * DAY)

/** The four groups the overview and filters use. */
export type Group = 'trial' | 'paying' | 'free' | 'expired'
export const groupOf = (m: Membership): Group => (m === 'paid' ? 'paying' : m === 'lifetime' || m === 'comp' ? 'free' : m === 'expired' ? 'expired' : 'trial')

/** Validated against the dark surface (dataviz validator: band, chroma, CVD, contrast). Always shown with a label. */
export const GROUP: Record<Group, { label: string; hex: string; chip: string }> = {
  trial: { label: 'On trial', hex: '#6366f1', chip: 'bg-indigo-500/15 text-indigo-200 ring-indigo-400/30' },
  paying: { label: 'Paying', hex: '#059669', chip: 'bg-emerald-500/15 text-emerald-200 ring-emerald-400/30' },
  free: { label: 'Free', hex: '#d97706', chip: 'bg-amber-500/15 text-amber-200 ring-amber-400/30' },
  expired: { label: 'Expired', hex: '#e11d48', chip: 'bg-rose-500/15 text-rose-200 ring-rose-400/30' },
}

export const MEMBERSHIP_LABEL: Record<Membership, string> = {
  lifetime: 'Lifetime',
  comp: 'Free membership',
  paid: 'Paying',
  trial: 'Free trial',
  expired: 'Expired',
  new: 'Not started',
}

export const PLAN_LABEL = { annual: 'Yearly', semiannual: '6 months' } as const
export const PLAN_PRICE = { annual: 20, semiannual: 15 } as const

/** Short line under the status: when it ends, which plan… */
export function membershipDetail(u: Sub, now = Date.now()) {
  const m = membershipOf(u, now)
  if (m === 'lifetime') return 'Free forever'
  if (m === 'comp') return `Free until ${shortDate(u.compUntil)}`
  if (m === 'paid') return `${u.plan ? PLAN_LABEL[u.plan] : 'Plan'}${u.status === 'cancelled' ? ' · cancelled, ends' : ' · renews'} ${shortDate(u.accessUntil)}`
  if (m === 'trial') {
    const left = Math.max(0, Math.ceil((trialEnds(u)! - now) / DAY))
    return `${left} day${left === 1 ? '' : 's'} left`
  }
  if (m === 'expired') return u.accessUntil ? `Plan ended ${shortDate(u.accessUntil)}` : `Trial ended ${shortDate(trialEnds(u))}`
  return 'Never opened the app'
}

// ---------------------------------------------------------------- dates

export const shortDate = (t: number | null | undefined) =>
  t ? new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' }) : '—'

export const fullDate = (t: number | null | undefined) =>
  t ? new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—'

export function ago(t: number | null | undefined, now = Date.now()) {
  if (!t) return 'never'
  const s = Math.round((now - t) / 1000)
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d}d ago`
  const mo = Math.round(d / 30)
  if (mo < 12) return `${mo}mo ago`
  return `${Math.round(mo / 12)}y ago`
}

/** The last time we know they did something: saved their plan, or signed in. */
export const lastActive = (u: Pick<UserRow, 'lastSaved' | 'lastSignIn' | 'lastRefresh'>) => Math.max(u.lastSaved ?? 0, u.lastSignIn ?? 0, u.lastRefresh ?? 0) || null

export const displayName = (u: Pick<Sub & UserRow, 'name' | 'email' | 'uid'>) => u.name || u.email?.split('@')[0] || u.uid.slice(0, 8)

// ---------------------------------------------------------------- someone's plan

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const num = (v: unknown) => Number(v) || 0

function cleanMonths(raw: unknown): Record<string, MonthData> {
  const out: Record<string, MonthData> = {}
  if (!isObj(raw)) return out
  for (const [k, m] of Object.entries(raw)) {
    if (!/^\d{4}-\d{2}$/.test(k) || !isObj(m)) continue
    out[k] = {
      goal: num(m.goal),
      budget: num(m.budget),
      netWorthGoal: m.netWorthGoal == null ? null : num(m.netWorthGoal),
      earned: m.earned == null ? null : num(m.earned),
      notes: typeof m.notes === 'string' ? m.notes : undefined,
      items: Array.isArray(m.items)
        ? m.items.filter(isObj).map((i, n) => ({
            id: String(i.id ?? `${k}-${n}`),
            name: String(i.name ?? 'Item'),
            category: String(i.category ?? ''),
            trend: i.trend === 'appreciating' || i.trend === 'depreciating' ? i.trend : 'stable',
            price: num(i.price),
            rate: num(i.rate),
            createdAt: num(i.createdAt),
            favorite: i.favorite === true,
            notes: typeof i.notes === 'string' ? i.notes : undefined,
          }))
        : [],
    }
  }
  return out
}

export type Mode = { id: string; name: string; months: Record<string, MonthData>; setupNotes: Record<string, string>; yearNotes: Record<string, string> }

export type Dream = Item & { key: string; year: number; month: number }

/** Everything in one account's plan, cleaned up for display. */
export type Plan = {
  currency: Currencies
  kinds: ItemKind[]
  modes: Mode[]
  goals: Record<string, Goal[]>
  goalAreas: GoalAreaDef[]
  sources: IncomeSource[]
  expenses: Expense[]
  expenseCats: ExpenseCategory[]
  tasks: Task[]
  taskKinds: TaskKind[]
  birthday: string | null
}

export function readPlan(data: Record<string, unknown> | null): Plan | null {
  if (!data) return null
  const strings = (v: unknown) => (isObj(v) ? (Object.fromEntries(Object.entries(v).filter(([, t]) => typeof t === 'string' && t.trim())) as Record<string, string>) : {})
  const main: Mode = { id: 'main', name: 'Main', months: cleanMonths(data.months), setupNotes: strings(data.setupNotes), yearNotes: strings(data.yearNotes) }
  const modes: Mode[] = [main]
  if (Array.isArray(data.modes)) {
    for (const m of data.modes.filter(isObj)) {
      if (m.id === 'main') {
        if (typeof m.name === 'string' && m.name.trim()) main.name = m.name.trim()
        continue
      }
      modes.push({ id: String(m.id), name: String(m.name ?? 'Mode'), months: cleanMonths(m.months), setupNotes: strings(m.setupNotes), yearNotes: strings(m.yearNotes) })
    }
  }
  const kinds = Array.isArray(data.kinds) && data.kinds.length ? (data.kinds.filter(isObj) as unknown as ItemKind[]) : DEFAULT_KINDS
  const goalAreas = Array.isArray(data.goalAreas) && data.goalAreas.length ? (data.goalAreas.filter(isObj) as unknown as GoalAreaDef[]) : DEFAULT_GOAL_AREAS
  const goals: Record<string, Goal[]> = {}
  if (isObj(data.goals)) {
    for (const [y, list] of Object.entries(data.goals)) {
      if (!Array.isArray(list)) continue
      const clean = list.filter((g): g is Goal => isObj(g) && typeof g.text === 'string' && !!g.text.trim())
      if (clean.length) goals[y] = clean
    }
  }
  return {
    currency: isObj(data.currency) ? parseCurrencies(data.currency) : DEFAULT_CURRENCIES,
    kinds,
    modes,
    goals,
    goalAreas,
    sources: Array.isArray(data.sources) ? (data.sources.filter(isObj) as unknown as IncomeSource[]) : [],
    expenses: parseExpenses(data.expenses),
    expenseCats: parseExpenseCats(data.expenseCats) ?? DEFAULT_EXPENSE_CATS,
    tasks: parseTasks(data.tasks),
    taskKinds: parseTaskKinds(data.taskKinds) ?? DEFAULT_TASK_KINDS,
    birthday: typeof data.birthday === 'string' ? data.birthday : null,
  }
}

/** Every item (dream) in a mode, in month order. */
export function dreamsOf(mode: Mode): Dream[] {
  return Object.keys(mode.months)
    .sort()
    .flatMap((key) => mode.months[key].items.map((i) => ({ ...i, key, year: Number(key.slice(0, 4)), month: Number(key.slice(5, 7)) - 1 })))
}

/** Headline numbers for one mode. */
export function modeSummary(mode: Mode) {
  const calc = computeAll(mode.months)
  const last = calc[calc.length - 1]
  const dreams = dreamsOf(mode)
  return {
    dreams: dreams.length,
    favorites: dreams.filter((d) => d.favorite).length,
    dreamsValue: dreams.reduce((s, d) => s + d.price, 0),
    netWorth: last?.netWorth ?? 0,
    totalGoal: last?.cumGoal ?? 0,
    monthsPlanned: calc.filter((c) => c.hasData).length,
  }
}

export function goalsSummary(goals: Record<string, Goal[]>) {
  const all = Object.values(goals).flat()
  return { total: all.length, done: all.filter((g) => g.done).length }
}

/** A JSON file download. */
export function download(name: string, data: unknown, type = 'application/json') {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
}

/** Spreadsheet of everyone (opens in Excel / Google Sheets). */
export function usersCsv(users: UserRow[]) {
  const head = ['Name', 'Email', 'Status', 'Detail', 'Plan', 'Joined', 'Last active', 'Disabled', 'UID', 'Note']
  const cell = (v: unknown) => {
    const s = v == null ? '' : String(v)
    // Quote everything; a leading = + - @ is neutralised so a spreadsheet never runs it as a formula.
    return `"${(/^[=+\-@]/.test(s) ? `'${s}` : s).replace(/"/g, '""')}"`
  }
  const iso = (t: number | null) => (t ? new Date(t).toISOString().slice(0, 10) : '')
  const rows = users.map((u) => [
    u.name, u.email, MEMBERSHIP_LABEL[membershipOf(u)], membershipDetail(u), u.plan ? PLAN_LABEL[u.plan] : '', iso(u.createdAt), iso(lastActive(u)), u.disabled ? 'yes' : '', u.uid, u.note,
  ])
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}
