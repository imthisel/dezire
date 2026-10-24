import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowDownRight, ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight, Download, Lightbulb, MapPin, NotebookPen, Plus, Receipt, Search, Settings2,
  Target, Trash2, X,
} from 'lucide-react'
import { useFmt, useStore } from '../store'
import { useCatOf } from '../expenseHooks'
import {
  MAX_DATE, MIN_DATE, WEEKDAYS, WEEKDAYS_FULL, addDays, catColor, catIcon, dayLabel, fromKey, inPeriod, monthKeyOf, periodDays, periodLabel, periodOf,
  shiftPeriod, todayKey, type Period, type PeriodKind,
} from '../lib/expenses'
import { MONTHS, MONTHS_SHORT } from '../lib/time'
import type { Expense } from '../lib/types'
import { card } from './Dashboard'
import { ExpenseSettings, type SettingsTab } from './ExpenseSettings'
import { toast } from '../toast'

const KINDS: { id: PeriodKind; label: string }[] = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
]
const NAMES: Record<PeriodKind, string> = { week: 'week', month: 'month', year: 'year' }
const PERIOD_KEY = 'dezayr-expense-period'

const readKind = (): PeriodKind => {
  try {
    const v = localStorage.getItem(PERIOD_KEY)
    return v === 'week' || v === 'month' || v === 'year' ? v : 'month'
  } catch {
    return 'month'
  }
}

/** Filters on the list: a day picked on the chart, a category, a place, and search text. */
type Filters = { day: string | null; cat: string | null; place: string | null; q: string }
const NO_FILTERS: Filters = { day: null, cat: null, place: null, q: '' }

export const openAddExpense = (date?: string) => useStore.getState().openModal({ type: 'expense', date })

