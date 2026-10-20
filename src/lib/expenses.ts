import {
  Baby, Bike, Briefcase, Bus, Car, Clapperboard, Coffee, Dumbbell, Fuel, Gamepad2, Gift, GraduationCap, HeartPulse, Home, Laptop, Package, PawPrint,
  PiggyBank, Pill, Plane, Receipt, Repeat, Shirt, ShoppingBag, ShoppingCart, Smartphone, Sparkles, Utensils, Wifi, Wrench, Zap, Beer, Scissors,
  HandHeart, type LucideIcon,
} from 'lucide-react'
import type { Expense, ExpenseCategory } from './types'
import { KIND_COLORS } from './meta'
import { END_YEAR, MONTHS, MONTHS_SHORT, START_YEAR } from './time'

// ---- Categories ----

/** Icons a spending category can use, by name. */
export const EXPENSE_ICONS: Record<string, LucideIcon> = {
  food: Utensils, coffee: Coffee, drinks: Beer, groceries: ShoppingCart, transport: Bus, fuel: Fuel, car: Car, bike: Bike,
  home: Home, bills: Receipt, power: Zap, internet: Wifi, phone: Smartphone, subscriptions: Repeat, shopping: ShoppingBag,
  clothes: Shirt, gadgets: Laptop, health: HeartPulse, medicine: Pill, fitness: Dumbbell, beauty: Scissors, fun: Gamepad2,
  movies: Clapperboard, travel: Plane, gift: Gift, giving: HandHeart, school: GraduationCap, pets: PawPrint, baby: Baby,
  work: Briefcase, repairs: Wrench, savings: PiggyBank, box: Package, other: Sparkles,
}

/** The categories every account starts with (ids fixed, so a removed one can be brought back). */
export const DEFAULT_EXPENSE_CATS: ExpenseCategory[] = [
  { id: 'food', label: 'Food & Drinks', icon: 'food', color: 'orange', items: ['Breakfast', 'Lunch', 'Dinner', 'Coffee', 'Snacks', 'Food delivery'] },
  { id: 'groceries', label: 'Groceries', icon: 'groceries', color: 'lime', items: ['Groceries', 'Toiletries', 'Water', 'Rice'] },
  { id: 'transport', label: 'Transport', icon: 'transport', color: 'cyan', items: ['Commute', 'Grab / Taxi', 'Fuel', 'Parking', 'Toll'] },
  { id: 'bills', label: 'Bills', icon: 'bills', color: 'blue', items: ['Electricity', 'Water bill', 'Internet', 'Phone load', 'Rent'] },
  { id: 'shopping', label: 'Shopping', icon: 'shopping', color: 'pink', items: ['Clothes', 'Shoes', 'Gadgets', 'Home stuff'] },
  { id: 'health', label: 'Health', icon: 'health', color: 'rose', items: ['Medicine', 'Check-up', 'Vitamins', 'Gym'] },
  { id: 'fun', label: 'Fun', icon: 'fun', color: 'violet', items: ['Movies', 'Games', 'Night out', 'Subscriptions'] },
  { id: 'other', label: 'Other', icon: 'other', color: 'slate', items: ['Gift', 'Donation', 'Fees'] },
]

export const MAX_CAT_NAME = 28
export const MAX_ITEM_NAME = 60
export const MAX_PLACE_NAME = 60

/** Shown for an expense with no category (or one deleted on another device). */
export const NO_CATEGORY: ExpenseCategory = { id: '', label: 'No category', icon: 'box', color: 'slate', items: [] }

export const catIcon = (c: ExpenseCategory) => EXPENSE_ICONS[c.icon] ?? Package
export const catColor = (c: ExpenseCategory) => KIND_COLORS[c.color] ?? KIND_COLORS.slate

