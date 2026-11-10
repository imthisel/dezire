import type { Expense } from './types'
import { addDays, fromKey, isDate, todayKey } from './expenses'

/**
 * Money on hand, split into accounts: Cash, Bank, and any of your own (GCash, Maya…).
 *
 * Each account's balance is the amount you last said it has (a 'set'), plus what came in after, minus what went out,
 * minus the expenses paid from it after. Expenses say which account paid (no account = the first one, Cash).
 * Setting an account again is how you correct it after counting.
 */
export type WalletKind = 'set' | 'add' | 'out' | 'move'
export type AccountIcon = 'cash' | 'bank' | 'phone' | 'card' | 'piggy' | 'wallet'

export interface WalletAccount {
  id: string
  name: string
  icon: AccountIcon
  /** Key into KIND_COLORS */
  color: string
}

export interface WalletEntry {
  id: string
  kind: WalletKind
  /** The account it's for ('move': the one the money leaves) */
  account: string
  /** 'move' only: the account the money goes to */
  to?: string
  amount: number
  /** Where it came from / went ('' = not said) */
  note: string
  /** "YYYY-MM-DD" it happened */
  date: string
  /** When it was entered (ms), always after every earlier entry */
  at: number
}

export interface Wallet {
  accounts: WalletAccount[]
  entries: WalletEntry[]
}

export const EMPTY_WALLET: Wallet = { accounts: [], entries: [] }
export const MAX_WALLET_NOTE = 60
export const MAX_ACCOUNT_NAME = 24
export const ACCOUNT_ICONS: AccountIcon[] = ['cash', 'bank', 'phone', 'card', 'piggy', 'wallet']
/** The two every tracker starts with. */
export const STARTER_ACCOUNTS: Omit<WalletAccount, 'id'>[] = [
  { name: 'Cash', icon: 'cash', color: 'lime' },
  { name: 'Bank', icon: 'bank', color: 'blue' },
]
export const SUGGESTED_ACCOUNTS = ['GCash', 'Maya', 'Savings', 'Card', 'PayPal']
export const STARTER_SOURCES = ['Allowance', 'Salary', 'Sideline', 'Gift', 'Refund']
export const STARTER_OUTS = ['Savings', 'Lent', 'Paid back']

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4)
export const round = (n: number) => Math.round(n * 100) / 100

/** A fitting icon for an account's name. */
export function guessAccountIcon(name: string): AccountIcon {
  const n = name.toLowerCase()
  if (/gcash|maya|paymaya|grab|shopee|e-?wallet|coins|wise|gotyme|seabank/.test(n)) return 'phone'
  if (/sav|piggy|emergency|fund/.test(n)) return 'piggy'
  if (/card|credit|debit|visa|master/.test(n)) return 'card'
  if (/bank|bdo|bpi|metro|union|land|pnb|rcbc|security|chase/.test(n)) return 'bank'
  if (/cash|coin|pocket/.test(n)) return 'cash'
  return 'wallet'
}
const ACCOUNT_COLORS = ['lime', 'blue', 'cyan', 'violet', 'pink', 'orange', 'teal', 'yellow', 'rose']

// ---- Working it out ----

/** Did this happen after the account was set? Later days do; the same day only if entered after; future days don't yet. */
const counts = (date: string, at: number, set: WalletEntry, today: string) => date <= today && (date > set.date || (date === set.date && at > set.at))

/** One line of activity: a wallet entry or an expense. */
export type Move = {
  id: string
  kind: WalletKind | 'expense'
  /** The account it changes ('' = a move whose "from" side was before that account's last count) */
  account: string
  to?: string
  amount: number
  label: string
  date: string
  at: number
  expenseId?: string
}

export type AccountState = { account: WalletAccount; set: WalletEntry; balance: number }

