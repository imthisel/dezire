import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { ChevronsLeftRight } from 'lucide-react'
import { useFmt, usePlan, useStore, useUsd } from '../store'
import { START_YEAR, TOTAL_MONTHS, YEARS, currentIndex, labelOf } from '../lib/time'

const H = 260
const PAD = { l: 60, r: 16, t: 16, b: 30 }
/** Below this width the chart stops squeezing and scrolls sideways instead. */
const SCROLL_BELOW = 560
const PX_PER_YEAR = 76
const AXIS_W = 52

function niceStep(raw: number) {
  const p = 10 ** Math.floor(Math.log10(raw))
  const f = raw / p
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * p
}

/**
 * Single-series net worth line (Jan 2026 → Dec 2040) with crosshair tooltip. Click to jump to a year.
 * On narrow screens it becomes a horizontally scrollable chart with a pinned value axis.
 */
export function NetWorthChart() {
  const plan = usePlan()
  const f = useFmt()
  const u = useUsd()
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const wrap = useRef<HTMLDivElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState(800)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = wrap.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setBox(Math.max(240, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const scroll = box < SCROLL_BELOW
  const padL = scroll ? 10 : PAD.l
  const w = scroll ? Math.max(box - AXIS_W, YEARS.length * PX_PER_YEAR + padL + PAD.r) : box

  const g = useMemo(() => {
    const vals = plan.map((p) => p.netWorth)
    let lo = Math.min(0, ...vals)
    let hi = Math.max(0, ...vals)
    if (hi - lo < 1) hi = lo + 1000
    const step = niceStep((hi - lo) / 4)
    lo = Math.floor(lo / step) * step
    hi = Math.ceil(hi / step) * step
    const ticks: number[] = []
    for (let v = lo; v <= hi + step / 2; v += step) ticks.push(v)
    const pw = w - padL - PAD.r
    const ph = H - PAD.t - PAD.b
    const x = (i: number) => padL + (i / (TOTAL_MONTHS - 1)) * pw
    const y = (v: number) => PAD.t + (1 - (v - lo) / (hi - lo)) * ph
    const line = vals.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
    const area = `${line}L${x(TOTAL_MONTHS - 1)},${y(0)}L${x(0)},${y(0)}Z`
    return { vals, ticks, x, y, line, area, pw, empty: vals.every((v) => v === 0) }
  }, [plan, w, padL])

  const today = currentIndex()
  const yearStart = (year - START_YEAR) * 12
  const labelEvery = scroll ? 1 : w > 900 ? 1 : w > 560 ? 2 : 3

  // Keep the selected year in view when scrolling (instant the first time, smooth afterwards).
  const first = useRef(true)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!scroll || !el) return
    const target = g.x(yearStart + 5.5) - el.clientWidth / 2
    el.scrollTo({ left: Math.max(0, target), behavior: first.current ? 'auto' : 'smooth' })
    first.current = false
  }, [scroll, yearStart, g])

  function pick(e: MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const i = Math.round(((e.clientX - rect.left - padL) / g.pw) * (TOTAL_MONTHS - 1))
    return Math.max(0, Math.min(TOTAL_MONTHS - 1, i))
  }

  const hp = hover !== null ? plan[hover] : null
  const tipLeft = hover !== null ? g.x(hover) : 0
  const flip = tipLeft > w - 236

  const svg = (
    <svg
      width={w}
      height={H}
      className={`block cursor-crosshair ${scroll ? 'touch-pan-x' : 'touch-none'}`}
      onPointerDown={(e) => e.pointerType !== 'mouse' && setHover(pick(e))}
      onPointerMove={(e) => e.pointerType === 'mouse' && setHover(pick(e))}
      onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
      onClick={(e) => setYear(START_YEAR + Math.floor(pick(e) / 12))}
      role="img"
      aria-label="Net worth over time from 2026 to 2040"
    >
      <defs>
        <linearGradient id="nw-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#818cf8" stopOpacity="0.28" />
          <stop offset="1" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* selected year band */}
      <rect
        x={g.x(yearStart) - 2}
        y={PAD.t}
        width={g.x(yearStart + 11) - g.x(yearStart) + 4}
        height={H - PAD.t - PAD.b}
        rx={6}
        fill="rgba(129,140,248,0.08)"
      />

      {g.ticks.map((t) => (
        <g key={t}>
          <line x1={padL} x2={w - PAD.r} y1={g.y(t)} y2={g.y(t)} stroke={t === 0 ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.05)'} />
          {!scroll && (
            <text x={padL - 10} y={g.y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[11px] tabular-nums">
              {f(t, true)}
            </text>
          )}
        </g>
      ))}

      {YEARS.map((yr, k) =>
        k % labelEvery === 0 ? (
          <text
            key={yr}
            x={g.x(k * 12 + 5.5)}
            y={H - 8}
            textAnchor="middle"
            className={`text-[11px] ${yr === year ? 'fill-indigo-300 font-semibold' : 'fill-zinc-500'}`}
          >
            {yr}
          </text>
        ) : null,
      )}

      <line x1={g.x(today)} x2={g.x(today)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.25)" strokeDasharray="3 4" />
      <text x={g.x(today) + 4} y={PAD.t + 10} className="fill-zinc-400 text-[10px]">
        today
      </text>

      <path d={g.area} fill="url(#nw-fill)" />
      <path d={g.line} fill="none" stroke="#a5b4fc" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {hover !== null && (
        <g>
          <line x1={g.x(hover)} x2={g.x(hover)} y1={PAD.t} y2={H - PAD.b} stroke="rgba(255,255,255,0.35)" />
          <circle cx={g.x(hover)} cy={g.y(g.vals[hover])} r={5} fill="#a5b4fc" stroke="#0b0d12" strokeWidth={2} />
        </g>
      )}
    </svg>
  )

  const shown = hp ?? plan[today]

  return (
    <div ref={wrap} className="relative select-none">
      {scroll && (
        <div className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-[11px] font-medium uppercase tracking-wider text-zinc-500">
              {labelOf(shown.index)}
              {!hp && ' · today'}
            </p>
            <p className="truncate text-base font-semibold tabular-nums text-white">
              {f(shown.netWorth)} <span className="text-xs font-normal text-zinc-500">≈ {u(shown.netWorth, true)}</span>
            </p>
          </div>
          <div className="shrink-0 text-right text-[11px] leading-4 tabular-nums">
            <p className="text-zinc-500">
              Cash <span className="text-zinc-200">{f(shown.cash, true)}</span>
            </p>
            <p className="text-zinc-500">
              Assets <span className="text-zinc-200">{f(shown.assets, true)}</span>
            </p>
          </div>
        </div>
      )}

      {scroll ? (
        <div className="relative flex">
          {/* Pinned value axis */}
          <svg width={AXIS_W} height={H} className="shrink-0" aria-hidden>
            {g.ticks.map((t) => (
              <text key={t} x={AXIS_W - 6} y={g.y(t)} dy="0.32em" textAnchor="end" className="fill-zinc-500 text-[10px] tabular-nums">
                {f(t, true)}
              </text>
            ))}
          </svg>
          <div ref={scroller} className="scrollbar-none min-w-0 flex-1 overflow-x-auto overscroll-x-contain">
            {svg}
          </div>
          {/* Edge fades hint that there is more to scroll */}
          <div aria-hidden className="pointer-events-none absolute inset-y-0 left-[52px] w-4 bg-gradient-to-r from-[#0c0d12] to-transparent" />
          <div aria-hidden className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-[#0c0d12] to-transparent" />
        </div>
      ) : (
        svg
      )}

      {scroll && (
        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
          <ChevronsLeftRight className="h-3.5 w-3.5" /> Swipe to scroll · tap a point for details
        </p>
      )}

      {g.empty && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center px-4">
          <p className="rounded-full border border-white/10 bg-black/40 px-4 py-2 text-center text-sm text-zinc-400 backdrop-blur">
            Set a goal and budget on any month to see your net worth grow
          </p>
        </div>
      )}

      {hp && !scroll && (
        <div
          className="pointer-events-none absolute top-2 z-10 w-56 rounded-xl border border-white/10 bg-[#0b0d12]/95 p-3 text-xs shadow-xl backdrop-blur"
          style={{ left: flip ? tipLeft - 236 : tipLeft + 12 }}
        >
          <p className="mb-2 font-semibold text-white">{labelOf(hp.index)}</p>
          <Row k="Net worth" v={f(hp.netWorth)} strong />
          <Row k="In US dollars" v={`≈ ${u(hp.netWorth)}`} />
          <Row k="Money left" v={f(hp.cash)} />
          <Row k="Assets value" v={f(hp.assets)} />
          <Row k="Total earned" v={f(hp.cumEarned)} />
          <Row k="Total spent" v={f(hp.cumSpent)} />
          <p className="mt-2 text-[10px] text-zinc-500">Click to open {hp.year}</p>
        </div>
      )}
    </div>
  )
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <span className="text-zinc-400">{k}</span>
      <span className={`tabular-nums ${strong ? 'font-semibold text-white' : 'text-zinc-200'}`}>{v}</span>
    </div>
  )
}
