import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarDays, Check, Receipt, Sparkles } from 'lucide-react'
import { useFmt, useItemIndex, useStore, type SpendInput } from '../store'
import { dayLabel, todayKey } from '../lib/expenses'
import { fmt } from '../lib/money'
import { spentDay } from '../lib/needs'
import { round, walletState, type AccountState } from '../lib/wallet'
import type { NeedItem } from '../lib/types'
import { Modal } from './Modal'
import { ICONS, colorOf } from './Wallet'
import { PAID_KEY, lastPaid } from './ExpenseModal'
import { toast } from '../toast'

/*
 * Marking something as spent (a Wants item, or a Needs item sent to Expenses) takes it off your money.
 * When you track more than one account, this asks which one paid, and shows what's left before you confirm.
 */

export type PayKind = 'wants' | 'needs'

const needItems = (s: ReturnType<typeof useStore.getState>): NeedItem[] => s.modes.find((m) => m.id === s.modeId)?.needs?.items ?? []

/** Accounts being tracked right now (empty: money isn't tracked). */
const tracked = () => {
  const s = useStore.getState()
  return walletState(s.wallet, s.expenses)?.accounts ?? []
}

/** Whether an expense on `date` changes this account's balance: on or after its last count, and not in the future. */
export const takesOff = (a: AccountState, date: string, today = todayKey()) => date >= a.set.date && date <= today

const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

/** "−₱1,200 from Cash · ₱3,800 left", once the change has gone through. */
function leftText(account: string, before: number | null) {
  const s = useStore.getState()
  const f = (n: number) => fmt(n, s.currency.main.symbol)
  const after = tracked().find((a) => a.account.id === account)
  if (!after || before === null || round(after.balance) === round(before)) return ''
  return ` −${f(round(before - after.balance))} from ${after.account.name} · ${f(after.balance)} left.`
}

function remember(account: string) {
  try {
    localStorage.setItem(PAID_KEY, account)
  } catch {
    // Not remembered: fine.
  }
}

/** Marks Wants items spent (or not). Asks which account paid when that matters. `what`: how to name them, like “Rolex”. */
export function markWantsSpent(ids: string[], on: boolean, what?: string) {
  const s = useStore.getState()
  const accounts = tracked()
  if (on && accounts.length) {
    const today = todayKey()
    const past = ids.some((id) => {
      for (const m of Object.entries(s.months)) if (m[1].items.some((i) => i.id === id)) return m[0] < today.slice(0, 7)
      return false
    })
    // More than one place it could have come from, or a past month (pick the day): ask.
    if (accounts.length > 1 || past) return s.openModal({ type: 'pay', kind: 'wants', ids, what })
    return doWants(ids, { account: accounts[0].account.id, date: today }, what)
  }
  doWants(ids, on ? {} : undefined, what, on)
}

function doWants(ids: string[], pay: SpendInput | undefined, what?: string, on = true) {
  const before = pay?.account ? (tracked().find((a) => a.account.id === pay.account)?.balance ?? null) : null
  const { count, undo } = useStore.getState().setItemsSpent(ids, on, pay)
  if (!count) return
  const name = what ?? plural(count)
  const left = pay?.account ? leftText(pay.account, before) : ''
  toast.undo(on ? `${name} marked spent and added to Expenses.${left || ' Still in its month.'}` : `${name} no longer marked spent. Taken out of Expenses.`, undo)
}

/** Sends Needs items to Expenses (or takes them out). Asks which account paid for ones that don't say, when that matters. */
export function sendNeeds(ids: string[], on: boolean, what?: string) {
  const s = useStore.getState()
  const accounts = tracked()
  if (on && accounts.length > 1) {
    const want = new Set(ids)
    const inExpenses = new Set(s.expenses.map((e) => e.id))
    const unsaid = needItems(s).some((i) => want.has(i.id) && !i.account && !(i.expenseId && inExpenses.has(i.expenseId)))
    if (unsaid) return s.openModal({ type: 'pay', kind: 'needs', ids, what })
  }
  doNeeds(ids, on, undefined, what)
}

function doNeeds(ids: string[], on: boolean, account?: string, what?: string) {
  const before = account ? (tracked().find((a) => a.account.id === account)?.balance ?? null) : null
  const { count, undo } = useStore.getState().setNeedsSent(ids, on, account)
  if (!count) return
  const name = what ?? plural(count)
  const left = account ? leftText(account, before) : ''
  toast.undo(on ? `${name} sent to Expenses.${left}` : `${name} taken out of Expenses. Still here in Needs.`, undo)
}