export function Expenses() {
  const expenses = useStore((s) => s.expenses)
  const f = useFmt()
  const today = todayKey()
  const [period, setPeriod] = useState<Period>(() => periodOf(readKind(), today))
  const [filters, setFilters] = useState<Filters>(NO_FILTERS)
  const [settings, setSettings] = useState<SettingsTab | null>(null)

  function setKind(kind: PeriodKind) {
    try {
      localStorage.setItem(PERIOD_KEY, kind)
    } catch {
      // Not remembered; fine.
    }
    // Keep looking at the same time: today if it's in view, otherwise the start of what's showing.
    setPeriod(periodOf(kind, inPeriod(today, period) ? today : period.start))
    setFilters((x) => ({ ...x, day: null }))
  }
  function shift(by: number) {
    setPeriod((p) => shiftPeriod(p, by))
    setFilters((x) => ({ ...x, day: null }))
  }
  const prev = shiftPeriod(period, -1)
  const next = shiftPeriod(period, 1)
  const canPrev = prev.end >= MIN_DATE
  const canNext = next.start <= MAX_DATE
  const isNow = inPeriod(today, period)

  const inView = useMemo(() => expenses.filter((e) => inPeriod(e.date, period)), [expenses, period])

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title */}
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-rose-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-rose-400 via-orange-400 to-amber-300 shadow-lg shadow-rose-500/20">
            <Receipt className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Expenses</h2>
            <p className="truncate text-sm text-zinc-400">Where your money actually goes, day by day.</p>
          </div>
          <button
            onClick={() => setSettings('categories')}
            title="Categories & places"
            aria-label="Categories and places"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => openAddExpense(isNow ? today : period.start)}
            className="hidden h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:inline-flex"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Add expense
          </button>
        </div>
      </section>

      {expenses.length === 0 ? (
        <Empty />
      ) : (
        <>
          {/* Period picker */}
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <div role="tablist" aria-label="Show" className="relative grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-72">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-indigo-500/25 ring-1 ring-indigo-400/40 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
                style={{ transform: `translateX(${KINDS.findIndex((k) => k.id === period.kind) * 100}%)` }}
              />
              {KINDS.map((k) => (
                <button
                  key={k.id}
                  role="tab"
                  aria-selected={period.kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`relative h-9 text-sm font-medium transition ${period.kind === k.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <NavBtn label={`Previous ${NAMES[period.kind]}`} disabled={!canPrev} onClick={() => shift(-1)}>
                <ChevronLeft className="h-4 w-4" />
              </NavBtn>
              <span key={period.start} className="animate-tick min-w-0 flex-1 text-center text-sm font-semibold tabular-nums text-white sm:min-w-[12rem]">
                {periodLabel(period)}
              </span>
              <NavBtn label={`Next ${NAMES[period.kind]}`} disabled={!canNext} onClick={() => shift(1)}>
                <ChevronRight className="h-4 w-4" />
              </NavBtn>
              {!isNow && (
                <button
                  onClick={() => setPeriod(periodOf(period.kind, today))}
                  className="h-9 shrink-0 rounded-xl border border-white/10 px-3 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/10"
                >
                  {period.kind === 'week' ? 'This week' : period.kind === 'month' ? 'This month' : 'This year'}
                </button>
              )}
            </div>
          </div>

          <Overview period={period} list={inView} all={expenses} />

          <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
            <section className={`${card} p-4 sm:p-5 lg:col-span-3`}>
              <SpendChart
                period={period}
                list={inView}
                day={filters.day}
                onDay={(d) => setFilters((x) => ({ ...x, day: x.day === d ? null : d }))}
                onMonth={(k) => {
                  setPeriod(periodOf('month', `${k}-01`))
                  setFilters((x) => ({ ...x, day: null }))
                }}
              />
            </section>
            <section className={`${card} p-4 sm:p-5 lg:col-span-2`}>
              <Breakdown list={inView} filters={filters} setFilters={setFilters} />
            </section>
          </div>

          <List period={period} list={inView} filters={filters} setFilters={setFilters} f={f} />
        </>
      )}

      {/* Phones: a round add button above the tab bar */}
      <button
        onClick={() => openAddExpense(isNow ? today : period.start)}
        aria-label="Add expense"
        className="fixed bottom-[calc(env(safe-area-inset-bottom)+5rem)] right-4 z-30 grid h-14 w-14 place-items-center rounded-full bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-xl shadow-indigo-500/40 ring-1 ring-white/20 transition active:scale-90 sm:hidden"
      >
        <Plus className="h-6 w-6" strokeWidth={2.5} />
      </button>

      {settings && <ExpenseSettings tab={settings} onClose={() => setSettings(null)} />}
    </div>
  )
}

function NavBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
    >
      {children}
    </button>
  )
}

function Empty() {
  const steps = [
    { icon: Plus, title: 'Add what you spend', text: 'Just the amount and the day. The rest is optional.' },
    { icon: CalendarRange, title: 'See your week & month', text: 'Totals, daily average, and how it compares.' },
    { icon: Lightbulb, title: 'Spot where it goes', text: 'Top categories and places, at a glance.' },
  ]
  return (
    <section className={`${card} p-6 text-center sm:p-10`}>
      <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-gradient-to-br from-rose-400/20 to-amber-300/10 ring-1 ring-white/10">
        <Receipt className="h-7 w-7 text-rose-200" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-white">No expenses yet</h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-400">Log what you spend and Dezayr shows you where your money goes, week by week and month by month.</p>
      <button
        onClick={() => openAddExpense()}
        className="mt-5 inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
      >
        <Plus className="h-4 w-4" strokeWidth={2.5} /> Add your first expense
      </button>
      <ol className="mx-auto mt-8 grid max-w-2xl gap-2.5 text-left sm:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-sm font-bold text-indigo-200">{i + 1}</span>
            <span className="min-w-0">
              <span className="block text-sm font-medium text-zinc-100">{s.title}</span>
              <span className="block text-xs text-zinc-500">{s.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---- Overview: total, comparison, average, pace, budget ----

const sum = (list: Expense[]) => list.reduce((s, e) => s + e.amount, 0)

function Overview({ period, list, all }: { period: Period; list: Expense[]; all: Expense[] }) {
  const f = useFmt()
  const catOf = useCatOf()
  const months = useStore((s) => s.months)
  const today = todayKey()
  const total = sum(list)
  const days = periodDays(period)
  const isNow = inPeriod(today, period)
  const future = period.start > today
  // Days lived so far in this period (all of them for a past one).
  const elapsed = isNow ? periodDays({ ...period, end: today }) : future ? 0 : days
  const avg = elapsed > 0 ? total / elapsed : 0

  // Compared with the period before, up to the same point when this one is still going.
  const prev = shiftPeriod(period, -1)
  const prevEnd = isNow ? addDays(prev.start, elapsed - 1) : prev.end
  const prevTotal = sum(all.filter((e) => e.date >= prev.start && e.date <= prevEnd))
  const change = prevTotal > 0 ? (total - prevTotal) / prevTotal : null
  const word = NAMES[period.kind]

  // Budget from the Planner: the month's, or the year's months added up.
  const budget =
    period.kind === 'month'
      ? (months[monthKeyOf(period.start)]?.budget ?? 0)
      : period.kind === 'year'
        ? Object.entries(months).reduce((s, [k, m]) => (k.startsWith(period.start.slice(0, 4)) ? s + m.budget : s), 0)
        : 0
  const pace = isNow && elapsed > 0 ? avg * days : null
  const biggest = list.reduce<Expense | null>((b, e) => (!b || e.amount > b.amount ? e : b), null)

  // Insights
  const byCat = new Map<string, number>()
  for (const e of list) byCat.set(e.category, (byCat.get(e.category) ?? 0) + e.amount)
  const topCat = [...byCat].sort((a, b) => b[1] - a[1])[0]
  const byWeekday = Array(7).fill(0) as number[]
  for (const e of list) byWeekday[fromKey(e.date).getDay()] += e.amount
  const topDay = byWeekday.indexOf(Math.max(...byWeekday))

  return (
    <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
      <div aria-hidden className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-indigo-500/10 blur-3xl" />
      <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-8">
        <div className="min-w-0">
          <p className="text-sm font-medium text-zinc-400">Spent {isNow ? `this ${word}` : `in ${periodLabel(period)}`}</p>
          <p key={`${period.start}-${total}`} className="animate-tick mt-1 truncate text-4xl font-bold tracking-tight tabular-nums text-white sm:text-5xl">
            {f(total)}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            {change !== null ? (
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
                  change > 0.005 ? 'bg-rose-500/15 text-rose-200' : change < -0.005 ? 'bg-emerald-500/15 text-emerald-200' : 'bg-white/[0.06] text-zinc-300'
                }`}
              >
                {change > 0.005 ? <ArrowUpRight className="h-3.5 w-3.5" /> : change < -0.005 ? <ArrowDownRight className="h-3.5 w-3.5" /> : null}
                {Math.abs(change) < 0.005 ? 'Same' : `${Math.round(Math.abs(change) * 100)}% ${change > 0 ? 'more' : 'less'}`}
              </span>
            ) : null}
            <span className="text-xs text-zinc-500">
              {prevTotal > 0 ? `than ${f(prevTotal)} ${isNow ? `by this time last ${word}` : `the ${word} before`}` : `Nothing logged the ${word} before`}
            </span>
          </div>

          {budget > 0 && (
            <div className="mt-5">
              <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 text-zinc-400">
                  <Target className="h-3.5 w-3.5" /> {period.kind === 'month' ? "Month's budget" : "Year's budgets"} (from the Planner)
                </span>
                <span className={`font-medium tabular-nums ${total > budget ? 'text-rose-300' : 'text-zinc-200'}`}>
                  {f(total, true)} / {f(budget, true)}
                </span>
              </div>
              <div className="relative h-2 overflow-hidden rounded-full bg-white/[0.06]">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${total > budget ? 'bg-rose-400' : total / budget >= 0.85 ? 'bg-amber-300' : 'bg-emerald-400'}`}
                  style={{ width: `${Math.min(100, (total / budget) * 100)}%` }}
                />
                {pace !== null && pace > total && (
                  <div className="absolute inset-y-0 rounded-full bg-white/10" style={{ left: `${Math.min(100, (total / budget) * 100)}%`, width: `${Math.max(0, Math.min(100, (pace / budget) * 100) - Math.min(100, (total / budget) * 100))}%` }} />
                )}
              </div>
              <p className={`mt-1.5 text-xs ${total > budget ? 'text-rose-300' : 'text-zinc-500'}`}>
                {total > budget
                  ? `${f(total - budget)} over budget`
                  : `${f(budget - total)} left${pace !== null ? (pace > budget ? ` · at this pace you'll go ${f(pace - budget, true)} over` : ' · on track') : ''}`}
              </p>
            </div>
          )}
        </div>

        <div className="grid min-w-0 grid-cols-2 gap-2.5 self-start sm:grid-cols-3 lg:grid-cols-2">
          <Stat k="Daily average" v={elapsed > 0 ? f(avg) : '—'} sub={elapsed > 0 ? `over ${elapsed} day${elapsed > 1 ? 's' : ''}` : 'Not started yet'} />
          <Stat k={pace !== null ? `On pace for` : 'Expenses'} v={pace !== null ? f(pace, true) : String(list.length)} sub={pace !== null ? `by the end of the ${word}` : `in this ${word}`} />
          <Stat k="Expenses" v={String(list.length)} sub={list.length ? `${f(total / list.length, true)} each on average` : 'None logged'} className={pace !== null ? '' : 'hidden'} />
          <Stat k="Biggest" v={biggest ? f(biggest.amount, true) : '—'} sub={biggest ? biggest.name || catOf(biggest.category).label : '—'} className="col-span-2 sm:col-span-1 lg:col-span-2" />
        </div>
      </div>

      {list.length > 1 && (
        <div className="relative mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
          {topCat && topCat[1] > 0 && (
            <Insight>
              Most went to <b className="font-semibold text-white">{catOf(topCat[0]).label}</b> · {Math.round((topCat[1] / total) * 100)}%
            </Insight>
          )}
          {period.kind !== 'week' && byWeekday[topDay] > 0 && (
            <Insight>
              You spend most on <b className="font-semibold text-white">{WEEKDAYS_FULL[topDay]}s</b>
            </Insight>
          )}
          {biggest && total > 0 && biggest.amount / total > 0.3 && (
            <Insight>
              One expense was <b className="font-semibold text-white">{Math.round((biggest.amount / total) * 100)}%</b> of it all
            </Insight>
          )}
        </div>
      )}
    </section>
  )
}

function Stat({ k, v, sub, className = '' }: { k: string; v: string; sub: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3 ${className}`}>
      <p className="truncate text-[11px] font-medium text-zinc-500">{k}</p>
      <p key={v} className="animate-tick mt-1 truncate text-lg font-bold tabular-nums text-white">
        {v}
      </p>
      <p className="truncate text-[11px] text-zinc-500">{sub}</p>
    </div>
  )
}

function Insight({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1 text-xs text-zinc-400">
      <Lightbulb className="h-3.5 w-3.5 text-amber-300" /> <span>{children}</span>
    </span>
  )
}

// ---- Chart: spending per day (or per month for a year) ----

type Bar = { key: string; label: string; tick: string | null; value: number; count: number; future: boolean; today: boolean }

function SpendChart({ period, list, day, onDay, onMonth }: { period: Period; list: Expense[]; day: string | null; onDay: (d: string) => void; onMonth: (monthKey: string) => void }) {
  const f = useFmt()
  const today = todayKey()
  const [hover, setHover] = useState<number | null>(null)
  useEffect(() => setHover(null), [period.start, period.kind])

  const bars: Bar[] = useMemo(() => {
    if (period.kind === 'year') {
      const y = period.start.slice(0, 4)
      return MONTHS.map((m, i) => {
        const key = `${y}-${String(i + 1).padStart(2, '0')}`
        const inM = list.filter((e) => e.date.startsWith(key))
        return { key, label: `${m} ${y}`, tick: MONTHS_SHORT[i].slice(0, 1), value: sum(inM), count: inM.length, future: `${key}-01` > today, today: today.startsWith(key) }
      })
    }
    const n = periodDays(period)
    const totals = new Map<string, { v: number; c: number }>()
    for (const e of list) {
      const t = totals.get(e.date) ?? { v: 0, c: 0 }
      totals.set(e.date, { v: t.v + e.amount, c: t.c + 1 })
    }
    return Array.from({ length: n }, (_, i) => {
      const key = addDays(period.start, i)
      const d = fromKey(key)
      const t = totals.get(key)
      const tick = period.kind === 'week' ? WEEKDAYS[d.getDay()].slice(0, 2) : d.getDate() === 1 || d.getDate() % 7 === 1 ? String(d.getDate()) : null
      return { key, label: dayLabel(key, today), tick, value: t?.v ?? 0, count: t?.c ?? 0, future: key > today, today: key === today }
    })
  }, [period, list, today])

  const max = Math.max(...bars.map((b) => b.value), 1)
  const lived = bars.filter((b) => !b.future)
  const avg = lived.length ? lived.reduce((s, b) => s + b.value, 0) / lived.length : 0
  const shown = hover ?? (day ? bars.findIndex((b) => b.key === day) : -1)
  const tip = shown >= 0 ? bars[shown] : null
  const yearMode = period.kind === 'year'

  return (
    <div>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-white">{yearMode ? 'By month' : 'By day'}</h3>
          <p className="truncate text-xs text-zinc-500">{yearMode ? 'Tap a month to open it' : 'Tap a day to see just that day'}</p>
        </div>
        <div className="min-h-[2.5rem] shrink-0 text-right" aria-live="polite">
          {tip ? (
            <>
              <p className="text-sm font-semibold tabular-nums text-white">{f(tip.value)}</p>
              <p className="text-[11px] text-zinc-500">
                {tip.label} · {tip.count} expense{tip.count === 1 ? '' : 's'}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-semibold tabular-nums text-zinc-300">{f(avg)}</p>
              <p className="text-[11px] text-zinc-500">average {yearMode ? 'month' : 'day'}</p>
            </>
          )}
        </div>
      </div>

      <div className="relative h-40 sm:h-44" onMouseLeave={() => setHover(null)}>
        {/* Average line */}
        {avg > 0 && (
          <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-white/20" style={{ bottom: `${(avg / max) * 100}%` }}>
            <span className="absolute -top-2 right-0 -translate-y-full rounded bg-[#0e1016] px-1 text-[10px] text-zinc-500">avg</span>
          </div>
        )}
        <div className="absolute inset-0 flex items-end gap-[2px] border-b border-white/10">
          {bars.map((b, i) => {
            const picked = day === b.key
            const lit = shown === i
            const h = b.value > 0 ? Math.max(3, (b.value / max) * 100) : 0
            return (
              <button
                key={b.key}
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                onClick={() => (yearMode ? onMonth(b.key) : onDay(b.key))}
                aria-label={`${b.label}: ${f(b.value)}, ${b.count} expense${b.count === 1 ? '' : 's'}`}
                aria-pressed={!yearMode ? picked : undefined}
                className="group relative flex h-full min-w-0 flex-1 items-end justify-center outline-none"
              >
                {/* Taller hit area than the bar itself */}
                <span className={`absolute inset-x-0 bottom-0 top-0 rounded-md transition ${lit ? 'bg-white/[0.04]' : ''}`} />
                {b.value > 0 ? (
                  <span
                    className={`relative w-full max-w-[28px] rounded-t-[4px] transition-all duration-300 ${
                      picked ? 'bg-indigo-300' : lit ? 'bg-indigo-300/90' : day ? 'bg-indigo-400/35' : 'bg-indigo-400/80'
                    }`}
                    style={{ height: `${h}%` }}
                  />
                ) : (
                  !b.future && <span className="relative h-[2px] w-full max-w-[28px] rounded-full bg-white/[0.08]" />
                )}
                {b.today && <span className="absolute -bottom-[5px] h-1 w-1 rounded-full bg-emerald-400" />}
              </button>
            )
          })}
        </div>
      </div>
      <div className="mt-2 flex gap-[2px]" aria-hidden>
        {bars.map((b) => (
          <span key={b.key} className={`min-w-0 flex-1 text-center text-[10px] tabular-nums ${b.today ? 'font-semibold text-emerald-300' : 'text-zinc-500'}`}>
            {b.tick ?? ''}
          </span>
        ))}
      </div>
    </div>
  )
}

// ---- Breakdown: categories and places ----

function Breakdown({ list, filters, setFilters }: { list: Expense[]; filters: Filters; setFilters: (fn: (x: Filters) => Filters) => void }) {
  const f = useFmt()
  const catOf = useCatOf()
  const [tab, setTab] = useState<'cats' | 'places'>('cats')
  const total = sum(list)

  const totals = new Map<string, { value: number; count: number }>()
  for (const e of list) {
    const k = tab === 'cats' ? catOf(e.category).id : e.place
    const r = totals.get(k) ?? { value: 0, count: 0 }
    totals.set(k, { value: r.value + e.amount, count: r.count + 1 })
  }
  const rows = [...totals].sort((a, b) => b[1].value - a[1].value)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="font-semibold text-white">Where it went</h3>
        <div className="flex rounded-lg border border-white/10 p-0.5 text-xs">
          {(['cats', 'places'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
              className={`h-7 rounded-md px-2.5 font-medium transition ${tab === t ? 'bg-white/[0.08] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
            >
              {t === 'cats' ? 'Categories' : 'Places'}
            </button>
          ))}
        </div>
      </div>
      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-zinc-500">Nothing spent in this stretch.</p>
      ) : (
        <ul className="space-y-1">
          {rows.slice(0, 8).map(([k, r]) => {
            const share = total > 0 ? r.value / total : 0
            const isCat = tab === 'cats'
            const c = catOf(k)
            const col = catColor(c)
            const Icon = isCat ? catIcon(c) : MapPin
            const on = isCat ? filters.cat === k : filters.place === k
            const label = isCat ? c.label : k || 'No place'
            return (
              <li key={k || '_none'}>
                <button
                  onClick={() => setFilters((x) => (isCat ? { ...x, cat: x.cat === k ? null : k } : { ...x, place: x.place === k ? null : k }))}
                  aria-pressed={on}
                  className={`w-full rounded-xl px-2 py-2 text-left transition ${on ? 'bg-white/[0.07] ring-1 ring-white/15' : 'hover:bg-white/[0.04]'}`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${isCat ? `${col.soft} ${col.text}` : 'bg-amber-300/10 text-amber-200'}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm font-medium ${k || isCat ? 'text-zinc-100' : 'text-zinc-500'}`}>{label}</span>
                        <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-100">{f(r.value, true)}</span>
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                          <span className={`block h-full rounded-full transition-all duration-500 ${isCat ? col.bar : 'bg-amber-300/80'}`} style={{ width: `${share * 100}%` }} />
                        </span>
                        <span className="w-14 shrink-0 text-right text-[11px] tabular-nums text-zinc-500">
                          {Math.round(share * 100)}% · {r.count}
                        </span>
                      </span>
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---- The list ----

function List({ period, list, filters, setFilters, f }: { period: Period; list: Expense[]; filters: Filters; setFilters: (fn: (x: Filters) => Filters) => void; f: ReturnType<typeof useFmt> }) {
  const catOf = useCatOf()
  const today = todayKey()
  const q = filters.q.trim().toLowerCase()
  const shown = list
    .filter(
      (e) =>
        (!filters.day || e.date === filters.day) &&
        (filters.cat === null || catOf(e.category).id === filters.cat) &&
        (filters.place === null || e.place === filters.place) &&
        (!q || [e.name, e.place, e.notes, catOf(e.category).label].some((t) => t.toLowerCase().includes(q))),
    )
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
  const days = [...new Set(shown.map((e) => e.date))]
  const active = filters.day || filters.cat !== null || filters.place !== null || q

  function exportCsv() {
    const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`
    const rows = [['Date', 'Amount', 'What', 'Category', 'Place', 'Notes'], ...shown.map((e) => [e.date, e.amount, e.name, e.category ? catOf(e.category).label : '', e.place, e.notes])]
    const blob = new Blob(['﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' })
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dezayr-expenses-${period.start}-to-${period.end}.csv`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success(`Downloaded ${shown.length} expense${shown.length === 1 ? '' : 's'}.`)
  }

  function remove(e: Expense) {
    const gone = useStore.getState().removeExpense(e.id)
    if (gone) toast.undo(`Deleted ${f(gone.amount)}${gone.name ? ` · ${gone.name}` : ''}.`, () => useStore.getState().restoreExpense(gone))
  }

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="mr-auto font-semibold text-white">
          {shown.length} expense{shown.length === 1 ? '' : 's'} <span className="font-normal text-zinc-500">· {f(sum(shown))}</span>
        </h3>
        <label className="relative order-last w-full sm:order-none sm:w-56">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={filters.q}
            onChange={(e) => setFilters((x) => ({ ...x, q: e.target.value }))}
            placeholder={`Search this ${NAMES[period.kind]}`}
            aria-label="Search expenses"
            className="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:h-9 sm:text-sm"
          />
        </label>
        <button
          onClick={exportCsv}
          disabled={!shown.length}
          title="Download these as a spreadsheet (CSV)"
          className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
        >
          <Download className="h-3.5 w-3.5" /> CSV
        </button>
      </div>

      {active && (
        <div className="animate-fade mt-3 flex flex-wrap items-center gap-1.5">
          {filters.day && <FilterChip onClear={() => setFilters((x) => ({ ...x, day: null }))}>{dayLabel(filters.day, today)}</FilterChip>}
          {filters.cat !== null && <FilterChip onClear={() => setFilters((x) => ({ ...x, cat: null }))}>{catOf(filters.cat).label}</FilterChip>}
          {filters.place !== null && <FilterChip onClear={() => setFilters((x) => ({ ...x, place: null }))}>{filters.place || 'No place'}</FilterChip>}
          {q && <FilterChip onClear={() => setFilters((x) => ({ ...x, q: '' }))}>“{filters.q.trim()}”</FilterChip>}
          <button onClick={() => setFilters(() => NO_FILTERS)} className="px-2 text-xs text-zinc-500 transition hover:text-white">
            Clear all
          </button>
        </div>
      )}

      {shown.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-zinc-500">{active ? 'Nothing matches.' : `Nothing logged this ${NAMES[period.kind]}.`}</p>
          {!active && (
            <button onClick={() => openAddExpense(inPeriod(today, period) ? today : period.start)} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-300 hover:text-indigo-200">
              <Plus className="h-4 w-4" /> Add one
            </button>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {days.map((d) => {
            const items = shown.filter((e) => e.date === d)
            return (
              <div key={d}>
                <div className="sticky top-0 z-10 -mx-1 mb-1 flex items-baseline justify-between gap-3 bg-[#0b0c11]/90 px-1 py-1.5 backdrop-blur">
                  <h4 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                    {dayLabel(d, today)}
                    {d === today && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
                  </h4>
                  <span className="flex items-center gap-2">
                    <button onClick={() => openAddExpense(d)} title={`Add to ${dayLabel(d, today)}`} aria-label={`Add an expense on ${dayLabel(d, today)}`} className="grid h-6 w-6 place-items-center rounded-md text-zinc-600 transition hover:bg-white/5 hover:text-zinc-200">
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <span className="text-xs font-semibold tabular-nums text-zinc-300">{f(sum(items))}</span>
                  </span>
                </div>
                <ul className="space-y-1">
                  {items.map((e) => (
                    <Row key={e.id} e={e} onRemove={() => remove(e)} />
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}

function Row({ e, onRemove }: { e: Expense; onRemove: () => void }) {
  const f = useFmt()
  const c = useCatOf()(e.category)
  const col = catColor(c)
  const Icon = catIcon(c)
  const title = e.name || (e.category ? c.label : 'Expense')
  const meta = [e.category && e.name ? c.label : '', e.place].filter(Boolean)

  return (
    <li className="group relative">
      <button
        onClick={() => useStore.getState().openModal({ type: 'expense', editId: e.id })}
        className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04] active:bg-white/[0.06]"
      >
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${col.soft} ${col.text}`}>
          <Icon className="h-[18px] w-[18px]" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className={`truncate text-sm font-medium ${e.name || e.category ? 'text-zinc-100' : 'text-zinc-400'}`}>{title}</span>
            {e.notes && <NotebookPen className="h-3 w-3 shrink-0 text-zinc-500" aria-label="Has a note" />}
          </span>
          {meta.length > 0 && (
            <span className="flex items-center gap-1 truncate text-xs text-zinc-500">
              {meta.map((m, i) => (
                <span key={i} className="inline-flex min-w-0 items-center gap-1 truncate">
                  {i > 0 && <span className="text-zinc-700">·</span>}
                  {m === e.place && <MapPin className="h-3 w-3 shrink-0" />}
                  <span className="truncate">{m}</span>
                </span>
              ))}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-semibold tabular-nums text-white sm:mr-8">{f(e.amount)}</span>
      </button>
      <button
        onClick={onRemove}
        aria-label={`Delete ${title}`}
        title="Delete"
        className="absolute right-1 top-1/2 hidden h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-600 opacity-0 transition hover:bg-red-500/10 hover:text-red-300 focus:opacity-100 group-hover:opacity-100 sm:grid"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </li>
  )
}

function FilterChip({ onClear, children }: { onClear: () => void; children: ReactNode }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-indigo-400/30 bg-indigo-500/10 pl-2.5 pr-1 text-xs font-medium text-indigo-100">
      {children}
      <button onClick={onClear} aria-label="Remove filter" className="grid h-5 w-5 place-items-center rounded-full transition hover:bg-white/10">
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
