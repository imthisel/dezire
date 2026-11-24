import { useMemo, useState } from 'react'
import { MousePointerClick, RotateCcw } from 'lucide-react'
import type { Item, MonthData, Trend } from '../../lib/types'
import { SimMonth, compute, type Before } from './TryOverview'
import { CurrencyToggle } from './CurrencyToggle'

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
  notes: 'Buy the porsche gt3 in PGA cars. use cash for both gt3 and the gx550 as well as the house and the patek',
  items: [
    // Manual 992.2 GT3s trade above sticker; a modest 2%/yr is the careful view.
    item('gt3', '2026 Porsche 911 GT3 (992.2) Manual', 'vehicle', 'appreciating', 23_000_000, 2, { favorite: true }),
    // About 35% lost over 5 years (iSeeCars), ~7%/yr.
    item('gx', 'Lexus GX 550 Premier', 'vehicle', 'depreciating', 8_858_000, 7),
    item('batangas', 'Batangas rest house', 'property', 'appreciating', 20_000_000, 5),
    item('patek', 'Patek Philippe Nautilus 5711/1A', 'status', 'appreciating', 10_000_000, 6),
    item('alps', 'Swiss Alps · Zermatt chalet, 7 nights', 'travel', 'stable', 2_400_000),
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
      <div className="mt-3 flex min-h-7 flex-wrap items-center justify-center gap-x-3 gap-y-1.5 text-xs text-zinc-500">
        <span className="inline-flex items-center gap-1.5">
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
        </span>
        <CurrencyToggle />
      </div>
    </div>
  )
}
