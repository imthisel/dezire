import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Category, Goal, GoalArea, GoalAreaDef, IncomeSource, Item, ItemKind, MonthData, PlanStep, Result, SourceKind, SourceStage, Trend } from './lib/types'
import {
  DEFAULT_GOAL_AREAS, DEFAULT_KINDS, GOAL_COLORS, GOAL_ICONS, KIND_COLORS, KIND_ICONS, SOURCE_KINDS, SOURCE_STAGES, UNKNOWN_AREA, UNKNOWN_KIND,
  guessAreaIcon, guessIcon,
} from './lib/meta'
import { DEFAULT_USD_RATE, PESO, fmt, fmtUsd } from './lib/money'
import { currentYear, labelOfKey, END_YEAR, START_YEAR, indexOf, indexOfKey, keyOf } from './lib/time'
import { computeAll, spendLimit, type MonthCalc } from './lib/calc'

export type Clip = { mode: 'copy' | 'cut'; fromKey: string; item: Item }
export type ModalState =
  | { type: 'item'; key: string; editId?: string }
  | { type: 'move'; key: string; id: string }
  | { type: 'goal'; year: number; editId?: string; area?: GoalArea }
  | { type: 'kinds' }
  /** `openId`: the area to show unfolded. `add`: start with the cursor in the new-area box. */
  | { type: 'goalAreas'; openId?: string; add?: boolean }
  | null
export type View = 'planner' | 'plan' | 'favorites' | 'assets'
/** Assets page: which kind of item, and which years */
export type AssetCat = 'all' | Category
export type AssetPeriod = { mode: 'all' | 'year' | 'range'; from: number; to: number }
export type SourcePatch = Partial<Omit<IncomeSource, 'id' | 'createdAt' | 'steps'>>
export type MonthField = 'goal' | 'budget' | 'earned' | 'netWorthGoal'
/** Where to drop an item in a month's list: next to item `id`. Missing = at the end. */
export type DropAt = { id: string; after: boolean }
export type KindPatch = Partial<Omit<ItemKind, 'id'>>
export type AreaPatch = Partial<Omit<GoalAreaDef, 'id'>>
export type ItemInput = { name: string; category: Category; trend: Trend; price: number; rate: number; notes?: string; propertyId?: string }

