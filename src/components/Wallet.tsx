import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowRight, ArrowUpRight, ChevronDown, Minus, PiggyBank, Plus, Receipt, Scale, TrendingDown, TrendingUp, Wallet as WalletIcon, X,
} from 'lucide-react'
import { useAlt, useFmt, useStore } from '../store'
import { addDays, dayLabel, todayKey } from '../lib/expenses'
import {
  MAX_WALLET_NOTE, STARTER_OUTS, STARTER_SOURCES, addEntry, balanceByDay, dailySpend, pastNotes, removeEntry, restoreEntry, round, walletState,
  type Move, type WalletEntry,
} from '../lib/wallet'
import { card } from './Dashboard'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { toast } from '../toast'

type Mode = 'add' | 'out' | 'set'
export const openWallet = (mode: Mode) => useStore.getState().openModal({ type: 'wallet', mode })

/** Money on hand right now (null = never set), kept in step with Expenses. */
export function useWallet(today = todayKey()) {
  const wallet = useStore((s) => s.wallet)
  const expenses = useStore((s) => s.expenses)
  return useMemo(() => walletState(wallet, expenses, today), [wallet, expenses, today])
}

/** The number glides to its new value instead of jumping (skipped with reduced motion / calm mode). */
function useGlide(target: number) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    const calm = document.documentElement.hasAttribute('data-calm') || matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = from.current
    if (calm || start === target) {
      from.current = target
      return setShown(target)
    }
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 700)
      const v = start + (target - start) * (1 - Math.pow(1 - p, 3))
      from.current = v
      setShown(p < 1 ? v : target)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [target])
  return shown
}

// ---- The card on the Expenses page ----

export function WalletCard() {
  const today = todayKey()
  const state = useWallet(today)
  return state ? <Tracker state={state} today={today} /> : <Start />
}

/** Never set: ask how much there is now. */
function Start() {
  const [amount, setAmount] = useState<number | null>(null)
  const f = useFmt()
  function start() {
    if (amount === null) return toast.error('Type how much money you have right now (0 is fine).')
    useStore.getState().changeWallet((w) => addEntry(w, 'set', amount).wallet)
    toast.success(`Tracking ${f(amount)} on hand. Expenses you log from now on come off it.`)
  }
  return (
    <section id="wallet" className={`${card} relative overflow-hidden p-4 sm:p-6`}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20">
            <WalletIcon className="h-5 w-5 text-white" strokeWidth={2.4} />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-white">Track the money you have right now</h3>
            <p className="mt-0.5 text-sm text-zinc-400">
              Count your cash and what’s in your accounts. Every expense you log takes it down, and you can add money whenever some comes in.
            </p>
          </div>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault()
            start()
          }}
          className="flex w-full gap-2 lg:w-auto"
        >
          <div className="min-w-0 flex-1 lg:w-48">
            <MoneyInput value={amount} nullable onChange={setAmount} placeholder="0" ariaLabel="Money you have now" size="md" />
          </div>
          <button className="h-12 shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110">
            Start tracking
          </button>
        </form>
      </div>
    </section>
  )
}

type State = NonNullable<ReturnType<typeof walletState>>

