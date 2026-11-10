import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  ArrowDownLeft, ArrowLeftRight, ArrowRight, Banknote, ChevronDown, CreditCard, Landmark, Minus, PiggyBank, Plus, Receipt, Scale, Settings2, Smartphone,
  Trash2, TrendingDown, TrendingUp, Wallet as WalletIcon, X,
} from 'lucide-react'
import { useAlt, useFmt, useStore } from '../store'
import { addDays, dayLabel, todayKey } from '../lib/expenses'
import { KIND_COLORS } from '../lib/meta'
import {
  ACCOUNT_ICONS, MAX_ACCOUNT_NAME, MAX_WALLET_NOTE, STARTER_ACCOUNTS, STARTER_OUTS, STARTER_SOURCES, SUGGESTED_ACCOUNTS, addAccount, addEntry, dailySpend,
  guessAccountIcon, pastNotes, removeAccount, removeEntry, restoreEntry, round, setAmounts, totalByDay, updateAccount, walletState, withTotals,
  type AccountIcon, type Move, type WalletAccount, type WalletEntry, type WalletState,
} from '../lib/wallet'
import { card } from './Dashboard'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { ColorRow } from './SchoolSubjects'
import { toast } from '../toast'

type Mode = 'add' | 'out' | 'move' | 'set'
export const openWallet = (mode: Mode, account?: string) => useStore.getState().openModal({ type: 'wallet', mode, account })

export const ICONS: Record<AccountIcon, typeof Plus> = { cash: Banknote, bank: Landmark, phone: Smartphone, card: CreditCard, piggy: PiggyBank, wallet: WalletIcon }
const colorOf = (a: { color: string }) => KIND_COLORS[a.color] ?? KIND_COLORS.slate

/** Money on hand right now (null = not set up), kept in step with Expenses. */
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

function AccountChip({ account, size = 'md' }: { account: Pick<WalletAccount, 'icon' | 'color'>; size?: 'sm' | 'md' }) {
  const Icon = ICONS[account.icon]
  const c = colorOf(account)
  return (
    <span className={`grid shrink-0 place-items-center rounded-lg ${c.soft} ${c.text} ${size === 'sm' ? 'h-6 w-6' : 'h-8 w-8'}`}>
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
    </span>
  )
}

// ---- The card on the Expenses page ----

export function WalletCard() {
  const today = todayKey()
  const state = useWallet(today)
  return state ? <Tracker state={state} today={today} /> : <Start />
}

