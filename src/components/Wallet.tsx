import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowLeftRight, ArrowRight, Banknote, ChevronDown, History, CreditCard, Landmark, Minus, PiggyBank, Plus, Receipt, Scale, Settings2, Smartphone,
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
import { BlurToggle, Blurred } from './Blur'
import { useLinkSources } from './Spent'
import { MONTHS_SHORT } from '../lib/time'

type Mode = 'add' | 'out' | 'move' | 'set'
export const openWallet = (mode: Mode, account?: string) => useStore.getState().openModal({ type: 'wallet', mode, account })

export const ICONS: Record<AccountIcon, typeof Plus> = { cash: Banknote, bank: Landmark, phone: Smartphone, card: CreditCard, piggy: PiggyBank, wallet: WalletIcon }
export const colorOf = (a: { color: string }) => KIND_COLORS[a.color] ?? KIND_COLORS.slate

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

/** The account a move belongs to, for filters and "latest" lines (a move counts for both sides). */
const touches = (m: Move, id: string) => m.account === id || m.to === id

function Tracker({ state, today }: { state: WalletState; today: string }) {
  const f = useFmt()
  const u = useAlt()
  const shown = useGlide(state.total)
  const [managing, setManaging] = useState(false)
  const negative = state.total < 0

  const stats = useMemo(() => {
    const spentToday = state.moves.reduce((n, m) => (m.kind === 'expense' && m.date === today ? n + m.amount : n), 0)
    const perDay = dailySpend(state, today)
    const lasts = perDay > 0 && state.total > 0 ? Math.floor(state.total / perDay) : null
    // This month: what came in, what was spent, what was taken out.
    const monthStart = `${today.slice(0, 7)}-01`
    let mIn = 0
    let mSpent = 0
    let mOut = 0
    for (const m of state.moves) {
      if (m.date < monthStart) continue
      if (m.kind === 'add') mIn += m.amount
      else if (m.kind === 'expense') mSpent += m.amount
      else if (m.kind === 'out') mOut += m.amount
    }
    // Each account's latest change (not counting its own count).
    const latest = new Map<string, Move>()
    for (const m of state.moves) {
      if (m.kind === 'set') continue
      if (m.account) latest.set(m.account, m)
      if (m.to) latest.set(m.to, m)
    }
    return { spentToday, perDay, lasts, mIn: round(mIn), mSpent: round(mSpent), mOut: round(mOut), latest }
  }, [state, today])

  const since = state.since === today ? 'today' : dayLabel(state.since, today).replace(/^\w+, /, '')

  return (
    <section id="wallet" aria-label="Your money" className={`${card} group/blur relative overflow-hidden`}>
      {/* Soft glow that turns red when you're below zero */}
      <div aria-hidden className={`pointer-events-none absolute -right-20 -top-28 h-64 w-[28rem] rounded-full blur-3xl transition-colors duration-700 ${negative ? 'bg-rose-500/[0.12]' : 'bg-emerald-500/[0.12]'}`} />
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -left-16 h-48 w-80 rounded-full bg-indigo-500/[0.07] blur-3xl" />

      <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br shadow-lg ${negative ? 'from-rose-400 to-orange-500 shadow-rose-500/20' : 'from-emerald-400 to-teal-500 shadow-emerald-500/20'}`}>
              <WalletIcon className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                Your money
                <span title="Every expense comes off it as you log it" className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              </h3>
              <p className="truncate text-[11px] text-zinc-500">
                {state.accounts.length} account{state.accounts.length === 1 ? '' : 's'} · tracking since {since}
              </p>
            </div>
            <span className="flex-1" />
            <BlurToggle id="x-wallet" name="your money" />
            <button onClick={() => setManaging(true)} title="Edit accounts" aria-label="Edit accounts" className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white">
              <Settings2 className="h-4 w-4" />
            </button>
          </div>

          <Blurred id="x-wallet" name="Your money" className="mt-4">
            <p className={`break-all text-[2.5rem] font-bold leading-none tabular-nums tracking-tight sm:text-6xl ${negative ? 'text-rose-300' : 'bg-gradient-to-br from-white via-white to-zinc-300 bg-clip-text text-transparent'}`} aria-live="polite">
              {f(round(shown))}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              <span className="alt tabular-nums text-zinc-500">≈ {u(state.total)}</span>
              {stats.spentToday > 0 && <span className="text-rose-300/90">−{f(stats.spentToday)} today</span>}
            </div>
            <Split state={state} />
          </Blurred>

          {/* Each account */}
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
            {state.accounts.map(({ account: a, balance }) => (
              <AccountTile key={a.id} account={a} balance={balance} total={state.total} latest={stats.latest.get(a.id)} today={today} />
            ))}
            <button
              onClick={() => setManaging(true)}
              className="flex min-h-[6.25rem] flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-white/10 text-xs font-medium text-zinc-500 transition hover:border-white/25 hover:bg-white/[0.02] hover:text-zinc-200"
            >
              <span className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.05]">
                <Plus className="h-3.5 w-3.5" />
              </span>
              Add account
            </button>
          </div>

          {negative && (
            <p className="animate-fade mt-3 flex items-start gap-2 rounded-xl border border-rose-400/25 bg-rose-500/[0.07] px-3 py-2 text-xs text-rose-100/90">
              <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-rose-300" />
              More spent than you had. Add the money that came in, or count again.
            </p>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => openWallet('add')}
              className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98] sm:h-10"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Add money
            </button>
            <ActionButton onClick={() => useStore.getState().openModal({ type: 'expense' })} icon={Receipt} label="Spent" title="Log an expense: it comes off your money" />
            {state.accounts.length > 1 && <ActionButton onClick={() => openWallet('move')} icon={ArrowLeftRight} label="Move" title="E.g. withdraw from Bank to Cash" />}
            <ActionButton onClick={() => openWallet('out')} icon={Minus} label="Take out" title="Money that left, not spending (savings, lent…)" />
            <ActionButton onClick={() => openWallet('set')} icon={Scale} label="Count" title="Counted your money? Put the real amounts" />
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <Blurred id="x-wallet" name="Your money" hint={false}>
            <Spark state={state} today={today} />
          </Blurred>
          <Blurred id="x-wallet" name="Your money" hint={false}>
            <MonthFlow inn={stats.mIn} spent={stats.mSpent} out={stats.mOut} month={MONTHS_SHORT[Number(today.slice(5, 7)) - 1]} />
          </Blurred>
          <div className="grid grid-cols-2 gap-2">
            <Mini
              label="Lasts about"
              value={stats.lasts === null ? '—' : stats.lasts > 365 ? '1 yr+' : `${stats.lasts} day${stats.lasts === 1 ? '' : 's'}`}
              tone={stats.lasts !== null && stats.lasts < 7 ? 'text-amber-200' : 'text-zinc-100'}
              hint={stats.perDay > 0 ? `at ${f(stats.perDay, true)}/day` : 'log spending to see'}
              title={stats.perDay > 0 ? `At ${f(stats.perDay)} a day, your average over the last 2 weeks` : 'Log some spending to see'}
            />
            <Mini label="Spent today" value={f(stats.spentToday, true)} tone={stats.spentToday ? 'text-rose-200' : 'text-zinc-100'} hint={stats.spentToday ? 'comes off as you log' : 'nothing yet'} />
          </div>
        </div>
      </div>

      <Activity state={state} today={today} />

      {managing && <AccountsModal state={state} onClose={() => setManaging(false)} />}
    </section>
  )
}

function ActionButton({ onClick, icon: Icon, label, title }: { onClick: () => void; icon: typeof Plus; label: string; title: string }) {
  return (
    <button onClick={onClick} title={title} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.98] sm:h-10">
      <Icon className="h-4 w-4 text-zinc-400" /> {label}
    </button>
  )
}

/** One bar split by account, so you see at a glance where your money is. */
function Split({ state }: { state: WalletState }) {
  const parts = state.accounts.filter((a) => a.balance > 0)
  const sum = parts.reduce((n, a) => n + a.balance, 0)
  if (state.accounts.length < 2 || sum <= 0) return null
  return (
    <div className="mt-4">
      <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/[0.04]" role="img" aria-label={parts.map((a) => `${a.account.name} ${Math.round((a.balance / sum) * 100)}%`).join(', ')}>
        {parts.map((a) => (
          <span key={a.account.id} title={`${a.account.name} · ${Math.round((a.balance / sum) * 100)}%`} className={`h-full ${colorOf(a.account).bar} transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full`} style={{ flexGrow: a.balance }} />
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
        {parts.map((a) => (
          <span key={a.account.id} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
            <span className={`h-1.5 w-1.5 rounded-full ${colorOf(a.account).bar}`} />
            {a.account.name}
            <span className="tabular-nums text-zinc-600">{Math.round((a.balance / sum) * 100)}%</span>
          </span>
        ))}
      </div>
    </div>
  )
}

function AccountTile({ account: a, balance, total, latest, today }: { account: WalletAccount; balance: number; total: number; latest?: Move; today: string }) {
  const f = useFmt()
  const c = colorOf(a)
  const share = total > 0 && balance > 0 ? Math.min(100, (balance / total) * 100) : 0
  const shownBal = useGlide(balance)
  // Its latest change: "−₱120 · Coffee · Today"
  const sign = !latest ? '' : latest.kind === 'add' || (latest.kind === 'move' && latest.to === a.id) ? '+' : '−'
  const what = !latest ? '' : latest.kind === 'move' ? (latest.to === a.id ? 'Moved in' : 'Moved out') : latest.label || (latest.kind === 'add' ? 'Money in' : latest.kind === 'out' ? 'Taken out' : 'Expense')
  return (
    <div className={`group/tile relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-black/20 p-3 transition hover:border-white/20`}>
      <span aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full ${c.bar} opacity-[0.12] blur-2xl`} />
      <div className="relative flex items-center gap-2">
        <AccountChip account={a} size="sm" />
        <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">{a.name}</span>
        <span className="flex shrink-0 gap-0.5 sm:opacity-0 sm:transition sm:group-hover/tile:opacity-100 sm:group-focus-within/tile:opacity-100">
          <button onClick={() => openWallet('out', a.id)} title={`Take money out of ${a.name}`} aria-label={`Take money out of ${a.name}`} className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.06] text-zinc-400 transition hover:bg-sky-500/20 hover:text-sky-200">
            <Minus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
          <button onClick={() => openWallet('add', a.id)} title={`Add money to ${a.name}`} aria-label={`Add money to ${a.name}`} className="grid h-6 w-6 place-items-center rounded-md bg-white/[0.06] text-zinc-400 transition hover:bg-emerald-500/20 hover:text-emerald-200">
            <Plus className="h-3.5 w-3.5" strokeWidth={2.5} />
          </button>
        </span>
      </div>
      <Blurred id="x-wallet" name={a.name} hint={false} className="relative">
        <p className={`mt-2 truncate text-lg font-semibold tabular-nums ${balance < 0 ? 'text-rose-300' : 'text-white'}`}>{f(round(shownBal))}</p>
        <p className="mt-0.5 truncate text-[11px] text-zinc-500" title={latest ? `${what} · ${dayLabel(latest.date, today)}` : undefined}>
          {latest ? (
            <>
              <span className={`tabular-nums ${sign === '+' ? 'text-emerald-300/80' : 'text-rose-300/80'}`}>
                {sign}
                {f(latest.amount, true)}
              </span>{' '}
              · {what} · {dayLabel(latest.date, today).replace(/^\w+, /, '')}
            </>
          ) : (
            'No changes yet'
          )}
        </p>
      </Blurred>
      <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.04]">
        <span className={`block h-full ${c.bar} opacity-70 transition-[width] duration-500`} style={{ width: `${share}%` }} />
      </span>
    </div>
  )
}

