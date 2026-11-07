import { useMemo, useState, type ReactNode } from 'react'
import { MapPin, Plus, StickyNote, Target, X } from 'lucide-react'
import { DEFAULT_EXPENSE_CATS, catColor, catIcon, toKey } from '../../lib/expenses'
import type { ExpenseCategory } from '../../lib/types'
import { MoneyField, Toolbar, money, moneyShort } from './TryOverview'
import { DemoExpenseModal, type NewExpense } from './DemoDialogs'

/*
 * A playable copy of Expenses on the About page: this month, with the same "Add expense" window, overview, budget,
 * chart by day and "where it went" breakdown as the app. It lives only in this page's memory: nothing is saved anywhere.
 */

// This month, so "Today" and "Yesterday" mean what they do in the app.
const NOW = new Date()
const YEAR = NOW.getFullYear()
const MONTH = NOW.getMonth()
const TODAY = NOW.getDate()
const DAYS = new Date(YEAR, MONTH + 1, 0).getDate()
const MONTH_NAME = NOW.toLocaleDateString('en-US', { month: 'long' })
const MONTH_SHORT = NOW.toLocaleDateString('en-US', { month: 'short' })
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']
const keyOf = (day: number) => toKey(new Date(YEAR, MONTH, day))
const dayOf = (key: string) => Number(key.slice(8, 10))

type Exp = NewExpense & { id: string }

let lastId = 0
const withId = (e: NewExpense): Exp => ({ ...e, id: `try-e${++lastId}` })
/** An example expense, spread over the days of the month that have passed so far (day 1–31 is squeezed into 1–today). */
const exp = (day: number, amount: number, name: string, category: string, place = ''): Exp =>
  withId({ date: keyOf(Math.max(1, Math.ceil((day / 31) * TODAY))), amount, name, category, place, notes: '' })

function example(): Exp[] {
  return [
    exp(1, 20_000, 'Tithe', 'other', 'Church'),
    exp(1, 35_000, 'Rent', 'bills'),
    exp(2, 6_200, 'Groceries', 'groceries', 'S&R'),
    exp(3, 280, 'Coffee', 'food', 'Starbucks'),
    exp(5, 3_500, 'Gym', 'health', 'Anytime Fitness'),
    exp(6, 1_850, 'Lunch', 'food', 'Mendokoro Ramenba'),
    exp(8, 420, 'Grab / Taxi', 'transport'),
    exp(9, 8_400, 'Electricity', 'bills', 'Meralco'),
    exp(12, 549, 'Subscriptions', 'fun', 'Netflix'),
    exp(13, 5_600, 'Dinner', 'food', 'Manam'),
    exp(15, 3_200, 'Fuel', 'transport', 'Shell'),
    exp(16, 7_990, 'Shoes', 'shopping', 'Nike Park'),
    exp(20, 5_400, 'Groceries', 'groceries', 'S&R'),
    exp(21, 2_300, 'Night out', 'fun'),
  ]
}

