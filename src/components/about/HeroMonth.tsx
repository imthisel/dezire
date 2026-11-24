import { useMemo, useState } from 'react'
import { MousePointerClick, RotateCcw } from 'lucide-react'
import type { Item, MonthData, Trend } from '../../lib/types'
import { SimMonth, compute, type Before } from './TryOverview'

/*
 * The hero's month: May 2030 of someone planning a very comfortable life. It's the app's own month card, the same one as in
 * Try it now and the app, so everything on it can be clicked and changed. It's kept apart from the Try it now plan and lives
 * only in this page's memory.
 */

const item = (id: string, name: string, category: string, trend: Trend, price: number, rate = 0, extra: Partial<Item> = {}): Item => ({
  id: `hero-${id}`, name, category, trend, price, rate: trend === 'stable' ? 0 : rate, createdAt: 0, ...extra,
})

const may2030 = (): MonthData => ({
  goal: 120_000_000,
  netWorthGoal: null,
  budget: 100_000_000,
  earned: null,
  notes: 'The GT3 RS month. Paid in full, no loans.',
  items: [
    item('gt3', 'Porsche 911 GT3 RS', 'vehicle', 'appreciating', 28_500_000, 3, { favorite: true }),
    item('patek', 'Patek Philippe Nautilus 5711/1A', 'status', 'appreciating', 10_000_000, 6),
    item('alps', 'Swiss Alps · Zermatt chalet, 7 nights', 'travel', 'stable', 2_400_000),
    item('birkin', 'Hermès Birkin 25', 'status', 'appreciating', 1_600_000, 5),
  ],
})

/** The years before May 2030: earned and spent so far, and what was bought before is worth by now. */
const BEFORE: Before = { earned: 512_000_000, spent: 275_500_000, assets: 149_700_000 }

export function HeroMonth() {
  const [m, setM] = useState(may2030)
  const [changed, setChanged] = useState(false)
  const [c] = useMemo(() => compute([m], BEFORE), [m])
  return (
    <div>
      <div className="rounded-2xl bg-[#0b0c10] shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)]">
        <SimMonth
          name="May"
          year={2030}
          m={m}
          c={c}
          onChange={(patch) => {
            setM((x) => ({ ...x, ...patch }))
            setChanged(true)
          }}
          places={[]}
          keptAt={() => undefined}
        />
      </div>
      <p className="mt-3 flex h-6 items-center justify-center gap-1.5 text-xs text-zinc-500">
        <MousePointerClick className="h-3.5 w-3.5" />
        <span>Click anything to change it</span>
        {changed && (
          <button
            type="button"
            onClick={() => {
              setM(may2030())
              setChanged(false)
            }}
            className="animate-fade ml-1 inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <RotateCcw className="h-3 w-3" /> Reset
          </button>
        )}
      </p>
    </div>
  )
}
