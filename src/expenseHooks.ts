import { useMemo } from 'react'
import { useStore } from './store'
import { NO_CATEGORY } from './lib/expenses'
import type { ExpenseCategory } from './lib/types'

export const useExpenseCats = () => useStore((s) => s.expenseCats)

/** Looks up a spending category by id (a "No category" placeholder for none / deleted). */
export function useCatOf() {
  const cats = useExpenseCats()
  return (id: string): ExpenseCategory => (id && cats.find((c) => c.id === id)) || NO_CATEGORY
}

export type PastName = { name: string; count: number; category: string; amount: number; place: string }
export type PastPlace = { name: string; count: number; last: string }

/**
 * What's been typed before, most used first: item names (with the category, price and place used last time)
 * and places. Used to suggest them when adding an expense.
 */
export function useHistory() {
  const expenses = useStore((s) => s.expenses)
  return useMemo(() => {
    const names = new Map<string, PastName & { at: string }>()
    const places = new Map<string, PastPlace>()
    // Oldest first, so the latest one sets the "last time" details.
    const sorted = [...expenses].sort((a, b) => (a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1))
    for (const e of sorted) {
      if (e.name) {
        const k = e.name.toLowerCase()
        const n = names.get(k)
        names.set(k, { name: e.name, count: (n?.count ?? 0) + 1, category: e.category, amount: e.amount, place: e.place, at: e.date })
      }
      if (e.place) {
        const k = e.place.toLowerCase()
        const p = places.get(k)
        places.set(k, { name: e.place, count: (p?.count ?? 0) + 1, last: e.date })
      }
    }
    const byUse = <T extends { count: number }>(a: T, b: T, ra: string, rb: string) => b.count - a.count || (rb < ra ? -1 : rb > ra ? 1 : 0)
    return {
      names: [...names.values()].sort((a, b) => byUse(a, b, a.at, b.at)),
      places: [...places.values()].sort((a, b) => byUse(a, b, a.last, b.last)),
    }
  }, [expenses])
}
