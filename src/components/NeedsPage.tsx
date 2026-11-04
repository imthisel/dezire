import { useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Gauge, Pencil, Plus, ReceiptText, ShoppingBasket, Trash2 } from 'lucide-react'
import { useFmt, useStore } from '../store'
import { useExpenseCats } from '../expenseHooks'
import { MASK, plain } from '../lib/money'
import { MAX_CAT_NAME, MAX_DATE, MIN_DATE, catColor, catIcon, dayLabel, fromKey, inPeriod, periodDays, periodLabel, periodOf, shiftPeriod, todayKey, type Period } from '../lib/expenses'
import { MONTHS_SHORT } from '../lib/time'
import { budgetOf, monthBudget, monthFromNeeds, needsIn, paceOf, spentByCat, spentOnNeeds, weekBudget, weekFromNeeds, type Pace } from '../lib/needs'
import type { NeedRhythm } from '../lib/types'
import { goTo } from '../nav'
import { card } from './Dashboard'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { toast } from '../toast'

/** The plan in the mode in use, without needs whose category has since been deleted (their budgets shouldn't count). */
function useNeeds() {
  const raw = useStore((s) => s.modes.find((m) => m.id === s.modeId)?.needs)
  const cats = useExpenseCats()
  return useMemo(() => raw && { ...raw, cats: raw.cats.filter((id) => cats.some((c) => c.id === id)) }, [raw, cats])
}

const addSpending = (category?: string) => useStore.getState().openModal({ type: 'expense', category })