const ICON_WORDS: [RegExp, string][] = [
  [/coffee|cafe|tea/, 'coffee'],
  [/drink|bar|beer|alcohol|wine/, 'drinks'],
  [/food|eat|meal|lunch|dinner|restaurant|snack/, 'food'],
  [/grocer|market|supermarket/, 'groceries'],
  [/fuel|gas|petrol|diesel/, 'fuel'],
  [/car|auto/, 'car'],
  [/bike|motor/, 'bike'],
  [/transport|commute|bus|jeep|train|taxi|grab|ride/, 'transport'],
  [/rent|house|home|condo/, 'home'],
  [/electric|power|meralco/, 'power'],
  [/internet|wifi/, 'internet'],
  [/phone|load|mobile/, 'phone'],
  [/subscri|netflix|spotify|streaming/, 'subscriptions'],
  [/bill|utilit/, 'bills'],
  [/cloth|fashion|shoe/, 'clothes'],
  [/gadget|tech|computer/, 'gadgets'],
  [/shop/, 'shopping'],
  [/medic|pharma|pill|drug/, 'medicine'],
  [/health|doctor|hospital|dental/, 'health'],
  [/gym|fitness|sport/, 'fitness'],
  [/beauty|salon|hair|barber|skin/, 'beauty'],
  [/movie|cinema|film/, 'movies'],
  [/fun|game|entertain|hobby/, 'fun'],
  [/travel|trip|flight|hotel|vacation/, 'travel'],
  [/gift|present|birthday/, 'gift'],
  [/charity|donat|church|tithe|giving/, 'giving'],
  [/school|tuition|course|book|educat/, 'school'],
  [/pet|dog|cat|vet/, 'pets'],
  [/baby|kid|child/, 'baby'],
  [/work|office|business/, 'work'],
  [/repair|fix|maint/, 'repairs'],
  [/sav|invest/, 'savings'],
]
export const guessExpenseIcon = (name: string) => ICON_WORDS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 'box'

/** Cleans up categories from a backup file or the cloud. null = nothing usable. */
export function parseExpenseCats(list: unknown): ExpenseCategory[] | null {
  if (!Array.isArray(list)) return null
  const seen = new Set<string>()
  const out: ExpenseCategory[] = []
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || typeof x.label !== 'string' || seen.has(x.id)) continue
    seen.add(x.id)
    out.push({
      id: x.id,
      label: x.label.trim().slice(0, MAX_CAT_NAME) || 'Untitled',
      icon: typeof x.icon === 'string' && x.icon in EXPENSE_ICONS ? x.icon : 'box',
      color: typeof x.color === 'string' && x.color in KIND_COLORS ? x.color : 'slate',
      items: Array.isArray(x.items) ? uniq(x.items.filter((i): i is string => typeof i === 'string').map((i) => i.trim().slice(0, MAX_ITEM_NAME))) : [],
    })
  }
  return out
}

/** Cleans up expenses from a backup file or the cloud. */
export function parseExpenses(list: unknown): Expense[] {
  if (!Array.isArray(list)) return []
  const out: Expense[] = []
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || typeof x.date !== 'string' || !isDate(x.date)) continue
    const amount = Number(x.amount)
    if (!(amount > 0)) continue
    out.push({
      id: typeof x.id === 'string' && x.id ? x.id : Math.random().toString(36).slice(2),
      date: x.date,
      amount: Math.round(amount * 100) / 100,
      name: typeof x.name === 'string' ? x.name.trim().slice(0, MAX_ITEM_NAME) : '',
      category: typeof x.category === 'string' ? x.category : '',
      place: typeof x.place === 'string' ? x.place.trim().slice(0, MAX_PLACE_NAME) : '',
      notes: typeof x.notes === 'string' ? x.notes.slice(0, 2000) : '',
      createdAt: Number(x.createdAt) || Date.now(),
    })
  }
  return out
}

export function parsePlaces(list: unknown): string[] {
  return Array.isArray(list) ? uniq(list.filter((p): p is string => typeof p === 'string').map((p) => p.trim().slice(0, MAX_PLACE_NAME))) : []
}