const sum = (list: Exp[]) => list.reduce((s, e) => s + e.amount, 0)
/** A category, or a stand-in for an expense that has none (the category is optional, as in the app). */
const NO_CAT: ExpenseCategory = { id: '', label: 'No category', icon: 'other', color: 'slate', items: [] }
const catOf = (id: string) => DEFAULT_EXPENSE_CATS.find((c) => c.id === id) ?? NO_CAT
const weekday = (key: string) => new Date(YEAR, MONTH, dayOf(key)).getDay()
const dayLabel = (day: number) => new Date(YEAR, MONTH, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function TryExpenses() {
  const [list, setList] = useState<Exp[]>(example)
  const [budget, setBudget] = useState(120_000)
  const [filter, setFilter] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const total = sum(list)
  const avg = total / TODAY
  const biggest = list.reduce<Exp | null>((b, e) => (!b || e.amount > b.amount ? e : b), null)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of list) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [list])
  const byDay = useMemo(() => {
    const d = new Array<number>(DAYS).fill(0)
    for (const e of list) d[dayOf(e.date) - 1] += e.amount
    return d
  }, [list])
  const byWeekday = new Array<number>(7).fill(0)
  for (const e of list) byWeekday[weekday(e.date)] += e.amount
  const topDay = byWeekday.indexOf(Math.max(...byWeekday))
  const shown = (filter ? list.filter((e) => e.category === filter) : list).slice().sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount)

  return (
    <div>
      <Toolbar
        onReset={() => {
          setList(example())
          setBudget(120_000)
          setFilter(null)
        }}
        onClear={() => {
          setList([])
          setBudget(0)
          setFilter(null)
        }}
      />

      {/* Overview */}
      <section className="mt-5 grid gap-6 rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-5 sm:p-6 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
        <div className="min-w-0">
          <p className="text-sm text-zinc-400">Spent in {MONTH_NAME} {YEAR}</p>
          <p key={total} className="animate-tick mt-1 truncate text-4xl font-semibold tracking-tight tabular-nums text-white sm:text-5xl">{money(total)}</p>
          <div className="mt-5">
            <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5 text-zinc-400">
                <Target className="h-3.5 w-3.5" /> Month’s budget
              </span>
              <div className="w-36">
                <MoneyField value={budget} onChange={(v) => setBudget(v ?? 0)} label="Month's budget" />
              </div>
            </div>
            {budget > 0 ? (
              <>
                <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${total > budget ? 'bg-rose-400' : total / budget >= 0.85 ? 'bg-amber-300' : 'bg-brand-400'}`}
                    style={{ width: `${Math.min(100, (total / budget) * 100)}%` }}
                  />
                </div>
                <p className={`mt-1.5 text-xs ${total > budget ? 'text-rose-300' : 'text-zinc-400'}`}>
                  {total > budget ? `${money(total - budget)} over budget` : `${money(budget - total)} left · ${Math.round((total / budget) * 100)}% used`}
                </p>
              </>
            ) : (
              <p className="text-xs text-zinc-500">Set a budget to see how much is left.</p>
            )}
          </div>
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2.5 self-start sm:grid-cols-3 lg:grid-cols-3">
          <Stat k="Daily average" v={money(avg)} sub={`over ${TODAY} day${TODAY > 1 ? "s" : ""} so far`} />
          <Stat k="Expenses" v={String(list.length)} sub={list.length ? `${moneyShort(total / list.length)} each on average` : 'None logged'} />
          <Stat k="Biggest" v={biggest ? money(biggest.amount) : '—'} sub={biggest ? biggest.name || catOf(biggest.category).label : '—'} className="col-span-2 sm:col-span-1" />
        </div>
        {list.length > 1 && (
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4 lg:col-span-2">
            {byCat[0] && (
              <Insight>
                Most went to <b className="font-semibold text-white">{catOf(byCat[0][0]).label}</b> · {Math.round((byCat[0][1] / total) * 100)}%
              </Insight>
            )}
            {byWeekday[topDay] > 0 && (
              <Insight>
                You spend most on <b className="font-semibold text-white">{WEEKDAYS[topDay]}</b>
              </Insight>
            )}
            {biggest && biggest.amount / total > 0.3 && (
              <Insight>
                One expense was <b className="font-semibold text-white">{Math.round((biggest.amount / total) * 100)}%</b> of it all
              </Insight>
            )}
          </div>
        )}
      </section>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.15fr]">
        {/* Log and list */}
        <div className="flex min-w-0 flex-col gap-4">
          <button
            onClick={() => setAdding(true)}
            className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 text-sm font-semibold text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500"
          >
            <Plus className="h-4 w-4" /> Add expense
          </button>
          {adding && (
            <DemoExpenseModal
              today={keyOf(TODAY)}
              min={keyOf(1)}
              max={keyOf(TODAY)}
              past={list}
              onAdd={(e) => setList((l) => [...l, withId(e)])}
              onClose={() => setAdding(false)}
            />
          )}
          <section className="rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-white">
                {filter ? catOf(filter).label : 'Everything'} <span className="font-normal text-zinc-400">· {shown.length}</span>
              </h3>
              {filter && (
                <button onClick={() => setFilter(null)} className="inline-flex h-7 items-center gap-1 rounded-full bg-white/[0.06] px-2.5 text-xs text-zinc-300 hover:text-white">
                  Show all <X className="h-3 w-3" />
                </button>
              )}
            </div>
            <ul className="mt-3 max-h-80 space-y-1 overflow-y-auto pr-1">
              {shown.map((e) => {
                const c = catOf(e.category)
                const Icon = catIcon(c)
                const col = catColor(c)
                return (
                  <li key={e.id} className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]">
                    <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${col.soft} ${col.text}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-white">{e.name || c.label}</span>
                      <span className="flex items-center gap-1 truncate text-xs text-zinc-400">
                        <span className="truncate">{dayLabel(dayOf(e.date))} · {c.label}</span>
                        {e.place && (
                          <span className="inline-flex min-w-0 items-center gap-0.5 truncate">
                            · <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{e.place}</span>
                          </span>
                        )}
                        {e.notes && <StickyNote aria-label={`Note: ${e.notes}`}className="h-3 w-3 shrink-0 text-amber-200/80" />}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-white">{money(e.amount)}</span>
                    <button
                      onClick={() => setList((l) => l.filter((x) => x.id !== e.id))}
                      aria-label={`Delete ${e.name || c.label}, ${money(e.amount)}`}
                      className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                )
              })}
              {!shown.length && <li className="py-8 text-center text-sm text-zinc-500">No expenses yet. Tap Add expense.</li>}
            </ul>
          </section>
        </div>

        {/* Charts */}
        <div className="flex min-w-0 flex-col gap-4">
          <ByDay byDay={byDay} />
          <section className="rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-4 sm:p-5">
            <h3 className="font-semibold text-white">Where it went</h3>
            <ul className="mt-3 space-y-1">
              {byCat.map(([id, v]) => {
                const c = catOf(id)
                const Icon = catIcon(c)
                const col = catColor(c)
                const on = filter === id
                return (
                  <li key={id}>
                    <button
                      onClick={() => setFilter(on ? null : id)}
                      aria-pressed={on}
                      className={`w-full rounded-xl px-2 py-2 text-left transition ${on ? 'bg-white/[0.06] ring-1 ring-inset ring-white/10' : 'hover:bg-white/[0.03]'}`}
                    >
                      <span className="flex items-center gap-2.5 text-sm">
                        <Icon className={`h-4 w-4 shrink-0 ${col.text}`} />
                        <span className="min-w-0 flex-1 truncate text-zinc-200">{c.label}</span>
                        <span className="shrink-0 tabular-nums text-zinc-400">{Math.round((v / total) * 100)}%</span>
                        <span className="w-24 shrink-0 text-right font-semibold tabular-nums text-white">{money(v)}</span>
                      </span>
                      <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                        <span className={`block h-full rounded-full transition-all duration-500 ${col.bar}`} style={{ width: `${(v / byCat[0][1]) * 100}%` }} />
                      </span>
                    </button>
                  </li>
                )
              })}
              {!byCat.length && <li className="py-6 text-center text-sm text-zinc-500">Your categories show up here.</li>}
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}

function Stat({ k, v, sub, className = '' }: { k: string; v: string; sub: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-2xl border border-white/[0.06] bg-white/[0.025] p-3 ${className}`}>
      <p className="truncate text-[11px] uppercase tracking-wider text-zinc-400">{k}</p>
      <p key={v} className="animate-tick mt-1 truncate text-lg font-semibold tabular-nums text-white">{v}</p>
      <p className="truncate text-xs text-zinc-400">{sub}</p>
    </div>
  )
}

function Insight({ children }: { children: ReactNode }) {
  return <span className="rounded-full border border-white/[0.07] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300">{children}</span>
}

function ByDay({ byDay }: { byDay: number[] }) {
  const max = Math.max(1, ...byDay)
  return (
    <section className="rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-4 sm:p-5">
      <h3 className="font-semibold text-white">By day</h3>
      <div className="mt-4 flex h-36 items-end gap-[3px]" role="img" aria-label={`Spending by day in ${MONTH_NAME}; the most was ${money(max)} in one day`}>
        {byDay.map((v, i) => (
          <span
            key={i}
            title={`${dayLabel(i + 1)}: ${money(v)}`}
            className={`flex-1 rounded-t-[3px] transition-all duration-500 ${v ? 'bg-brand-400 hover:bg-brand-300' : i < TODAY ? 'bg-white/[0.06]' : 'bg-white/[0.025]'}`}
            style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : '3px' }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-zinc-400">
        <span>{MONTH_SHORT} 1</span>
        <span>{MONTH_SHORT} 15</span>
        <span>{MONTH_SHORT} {DAYS}</span>
      </div>
    </section>
  )
}