// ---- The dialog ----

type Line = { id: string; name: string; amount: number; date: string; account?: string }

export function PayModal({ kind, ids, what }: { kind: PayKind; ids: string[]; what?: string }) {
  const f = useFmt()
  const close = useStore((s) => s.closeModal)
  const today = todayKey()
  const index = useItemIndex()
  const wallet = useStore((s) => s.wallet)
  const expenses = useStore((s) => s.expenses)
  const modes = useStore((s) => s.modes)
  const modeId = useStore((s) => s.modeId)
  const accounts = useMemo(() => walletState(wallet, expenses, today)?.accounts ?? [], [wallet, expenses, today])

  // What's being paid for (only what isn't already in Expenses).
  const lines: Line[] = useMemo(() => {
    const inExpenses = new Set(expenses.map((e) => e.id))
    if (kind === 'wants') {
      return ids.flatMap((id) => {
        const p = index.byId.get(id)
        if (!p || (p.item.expenseId && inExpenses.has(p.item.expenseId))) return []
        return [{ id, name: p.item.name, amount: Math.max(0, p.item.price), date: spentDay(p.key, today) }]
      })
    }
    const items = modes.find((m) => m.id === modeId)?.needs?.items ?? []
    const want = new Set(ids)
    return items
      .filter((i) => want.has(i.id) && !(i.expenseId && inExpenses.has(i.expenseId)))
      .map((i) => ({ id: i.id, name: i.name || 'Item', amount: i.amount, date: i.date, account: i.account || undefined }))
  }, [kind, ids, index, expenses, modes, modeId, today])

  // Needs items that already say which account paid keep it; only the rest are asked about.
  const asked = kind === 'needs' ? lines.filter((l) => !l.account) : lines
  const total = round(asked.reduce((n, l) => n + l.amount, 0))
  const [account, setAccount] = useState(() => {
    const ids = accounts.map((a) => a.account.id)
    const last = lastPaid()
    return ids.includes(last) ? last : (ids[0] ?? '')
  })

  // Wants from past months: paid today (comes off your money now), or in its own month.
  const pastDates = kind === 'wants' ? [...new Set(lines.map((l) => l.date).filter((d) => d < today))] : []
  const [when, setWhen] = useState<'today' | 'month'>('today')
  const dateOf = (l: Line) => (kind === 'wants' && when === 'today' ? today : l.date)

  const chosen = accounts.find((a) => a.account.id === account)
  const counted = chosen ? round(asked.filter((l) => takesOff(chosen, dateOf(l), today)).reduce((n, l) => n + l.amount, 0)) : 0
  const after = chosen ? round(chosen.balance - counted) : 0
  const short = chosen && after < 0

  // Nothing left to pay for (e.g. marked from another device meanwhile): nothing to ask.
  const empty = !lines.length
  useEffect(() => void (empty && close()), [empty, close])
  if (empty) return null
  const title = lines.length === 1 ? `Paid for “${what?.replace(/^“|”$/g, '') || lines[0].name}”` : `Paid for ${plural(lines.length)}`

  function confirm() {
    close()
    if (account) remember(account)
    const picked = lines.map((l) => l.id)
    if (kind === 'wants') doWants(picked, { account, date: when === 'today' ? today : undefined }, what)
    else doNeeds(picked, true, account, what)
  }

  return (
    <Modal
      title={title}
      subtitle={kind === 'wants' ? 'It goes to Expenses and comes off your money.' : 'Sent to Expenses, and taken off your money.'}
      onClose={close}
      width="max-w-md"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={close} className="h-11 rounded-xl px-4 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white sm:h-10">
            Cancel
          </button>
          <button
            onClick={confirm}
            autoFocus
            className="inline-flex h-11 items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-5 text-sm font-semibold text-white shadow-lg shadow-emerald-500/20 transition hover:brightness-110 active:scale-[0.98] sm:h-10"
          >
            <Check className="h-4 w-4" strokeWidth={2.75} />
            {kind === 'wants' ? 'Mark spent' : 'Send'}
            {counted > 0 && <span className="tabular-nums opacity-80">· −{f(counted, true)}</span>}
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        {/* What it's for */}
        <div className="rounded-2xl border border-white/[0.07] bg-black/25 p-3">
          <ul className="space-y-1">
            {lines.slice(0, 4).map((l) => (
              <li key={l.id} className="flex items-center gap-2.5 text-sm">
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-rose-500/15 text-rose-300">
                  <Receipt className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate text-zinc-200">{l.name}</span>
                {l.account && <span className="shrink-0 text-[11px] text-zinc-500">{accounts.find((a) => a.account.id === l.account)?.account.name ?? ''}</span>}
                <span className="shrink-0 font-semibold tabular-nums text-white">{f(l.amount)}</span>
              </li>
            ))}
          </ul>
          {lines.length > 4 && <p className="mt-1.5 pl-[2.375rem] text-xs text-zinc-500">and {lines.length - 4} more</p>}
          {lines.length > 1 && (
            <p className="mt-2 flex justify-between border-t border-white/[0.06] pt-2 text-sm">
              <span className="text-zinc-500">Total</span>
              <span className="font-semibold tabular-nums text-white">{f(round(lines.reduce((n, l) => n + l.amount, 0)))}</span>
            </p>
          )}
        </div>

        {asked.length > 0 && accounts.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-400">{asked.length < lines.length ? `Paid from (for the ${plural(asked.length)} that don’t say)` : 'Paid from'}</p>
            <div role="radiogroup" aria-label="Paid from" className="grid grid-cols-2 gap-2">
              {accounts.map((a) => {
                const on = a.account.id === account
                const c = colorOf(a.account)
                const Icon = ICONS[a.account.icon]
                const off = round(asked.filter((l) => takesOff(a, dateOf(l), today)).reduce((n, l) => n + l.amount, 0))
                const left = round(a.balance - off)
                return (
                  <button
                    key={a.account.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setAccount(a.account.id)}
                    className={`relative overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
                      on ? `border-transparent ${c.soft} ring-2 ${c.ring}` : 'border-white/[0.08] bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${c.soft} ${c.text}`}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{a.account.name}</span>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition ${on ? 'border-transparent bg-white text-zinc-900' : 'border-white/20 text-transparent'}`}>
                        <Check className="h-3 w-3" strokeWidth={3.5} />
                      </span>
                    </span>
                    <span className="mt-2 block text-[11px] tabular-nums text-zinc-500">Has {f(a.balance)}</span>
                    <span className={`block text-sm font-semibold tabular-nums ${left < 0 ? 'text-rose-300' : on ? 'text-white' : 'text-zinc-300'}`}>
                      {off > 0 ? `${f(left)} after` : 'No change'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {pastDates.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-zinc-400">When did you pay?</p>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['today', 'Today', 'Comes off your money now', Sparkles],
                  ['month', pastDates.length === 1 ? dayLabel(pastDates[0], today).replace(/^\w+, /, '') : 'In its own month', 'Back then', CalendarDays],
                ] as const
              ).map(([id, label, hint, Icon]) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={when === id}
                  onClick={() => setWhen(id)}
                  className={`rounded-xl border px-3 py-2.5 text-left transition active:scale-[0.98] ${
                    when === id ? 'border-indigo-400/50 bg-indigo-500/15' : 'border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]'
                  }`}
                >
                  <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-100">
                    <Icon className="h-3.5 w-3.5 text-zinc-400" /> {label}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-zinc-500">{hint}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* What it will be */}
        {chosen && asked.length > 0 && (
          <div className={`rounded-2xl border px-4 py-3 transition-colors ${short ? 'border-rose-400/25 bg-rose-500/[0.07]' : 'border-white/[0.07] bg-black/25'}`}>
            <div className="flex items-center gap-3 text-sm">
              <span className="min-w-0 flex-1 truncate text-zinc-400">{chosen.account.name}</span>
              <span className="tabular-nums text-zinc-500">{f(chosen.balance)}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-zinc-600" />
              <span key={`${account}-${after}`} className={`animate-tick min-w-[5rem] text-right font-semibold tabular-nums ${after < 0 ? 'text-rose-300' : 'text-white'}`}>
                {f(after)}
              </span>
            </div>
            {counted < total && (
              <p className="mt-1.5 text-[11px] text-zinc-500">
                {counted === 0 ? 'Your money doesn’t change' : `Only ${f(counted)} comes off`}: the rest is dated before you last counted {chosen.account.name} (
                {dayLabel(chosen.set.date, today).replace(/^\w+, /, '')}) or after today.
              </p>
            )}
            {short && <p className="mt-1.5 text-[11px] text-rose-200/90">That’s more than {chosen.account.name} has. You can still mark it, then add money or count again.</p>}
          </div>
        )}

        {accounts.length === 0 && <p className="text-sm text-zinc-400">You’re not tracking your money yet. It still goes to Expenses.</p>}
      </div>
    </Modal>
  )
}
