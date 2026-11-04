import { useEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { AlertTriangle, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Copy, Plus, Settings2, ShoppingBasket, Trash2, Wallet } from 'lucide-react'
import { useAlt, useCurrentNeeds, useFmt, useStore } from '../store'
import { useExpenseCats } from '../expenseHooks'
import { MASK, plain } from '../lib/money'
import { MAX_DATE, WEEKDAYS, addDays, catColor, catIcon, daysInMonth, fromKey, todayKey } from '../lib/expenses'
import { budgetFor, needsByMonth, sameWeekdayIn, weekLabel, weekOfDay, weeksOfMonth, type NeedWeek } from '../lib/needs'
import { END_YEAR, MONTHS, MONTHS_SHORT, START_YEAR, YEARS, currentYear } from '../lib/time'
import type { Expense, ExpenseCategory, NeedsPlan } from '../lib/types'
import { card } from './Dashboard'
import { MoneyInput } from './MoneyInput'
import { NeedsPicker } from './NeedItemModal'
import { toast } from '../toast'

const OPEN_KEY = 'dizayr-needs-open'
const monthKey = (year: number, m: number) => `${year}-${String(m + 1).padStart(2, '0')}`
const sum = (list: Expense[]) => list.reduce((n, e) => n + e.amount, 0)
const barCls = (pct: number) => (pct > 1 ? 'bg-rose-400' : pct >= 0.85 ? 'bg-amber-300' : 'bg-emerald-400')

/** A new item in a week: on today when today is in it, otherwise on the week's first day. */
const addTo = (w: Pick<NeedWeek, 'start' | 'end'>) => {
  const today = todayKey()
  useStore.getState().openModal({ type: 'need', date: today >= w.start && today <= w.end ? today : w.start })
}

/** The months opened by hand, remembered on this device. Every month starts minimized. */
function useOpenMonths() {
  const [open, setOpen] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem(OPEN_KEY) ?? '[]')
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []
    } catch {
      return []
    }
  })
  const save = (next: string[]) => {
    setOpen(next)
    try {
      localStorage.setItem(OPEN_KEY, JSON.stringify(next))
    } catch {
      // Not remembered; fine.
    }
  }
  return { open, toggle: (k: string) => save(open.includes(k) ? open.filter((x) => x !== k) : [...open, k]), show: (k: string) => !open.includes(k) && save([...open, k]) }
}

