import { create } from 'zustand'
import type { Item, MonthData, Trend } from '../../lib/types'

/*
 * The About page's playgrounds share one plan, the way the app's pages do: the Planner's months (and its budget for this
 * month, which Expenses also uses), and a setup that places the vehicles at properties. It lives only in this page's memory.
 */

const NOW = new Date()
/** The three months the playground plans: this month and the next two. */
export const DEMO_MONTHS = [0, 1, 2].map((i) => {
  const d = new Date(NOW.getFullYear(), NOW.getMonth() + i, 1)
  return {
    name: d.toLocaleDateString('en-US', { month: 'long' }),
    short: d.toLocaleDateString('en-US', { month: 'short' }),
    year: d.getFullYear(),
  }
})
export const monthLabel = (i: number) => `${DEMO_MONTHS[i].name} ${DEMO_MONTHS[i].year}`
/** The setup the playground arranges: the last month planned, when everything has been bought. */
export const SETUP_MONTH = 2

let lastId = 0
export const nextId = () => `try-${++lastId}`
const item = (name: string, category: string, trend: Trend, price: number, rate = 0, extra: Partial<Item> = {}): Item => ({
  id: nextId(), name, category, trend, price, rate: trend === 'stable' ? 0 : rate, createdAt: Date.now(), ...extra,
})

/** The example plan, and where the setup starts with its vehicles. */
function example() {
  const condo = item('Condo down payment, BGC', 'property', 'appreciating', 3_000_000, 6)
  const lot = item('Lot in Tagaytay', 'property', 'appreciating', 2_800_000, 8)
  const vespa = item('Vespa GTS 300', 'vehicle', 'depreciating', 450_000, 10, { propertyId: condo.id })
  const gt3 = item('Porsche 911 GT3 RS', 'vehicle', 'appreciating', 28_500_000, 3)
  const months: MonthData[] = [
    {
      goal: 3_000_000, netWorthGoal: null, budget: 2_500_000, earned: null, notes: 'Give first, then spend.',
      items: [item('Rolex Submariner Date', 'status', 'appreciating', 850_000, 5), item('Tokyo, 5 nights', 'travel', 'stable', 320_000), vespa],
    },
    { goal: 0, netWorthGoal: 6_000_000, budget: 4_000_000, earned: null, notes: '', items: [condo] },
    {
      goal: 33_000_000, netWorthGoal: null, budget: 33_500_000, earned: null, notes: 'The GT3 RS month.',
      items: [gt3, item('Hermès Birkin 25', 'status', 'appreciating', 1_600_000, 5), lot],
    },
  ]
  // The Vespa is at the condo; the GT3 RS isn't at a property yet: drag it onto one.
  return { months, layout: { [vespa.id]: condo.id } as Record<string, string> }
}

const blank = () => ({ months: DEMO_MONTHS.map((): MonthData => ({ goal: 0, netWorthGoal: null, budget: 0, earned: null, notes: '', items: [] })), layout: {} })

type Demo = {
  months: MonthData[]
  /** The setup: vehicle id → the property it's at. Missing = not at a property (counts as sold). */
  layout: Record<string, string>
  update: (i: number, patch: Partial<MonthData>) => void
  setKeptAt: (vehicleId: string, propertyId: string | null) => void
  fillLayout: (layout: Record<string, string>) => void
  reset: () => void
  clear: () => void
}

export const useDemo = create<Demo>((set) => ({
  ...example(),
  update: (i, patch) => set((s) => ({ months: s.months.map((m, j) => (j === i ? { ...m, ...patch } : m)) })),
  setKeptAt: (v, p) =>
    set((s) => {
      const layout = { ...s.layout }
      if (p) layout[v] = p
      else delete layout[v]
      return { layout }
    }),
  fillLayout: (layout) => set({ layout: { ...layout } }),
  reset: () => set(example()),
  clear: () => set(blank()),
}))

/** Every item in the plan with the month it's in. */
export type Placed = { item: Item; month: number }
export function placedOf(months: MonthData[], category: string): Placed[] {
  return months.flatMap((m, month) => m.items.filter((it) => it.category === category).map((item) => ({ item, month })))
}
