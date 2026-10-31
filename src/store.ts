import { useCallback, useMemo } from 'react'
import { create } from 'zustand'
import { persist, type PersistStorage, type StorageValue } from 'zustand/middleware'
import type { Category, Expense, ExpenseCategory, Goal, GoalArea, GoalAreaDef, IncomeSource, Item, ItemKind, MonthData, PlanStep, ModeData, ModeInfo, Result, RunningCosts, SourceKind, SourceStage, Task, TaskKind, TaskType, Trend } from './lib/types'
import {
  DEFAULT_GOAL_AREAS, DEFAULT_KINDS, GOAL_COLORS, GOAL_ICONS, KIND_COLORS, KIND_ICONS, SOURCE_KINDS, SOURCE_STAGES, UNKNOWN_AREA, UNKNOWN_KIND,
  guessAreaIcon, guessIcon,
} from './lib/meta'
import { DEFAULT_CURRENCIES, fmt, fmtAlt, parseCurrencies, type AltCurrency, type Currencies, type Currency } from './lib/money'
import { currentYear, labelOfKey, END_YEAR, START_YEAR, indexOf, indexOfKey, keyOf } from './lib/time'
import { computeAll, spendLimit, type MonthCalc } from './lib/calc'
import { cleanRunning } from './lib/running'
import {
  DEFAULT_EXPENSE_CATS, MAX_CAT_NAME, MAX_ITEM_NAME, MAX_PLACE_NAME, clampDate, guessExpenseIcon, isDate, parseExpenseCats, parseExpenses, parsePlaces,
  todayKey, uniq,
} from './lib/expenses'
import { DEFAULT_TASK_KINDS, MAX_TASK_KIND_NAME, TASK_COLORS, UNKNOWN_TASK_KIND, cleanTask, guessTaskIcon, parseTaskKinds, parseTasks, type TaskInput } from './lib/tasks'

export type Clip = { mode: 'copy' | 'cut'; fromKey: string; item: Item }
export type ModalState =
  | { type: 'item'; key: string; editId?: string }
  | { type: 'move'; key: string; id: string }
  | { type: 'goal'; year: number; editId?: string; area?: GoalArea }
  | { type: 'kinds' }
  /** `openId`: the area to show unfolded. `add`: start with the cursor in the new-area box. */
  | { type: 'goalAreas'; openId?: string; add?: boolean }
  /** Add (no `editId`) or edit an expense. `date`: the day a new one starts on. */
  | { type: 'expense'; editId?: string; date?: string }
  /** Add (no `editId`) or edit a task. The rest is what a new one starts with (e.g. the time dragged out on the calendar). */
  | { type: 'task'; editId?: string; entry?: TaskType; date?: string; start?: number | null; duration?: number; kind?: string; title?: string }
  | null
export type PhoneCols = 1 | 2 | 3
export type View = 'planner' | 'plan' | 'favorites' | 'assets' | 'expenses' | 'calendar'
/** Assets page: which kind of item, and which years */
export type AssetCat = 'all' | Category
/** `month` (0–11) is used by the 'month' mode: one of the year's setups (see `setupMonths`). */
export type AssetPeriod = { mode: 'all' | 'year' | 'range' | 'month'; from: number; to: number; month: number }
/** Setups, by month ("2027-06"): vehicle id → the property it's kept at in that setup. Each setup stands on its own. */
export type Layouts = Record<string, Record<string, string>>
export type SourcePatch = Partial<Omit<IncomeSource, 'id' | 'createdAt' | 'steps'>>
export type MonthField = 'goal' | 'budget' | 'earned' | 'netWorthGoal'
/** Where to drop an item in a month's list: next to item `id`. Missing = at the end. */
export type DropAt = { id: string; after: boolean }
export type KindPatch = Partial<Omit<ItemKind, 'id'>>
export type AreaPatch = Partial<Omit<GoalAreaDef, 'id'>>
/** What's typed when adding / editing an expense: only the date and amount are needed. */
export type ExpenseInput = { date: string; amount: number; name?: string; category?: string; place?: string; notes?: string }
export type ExpenseCatPatch = Partial<Omit<ExpenseCategory, 'id'>>
export type TaskKindPatch = Partial<Omit<TaskKind, 'id'>>
export type ItemInput = { name: string; category: Category; trend: Trend; price: number; rate: number; notes?: string; propertyId?: string; running?: RunningCosts }

const OK: Result = { ok: true }
/** Tidies what was typed for an expense. */
function cleanExpense(d: ExpenseInput) {
  return {
    date: isDate(d.date) ? clampDate(d.date) : todayKey(),
    amount: Math.max(0, Math.round((Number(d.amount) || 0) * 100) / 100),
    name: (d.name ?? '').trim().slice(0, MAX_ITEM_NAME),
    category: d.category ?? '',
    place: (d.place ?? '').trim().slice(0, MAX_PLACE_NAME),
    notes: (d.notes ?? '').slice(0, 2000),
  }
}
/** A copy of `list` with the entry `id` moved to position `to` (or `list` itself when nothing moves). */
function moveTo<T extends { id: string }>(list: T[], id: string, to: number): T[] {
  const from = list.findIndex((x) => x.id === id)
  const at = Math.max(0, Math.min(list.length - 1, to))
  if (from < 0 || from === at) return list
  const next = [...list]
  next.splice(at, 0, ...next.splice(from, 1))
  return next
}
const fail = (error: string): Result => ({ ok: false, error })

export const emptyMonth = (): MonthData => ({ goal: 0, budget: 0, netWorthGoal: null, earned: null, items: [] })

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/**
 * Would an item of `price` push the month `key` past the money it has to spend (the money left going into
 * the month, capped by its budget)? A month with no budget isn't a problem by itself. Such items are still
 * allowed — they just get flagged in red so they can be moved.
 */
export function fitCheck(
  months: Record<string, MonthData>,
  key: string,
  price: number,
  excludeId?: string,
): { left: number; warning: string | null } {
  const m = { ...emptyMonth(), ...months[key] }
  // Money left before this month's items (doesn't depend on them, so excluding one changes nothing).
  const available = planOf(months)[indexOfKey(key)].available
  const spent = m.items.filter((i) => i.id !== excludeId).reduce((s, i) => s + i.price, 0)
  const after = spent + price
  const p = (n: number) => fmt(n, useStore.getState().currency.main.symbol)
  const why: string[] = []
  if (m.budget > 0 && after > m.budget + 1e-9) why.push(`this goes ${p(after - m.budget)} over the ${p(m.budget)} budget`)
  if (after > available + 1e-9) {
    why.push(available > 0 ? `this goes ${p(after - available)} over the ${p(available)} money left` : 'there is no money left')
  }
  return {
    left: spendLimit(m, available) - spent,
    warning: why.length ? `Not enough in ${labelOfKey(key)}: ${why.join(', and ')}. Marked red — move it to another month.` : null,
  }
}

/** Kinds that no longer exist, and what they became. "Other" was merged into "Status & Other". */
const OLD_CATEGORY: Record<string, Category> = { other: 'status' }
/** An item's kind, brought up to date and checked against `kinds` (unknown kinds go to the first one). */
const toCategory = (c: unknown, kinds: ItemKind[] = DEFAULT_KINDS): Category => {
  const id = OLD_CATEGORY[c as string] ?? c
  return kinds.some((k) => k.id === id) ? (id as Category) : kinds[0].id
}

export const MAX_KIND_NAME = 32

/** Cleans up item kinds coming from a backup file or the cloud. null = none saved (use the starter kinds). */
function parseKinds(list: unknown): ItemKind[] | null {
  if (!Array.isArray(list)) return null
  const seen = new Set<string>()
  const kinds: ItemKind[] = []
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || typeof x.label !== 'string' || seen.has(x.id)) continue
    seen.add(x.id)
    kinds.push({
      id: x.id,
      label: x.label.trim().slice(0, MAX_KIND_NAME) || 'Untitled',
      hint: typeof x.hint === 'string' ? x.hint.slice(0, 80) : '',
      icon: typeof x.icon === 'string' && x.icon in KIND_ICONS ? x.icon : 'box',
      color: typeof x.color === 'string' && x.color in KIND_COLORS ? x.color : 'slate',
    })
  }
  return kinds.length ? kinds : null
}

export const MAX_AREA_NAME = 40

/**
 * Cleans up goal areas coming from a backup file or the cloud. Older saves only have `areaLabels`
 * (custom names for the four fixed areas): those become the starter areas with the names applied.
 */
