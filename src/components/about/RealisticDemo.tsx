import { useEffect, useRef, useState } from 'react'
import { Building2, Car, Check, Plane, ShoppingBag, Watch, Waves, type LucideIcon } from 'lucide-react'
import { peso } from './Previews'

/** Example dreams with realistic prices in pesos (someone with room to dream). In the app, people use their own. */
const DREAMS: { id: string; name: string; kind: string; price: number; icon: LucideIcon }[] = [
  { id: 'gt3', name: 'Porsche 911 GT3 RS', kind: 'Vehicle', price: 28_500_000, icon: Car },
  { id: 'rm', name: 'Richard Mille RM 35-03', kind: 'Watch', price: 10_000_000, icon: Watch },
  { id: 'maldives', name: 'Maldives, overwater villa · 7 nights', kind: 'Travel', price: 2_400_000, icon: Plane },
  { id: 'birkin', name: 'Hermès Birkin 25', kind: 'Status', price: 1_600_000, icon: ShoppingBag },
  { id: 'villa', name: 'Beach villa in Siargao', kind: 'Property', price: 38_000_000, icon: Waves },
  { id: 'penthouse', name: 'Penthouse in BGC', kind: 'Property', price: 85_000_000, icon: Building2 },
]

const MIN_MONTHS = 6
const MAX_MONTHS = 120

/** "June 2028": the month that's `n` months from now. */
function monthFromNow(n: number) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + n)
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const still = () =>
  typeof window === 'undefined' || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-calm')

/** A number that glides to its new value instead of jumping. */
function useGlide(target: number, ms = 700) {
  const [shown, setShown] = useState(target)
  const from = useRef(target)
  useEffect(() => {
    if (still()) {
      from.current = target
      return setShown(target)
    }
    const start = performance.now()
    const a = from.current
    let raf = 0
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms)
      const v = a + (target - a) * (1 - Math.pow(1 - t, 3))
      from.current = v
      setShown(v)
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [target, ms])
  return shown
}

/** Pick dreams, pick a date: the total, and what each month has to set aside to get there. */
export function RealisticDemo() {
  const [picked, setPicked] = useState<Set<string>>(() => new Set(['gt3', 'rm', 'maldives']))
  // Defaults to 19 months, which lands on the same June 2028 the month at the top of the page shows (from November 2026).
  const [months, setMonths] = useState(19)
  const total = DREAMS.filter((d) => picked.has(d.id)).reduce((s, d) => s + d.price, 0)
  const monthly = total / months
  const daily = total / (months * 30.44)
  const shownTotal = useGlide(total)
  const shownMonthly = useGlide(monthly)
  const by = monthFromNow(months)
  const years = months / 12

  function toggle(id: string) {
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  return (
    <div className="grid overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#0b0c10] lg:grid-cols-[1.15fr_1fr]">
      {/* Dreams and the date */}
      <div className="p-5 sm:p-8">
        <fieldset>
          <legend className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">1 · What you want</legend>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {DREAMS.map((d) => {
              const on = picked.has(d.id)
              return (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => toggle(d.id)}
                    aria-pressed={on}
                    className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition duration-300 ${
                      on ? 'border-brand-300/40 bg-brand-300/[0.07]' : 'border-white/[0.07] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
                    }`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${on ? 'bg-brand-300/15 text-brand-200' : 'bg-white/[0.05] text-zinc-400'}`}>
                      <d.icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium text-white">{d.name}</span>
                      <span className="block text-xs tabular-nums text-zinc-400">
                        {peso(d.price)} · {d.kind}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className={`grid h-5 w-5 shrink-0 place-items-center rounded-full transition ${on ? 'bg-brand-500 text-white' : 'border border-white/20 text-transparent'}`}
                    >
                      <Check className="h-3 w-3" strokeWidth={3.5} />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </fieldset>

        <div className="mt-7">
          <div className="flex items-baseline justify-between gap-3">
            <label htmlFor="by-when" className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">
              2 · By when
            </label>
            <span className="text-sm font-medium text-white">
              {by} <span className="text-zinc-400">· {years < 2 ? `${months} months` : `${+years.toFixed(1)} years`}</span>
            </span>
          </div>
          <input
            id="by-when"
            type="range"
            min={MIN_MONTHS}
            max={MAX_MONTHS}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            aria-valuetext={`${by}, ${months} months from now`}
            className="mt-4 h-2 w-full cursor-pointer"
          />
          <div className="mt-1.5 flex justify-between text-[11px] text-zinc-400">
            <span>6 months</span>
            <span>10 years</span>
          </div>
        </div>
      </div>

      {/* The number, and the plan */}
      <div className="relative flex flex-col justify-between gap-8 border-t border-white/[0.07] bg-gradient-to-b from-brand-300/[0.06] to-transparent p-5 sm:p-8 lg:border-l lg:border-t-0">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-zinc-400">Your dream, as a number</p>
          <p className="mt-2 font-display text-5xl font-semibold tracking-[-0.03em] tabular-nums leading-none text-white sm:text-6xl" aria-hidden>
            {peso(shownTotal)}
          </p>
          <p className="mt-2 text-sm text-zinc-400">
            {picked.size ? `${picked.size} dream${picked.size > 1 ? 's' : ''}, by ${by}` : 'Pick something you want to see its price.'}
          </p>
        </div>

        <div className="rounded-2xl border border-brand-300/25 bg-black/30 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-200">Your number, as a plan</p>
          <p className="mt-2 text-sm text-zinc-300">Each month, set aside</p>
          <p className="mt-1 text-3xl font-semibold tabular-nums tracking-tight text-brand-100 sm:text-4xl" aria-hidden>
            {peso(shownMonthly)}
          </p>
          <p className="mt-2 text-sm tabular-nums text-zinc-400">
            About {peso(daily)} a day, for {months} months.
          </p>
        </div>

        {/* What a screen reader hears, once, without the gliding numbers */}
        <p className="sr-only" aria-live="polite">
          {picked.size
            ? `Total ${peso(total)} by ${by}. Set aside ${peso(monthly)} a month, about ${peso(daily)} a day.`
            : 'Nothing picked yet.'}
        </p>

        <p className="text-xs leading-relaxed text-zinc-400">
          Example prices. In Dizayr you add your own, place each one in its month, and it keeps every total up to date as you plan.
        </p>
      </div>
    </div>
  )
}