/** Each account's balance, the total, and everything that counted (oldest first). null = not set up yet. */
export function walletState(w: Wallet, expenses: Expense[], today = todayKey()) {
  if (!w.accounts.length) return null
  const sets = new Map<string, WalletEntry>()
  for (const e of w.entries) if (e.kind === 'set' && (!sets.get(e.account) || e.at > sets.get(e.account)!.at)) sets.set(e.account, e)
  const accounts = w.accounts.filter((a) => sets.has(a.id))
  if (!accounts.length) return null
  const known = new Set(accounts.map((a) => a.id))
  const main = w.accounts[0].id

  const moves: Move[] = []
  for (const a of accounts) {
    const s = sets.get(a.id)!
    moves.push({ id: s.id, kind: 'set', account: a.id, amount: s.amount, label: s.note, date: s.date, at: s.at })
  }
  for (const e of w.entries) {
    if (e.kind === 'set' || !known.has(e.account)) continue
    // A move counts for each side on its own terms (each account has its own last count).
    const fromOk = counts(e.date, e.at, sets.get(e.account)!, today)
    const toOk = e.kind === 'move' && !!e.to && known.has(e.to) && counts(e.date, e.at, sets.get(e.to)!, today)
    if (e.kind === 'move' ? fromOk || toOk : fromOk) {
      moves.push({ id: e.id, kind: e.kind, account: fromOk ? e.account : '', to: toOk ? e.to : undefined, amount: e.amount, label: e.note, date: e.date, at: e.at })
    }
  }
  for (const e of expenses) {
    const a = e.account || main
    if (!known.has(a) || !counts(e.date, e.createdAt, sets.get(a)!, today)) continue
    moves.push({ id: e.id, kind: 'expense', account: a, amount: e.amount, label: e.name, date: e.date, at: e.createdAt, expenseId: e.id })
  }
  moves.sort((x, y) => x.date.localeCompare(y.date) || x.at - y.at)

  const bal = new Map<string, number>()
  let added = 0
  let spent = 0
  let out = 0
  for (const m of moves) {
    apply(bal, m)
    if (m.kind === 'add') added += m.amount
    else if (m.kind === 'out') out += m.amount
    else if (m.kind === 'expense') spent += m.amount
  }
  const list: AccountState[] = accounts.map((a) => ({ account: a, set: sets.get(a.id)!, balance: round(bal.get(a.id) ?? 0) }))
  const total = round(list.reduce((n, a) => n + a.balance, 0))
  const since = accounts.reduce((d, a) => (sets.get(a.id)!.date < d ? sets.get(a.id)!.date : d), today)
  return { accounts: list, total, moves, added, spent, out, since, main }
}

export type WalletState = NonNullable<ReturnType<typeof walletState>>

/** Changes the running balances by one move. */
export function apply(bal: Map<string, number>, m: Move) {
  const add = (id: string | undefined, n: number) => {
    if (id) bal.set(id, (bal.get(id) ?? 0) + n)
  }
  if (m.kind === 'set') bal.set(m.account, m.amount)
  else if (m.kind === 'add') add(m.account, m.amount)
  else if (m.kind === 'move') {
    add(m.account, -m.amount)
    add(m.to, m.amount)
  } else add(m.account, -m.amount)
}
const sum = (bal: Map<string, number>) => round([...bal.values()].reduce((a, b) => a + b, 0))

/** The total after each move (for the activity list), newest first. */
export function withTotals(state: WalletState) {
  const bal = new Map<string, number>()
  return state.moves.map((m) => (apply(bal, m), { move: m, total: sum(bal) })).reverse()
}

/** The total at the end of each of the last `days` days, for the little chart. */
export function totalByDay(state: WalletState, today = todayKey(), days = 30) {
  const start = state.since > addDays(today, -(days - 1)) ? state.since : addDays(today, -(days - 1))
  const bal = new Map<string, number>()
  const out: { day: string; total: number }[] = []
  let i = 0
  const ms = state.moves
  while (i < ms.length && ms[i].date < start) apply(bal, ms[i++])
  for (let d = start; d <= today; d = addDays(d, 1)) {
    while (i < ms.length && ms[i].date === d) apply(bal, ms[i++])
    out.push({ day: d, total: sum(bal) })
  }
  return out
}

/** Average spent a day over the last two weeks (only since tracking began), for "lasts about N days". */
export function dailySpend(state: WalletState, today = todayKey()) {
  const from = state.since > addDays(today, -13) ? state.since : addDays(today, -13)
  const days = Math.max(1, Math.round((fromKey(today).getTime() - fromKey(from).getTime()) / 86400000) + 1)
  return state.moves.reduce((n, m) => (m.kind === 'expense' && m.date >= from ? n + m.amount : n), 0) / days
}

// ---- Changes ----

const nextAt = (w: Wallet) => Math.max(Date.now(), ...w.entries.map((e) => e.at + 1))

export function addEntry(
  w: Wallet,
  d: { kind: WalletKind; account: string; amount: number; note?: string; date?: string; to?: string },
): { wallet: Wallet; entry: WalletEntry } {
  const entry: WalletEntry = {
    id: uid(),
    kind: d.kind,
    account: d.account,
    ...(d.kind === 'move' && d.to ? { to: d.to } : {}),
    amount: round(Math.max(0, Number(d.amount) || 0)),
    note: (d.note ?? '').trim().slice(0, MAX_WALLET_NOTE),
    date: d.date && isDate(d.date) ? d.date : todayKey(),
    at: nextAt(w),
  }
  return { wallet: { ...w, entries: [...w.entries, entry] }, entry }
}

