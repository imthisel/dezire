import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { MAX_DATE, MIN_DATE, WEEKDAYS, addDays, clampDate, daysInMonth, fromKey, longDate, toKey, todayKey } from '../lib/expenses'
import { MONTHS, MONTHS_SHORT } from '../lib/time'

interface Props {
  /** Picked day, "YYYY-MM-DD" */
  value: string
  onChange: (day: string) => void
  /** Days to mark with a dot (e.g. days with spending), with an optional caption for each */
  marks?: Map<string, string>
  min?: string
  max?: string
}

const pad = (n: number) => String(n).padStart(2, '0')

/**
 * A month-at-a-time calendar that follows the real one (leap years, month lengths, weekdays) from 2026 to 2040.
 * Tap the title to jump to any month or year; swipe or use the arrows to change month; arrow keys move the day.
 */
export function Calendar({ value, onChange, marks, min = MIN_DATE, max = MAX_DATE }: Props) {
  const [view, setView] = useState(() => {
    const d = fromKey(value)
    return { y: d.getFullYear(), m: d.getMonth() }
  })
  const [dir, setDir] = useState<1 | -1>(1)
  const [picking, setPicking] = useState(false)
  const [pickYear, setPickYear] = useState(view.y)
  const grid = useRef<HTMLDivElement>(null)
  const focusDay = useRef<string | null>(null)
  const today = todayKey()
  const minY = Number(min.slice(0, 4))
  const maxY = Number(max.slice(0, 4))

  // Follow the picked day when it changes from outside (e.g. "Yesterday" button).
  useEffect(() => {
    const d = fromKey(value)
    setView((v) => (v.y === d.getFullYear() && v.m === d.getMonth() ? v : { y: d.getFullYear(), m: d.getMonth() }))
  }, [value])

  // After moving with the keyboard into another month, put focus on the new day.
  useEffect(() => {
    if (!focusDay.current) return
    grid.current?.querySelector<HTMLButtonElement>(`[data-day="${focusDay.current}"]`)?.focus()
    focusDay.current = null
  })

  const first = `${view.y}-${pad(view.m + 1)}-01`
  const last = `${view.y}-${pad(view.m + 1)}-${pad(daysInMonth(view.y, view.m))}`
  const canPrev = first > min
  const canNext = last < max

  function go(by: number) {
    const d = new Date(view.y, view.m + by, 1)
    const k = toKey(d)
    if ((by < 0 && !canPrev) || (by > 0 && k > max)) return
    setDir(by > 0 ? 1 : -1)
    setView({ y: d.getFullYear(), m: d.getMonth() })
  }

  function pick(k: string) {
    if (k < min || k > max) return
    onChange(k)
  }

  // Six weeks, starting on the Sunday on or before the 1st.
  const start = addDays(first, -fromKey(first).getDay())
  const days = Array.from({ length: 42 }, (_, i) => addDays(start, i))

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    let to: string | null = null
    if (e.key in moves) to = addDays(value, moves[e.key])
    else if (e.key === 'PageUp') to = toKey(new Date(fromKey(value).getFullYear(), fromKey(value).getMonth() - 1, Math.min(fromKey(value).getDate(), 28), 12))
    else if (e.key === 'PageDown') to = toKey(new Date(fromKey(value).getFullYear(), fromKey(value).getMonth() + 1, Math.min(fromKey(value).getDate(), 28), 12))
    else if (e.key === 'Home') to = today
    if (!to) return
    e.preventDefault()
    to = clampDate(to)
    if (to < min || to > max) return
    focusDay.current = to
    onChange(to)
  }

  // Swipe sideways to change month.
  const touch = useRef<{ x: number; y: number } | null>(null)

  return (
    <div className="select-none rounded-2xl border border-white/[0.07] bg-black/20 p-3">
      {/* Header */}
      <div className="mb-2 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setPickYear(view.y)
            setPicking((p) => !p)
          }}
          aria-expanded={picking}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-[15px] font-semibold text-white transition hover:bg-white/[0.06]"
        >
          {MONTHS[view.m]} <span className="font-medium text-zinc-400">{view.y}</span>
          <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${picking ? 'rotate-180' : ''}`} />
        </button>
        {!picking && (
          <div className="flex items-center gap-1">
            {(view.y !== fromKey(today).getFullYear() || view.m !== fromKey(today).getMonth()) && today >= min && today <= max && (
              <button
                type="button"
                onClick={() => {
                  const d = fromKey(today)
                  setDir(toKey(new Date(view.y, view.m, 1)) < today ? 1 : -1)
                  setView({ y: d.getFullYear(), m: d.getMonth() })
                }}
                className="h-8 rounded-lg px-2.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/15"
              >
                This month
              </button>
            )}
            <NavBtn label="Previous month" disabled={!canPrev} onClick={() => go(-1)}>
              <ChevronLeft className="h-4 w-4" />
            </NavBtn>
            <NavBtn label="Next month" disabled={!canNext} onClick={() => go(1)}>
              <ChevronRight className="h-4 w-4" />
            </NavBtn>
          </div>
        )}
      </div>

      {picking ? (
        /* Month & year picker */
        <div className="animate-fade">
          <div className="mb-2 flex items-center justify-between rounded-xl bg-white/[0.03] p-1">
            <NavBtn label="Previous year" disabled={pickYear <= minY} onClick={() => setPickYear((y) => y - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </NavBtn>
            <span className="text-sm font-semibold tabular-nums text-white">{pickYear}</span>
            <NavBtn label="Next year" disabled={pickYear >= maxY} onClick={() => setPickYear((y) => y + 1)}>
              <ChevronRight className="h-4 w-4" />
            </NavBtn>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {MONTHS_SHORT.map((label, m) => {
              const k1 = `${pickYear}-${pad(m + 1)}-01`
              const kN = `${pickYear}-${pad(m + 1)}-${pad(daysInMonth(pickYear, m))}`
              const off = kN < min || k1 > max
              const on = pickYear === view.y && m === view.m
              const now = today.slice(0, 7) === k1.slice(0, 7)
              return (
                <button
                  key={label}
                  type="button"
                  disabled={off}
                  onClick={() => {
                    setDir(k1 > first ? 1 : -1)
                    setView({ y: pickYear, m })
                    setPicking(false)
                  }}
                  className={`relative h-11 rounded-xl text-sm font-medium transition disabled:opacity-25 ${
                    on ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'text-zinc-300 hover:bg-white/[0.06]'
                  }`}
                >
                  {label}
                  {now && !on && <span className="absolute bottom-1.5 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-emerald-400" />}
                </button>
              )
            })}
          </div>
          {/* Years at a glance */}
          <div className="scrollbar-none -mx-3 mt-2 flex gap-1 overflow-x-auto px-3 pb-0.5">
            {Array.from({ length: maxY - minY + 1 }, (_, i) => minY + i).map((y) => (
              <button
                key={y}
                type="button"
                onClick={() => setPickYear(y)}
                className={`h-7 shrink-0 rounded-lg px-2.5 text-xs font-medium tabular-nums transition ${
                  y === pickYear ? 'bg-white/[0.1] text-white' : 'text-zinc-500 hover:text-zinc-200'
                }`}
              >
                {y}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-7 pb-1" aria-hidden>
            {WEEKDAYS.map((d, i) => (
              <span key={d} className={`text-center text-[11px] font-medium uppercase tracking-wider ${i === 0 ? 'text-rose-300/60' : 'text-zinc-500'}`}>
                {d.slice(0, 2)}
              </span>
            ))}
          </div>
          <div
            ref={grid}
            role="grid"
            aria-label={`${MONTHS[view.m]} ${view.y}`}
            onKeyDown={onKey}
            onTouchStart={(e) => (touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY })}
            onTouchEnd={(e) => {
              const t = touch.current
              touch.current = null
              if (!t) return
              const dx = e.changedTouches[0].clientX - t.x
              const dy = e.changedTouches[0].clientY - t.y
              if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1)
            }}
            key={`${view.y}-${view.m}`}
            className="grid grid-cols-7 gap-y-1"
            style={{ animation: `${dir > 0 ? 'cal-next' : 'cal-prev'} 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)` }}
          >
            {days.map((k) => {
              const d = fromKey(k)
              const inMonth = d.getMonth() === view.m
              const on = k === value
              const isToday = k === today
              const off = k < min || k > max
              const mark = marks?.get(k)
              return (
                <button
                  key={k}
                  type="button"
                  data-day={k}
                  role="gridcell"
                  aria-selected={on}
                  aria-label={`${longDate(k)}${isToday ? ', today' : ''}${mark ? `, ${mark}` : ''}`}
                  tabIndex={on ? 0 : -1}
                  disabled={off}
                  onClick={() => {
                    if (!inMonth) setDir(k > value ? 1 : -1)
                    pick(k)
                  }}
                  title={mark}
                  className="group grid h-10 place-items-center disabled:opacity-20 sm:h-9"
                >
                  <span
                    className={`relative grid h-9 w-9 place-items-center rounded-full text-sm tabular-nums transition sm:h-8 sm:w-8 ${
                      on
                        ? 'bg-indigo-500 font-semibold text-white shadow-lg shadow-indigo-500/30'
                        : isToday
                          ? 'font-semibold text-emerald-300 ring-1 ring-emerald-400/60 group-hover:bg-white/[0.06]'
                          : inMonth
                            ? 'text-zinc-200 group-hover:bg-white/[0.07]'
                            : 'text-zinc-600 group-hover:bg-white/[0.04]'
                    }`}
                  >
                    {d.getDate()}
                    {mark && (
                      <span className={`absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full ${on ? 'bg-white' : inMonth ? 'bg-amber-300' : 'bg-amber-300/40'}`} />
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function NavBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  )
}