function Mini({ label, value, tone, hint, title }: { label: string; value: string; tone: string; hint?: string; title?: string }) {
  return (
    <div title={title} className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums ${tone}`}>{value}</p>
      {hint && <p className="truncate text-[11px] text-zinc-600">{hint}</p>}
    </div>
  )
}

/** This month: money in against money out (spent + taken out), as two bars. */
function MonthFlow({ inn, spent, out, month }: { inn: number; spent: number; out: number; month: string }) {
  const f = useFmt()
  const left = round(spent + out)
  const net = round(inn - left)
  const max = Math.max(inn, left, 1)
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wider text-zinc-500">{month} so far</span>
        <span className={`font-semibold tabular-nums ${net >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
          {net >= 0 ? '+' : '−'}
          {f(Math.abs(net), true)}
        </span>
      </div>
      <div className="mt-2.5 space-y-2">
        <FlowBar label="In" value={inn} max={max} cls="bg-gradient-to-r from-emerald-500 to-teal-400" tone="text-emerald-200" />
        <div>
          <div className="flex items-center gap-2 text-xs">
            <span className="w-7 shrink-0 text-zinc-500">Out</span>
            <div className="flex h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
              <span className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-[width] duration-500" style={{ width: `${(spent / max) * 100}%` }} title={`Spent ${f(spent)}`} />
              <span className="h-full bg-sky-400/80 transition-[width] duration-500" style={{ width: `${(out / max) * 100}%` }} title={`Taken out ${f(out)}`} />
            </div>
            <span className="w-20 shrink-0 text-right font-medium tabular-nums text-rose-200">{f(left, true)}</span>
          </div>
          {out > 0 && spent > 0 && (
            <p className="mt-1 pl-9 text-[10px] text-zinc-600">
              <span className="text-rose-300/80">{f(spent, true)} spent</span> · <span className="text-sky-300/80">{f(out, true)} taken out</span>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FlowBar({ label, value, max, cls, tone }: { label: string; value: number; max: number; cls: string; tone: string }) {
  const f = useFmt()
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-7 shrink-0 text-zinc-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
        <span className={`block h-full ${cls} transition-[width] duration-500`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className={`w-20 shrink-0 text-right font-medium tabular-nums ${tone}`}>{f(value, true)}</span>
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
  const lastI = points.length - 1

  function move(clientX: number, el: SVGSVGElement) {
    const r = el.getBoundingClientRect()
    const rel = ((clientX - r.left) / r.width) * W
    setAt(Math.max(0, Math.min(points.length - 1, Math.round(((rel - PAD) / (W - PAD * 2)) * (points.length - 1)))))
  }

  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wider text-zinc-500">{pick ? dayLabel(pick.day, today) : points.length > 1 ? `Last ${points.length} days` : 'Today'}</span>
        <span className={`inline-flex items-center gap-1 font-semibold tabular-nums ${pick ? 'text-zinc-100' : up ? 'text-emerald-300' : 'text-rose-300'}`}>
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
        {pick && at !== null ? (
          <>
            <line x1={x(at)} x2={x(at)} y1="0" y2={H} stroke="rgba(255,255,255,0.25)" vectorEffect="non-scaling-stroke" />
            <circle cx={x(at)} cy={y(pick.total)} r="3.5" fill="#fff" />
          </>
        ) : (
          <circle cx={x(lastI)} cy={y(last.total)} r="3" fill={stroke} />
        )}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-zinc-600">
        <span>{dayLabel(first.day, today).replace(/^\w+, /, '')}</span>
        <span>Today</span>
      </div>
    </div>
  )
}

type Filter = 'all' | 'in' | 'spent' | 'out' | 'move'
const FILTERS: { id: Filter; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'in', label: 'In' },
  { id: 'spent', label: 'Spent' },
  { id: 'out', label: 'Out' },
  { id: 'move', label: 'Moves' },
]
const fits = (m: Move, f: Filter) =>
  f === 'all' || (f === 'in' && m.kind === 'add') || (f === 'spent' && m.kind === 'expense') || (f === 'out' && m.kind === 'out') || (f === 'move' && (m.kind === 'move' || m.kind === 'set'))

/** Everything that counted, newest first, grouped by day, with the total after each. */
function Activity({ state, today }: { state: WalletState; today: string }) {
  const f = useFmt()
  const [open, setOpen] = useState(false)
  const [all, setAll] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [account, setAccount] = useState<string | null>(null)
  const sources = useLinkSources()
  const rows = useMemo(() => withTotals(state), [state])
  const byId = useMemo(() => new Map(state.accounts.map((a) => [a.account.id, a.account])), [state.accounts])
  const picked = rows.filter(({ move: m }) => fits(m, filter) && (!account || touches(m, account)))
  const shown = all ? picked : picked.slice(0, 8)
  // Grouped by day, each with what came in and went out that day.
  const days = useMemo(() => {
    const out: { day: string; net: number; rows: typeof shown }[] = []
    for (const r of shown) {
      const last = out[out.length - 1]
      const g = last && last.day === r.move.date ? last : (out.push({ day: r.move.date, net: 0, rows: [] }), out[out.length - 1])
      g.rows.push(r)
      const m = r.move
      g.net += m.kind === 'add' ? m.amount : m.kind === 'expense' || m.kind === 'out' ? -m.amount : 0
    }
    return out
  }, [shown])

  function remove(m: Move) {
    const entry = useStore.getState().wallet.entries.find((e) => e.id === m.id) as WalletEntry | undefined
    if (!entry) return
    useStore.getState().changeWallet((w) => removeEntry(w, entry.id))
    toast.undo(`Removed ${f(m.amount)}.`, () => useStore.getState().changeWallet((w) => restoreEntry(w, entry)))
  }

  const latest = rows[0]?.move

  return (
    <div className="relative border-t border-white/[0.06]">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm font-medium text-zinc-300 transition hover:bg-white/[0.02] sm:px-6">
        <History className="h-4 w-4 text-zinc-500" />
        Activity
        <span className="rounded-full bg-white/[0.07] px-1.5 text-[11px] tabular-nums text-zinc-400">{state.moves.length}</span>
        {!open && latest && latest.kind !== 'set' && (
          <span className="ml-1 hidden min-w-0 truncate text-xs font-normal text-zinc-500 sm:block">
            Latest: {latest.label || (latest.kind === 'add' ? 'Money in' : latest.kind === 'move' ? 'Move' : latest.kind === 'out' ? 'Taken out' : 'Expense')} · {f(latest.amount, true)}
          </span>
        )}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="px-2 pb-3 sm:px-4">
            {/* Filters: what kind, and which account */}
            <div className="flex flex-wrap items-center gap-1.5 px-2 pb-2">
              <div role="tablist" aria-label="Show" className="flex rounded-lg border border-white/10 bg-white/[0.03] p-0.5">
                {FILTERS.map((x) => (
                  <button
                    key={x.id}
                    role="tab"
                    aria-selected={filter === x.id}
                    onClick={() => setFilter(x.id)}
                    className={`h-7 rounded-md px-2.5 text-xs font-medium transition ${filter === x.id ? 'bg-white/[0.1] text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    {x.label}
                  </button>
                ))}
              </div>
              {state.accounts.length > 1 &&
                state.accounts.map(({ account: a }) => {
                  const on = account === a.id
                  const Icon = ICONS[a.icon]
                  return (
                    <button
                      key={a.id}
                      aria-pressed={on}
                      onClick={() => setAccount(on ? null : a.id)}
                      className={`inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs font-medium transition ${on ? `${colorOf(a).soft} border-transparent text-white ring-1 ${colorOf(a).ring}` : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'}`}
                    >
                      <Icon className={`h-3 w-3 ${colorOf(a).text}`} /> {a.name}
                    </button>
                  )
                })}
            </div>

            {days.length === 0 && <p className="px-3 py-6 text-center text-sm text-zinc-500">Nothing here yet.</p>}
            {days.map((g) => (
              <div key={g.day} className="mt-1">
                <p className="flex items-center justify-between px-2 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                  <span>{dayLabel(g.day, today)}</span>
                  {g.net !== 0 && (
                    <span className={`tabular-nums normal-case tracking-normal ${g.net > 0 ? 'text-emerald-300/70' : 'text-rose-300/70'}`}>
                      {g.net > 0 ? '+' : '−'}
                      {f(Math.abs(round(g.net)), true)}
                    </span>
                  )}
                </p>
                <ul className="space-y-0.5">
                  {g.rows.map(({ move: m, total }) => {
                    const acc = byId.get(m.account || m.to || '')
                    const to = m.to ? byId.get(m.to) : undefined
                    const from = m.expenseId ? sources.get(m.expenseId) : undefined
                    const label =
                      m.kind === 'set'
                        ? `Counted ${acc?.name ?? 'account'}`
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
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${look.chip}`}>
                          <look.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1.5">
                            <span className="truncate text-sm text-zinc-100">{label}</span>
                            {from && (
                              <span className={`shrink-0 rounded-full px-1.5 py-px text-[9px] font-semibold uppercase tracking-wider ${from.kind === 'wants' ? 'bg-violet-400/15 text-violet-200' : 'bg-emerald-400/15 text-emerald-200'}`} title={`From ${from.mode}`}>
                                {from.kind === 'wants' ? 'Want' : 'Need'}
                              </span>
                            )}
                          </span>
                          <span className="flex items-center gap-1 truncate text-[11px] text-zinc-500">
                            {m.kind !== 'move' && acc && (
                              <>
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${colorOf(acc).bar}`} />
                                {acc.name}
                              </>
                            )}
                            {m.kind === 'move' && 'Between accounts'}
                          </span>
                        </span>
                        <span className="shrink-0 text-right">
                          <span className={`block text-sm font-semibold tabular-nums ${look.tone}`}>
                            {look.sign}
                            {f(m.amount)}
                          </span>
                          <span className="block text-[11px] tabular-nums text-zinc-600">{f(total)}</span>
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
              </div>
            ))}
            {picked.length > 8 && (
              <button onClick={() => setAll((a) => !a)} className="mt-1 w-full rounded-xl py-2 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
                {all ? 'Show less' : `Show all ${picked.length}`}
              </button>
            )}
          </div>
        </div>
      </div>
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