function Tracker({ state, today }: { state: State; today: string }) {
  const f = useFmt()
  const u = useAlt()
  const shown = useGlide(state.balance)
  const [activity, setActivity] = useState(false)
  const negative = state.balance < 0

  const stats = useMemo(() => {
    const spentToday = state.moves.reduce((n, m) => (m.kind === 'expense' && m.date === today ? n + m.amount : n), 0)
    const weekFrom = addDays(today, -6)
    let inWeek = 0
    let outWeek = 0
    for (const m of state.moves) {
      if (m.date < weekFrom) continue
      if (m.kind === 'add') inWeek += m.amount
      else outWeek += m.amount
    }
    const perDay = dailySpend(state, today)
    const lasts = perDay > 0 && state.balance > 0 ? Math.floor(state.balance / perDay) : null
    return { spentToday, inWeek, outWeek, perDay, lasts }
  }, [state, today])

  const since = state.set.date === today ? 'today' : dayLabel(state.set.date, today).replace(/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), /, '')

  return (
    <section id="wallet" aria-label="Money on hand" className={`${card} relative overflow-hidden`}>
      <div aria-hidden className={`pointer-events-none absolute -right-16 -top-24 h-56 w-96 rounded-full blur-3xl transition-colors duration-700 ${negative ? 'bg-rose-500/12' : 'bg-emerald-500/12'}`} />
      <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br ${negative ? 'from-rose-400 to-orange-500' : 'from-emerald-400 to-teal-500'} shadow-md`}>
              <WalletIcon className="h-4 w-4 text-white" strokeWidth={2.4} />
            </span>
            <h3 className="text-sm font-semibold text-zinc-200">Money on hand</h3>
            <span title="Updates by itself as you log expenses" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
          </div>

          <p className={`mt-3 break-all text-4xl font-bold tabular-nums tracking-tight sm:text-5xl ${negative ? 'text-rose-300' : 'text-white'}`} aria-live="polite">
            {f(round(shown))}
          </p>
          <p className="alt mt-0.5 text-sm tabular-nums text-zinc-500">≈ {u(state.balance)}</p>

          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-500">
            <span>
              Set to <b className="font-semibold text-zinc-300">{f(state.set.amount)}</b> {since === 'today' ? 'today' : `on ${since}`}
            </span>
            {state.added > 0 && <span className="text-emerald-300/90">+{f(state.added)} added</span>}
            {state.spent > 0 && <span className="text-rose-300/90">−{f(state.spent)} spent</span>}
            {state.out > 0 && <span className="text-sky-300/90">−{f(state.out)} taken out</span>}
          </p>

          {negative && (
            <p className="animate-fade mt-3 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-100/90">
              You’ve logged more spending than you had. Add the money that came in, or set the amount again after counting.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => openWallet('add')}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Add money
            </button>
            <button
              onClick={() => openWallet('out')}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
            >
              <Minus className="h-4 w-4" /> Take out
            </button>
            <button
              onClick={() => openWallet('set')}
              title="Counted your money? Set the real amount"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
            >
              <Scale className="h-4 w-4" /> Set amount
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <Spark state={state} today={today} />
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Spent today" value={f(stats.spentToday, true)} tone={stats.spentToday ? 'text-rose-200' : 'text-zinc-300'} />
            <Mini
              label="Last 7 days"
              value={`${stats.inWeek - stats.outWeek >= 0 ? '+' : '−'}${f(Math.abs(stats.inWeek - stats.outWeek), true)}`}
              tone={stats.inWeek - stats.outWeek >= 0 ? 'text-emerald-200' : 'text-rose-200'}
              title={`${f(stats.inWeek)} in · ${f(stats.outWeek)} out`}
            />
            <Mini
              label="Lasts about"
              value={stats.lasts === null ? '—' : stats.lasts > 365 ? '1 yr+' : `${stats.lasts} day${stats.lasts === 1 ? '' : 's'}`}
              tone={stats.lasts !== null && stats.lasts < 7 ? 'text-amber-200' : 'text-zinc-200'}
              title={stats.perDay > 0 ? `At ${f(stats.perDay)} a day, your average lately` : 'Log some spending to see how long it lasts'}
            />
          </div>
        </div>
      </div>

      {/* Activity since it was set */}
      <div className="relative border-t border-white/[0.06]">
        <button
          onClick={() => setActivity((o) => !o)}
          aria-expanded={activity}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-300 transition hover:bg-white/[0.02] sm:px-6"
        >
          Activity {since === 'today' ? 'today' : `since ${since}`}
          <span className="rounded-full bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-zinc-400">{state.moves.length + 1}</span>
          <ChevronDown className={`ml-auto h-4 w-4 text-zinc-500 transition-transform duration-200 ${activity ? 'rotate-180' : ''}`} />
        </button>
        <div className={`grid transition-all duration-300 ease-out ${activity ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!activity}>
          <div className="min-h-0 overflow-hidden">
            <Activity state={state} today={today} />
          </div>
        </div>
      </div>
    </section>
  )
}

function Mini({ label, value, tone, title }: { label: string; value: string; tone: string; title?: string }) {
  return (
    <div title={title} className="rounded-xl border border-white/[0.06] bg-black/20 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-semibold tabular-nums ${tone}`}>{value}</p>
    </div>
  )
}

