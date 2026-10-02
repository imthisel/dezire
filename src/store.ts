import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Category, Item, MonthData, Result, Trend } from './lib/types'
import { DEFAULT_USD_RATE, PESO, fmt, fmtUsd } from './lib/money'
import { currentYear, labelOfKey, END_YEAR, START_YEAR, indexOf, keyOf } from './lib/time'
import { computeAll, spendLimit, type MonthCalc } from './lib/calc'

export type Clip = { mode: 'copy' | 'cut'; fromKey: string; item: Item }
export type ModalState =
  | { type: 'item'; key: string; editId?: string }
  | { type: 'move'; key: string; id: string }
  | null
export type MonthField = 'goal' | 'budget' | 'earned'
export type ItemInput = { name: string; category: Category; trend: Trend; price: number; rate: number }

const OK: Result = { ok: true }
const fail = (error: string): Result => ({ ok: false, error })

export const emptyMonth = (): MonthData => ({ goal: 0, budget: 0, earned: null, items: [] })

const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36)

/**
 * Would an item of `price` push the month `key` past its budget or what was earned / the goal?
 * Such items are still allowed — they just get flagged in red so they can be moved.
 */
export function fitCheck(
  months: Record<string, MonthData>,
  key: string,
  price: number,
  excludeId?: string,
): { left: number; warning: string | null } {
  const m = months[key] ?? emptyMonth()
  const spent = m.items.filter((i) => i.id !== excludeId).reduce((s, i) => s + i.price, 0)
  const after = spent + price
  const p = (n: number) => fmt(n, PESO)
  const why: string[] = []
  if (m.budget <= 0) why.push('it has no budget set')
  else if (after > m.budget + 1e-9) why.push(`this goes ${p(after - m.budget)} over the ${p(m.budget)} budget`)
  const earned = m.earned ?? m.goal
  if ((m.earned !== null || m.goal > 0) && after > earned + 1e-9) {
    why.push(`${p(after - earned)} over the ${p(earned)} ${m.earned === null ? 'goal to make' : 'earned'}`)
  }
  return {
    left: spendLimit(m) - spent,
    warning: why.length ? `Not enough in ${labelOfKey(key)}: ${why.join(', and ')}. Marked red — move it to another month.` : null,
  }
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
  dashMode: 'plan' | 'today'
  clipboard: Clip | null
  modal: ModalState

  setYear: (y: number) => void
  setUsdRate: (r: number) => void
  setDashMode: (m: 'plan' | 'today') => void
  openModal: (m: ModalState) => void
  closeModal: () => void

  setMonthField: (key: string, field: MonthField, value: number | null) => void
  fillYear: (year: number, goal: number | null, budget: number | null, onlyEmpty: boolean) => void

  addItem: (key: string, data: ItemInput) => Result
  updateItem: (key: string, id: string, data: ItemInput) => Result
  removeItem: (key: string, id: string) => void
  transferItem: (fromKey: string, id: string, toKey: string, mode: 'copy' | 'move') => Result

  copyToClipboard: (key: string, id: string, mode: 'copy' | 'cut') => void
  pasteInto: (key: string) => Result
  clearClipboard: () => void

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

      setYear: (year) => set({ year: Math.min(END_YEAR, Math.max(START_YEAR, year)) }),
      setUsdRate: (r) => set({ usdRate: r > 0 ? r : DEFAULT_USD_RATE }),
      setDashMode: (dashMode) => set({ dashMode }),
      openModal: (modal) => set({ modal }),
      closeModal: () => set({ modal: null }),

      setMonthField: (key, field, value) =>
        set((s) => {
          const m = s.months[key] ?? emptyMonth()
          const v = field === 'earned' ? value : (value ?? 0)
          return { months: { ...s.months, [key]: { ...m, [field]: v } } }
        }),

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

      addItem: (key, data) => {
        const { months } = get()
        const m = months[key] ?? emptyMonth()
        const item: Item = { ...data, id: uid(), createdAt: Date.now() }
        set({ months: { ...months, [key]: { ...m, items: [...m.items, item] } } })
        return warned(key, data.price, months)
      },

      updateItem: (key, id, data) => {
        const { months } = get()
        const m = months[key] ?? emptyMonth()
        set({
          months: { ...months, [key]: { ...m, items: m.items.map((i) => (i.id === id ? { ...i, ...data } : i)) } },
        })
        return warned(key, data.price, months, id)
      },

      removeItem: (key, id) =>
        set((s) => {
          const m = s.months[key]
          if (!m) return {}
          const clipboard = s.clipboard?.mode === 'cut' && s.clipboard.item.id === id ? null : s.clipboard
          return { months: { ...s.months, [key]: { ...m, items: m.items.filter((i) => i.id !== id) } }, clipboard }
        }),

      transferItem: (fromKey, id, toKey, mode) => {
        const { months } = get()
        const src = months[fromKey]
        const item = src?.items.find((i) => i.id === id)
        if (!src || !item) return fail('That item no longer exists.')
        if (mode === 'move' && fromKey === toKey) return OK
        const next = { ...months }
        if (mode === 'move') next[fromKey] = { ...src, items: src.items.filter((i) => i.id !== id) }
        const dest = next[toKey] ?? emptyMonth()
        const moved = mode === 'move' ? item : { ...item, id: uid(), createdAt: Date.now() }
        next[toKey] = { ...dest, items: [...dest.items, moved] }
        set({ months: next })
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

      importData: (data) => {
        try {
          const d = data as { months?: Record<string, Partial<MonthData>>; usdRate?: number }
          if (!d || typeof d !== 'object' || !d.months || typeof d.months !== 'object') {
            return fail('That file is not a Dezire backup.')
          }
          const months: Record<string, MonthData> = {}
          for (const [key, raw] of Object.entries(d.months)) {
            if (!/^\d{4}-\d{2}$/.test(key) || !raw) continue
            months[key] = {
              goal: Number(raw.goal) || 0,
              budget: Number(raw.budget) || 0,
              earned: raw.earned == null ? null : Number(raw.earned) || 0,
              items: Array.isArray(raw.items)
                ? raw.items.map((i) => ({
                    id: i.id || uid(),
                    name: String(i.name ?? 'Item'),
                    category: (['property', 'vehicle', 'status'].includes(i.category) ? i.category : 'status') as Category,
                    trend: (['appreciating', 'depreciating', 'stable'].includes(i.trend) ? i.trend : 'stable') as Trend,
                    price: Number(i.price) || 0,
                    rate: Number(i.rate) || 0,
                    createdAt: Number(i.createdAt) || Date.now(),
                  }))
                : [],
            }
          }
          set({ months, usdRate: Number(d.usdRate) > 0 ? Number(d.usdRate) : get().usdRate, clipboard: null })
          return OK
        } catch {
          return fail('Could not read that file.')
        }
      },

      resetAll: () => set({ months: {}, clipboard: null, modal: null }),
    }),
    {
      name: 'dezire-goal-planner-v1',
      version: 1,
      partialize: (s) => ({ months: s.months, usdRate: s.usdRate, year: s.year, dashMode: s.dashMode }),
      // v0 had a selectable currency; amounts are now always pesos.
      migrate: (persisted) => {
        const { currency: _drop, ...rest } = (persisted ?? {}) as Record<string, unknown>
        return {
          months: {},
          year: currentYear(),
          dashMode: 'plan',
          ...rest,
          usdRate: Number(rest.usdRate) > 0 ? Number(rest.usdRate) : DEFAULT_USD_RATE,
        } as Pick<State, 'months' | 'usdRate' | 'year' | 'dashMode'>
      },
    },
  ),
)

/** Running totals for every month 2026–2040, recomputed only when data changes. */
let planCacheKey: unknown = null
let planCache: MonthCalc[] = []
export function usePlan() {
  const months = useStore((s) => s.months)
  if (months !== planCacheKey) {
    planCacheKey = months
    planCache = computeAll(months)
  }
  return planCache
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
