import { useMemo, useState, type ReactNode } from 'react'
import { Plus, Target, X } from 'lucide-react'
import { DEFAULT_EXPENSE_CATS, catColor, catIcon } from '../../lib/expenses'
import { MoneyField, Toolbar, money, moneyShort } from './TryOverview'

/*
 * A playable copy of Expenses on the About page: one month (March 2027) to log spending in, with the same overview, budget,
 * chart by day and "where it went" breakdown as the app. It lives only in this page's memory: nothing is saved anywhere.
 */

const YEAR = 2027
const MONTH = 2 // March
const DAYS = 31
const MONTH_NAME = 'March'
const WEEKDAYS = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays']

type Exp = { id: string; day: number; amount: number; name: string; category: string }

let lastId = 0
const exp = (day: number, amount: number, name: string, category: string): Exp => ({ id: `try-e${++lastId}`, day, amount, name, category })

function example(): Exp[] {
  return [
    exp(1, 20_000, 'Tithe', 'other'),
    exp(1, 35_000, 'Rent', 'bills'),
    exp(2, 6_200, 'Groceries', 'groceries'),
    exp(3, 280, 'Coffee', 'food'),
    exp(5, 3_500, 'Gym', 'health'),
    exp(6, 1_850, 'Lunch', 'food'),
    exp(8, 420, 'Grab / Taxi', 'transport'),
    exp(9, 8_400, 'Electricity', 'bills'),
    exp(12, 549, 'Subscriptions', 'fun'),
    exp(13, 5_600, 'Dinner', 'food'),
    exp(15, 3_200, 'Fuel', 'transport'),
    exp(16, 7_990, 'Shoes', 'shopping'),
    exp(20, 5_400, 'Groceries', 'groceries'),
    exp(21, 2_300, 'Night out', 'fun'),
  ]
}

const sum = (list: Exp[]) => list.reduce((s, e) => s + e.amount, 0)
const catOf = (id: string) => DEFAULT_EXPENSE_CATS.find((c) => c.id === id) ?? DEFAULT_EXPENSE_CATS[DEFAULT_EXPENSE_CATS.length - 1]
const weekday = (day: number) => new Date(YEAR, MONTH, day).getDay()
const dayLabel = (day: number) => new Date(YEAR, MONTH, day).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })

export function TryExpenses() {
  const [list, setList] = useState<Exp[]>(example)
  const [budget, setBudget] = useState(120_000)
  const [filter, setFilter] = useState<string | null>(null)

  const total = sum(list)
  const avg = total / DAYS
  const biggest = list.reduce<Exp | null>((b, e) => (!b || e.amount > b.amount ? e : b), null)
  const byCat = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of list) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [list])
  const byDay = useMemo(() => {
    const d = new Array<number>(DAYS).fill(0)
    for (const e of list) d[e.day - 1] += e.amount
    return d
  }, [list])
  const byWeekday = new Array<number>(7).fill(0)
  for (const e of list) byWeekday[weekday(e.day)] += e.amount
  const topDay = byWeekday.indexOf(Math.max(...byWeekday))
  const shown = (filter ? list.filter((e) => e.category === filter) : list).slice().sort((a, b) => b.day - a.day || b.amount - a.amount)

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
          <Stat k="Daily average" v={money(avg)} sub={`over ${DAYS} days`} />
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
          <AddExpense onAdd={(e) => setList((l) => [...l, e])} />
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
                      <span className="block truncate text-xs text-zinc-400">
                        {dayLabel(e.day)} · {c.label}
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
              {!shown.length && <li className="py-8 text-center text-sm text-zinc-500">No expenses yet. Add one above.</li>}
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
            className={`flex-1 rounded-t-[3px] transition-all duration-500 ${v ? 'bg-brand-400 hover:bg-brand-300' : 'bg-white/[0.06]'}`}
            style={{ height: v ? `${Math.max(4, (v / max) * 100)}%` : '3px' }}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-[11px] text-zinc-400">
        <span>Mar 1</span>
        <span>Mar 15</span>
        <span>Mar 31</span>
      </div>
    </section>
  )
}

const fieldCls =
  'h-10 w-full min-w-0 rounded-xl border border-white/10 bg-[#0d0e12] px-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-brand-400/70'

function AddExpense({ onAdd }: { onAdd: (e: Exp) => void }) {
  const [amount, setAmount] = useState(0)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('food')
  const [day, setDay] = useState(22)
  const cat = catOf(category)
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (amount <= 0) return
        onAdd(exp(day, amount, name.trim().slice(0, 60), category))
        setAmount(0)
        setName('')
      }}
      className="rounded-[24px] border border-brand-400/25 bg-brand-500/[0.05] p-4 sm:p-5"
    >
      <h3 className="font-semibold text-white">Log an expense</h3>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="col-span-2 sm:col-span-1">
          <MoneyField value={amount} onChange={(v) => setAmount(v ?? 0)} label="Amount" placeholder="Amount" />
        </div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category" className={`${fieldCls} h-9 rounded-lg text-[13px]`}>
          {DEFAULT_EXPENSE_CATS.map((c) => (
            <option key={c.id} value={c.id}>{c.label}</option>
          ))}
        </select>
        <select value={day} onChange={(e) => setDay(Number(e.target.value))} aria-label="Day" className={`${fieldCls} col-span-2 h-9 rounded-lg text-[13px] sm:col-span-1`}>
          {Array.from({ length: DAYS }, (_, i) => (
            <option key={i} value={i + 1}>{dayLabel(i + 1)}</option>
          ))}
        </select>
        <input
          data-plain
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={60}
          placeholder="What was it? (optional)"
          aria-label="What it was"
          className={`${fieldCls} col-span-2 h-9 rounded-lg text-[13px] sm:col-span-1`}
        />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {cat.items.slice(0, 5).map((it) => (
          <button
            type="button"
            key={it}
            onClick={() => setName(it)}
            aria-pressed={name === it}
            className={`rounded-full px-2.5 py-1 text-xs transition ${name === it ? 'bg-brand-500/25 text-white ring-1 ring-inset ring-brand-400/40' : 'bg-white/[0.05] text-zinc-300 hover:text-white'}`}
          >
            {it}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={amount <= 0}
        className="mt-3 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-40"
      >
        <Plus className="h-4 w-4" /> Add expense
      </button>
    </form>
  )
}