/** Sets several accounts at once (after counting): only the ones that changed. */
export function setAmounts(w: Wallet, amounts: Record<string, number>, current: Record<string, number>): Wallet {
  let next = w
  for (const [account, amount] of Object.entries(amounts)) {
    if (current[account] !== undefined && round(current[account]) === round(amount)) continue
    next = addEntry(next, { kind: 'set', account, amount }).wallet
  }
  return next
}

export function addAccount(w: Wallet, name: string, amount = 0, icon?: AccountIcon, color?: string): { wallet: Wallet; id: string } {
  const used = new Set(w.accounts.map((a) => a.color))
  const n = name.trim().slice(0, MAX_ACCOUNT_NAME) || 'Account'
  const account: WalletAccount = {
    id: uid(),
    name: n,
    icon: icon ?? guessAccountIcon(n),
    color: color ?? ACCOUNT_COLORS.find((c) => !used.has(c)) ?? ACCOUNT_COLORS[w.accounts.length % ACCOUNT_COLORS.length],
  }
  const withAccount = { ...w, accounts: [...w.accounts, account] }
  return { wallet: addEntry(withAccount, { kind: 'set', account: account.id, amount }).wallet, id: account.id }
}

export const updateAccount = (w: Wallet, id: string, patch: Partial<Omit<WalletAccount, 'id'>>): Wallet => ({
  ...w,
  accounts: w.accounts.map((a) => (a.id === id ? { ...a, ...patch, name: patch.name === undefined ? a.name : patch.name.trim().slice(0, MAX_ACCOUNT_NAME) || a.name } : a)),
})

/** Deletes an account and its history. Expenses paid from it just stop counting. The last one can't go. */
export function removeAccount(w: Wallet, id: string): Wallet {
  if (w.accounts.length <= 1) return w
  return {
    accounts: w.accounts.filter((a) => a.id !== id),
    // Moves into it from elsewhere become money taken out of the other account.
    entries: w.entries
      .filter((e) => e.account !== id)
      .map((e) => {
        if (e.kind !== 'move' || e.to !== id) return e
        const { to: _gone, ...rest } = e
        return { ...rest, kind: 'out' as const, note: e.note || 'Moved out' }
      }),
  }
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

/** Cleans up the wallet from a backup file, the cloud or this browser. Older saves (one amount, no accounts) become Cash. */
export function parseWallet(raw: unknown): Wallet {
  if (!raw || typeof raw !== 'object') return EMPTY_WALLET
  const r = raw as { accounts?: unknown; entries?: unknown }
  const rawEntries = Array.isArray(r.entries) ? (r.entries as Record<string, unknown>[]) : []
  const accounts: WalletAccount[] = []
  for (const x of Array.isArray(r.accounts) ? (r.accounts as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || accounts.some((a) => a.id === x.id)) continue
    const name = typeof x.name === 'string' ? x.name.trim().slice(0, MAX_ACCOUNT_NAME) : ''
    accounts.push({
      id: x.id,
      name: name || 'Account',
      icon: ACCOUNT_ICONS.includes(x.icon as AccountIcon) ? (x.icon as AccountIcon) : guessAccountIcon(name),
      color: typeof x.color === 'string' ? x.color : 'slate',
    })
  }
  // Saved before accounts existed: what was tracked was cash.
  if (!Array.isArray(r.accounts) && rawEntries.length) accounts.push({ id: 'cash', ...STARTER_ACCOUNTS[0] })
  const ids = new Set(accounts.map((a) => a.id))
  const seen = new Set<string>()
  const entries: WalletEntry[] = []
  for (const x of rawEntries) {
    if (!x || typeof x !== 'object') continue
    const kind = x.kind === 'set' || x.kind === 'add' || x.kind === 'out' || x.kind === 'move' ? x.kind : null
    const amount = Number(x.amount)
    const account = typeof x.account === 'string' ? x.account : 'cash'
    if (!kind || !Number.isFinite(amount) || amount < 0 || !ids.has(account)) continue
    if (kind === 'move' && !(typeof x.to === 'string' && ids.has(x.to))) continue
    const id = typeof x.id === 'string' && x.id && !seen.has(x.id) ? x.id : uid()
    seen.add(id)
    entries.push({
      id,
      kind,
      account,
      ...(kind === 'move' ? { to: x.to as string } : {}),
      amount: round(amount),
      note: typeof x.note === 'string' ? x.note.slice(0, MAX_WALLET_NOTE) : '',
      date: typeof x.date === 'string' && isDate(x.date) ? x.date : todayKey(),
      at: Number(x.at) || Date.now(),
    })
  }
  return { accounts, entries }
}