function parseGoalAreas(list: unknown, oldLabels?: unknown): GoalAreaDef[] {
  if (Array.isArray(list)) {
    const seen = new Set<string>()
    const areas: GoalAreaDef[] = []
    for (const x of list as Record<string, unknown>[]) {
      if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || typeof x.label !== 'string' || seen.has(x.id)) continue
      seen.add(x.id)
      areas.push({
        id: x.id,
        label: x.label.trim().slice(0, MAX_AREA_NAME) || 'Untitled',
        hint: typeof x.hint === 'string' ? x.hint.slice(0, 80) : '',
        icon: typeof x.icon === 'string' && x.icon in GOAL_ICONS ? x.icon : 'target',
        color: typeof x.color === 'string' && x.color in GOAL_COLORS ? x.color : 'slate',
      })
    }
    if (areas.length) return areas
  }
  const labels = oldLabels && typeof oldLabels === 'object' ? (oldLabels as Record<string, unknown>) : {}
  return DEFAULT_GOAL_AREAS.map((a) => {
    const l = labels[a.id]
    return typeof l === 'string' && l.trim() ? { ...a, label: l.trim().slice(0, MAX_AREA_NAME) } : a
  })
}

/** Drops "kept at" links that no longer make sense: only a vehicle can be kept, and only at a property. */
function cleanLinks(months: Record<string, MonthData>) {
  const kindOf = new Map<string, Category>()
  for (const m of Object.values(months)) for (const i of m.items) kindOf.set(i.id, i.category)
  const ok = (i: Item) => !i.propertyId || (i.category === 'vehicle' && kindOf.get(i.propertyId) === 'property')
  const out = { ...months }
  for (const [k, m] of Object.entries(months)) {
    if (m.items.every(ok)) continue
    out[k] = { ...m, items: m.items.map((i) => (ok(i) ? i : { ...i, propertyId: undefined })) }
  }
  return out
}

/** Saved months from an older version, with item kinds brought up to date. */
function migrateMonths(months: unknown) {
  if (!months || typeof months !== 'object') return months
  return Object.fromEntries(
    Object.entries(months as Record<string, MonthData>).map(([k, m]) => [
      k,
      m && Array.isArray(m.items) ? { ...m, items: m.items.map((i) => ({ ...i, category: toCategory(i.category) })) } : m,
    ]),
  )
}

const num = (v: unknown) => Math.max(0, Number(v) || 0)

/** Cleans up money plans coming from a backup file or the cloud. */
function parseSources(list: unknown): IncomeSource[] {
  if (!Array.isArray(list)) return []
  return list
    .filter((x): x is Record<string, unknown> => !!x && typeof x === 'object')
    .map((x) => ({
      id: typeof x.id === 'string' && x.id ? x.id : uid(),
      name: typeof x.name === 'string' ? x.name : '',
      kind: SOURCE_KINDS.includes(x.kind as SourceKind) ? (x.kind as SourceKind) : 'other',
      stage: SOURCE_STAGES.includes(x.stage as SourceStage) ? (x.stage as SourceStage) : 'idea',
      monthlyGoal: num(x.monthlyGoal),
      price: num(x.price),
      costPerSale: num(x.costPerSale),
      monthlyCosts: num(x.monthlyCosts),
      steps: Array.isArray(x.steps)
        ? (x.steps as Partial<PlanStep>[])
            .filter((st) => !!st && typeof st.text === 'string' && !!st.text.trim())
            .map((st) => ({ id: st.id || uid(), text: st.text!.trim(), done: !!st.done }))
        : [],
      notes: typeof x.notes === 'string' ? x.notes : '',
      createdAt: Number(x.createdAt) || Date.now(),
    }))
}

const warned = (key: string, price: number, months: Record<string, MonthData>, excludeId?: string): Result => {
  const { warning } = fitCheck(months, key, price, excludeId)
  return warning ? { ok: true, warning } : OK
}

interface State {
  months: Record<string, MonthData>
  /** Main currency (what amounts are in) and the alternative one they're also shown in */
  currency: Currencies
  year: number
  /** Overview shows the whole plan, or only the selected year */
  dashMode: 'plan' | 'year'
  clipboard: Clip | null
  modal: ModalState
  /** Yearly goals, keyed by year ("2027") */
  goals: Record<string, Goal[]>
  /** The areas goals can belong to (always at least one), in the order they're shown */
  goalAreas: GoalAreaDef[]
  /** Adds an area named `label` with a fitting icon and an unused colour. Returns its id. */
  addArea: (label: string) => string
  /** Adds back one of the starter areas that was deleted. */
  restoreArea: (id: string) => void
  updateArea: (id: string, patch: AreaPatch) => void
  /** Moves an area to position `to` in the list. */
  moveArea: (id: string, to: number) => void
  /** Deletes an area. Its goals (in every year) move to area `moveTo` (needed when it has any). The last area can't be deleted. */
  removeArea: (id: string, moveTo?: string) => Result
  /** Money plan: the ways I'm going to make the money */
  sources: IncomeSource[]
  /** The kinds items can be (always at least one), in the order they're shown */
  kinds: ItemKind[]
  /** Adds a kind named `label` with a fitting icon and an unused colour. Returns its id. */
  addKind: (label: string) => string
  /** Adds back one of the starter kinds that was deleted. */
  restoreKind: (id: string) => void
  updateKind: (id: string, patch: KindPatch) => void
  /** Moves a kind to position `to` in the list. */
  moveKind: (id: string, to: number) => void
  /** Deletes a kind. Its items move to kind `moveTo` (needed when it has any). The last kind can't be deleted. */
  removeKind: (id: string, moveTo?: string) => Result
  /** "YYYY-MM-DD", for showing my age on my birth month. null = not set. */
  birthday: string | null
  /** Free text for each year, keyed by year ("2027"), shown at the top of the year. Each mode has its own (see `modes`). */
  yearNotes: Record<string, string>
  setYearNote: (year: number, text: string) => void
  setBirthday: (b: string | null) => void

  /** Which page is showing */
  view: View
  /** Sidebar shown on wide screens (remembered) */
  sidebar: boolean
  /** Sidebar slid open on small screens (not remembered) */
  drawer: boolean
  /** Phones: show every month card unfolded instead of just the current one (remembered) */
  openAllMonths: boolean
  setOpenAllMonths: (on: boolean) => void
  /** Phones: how many columns the month and item grids show (pinch to change; remembered) */
  phoneCols: PhoneCols
  setPhoneCols: (cols: PhoneCols) => void
  setView: (v: View) => void
  assetCat: AssetCat
  assetPeriod: AssetPeriod
  setAssetCat: (c: AssetCat) => void
  /** The kind Assets opens on (only one; null = All). Remembered. */
  assetFavorite: Category | null
  setAssetFavorite: (c: Category | null) => void
  setAssetPeriod: (p: Partial<AssetPeriod>) => void
  setSidebar: (open: boolean) => void
  setDrawer: (open: boolean) => void

  setYear: (y: number) => void
  setMainCurrency: (patch: Partial<Currency>) => void
  setAltCurrency: (patch: Partial<AltCurrency>) => void
  setDashMode: (m: 'plan' | 'year') => void
  openModal: (m: ModalState) => void
  closeModal: () => void

  setMonthField: (key: string, field: MonthField, value: number | null) => void
  setMonthNotes: (key: string, notes: string) => void
  fillYear: (year: number, goal: number | null, budget: number | null, onlyEmpty: boolean) => void

  addItem: (key: string, data: ItemInput) => Result
  updateItem: (key: string, id: string, data: ItemInput) => Result
  removeItem: (key: string, id: string) => void
  /** Makes exactly `vehicleIds` the vehicles kept at property `propertyId` (others kept there are unassigned). */
  setVehiclesAt: (propertyId: string, vehicleIds: string[]) => void
  /** Keeps one vehicle at property `propertyId` (null = not kept anywhere). */
  keepVehicleAt: (vehicleId: string, propertyId: string | null) => void
  /** Vehicle setups: where each vehicle is kept, one separate version per setup month (see `setupMonths`) */
  layouts: Layouts
  /** Free text for each setup, keyed by its month ("2027-06"), shown with that setup only */
  setupNotes: Record<string, string>

  /**
   * Modes: separate versions of the plan, each with its own months (goals, budgets, items, so its own net worth and
   * assets), its own setups and its own year notes. Everything else (calendar, expenses, goals, money plan…) is shared.
   * The first is always the main plan (id 'main'). `months`, `layouts`, `setupNotes` and `yearNotes` above hold the mode in use;
   * `modeData` holds the others.
   */
  modes: ModeInfo[]
  modeId: string
  modeData: Record<string, ModeData>
  /** Opens another mode. */
  switchMode: (id: string) => void
  /** Adds a mode, empty or as a copy of the one in use, and opens it. Returns its id. */
  addMode: (name: string, copy: boolean) => string
  renameMode: (id: string, name: string) => void
  /** Deletes a mode and everything in it (not the main one). */
  removeMode: (id: string) => void
  setSetupNote: (monthKey: string, text: string) => void
  /** Puts a vehicle at a property in one setup (null = take it off / not placed). */
  setKeptAt: (monthKey: string, vehicleId: string, propertyId: string | null) => void
  /** Empties a setup. */
  resetLayout: (monthKey: string) => void
  /** Makes setup `to` a copy of `placements` (vehicle id → property id). */
  fillLayout: (monthKey: string, placements: Record<string, string>) => void
  /** Stars / unstars an item. Returns whether it is now a favorite. */
  toggleFavorite: (key: string, id: string) => boolean
  transferItem: (fromKey: string, id: string, toKey: string, mode: 'copy' | 'move', at?: DropAt) => Result

