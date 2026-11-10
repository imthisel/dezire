import type { Expense } from './types'
import { addDays, fromKey, isDate, todayKey } from './expenses'

/**
 * Money on hand: how much you have right now, kept up to date by itself.
 *
 * You say how much you have (a 'set'), and from then on:
 * - money you add (allowance, salary…) goes on top ('add'),
 * - money you take out that isn't spending (into savings, lent to a friend…) comes off ('out'),
 * - and every expense in Expenses that happens after it comes off too, so it's always in step with your spending.
 *
 * Only what came after the latest 'set' counts: setting the amount again is how you correct it after counting.
 */
export type WalletKind = 'set' | 'add' | 'out'

export interface WalletEntry {
  id: string
  kind: WalletKind
  amount: number
  /** Where it came from / went ('' = not said) */
  note: string
  /** "YYYY-MM-DD" it happened */
  date: string
  /** When it was entered (ms): decides what counts after a 'set' made the same day */
  at: number
}

export interface Wallet {
  entries: WalletEntry[]
}

export const EMPTY_WALLET: Wallet = { entries: [] }
export const MAX_WALLET_NOTE = 60
/** Offered as one-tap reasons when adding money, before you've typed any of your own. */
export const STARTER_SOURCES = ['Allowance', 'Salary', 'Sideline', 'Gift', 'Refund']
export const STARTER_OUTS = ['Savings', 'Lent', 'Bank deposit']

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)

/** The latest time you said how much you have. */
export const latestSet = (w: Wallet) =>
  w.entries.reduce<WalletEntry | null>((best, e) => (e.kind === 'set' && (!best || e.at > best.at) ? e : best), null)

/**
 * Did this happen after the amount was set? Later days do; the same day only if entered after it (what was entered
 * before was already in the counted amount); earlier days don't. Days still ahead don't count yet.
 */
export const counts = (date: string, at: number, set: WalletEntry, today: string) =>
  date <= today && (date > set.date || (date === set.date && at > set.at))

/** One change to the balance: a wallet entry or an expense, newest first in the activity list. */
export type Move = { id: string; kind: 'add' | 'out' | 'expense' | 'set'; amount: number; label: string; date: string; at: number; expenseId?: string }

/** Everything since the amount was set, oldest first, and the balance now. null = never set. */
export function walletState(w: Wallet, expenses: Expense[], today = todayKey()) {
  const set = latestSet(w)
  if (!set) return null
  const moves: Move[] = []
  for (const e of w.entries) {
    if (e.kind === 'set' || !counts(e.date, e.at, set, today)) continue
    moves.push({ id: e.id, kind: e.kind, amount: e.amount, label: e.note, date: e.date, at: e.at })
  }
  for (const e of expenses) {
    if (!counts(e.date, e.createdAt, set, today)) continue
    moves.push({ id: e.id, kind: 'expense', amount: e.amount, label: e.name, date: e.date, at: e.createdAt, expenseId: e.id })
  }
  moves.sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at)
  let added = 0
  let spent = 0
  let out = 0
  for (const m of moves) {
    if (m.kind === 'add') added += m.amount
    else if (m.kind === 'out') out += m.amount
    else spent += m.amount
  }
  const balance = round(set.amount + added - out - spent)
  return { set, moves, added, spent, out, balance }
}

export const round = (n: number) => Math.round(n * 100) / 100

/** The balance at the end of each of the last `days` days (from the day it was set), for the little chart. */
export function balanceByDay(state: NonNullable<ReturnType<typeof walletState>>, today = todayKey(), days = 30) {
  const start = state.set.date > addDays(today, -(days - 1)) ? state.set.date : addDays(today, -(days - 1))
  const out: { day: string; balance: number }[] = []
  let bal = state.set.amount
  let i = 0
  const moves = state.moves
  // Moves before the chart starts are already in the opening balance.
  while (i < moves.length && moves[i].date < start) bal += sign(moves[i++])
  for (let d = start; d <= today; d = addDays(d, 1)) {
    while (i < moves.length && moves[i].date === d) bal += sign(moves[i++])
    out.push({ day: d, balance: round(bal) })
  }
  return out
}
const sign = (m: Move) => (m.kind === 'add' ? m.amount : -m.amount)

/** Average spent a day over the last two weeks (only days since the amount was set), for "lasts about N days". */
export function dailySpend(state: NonNullable<ReturnType<typeof walletState>>, today = todayKey()) {
  const from = state.set.date > addDays(today, -13) ? state.set.date : addDays(today, -13)
  const days = Math.max(1, Math.round((fromKey(today).getTime() - fromKey(from).getTime()) / 86400000) + 1)
  const spent = state.moves.reduce((n, m) => (m.kind === 'expense' && m.date >= from ? n + m.amount : n), 0)
  return spent / days
}

// ---- Changes ----

export function addEntry(w: Wallet, kind: WalletKind, amount: number, note = '', date = todayKey()): { wallet: Wallet; entry: WalletEntry } {
  const entry: WalletEntry = {
    id: uid(),
    kind,
    amount: round(Math.max(0, Number(amount) || 0)),
    note: note.trim().slice(0, MAX_WALLET_NOTE),
    date: isDate(date) ? date : todayKey(),
    // Always after every earlier entry, so the order things were entered in is never a tie.
    at: Math.max(Date.now(), ...w.entries.map((e) => e.at + 1)),
  }
  return { wallet: { ...w, entries: [...w.entries, entry] }, entry }
}

export const removeEntry = (w: Wallet, id: string): Wallet => ({ ...w, entries: w.entries.filter((e) => e.id !== id) })
export const restoreEntry = (w: Wallet, e: WalletEntry): Wallet => (w.entries.some((x) => x.id === e.id) ? w : { ...w, entries: [...w.entries, e] })

/** Reasons used before (newest first), to offer as one-tap notes. */
export function pastNotes(w: Wallet, kind: 'add' | 'out') {
  const seen = new Set<string>()
  const out: string[] = []
  for (const e of [...w.entries].sort((a, b) => b.at - a.at)) {
    const k = e.note.toLowerCase()
    if (e.kind !== kind || !e.note || seen.has(k)) continue
    seen.add(k)
    out.push(e.note)
  }
  return out
}

/** Cleans up the wallet from a backup file, the cloud or this browser. */
export function parseWallet(raw: unknown): Wallet {
  if (!raw || typeof raw !== 'object' || !Array.isArray((raw as Wallet).entries)) return EMPTY_WALLET
  const seen = new Set<string>()
  const entries: WalletEntry[] = []
  for (const x of (raw as { entries: Record<string, unknown>[] }).entries) {
    if (!x || typeof x !== 'object') continue
    const kind = x.kind === 'set' || x.kind === 'add' || x.kind === 'out' ? x.kind : null
    const amount = Number(x.amount)
    if (!kind || !Number.isFinite(amount) || amount < 0) continue
    const id = typeof x.id === 'string' && x.id && !seen.has(x.id) ? x.id : uid()
    seen.add(id)
    entries.push({
      id,
      kind,
      amount: round(amount),
      note: typeof x.note === 'string' ? x.note.slice(0, MAX_WALLET_NOTE) : '',
      date: typeof x.date === 'string' && isDate(x.date) ? x.date : todayKey(),
      at: Number(x.at) || Date.now(),
    })
  }
  return { entries }
}
