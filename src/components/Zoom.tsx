import { useEffect, useId, useState } from 'react'
import { useStore, type PhoneCols } from '../store'
import { useZoomHud, zoomTo } from '../zoom'

const COLS: PhoneCols[] = [1, 2, 3]
const label = (n: number) => `${n} column${n > 1 ? 's' : ''}`

/** A tiny picture of `n` columns. */
function ColsGlyph({ n, on }: { n: number; on: boolean }) {
  return (
    <span className="flex h-4 w-[18px] gap-[2px]">
      {Array.from({ length: n }, (_, i) => (
        <span key={i} className={`flex-1 rounded-[3px] transition-colors duration-300 ${on ? 'bg-indigo-200' : 'bg-zinc-500'}`} />
      ))}
    </span>
  )
}

/** Phones: pick 1, 2 or 3 columns (the tap version of pinching). */
export function ZoomControl({ className = '' }: { className?: string }) {
  const cols = useStore((s) => s.phoneCols)
  const id = useId()

  return (
    <div id={id} className={`flex items-center justify-between gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.025] py-2 pl-3.5 pr-2 sm:hidden ${className}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-zinc-100">{label(cols)}</span>
        <span className="block truncate text-xs text-zinc-500">{cols === 1 ? 'Pinch in to see more at once' : 'Pinch out or tap a card to zoom in'}</span>
      </span>
      <div role="radiogroup" aria-label="Columns" className="relative grid shrink-0 grid-cols-3 rounded-xl border border-white/10 bg-black/30 p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/3)] rounded-lg bg-indigo-500/25 ring-1 ring-indigo-400/40 transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.3,0.64,1)]"
          style={{ transform: `translateX(${(cols - 1) * 100}%)` }}
        />
        {COLS.map((n) => (
          <button
            key={n}
            role="radio"
            aria-checked={cols === n}
            aria-label={label(n)}
            onClick={() => zoomTo(n, { anchor: document.getElementById(id) })}
            className="relative grid h-9 w-11 place-items-center rounded-lg transition active:scale-90"
          >
            <ColsGlyph n={n} on={cols === n} />
          </button>
        ))}
      </div>
    </div>
  )
}

/** Floating "1 · 2 · 3" indicator while pinching, and for a moment after the layout changes. */
export function ZoomHud() {
  const hud = useZoomHud()
  const [linger, setLinger] = useState(false)

  useEffect(() => {
    if (hud.active || !hud.at) return
    setLinger(true)
    const t = setTimeout(() => setLinger(false), 750)
    return () => clearTimeout(t)
  }, [hud])

  const show = hud.active || linger
  return (
    <div
      aria-live="polite"
      className={`pointer-events-none fixed inset-x-0 top-[max(0.75rem,env(safe-area-inset-top))] z-[60] flex justify-center transition-all duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] sm:hidden ${
        show ? 'translate-y-0 opacity-100' : '-translate-y-3 opacity-0'
      }`}
    >
      <div className="flex items-center gap-3 rounded-full border border-white/10 bg-[#0e1016]/90 py-2 pl-2 pr-4 shadow-2xl shadow-black/60 backdrop-blur-xl">
        <div className="flex gap-1">
          {COLS.map((n) => (
            <span
              key={n}
              className={`grid h-8 w-8 place-items-center rounded-full transition-all duration-300 ${
                hud.target === n ? 'scale-100 bg-indigo-500/30 ring-1 ring-indigo-400/50' : 'scale-90 bg-white/[0.04]'
              }`}
            >
              <ColsGlyph n={n} on={hud.target === n} />
            </span>
          ))}
        </div>
        <span key={hud.target} className="animate-tick text-sm font-semibold tabular-nums text-white">
          {label(hud.target)}
        </span>
      </div>
    </div>
  )
}