const OK: Result = { ok: true }
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
  const p = (n: number) => fmt(n, PESO)
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
  /** Pesos per 1 US dollar */
  usdRate: number
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
  setView: (v: View) => void
  assetCat: AssetCat
  assetPeriod: AssetPeriod
  setAssetCat: (c: AssetCat) => void
  setAssetPeriod: (p: Partial<AssetPeriod>) => void
  setSidebar: (open: boolean) => void
  setDrawer: (open: boolean) => void

  setYear: (y: number) => void
  setUsdRate: (r: number) => void
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
  addStep: (sourceId: string, text: string) => void
  updateStep: (sourceId: string, stepId: string, patch: Partial<Omit<PlanStep, 'id'>>) => void
  removeStep: (sourceId: string, stepId: string) => void

  importData: (data: unknown) => Result
  resetAll: () => void
}

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      months: {},
      usdRate: DEFAULT_USD_RATE,
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
      view: 'planner',
      sidebar: true,
      drawer: false,
      openAllMonths: false,
      setOpenAllMonths: (openAllMonths) => set({ openAllMonths }),

      setView: (view) => set({ view }),
      assetCat: 'all',
      assetPeriod: { mode: 'all', from: currentYear(), to: Math.min(END_YEAR, currentYear() + 4) },
      setAssetCat: (assetCat) => set({ assetCat }),
      setAssetPeriod: (p) =>
        set((s) => {
          const clamp = (y: number) => Math.min(END_YEAR, Math.max(START_YEAR, y))
          const next = { ...s.assetPeriod, ...p }
          const from = clamp(Math.min(next.from, next.to))
          const to = clamp(Math.max(next.from, next.to))
          return { assetPeriod: { mode: next.mode, from, to } }
        }),
      setSidebar: (sidebar) => set({ sidebar }),
      setDrawer: (drawer) => set({ drawer }),

      setYear: (year) => set({ year: Math.min(END_YEAR, Math.max(START_YEAR, year)) }),
      setUsdRate: (r) => set({ usdRate: r > 0 ? r : DEFAULT_USD_RATE }),
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
        set({ kinds: kinds.filter((k) => k.id !== id), months: next, ...(assetCat === id ? { assetCat: 'all' as const } : {}) })
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

      removeStep: (sourceId, stepId) =>
        set((s) => ({
          sources: s.sources.map((x) => (x.id === sourceId ? { ...x, steps: x.steps.filter((st) => st.id !== stepId) } : x)),
        })),

      importData: (data) => {
        try {
          const d = data as {
            months?: Record<string, Partial<MonthData>>
            usdRate?: number
            goals?: Record<string, Partial<Goal>[]>
            goalAreas?: unknown
            areaLabels?: Record<string, unknown>
            sources?: unknown
            birthday?: unknown
            kinds?: unknown
          }
          if (!d || typeof d !== 'object' || !d.months || typeof d.months !== 'object') {
            return fail('That file is not a Dezire backup.')
          }
          const kinds = parseKinds(d.kinds) ?? DEFAULT_KINDS
          const months: Record<string, MonthData> = {}
          for (const [key, raw] of Object.entries(d.months)) {
            if (!/^\d{4}-\d{2}$/.test(key) || !raw) continue
            months[key] = {
              goal: Number(raw.goal) || 0,
              budget: Number(raw.budget) || 0,
              netWorthGoal: raw.netWorthGoal == null || !Number.isFinite(Number(raw.netWorthGoal)) ? null : Number(raw.netWorthGoal),
              earned: raw.earned == null ? null : Number(raw.earned) || 0,
              items: Array.isArray(raw.items)
                ? raw.items.map((i) => ({
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
                  }))
                : [],
              ...(typeof raw.notes === 'string' && raw.notes.trim() ? { notes: raw.notes } : {}),
            }
          }
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
          set({ months, kinds, goals, goalAreas, sources: parseSources(d.sources), birthday, usdRate: Number(d.usdRate) > 0 ? Number(d.usdRate) : get().usdRate, clipboard: null })
          return OK
        } catch {
          return fail('Could not read that file.')
        }
      },

      resetAll: () => set({ months: {}, kinds: DEFAULT_KINDS, goals: {}, goalAreas: DEFAULT_GOAL_AREAS, sources: [], birthday: null, clipboard: null, modal: null }),
    }),
    {
      name: 'dezire-goal-planner-v1',
      version: 4,
      partialize: (s) => ({
        months: s.months,
        kinds: s.kinds,
        goals: s.goals,
        goalAreas: s.goalAreas,
        sources: s.sources,
        birthday: s.birthday,
        usdRate: s.usdRate,
        year: s.year,
        dashMode: s.dashMode,
        view: s.view,
        sidebar: s.sidebar,
        openAllMonths: s.openAllMonths,
        assetCat: s.assetCat,
        assetPeriod: s.assetPeriod,
      }),
      // v0 had a selectable currency; amounts are now always pesos.
      // v1 had an "Other" item kind; it's now part of "Status & Other".
      // v2 had a fixed list of item kinds; they're now the starter kinds, which can be changed.
      // v3 had four fixed goal areas with optional custom names; they're now the starter areas, which can be changed.
      migrate: (persisted) => {
        const { currency: _drop, areaLabels, ...rest } = (persisted ?? {}) as Record<string, unknown>
        return {
          months: {},
          year: currentYear(),
          dashMode: 'plan',
          ...rest,
          kinds: parseKinds(rest.kinds) ?? DEFAULT_KINDS,
          goalAreas: parseGoalAreas(rest.goalAreas, areaLabels),
          ...(rest.months ? { months: migrateMonths(rest.months) } : {}),
          ...(rest.assetCat === 'other' ? { assetCat: 'status' } : {}),
          usdRate: Number(rest.usdRate) > 0 ? Number(rest.usdRate) : DEFAULT_USD_RATE,
        } as Pick<State, 'months' | 'kinds' | 'goalAreas' | 'usdRate' | 'year' | 'dashMode'>
      },
    },
  ),
)

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

/** Formats pesos: ₱100,000 */
export function useFmt() {
  return (n: number, compact = false) => fmt(n, PESO, compact)
}

/** Converts pesos to US dollars: ₱100,000 → $1,595 */
export function useUsd() {
  const rate = useStore((s) => s.usdRate)
  return (pesos: number, compact = false) => fmtUsd(pesos, rate, compact)
}