/** A Needs mode's main page: this week and this month against your own budgets, need by need. */
export function NeedsPage() {
  const plan = useNeeds()
  const cats = useExpenseCats()
  const expenses = useStore((s) => s.expenses)
  const modeName = useStore((s) => s.modes.find((m) => m.id === s.modeId)?.name ?? 'Needs')
  const f = useFmt()
  const today = todayKey()
  const [week, setWeek] = useState(() => periodOf('week', today))
  const [month, setMonth] = useState(() => periodOf('month', today))
  const [picking, setPicking] = useState(false)
  const hasBudgets = !!plan && (plan.weekly > 0 || plan.monthly > 0 || plan.cats.some((id) => budgetOf(plan, id).amount > 0))
  const [editing, setEditing] = useState(!hasBudgets)

  const weekSpent = useMemo(() => spentByCat(expenses, week), [expenses, week])
  const monthSpent = useMemo(() => spentByCat(expenses, month), [expenses, month])
  if (!plan) return null

  const needs = needsIn(plan, cats)
  const weekly = needs.filter((n) => n.rhythm === 'week')
  const monthly = needs.filter((n) => n.rhythm === 'month')
  const setNeeds = useStore.getState().setNeeds

  // Spending this month outside the needs, so it's clear what isn't being counted.
  const counted = new Set(plan.cats)
  const elsewhere = [...monthSpent].reduce((n, [id, v]) => (counted.has(id) ? n : n + v), 0)

  const recent = expenses
    .filter((e) => counted.has(e.category) && inPeriod(e.date, month))
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, 6)

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className={`${card} relative overflow-hidden border-emerald-400/20 bg-gradient-to-br from-emerald-500/[0.1] to-teal-500/[0.03] p-4 sm:p-6`}>
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20">
            <ShoppingBasket className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1 basis-40">
            <p className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-emerald-200">Needs</span>
              <span className="truncate text-sm text-zinc-400">{modeName}</span>
            </p>
            <h2 className="mt-1 text-xl font-bold tracking-tight text-white sm:text-2xl">Your everyday budget</h2>
          </div>
          <button
            onClick={() => addSpending()}
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-4 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Add spending
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <PeriodCard
          label="week"
          period={week}
          onMove={(by) => setWeek((p) => shiftPeriod(p, by))}
          onNow={() => setWeek(periodOf('week', today))}
          spent={spentOnNeeds(plan, cats, weekSpent, 'week')}
          budget={weekBudget(plan)}
          own={plan.weekly}
          fromNeeds={weekFromNeeds(plan)}
          onBudget={(weekly) => setNeeds({ weekly })}
          counts={weekly.length ? `Counts your weekly needs: ${weekly.map((n) => n.cat.label).join(', ')}.` : 'No weekly needs yet. Set one below to “Every week”.'}
        />
        <PeriodCard
          label="month"
          period={month}
          onMove={(by) => setMonth((p) => shiftPeriod(p, by))}
          onNow={() => setMonth(periodOf('month', today))}
          spent={spentOnNeeds(plan, cats, monthSpent)}
          budget={monthBudget(plan, month)}
          own={plan.monthly}
          fromNeeds={monthFromNeeds(plan, month)}
          onBudget={(monthly) => setNeeds({ monthly })}
          counts="Counts all your needs, weekly ones too."
        />
      </div>

      <section className={`${card} overflow-hidden`}>
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.07] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h3 className="font-semibold text-white">Your needs</h3>
            <p className="text-[13px] text-zinc-500">{editing ? 'Set a budget for each one, and whether it runs weekly or monthly.' : 'Each one follows the week and month shown above.'}</p>
          </div>
          <div className="flex shrink-0 gap-2">
            <button onClick={() => setPicking(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[13px] font-medium text-zinc-200 transition hover:bg-white/5">
              <Plus className="h-3.5 w-3.5" /> Add a need
            </button>
            <button
              onClick={() => setEditing((e) => !e)}
              aria-pressed={editing}
              className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[13px] font-medium transition ${editing ? 'border-emerald-400/40 bg-emerald-400/10 text-emerald-100' : 'border-white/10 text-zinc-200 hover:bg-white/5'}`}
            >
              <Pencil className="h-3.5 w-3.5" /> {editing ? 'Done' : 'Edit budgets'}
            </button>
          </div>
        </div>
        {needs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm text-zinc-400">No needs yet. Add groceries, transport, bills, or whatever you can’t go without.</p>
            <button onClick={() => setPicking(true)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[13px] font-medium text-zinc-200 transition hover:bg-white/5">
              <Plus className="h-3.5 w-3.5" /> Add a need
            </button>
          </div>
        ) : (
          <>
            <NeedGroup title="Every week" list={weekly} when={periodLabel(week)} spent={weekSpent} editing={editing} />
            <NeedGroup title="Every month" list={monthly} when={periodLabel(month)} spent={monthSpent} editing={editing} />
          </>
        )}
      </section>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-5">
        <section className={`${card} min-w-0 p-4 sm:p-5 lg:col-span-3`}>
          <History />
        </section>
        <section className={`${card} min-w-0 p-4 sm:p-5 lg:col-span-2`}>
          <div className="flex items-center justify-between gap-2">
            <h3 className="font-semibold text-white">Latest in {MONTHS_SHORT[fromKey(month.start).getMonth()]}</h3>
            <button onClick={() => goTo('expenses')} className="text-xs font-medium text-zinc-400 transition hover:text-white">
              See all in Expenses
            </button>
          </div>
          {recent.length === 0 ? (
            <p className="mt-6 pb-4 text-center text-sm text-zinc-500">Nothing spent on your needs in this month yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/[0.06]">
              {recent.map((e) => {
                const cat = cats.find((c) => c.id === e.category)
                const Icon = cat ? catIcon(cat) : ReceiptText
                return (
                  <li key={e.id}>
                    <button onClick={() => useStore.getState().openModal({ type: 'expense', editId: e.id })} className="flex w-full items-center gap-3 py-2.5 text-left transition hover:opacity-80">
                      <Icon className={`h-4 w-4 shrink-0 ${cat ? catColor(cat).text : 'text-zinc-500'}`} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-zinc-100">{e.name || cat?.label}</span>
                        <span className="block truncate text-xs text-zinc-500">{dayLabel(e.date)}</span>
                      </span>
                      <span className="shrink-0 text-sm font-medium tabular-nums text-zinc-200">{f(e.amount)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {elsewhere > 0 && (
            <p className="mt-3 border-t border-white/[0.06] pt-3 text-xs leading-relaxed text-zinc-500">
              {f(elsewhere)} more this month went to things outside your needs, so it isn’t counted here.
            </p>
          )}
        </section>
      </div>

      {picking && <NeedsPicker onClose={() => setPicking(false)} />}
    </div>
  )
}

const PACE: Record<Exclude<Pace, 'none'>, { label: string; cls: string; icon: typeof Gauge; bar: string }> = {
  good: { label: 'On track', cls: 'text-emerald-300', icon: CheckCircle2, bar: 'bg-emerald-400' },
  fast: { label: 'Spending fast', cls: 'text-amber-300', icon: Gauge, bar: 'bg-amber-400' },
  over: { label: 'Over budget', cls: 'text-rose-300', icon: AlertTriangle, bar: 'bg-rose-400' },
}

/** How much of the period has gone by, 0–1. Past periods are finished; future ones haven't started. */
function elapsedOf(p: Period, today: string) {
  if (today > p.end) return 1
  if (today < p.start) return 0
  return (Math.round((fromKey(today).getTime() - fromKey(p.start).getTime()) / 86400000) + 1) / periodDays(p)
}

function PeriodCard({ label, period, onMove, onNow, spent, budget, own, fromNeeds, onBudget, counts }: {
  label: 'week' | 'month'
  period: Period
  onMove: (by: number) => void
  onNow: () => void
  spent: number
  budget: number
  own: number
  fromNeeds: number
  onBudget: (v: number) => void
  counts: string
}) {
  const f = useFmt()
  const masked = useStore((s) => s.device.masked)
  const today = todayKey()
  const isNow = inPeriod(today, period)
  const elapsed = elapsedOf(period, today)
  const pace = paceOf(spent, budget, elapsed)
  const st = pace === 'none' ? null : PACE[pace]
  const left = budget - spent
  const daysLeft = isNow ? periodDays(period) - Math.round(elapsed * periodDays(period)) + 1 : 0
  const canPrev = shiftPeriod(period, -1).end >= MIN_DATE
  const canNext = shiftPeriod(period, 1).start <= MAX_DATE
  const title = label === 'week' ? 'Weekly budget' : 'Monthly budget'

  return (
    <section className={`${card} flex min-w-0 flex-col p-4 sm:p-5`}>
      <div className="flex items-center gap-1">
        <h3 className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-400">
          {isNow ? `This ${label}` : periodLabel(period)}
          {isNow && <span className="ml-1.5 text-zinc-600">· {periodLabel(period)}</span>}
        </h3>
        {!isNow && (
          <button onClick={onNow} className="mr-1 h-8 shrink-0 rounded-lg px-2 text-xs font-medium text-emerald-200 transition hover:bg-emerald-400/10">
            This {label}
          </button>
        )}
        <MoveBtn label={`Previous ${label}`} disabled={!canPrev} onClick={() => onMove(-1)}>
          <ChevronLeft className="h-4 w-4" />
        </MoveBtn>
        <MoveBtn label={`Next ${label}`} disabled={!canNext} onClick={() => onMove(1)}>
          <ChevronRight className="h-4 w-4" />
        </MoveBtn>
      </div>

      <p key={`${period.start}-${spent}`} className="animate-tick mt-2 truncate text-3xl font-bold tracking-tight tabular-nums text-white sm:text-4xl">
        {f(spent)}
      </p>
      <p className="mt-0.5 text-sm text-zinc-500">{budget > 0 ? `spent of ${f(budget)}` : 'spent'}</p>

      <Meter value={spent} max={budget} bar={st?.bar} marker={isNow ? elapsed : undefined} className="mt-3 h-2.5" label={`Spent this ${label}`} />

      {st ? (
        <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px]">
          <span className={`inline-flex items-center gap-1 font-medium ${st.cls}`}>
            <st.icon className="h-3.5 w-3.5" /> {st.label}
          </span>
          <span className="text-zinc-400">
            {left >= 0 ? `${f(left)} left` : `by ${f(-left)}`}
            {left > 0 && isNow && daysLeft > 1 && ` · about ${f(left / daysLeft)} a day`}
          </span>
        </p>
      ) : (
        <p className="mt-2.5 text-[13px] text-zinc-500">Set a budget to see how you’re doing.</p>
      )}

      <div className="mt-auto pt-4">
        <label className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5 border-t border-white/[0.06] pt-3">
          <span className="text-sm font-medium text-zinc-200">{title}</span>
          <MoneyInput
            value={own}
            onChange={(v) => onBudget(v ?? 0)}
            ariaLabel={title}
            placeholder={fromNeeds > 0 ? (masked ? MASK : plain(Math.round(fromNeeds))) : '0'}
            className="w-36"
          />
        </label>
        <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">
          {own > 0 ? 'Your own total.' : fromNeeds > 0 ? 'Added up from your needs. Type your own total to replace it.' : 'Type a total, or set budgets for each need below.'} {counts}
          {isNow && budget > 0 && ' The white mark on the bar is today.'}
        </p>
      </div>
    </section>
  )
}

function MoveBtn({ label, disabled, onClick, children }: { label: string; disabled: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} aria-label={label} title={label} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-30">
      {children}
    </button>
  )
}

/** A filled bar. Past the budget it stays full and takes the warning colour. `marker`: how far through the period today is. */
function Meter({ value, max, bar = 'bg-emerald-400', marker, className, label }: { value: number; max: number; bar?: string; marker?: number; className: string; label: string }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)} className={`relative rounded-full bg-white/[0.08] ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${bar}`} style={{ width: `${pct}%` }} />
      {marker !== undefined && max > 0 && <span title="Today" className="absolute -top-1 -bottom-1 w-0.5 -translate-x-1/2 rounded-full bg-white/70 ring-2 ring-[#0b0c11]" style={{ left: `${marker * 100}%` }} />}
    </div>
  )
}

function NeedGroup({ title, list, when, spent, editing }: { title: string; list: ReturnType<typeof needsIn>; when: string; spent: Map<string, number>; editing: boolean }) {
  if (!list.length) return null
  return (
    <div>
      <p className="flex items-center justify-between gap-2 bg-white/[0.02] px-4 py-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500 sm:px-5">
        <span>{title}</span>
        <span className="truncate font-normal normal-case tracking-normal">{when}</span>
      </p>
      <ul className="divide-y divide-white/[0.06]">
        {list.map((n) => (
          <NeedRow key={n.cat.id} need={n} spent={spent.get(n.cat.id) ?? 0} editing={editing} />
        ))}
      </ul>
    </div>
  )
}

function NeedRow({ need, spent, editing }: { need: ReturnType<typeof needsIn>[number]; spent: number; editing: boolean }) {
  const f = useFmt()
  const { cat, amount, rhythm } = need
  const Icon = catIcon(cat)
  const { setNeedBudget, removeNeed } = useStore.getState()
  const over = amount > 0 && spent > amount
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05]">
        <Icon className={`h-4 w-4 ${catColor(cat).text}`} />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-sm font-medium text-zinc-100">{cat.label}</p>
          <p className="shrink-0 text-[13px] tabular-nums text-zinc-400">
            <span className="font-medium text-zinc-100">{f(spent)}</span>
            {amount > 0 && ` of ${f(amount)}`}
          </p>
        </div>
        {amount > 0 ? (
          <>
            <Meter value={spent} max={amount} bar={over ? 'bg-rose-400' : undefined} className="mt-1.5 h-1.5" label={`${cat.label} spent`} />
            <p className={`mt-1 inline-flex items-center gap-1 text-xs ${over ? 'text-rose-300' : 'text-zinc-500'}`}>
              {over && <AlertTriangle className="h-3 w-3" />}
              {over ? `Over by ${f(spent - amount)}` : `${f(amount - spent)} left`}
            </p>
          </>
        ) : (
          !editing && <p className="mt-0.5 text-xs text-zinc-500">No budget set</p>
        )}
      </div>
      {editing ? (
        <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
          <MoneyInput value={amount} onChange={(v) => setNeedBudget(cat.id, { amount: v ?? 0 })} ariaLabel={`${cat.label} budget`} className="w-28" />
          <div role="radiogroup" aria-label={`${cat.label} runs`} className="inline-flex gap-0.5 rounded-lg border border-white/10 bg-black/20 p-0.5">
            {(['week', 'month'] as NeedRhythm[]).map((r) => (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={rhythm === r}
                onClick={() => setNeedBudget(cat.id, { rhythm: r })}
                className={`h-7 rounded-md px-2 text-xs font-medium transition ${rhythm === r ? 'bg-emerald-400/20 text-emerald-100 ring-1 ring-emerald-400/40' : 'text-zinc-400 hover:text-white'}`}
              >
                {r === 'week' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>
          <button
            onClick={() => {
              const undo = removeNeed(cat.id)
              toast.undo(`Removed “${cat.label}” from your needs. Its expenses stay in Expenses.`, undo)
            }}
            aria-label={`Remove ${cat.label} from your needs`}
            title="Remove from needs"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <button onClick={() => addSpending(cat.id)} aria-label={`Add spending on ${cat.label}`} title={`Add spending on ${cat.label}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 hover:text-white">
          <Plus className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

/** Choose which spending categories are needs, or make a new one. */
function NeedsPicker({ onClose }: { onClose: () => void }) {
  const cats = useExpenseCats()
  const plan = useNeeds()
  const [name, setName] = useState('')
  const { addNeed, removeNeed, addExpenseCat } = useStore.getState()

  function create() {
    if (!name.trim()) return
    addNeed(addExpenseCat(name))
    setName('')
  }

  return (
    <Modal
      title="Your needs"
      subtitle="The things you can’t go without. They’re the same categories you pick when adding an expense."
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end">
          <button onClick={onClose} className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 text-sm font-semibold text-emerald-950">
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-1.5">
        {cats.map((c) => {
          const on = !!plan?.cats.includes(c.id)
          const Icon = catIcon(c)
          return (
            <button
              key={c.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => (on ? removeNeed(c.id) : addNeed(c.id))}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/[0.07] hover:border-white/20'}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${catColor(c).text}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{c.label}</span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[11px] font-bold ${on ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/20 text-transparent'}`}>✓</span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={name}
          maxLength={MAX_CAT_NAME}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          placeholder="Something else, like Rent or Baby"
          aria-label="New need"
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button onClick={create} disabled={!name.trim()} className="h-10 shrink-0 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40">
          Add
        </button>
      </div>
    </Modal>
  )
}

type Span = { key: string; label: string; full: string; spent: number; budget: number; now: boolean }

/** The last few weeks or months against their budget. */
function History() {
  const plan = useNeeds()
  const cats = useExpenseCats()
  const expenses = useStore((s) => s.expenses)
  const f = useFmt()
  const [kind, setKind] = useState<'week' | 'month'>('week')
  const [picked, setPicked] = useState<string | null>(null)
  const today = todayKey()

  const spans = useMemo<Span[]>(() => {
    if (!plan) return []
    const out: Span[] = []
    let p = periodOf(kind, today)
    for (let i = 0; i < (kind === 'week' ? 8 : 6); i++) {
      const d = fromKey(p.start)
      const spent = spentOnNeeds(plan, cats, spentByCat(expenses, p), kind === 'week' ? 'week' : undefined)
      out.unshift({
        key: p.start,
        label: kind === 'week' ? `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}` : MONTHS_SHORT[d.getMonth()],
        full: periodLabel(p),
        spent,
        budget: kind === 'week' ? weekBudget(plan) : monthBudget(plan, p),
        now: i === 0,
      })
      p = shiftPeriod(p, -1)
    }
    return out
  }, [plan, cats, expenses, kind, today])

  // Weeks have one budget; months differ by a few days when it's added up from weekly needs, so the line uses this one's.
  const line = spans[spans.length - 1]?.budget ?? 0
  const top = Math.max(line, ...spans.map((s) => s.spent), 1) * 1.08
  const shown = spans.find((s) => s.key === picked) ?? spans[spans.length - 1]

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-white">{kind === 'week' ? 'Weekly needs' : 'All needs'}, recently</h3>
        <div role="radiogroup" aria-label="Show" className="inline-flex gap-0.5 rounded-lg border border-white/10 bg-black/20 p-0.5">
          {(['week', 'month'] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => {
                setKind(k)
                setPicked(null)
              }}
              className={`h-7 rounded-md px-2.5 text-xs font-medium transition ${kind === k ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              {k === 'week' ? 'Weeks' : 'Months'}
            </button>
          ))}
        </div>
      </div>
      {shown && (
        <p className="mt-2 truncate text-[13px] tabular-nums text-zinc-400" aria-live="polite">
          <span className="text-zinc-300">{shown.full}:</span> <span className="font-medium text-white">{f(shown.spent)}</span>
          {shown.budget > 0 && ` of ${f(shown.budget)}`}
        </p>
      )}
      <div className="relative mt-3 flex h-36 items-end gap-1 sm:gap-1.5" onMouseLeave={() => setPicked(null)}>
        {line > 0 && (
          <div aria-hidden className="pointer-events-none absolute inset-x-0 border-t border-dashed border-white/30" style={{ bottom: `${(line / top) * 100}%` }}>
            <span className="absolute -top-4 left-0 text-[10px] text-zinc-500">budget</span>
          </div>
        )}
        {spans.map((s) => {
          const over = s.budget > 0 && s.spent > s.budget
          return (
            <button
              key={s.key}
              type="button"
              onMouseEnter={() => setPicked(s.key)}
              onFocus={() => setPicked(s.key)}
              onClick={() => setPicked(s.key)}
              aria-label={`${s.full}: ${f(s.spent)}${s.budget > 0 ? ` of ${f(s.budget)}` : ''}${over ? ', over budget' : ''}`}
              className="group flex h-full min-w-0 flex-1 items-end rounded-t outline-none focus-visible:bg-white/5"
            >
              <span
                className={`block w-full rounded-t transition-[height] duration-500 ease-out ${over ? 'bg-rose-400' : 'bg-emerald-400'} ${s.now ? '' : 'opacity-60'} ${picked === s.key ? '!opacity-100' : ''}`}
                style={{ height: `${s.spent > 0 ? Math.max(2, (s.spent / top) * 100) : 0}%` }}
              />
            </button>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1 border-t border-white/[0.08] pt-1.5 sm:gap-1.5" aria-hidden>
        {spans.map((s, i) => (
          // Narrow screens: every other label, counted back from the latest, so they fit in full.
          <span key={s.key} className={`min-w-0 flex-1 whitespace-nowrap text-center text-[10px] tabular-nums ${(spans.length - 1 - i) % 2 ? 'max-sm:invisible' : ''} ${s.now ? 'font-medium text-zinc-200' : 'text-zinc-500'}`}>
            {s.label}
          </span>
        ))}
      </div>
    </>
  )
}