/** The balance over the last 30 days (or since it was set). Hover / touch to read a day. */
function Spark({ state, today }: { state: State; today: string }) {
  const f = useFmt()
  const points = useMemo(() => balanceByDay(state, today), [state, today])
  const [at, setAt] = useState<number | null>(null)
  const W = 300
  const H = 84
  const PAD = 6
  const values = points.map((p) => p.balance)
  const min = Math.min(0, ...values)
  const max = Math.max(...values, min + 1)
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.balance).toFixed(1)}`).join(' ')
  const area = `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  const last = points[points.length - 1]
  const first = points[0]
  const up = last.balance >= first.balance
  const pick = at === null ? null : points[at]

  function move(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect()
    const rel = ((clientX - r.left) / r.width) * W
    setAt(Math.max(0, Math.min(points.length - 1, Math.round(((rel - PAD) / (W - PAD * 2)) * (points.length - 1)))))
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-500">{pick ? dayLabel(pick.day, today) : points.length > 1 ? `Last ${points.length} days` : 'Today'}</span>
        <span className={`inline-flex items-center gap-1 font-medium tabular-nums ${pick ? 'text-zinc-200' : up ? 'text-emerald-300' : 'text-rose-300'}`}>
          {pick ? f(pick.balance) : (
            <>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? '+' : '−'}
              {f(Math.abs(last.balance - first.balance), true)}
            </>
          )}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1.5 h-20 w-full touch-none"
        role="img"
        aria-label={`Money on hand over the last ${points.length} days, from ${f(first.balance)} to ${f(last.balance)}`}
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerDown={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={() => setAt(null)}
      >
        <defs>
          <linearGradient id="wallet-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0.35" />
            <stop offset="100%" stopColor={up ? '#34d399' : '#fb7185'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill="url(#wallet-fill)" />
        <path d={line} fill="none" stroke={up ? '#34d399' : '#fb7185'} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pick && at !== null && (
          <>
            <line x1={x(at)} x2={x(at)} y1="0" y2={H} stroke="rgba(255,255,255,0.25)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(at)} cy={y(pick.balance)} r="3.5" fill="#fff" />
          </>
        )}
      </svg>
    </div>
  )
}

const MOVE_LOOK: Record<Move['kind'], { icon: typeof Plus; tone: string; chip: string; sign: string }> = {
  add: { icon: ArrowDownLeft, tone: 'text-emerald-300', chip: 'bg-emerald-500/15 text-emerald-300', sign: '+' },
  out: { icon: PiggyBank, tone: 'text-sky-300', chip: 'bg-sky-500/15 text-sky-300', sign: '−' },
  expense: { icon: ArrowUpRight, tone: 'text-rose-300', chip: 'bg-rose-500/15 text-rose-300', sign: '−' },
  set: { icon: Scale, tone: 'text-zinc-200', chip: 'bg-white/10 text-zinc-300', sign: '' },
}