  copyToClipboard: (key: string, id: string, mode: 'copy' | 'cut') => void
  pasteInto: (key: string) => Result
  clearClipboard: () => void

  addGoal: (year: number, area: GoalArea, text: string) => void
  updateGoal: (year: number, id: string, patch: Partial<Pick<Goal, 'text' | 'area' | 'done'>>) => void
  removeGoal: (year: number, id: string) => void
  /** Moves a goal into `area`, next to goal `at` (or to the end of that area). */
  moveGoal: (year: number, id: string, area: GoalArea, at?: DropAt) => void
  /** Copies this year's unfinished goals into the next year (skipping ones already there). Returns how many were copied. */
  carryOverGoals: (year: number) => number

  addSource: (kind: SourceKind) => string
  updateSource: (id: string, patch: SourcePatch) => void
  removeSource: (id: string) => void
  /** Moves a plan to position `to` in the list. */
  moveSource: (id: string, to: number) => void
  addStep: (sourceId: string, text: string) => void
  updateStep: (sourceId: string, stepId: string, patch: Partial<Omit<PlanStep, 'id'>>) => void
  removeStep: (sourceId: string, stepId: string) => void
  /** Moves a step to position `to` in its plan's list. */
  moveStep: (sourceId: string, stepId: string, to: number) => void

  /** Expenses: money spent, day by day */
  expenses: Expense[]
  /** Spending categories (Food, Bills…), in the order they're shown */
  expenseCats: ExpenseCategory[]
  /** Places the user saved as ones they go to often, in order */
  places: string[]
  addExpense: (data: ExpenseInput) => string
  updateExpense: (id: string, data: ExpenseInput) => void
  /** Deletes an expense and returns it (so it can be put back). */
  removeExpense: (id: string) => Expense | undefined
  /** Puts back a deleted expense. */
  restoreExpense: (e: Expense) => void
  /** Adds a category with a fitting icon and an unused colour. Returns its id. */
  addExpenseCat: (label: string) => string
  /** Adds back one of the starter categories that was deleted. */
  restoreExpenseCat: (id: string) => void
  updateExpenseCat: (id: string, patch: ExpenseCatPatch) => void
  moveExpenseCat: (id: string, to: number) => void
  /** Deletes a category. Its expenses move to `moveTo`, or to no category. */
  removeExpenseCat: (id: string, moveTo?: string) => void
  addPlace: (name: string) => void
  removePlace: (name: string) => void
  /** Renames a place, in your saved places and in every expense that used it. Returns how many expenses changed. */
  renamePlace: (from: string, to: string) => number

  /** Calendar & to-dos */
  tasks: Task[]
  /** Kinds of tasks (School, Work…), each with its own colour, in the order they're shown (always at least one) */
  taskKinds: TaskKind[]
  addTask: (data: TaskInput) => string
  /** Changes some of a task's fields (e.g. its time, when dragged on the calendar). */
  updateTask: (id: string, patch: Partial<TaskInput>) => void
  /** Deletes a task and returns it (so it can be put back). */
  removeTask: (id: string) => Task | undefined
  restoreTask: (t: Task) => void
  /** Ticks a task off or back on. Repeating tasks are ticked one day (`day`) at a time. Returns whether it is now done. */
  toggleTask: (id: string, day?: string) => boolean
  /** Adds a kind of task with a fitting icon and an unused colour. Returns its id. */
  addTaskKind: (label: string) => string
  /** Adds back one of the starter kinds that was deleted. */
  restoreTaskKind: (id: string) => void
  updateTaskKind: (id: string, patch: TaskKindPatch) => void
  moveTaskKind: (id: string, to: number) => void
  /** Deletes a kind. Its tasks move to `moveTo` (or the first kind left). The last kind can't be deleted. */
  removeTaskKind: (id: string, moveTo?: string) => Result

  importData: (data: unknown) => Result
  resetAll: () => void
}

// The app used to be called Dezire, then Obssezion, Obseszion, Viszionary and Dezayr: what a browser saved under an old name carries over once.
try {
  const KEY = 'dizayr-goal-planner-v1'
  for (const oldKey of ['dezayr-goal-planner-v1', 'viszionary-goal-planner-v1', 'obseszion-goal-planner-v1', 'obssezion-goal-planner-v1', 'dezire-goal-planner-v1']) {
    const old = localStorage.getItem(oldKey)
    if (old && !localStorage.getItem(KEY)) localStorage.setItem(KEY, old)
    if (old) localStorage.removeItem(oldKey)
  }
  // Remembered choices (calendar view, expense period…) too.
  for (const prefix of ['dezayr-', 'viszionary-', 'obseszion-']) {
    for (const oldKey of Object.keys(localStorage).filter((k) => k.startsWith(prefix))) {
      const key = 'dizayr-' + oldKey.slice(prefix.length)
      if (localStorage.getItem(key) === null) localStorage.setItem(key, localStorage.getItem(oldKey)!)
      localStorage.removeItem(oldKey)
    }
  }
} catch {
  // Storage blocked: nothing to carry over.
}

// Modes (see `modes` in State): the main plan's id, and the starting values. Defined before the store, which uses them.
export const MAIN_MODE = 'main'
export const MAX_MODE_NAME = 32
const mainMode = (): ModeInfo => ({ id: MAIN_MODE, name: 'Main', createdAt: 0 })
const emptyMode = (): ModeData => ({ months: {}, layouts: {}, setupNotes: {}, yearNotes: {} })

/**
 * Saves to this browser a moment after the last change instead of on every one. The whole state is written each time,
 * and with years of items, expenses and tasks that's slow enough to make clicks and typing stutter.
 * Anything not yet written is saved right away when the tab is hidden or closed.
 */