/** Non-empty, without repeats (ignoring case), first one wins. */
export function uniq(list: string[]) {
  const seen = new Set<string>()
  return list.filter((s) => {
    const k = s.toLowerCase()
    if (!s || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ---- Dates (always the user's own local calendar days, as "YYYY-MM-DD") ----

export const MIN_DATE = `${START_YEAR}-01-01`
export const MAX_DATE = `${END_YEAR}-12-31`
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

const pad = (n: number) => String(n).padStart(2, '0')
export const toKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
/** Noon, so moving by days never trips over daylight-saving changes. */
export const fromKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d, 12)
}
export const isDate = (k: string) => /^\d{4}-\d{2}-\d{2}$/.test(k) && toKey(fromKey(k)) === k
export const todayKey = () => toKey(new Date())
export const clampDate = (k: string) => (k < MIN_DATE ? MIN_DATE : k > MAX_DATE ? MAX_DATE : k)
export const addDays = (k: string, n: number) => {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}
export const daysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate()
export const monthKeyOf = (k: string) => k.slice(0, 7)

/** "Today", "Yesterday", "Tomorrow", else "Mon, Oct 12" (with the year when it isn't this year). */
export function dayLabel(k: string, today = todayKey()) {
  if (k === today) return 'Today'
  if (k === addDays(today, -1)) return 'Yesterday'
  if (k === addDays(today, 1)) return 'Tomorrow'
  const d = fromKey(k)
  const base = `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}`
  return k.slice(0, 4) === today.slice(0, 4) ? base : `${base}, ${d.getFullYear()}`
}

/** "Tuesday, October 20, 2026" */
export function longDate(k: string) {
  const d = fromKey(k)
  return `${WEEKDAYS_FULL[d.getDay()]}, ${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
}

// ---- Periods for the overview ----

export type PeriodKind = 'week' | 'month' | 'year'
/** A stretch of days, both ends included. */
export type Period = { kind: PeriodKind; start: string; end: string }

/** The week (Sunday to Saturday), month or year that `k` falls in. */
export function periodOf(kind: PeriodKind, k: string): Period {
  const d = fromKey(k)
  if (kind === 'week') {
    const start = addDays(k, -d.getDay())
    return { kind, start, end: addDays(start, 6) }
  }
  if (kind === 'month') {
    const y = d.getFullYear()
    const m = d.getMonth()
    return { kind, start: `${y}-${pad(m + 1)}-01`, end: `${y}-${pad(m + 1)}-${pad(daysInMonth(y, m))}` }
  }
  return { kind, start: `${d.getFullYear()}-01-01`, end: `${d.getFullYear()}-12-31` }
}

/** The period before (-1) or after (+1). */
export function shiftPeriod(p: Period, by: number): Period {
  if (p.kind === 'week') return periodOf('week', addDays(p.start, 7 * by))
  const d = fromKey(p.start)
  if (p.kind === 'month') return periodOf('month', toKey(new Date(d.getFullYear(), d.getMonth() + by, 1, 12)))
  return periodOf('year', `${d.getFullYear() + by}-01-01`)
}

/** "Oct 18 – 24, 2026", "October 2026", "2026" */
export function periodLabel(p: Period) {
  const a = fromKey(p.start)
  const b = fromKey(p.end)
  if (p.kind === 'year') return String(a.getFullYear())
  if (p.kind === 'month') return `${MONTHS[a.getMonth()]} ${a.getFullYear()}`
  if (a.getFullYear() !== b.getFullYear()) return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
  if (a.getMonth() !== b.getMonth()) return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`
  return `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${b.getDate()}, ${b.getFullYear()}`
}

export const inPeriod = (k: string, p: Period) => k >= p.start && k <= p.end
/** Number of days in the period. */
export const periodDays = (p: Period) => Math.round((fromKey(p.end).getTime() - fromKey(p.start).getTime()) / 86400000) + 1