/** Everything since the amount was set, newest first, with the balance after each. */
function Activity({ state, today }: { state: State; today: string }) {
  const f = useFmt()
  const [all, setAll] = useState(false)
  const rows = useMemo(() => {
    let bal = state.set.amount
    const out: { move: Move; after: number }[] = [{ move: { id: state.set.id, kind: 'set', amount: state.set.amount, label: state.set.note, date: state.set.date, at: state.set.at }, after: bal }]
    for (const m of state.moves) {
      bal += m.kind === 'add' ? m.amount : -m.amount
      out.push({ move: m, after: round(bal) })
    }
    return out.reverse()
  }, [state])
  const shown = all ? rows : rows.slice(0, 6)

  function remove(m: Move) {
    const w = useStore.getState().wallet
    const entry = w.entries.find((e) => e.id === m.id) as WalletEntry | undefined
    if (!entry) return
    useStore.getState().changeWallet((x) => removeEntry(x, entry.id))
    toast.undo(`Removed ${m.kind === 'add' ? 'added' : 'taken out'} ${f(m.amount)}.`, () => useStore.getState().changeWallet((x) => restoreEntry(x, entry)))
  }

  return (
    <div className="px-2 pb-3 sm:px-4">
      <ul className="space-y-0.5">
        {shown.map(({ move: m, after }) => {
          const look = MOVE_LOOK[m.kind]
          const label = m.kind === 'set' ? 'Set the amount' : m.label || (m.kind === 'add' ? 'Money added' : m.kind === 'out' ? 'Taken out' : 'Expense')
          const body = (
            <>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${look.chip}`}>
                {m.kind === 'expense' ? <Receipt className="h-4 w-4" /> : <look.icon className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{label}</span>
                <span className="block text-[11px] text-zinc-500">
                  {dayLabel(m.date, today)}
                  {m.kind === 'expense' && ' · from Expenses'}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block text-sm font-semibold tabular-nums ${look.tone}`}>
                  {look.sign}
                  {f(m.amount)}
                </span>
                <span className="block text-[11px] tabular-nums text-zinc-500">{f(after)} left</span>
              </span>
            </>
          )
          return (
            <li key={`${m.kind}-${m.id}`} className="group relative">
              {m.kind === 'expense' ? (
                <button
                  onClick={() => useStore.getState().openModal({ type: 'expense', editId: m.expenseId })}
                  className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04]"
                  title="Open this expense"
                >
                  {body}
                </button>
              ) : (
                <div className="flex items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-white/[0.03]">
                  {body}
                  {m.kind !== 'set' && (
                    <button
                      onClick={() => remove(m)}
                      aria-label={`Remove ${label}`}
                      title="Remove"
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
      {rows.length > 6 && (
        <button onClick={() => setAll((a) => !a)} className="mt-1 w-full rounded-xl py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
          {all ? 'Show less' : `Show all ${rows.length}`}
        </button>
      )}
    </div>
  )
}

// ---- The dialog: add, take out, or set ----

const QUICK = [100, 500, 1000, 5000]
const TABS: { id: Mode; label: string; icon: typeof Plus }[] = [
  { id: 'add', label: 'Add', icon: Plus },
  { id: 'out', label: 'Take out', icon: Minus },
  { id: 'set', label: 'Set amount', icon: Scale },
]

export function WalletModal({ mode: startMode }: { mode: Mode }) {
  const close = useStore((s) => s.closeModal)
  const f = useFmt()
  const today = todayKey()
  const state = useWallet(today)
  const wallet = useStore((s) => s.wallet)
  const [mode, setMode] = useState<Mode>(state ? startMode : 'set')
  const [amount, setAmount] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [key, setKey] = useState(0)
  const box = useRef<HTMLDivElement>(null)
  const now = state?.balance ?? 0

  const after = amount === null ? null : mode === 'add' ? round(now + amount) : mode === 'out' ? round(now - amount) : amount
  const ok = amount !== null && (mode === 'set' || amount > 0)

  const notes = useMemo(() => {
    if (mode === 'set') return []
    const past = pastNotes(wallet, mode)
    const starters = (mode === 'add' ? STARTER_SOURCES : STARTER_OUTS).filter((s) => !past.some((p) => p.toLowerCase() === s.toLowerCase()))
    return [...past, ...starters].slice(0, 8)
  }, [wallet, mode])

  function switchTo(m: Mode) {
    setMode(m)
    setAmount(null)
    setNote('')
    setKey((k) => k + 1)
    requestAnimationFrame(() => box.current?.querySelector('input')?.focus())
  }

  function save() {
    if (!ok) {
      box.current?.querySelector('input')?.focus()
      return toast.error(mode === 'set' ? 'Type how much you have right now.' : 'Type an amount.')
    }
    const s = useStore.getState()
    let entry: WalletEntry | null = null
    s.changeWallet((w) => {
      const r = addEntry(w, mode, amount!, note, mode === 'set' ? today : date)
      entry = r.entry
      return r.wallet
    })
    const added = entry as WalletEntry | null
    close()
    const msg =
      mode === 'add'
        ? `Added ${f(amount!)}${note.trim() ? ` · ${note.trim()}` : ''}. You have ${f(after!)} now.`
        : mode === 'out'
          ? `Took out ${f(amount!)}${note.trim() ? ` · ${note.trim()}` : ''}. ${f(after!)} left.`
          : `Money on hand set to ${f(amount!)}.`
    if (added) toast.undo(msg, () => useStore.getState().changeWallet((w) => removeEntry(w, added.id)))
  }

  const titles: Record<Mode, string> = { add: 'Add money', out: 'Take money out', set: 'How much do you have now?' }
  const subtitles: Record<Mode, string> = {
    add: 'Allowance, salary, a gift… anything that came in.',
    out: 'Money that left but isn’t spending: into savings, lent, deposited.',
    set: state ? 'Counted your cash and accounts? Put the real total: it replaces what’s tracked.' : 'Count your cash and what’s in your accounts.',
  }
  const accent = mode === 'add' ? 'from-emerald-500 to-teal-500 shadow-emerald-500/20' : mode === 'out' ? 'from-sky-500 to-indigo-500 shadow-sky-500/20' : 'from-indigo-500 to-indigo-400 shadow-indigo-500/20'

  return (
    <Modal
      title={titles[mode]}
      subtitle={subtitles[mode]}
      onClose={close}
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={close} className="h-11 rounded-xl px-4 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white sm:h-10">
            Cancel
          </button>
          <button
            onClick={save}
            className={`h-11 rounded-xl bg-gradient-to-r px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 sm:h-10 ${accent} ${ok ? '' : 'opacity-50 shadow-none'}`}
          >
            {mode === 'add' ? 'Add money' : mode === 'out' ? 'Take out' : 'Set amount'}
          </button>
        </div>
      }
    >
      <div className="space-y-5" onKeyDown={(e) => e.key === 'Enter' && !(e.target as HTMLElement).closest('button') && save()}>
        {state && (
          <div role="tablist" aria-label="What to do" className="grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {TABS.map((t) => (
              <button
                key={t.id}
                role="tab"
                aria-selected={mode === t.id}
                onClick={() => switchTo(t.id)}
                className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition ${mode === t.id ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>
        )}

        <div ref={box}>
          <MoneyInput key={`${mode}-${key}`} value={amount} nullable onChange={setAmount} size="md" placeholder={mode === 'set' && state ? String(Math.max(0, now)) : '0'} autoFocus ariaLabel={titles[mode]} />
          {mode !== 'set' ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {QUICK.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => setAmount(round((amount ?? 0) + q))}
                  className="h-8 rounded-full border border-white/10 px-3 text-xs font-medium tabular-nums text-zinc-300 transition hover:border-white/25 hover:text-white active:scale-95"
                >
                  +{f(q)}
                </button>
              ))}
              {amount !== null && (
                <button type="button" onClick={() => (setAmount(null), setKey((k) => k + 1))} className="h-8 rounded-full px-2.5 text-xs text-zinc-500 transition hover:text-zinc-200">
                  Clear
                </button>
              )}
            </div>
          ) : (
            state && (
              <button type="button" onClick={() => (setAmount(Math.max(0, now)), setKey((k) => k + 1))} className="mt-2 text-xs text-zinc-500 transition hover:text-zinc-200">
                Tracked now: <span className="font-medium tabular-nums text-zinc-300">{f(now)}</span> · tap to use
              </button>
            )
          )}
        </div>

        {mode !== 'set' && (
          <>
            <Field label={mode === 'add' ? 'From' : 'Where to'}>
              <input
                value={note}
                maxLength={MAX_WALLET_NOTE}
                onChange={(e) => setNote(e.target.value)}
                placeholder={mode === 'add' ? 'e.g. Allowance, Salary' : 'e.g. Savings, Lent to Ana'}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {notes.map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setNote(n)}
                    aria-pressed={note.toLowerCase() === n.toLowerCase()}
                    className={`h-8 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
                      note.toLowerCase() === n.toLowerCase() ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </Field>
            <Field label="When">
              <div className="flex gap-1.5">
                {[
                  ['Today', today],
                  ['Yesterday', addDays(today, -1)],
                  ['2 days ago', addDays(today, -2)],
                ].map(([label, d]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDate(d)}
                    aria-pressed={date === d}
                    disabled={!!state && d < state.set.date}
                    title={state && d < state.set.date ? 'Before you last set the amount, so it’s already counted' : undefined}
                    className={`h-9 rounded-full border px-3 text-sm font-medium transition active:scale-95 disabled:opacity-30 ${
                      date === d ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </Field>
          </>
        )}

        {/* What it will be */}
        <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] text-zinc-500">Now</p>
            <p className={`truncate text-base font-semibold tabular-nums ${now < 0 ? 'text-rose-300' : 'text-zinc-300'}`}>{state ? f(now) : '—'}</p>
          </div>
          <ArrowRight className="h-4 w-4 shrink-0 text-zinc-600" />
          <div className="min-w-0 text-right">
            <p className="text-[11px] text-zinc-500">After</p>
            <p key={after ?? 'x'} className={`animate-tick truncate text-xl font-bold tabular-nums ${after === null ? 'text-zinc-600' : after < 0 ? 'text-rose-300' : 'text-white'}`}>
              {after === null ? '—' : f(after)}
            </p>
          </div>
        </div>
        {mode === 'set' && state && amount !== null && amount !== now && (
          <p className="animate-fade -mt-2 text-center text-xs text-zinc-500">
            {amount > now ? `${f(round(amount - now))} more than tracked` : `${f(round(now - amount))} less than tracked: maybe something wasn’t logged`}
          </p>
        )}
      </div>
    </Modal>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-zinc-400">
        {label} <span className="font-normal text-zinc-600">optional</span>
      </p>
      {children}
    </div>
  )
}