function lazyStorage<S>(delay = 500): PersistStorage<S> {
  let pending: { name: string; value: StorageValue<S> } | null = null
  let timer: ReturnType<typeof setTimeout> | undefined
  const flush = () => {
    clearTimeout(timer)
    if (!pending) return
    const { name, value } = pending
    pending = null
    try {
      localStorage.setItem(name, JSON.stringify(value))
    } catch {
      // Storage full or blocked: the cloud copy still has everything.
    }
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flush())
  }
  // When the browser is idle, so the write never lands in the middle of an animation.
  const idle = (fn: () => void) => ('requestIdleCallback' in window ? window.requestIdleCallback(fn, { timeout: 1000 }) : setTimeout(fn, 0))
  return {
    getItem: (name) => {
      try {
        const raw = localStorage.getItem(name)
        return raw ? (JSON.parse(raw) as StorageValue<S>) : null
      } catch {
        return null
      }
    },
    setItem: (name, value) => {
      pending = { name, value }
      clearTimeout(timer)
      timer = setTimeout(() => idle(flush), delay)
    },
    removeItem: (name) => {
      pending = null
      clearTimeout(timer)
      try {
        localStorage.removeItem(name)
      } catch {
        // Nothing to remove.
      }
    },
  }
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      months: {},
      currency: DEFAULT_CURRENCIES,
      expenses: [],
      expenseCats: DEFAULT_EXPENSE_CATS,
      places: [],
      year: currentYear(),
      dashMode: 'plan',
      clipboard: null,
      modal: null,
      goals: {},
      goalAreas: DEFAULT_GOAL_AREAS,
      sources: [],
      kinds: DEFAULT_KINDS,
      birthday: null,
      setBirthday: (b) => set({ birthday: b && /^\d{4}-\d{2}-\d{2}$/.test(b) ? b : null }),
      yearNotes: {},
      setYearNote: (year, text) =>
        set((s) => {
          const { [year]: _old, ...rest } = s.yearNotes
          return { yearNotes: text ? { ...rest, [year]: text } : rest }
        }),
      view: 'planner',
      sidebar: true,
      drawer: false,
      openAllMonths: false,
      setOpenAllMonths: (openAllMonths) => set({ openAllMonths }),
      phoneCols: 1,
      setPhoneCols: (phoneCols) => set({ phoneCols }),

      setView: (view) => set({ view }),
      assetCat: 'all',
      assetPeriod: { mode: 'all', from: currentYear(), to: Math.min(END_YEAR, currentYear() + 4), month: new Date().getMonth() },
      setAssetCat: (assetCat) => set({ assetCat }),
      assetFavorite: null,
      setAssetFavorite: (assetFavorite) => set({ assetFavorite }),
      setAssetPeriod: (p) =>
        set((s) => {
          const clamp = (y: number) => Math.min(END_YEAR, Math.max(START_YEAR, y))
          const next = { ...s.assetPeriod, ...p }
          const from = clamp(Math.min(next.from, next.to))
          const to = clamp(Math.max(next.from, next.to))
          const month = Math.min(11, Math.max(0, Math.round(Number(next.month ?? new Date().getMonth()) || 0)))
          return { assetPeriod: { mode: next.mode, from, to, month } }
        }),
      setSidebar: (sidebar) => set({ sidebar }),
      setDrawer: (drawer) => set({ drawer }),

      setYear: (year) => set({ year: Math.min(END_YEAR, Math.max(START_YEAR, year)) }),
      setMainCurrency: (patch) => set((s) => ({ currency: parseCurrencies({ ...s.currency, main: { ...s.currency.main, ...patch } }) })),
      setAltCurrency: (patch) => set((s) => ({ currency: parseCurrencies({ ...s.currency, alt: { ...s.currency.alt, ...patch } }) })),
      setDashMode: (dashMode) => set({ dashMode }),
      openModal: (modal) => set({ modal }),
      closeModal: () => set({ modal: null }),

      setMonthField: (key, field, value) =>
        set((s) => {
          const m = s.months[key] ?? emptyMonth()
          const v = field === 'earned' || field === 'netWorthGoal' ? value : (value ?? 0)
          return { months: { ...s.months, [key]: { ...m, [field]: v } } }
        }),

      setMonthNotes: (key, notes) =>
        set((s) => ({ months: { ...s.months, [key]: { ...(s.months[key] ?? emptyMonth()), notes } } })),

      fillYear: (year, goal, budget, onlyEmpty) =>
        set((s) => {
          const next = { ...s.months }
          for (let mo = 0; mo < 12; mo++) {
            const key = keyOf(indexOf(year, mo))
            const m = next[key] ?? emptyMonth()
            next[key] = {
              ...m,
              goal: goal !== null && (!onlyEmpty || m.goal === 0) ? goal : m.goal,
              budget: budget !== null && (!onlyEmpty || m.budget === 0) ? budget : m.budget,
            }
          }
          return { months: next }
        }),

      addKind: (label) => {
        const { kinds } = get()
        const name = label.trim().slice(0, MAX_KIND_NAME) || 'New kind'
        const used = new Set(kinds.map((k) => k.color))
        const colors = Object.keys(KIND_COLORS)
        const color = colors.find((c) => !used.has(c)) ?? colors[kinds.length % colors.length]
        const kind: ItemKind = { id: uid(), label: name, hint: '', icon: guessIcon(name), color }
        set({ kinds: [...kinds, kind] })
        return kind.id
      },

      restoreKind: (id) =>
        set((s) => {
          const kind = DEFAULT_KINDS.find((k) => k.id === id)
          return kind && !s.kinds.some((k) => k.id === id) ? { kinds: [...s.kinds, kind] } : {}
        }),

      updateKind: (id, patch) =>
        set((s) => ({
          kinds: s.kinds.map((k) =>
            k.id === id
              ? {
                  ...k,
                  ...patch,
                  label: patch.label === undefined ? k.label : patch.label.trim().slice(0, MAX_KIND_NAME) || k.label,
                  hint: patch.hint === undefined ? k.hint : patch.hint.slice(0, 80),
                }
              : k,
          ),
        })),

      moveKind: (id, to) =>
        set((s) => {
          const from = s.kinds.findIndex((k) => k.id === id)
          if (from < 0 || from === to) return {}
          const kinds = [...s.kinds]
          const [kind] = kinds.splice(from, 1)
          kinds.splice(Math.max(0, Math.min(kinds.length, to)), 0, kind)
          return { kinds }
        }),

      removeKind: (id, moveTo) => {
        const { kinds, months, assetCat } = get()
        if (kinds.length <= 1) return fail('You need at least one kind of item.')
        const used = Object.values(months).some((m) => m.items.some((i) => i.category === id))
        if (used && (!moveTo || moveTo === id || !kinds.some((k) => k.id === moveTo))) return fail('Pick a kind to move its items to first.')
        let next = months
        if (used) {
          next = { ...months }
          for (const [k, m] of Object.entries(months)) {
            if (m.items.some((i) => i.category === id)) next[k] = { ...m, items: m.items.map((i) => (i.category === id ? { ...i, category: moveTo! } : i)) }
          }
          next = cleanLinks(next)
        }
        set({
          kinds: kinds.filter((k) => k.id !== id),
          months: next,
          ...(assetCat === id ? { assetCat: 'all' as const } : {}),
          ...(get().assetFavorite === id ? { assetFavorite: null } : {}),
        })
        return OK
      },

      addItem: (key, data) => {
        const { months } = get()
        const m = months[key] ?? emptyMonth()
        const item: Item = { ...data, id: uid(), createdAt: Date.now() }
        set({ months: { ...months, [key]: { ...m, items: [...m.items, item] } } })
        return { ...warned(key, data.price, months), id: item.id }
      },

      setVehiclesAt: (propertyId, vehicleIds) =>
        set((s) => {
          const want = new Set(vehicleIds)
          const months = { ...s.months }
          for (const [k, m] of Object.entries(months)) {
            let changed = false
            const items = m.items.map((i) => {
              if (i.category !== 'vehicle') return i
              const here = i.propertyId === propertyId
              if (want.has(i.id) && !here) return (changed = true), { ...i, propertyId }
              if (!want.has(i.id) && here) return (changed = true), { ...i, propertyId: undefined }
              return i
            })
            if (changed) months[k] = { ...m, items }
          }
          return { months }
        }),

      layouts: {},
      setupNotes: {},
      modes: [mainMode()],
      modeId: MAIN_MODE,
      modeData: {},
      switchMode: (id) =>
        set((s) => {
          if (id === s.modeId || !s.modes.some((m) => m.id === id)) return {}
          // Modes saved before they had their own year notes don't have `yearNotes`.
          const next = { ...emptyMode(), ...s.modeData[id] }
          const { [id]: _opened, ...rest } = s.modeData
          return {
            modeId: id,
            months: next.months,
            layouts: next.layouts,
            setupNotes: next.setupNotes,
            yearNotes: next.yearNotes,
            modeData: { ...rest, [s.modeId]: { months: s.months, layouts: s.layouts, setupNotes: s.setupNotes, yearNotes: s.yearNotes } },
            // Something cut in the other mode can't be moved from here; a copy still pastes.
            clipboard: s.clipboard?.mode === 'cut' ? null : s.clipboard,
          }
        }),
      addMode: (name, copy) => {
        const s = get()
        const mode: ModeInfo = { id: uid(), name: name.trim().slice(0, MAX_MODE_NAME) || `Mode ${s.modes.length + 1}`, createdAt: Date.now() }
        const data: ModeData = copy
          ? { months: structuredClone(s.months), layouts: structuredClone(s.layouts), setupNotes: { ...s.setupNotes }, yearNotes: { ...s.yearNotes } }
          : emptyMode()
        set({ modes: [...s.modes, mode], modeData: { ...s.modeData, [mode.id]: data } })
        get().switchMode(mode.id)
        return mode.id
      },
      renameMode: (id, name) =>
        set((s) => ({ modes: s.modes.map((m) => (m.id === id ? { ...m, name: name.trim().slice(0, MAX_MODE_NAME) || m.name } : m)) })),
      removeMode: (id) => {
        if (id === MAIN_MODE) return
        if (get().modeId === id) get().switchMode(MAIN_MODE)
        set((s) => {
          const { [id]: _gone, ...rest } = s.modeData
          return { modes: s.modes.filter((m) => m.id !== id), modeData: rest }
        })
      },
      setSetupNote: (monthKey, text) =>
        set((s) => {
          const { [monthKey]: _old, ...rest } = s.setupNotes
          return { setupNotes: text ? { ...rest, [monthKey]: text } : rest }
        }),
      setKeptAt: (monthKey, vehicleId, propertyId) =>
        set((s) => {
          const { [vehicleId]: _old, ...rest } = s.layouts[monthKey] ?? {}
          return { layouts: { ...s.layouts, [monthKey]: propertyId ? { ...rest, [vehicleId]: propertyId } : rest } }
        }),
      fillLayout: (monthKey, placements) => set((s) => ({ layouts: { ...s.layouts, [monthKey]: { ...placements } } })),
      resetLayout: (monthKey) =>
        set((s) => {
          if (!s.layouts[monthKey]) return {}
          const { [monthKey]: _gone, ...rest } = s.layouts
          return { layouts: rest }
        }),

      keepVehicleAt: (vehicleId, propertyId) =>
        set((s) => {
          for (const [k, m] of Object.entries(s.months)) {
            const at = m.items.findIndex((i) => i.id === vehicleId && i.category === 'vehicle')
            if (at < 0) continue
            const items = [...m.items]
            items[at] = { ...items[at], propertyId: propertyId ?? undefined }
            return { months: { ...s.months, [k]: { ...m, items } } }
          }
          return {}
        }),

      updateItem: (key, id, data) => {
        const { months } = get()
        const m = months[key] ?? emptyMonth()
        set({
          months: { ...months, [key]: { ...m, items: m.items.map((i) => (i.id === id ? { ...i, ...data } : i)) } },
        })
        return warned(key, data.price, months, id)
      },

      toggleFavorite: (key, id) => {
        const m = get().months[key]
        const item = m?.items.find((i) => i.id === id)
        if (!m || !item) return false
        const favorite = !item.favorite
        set((s) => ({
          months: {
            ...s.months,
            [key]: { ...m, items: m.items.map((i) => (i.id === id ? { ...i, favorite } : i)) },
          },
        }))
        return favorite
      },

      removeItem: (key, id) =>
        set((s) => {
          const m = s.months[key]
          if (!m) return {}
          const clipboard = s.clipboard?.mode === 'cut' && s.clipboard.item.id === id ? null : s.clipboard
          const months = { ...s.months, [key]: { ...m, items: m.items.filter((i) => i.id !== id) } }
          // Vehicles kept at a deleted property are no longer kept anywhere.
          for (const [k, mo] of Object.entries(months)) {
            if (mo.items.some((i) => i.propertyId === id)) {
              months[k] = { ...mo, items: mo.items.map((i) => (i.propertyId === id ? { ...i, propertyId: undefined } : i)) }
            }
          }
          return { months, clipboard }
        }),

      transferItem: (fromKey, id, toKey, mode, at) => {
        const { months } = get()
        const src = months[fromKey]
        const item = src?.items.find((i) => i.id === id)
        if (!src || !item) return fail('That item no longer exists.')
        if (mode === 'move' && at?.id === id) return OK
        const next = { ...months }
        if (mode === 'move') next[fromKey] = { ...src, items: src.items.filter((i) => i.id !== id) }
        const dest = next[toKey] ?? emptyMonth()
        const moved = mode === 'move' ? item : { ...item, id: uid(), createdAt: Date.now() }
        const items = [...dest.items]
        const ti = at ? items.findIndex((i) => i.id === at.id) : -1
        if (ti < 0) items.push(moved)
        else items.splice(ti + (at!.after ? 1 : 0), 0, moved)
        next[toKey] = { ...dest, items }
        set({ months: next })
        // Reordering inside the same month doesn't change what it spends
        if (mode === 'move' && fromKey === toKey) return OK
        return warned(toKey, item.price, months)
      },

      copyToClipboard: (key, id, mode) => {
        const item = get().months[key]?.items.find((i) => i.id === id)
        if (item) set({ clipboard: { mode, fromKey: key, item } })
      },

      pasteInto: (toKey) => {
        const { clipboard, months } = get()
        if (!clipboard) return fail('Nothing copied yet.')
        const stillThere = months[clipboard.fromKey]?.items.some((i) => i.id === clipboard.item.id)
        if (clipboard.mode === 'cut' && stillThere) {
          const r = get().transferItem(clipboard.fromKey, clipboard.item.id, toKey, 'move')
          if (r.ok) set({ clipboard: null })
          return r
        }
        const dest = months[toKey] ?? emptyMonth()
        const copy = { ...clipboard.item, id: uid(), createdAt: Date.now() }
        set({
          months: { ...months, [toKey]: { ...dest, items: [...dest.items, copy] } },
          clipboard: clipboard.mode === 'cut' ? null : clipboard,
        })
        return warned(toKey, clipboard.item.price, months)
      },

      clearClipboard: () => set({ clipboard: null }),

      addGoal: (year, area, text) =>
        set((s) => {
          const goal: Goal = { id: uid(), text: text.trim(), area, done: false, createdAt: Date.now() }
          return { goals: { ...s.goals, [year]: [...(s.goals[year] ?? []), goal] } }
        }),

      updateGoal: (year, id, patch) =>
        set((s) => ({
          goals: { ...s.goals, [year]: (s.goals[year] ?? []).map((g) => (g.id === id ? { ...g, ...patch } : g)) },
        })),

      moveGoal: (year, id, area, at) =>
        set((s) => {
          const list = s.goals[year] ?? []
          const goal = list.find((g) => g.id === id)
          if (!goal || at?.id === id) return {}
          const rest = list.filter((g) => g.id !== id)
          let i = at ? rest.findIndex((g) => g.id === at.id) : -1
          if (i < 0) {
            // End of the area: right after its last goal.
            const last = rest.map((g) => g.area).lastIndexOf(area)
            i = last < 0 ? rest.length : last + 1
          } else if (at!.after) i++
          rest.splice(i, 0, { ...goal, area })
          return { goals: { ...s.goals, [year]: rest } }
        }),

      removeGoal: (year, id) =>
        set((s) => ({ goals: { ...s.goals, [year]: (s.goals[year] ?? []).filter((g) => g.id !== id) } })),

      carryOverGoals: (year) => {
        const { goals } = get()
        const next = goals[year + 1] ?? []
        const seen = new Set(next.map((g) => `${g.area}|${g.text.toLowerCase()}`))
        const copies = (goals[year] ?? [])
          .filter((g) => !g.done && !seen.has(`${g.area}|${g.text.toLowerCase()}`))
          .map((g) => ({ ...g, id: uid(), createdAt: Date.now() }))
        if (copies.length) set({ goals: { ...goals, [year + 1]: [...next, ...copies] } })
        return copies.length
      },

      addArea: (label) => {
        const { goalAreas } = get()
        const name = label.trim().slice(0, MAX_AREA_NAME) || 'New area'
        const used = new Set(goalAreas.map((a) => a.color))
        const colors = Object.keys(GOAL_COLORS)
        const color = colors.find((c) => !used.has(c)) ?? colors[goalAreas.length % colors.length]
        const area: GoalAreaDef = { id: uid(), label: name, hint: '', icon: guessAreaIcon(name), color }
        set({ goalAreas: [...goalAreas, area] })
        return area.id
      },

      restoreArea: (id) =>
        set((s) => {
          const area = DEFAULT_GOAL_AREAS.find((a) => a.id === id)
          return area && !s.goalAreas.some((a) => a.id === id) ? { goalAreas: [...s.goalAreas, area] } : {}
        }),

      updateArea: (id, patch) =>
        set((s) => ({
          goalAreas: s.goalAreas.map((a) =>
            a.id === id
              ? {
                  ...a,
                  ...patch,
                  label: patch.label === undefined ? a.label : patch.label.trim().slice(0, MAX_AREA_NAME) || a.label,
                  hint: patch.hint === undefined ? a.hint : patch.hint.slice(0, 80),
                }
              : a,
          ),
        })),

      moveArea: (id, to) =>
        set((s) => {
          const from = s.goalAreas.findIndex((a) => a.id === id)
          if (from < 0 || from === to) return {}
          const goalAreas = [...s.goalAreas]
          const [area] = goalAreas.splice(from, 1)
          goalAreas.splice(Math.max(0, Math.min(goalAreas.length, to)), 0, area)
          return { goalAreas }
        }),

      removeArea: (id, moveTo) => {
        const { goalAreas, goals } = get()
        if (goalAreas.length <= 1) return fail('You need at least one goal area.')
        const used = Object.values(goals).some((list) => list.some((g) => g.area === id))
        if (used && (!moveTo || moveTo === id || !goalAreas.some((a) => a.id === moveTo))) return fail('Pick an area to move its goals to first.')
        let next = goals
        if (used) {
          next = { ...goals }
          for (const [y, list] of Object.entries(goals)) {
            if (list.some((g) => g.area === id)) next[y] = list.map((g) => (g.area === id ? { ...g, area: moveTo! } : g))
          }
        }
        set({ goalAreas: goalAreas.filter((a) => a.id !== id), goals: next })
        return OK
      },

      addSource: (kind) => {
        const source: IncomeSource = {
          id: uid(), name: '', kind, stage: 'idea', monthlyGoal: 0, price: 0, costPerSale: 0, monthlyCosts: 0,
          steps: [], notes: '', createdAt: Date.now(),
        }
        set((s) => ({ sources: [...s.sources, source] }))
        return source.id
      },

      updateSource: (id, patch) =>
        set((s) => ({ sources: s.sources.map((x) => (x.id === id ? { ...x, ...patch } : x)) })),

      removeSource: (id) => set((s) => ({ sources: s.sources.filter((x) => x.id !== id) })),
      moveSource: (id, to) => set((s) => ({ sources: moveTo(s.sources, id, to) })),

      addStep: (sourceId, text) => {
        const clean = text.trim()
        if (!clean) return
        set((s) => ({
          sources: s.sources.map((x) =>
            x.id === sourceId ? { ...x, steps: [...x.steps, { id: uid(), text: clean, done: false }] } : x,
          ),
        }))
      },

      updateStep: (sourceId, stepId, patch) =>
        set((s) => ({
          sources: s.sources.map((x) =>
            x.id === sourceId ? { ...x, steps: x.steps.map((st) => (st.id === stepId ? { ...st, ...patch } : st)) } : x,
          ),
        })),

      moveStep: (sourceId, stepId, to) =>
        set((s) => ({ sources: s.sources.map((x) => (x.id === sourceId ? { ...x, steps: moveTo(x.steps, stepId, to) } : x)) })),
      removeStep: (sourceId, stepId) =>
        set((s) => ({
          sources: s.sources.map((x) => (x.id === sourceId ? { ...x, steps: x.steps.filter((st) => st.id !== stepId) } : x)),
        })),

      addExpense: (data) => {
        // Short ids: there can be thousands of expenses, and they all live in one saved document.
        const e: Expense = { id: Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4), ...cleanExpense(data), createdAt: Date.now() }
        set((s) => ({ expenses: [...s.expenses, e] }))
        return e.id
      },
      updateExpense: (id, data) => set((s) => ({ expenses: s.expenses.map((e) => (e.id === id ? { ...e, ...cleanExpense(data) } : e)) })),
      removeExpense: (id) => {
        const e = get().expenses.find((x) => x.id === id)
        if (e) set((s) => ({ expenses: s.expenses.filter((x) => x.id !== id) }))
        return e
      },
      restoreExpense: (e) => set((s) => (s.expenses.some((x) => x.id === e.id) ? {} : { expenses: [...s.expenses, e] })),

      addExpenseCat: (label) => {
        const cats = get().expenseCats
        const name = label.trim().slice(0, MAX_CAT_NAME) || 'New category'
        const used = new Set(cats.map((c) => c.color))
        const colors = Object.keys(KIND_COLORS)
        const color = colors.find((c) => !used.has(c)) ?? colors[cats.length % colors.length]
        const cat: ExpenseCategory = { id: uid(), label: name, icon: guessExpenseIcon(name), color, items: [] }
        set({ expenseCats: [...cats, cat] })
        return cat.id
      },
      restoreExpenseCat: (id) =>
        set((s) => {
          const cat = DEFAULT_EXPENSE_CATS.find((c) => c.id === id)
          return cat && !s.expenseCats.some((c) => c.id === id) ? { expenseCats: [...s.expenseCats, cat] } : {}
        }),
      updateExpenseCat: (id, patch) =>
        set((s) => ({
          expenseCats: s.expenseCats.map((c) =>
            c.id === id
              ? {
                  ...c,
                  ...patch,
                  label: patch.label === undefined ? c.label : patch.label.slice(0, MAX_CAT_NAME) || c.label,
                  items: patch.items === undefined ? c.items : uniq(patch.items.map((i) => i.trim().slice(0, MAX_ITEM_NAME))),
                }
              : c,
          ),
        })),
      moveExpenseCat: (id, to) => set((s) => ({ expenseCats: moveTo(s.expenseCats, id, to) })),
      removeExpenseCat: (id, to) =>
        set((s) => {
          const target = to && to !== id && s.expenseCats.some((c) => c.id === to) ? to : ''
          return {
            expenseCats: s.expenseCats.filter((c) => c.id !== id),
            expenses: s.expenses.some((e) => e.category === id) ? s.expenses.map((e) => (e.category === id ? { ...e, category: target } : e)) : s.expenses,
          }
        }),
      addPlace: (name) =>
        set((s) => {
          const p = name.trim().slice(0, MAX_PLACE_NAME)
          return p && !s.places.some((x) => x.toLowerCase() === p.toLowerCase()) ? { places: [...s.places, p] } : {}
        }),
      removePlace: (name) => set((s) => ({ places: s.places.filter((x) => x.toLowerCase() !== name.trim().toLowerCase()) })),
      renamePlace: (from, to) => {
        const name = to.trim().slice(0, MAX_PLACE_NAME)
        const old = from.trim().toLowerCase()
        if (!name || !old || name === from) return 0
        const { places, expenses } = get()
        const used = expenses.filter((e) => e.place.toLowerCase() === old).length
        // Renamed to a place that's already saved: they become one (uniq keeps the first).
        set({
          places: uniq(places.map((p) => (p.toLowerCase() === old ? name : p))),
          expenses: used ? expenses.map((e) => (e.place.toLowerCase() === old ? { ...e, place: name } : e)) : expenses,
        })
        return used
      },

      tasks: [],
      taskKinds: DEFAULT_TASK_KINDS,
      addTask: (data) => {
        const t: Task = { id: uid(), ...cleanTask(data), done: false, doneOn: [], createdAt: Date.now() }
        set((s) => ({ tasks: [...s.tasks, t] }))
        return t.id
      },
      updateTask: (id, patch) =>
        set((s) => ({
          tasks: s.tasks.map((t) => {
            if (t.id !== id) return t
            const next = { ...t, ...cleanTask({ ...t, ...patch }) }
            // A task that stops repeating forgets the days it was ticked off.
            return next.repeat ? next : { ...next, doneOn: [] }
          }),
        })),
      removeTask: (id) => {
        const t = get().tasks.find((x) => x.id === id)
        if (t) set((s) => ({ tasks: s.tasks.filter((x) => x.id !== id) }))
        return t
      },
      restoreTask: (t) => set((s) => (s.tasks.some((x) => x.id === t.id) ? {} : { tasks: [...s.tasks, t] })),
      toggleTask: (id, day) => {
        const t = get().tasks.find((x) => x.id === id)
        if (!t) return false
        const next: Task =
          t.repeat && day ? { ...t, doneOn: t.doneOn.includes(day) ? t.doneOn.filter((k) => k !== day) : [...t.doneOn, day].sort() } : { ...t, done: !t.done }
        set((s) => ({ tasks: s.tasks.map((x) => (x.id === id ? next : x)) }))
        return next.repeat && day ? next.doneOn.includes(day) : next.done
      },
      addTaskKind: (label) => {
        const kinds = get().taskKinds
        const name = label.trim().slice(0, MAX_TASK_KIND_NAME) || 'New kind'
        const used = new Set(kinds.map((k) => k.color))
        const colors = Object.keys(TASK_COLORS)
        const color = colors.find((c) => !used.has(c)) ?? colors[kinds.length % colors.length]
        const kind: TaskKind = { id: uid(), label: name, icon: guessTaskIcon(name), color }
        set({ taskKinds: [...kinds, kind] })
        return kind.id
      },
      restoreTaskKind: (id) =>
        set((s) => {
          const kind = DEFAULT_TASK_KINDS.find((k) => k.id === id)
          return kind && !s.taskKinds.some((k) => k.id === id) ? { taskKinds: [...s.taskKinds, kind] } : {}
        }),
      updateTaskKind: (id, patch) =>
        set((s) => ({
          taskKinds: s.taskKinds.map((k) =>
            k.id === id ? { ...k, ...patch, label: patch.label === undefined ? k.label : patch.label.trim().slice(0, MAX_TASK_KIND_NAME) || k.label } : k,
          ),
        })),
      moveTaskKind: (id, to) => set((s) => ({ taskKinds: moveTo(s.taskKinds, id, to) })),
      removeTaskKind: (id, to) => {
        const { taskKinds, tasks } = get()
        if (taskKinds.length <= 1) return fail('You need at least one kind of task.')
        const left = taskKinds.filter((k) => k.id !== id)
        const target = to && left.some((k) => k.id === to) ? to : left[0].id
        set({
          taskKinds: left,
          tasks: tasks.some((t) => t.kind === id) ? tasks.map((t) => (t.kind === id ? { ...t, kind: target } : t)) : tasks,
        })
        return OK
      },

      importData: (data) => {
        try {
          const d = data as {
            months?: Record<string, Partial<MonthData>>
            usdRate?: number
            currency?: unknown
            goals?: Record<string, Partial<Goal>[]>
            goalAreas?: unknown
            areaLabels?: Record<string, unknown>
            sources?: unknown
            birthday?: unknown
            yearNotes?: unknown
            kinds?: unknown
            expenses?: unknown
            expenseCats?: unknown
            places?: unknown
            layouts?: unknown
            setupNotes?: unknown
            tasks?: unknown
            taskKinds?: unknown
            modes?: unknown
          }
          if (!d || typeof d !== 'object' || !d.months || typeof d.months !== 'object') {
            return fail('That file is not a Dizayr backup.')
          }
          const kinds = parseKinds(d.kinds) ?? DEFAULT_KINDS
          const months = parseMonths(d.months, kinds)
          const goalAreas = parseGoalAreas(d.goalAreas, d.areaLabels)
          const isArea = (a: unknown): a is GoalArea => goalAreas.some((x) => x.id === a)
          const goals: Record<string, Goal[]> = {}
          for (const [year, list] of Object.entries(d.goals ?? {})) {
            if (!/^\d{4}$/.test(year) || !Array.isArray(list)) continue
            goals[year] = list
              .filter((g) => g && typeof g.text === 'string' && g.text.trim())
              .map((g) => ({
                id: g.id || uid(),
                text: String(g.text).trim(),
                area: isArea(g.area) ? g.area : goalAreas[goalAreas.length - 1].id,
                done: !!g.done,
                createdAt: Number(g.createdAt) || Date.now(),
              }))
          }
          const birthday = typeof d.birthday === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d.birthday) ? d.birthday : null
          // Saves from before Expenses existed don't have them: keep what's here instead of wiping it.
          const cur = get()
          const spending = {
            expenses: d.expenses === undefined ? cur.expenses : parseExpenses(d.expenses),
            expenseCats: d.expenseCats === undefined ? cur.expenseCats : (parseExpenseCats(d.expenseCats) ?? DEFAULT_EXPENSE_CATS),
            places: d.places === undefined ? cur.places : parsePlaces(d.places),
            tasks: d.tasks === undefined ? cur.tasks : parseTasks(d.tasks),
            taskKinds: d.taskKinds === undefined ? cur.taskKinds : (parseTaskKinds(d.taskKinds) ?? DEFAULT_TASK_KINDS),
          }
          // Modes: the main plan is saved at the top (as before modes existed), the others in `modes`.
          const curAll = allModes(cur)
          const main: ModeData = {
            months,
            layouts: d.layouts === undefined ? curAll.data[MAIN_MODE].layouts : parseLayouts(d.layouts),
            setupNotes: d.setupNotes === undefined ? curAll.data[MAIN_MODE].setupNotes : parseSetupNotes(d.setupNotes),
            yearNotes: parseYearNotes(d.yearNotes),
          }
          // Saved by a version without modes: keep the other modes here instead of dropping them.
          const parsed = d.modes === undefined ? null : parseModes(d.modes, kinds)
          const list = parsed ? parsed.list : cur.modes
          const byMode: Record<string, ModeData> = parsed ? { ...parsed.data, [MAIN_MODE]: main } : { ...curAll.data, [MAIN_MODE]: main }
          const active = list.some((m) => m.id === cur.modeId) ? cur.modeId : MAIN_MODE
          const { [active]: inUse, ...others } = byMode
          const modeState = { modes: list, modeId: active, modeData: others, months: inUse.months, layouts: inUse.layouts, setupNotes: inUse.setupNotes, yearNotes: inUse.yearNotes }
          set({ ...spending, ...modeState, kinds, goals, goalAreas, sources: parseSources(d.sources), birthday, currency: d.currency && typeof d.currency === 'object' ? parseCurrencies(d.currency) : parseCurrencies({ ...get().currency, alt: { ...get().currency.alt, rate: d.usdRate ?? get().currency.alt.rate } }), clipboard: null })
          return OK
        } catch {
          return fail('Could not read that file.')
        }
      },

      resetAll: () => set({ modes: [mainMode()], modeId: MAIN_MODE, modeData: {}, tasks: [], taskKinds: DEFAULT_TASK_KINDS, layouts: {}, setupNotes: {}, expenses: [], expenseCats: DEFAULT_EXPENSE_CATS, places: [], months: {}, kinds: DEFAULT_KINDS, goals: {}, goalAreas: DEFAULT_GOAL_AREAS, sources: [], birthday: null, yearNotes: {}, clipboard: null, modal: null }),
    }),
    {
      name: 'dizayr-goal-planner-v1',
      version: 7,
      storage: lazyStorage(),
      partialize: (s) => ({
        months: s.months,
        kinds: s.kinds,
        goals: s.goals,
        goalAreas: s.goalAreas,
        sources: s.sources,
        birthday: s.birthday,
        yearNotes: s.yearNotes,
        currency: s.currency,
        expenses: s.expenses,
        expenseCats: s.expenseCats,
        places: s.places,
        layouts: s.layouts,
        setupNotes: s.setupNotes,
        modes: s.modes,
        modeId: s.modeId,
        modeData: s.modeData,
        tasks: s.tasks,
        taskKinds: s.taskKinds,
        year: s.year,
        dashMode: s.dashMode,
        view: s.view,
        sidebar: s.sidebar,
        openAllMonths: s.openAllMonths,
        phoneCols: s.phoneCols,
        assetCat: s.assetCat,
        assetPeriod: s.assetPeriod,
        assetFavorite: s.assetFavorite,
      }),
      // v0 had a selectable currency; amounts are now always pesos.
      // v1 had an "Other" item kind; it's now part of "Status & Other".
      // v2 had a fixed list of item kinds; they're now the starter kinds, which can be changed.
      // v3 had four fixed goal areas with optional custom names; they're now the starter areas, which can be changed.
      // v4 had a fixed peso → US dollar rate (`usdRate`); it's now the main + alternative currency settings.
      // v5 didn't tell events and to-dos apart (`type`).
      // v6 had one set of year notes for every mode; they now belong to the main plan, and each mode has its own.
      migrate: (persisted, version) => {
        const { currency, usdRate, areaLabels, ...rest } = (persisted ?? {}) as Record<string, unknown>
        if (version < 7 && rest.modeId && rest.modeId !== MAIN_MODE) {
          const modeData = (rest.modeData ?? {}) as Record<string, ModeData>
          rest.modeData = { ...modeData, [MAIN_MODE]: { ...emptyMode(), ...modeData[MAIN_MODE], yearNotes: parseYearNotes(rest.yearNotes) } }
          rest.yearNotes = {}
        }
        return {
          months: {},
          year: currentYear(),
          dashMode: 'plan',
          ...rest,
          kinds: parseKinds(rest.kinds) ?? DEFAULT_KINDS,
          goalAreas: parseGoalAreas(rest.goalAreas, areaLabels),
          ...(rest.months ? { months: migrateMonths(rest.months) } : {}),
          ...(rest.tasks ? { tasks: parseTasks(rest.tasks) } : {}),
          ...(rest.assetCat === 'other' ? { assetCat: 'status' } : {}),
          currency: parseCurrencies(currency, usdRate),
        } as Pick<State, 'months' | 'kinds' | 'goalAreas' | 'currency' | 'year' | 'dashMode'>
      },
    },
  ),
)