/** A Needs mode's main page: laid out like the Overview, with months that open into their weeks. */
export function NeedsPage() {
  const plan = useCurrentNeeds()
  const allCats = useExpenseCats()
  const expenses = useStore((s) => s.expenses)
  const modeName = useStore((s) => s.modes.find((m) => m.id === s.modeId)?.name ?? 'Needs')
  const year = useStore((s) => s.year)
  const months = useOpenMonths()
  const [picking, setPicking] = useState(false)
  const byMonth = useMemo(() => (plan ? needsByMonth(expenses, plan) : new Map<string, Expense[]>()), [expenses, plan])
  if (!plan) return null

  const today = todayKey()
  const cats = plan.cats.flatMap((id) => allCats.filter((c) => c.id === id))

  function openMonth(key: string) {
    months.show(key)
    requestAnimationFrame(() => document.getElementById(`need-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="flex flex-wrap items-center gap-2 text-sm font-medium uppercase tracking-[0.18em] text-zinc-400">
            <ShoppingBasket className="h-4 w-4 text-emerald-300" /> Everyday budget
            <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-emerald-200">Needs</span>
          </h2>
          <p className="mt-0.5 truncate text-sm text-zinc-500">
            <span className="text-zinc-300">{modeName}</span> · week by week, Sunday to Saturday
          </p>
        </div>
        <button onClick={() => addTo(weekOfDay(today))} className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110">
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add item
        </button>
      </div>

      <Stats plan={plan} byMonth={byMonth} />

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        <section className={`${card} min-w-0 p-4 sm:p-5 lg:col-span-3`}>
          <YearChart plan={plan} byMonth={byMonth} year={year} onOpen={openMonth} />
        </section>
        <section className={`${card} min-w-0 p-4 sm:p-5 lg:col-span-2`}>
          <Breakdown cats={cats} byMonth={byMonth} year={year} onEdit={() => setPicking(true)} />
        </section>
      </div>

      <section className="space-y-4">
        <NeedYearTabs expenses={byMonth} />
        <YearGlance plan={plan} byMonth={byMonth} year={year} />
        <ul className="space-y-2.5">
          {Array.from({ length: 12 }, (_, m) => {
            const key = monthKey(year, m)
            return <MonthRow key={key} monthKeyStr={key} plan={plan} items={byMonth.get(key) ?? []} open={months.open.includes(key)} onToggle={() => months.toggle(key)} cats={allCats} />
          })}
        </ul>
      </section>

      {picking && <NeedsPicker onClose={() => setPicking(false)} />}
    </div>
  )
}

function Stats({ plan, byMonth }: { plan: NeedsPlan; byMonth: Map<string, Expense[]> }) {
  const f = useFmt()
  const u = useAlt()
  const today = todayKey()
  const key = today.slice(0, 7)
  const list = byMonth.get(key) ?? []
  const spent = sum(list)
  const budget = budgetFor(plan, key)
  const left = budget - spent
  const d = fromKey(today)
  const daysLeft = daysInMonth(d.getFullYear(), d.getMonth()) - d.getDate() + 1
  const week = weekOfDay(today)
  const weekSpent = sum(list.filter((e) => e.date >= week.start && e.date <= week.end))
  const yearKey = key.slice(0, 4)
  const yearSpent = [...byMonth].reduce((n, [k, l]) => (k.startsWith(yearKey) ? n + sum(l) : n), 0)
  const yearCount = [...byMonth].reduce((n, [k, l]) => (k.startsWith(yearKey) ? n + l.length : n), 0)
  const pct = budget > 0 ? spent / budget : undefined

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
      <Stat highlight icon={<ShoppingBasket className="h-4 w-4 text-emerald-300" />} iconCls="bg-emerald-400/15" label="Spent this month" value={f(spent)} alt={u(spent)} sub={budget > 0 ? `of ${f(budget)} budget` : `in ${MONTHS[d.getMonth()]}`} progress={pct} />
      <Stat
        icon={<Wallet className={`h-4 w-4 ${left < 0 ? 'text-rose-300' : 'text-sky-300'}`} />}
        iconCls={left < 0 ? 'bg-rose-400/15' : 'bg-sky-400/15'}
        label={left < 0 ? 'Over budget' : 'Left this month'}
        value={budget > 0 ? f(Math.abs(left)) : '—'}
        alt={budget > 0 ? u(Math.abs(left)) : ''}
        valueCls={left < 0 ? 'text-rose-300' : 'text-white'}
        sub={budget === 0 ? 'Set a budget below' : left > 0 ? `about ${f(left / daysLeft)} a day` : left < 0 ? 'Past this month’s budget' : 'All used'}
      />
      <Stat icon={<CalendarDays className="h-4 w-4 text-violet-300" />} iconCls="bg-violet-400/15" label={`This week · Week ${week.n}`} value={f(weekSpent)} alt={u(weekSpent)} sub={weekLabel(week)} />
      <Stat icon={<Wallet className="h-4 w-4 text-amber-300" />} iconCls="bg-amber-400/15" label={`Spent in ${yearKey}`} value={f(yearSpent)} alt={u(yearSpent)} sub={`${yearCount} ${yearCount === 1 ? 'item' : 'items'}`} />
    </div>
  )
}

function Stat(p: { icon: ReactNode; iconCls: string; label: string; value: string; alt: string; sub: string; valueCls?: string; progress?: number; highlight?: boolean }) {
  const altCode = useStore((s) => s.currency.alt.code)
  return (
    <div className={`${card} relative min-w-0 overflow-hidden p-3.5 sm:p-5 ${p.highlight ? 'border-emerald-400/30 bg-gradient-to-br from-emerald-500/[0.14] via-white/[0.02] to-teal-500/[0.06]' : ''}`}>
      <div className="flex items-center gap-2 sm:gap-2.5">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${p.iconCls}`}>{p.icon}</span>
        <span className="truncate text-xs font-medium text-zinc-400 sm:text-sm">{p.label}</span>
      </div>
      <p key={p.value} className={`animate-tick mt-2.5 truncate text-xl font-bold leading-none tracking-tight tabular-nums sm:mt-3 sm:text-[28px] ${p.valueCls ?? 'text-white'}`}>
        {p.value}
      </p>
      {p.alt && (
        <p className="alt mt-1.5 truncate text-xs font-medium tabular-nums text-zinc-400 sm:text-sm">
          ≈ {p.alt} {altCode}
        </p>
      )}
      <p className="mt-1.5 truncate text-xs text-zinc-500">{p.sub}</p>
      {p.progress !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full transition-all duration-500 ${barCls(p.progress)}`} style={{ width: `${Math.min(100, p.progress * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/** Each month of the year against its budget. Pressing a month opens it below. */
function YearChart({ plan, byMonth, year, onOpen }: { plan: NeedsPlan; byMonth: Map<string, Expense[]>; year: number; onOpen: (key: string) => void }) {
  const f = useFmt()
  const [picked, setPicked] = useState<string | null>(null)
  const thisMonth = todayKey().slice(0, 7)
  const bars = Array.from({ length: 12 }, (_, m) => {
    const key = monthKey(year, m)
    return { key, m, spent: sum(byMonth.get(key) ?? []), budget: budgetFor(plan, key) }
  })
  const top = Math.max(...bars.map((b) => Math.max(b.spent, b.budget)), 1) * 1.08
  const shown = bars.find((b) => b.key === picked) ?? bars.find((b) => b.key === thisMonth)

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="font-semibold text-white">Spending in {year}</h3>
        {shown ? (
          <p className="truncate text-[13px] tabular-nums text-zinc-400" aria-live="polite">
            <span className="text-zinc-300">{MONTHS[shown.m]}:</span> <span className="font-medium text-white">{f(shown.spent)}</span>
            {shown.budget > 0 && ` of ${f(shown.budget)}`}
          </p>
        ) : (
          <p className="text-[13px] text-zinc-500">Press a month to open it</p>
        )}
      </div>
      <div className="relative mt-4 flex h-44 items-end gap-1 sm:gap-1.5" onMouseLeave={() => setPicked(null)}>
        {bars.map((b) => {
          const over = b.budget > 0 && b.spent > b.budget
          return (
            <button
              key={b.key}
              type="button"
              onMouseEnter={() => setPicked(b.key)}
              onFocus={() => setPicked(b.key)}
              onClick={() => onOpen(b.key)}
              aria-label={`${MONTHS[b.m]}: ${f(b.spent)}${b.budget > 0 ? ` of ${f(b.budget)} budget` : ''}${over ? ', over budget' : ''}. Open this month.`}
              className={`relative flex h-full min-w-0 flex-1 items-end rounded-t outline-none transition focus-visible:bg-white/10 ${picked === b.key ? 'bg-white/[0.05]' : ''}`}
            >
              <span className={`block w-full rounded-t transition-[height] duration-500 ease-out ${over ? 'bg-rose-400' : 'bg-emerald-400'} ${b.key === thisMonth || picked === b.key ? '' : 'opacity-60'}`} style={{ height: `${b.spent > 0 ? Math.max(2, (b.spent / top) * 100) : 0}%` }} />
              {b.budget > 0 && <span aria-hidden className="absolute inset-x-0 border-t-2 border-dashed border-white/40" style={{ bottom: `${(b.budget / top) * 100}%` }} />}
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1 border-t border-white/[0.08] pt-1.5 sm:gap-1.5" aria-hidden>
        {bars.map((b) => (
          <span key={b.key} className={`min-w-0 flex-1 text-center text-[10px] ${b.key === thisMonth ? 'font-semibold text-zinc-200' : 'text-zinc-500'}`}>
            <span className="sm:hidden">{MONTHS_SHORT[b.m].slice(0, 1)}</span>
            <span className="hidden sm:inline">{MONTHS_SHORT[b.m]}</span>
          </span>
        ))}
      </div>
      <p className="mt-2 text-xs text-zinc-500">The dashed line on each month is its budget.</p>
    </>
  )
}

/** Where the year's money goes, in each category's own colour. */
function Breakdown({ cats, byMonth, year, onEdit }: { cats: ExpenseCategory[]; byMonth: Map<string, Expense[]>; year: number; onEdit: () => void }) {
  const f = useFmt()
  const u = useAlt()
  const totals = new Map<string, { n: number; count: number }>()
  for (const [k, list] of byMonth) {
    if (!k.startsWith(String(year))) continue
    for (const e of list) {
      const t = totals.get(e.category) ?? { n: 0, count: 0 }
      totals.set(e.category, { n: t.n + e.amount, count: t.count + 1 })
    }
  }
  const all = [...totals.values()].reduce((n, t) => n + t.n, 0)
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-white">Where it goes</h3>
        <button onClick={onEdit} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
          <Settings2 className="h-3.5 w-3.5" /> Categories
        </button>
      </div>
      {cats.length === 0 ? (
        <p className="mt-6 text-center text-sm text-zinc-500">No categories yet.</p>
      ) : (
        <ul className="mt-3.5 space-y-3">
          {cats.map((c) => {
            const Icon = catIcon(c)
            const col = catColor(c)
            const t = totals.get(c.id) ?? { n: 0, count: 0 }
            return (
              <li key={c.id}>
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-2 text-sm text-zinc-200">
                    <Icon className={`h-4 w-4 shrink-0 ${col.text}`} />
                    <span className="truncate">{c.label}</span>
                    <span className="shrink-0 text-xs tabular-nums text-zinc-600">×{t.count}</span>
                  </span>
                  <span className="shrink-0 text-right text-sm font-semibold tabular-nums text-white">
                    {f(t.n, true)} <span className="alt-i ml-1 text-[11px] font-normal text-zinc-500">· {u(t.n, true)}</span>
                  </span>
                </div>
                <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div className={`h-full rounded-full transition-all duration-500 ${col.bar}`} style={{ width: `${all > 0 ? (t.n / all) * 100 : 0}%` }} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function NeedYearTabs({ expenses }: { expenses: Map<string, Expense[]> }) {
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const f = useFmt()
  const strip = useRef<HTMLDivElement>(null)
  const first = useRef(true)
  const thisYear = currentYear()
  useEffect(() => {
    const el = strip.current
    const tab = el?.querySelector<HTMLElement>(`[data-year="${year}"]`)
    if (!el || !tab) return
    el.scrollTo({ left: tab.offsetLeft - (el.clientWidth - tab.offsetWidth) / 2, behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [year])
  return (
    <div className="sticky top-0 z-30 -mx-4 bg-[#07080c]/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-2">
        <button onClick={() => setYear(year - 1)} disabled={year <= START_YEAR} aria-label="Previous year" className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30 sm:grid">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={strip} className="scrollbar-none relative flex flex-1 gap-1.5 overflow-x-auto">
          {YEARS.map((y) => {
            const total = [...expenses].reduce((n, [k, l]) => (k.startsWith(String(y)) ? n + sum(l) : n), 0)
            const active = y === year
            return (
              <button key={y} data-year={y} onClick={() => setYear(y)} aria-pressed={active} className={`relative flex min-w-[70px] shrink-0 flex-col items-center rounded-xl px-3 py-1.5 transition ${active ? 'bg-gradient-to-b from-emerald-500/30 to-emerald-500/10 text-white ring-1 ring-emerald-400/50' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}>
                <span className="text-sm font-semibold tabular-nums">{y}</span>
                <span className={`text-[10px] tabular-nums ${total > 0 ? (active ? 'text-emerald-200' : 'text-zinc-500') : 'text-transparent'}`}>{total > 0 ? f(total, true) : '·'}</span>
                {y === thisYear && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" title="This year" />}
              </button>
            )
          })}
        </div>
        <button onClick={() => setYear(year + 1)} disabled={year >= END_YEAR} aria-label="Next year" className="hidden h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30 sm:grid">
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

/** The year's totals, and the budget every month starts with. */
function YearGlance({ plan, byMonth, year }: { plan: NeedsPlan; byMonth: Map<string, Expense[]>; year: number }) {
  const f = useFmt()
  const keys = Array.from({ length: 12 }, (_, m) => monthKey(year, m))
  const budget = keys.reduce((n, k) => n + budgetFor(plan, k), 0)
  const spent = keys.reduce((n, k) => n + sum(byMonth.get(k) ?? []), 0)
  const count = keys.reduce((n, k) => n + (byMonth.get(k)?.length ?? 0), 0)
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex min-w-0 items-baseline gap-3">
          <h3 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">{year}</h3>
          <span className="hidden truncate text-sm text-zinc-500 sm:inline">year at a glance</span>
        </div>
        <label className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-sm font-medium text-zinc-200">
            Usual monthly budget
            <span className="block text-xs font-normal text-zinc-500">Every month starts with this</span>
          </span>
          <MoneyInput value={plan.monthly} onChange={(v) => useStore.getState().setNeeds({ monthly: v ?? 0 })} ariaLabel="Usual monthly budget" className="w-36" />
        </label>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-x-4 sm:max-w-xl sm:gap-x-6">
        <Mini k="Budget" v={f(budget)} />
        <Mini k="Spent" v={f(spent)} cls="text-rose-300" />
        <Mini k={budget - spent < 0 ? 'Over' : 'Left'} v={f(Math.abs(budget - spent))} cls={budget - spent < 0 ? 'text-rose-300' : 'text-emerald-300'} />
      </div>
      <p className="mt-2 text-xs text-zinc-500">
        {count} {count === 1 ? 'item' : 'items'} in {year}
      </p>
    </div>
  )
}

function Mini({ k, v, cls = 'text-white' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className={`truncate text-sm font-semibold tabular-nums sm:text-base ${cls}`}>{v}</p>
    </div>
  )
}

function MonthRow({ monthKeyStr: key, plan, items, open, onToggle, cats }: { monthKeyStr: string; plan: NeedsPlan; items: Expense[]; open: boolean; onToggle: () => void; cats: ExpenseCategory[] }) {
  const f = useFmt()
  const masked = useStore((s) => s.device.masked)
  const m = Number(key.slice(5))
  const isNow = todayKey().slice(0, 7) === key
  const spent = sum(items)
  const budget = budgetFor(plan, key)
  const own = plan.monthBudgets[key] ?? null
  const left = budget - spent
  const pct = budget > 0 ? spent / budget : 0
  const over = budget > 0 && spent > budget
  const weeks = useMemo(() => weeksOfMonth(key), [key])

  const shares = useMemo(() => {
    const t = new Map<string, number>()
    for (const e of items) t.set(e.category, (t.get(e.category) ?? 0) + e.amount)
    return [...t].flatMap(([id, n]) => cats.filter((c) => c.id === id).map((c) => ({ c, n })))
  }, [items, cats])

  // Spent in this month on things outside the categories here (still in Expenses).
  const allExpenses = useStore((s) => s.expenses)
  const outside = useMemo(() => {
    const counted = new Set(plan.cats)
    return allExpenses.reduce((n, e) => (e.date.startsWith(key) && !counted.has(e.category) ? n + e.amount : n), 0)
  }, [allExpenses, plan.cats, key])

  return (
    <li id={`need-${key}`} className={`${card} scroll-mt-20 overflow-hidden transition ${isNow ? 'border-emerald-400/30' : ''}`}>
      <button onClick={onToggle} aria-expanded={open} className="grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 text-left transition hover:bg-white/[0.025] sm:grid-cols-[11rem_minmax(0,1fr)_auto_auto] sm:gap-x-5 sm:px-5">
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate text-base font-bold tracking-tight text-white sm:text-lg">{MONTHS[m - 1]}</span>
            {isNow && <span className="shrink-0 rounded-full bg-emerald-400/15 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-emerald-200">This month</span>}
          </span>
          <span className="block truncate text-xs text-zinc-500">
            {items.length ? `${items.length} ${items.length === 1 ? 'item' : 'items'}` : 'Nothing yet'} · {weeks.length} weeks
          </span>
        </span>
        {/* The bar: its own row on phones, the middle on bigger screens */}
        <span className="col-span-2 row-start-2 block min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1">
          <span className="block h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
            <span className={`block h-full rounded-full transition-all duration-500 ${barCls(pct)}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
          </span>
        </span>
        <span className="min-w-0 text-right">
          <span className="block text-sm font-semibold tabular-nums text-white sm:text-base">{f(spent)}</span>
          <span className={`flex items-center justify-end gap-1 text-xs tabular-nums ${over ? 'text-rose-300' : 'text-zinc-500'}`}>
            {over && <AlertTriangle className="h-3 w-3" />}
            {budget > 0 ? (over ? `over by ${f(-left)}` : `${f(left)} left`) : 'No budget'}
          </span>
        </span>
        <ChevronDown className={`hidden h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 sm:block ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-fade border-t border-white/[0.06] p-3 sm:p-5">
          <div className="grid grid-cols-3 gap-2 sm:max-w-xl">
            <Field label="Budget">
              <MoneyInput value={own} nullable onChange={(v) => useStore.getState().setNeedMonthBudget(key, v)} ariaLabel={`${MONTHS[m - 1]} budget`} placeholder={plan.monthly > 0 ? (masked ? MASK : plain(plan.monthly)) : '0'} />
            </Field>
            <Field label="Spent">
              <ReadOnly text={f(spent)} cls="border-white/[0.06] bg-white/[0.03] text-zinc-100" />
            </Field>
            <Field label={over ? 'Over' : 'Left'}>
              <ReadOnly text={budget > 0 ? f(Math.abs(left)) : '—'} cls={over ? 'border-rose-400/30 bg-rose-500/10 text-rose-200' : 'border-emerald-400/20 bg-emerald-500/[0.07] text-emerald-200'} />
            </Field>
          </div>

          {shares.length > 0 && (
            <div className="mt-3">
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full" aria-hidden>
                {shares.map(({ c, n }) => (
                  <span key={c.id} className={catColor(c).bar} style={{ width: `${(n / spent) * 100}%` }} />
                ))}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3.5 gap-y-1">
                {shares.map(({ c, n }) => (
                  <li key={c.id} className="flex items-center gap-1.5 text-xs text-zinc-400">
                    <span className={`h-2 w-2 rounded-full ${catColor(c).bar}`} />
                    {c.label} <span className="font-medium tabular-nums text-zinc-200">{f(n, true)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className={`mt-4 grid gap-2.5 sm:grid-cols-2 sm:gap-3 ${weeks.length === 6 ? 'xl:grid-cols-3' : 'xl:grid-cols-4'}`}>
            {weeks.map((w) => (
              <WeekCard key={w.n} week={w} items={items.filter((e) => e.date >= w.start && e.date <= w.end)} cats={cats} />
            ))}
          </div>

          {outside > 0 && <p className="mt-3 text-xs leading-relaxed text-zinc-500">{f(outside)} more went to other categories this month. It’s in Expenses, but isn’t counted here.</p>}
        </div>
      )}
    </li>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      {children}
    </div>
  )
}

function ReadOnly({ text, cls }: { text: string; cls: string }) {
  return (
    <div title={text} className={`flex h-9 min-w-0 items-center truncate rounded-lg border px-2 text-sm font-medium tabular-nums tracking-tight ${cls}`}>
      {text}
    </div>
  )
}

/** What's being dragged between weeks. */
let dragged: string | null = null

function WeekCard({ week, items, cats }: { week: NeedWeek; items: Expense[]; cats: ExpenseCategory[] }) {
  const f = useFmt()
  const today = todayKey()
  const isNow = today >= week.start && today <= week.end
  const [drop, setDrop] = useState<null | 'move' | 'copy'>(null)
  const total = sum(items)

  const isCopy = (e: DragEvent) => e.ctrlKey || e.altKey || e.metaKey

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDrop(null)
    const id = dragged
    dragged = null
    if (!id) return
    const s = useStore.getState()
    const item = s.expenses.find((x) => x.id === id)
    if (!item) return
    const to = sameWeekdayIn(item.date, week)
    if (isCopy(e)) {
      const copy = s.addExpense({ ...item, date: to })
      return toast.undo(`Copied to Week ${week.n}.`, () => useStore.getState().removeExpense(copy))
    }
    if (item.date >= week.start && item.date <= week.end) return
    const from = item.date
    s.updateExpense(id, { ...item, date: to })
    toast.undo(`Moved to Week ${week.n}.`, () => {
      const now = useStore.getState().expenses.find((x) => x.id === id)
      if (now) useStore.getState().updateExpense(id, { ...now, date: from })
    })
  }

  return (
    <article
      onDragOver={(e) => {
        if (!dragged) return
        e.preventDefault()
        const mode = isCopy(e) ? 'copy' : 'move'
        e.dataTransfer.dropEffect = mode
        setDrop(mode)
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null)}
      onDrop={onDrop}
      className={`relative flex min-w-0 flex-col rounded-2xl border p-3 transition ${drop ? 'border-emerald-400/60 bg-emerald-500/10' : isNow ? 'border-emerald-400/35 bg-emerald-500/[0.05]' : 'border-white/[0.07] bg-black/20'}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-white">
            Week {week.n}
            {isNow && <span className="rounded-full bg-emerald-400/15 px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider text-emerald-200">Now</span>}
          </h4>
          <p className="truncate text-xs text-zinc-500">{weekLabel(week)}</p>
        </div>
        <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-100">{f(total)}</p>
      </header>

      <ul className="mt-2.5 flex flex-1 flex-col gap-1.5">
        {items.map((e) => (
          <NeedRow key={e.id} item={e} cat={cats.find((c) => c.id === e.category)} />
        ))}
        {items.length === 0 && <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/[0.08] px-2 py-4 text-center text-xs text-zinc-600">Nothing yet</li>}
      </ul>

      <button onClick={() => addTo(week)} className="mt-2.5 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.08] hover:text-white">
        <Plus className="h-4 w-4" /> Add item
      </button>

      {drop && (
        <div className="pointer-events-none absolute inset-x-3 bottom-14 rounded-lg bg-emerald-500/90 px-2 py-1 text-center text-xs font-semibold text-emerald-950 shadow-lg">
          Drop to {drop}
        </div>
      )}
    </article>
  )
}

function NeedRow({ item, cat }: { item: Expense; cat?: ExpenseCategory }) {
  const f = useFmt()
  const u = useAlt()
  if (!cat) return null
  const Icon = catIcon(cat)
  const col = catColor(cat)
  const d = fromKey(item.date)
  const title = item.name || cat.label
  const s = useStore.getState

  function copyNext() {
    const to = addDays(item.date, 7)
    if (to > MAX_DATE) return
    const id = s().addExpense({ ...item, date: to })
    toast.undo(`Copied “${title}” to next week.`, () => useStore.getState().removeExpense(id))
  }
  function remove() {
    const gone = s().removeExpense(item.id)
    if (gone) toast.undo(`Deleted “${title}”.`, () => useStore.getState().restoreExpense(gone))
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        dragged = item.id
        e.dataTransfer.effectAllowed = 'copyMove'
        e.dataTransfer.setData('text/plain', title)
      }}
      onDragEnd={() => (dragged = null)}
      onClick={() => s().openModal({ type: 'need', editId: item.id })}
      title={`${cat.label} · click to edit · drag to another week`}
      className={`group relative flex cursor-grab items-center gap-2 rounded-xl border border-white/[0.07] py-1.5 pl-1.5 pr-2 transition hover:brightness-125 active:cursor-grabbing ${col.soft}`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-black/25 ${col.text}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[13px] font-medium text-zinc-100">{title}</span>
        <span className="block truncate text-[11px] text-zinc-400">
          {WEEKDAYS[d.getDay()]} {d.getDate()}
          {item.name ? ` · ${cat.label}` : ''}
        </span>
      </span>
      <span className="shrink-0 text-right sm:group-hover:hidden">
        <span className="block text-[13px] font-semibold tabular-nums text-white">{f(item.amount)}</span>
        <span className="alt text-[10px] tabular-nums text-zinc-400">≈ {u(item.amount, true)}</span>
      </span>
      <span className="hidden shrink-0 items-center gap-0.5 sm:group-hover:flex">
        <RowBtn label="Copy to next week" onClick={copyNext}>
          <Copy className="h-3.5 w-3.5" />
        </RowBtn>
        <RowBtn label={`Delete ${title}`} onClick={remove} danger>
          <Trash2 className="h-3.5 w-3.5" />
        </RowBtn>
      </span>
    </li>
  )
}

function RowBtn({ label, onClick, danger, children }: { label: string; onClick: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`grid h-7 w-7 place-items-center rounded-md text-zinc-300 transition hover:bg-white/10 ${danger ? 'hover:text-red-300' : 'hover:text-white'}`}
    >
      {children}
    </button>
  )
}