/** Not set up yet: how much is in Cash, Bank, and anything else. */
function Start() {
  const f = useFmt()
  const [rows, setRows] = useState(() => STARTER_ACCOUNTS.map((a, i) => ({ key: i, name: a.name, amount: null as number | null })))
  const nextKey = useRef(rows.length)
  const suggestions = SUGGESTED_ACCOUNTS.filter((n) => !rows.some((r) => r.name.trim().toLowerCase() === n.toLowerCase()))

  const addRow = (name: string) => setRows((r) => [...r, { key: nextKey.current++, name, amount: null }])
  const total = rows.reduce((n, r) => n + (r.amount ?? 0), 0)

  function start() {
    const list = rows.filter((r) => r.name.trim())
    if (!list.length) return toast.error('Add at least one place your money is.')
    useStore.getState().changeWallet((w) => {
      let next = w
      for (const r of list) {
        const starter = STARTER_ACCOUNTS.find((a) => a.name.toLowerCase() === r.name.trim().toLowerCase())
        next = addAccount(next, r.name, r.amount ?? 0, starter?.icon, starter?.color).wallet
      }
      return next
    })
    toast.success(`Tracking ${f(total)}. Expenses come off it automatically.`)
  }

  return (
    <section id="wallet" className={`${card} relative overflow-hidden p-4 sm:p-6`}>
      <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-48 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
      <div className="relative flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 shadow-lg shadow-emerald-500/20">
          <WalletIcon className="h-5 w-5 text-white" strokeWidth={2.4} />
        </span>
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-white">Your money</h3>
          <p className="text-sm text-zinc-400">How much is in each? Expenses come off it automatically.</p>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          start()
        }}
        className="relative mt-4 space-y-2"
      >
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const icon = STARTER_ACCOUNTS.find((a) => a.name.toLowerCase() === r.name.trim().toLowerCase())?.icon ?? guessAccountIcon(r.name)
            const Icon = ICONS[icon]
            return (
              <div key={r.key} className="animate-fade flex items-center gap-2 rounded-xl border border-white/[0.08] bg-black/20 p-1.5 pl-2.5">
                <Icon className="h-4 w-4 shrink-0 text-zinc-400" />
                <input
                  value={r.name}
                  maxLength={MAX_ACCOUNT_NAME}
                  onChange={(e) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, name: e.target.value } : x)))}
                  placeholder="Name"
                  aria-label="Account name"
                  className="h-10 w-20 min-w-0 flex-1 bg-transparent text-sm font-medium text-zinc-100 outline-none placeholder:text-zinc-600"
                />
                <div className="w-32 shrink-0">
                  <MoneyInput value={r.amount} nullable onChange={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, amount: v } : x)))} placeholder="0" ariaLabel={`${r.name || 'Account'} amount`} />
                </div>
                {rows.length > 1 && (
                  <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} aria-label={`Remove ${r.name || 'row'}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-zinc-200">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          {suggestions.slice(0, 4).map((n) => (
            <button key={n} type="button" onClick={() => addRow(n)} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-zinc-200">
              <Plus className="h-3 w-3" /> {n}
            </button>
          ))}
          <button type="button" onClick={() => addRow('')} className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-zinc-200">
            <Plus className="h-3 w-3" /> Other
          </button>
          <span className="flex-1" />
          <span className="text-sm tabular-nums text-zinc-400">
            Total <b className="font-semibold text-white">{f(total)}</b>
          </span>
          <button className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110">
            Start tracking
          </button>
        </div>
      </form>
    </section>
  )
}

function Tracker({ state, today }: { state: WalletState; today: string }) {
  const f = useFmt()
  const u = useAlt()
  const shown = useGlide(state.total)
  const [activity, setActivity] = useState(false)
  const [managing, setManaging] = useState(false)
  const negative = state.total < 0

  const stats = useMemo(() => {
    const spentToday = state.moves.reduce((n, m) => (m.kind === 'expense' && m.date === today ? n + m.amount : n), 0)
    const weekFrom = addDays(today, -6)
    let net = 0
    for (const m of state.moves) {
      if (m.date < weekFrom || m.kind === 'set' || m.kind === 'move') continue
      net += m.kind === 'add' ? m.amount : -m.amount
    }
    const perDay = dailySpend(state, today)
    const lasts = perDay > 0 && state.total > 0 ? Math.floor(state.total / perDay) : null
    return { spentToday, net, perDay, lasts }
  }, [state, today])

  return (
    <section id="wallet" aria-label="Your money" className={`${card} relative overflow-hidden`}>
      <div aria-hidden className={`pointer-events-none absolute -right-16 -top-24 h-56 w-96 rounded-full blur-3xl transition-colors duration-700 ${negative ? 'bg-rose-500/10' : 'bg-emerald-500/10'}`} />
      <div className="relative grid gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br shadow-md ${negative ? 'from-rose-400 to-orange-500' : 'from-emerald-400 to-teal-500'}`}>
              <WalletIcon className="h-4 w-4 text-white" strokeWidth={2.4} />
            </span>
            <h3 className="text-sm font-semibold text-zinc-200">Your money</h3>
            <span title="Updates as you log expenses" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
              </span>
              Live
            </span>
            <span className="flex-1" />
            <button
              onClick={() => setManaging(true)}
              title="Edit accounts"
              aria-label="Edit accounts"
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          <p className={`mt-3 break-all text-4xl font-bold tabular-nums tracking-tight sm:text-5xl ${negative ? 'text-rose-300' : 'text-white'}`} aria-live="polite">
            {f(round(shown))}
          </p>
          <p className="alt mt-0.5 text-sm tabular-nums text-zinc-500">≈ {u(state.total)}</p>

          {(state.added > 0 || state.spent > 0 || state.out > 0) && (
            <p className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs">
              {state.added > 0 && <span className="text-emerald-300/90">+{f(state.added)} in</span>}
              {state.spent > 0 && <span className="text-rose-300/90">−{f(state.spent)} spent</span>}
              {state.out > 0 && <span className="text-sky-300/90">−{f(state.out)} out</span>}
              <span className="text-zinc-600">since {state.since === today ? 'today' : dayLabel(state.since, today).replace(/^\w+, /, '')}</span>
            </p>
          )}

          {/* Each account: tap to add money to it */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {state.accounts.map(({ account: a, balance }) => (
              <AccountTile key={a.id} account={a} balance={balance} total={state.total} />
            ))}
            <button
              onClick={() => setManaging(true)}
              className="flex min-h-[4.5rem] items-center justify-center gap-1.5 rounded-xl border border-dashed border-white/10 text-xs font-medium text-zinc-500 transition hover:border-white/25 hover:bg-white/[0.02] hover:text-zinc-200"
            >
              <Plus className="h-3.5 w-3.5" /> Add account
            </button>
          </div>

          {negative && (
            <p className="animate-fade mt-3 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-100/90">
              More spent than you had. Add money or count again.
            </p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => openWallet('add')}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-4 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98]"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Add money
            </button>
            {state.accounts.length > 1 && (
              <button onClick={() => openWallet('move')} title="E.g. withdraw from Bank to Cash" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5">
                <ArrowLeftRight className="h-4 w-4" /> Move
              </button>
            )}
            <button onClick={() => openWallet('out')} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5">
              <Minus className="h-4 w-4" /> Take out
            </button>
            <button onClick={() => openWallet('set')} title="Counted your money? Put the real amounts" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3.5 text-sm font-medium text-zinc-200 transition hover:bg-white/5">
              <Scale className="h-4 w-4" /> Count
            </button>
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <Spark state={state} today={today} />
          <div className="grid grid-cols-3 gap-2">
            <Mini label="Spent today" value={f(stats.spentToday, true)} tone={stats.spentToday ? 'text-rose-200' : 'text-zinc-300'} />
            <Mini label="Last 7 days" value={`${stats.net >= 0 ? '+' : '−'}${f(Math.abs(stats.net), true)}`} tone={stats.net >= 0 ? 'text-emerald-200' : 'text-rose-200'} title="Money in minus money out" />
            <Mini
              label="Lasts about"
              value={stats.lasts === null ? '—' : stats.lasts > 365 ? '1 yr+' : `${stats.lasts} day${stats.lasts === 1 ? '' : 's'}`}
              tone={stats.lasts !== null && stats.lasts < 7 ? 'text-amber-200' : 'text-zinc-200'}
              title={stats.perDay > 0 ? `At ${f(stats.perDay)} a day, your average lately` : 'Log some spending to see'}
            />
          </div>
        </div>
      </div>

      <div className="relative border-t border-white/[0.06]">
        <button
          onClick={() => setActivity((o) => !o)}
          aria-expanded={activity}
          className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-300 transition hover:bg-white/[0.02] sm:px-6"
        >
          Activity
          <span className="rounded-full bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-zinc-400">{state.moves.length}</span>
          <ChevronDown className={`ml-auto h-4 w-4 text-zinc-500 transition-transform duration-200 ${activity ? 'rotate-180' : ''}`} />
        </button>
        <div className={`grid transition-all duration-300 ease-out ${activity ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!activity}>
          <div className="min-h-0 overflow-hidden">
            <Activity state={state} today={today} />
          </div>
        </div>
      </div>

      {managing && <AccountsModal state={state} onClose={() => setManaging(false)} />}
    </section>
  )
}

function AccountTile({ account: a, balance, total }: { account: WalletAccount; balance: number; total: number }) {
  const f = useFmt()
  const c = colorOf(a)
  const share = total > 0 && balance > 0 ? Math.min(100, (balance / total) * 100) : 0
  return (
    <button
      onClick={() => openWallet('add', a.id)}
      title={`Add money to ${a.name}`}
      className="group relative overflow-hidden rounded-xl border border-white/[0.07] bg-black/20 p-2.5 text-left transition hover:border-white/20 hover:bg-white/[0.03] active:scale-[0.98]"
    >
      <span className="flex items-center gap-2">
        <AccountChip account={a} size="sm" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">{a.name}</span>
        <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.06] text-zinc-400 transition group-hover:bg-emerald-500/20 group-hover:text-emerald-200">
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
        </span>
      </span>
      <span className={`mt-1.5 block truncate text-base font-semibold tabular-nums ${balance < 0 ? 'text-rose-300' : 'text-white'}`}>{f(balance)}</span>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.04]">
        <span className={`block h-full ${c.bar} opacity-70 transition-[width] duration-500`} style={{ width: `${share}%` }} />
      </span>
    </button>
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

/** The total over the last 30 days (or since tracking began). Hover / touch to read a day. */
function Spark({ state, today }: { state: WalletState; today: string }) {
  const f = useFmt()
  const points = useMemo(() => totalByDay(state, today), [state, today])
  const [at, setAt] = useState<number | null>(null)
  const W = 300
  const H = 84
  const PAD = 6
  const values = points.map((p) => p.total)
  const min = Math.min(0, ...values)
  const max = Math.max(...values, min + 1)
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2)
  const line = points.length === 1 ? `M${PAD},${y(values[0])} L${W - PAD},${y(values[0])}` : points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')
  const area = points.length === 1 ? `${line} L${W - PAD},${H} L${PAD},${H} Z` : `${line} L${x(points.length - 1).toFixed(1)},${H} L${x(0).toFixed(1)},${H} Z`
  const last = points[points.length - 1]
  const first = points[0]
  const up = last.total >= first.total
  const pick = at === null ? null : points[at]
  const stroke = up ? '#34d399' : '#fb7185'

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
          {pick ? (
            f(pick.total)
          ) : (
            <>
              {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {up ? '+' : '−'}
              {f(Math.abs(last.total - first.total), true)}
            </>
          )}
        </span>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="mt-1.5 h-20 w-full touch-none"
        role="img"
        aria-label={`Your money over the last ${points.length} days, from ${f(first.total)} to ${f(last.total)}`}
        onPointerMove={(e) => move(e.clientX, e.currentTarget)}
        onPointerDown={(e) => move(e.clientX, e.currentTarget)}
        onPointerLeave={() => setAt(null)}
      >
        <defs>
          <linearGradient id="wallet-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.35" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
        <path d={area} fill="url(#wallet-fill)" />
        <path d={line} fill="none" stroke={stroke} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        {pick && at !== null && (
          <>
            <line x1={x(at)} x2={x(at)} y1="0" y2={H} stroke="rgba(255,255,255,0.25)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(at)} cy={y(pick.total)} r="3.5" fill="#fff" />
          </>
        )}
      </svg>
    </div>
  )
}

/** Everything that counted, newest first, with the total after each. */
function Activity({ state, today }: { state: WalletState; today: string }) {
  const f = useFmt()
  const [all, setAll] = useState(false)
  const rows = useMemo(() => withTotals(state), [state])
  const byId = useMemo(() => new Map(state.accounts.map((a) => [a.account.id, a.account])), [state.accounts])
  const shown = all ? rows : rows.slice(0, 6)

  function remove(m: Move) {
    const entry = useStore.getState().wallet.entries.find((e) => e.id === m.id) as WalletEntry | undefined
    if (!entry) return
    useStore.getState().changeWallet((w) => removeEntry(w, entry.id))
    toast.undo(`Removed ${f(m.amount)}.`, () => useStore.getState().changeWallet((w) => restoreEntry(w, entry)))
  }

  return (
    <div className="px-2 pb-3 sm:px-4">
      <ul className="space-y-0.5">
        {shown.map(({ move: m, total }) => {
          const acc = byId.get(m.account || m.to || '')
          const to = m.to ? byId.get(m.to) : undefined
          const label =
            m.kind === 'set'
              ? `${acc?.name ?? 'Account'} set`
              : m.kind === 'move'
                ? `${byId.get(m.account)?.name ?? 'Elsewhere'} → ${to?.name ?? 'elsewhere'}`
                : m.label || (m.kind === 'add' ? 'Money in' : m.kind === 'out' ? 'Taken out' : 'Expense')
          const look =
            m.kind === 'add'
              ? { icon: ArrowDownLeft, chip: 'bg-emerald-500/15 text-emerald-300', tone: 'text-emerald-300', sign: '+' }
              : m.kind === 'expense'
                ? { icon: Receipt, chip: 'bg-rose-500/15 text-rose-300', tone: 'text-rose-300', sign: '−' }
                : m.kind === 'out'
                  ? { icon: Minus, chip: 'bg-sky-500/15 text-sky-300', tone: 'text-sky-300', sign: '−' }
                  : m.kind === 'move'
                    ? { icon: ArrowLeftRight, chip: 'bg-violet-500/15 text-violet-300', tone: 'text-zinc-300', sign: '' }
                    : { icon: Scale, chip: 'bg-white/10 text-zinc-300', tone: 'text-zinc-200', sign: '' }
          const body = (
            <>
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${look.chip}`}>
                <look.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-zinc-100">{label}</span>
                <span className="block truncate text-[11px] text-zinc-500">
                  {dayLabel(m.date, today)}
                  {m.kind !== 'set' && m.kind !== 'move' && acc && ` · ${acc.name}`}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className={`block text-sm font-semibold tabular-nums ${look.tone}`}>
                  {look.sign}
                  {f(m.amount)}
                </span>
                <span className="block text-[11px] tabular-nums text-zinc-500">{f(total)} total</span>
              </span>
            </>
          )
          return (
            <li key={`${m.kind}-${m.id}`} className="group">
              {m.kind === 'expense' ? (
                <button onClick={() => useStore.getState().openModal({ type: 'expense', editId: m.expenseId })} title="Open this expense" className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition hover:bg-white/[0.04]">
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

// ---- Accounts: add, rename, recolour, delete ----

function AccountsModal({ state, onClose }: { state: WalletState; onClose: () => void }) {
  const f = useFmt()
  const accounts = useStore((s) => s.wallet.accounts)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState<number | null>(null)
  const [key, setKey] = useState(0)
  const balanceOf = new Map(state.accounts.map((a) => [a.account.id, a.balance]))
  const change = useStore.getState().changeWallet
  const suggestions = SUGGESTED_ACCOUNTS.filter((n) => !accounts.some((a) => a.name.toLowerCase() === n.toLowerCase()))

  function add(n = name) {
    if (!n.trim()) return
    change((w) => addAccount(w, n, amount ?? 0).wallet)
    toast.success(`Added ${n.trim()}${amount ? ` with ${f(amount)}` : ''}.`)
    setName('')
    setAmount(null)
    setKey((k) => k + 1)
  }

  return (
    <Modal title="Accounts" subtitle="Where your money is." onClose={onClose} width="max-w-lg">
      <ul className="space-y-1.5">
        {accounts.map((a, i) => (
          <AccountRow key={a.id} account={a} balance={balanceOf.get(a.id) ?? 0} first={i === 0} only={accounts.length === 1} />
        ))}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="mt-5 rounded-2xl border border-dashed border-white/10 p-3"
      >
        <p className="mb-2 text-xs font-medium text-zinc-400">Add an account</p>
        <div className="flex gap-2">
          <input
            value={name}
            maxLength={MAX_ACCOUNT_NAME}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. GCash"
            className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
          />
          <div className="w-32 shrink-0">
            <MoneyInput key={key} value={amount} nullable onChange={setAmount} placeholder="0" ariaLabel="Starting amount" />
          </div>
          <button disabled={!name.trim()} className="h-11 shrink-0 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
            Add
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {suggestions.map((n) => (
              <button key={n} type="button" onClick={() => setName(n)} className="h-8 rounded-full border border-white/10 px-3 text-xs text-zinc-400 transition hover:border-white/25 hover:text-zinc-200">
                {n}
              </button>
            ))}
          </div>
        )}
      </form>
    </Modal>
  )
}

function AccountRow({ account: a, balance, first, only }: { account: WalletAccount; balance: number; first: boolean; only: boolean }) {
  const f = useFmt()
  const [name, setName] = useState(a.name)
  const [open, setOpen] = useState(false)
  const change = useStore.getState().changeWallet

  function remove() {
    const before = useStore.getState().wallet
    change((w) => removeAccount(w, a.id))
    toast.undo(`Deleted ${a.name}.`, () => useStore.getState().changeWallet(() => before))
  }

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-2 p-1.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-label={`Icon and colour of ${a.name}`} title="Icon and colour" className="rounded-lg p-0.5 transition hover:bg-white/[0.06]">
          <AccountChip account={a} />
        </button>
        <input
          value={name}
          maxLength={MAX_ACCOUNT_NAME}
          aria-label="Account name"
          onChange={(e) => setName(e.target.value)}
          onBlur={() => (name.trim() && name.trim() !== a.name ? change((w) => updateAccount(w, a.id, { name })) : setName(a.name))}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          className="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-zinc-100 outline-none transition hover:border-white/10 focus:border-indigo-400/50 focus:bg-black/30"
        />
        {first && <span title="Expenses with no account come from here" className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[10px] text-zinc-400">Default</span>}
        <span className="shrink-0 px-1 text-sm tabular-nums text-zinc-300">{f(balance)}</span>
        <button
          type="button"
          onClick={remove}
          disabled={only}
          aria-label={`Delete ${a.name}`}
          title={only ? 'You need at least one' : 'Delete'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className={`grid transition-all duration-200 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="flex flex-wrap gap-1.5 px-3 pt-1">
            {ACCOUNT_ICONS.map((ic) => {
              const Icon = ICONS[ic]
              return (
                <button
                  key={ic}
                  type="button"
                  onClick={() => change((w) => updateAccount(w, a.id, { icon: ic }))}
                  aria-pressed={a.icon === ic}
                  aria-label={ic}
                  className={`grid h-8 w-8 place-items-center rounded-lg transition ${a.icon === ic ? 'bg-white/[0.12] text-white ring-1 ring-white/30' : 'text-zinc-400 hover:bg-white/[0.06]'}`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              )
            })}
          </div>
          <ColorRow value={a.color} onChange={(color) => change((w) => updateAccount(w, a.id, { color }))} />
        </div>
      </div>
    </li>
  )
}

// ---- The dialog: add, take out, move, count ----

const QUICK = [100, 500, 1000, 5000]
const TABS: { id: Mode; label: string; icon: typeof Plus }[] = [
  { id: 'add', label: 'Add', icon: Plus },
  { id: 'out', label: 'Out', icon: Minus },
  { id: 'move', label: 'Move', icon: ArrowLeftRight },
  { id: 'set', label: 'Count', icon: Scale },
]

export function WalletModal({ mode: startMode, account: startAccount }: { mode: Mode; account?: string }) {
  const close = useStore((s) => s.closeModal)
  const f = useFmt()
  const today = todayKey()
  const state = useWallet(today)
  const wallet = useStore((s) => s.wallet)
  const accounts = state?.accounts ?? []
  const balance = useMemo(() => Object.fromEntries(accounts.map((a) => [a.account.id, a.balance])), [accounts])
  const pick = (id?: string) => (id && accounts.some((a) => a.account.id === id) ? id : accounts[0]?.account.id ?? '')

  const [mode, setMode] = useState<Mode>(accounts.length < 2 && startMode === 'move' ? 'add' : startMode)
  const [account, setAccount] = useState(() => pick(startAccount))
  const [to, setTo] = useState(() => accounts.find((a) => a.account.id !== pick(startAccount))?.account.id ?? '')
  const [amount, setAmount] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const [date, setDate] = useState(today)
  const [counted, setCounted] = useState<Record<string, number | null>>(() => Object.fromEntries(accounts.map((a) => [a.account.id, a.balance])))
  const [key, setKey] = useState(0)
  const box = useRef<HTMLDivElement>(null)

  if (!state) return null
  const name = (id: string) => accounts.find((a) => a.account.id === id)?.account.name ?? ''
  const countedTotal = round(Object.values(counted).reduce<number>((n, v) => n + (v ?? 0), 0))
  const ok = mode === 'set' ? true : (amount ?? 0) > 0 && (mode !== 'move' || (to && to !== account))

  const notes = mode === 'add' || mode === 'out' ? [...pastNotes(wallet, mode), ...(mode === 'add' ? STARTER_SOURCES : STARTER_OUTS)].filter((n, i, l) => l.findIndex((x) => x.toLowerCase() === n.toLowerCase()) === i).slice(0, 7) : []

  function switchTo(m: Mode) {
    setMode(m)
    setAmount(null)
    setNote('')
    setKey((k) => k + 1)
    if (m === 'move' && to === account) setTo(accounts.find((a) => a.account.id !== account)?.account.id ?? '')
    requestAnimationFrame(() => box.current?.querySelector('input')?.focus())
  }

  function save() {
    if (!ok) {
      box.current?.querySelector('input')?.focus()
      return toast.error(mode === 'move' && to === account ? 'Pick two different accounts.' : 'Type an amount.')
    }
    const s = useStore.getState()
    if (mode === 'set') {
      const before = s.wallet
      const amounts = Object.fromEntries(Object.entries(counted).map(([k, v]) => [k, v ?? 0]))
      s.changeWallet((w) => setAmounts(w, amounts, balance))
      close()
      if (useStore.getState().wallet === before) return toast.info('Nothing changed.')
      return toast.undo(`Counted: ${f(countedTotal)} in total.`, () => useStore.getState().changeWallet(() => before))
    }
    let entry: WalletEntry | null = null
    s.changeWallet((w) => {
      const r = addEntry(w, { kind: mode, account, to: mode === 'move' ? to : undefined, amount: amount!, note, date: mode === 'move' ? today : date })
      entry = r.entry
      return r.wallet
    })
    close()
    const added = entry as WalletEntry | null
    const n = note.trim() ? ` · ${note.trim()}` : ''
    const msg =
      mode === 'add'
        ? `Added ${f(amount!)} to ${name(account)}${n}.`
        : mode === 'out'
          ? `Took ${f(amount!)} out of ${name(account)}${n}.`
          : `Moved ${f(amount!)} from ${name(account)} to ${name(to)}.`
    if (added) toast.undo(msg, () => useStore.getState().changeWallet((w) => removeEntry(w, added.id)))
  }

  const titles: Record<Mode, string> = { add: 'Add money', out: 'Take money out', move: 'Move money', set: 'Count your money' }
  const subtitles: Record<Mode, string> = {
    add: 'Money that came in.',
    out: 'Money that left, not spending.',
    move: 'Between your accounts.',
    set: 'Put what each really has.',
  }
  const accent =
    mode === 'add' ? 'from-emerald-500 to-teal-500 shadow-emerald-500/20' : mode === 'out' ? 'from-sky-500 to-indigo-500 shadow-sky-500/20' : 'from-indigo-500 to-violet-500 shadow-indigo-500/20'

  const nowBal = balance[account] ?? 0
  const preview =
    mode === 'add'
      ? [{ id: account, from: nowBal, to: round(nowBal + (amount ?? 0)) }]
      : mode === 'out'
        ? [{ id: account, from: nowBal, to: round(nowBal - (amount ?? 0)) }]
        : mode === 'move'
          ? [
              { id: account, from: nowBal, to: round(nowBal - (amount ?? 0)) },
              { id: to, from: balance[to] ?? 0, to: round((balance[to] ?? 0) + (amount ?? 0)) },
            ]
          : []

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
          <button onClick={save} className={`h-11 rounded-xl bg-gradient-to-r px-6 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 sm:h-10 ${accent} ${ok ? '' : 'opacity-50 shadow-none'}`}>
            {mode === 'add' ? 'Add' : mode === 'out' ? 'Take out' : mode === 'move' ? 'Move' : 'Save'}
          </button>
        </div>
      }
    >
      <div className="space-y-5" onKeyDown={(e) => e.key === 'Enter' && !(e.target as HTMLElement).closest('button') && save()}>
        <div role="tablist" aria-label="What to do" className={`grid rounded-xl border border-white/10 bg-white/[0.03] p-1 ${accounts.length > 1 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          {TABS.filter((t) => t.id !== 'move' || accounts.length > 1).map((t) => (
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

        {mode === 'set' ? (
          <div ref={box} className="space-y-2">
            {accounts.map(({ account: a, balance: b }) => (
              <div key={a.id} className="flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-black/20 p-1.5 pl-2">
                <AccountChip account={a} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-100">{a.name}</span>
                  <span className="block text-[11px] tabular-nums text-zinc-500">Tracked {f(b)}</span>
                </span>
                <div className="w-36 shrink-0">
                  <MoneyInput value={counted[a.id] ?? null} nullable onChange={(v) => setCounted((c) => ({ ...c, [a.id]: v }))} placeholder="0" ariaLabel={`${a.name} now`} />
                </div>
              </div>
            ))}
            <p className="flex justify-between px-1 pt-1 text-sm">
              <span className="text-zinc-500">Total</span>
              <span className="font-semibold tabular-nums text-white">
                {f(countedTotal)}
                {countedTotal !== state.total && (
                  <span className={`ml-2 text-xs font-normal ${countedTotal > state.total ? 'text-emerald-300' : 'text-rose-300'}`}>
                    {countedTotal > state.total ? '+' : '−'}
                    {f(Math.abs(round(countedTotal - state.total)))}
                  </span>
                )}
              </span>
            </p>
          </div>
        ) : (
          <>
            <Field label={mode === 'add' ? 'Into' : 'From'}>
              <AccountPicker accounts={accounts.map((a) => a.account)} balance={balance} value={account} onChange={setAccount} />
            </Field>
            {mode === 'move' && (
              <Field label="To">
                <AccountPicker accounts={accounts.map((a) => a.account).filter((a) => a.id !== account)} balance={balance} value={to} onChange={setTo} />
              </Field>
            )}

            <div ref={box}>
              <MoneyInput key={`${mode}-${key}`} value={amount} nullable onChange={setAmount} size="md" placeholder="0" autoFocus ariaLabel="Amount" />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => (setAmount(round((amount ?? 0) + q)), setKey((k) => k + 1))}
                    className="h-8 rounded-full border border-white/10 px-3 text-xs font-medium tabular-nums text-zinc-300 transition hover:border-white/25 hover:text-white active:scale-95"
                  >
                    +{f(q)}
                  </button>
                ))}
                {(mode === 'out' || mode === 'move') && nowBal > 0 && (
                  <button type="button" onClick={() => (setAmount(nowBal), setKey((k) => k + 1))} className="h-8 rounded-full border border-white/10 px-3 text-xs font-medium text-zinc-300 transition hover:border-white/25 hover:text-white">
                    All
                  </button>
                )}
              </div>
            </div>

            {mode !== 'move' && (
              <>
                <Field label={mode === 'add' ? 'From' : 'For'} optional>
                  <input
                    value={note}
                    maxLength={MAX_WALLET_NOTE}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={mode === 'add' ? 'e.g. Allowance' : 'e.g. Savings'}
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
                    {(
                      [
                        ['Today', today],
                        ['Yesterday', addDays(today, -1)],
                        ['2 days ago', addDays(today, -2)],
                      ] as const
                    ).map(([label, d]) => {
                      const before = d < (accounts.find((a) => a.account.id === account)?.set.date ?? '')
                      return (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDate(d)}
                          aria-pressed={date === d}
                          disabled={before}
                          title={before ? 'Before your last count, so it’s already in' : undefined}
                          className={`h-9 rounded-full border px-3 text-sm font-medium transition active:scale-95 disabled:opacity-30 ${
                            date === d ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20'
                          }`}
                        >
                          {label}
                        </button>
                      )
                    })}
                  </div>
                </Field>
              </>
            )}

            {/* What it will be */}
            <div className="space-y-1.5 rounded-2xl border border-white/[0.07] bg-black/25 px-4 py-3">
              {preview.map((p) => (
                <div key={p.id} className="flex items-center gap-3 text-sm">
                  <span className="min-w-0 flex-1 truncate text-zinc-400">{name(p.id)}</span>
                  <span className="tabular-nums text-zinc-500">{f(p.from)}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
                  <span key={p.to} className={`animate-tick min-w-[5rem] text-right font-semibold tabular-nums ${p.to < 0 ? 'text-rose-300' : 'text-white'}`}>
                    {f(p.to)}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

/** Account chips, each with its balance. */
export function AccountPicker({ accounts, balance, value, onChange }: { accounts: WalletAccount[]; balance?: Record<string, number>; value: string; onChange: (id: string) => void }) {
  const f = useFmt()
  return (
    <div className="flex flex-wrap gap-1.5">
      {accounts.map((a) => {
        const on = value === a.id
        const c = colorOf(a)
        const Icon = ICONS[a.icon]
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(a.id)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
              on ? `${c.soft} border-transparent text-white ring-1 ${c.ring}` : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 ${c.text}`} /> {a.name}
            {balance && <span className="text-xs font-normal tabular-nums text-zinc-400">{f(balance[a.id] ?? 0, true)}</span>}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-zinc-400">
        {label} {optional && <span className="font-normal text-zinc-600">optional</span>}
      </p>
      {children}
    </div>
  )
}