/** Cleans up month-by-month vehicle arrangements from a backup file or the cloud. */
function parseLayouts(raw: unknown): Layouts {
  const out: Layouts = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, m] of Object.entries(raw as Record<string, unknown>)) {
    if (!/^\d{4}-\d{2}$/.test(k) || !m || typeof m !== 'object') continue
    const one: Record<string, string> = {}
    for (const [v, pid] of Object.entries(m as Record<string, unknown>)) if (typeof pid === 'string') one[v] = pid
    if (Object.keys(one).length) out[k] = one
  }
  return out
}

// ---- Modes ----


/** Every mode with its data, the one in use included. */
function allModes(s: Pick<State, 'modes' | 'modeId' | 'modeData' | 'months' | 'layouts' | 'setupNotes' | 'yearNotes'>) {
  const data: Record<string, ModeData> = { ...s.modeData, [s.modeId]: { months: s.months, layouts: s.layouts, setupNotes: s.setupNotes, yearNotes: s.yearNotes } }
  for (const m of s.modes) data[m.id] = { ...emptyMode(), ...data[m.id] }
  return { list: s.modes, data }
}

/**
 * The plan as it's saved (cloud and backup files): the main mode at the top, exactly where it was before modes
 * existed (so older copies of the app still read it), and every other mode with its own data in `modes`.
 */
