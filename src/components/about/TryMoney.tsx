import { useMemo, useState } from 'react'
import {
  ArrowLeftRight, Banknote, CreditCard, Landmark, Minus, PiggyBank, Plus, Receipt, Scale, Smartphone, Wallet as WalletIcon, type LucideIcon,
} from 'lucide-react'
import { KIND_COLORS } from '../../lib/meta'
import { addEntry, dailySpend, round, setAmounts, totalByDay, type AccountIcon, type Wallet, type WalletState } from '../../lib/wallet'
import { Modal } from '../Modal'
import { MoneyField, money, moneyShort } from './TryOverview'

/*
 * "Your money" on the About page's Expenses playground: money on hand in Cash, Bank and GCash, with every expense logged
 * below coming off it as you go, the same way (and with the same maths, lib/wallet) as the app. Lives only in this page.
 */

const ICONS: Record<AccountIcon, LucideIcon> = { cash: Banknote, bank: Landmark, phone: Smartphone, card: CreditCard, piggy: PiggyBank, wallet: WalletIcon }
const colorOf = (a: { color: string }) => KIND_COLORS[a.color] ?? KIND_COLORS.slate

/** The example accounts, counted on the 1st of this month, and a salary into Bank halfway through it (once it's come). */
export function exampleWallet(firstDay: string, payDay: string): Wallet {
  const acc = [
    { id: 'cash', name: 'Cash', icon: 'cash' as const, color: 'lime', amount: 48_000 },
    { id: 'bank', name: 'Bank', icon: 'bank' as const, color: 'blue', amount: 215_000 },
    { id: 'gcash', name: 'GCash', icon: 'phone' as const, color: 'cyan', amount: 26_500 },
  ]
  return {
    accounts: acc.map(({ id, name, icon, color }) => ({ id, name, icon, color })),
    entries: [
      ...acc.map((a, i) => ({ id: `set-${a.id}`, kind: 'set' as const, account: a.id, amount: a.amount, note: '', date: firstDay, at: i })),
      { id: 'salary', kind: 'add' as const, account: 'bank', amount: 85_000, note: 'Salary', date: payDay, at: 5 },
    ],
  }
}

type Action = 'add' | 'out' | 'move' | 'set'

