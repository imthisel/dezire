import { create } from 'zustand'
import type { Item, MonthData, Trend } from '../../lib/types'

/*
 * The About page's playgrounds share one plan, the way the app's pages do: the Planner's months (and its budget for this
 * month, which Expenses also uses), and a setup that places the vehicles at properties. It lives only in this page's memory.
 */

/**
 * The three months the playground plans: December 2027, December 2028, December 2029, a year apart.
 * `offset`: months after the first one, so values grow and fall by the real time between them.
 */
export const DEMO_MONTHS = [2027, 2028, 2029].map((year, i) => {
  const d = new Date(year, 11, 1)
  return {
    name: d.toLocaleDateString('en-US', { month: 'long' }),
    short: d.toLocaleDateString('en-US', { month: 'short' }),
    year,
    offset: i * 12,
  }
})
export const DEMO_OFFSETS = DEMO_MONTHS.map((m) => m.offset)
/** Months from planned month `from` to planned month `to` (both indexes into DEMO_MONTHS). */
export const monthsBetween = (from: number, to: number) => DEMO_MONTHS[to].offset - DEMO_MONTHS[from].offset
export const monthLabel = (i: number) => `${DEMO_MONTHS[i].name} ${DEMO_MONTHS[i].year}`
/** "Dec 2027": the short label, with its year (all three months have the same name). */
export const shortLabel = (i: number) => `${DEMO_MONTHS[i].short} ${DEMO_MONTHS[i].year}`
/** The setup the playground arranges: the last month planned, when everything has been bought. */
export const SETUP_MONTH = 2

let lastId = 0
export const nextId = () => `try-${++lastId}`
const item = (name: string, category: string, trend: Trend, price: number, rate = 0, extra: Partial<Item> = {}): Item => ({
  id: nextId(), name, category, trend, price, rate: trend === 'stable' ? 0 : rate, createdAt: Date.now(), ...extra,
})

/**
 * The example plan, and where the setup starts with its vehicles. Rates are yearly and realistic for each thing:
 * money given away and training count in the month they're paid, then as nothing (100%), since they can't be sold.
 */
function example() {
  const gone = { notes: 'Given, not owned: worth ₱0 from the next year on.' }
  const loft = item('Loft house', 'property', 'appreciating', 15_000_000, 5)
  const amg = item('2017 Mercedes-AMG GT S', 'vehicle', 'depreciating', 10_400_000, 8, { propertyId: loft.id })
  const ducati = item('Ducati Panigale V4 S (red)', 'vehicle', 'depreciating', 2_750_000, 10, { propertyId: loft.id })
  const penthouse = item('BGC penthouse', 'property', 'appreciating', 50_000_000, 5)
  const restHouse = item('Batangas rest house', 'property', 'appreciating', 20_000_000, 5)
  // Used F50s average US$1.0–1.5M; ₱70M (about US$1.1M) is a fair price for one a few years old. Boats lose ~8% a year.
  const yacht = item('Princess F50 yacht', 'vehicle', 'depreciating', 70_000_000, 8, { propertyId: restHouse.id })
  const ferrari = item('Ferrari 812 Superfast', 'vehicle', 'depreciating', 40_000_000, 3)
  const months: MonthData[] = [
    {
      goal: 0, netWorthGoal: 64_000_000, budget: 40_000_000, earned: null, notes: 'Give first, then spend.',
      items: [
        item('Tithe', 'status', 'depreciating', 7_000_000, 100, gone),
        item('Flying school · PAL Aviation School, Clark', 'status', 'depreciating', 4_500_000, 100, { notes: 'A pilot’s license: worth a lot to me, nothing to resell.' }),
        loft,
        amg,
        ducati,
      ],
    },
    {
      goal: 0, netWorthGoal: 400_000_000, budget: 105_000_000, earned: null, notes: 'Homes for the family, and money that works.',
      items: [
        penthouse,
        restHouse,
        item('Patek Philippe Nautilus 5711/1A-010, blue dial, steel, 40mm', 'status', 'appreciating', 11_000_000, 5),
        item('Investments · index funds and stocks', 'investment', 'appreciating', 20_000_000, 8),
      ],
    },
    {
      goal: 150_000_000, netWorthGoal: null, budget: 140_000_000, earned: null, notes: 'Give back big.',
      items: [
        // A dealer's stake in a company-owned station: the equipment and the contract wear down; the station's earnings are income.
        item('Shell gas station (CODO)', 'investment', 'depreciating', 8_000_000, 5),
        ferrari,
        yacht,
        item('Help people out', 'status', 'depreciating', 20_000_000, 100, gone),
      ],
    },
  ]
  // The AMG and the Ducati are at the loft, the yacht at the rest house; the Ferrari isn't at a property yet: drag it onto one.
  return { months, layout: { [amg.id]: loft.id, [ducati.id]: loft.id, [yacht.id]: restHouse.id } as Record<string, string> }
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