export function savedModes(s: State) {
  const { list, data } = allModes(s)
  const main = data[MAIN_MODE]
  return {
    months: main.months,
    layouts: main.layouts,
    setupNotes: main.setupNotes,
    yearNotes: main.yearNotes,
    modes: list.map((m) => (m.id === MAIN_MODE ? { ...m } : { ...m, ...data[m.id] })),
  }
}

/** Cleans up the modes list from a backup file or the cloud. The main mode always comes first. */
function parseModes(raw: unknown, kinds: ItemKind[]): { list: ModeInfo[]; data: Record<string, ModeData> } {
  const list: ModeInfo[] = []
  const data: Record<string, ModeData> = {}
  let main = mainMode()
  if (Array.isArray(raw)) {
    for (const x of raw as Record<string, unknown>[]) {
      if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id) continue
      const name = typeof x.name === 'string' && x.name.trim() ? x.name.trim().slice(0, MAX_MODE_NAME) : ''
      if (x.id === MAIN_MODE) {
        main = { ...main, name: name || 'Main' }
        continue
      }
      if (list.some((m) => m.id === x.id)) continue
      list.push({ id: x.id, name: name || `Mode ${list.length + 2}`, createdAt: Number(x.createdAt) || Date.now() })
      data[x.id] = {
        months: parseMonths(x.months, kinds),
        layouts: parseLayouts(x.layouts),
        setupNotes: parseSetupNotes(x.setupNotes),
        yearNotes: parseYearNotes(x.yearNotes),
      }
    }
  }
  return { list: [main, ...list], data }
}