export function TryMoney({ state, wallet, setWallet, today, onSpent }: {
  state: WalletState | null
  wallet: Wallet
  setWallet: (w: Wallet) => void
  today: string
  onSpent: () => void
}) {
  const [action, setAction] = useState<Action | null>(null)
  const stats = useMemo(() => {
    if (!state) return null
    const spentToday = state.moves.reduce((n, m) => (m.kind === 'expense' && m.date === today ? n + m.amount : n), 0)
    const perDay = dailySpend(state, today)
    let mIn = 0, mSpent = 0, mOut = 0
    for (const m of state.moves) {
      if (m.kind === 'add') mIn += m.amount
      else if (m.kind === 'expense') mSpent += m.amount
      else if (m.kind === 'out') mOut += m.amount
    }
    const latest = new Map<string, (typeof state.moves)[number]>()
    for (const m of state.moves) if (m.kind !== 'set') (m.account && latest.set(m.account, m), m.to && latest.set(m.to, m))
    return { spentToday, perDay, lasts: perDay > 0 && state.total > 0 ? Math.floor(state.total / perDay) : null, mIn, mSpent, mOut, latest }
  }, [state, today])

  if (!state || !stats) {
    return (
      <section className="rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-5 text-sm text-zinc-400">
        Your money isn’t being tracked here. Press <b className="text-zinc-200">Example</b> to bring the accounts back.
      </section>
    )
  }
  const negative = state.total < 0
  const parts = state.accounts.filter((a) => a.balance > 0)
  const partSum = parts.reduce((n, a) => n + a.balance, 0)
  const month = new Date().toLocaleDateString('en-US', { month: 'short' })

  return (
    <section aria-label="Your money" className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b0c10]">
      <div aria-hidden className={`pointer-events-none absolute -right-20 -top-28 h-64 w-[28rem] rounded-full blur-3xl transition-colors duration-700 ${negative ? 'bg-rose-500/[0.12]' : 'bg-emerald-500/[0.12]'}`} />
      <div className="relative grid gap-6 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br shadow-lg ${negative ? 'from-rose-400 to-orange-500' : 'from-emerald-400 to-teal-500 shadow-emerald-500/20'}`}>
              <WalletIcon className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
            </span>
            <div className="min-w-0">
              <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
                Your money
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300 ring-1 ring-inset ring-emerald-400/20">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  </span>
                  Live
                </span>
              </h3>
              <p className="truncate text-[11px] text-zinc-500">{state.accounts.length} accounts · every expense below comes off it</p>
            </div>
          </div>

          <p key={state.total} className={`animate-tick mt-4 break-all text-[2.5rem] font-bold leading-none tabular-nums tracking-tight sm:text-6xl ${negative ? 'text-rose-300' : 'bg-gradient-to-br from-white via-white to-zinc-300 bg-clip-text text-transparent'}`}>
            {money(state.total)}
          </p>
          {stats.spentToday > 0 && <p className="mt-2 text-xs text-rose-300/90">−{money(stats.spentToday)} today</p>}

          {parts.length > 1 && partSum > 0 && (
            <div className="mt-4">
              <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/[0.04]">
                {parts.map((a) => (
                  <span key={a.account.id} className={`h-full ${colorOf(a.account).bar} transition-[flex-grow] duration-500 first:rounded-l-full last:rounded-r-full`} style={{ flexGrow: a.balance }} />
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                {parts.map((a) => (
                  <span key={a.account.id} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-400">
                    <span className={`h-1.5 w-1.5 rounded-full ${colorOf(a.account).bar}`} />
                    {a.account.name} <span className="tabular-nums text-zinc-600">{Math.round((a.balance / partSum) * 100)}%</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 [&>*:last-child:nth-child(odd)]:col-span-2 sm:[&>*:last-child:nth-child(odd)]:col-span-1">
            {state.accounts.map(({ account: a, balance }) => {
              const Icon = ICONS[a.icon]
              const c = colorOf(a)
              const l = stats.latest.get(a.id)
              const sign = !l ? '' : l.kind === 'add' || (l.kind === 'move' && l.to === a.id) ? '+' : '−'
              const what = !l ? '' : l.kind === 'move' ? (l.to === a.id ? 'Moved in' : 'Moved out') : l.label || (l.kind === 'add' ? 'Money in' : l.kind === 'out' ? 'Taken out' : 'Expense')
              return (
                <div key={a.id} className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.035] to-black/20 p-3">
                  <span aria-hidden className={`pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full ${c.bar} opacity-[0.12] blur-2xl`} />
                  <div className="relative flex items-center gap-2">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg ${c.soft} ${c.text}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-300">{a.name}</span>
                  </div>
                  <p key={balance} className={`animate-tick relative mt-2 truncate text-lg font-semibold tabular-nums ${balance < 0 ? 'text-rose-300' : 'text-white'}`}>{money(balance)}</p>
                  <p className="relative mt-0.5 truncate text-[11px] text-zinc-500">
                    {l ? (
                      <>
                        <span className={sign === '+' ? 'text-emerald-300/80' : 'text-rose-300/80'}>
                          {sign}
                          {moneyShort(l.amount)}
                        </span>{' '}
                        · {what}
                      </>
                    ) : (
                      'No changes yet'
                    )}
                  </p>
                  <span aria-hidden className="absolute inset-x-0 bottom-0 h-0.5 bg-white/[0.04]">
                    <span className={`block h-full ${c.bar} opacity-70 transition-[width] duration-500`} style={{ width: `${state.total > 0 && balance > 0 ? Math.min(100, (balance / state.total) * 100) : 0}%` }} />
                  </span>
                </div>
              )
            })}
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            <button
              onClick={() => setAction('add')}
              className="col-span-2 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98] sm:h-10"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> Add money
            </button>
            <ActionButton onClick={onSpent} icon={Receipt} label="Spent" />
            <ActionButton onClick={() => setAction('move')} icon={ArrowLeftRight} label="Move" />
            <ActionButton onClick={() => setAction('out')} icon={Minus} label="Take out" />
            <ActionButton onClick={() => setAction('set')} icon={Scale} label="Count" />
          </div>
        </div>

        <div className="min-w-0 space-y-3">
          <Spark state={state} today={today} />
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="font-medium uppercase tracking-wider text-zinc-500">{month} so far</span>
              <span className={`font-semibold tabular-nums ${stats.mIn - stats.mSpent - stats.mOut >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {stats.mIn - stats.mSpent - stats.mOut >= 0 ? '+' : '−'}
                {moneyShort(Math.abs(stats.mIn - stats.mSpent - stats.mOut))}
              </span>
            </div>
            <div className="mt-2.5 space-y-2">
              <Flow label="In" value={stats.mIn} max={Math.max(stats.mIn, stats.mSpent + stats.mOut, 1)} cls="bg-gradient-to-r from-emerald-500 to-teal-400" tone="text-emerald-200" />
              <Flow label="Out" value={stats.mSpent + stats.mOut} max={Math.max(stats.mIn, stats.mSpent + stats.mOut, 1)} cls="bg-gradient-to-r from-rose-500 to-rose-400" tone="text-rose-200" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Mini
              label="Lasts about"
              value={stats.lasts === null ? '—' : stats.lasts > 365 ? '1 yr+' : `${stats.lasts} day${stats.lasts === 1 ? '' : 's'}`}
              tone={stats.lasts !== null && stats.lasts < 7 ? 'text-amber-200' : 'text-zinc-100'}
              hint={stats.perDay > 0 ? `at ${moneyShort(stats.perDay)}/day` : 'log spending to see'}
            />
            <Mini label="Spent today" value={moneyShort(stats.spentToday)} tone={stats.spentToday ? 'text-rose-200' : 'text-zinc-100'} hint={stats.spentToday ? 'comes off as you log' : 'nothing yet'} />
          </div>
        </div>
      </div>

      {action && <MoneyDialog action={action} state={state} wallet={wallet} setWallet={setWallet} today={today} onClose={() => setAction(null)} />}
    </section>
  )
}

function ActionButton({ onClick, icon: Icon, label }: { onClick: () => void; icon: LucideIcon; label: string }) {
  return (
    <button onClick={onClick} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.02] px-3.5 text-sm font-medium text-zinc-200 transition hover:border-white/20 hover:bg-white/[0.05] active:scale-[0.98] sm:h-10">
      <Icon className="h-4 w-4 text-zinc-400" /> {label}
    </button>
  )
}

function Mini({ label, value, tone, hint }: { label: string; value: string; tone: string; hint: string }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</p>
      <p className={`mt-0.5 truncate text-base font-semibold tabular-nums ${tone}`}>{value}</p>
      <p className="truncate text-[11px] text-zinc-600">{hint}</p>
    </div>
  )
}

function Flow({ label, value, max, cls, tone }: { label: string; value: number; max: number; cls: string; tone: string }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-7 shrink-0 text-zinc-500">{label}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/[0.05]">
        <span className={`block h-full ${cls} transition-[width] duration-500`} style={{ width: `${(value / max) * 100}%` }} />
      </div>
      <span className={`w-20 shrink-0 text-right font-medium tabular-nums ${tone}`}>{moneyShort(value)}</span>
    </div>
  )
}

/** The total over this month so far. */
function Spark({ state, today }: { state: WalletState; today: string }) {
  const points = useMemo(() => totalByDay(state, today), [state, today])
  const W = 300, H = 84, PAD = 6
  const values = points.map((p) => p.total)
  const min = Math.min(0, ...values)
  const max = Math.max(...values, min + 1)
  const x = (i: number) => (points.length === 1 ? W / 2 : PAD + (i / (points.length - 1)) * (W - PAD * 2))
  const y = (v: number) => PAD + (1 - (v - min) / (max - min)) * (H - PAD * 2)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.total).toFixed(1)}`).join(' ')
  const first = values[0] ?? 0
  const last = values[values.length - 1] ?? 0
  const up = last >= first
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-medium uppercase tracking-wider text-zinc-500">This month</span>
        <span className={`font-semibold tabular-nums ${up ? 'text-emerald-300' : 'text-rose-300'}`}>
          {up ? '+' : '−'}
          {moneyShort(Math.abs(last - first))}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 h-20 w-full overflow-visible" role="img" aria-label={`Your money this month: from ${money(first)} to ${money(last)}`}>
        <defs>
          <linearGradient id="try-money" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={up ? 'rgb(52 211 153)' : 'rgb(251 113 133)'} stopOpacity="0.3" />
            <stop offset="100%" stopColor={up ? 'rgb(52 211 153)' : 'rgb(251 113 133)'} stopOpacity="0" />
          </linearGradient>
        </defs>
        {points.length > 1 && <path d={`${line} L${x(points.length - 1)},${H} L${x(0)},${H} Z`} fill="url(#try-money)" />}
        <path d={line} fill="none" stroke={up ? 'rgb(52 211 153)' : 'rgb(251 113 133)'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={x(points.length - 1)} cy={y(last)} r="4" fill={up ? 'rgb(110 231 183)' : 'rgb(253 164 175)'} />
      </svg>
    </div>
  )
}

/** Add money, take some out, move it between accounts, or count what's really there. */
function MoneyDialog({ action, state, wallet, setWallet, today, onClose }: {
  action: Action; state: WalletState; wallet: Wallet; setWallet: (w: Wallet) => void; today: string; onClose: () => void
}) {
  const accounts = state.accounts.map((a) => a.account)
  const [account, setAccount] = useState(accounts[action === 'add' ? 1 : 0]?.id ?? accounts[0].id)
  const [to, setTo] = useState(accounts.find((a) => a.id !== account)?.id ?? '')
  const [amount, setAmount] = useState<number | null>(null)
  const [note, setNote] = useState(action === 'add' ? 'Salary' : action === 'out' ? 'Savings' : '')
  const [counts, setCounts] = useState<Record<string, number>>(() => Object.fromEntries(state.accounts.map((a) => [a.account.id, a.balance])))
  const title = { add: 'Add money', out: 'Take money out', move: 'Move money', set: 'Count your money' }[action]
  const ok = action === 'set' || (amount ?? 0) > 0

  function save() {
    if (!ok) return
    if (action === 'set') setWallet(setAmounts(wallet, counts, Object.fromEntries(state.accounts.map((a) => [a.account.id, a.balance]))))
    else setWallet(addEntry(wallet, { kind: action, account, amount: round(amount!), note, date: today, ...(action === 'move' ? { to } : {}) }).wallet)
    onClose()
  }

  const pick = (value: string, set: (id: string) => void, skip?: string) => (
    <div className="flex flex-wrap gap-1.5">
      {accounts.filter((a) => a.id !== skip).map((a) => (
        <button
          key={a.id}
          type="button"
          onClick={() => set(a.id)}
          className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-sm font-medium transition ${value === a.id ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' : 'border-white/10 text-zinc-300 hover:border-white/20'}`}
        >
          {a.name}
        </button>
      ))}
    </div>
  )

  return (
    <Modal
      title={title}
      subtitle={action === 'set' ? 'Counted it? Put the real amounts and the totals follow.' : 'It changes your money right away.'}
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5">
            Cancel
          </button>
          <button onClick={save} disabled={!ok} className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
            {action === 'set' ? 'Save amounts' : title}
          </button>
        </div>
      }
    >
      <form onSubmit={(e) => (e.preventDefault(), save())} className="space-y-4">
        {action === 'set' ? (
          state.accounts.map(({ account: a }) => (
            <label key={a.id} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-sm font-medium text-zinc-300">{a.name}</span>
              <span className="flex-1">
                <MoneyField value={counts[a.id] ?? 0} onChange={(v) => setCounts((c) => ({ ...c, [a.id]: v ?? 0 }))} label={`${a.name} amount`} />
              </span>
            </label>
          ))
        ) : (
          <>
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-400">How much</p>
              <MoneyField value={amount} onChange={setAmount} label="Amount" nullable placeholder="0" />
            </div>
            <div>
              <p className="mb-1.5 text-xs font-medium text-zinc-400">{action === 'add' ? 'Into' : 'From'}</p>
              {pick(account, (id) => (setAccount(id), id === to && setTo(accounts.find((a) => a.id !== id)?.id ?? '')))}
            </div>
            {action === 'move' && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-zinc-400">To</p>
                {pick(to, setTo, account)}
              </div>
            )}
            {action !== 'move' && (
              <label className="block">
                <span className="mb-1.5 block text-xs font-medium text-zinc-400">{action === 'add' ? 'From where' : 'What for'}</span>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 60))}
                  className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition focus:border-emerald-400/60"
                />
              </label>
            )}
          </>
        )}
      </form>
    </Modal>
  )
}