/** Cleans up months (goals, budgets and items) from a backup file or the cloud. */
function parseMonths(raw: unknown, kinds: ItemKind[]): Record<string, MonthData> {
  const months: Record<string, MonthData> = {}
  if (!raw || typeof raw !== 'object') return months
  for (const [key, m] of Object.entries(raw as Record<string, Partial<MonthData> & { items?: Partial<Item>[] & Record<string, any>[] }>)) {
    if (!/^\d{4}-\d{2}$/.test(key) || !m) continue
    months[key] = {
      goal: Number(m.goal) || 0,
      budget: Number(m.budget) || 0,
      netWorthGoal: m.netWorthGoal == null || !Number.isFinite(Number(m.netWorthGoal)) ? null : Number(m.netWorthGoal),
      earned: m.earned == null ? null : Number(m.earned) || 0,
      items: Array.isArray(m.items)
        ? m.items.map((i: Record<string, any>) => ({
            id: i.id || uid(),
            name: String(i.name ?? 'Item'),
            category: toCategory(i.category, kinds),
            trend: (['appreciating', 'depreciating', 'stable'].includes(i.trend) ? i.trend : 'stable') as Trend,
            price: Number(i.price) || 0,
            rate: Number(i.rate) || 0,
            createdAt: Number(i.createdAt) || Date.now(),
            ...(i.favorite ? { favorite: true } : {}),
            ...(typeof i.notes === 'string' && i.notes.trim() ? { notes: i.notes } : {}),
            ...(typeof i.propertyId === 'string' && i.propertyId ? { propertyId: i.propertyId } : {}),
            ...(cleanRunning(i.running) ? { running: cleanRunning(i.running)! } : {}),
          }))
        : [],
      ...(typeof m.notes === 'string' && m.notes.trim() ? { notes: m.notes } : {}),
    }
  }
  return months
}

/** Cleans up setup notes from a backup file or the cloud. */
function parseSetupNotes(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, text] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{4}-\d{2}$/.test(k) && typeof text === 'string' && text.trim()) out[k] = text.slice(0, 4000)
  }
  return out
}

/** Cleans up year notes from a backup file or the cloud. */
function parseYearNotes(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [year, text] of Object.entries(raw as Record<string, unknown>)) {
    if (/^\d{4}$/.test(year) && typeof text === 'string' && text.trim()) out[year] = text
  }
  return out
}

/** Setups happen in the birthday month (June when it isn't set) and in December, every year. */
export const DEFAULT_SETUP_MONTH = 5
export const setupMonths = (birthMonth: number | null) => [...new Set([birthMonth ?? DEFAULT_SETUP_MONTH, 11])].sort((a, b) => a - b)

/** One setup: where each vehicle owned by then is kept, which vehicles each property holds, and which aren't placed. */
export type Parking = {
  /** "2027-06" */
  monthKey: string
  /** vehicle id → property id (only placed vehicles) */
  at: Map<string, string>
  vehiclesAt: Map<string, Placed[]>
  /** Vehicles still yours that this setup doesn't place: they count as sold from this setup on */
  unplaced: Placed[]
  /** Vehicles left off an earlier setup (sold then), with that setup's month. Sold stays sold, even where a later setup placed it. */
  sold: { placed: Placed; since: string }[]
  /** Every vehicle / property owned by then (sold ones included) */
  vehicles: Placed[]
  properties: Placed[]
}

/** True when `pid` is a property already bought by `monthKey`. */
const ownedProperty = (index: ItemIndex, pid: string | undefined, monthKey: string) => {
  const home = pid ? index.byId.get(pid) : undefined
  return !!home && home.item.category === 'property' && home.key <= monthKey
}

/**
 * Reads one setup. Its placements are its own; nothing carries over. What does carry over is selling:
 * a vehicle left off a setup that was arranged (anything placed in it) counts as sold from then on, in every later setup,
 * even ones that had placed it (so selling it at an earlier date overrides later plans). Placing it in the setup it was
 * left off undoes the sale. `setups`: the setup months (0–11); only those count.
 */
export function placementAt(index: ItemIndex, layouts: Layouts, monthKey: string, setups: number[]): Parking {
  const byMonth = (a: Placed, b: Placed) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)
  const vehicles = [...index.byId.values()].filter((p) => p.item.category === 'vehicle' && p.key <= monthKey).sort(byMonth)

  // Selling, setup by setup, up to (not including) this one.
  const soldSince = new Map<string, string>()
  const earlier = Object.keys(layouts)
    .filter((k) => k < monthKey && setups.includes(Number(k.slice(5)) - 1) && Object.keys(layouts[k]).length > 0)
    .sort()
  for (const k of earlier) {
    for (const p of vehicles) {
      if (p.key > k) continue
      if (!soldSince.has(p.item.id) && !ownedProperty(index, layouts[k][p.item.id], k)) soldSince.set(p.item.id, k)
    }
  }

  const own = layouts[monthKey] ?? {}
  const at = new Map<string, string>()
  const vehiclesAt = new Map<string, Placed[]>()
  const unplaced: Placed[] = []
  const sold: Parking['sold'] = []
  for (const p of vehicles) {
    const pid = own[p.item.id]
    // Sold earlier wins over a spot this setup gave it.
    if (soldSince.has(p.item.id)) sold.push({ placed: p, since: soldSince.get(p.item.id)! })
    else if (ownedProperty(index, pid, monthKey)) {
      at.set(p.item.id, pid)
      vehiclesAt.set(pid, [...(vehiclesAt.get(pid) ?? []), p])
    } else unplaced.push(p)
  }
  return { monthKey, at, vehiclesAt, unplaced, sold, vehicles, properties: index.properties.filter((p) => p.key <= monthKey) }
}

export function useParking(monthKey: string | null, setups: number[]): Parking | null {
  const index = useItemIndex()
  const layouts = useStore((s) => s.layouts)
  const months = setups.join()
  return useMemo(
    () => (monthKey ? placementAt(index, layouts, monthKey, months.split(',').map(Number)) : null),
    [index, layouts, monthKey, months],
  )
}

/** Running totals for every month 2026–2040, recomputed only when data changes. */
let planCacheKey: unknown = null
let planCache: MonthCalc[] = []
function planOf(months: Record<string, MonthData>) {
  if (months !== planCacheKey) {
    planCacheKey = months
    planCache = computeAll(months)
  }
  return planCache
}
export function usePlan() {
  return planOf(useStore((s) => s.months))
}

export type Placed = { item: Item; key: string }
export type ItemIndex = {
  /** Every item by id */
  byId: Map<string, Placed>
  /** Every Land / Property item, in month order */
  properties: Placed[]
  /** Vehicles kept at each property (by property id), in month order */
  vehiclesAt: Map<string, Placed[]>
}

let indexKey: unknown = null
let indexCache: ItemIndex = { byId: new Map(), properties: [], vehiclesAt: new Map() }
/** Lookups across all months (which property a vehicle is kept at, and the reverse), rebuilt only when data changes. */
export function useItemIndex(): ItemIndex {
  const months = useStore((s) => s.months)
  if (months !== indexKey) {
    indexKey = months
    const byId = new Map<string, Placed>()
    for (const key of Object.keys(months).sort()) for (const item of months[key].items) byId.set(item.id, { item, key })
    const properties = [...byId.values()].filter((p) => p.item.category === 'property')
    const vehiclesAt = new Map<string, Placed[]>()
    for (const p of byId.values()) {
      const at = p.item.category === 'vehicle' && p.item.propertyId ? byId.get(p.item.propertyId) : undefined
      if (at?.item.category === 'property') vehiclesAt.set(at.item.id, [...(vehiclesAt.get(at.item.id) ?? []), p])
    }
    indexCache = { byId, properties, vehiclesAt }
  }
  return indexCache
}

/** The user's item kinds, in order. */
export const useKinds = () => useStore((s) => s.kinds)

/** Looks up a kind of task by id (a placeholder if it no longer exists). */
export function useTaskKindOf() {
  const kinds = useStore((s) => s.taskKinds)
  return useMemo(() => {
    const byId = new Map(kinds.map((k) => [k.id, k]))
    return (id: string) => byId.get(id) ?? UNKNOWN_TASK_KIND
  }, [kinds])
}

/** Looks up a kind by id (a placeholder if it no longer exists). */
export function useKindOf() {
  const kinds = useKinds()
  return (id: Category) => kinds.find((k) => k.id === id) ?? UNKNOWN_KIND
}

/** The user's goal areas, in order. */
export const useGoalAreas = () => useStore((s) => s.goalAreas)

/** Looks up a goal area by id (a placeholder if it no longer exists). */
export function useAreaOf() {
  const areas = useGoalAreas()
  return (id: GoalArea) => areas.find((a) => a.id === id) ?? UNKNOWN_AREA
}

/** The main and alternative currency settings. */
export const useCurrency = () => useStore((s) => s.currency)

/** Formats an amount in the main currency: ₱100,000 */
export function useFmt() {
  const symbol = useStore((s) => s.currency.main.symbol)
  // The same function until the symbol changes, so lists that depend on it aren't redone on every render.
  return useCallback((n: number, compact = false) => fmt(n, symbol, compact), [symbol])
}

/**
 * Converts a main-currency amount to the alternative currency: ₱100,000 → $1,595.
 * Put the result in an element with the `alt` (block) or `alt-i` (inline) class so it smoothly hides when the alternative currency is turned off.
 */
export function useAlt() {
  const alt = useStore((s) => s.currency.alt)
  return useCallback((n: number, compact = false) => fmtAlt(n, alt, compact), [alt])
}

// Lets CSS fade out every alternative-currency amount at once when it's turned off (see `.alt` in index.css).
if (typeof document !== 'undefined') {
  const sync = () => document.documentElement.toggleAttribute('data-alt-off', !useStore.getState().currency.alt.show)
  sync()
  useStore.subscribe(sync)
}
