import { useEffect, useLayoutEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Check, Plus, Repeat } from 'lucide-react'
import { useStore, useTaskKindOf } from '../store'
import { WEEKDAYS, fromKey, todayKey } from '../lib/expenses'
import { DAY_MINUTES, SNAP, byTime, fmtRange, fmtTime, layoutDay, nowMinutes, snap, taskColor, type Occurrence } from '../lib/tasks'
import { toast } from '../toast'

/** Height of one hour, in pixels. */
const HOUR = 52
const PX = HOUR / 60
/** Press this long on a phone before a task can be moved (so a swipe still scrolls). */
const HOLD_MS = 320
/** Moving further than this means scrolling (touch) or dragging (mouse), not a tap / click. */
const SLOP = 6
/** Pixels from the top / bottom edge where dragging scrolls the grid. */
const EDGE = 48

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

type Drag =
  /** Dragging out a new task on empty space */
  | { mode: 'create'; col: number; anchor: number; cur: number }
  /** Moving a task: `grab` is how far below its start it was picked up */
  | { mode: 'move'; occ: Occurrence; col: number; start: number; grab: number }
  /** Dragging a task's bottom edge */
  | { mode: 'resize'; occ: Occurrence; col: number; duration: number }

/** What a press may turn into once it moves (or is held, on a phone). */
type Press = {
  x: number
  y: number
  touch: boolean
  /** A press on a task (move it, or open it when it's just a tap) or on empty space */
  occ: Occurrence | null
  col: number
  timer?: ReturnType<typeof setTimeout>
}

interface Props {
  /** The days shown, left to right ("YYYY-MM-DD") */
  days: string[]
  /** Everything happening on those days */
  occurrences: Occurrence[]
  /** A day's heading was clicked */
  onPickDay: (day: string) => void
}

/**
 * Google-Calendar-style day / week grid covering the full 24 hours.
 * Drag on empty space to add a task for that time, drag a task to move it, drag its bottom edge to make it longer.
 * On phones: tap empty space to add, hold a task to move it, drag the handle at its bottom to resize.
 */
export function TimeGrid({ days, occurrences, onPickDay }: Props) {
  const kindOf = useTaskKindOf()
  const scroller = useRef<HTMLDivElement>(null)
  const cols = useRef<HTMLDivElement>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const press = useRef<Press | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const today = todayKey()
  const [now, setNow] = useState(nowMinutes)

  const setDrag = (d: Drag | null) => {
    dragRef.current = d
    setDragState(d)
  }

  // The red "now" line moves every minute.
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(t)
  }, [])

  // Open on the hours that matter: a little before now when today is showing, otherwise the morning.
  const showsToday = days.includes(today)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el) return
    const at = showsToday ? Math.max(0, nowMinutes() - 120) : 7 * 60
    el.scrollTop = at * PX
  }, [days[0], days.length])

  const byDay = useMemo(() => {
    const m = new Map<string, { timed: Occurrence[]; allDay: Occurrence[] }>()
    for (const d of days) m.set(d, { timed: [], allDay: [] })
    for (const o of occurrences) {
      const slot = m.get(o.day)
      if (!slot) continue
      if (o.task.start == null) slot.allDay.push(o)
      else slot.timed.push(o)
    }
    for (const v of m.values()) v.allDay.sort(byTime)
    return m
  }, [days, occurrences])
  const layouts = useMemo(() => new Map(days.map((d) => [d, layoutDay(byDay.get(d)!.timed)])), [days, byDay])

  // ---- Pointer → time and day ----

  const minuteAt = (y: number) => {
    const r = cols.current!.getBoundingClientRect()
    return clamp((y - r.top) / PX, 0, DAY_MINUTES)
  }
  const colAt = (x: number) => {
    const r = cols.current!.getBoundingClientRect()
    return clamp(Math.floor(((x - r.left) / r.width) * days.length), 0, days.length - 1)
  }

  /** Follows the pointer with whatever is being dragged. */
  function update(x: number, y: number) {
    const d = dragRef.current
    if (!d) return
    const m = minuteAt(y)
    if (d.mode === 'create') setDrag({ ...d, cur: clamp(snap(m), 0, DAY_MINUTES) })
    else if (d.mode === 'resize') {
      const start = d.occ.task.start!
      setDrag({ ...d, duration: clamp(snap(m) - start, SNAP, DAY_MINUTES - start) })
    } else {
      const len = d.occ.task.duration
      // Repeating tasks keep their weekdays: they only move up and down.
      const col = d.occ.task.repeat ? d.col : colAt(x)
      setDrag({ ...d, col, start: clamp(snap(m - d.grab), 0, DAY_MINUTES - Math.min(len, DAY_MINUTES - SNAP)) })
    }
  }

  // While dragging: follow the pointer, scroll near the edges, and finish on release.
  useEffect(() => {
    if (!drag) return
    const root = document.documentElement
    root.setAttribute('data-touch-drag', '')
    let raf = 0
    const tick = () => {
      const el = scroller.current
      if (el) {
        const r = el.getBoundingClientRect()
        const { y } = pointer.current
        const by = y < r.top + EDGE ? -Math.ceil((r.top + EDGE - y) / 4) : y > r.bottom - EDGE ? Math.ceil((y - (r.bottom - EDGE)) / 4) : 0
        if (by) {
          el.scrollTop += clamp(by, -14, 14)
          update(pointer.current.x, pointer.current.y)
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    const move = (e: PointerEvent) => {
      pointer.current = { x: e.clientX, y: e.clientY }
      update(e.clientX, e.clientY)
    }
    const up = () => finish(true)
    const cancel = () => finish(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && finish(false)
    // The finger is moving a task, not the page.
    const noScroll = (e: TouchEvent) => e.cancelable && e.preventDefault()
    window.addEventListener('pointermove', move, true)
    window.addEventListener('pointerup', up, true)
    window.addEventListener('pointercancel', cancel, true)
    window.addEventListener('keydown', esc)
    window.addEventListener('touchmove', noScroll, { passive: false })
    return () => {
      cancelAnimationFrame(raf)
      root.removeAttribute('data-touch-drag')
      window.removeEventListener('pointermove', move, true)
      window.removeEventListener('pointerup', up, true)
      window.removeEventListener('pointercancel', cancel, true)
      window.removeEventListener('keydown', esc)
      window.removeEventListener('touchmove', noScroll)
    }
    // Only (re)subscribe when a drag starts or ends.
  }, [!!drag])

  function finish(commit: boolean) {
    const d = dragRef.current
    setDrag(null)
    if (!d || !commit) return
    const s = useStore.getState()
    if (d.mode === 'create') {
      const a = Math.min(d.anchor, d.cur)
      const b = Math.max(d.anchor, d.cur)
      // Just a click: an hour from where it was clicked.
      const start = b - a < SNAP ? Math.min(d.anchor, DAY_MINUTES - 60) : a
      const duration = b - a < SNAP ? 60 : b - a
      s.openModal({ type: 'task', date: days[d.col], start, duration })
    } else if (d.mode === 'resize') {
      if (d.duration !== d.occ.task.duration) {
        s.updateTask(d.occ.task.id, { duration: d.duration })
        toast.success(`“${d.occ.task.title}” now ${fmtRange(d.occ.task.start!, d.duration)}${d.occ.task.repeat ? ' · every time it repeats' : ''}.`)
      }
    } else {
      const day = days[d.col]
      const t = d.occ.task
      if (d.start === t.start && day === d.occ.day) return
      s.updateTask(t.id, t.repeat ? { start: d.start } : { start: d.start, date: day })
      const label = day === d.occ.day ? fmtTime(d.start, true) : `${WEEKDAYS[fromKey(day).getDay()]} ${fmtTime(d.start, true)}`
      toast.undo(`Moved “${t.title}” to ${label}${t.repeat ? ' · every time it repeats' : ''}.`, () =>
        useStore.getState().updateTask(t.id, { start: t.start, date: t.date }),
      )
    }
  }

  // ---- Pressing ----

  function clearPress() {
    if (press.current?.timer) clearTimeout(press.current.timer)
    press.current = null
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>, occ: Occurrence | null, col: number) {
    if (e.button !== 0 || dragRef.current) return
    clearPress()
    const touch = e.pointerType !== 'mouse'
    pointer.current = { x: e.clientX, y: e.clientY }
    const p: Press = { x: e.clientX, y: e.clientY, touch, occ, col }
    press.current = p
    // A held finger on a task picks it up.
    if (touch && occ) {
      p.timer = setTimeout(() => {
        if (press.current !== p) return
        navigator.vibrate?.(12)
        startMove(p)
      }, HOLD_MS)
    }
    if (!touch) e.preventDefault() // no text selection while dragging
  }

  function startMove(p: Press) {
    press.current = null
    const occ = p.occ!
    setDrag({ mode: 'move', occ, col: p.col, start: occ.task.start!, grab: minuteAt(p.y) - occ.task.start! })
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const p = press.current
    if (!p) return
    pointer.current = { x: e.clientX, y: e.clientY }
    if (Math.hypot(e.clientX - p.x, e.clientY - p.y) <= SLOP) return
    // A finger that moves before the hold is scrolling.
    if (p.touch) return clearPress()
    if (p.occ) startMove(p)
    else {
      press.current = null
      const anchor = clamp(Math.floor(minuteAt(p.y) / SNAP) * SNAP, 0, DAY_MINUTES - SNAP)
      setDrag({ mode: 'create', col: p.col, anchor, cur: anchor })
      update(e.clientX, e.clientY)
    }
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const p = press.current
    clearPress()
    if (!p || Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) return
    // A tap or click: open the task, or start a new one at that time.
    if (p.occ) return useStore.getState().openModal({ type: 'task', editId: p.occ.task.id })
    const start = clamp(Math.floor(minuteAt(p.y) / 30) * 30, 0, DAY_MINUTES - 60)
    useStore.getState().openModal({ type: 'task', date: days[p.col], start, duration: 60 })
  }

  function onResizeDown(e: ReactPointerEvent<HTMLElement>, occ: Occurrence, col: number) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    clearPress()
    pointer.current = { x: e.clientX, y: e.clientY }
    setDrag({ mode: 'resize', occ, col, duration: occ.task.duration })
  }

  const dragging = drag && drag.mode !== 'create' ? drag.occ : null
  const dragKey = (o: Occurrence) => `${o.task.id}|${o.day}`
  const n = days.length

  return (
    <div className="flex min-h-0 flex-col select-none">
      {/* Day headings */}
      <div className="flex border-b border-white/[0.07]">
        <div className="w-12 shrink-0 sm:w-14" />
        <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
          {days.map((d) => {
            const dt = fromKey(d)
            const isToday = d === today
            return (
              <button
                key={d}
                onClick={() => onPickDay(d)}
                title="Show this day"
                className="group flex flex-col items-center gap-0.5 py-2 transition hover:bg-white/[0.02]"
              >
                <span className={`text-[10.5px] font-semibold uppercase tracking-wider ${isToday ? 'text-indigo-300' : dt.getDay() === 0 ? 'text-rose-300/60' : 'text-zinc-500'}`}>
                  {WEEKDAYS[dt.getDay()]}
                </span>
                <span
                  className={`grid h-8 w-8 place-items-center rounded-full text-[15px] font-semibold tabular-nums transition sm:h-9 sm:w-9 sm:text-lg ${
                    isToday ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/30' : 'text-zinc-200 group-hover:bg-white/[0.07]'
                  }`}
                >
                  {dt.getDate()}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* All-day tasks */}
      <AllDayRow days={days} byDay={byDay} kindOf={kindOf} />

      {/* The 24 hours */}
      <div ref={scroller} className="relative h-[62dvh] min-h-[360px] overflow-y-auto overscroll-contain sm:h-[68dvh] sm:max-h-[860px]">
        <div className="flex" style={{ height: 24 * HOUR }}>
          {/* Hours */}
          <div className="relative w-12 shrink-0 sm:w-14" aria-hidden>
            {Array.from({ length: 23 }, (_, i) => i + 1).map((h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] font-medium tabular-nums text-zinc-500" style={{ top: h * HOUR }}>
                {fmtTime(h * 60, true)}
              </span>
            ))}
          </div>

          <div
            ref={cols}
            className="relative grid flex-1 border-l border-white/[0.07]"
            style={{
              gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`,
              backgroundImage: 'linear-gradient(to bottom, rgba(255,255,255,0.065) 1px, transparent 1px)',
              backgroundSize: `100% ${HOUR}px`,
            }}
          >
            {days.map((d, col) => {
              const { timed } = byDay.get(d)!
              const lay = layouts.get(d)!
              const isToday = d === today
              const past = d < today
              return (
                <div
                  key={d}
                  data-col={col}
                  onPointerDown={(e) => onPointerDown(e, null, col)}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onContextMenu={(e) => press.current && e.preventDefault()}
                  className={`relative cursor-cell border-r border-white/[0.05] last:border-r-0 ${isToday ? 'bg-indigo-500/[0.035]' : past ? 'bg-black/[0.12]' : ''}`}
                >
                  {/* Half hours */}
                  <div
                    aria-hidden
                    className="pointer-events-none absolute inset-0"
                    style={{
                      backgroundImage: 'linear-gradient(to bottom, transparent 50%, rgba(255,255,255,0.025) 50%, rgba(255,255,255,0.025) calc(50% + 1px), transparent calc(50% + 1px))',
                      backgroundSize: `100% ${HOUR}px`,
                    }}
                  />

                  {timed.map((o) => {
                    const l = lay.get(o)!
                    const isDragged = dragging && dragKey(dragging) === dragKey(o)
                    return (
                      <Block
                        key={dragKey(o)}
                        occ={o}
                        start={o.task.start!}
                        duration={isDragged && drag?.mode === 'resize' ? drag.duration : o.task.duration}
                        left={(l.col / l.cols) * 100}
                        width={(1 / l.cols) * 100}
                        // While moving, the original stays put (faded) and a copy follows the pointer.
                        faded={!!isDragged && drag?.mode === 'move'}
                        lifted={!!isDragged && drag?.mode === 'resize'}
                        narrow={n > 3 || l.cols > 1}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onPointerDown(e, o, col)
                        }}
                        onPointerMove={onPointerMove}
                        // Not stopped here: the window listens for the release that ends a drag.
                        onPointerUp={onPointerUp}
                        onResizeDown={(e) => onResizeDown(e, o, col)}
                      />
                    )
                  })}

                  {/* Copy following the pointer */}
                  {drag?.mode === 'move' && drag.col === col && (
                    <Block occ={drag.occ} start={drag.start} duration={drag.occ.task.duration} left={0} width={100} lifted narrow={n > 3} />
                  )}

                  {/* New task being dragged out */}
                  {drag?.mode === 'create' && drag.col === col && <Ghost a={drag.anchor} b={drag.cur} />}

                  {/* Now */}
                  {isToday && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 z-20" style={{ top: now * PX }}>
                      <div className="relative h-0.5 bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.6)]">
                        <span className="absolute -left-1.5 -top-[5px] h-3 w-3 rounded-full bg-rose-500" />
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}

/** A timed task on the grid. */
function Block({
  occ, start, duration, left, width, faded, lifted, narrow, onPointerDown, onPointerMove, onPointerUp, onResizeDown,
}: {
  occ: Occurrence
  start: number
  duration: number
  left: number
  width: number
  faded?: boolean
  lifted?: boolean
  narrow?: boolean
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onResizeDown?: (e: ReactPointerEvent<HTMLElement>) => void
}) {
  const kind = useTaskKindOf()(occ.task.kind)
  const c = taskColor(kind)
  const h = Math.max(duration * PX, 18)
  const short = duration < 45
  const t = occ.task
  const preview = !onPointerDown

  return (
    <div
      role={preview ? undefined : 'button'}
      tabIndex={preview ? undefined : 0}
      aria-label={preview ? undefined : `${t.title}, ${fmtRange(start, duration)}, ${kind.label}${occ.done ? ', done' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => e.key === 'Enter' && useStore.getState().openModal({ type: 'task', editId: t.id })}
      onContextMenu={(e) => e.preventDefault()}
      className={`group/b absolute overflow-hidden rounded-lg border-l-[3px] ${c.edge} ${c.block} px-1.5 text-left outline-none backdrop-blur-sm transition-[background-color,opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-white/60 ${
        preview ? 'pointer-events-none z-30 shadow-2xl shadow-black/60 ring-1 ring-white/25' : 'z-10 cursor-pointer'
      } ${lifted ? 'z-30 shadow-xl shadow-black/50 ring-1 ring-white/25' : ''} ${faded ? 'opacity-35' : ''} ${occ.done && !preview ? 'opacity-55' : ''}`}
      style={{ top: start * PX + 1, height: h - 2, left: `calc(${left}% + 1px)`, width: `calc(${width}% - 3px)` }}
    >
      <div className={`flex h-full min-w-0 ${short ? 'items-center gap-1' : 'flex-col pt-1'}`}>
        <p className={`flex min-w-0 items-center gap-1 text-[12px] font-semibold leading-tight ${c.title} ${occ.done ? 'line-through decoration-2' : ''}`}>
          {occ.done && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
          <span className={short ? 'truncate' : 'line-clamp-2 break-words'}>{t.title}</span>
        </p>
        <p className={`flex min-w-0 shrink-0 items-center gap-1 text-[11px] leading-tight tabular-nums ${c.sub} ${short ? '' : 'mt-0.5'} ${narrow && short ? 'hidden sm:flex' : ''}`}>
          <span className="truncate">{short ? fmtTime(start, true) : fmtRange(start, duration)}</span>
          {t.repeat && <Repeat className="h-2.5 w-2.5 shrink-0" />}
        </p>
      </div>
      {/* Bottom edge: drag to make it longer or shorter */}
      {onResizeDown && (
        <div
          onPointerDown={onResizeDown}
          title="Drag to change how long it takes"
          className="absolute inset-x-0 bottom-0 flex h-2.5 cursor-ns-resize touch-none items-end justify-center pb-[3px] [@media(pointer:coarse)]:h-4"
        >
          <span className="h-[3px] w-6 rounded-full bg-white/50 opacity-0 transition group-hover/b:opacity-100 [@media(pointer:coarse)]:opacity-70" />
        </div>
      )}
    </div>
  )
}

/** The new task being dragged out on empty space. */
function Ghost({ a, b }: { a: number; b: number }) {
  const start = Math.min(a, b)
  const len = Math.max(SNAP, Math.abs(b - a))
  return (
    <div
      className="pointer-events-none absolute inset-x-0.5 z-30 rounded-lg border border-indigo-300/70 bg-indigo-500/30 px-1.5 py-1 shadow-xl shadow-indigo-950/50"
      style={{ top: start * PX, height: len * PX }}
    >
      <p className="flex items-center gap-1 text-[12px] font-semibold text-white">
        <Plus className="h-3 w-3" strokeWidth={3} /> New task
      </p>
      <p className="text-[11px] tabular-nums text-indigo-100/80">{fmtRange(start, len)}</p>
    </div>
  )
}

/** Tasks with a day but no time, above the hours. */
function AllDayRow({
  days, byDay, kindOf,
}: {
  days: string[]
  byDay: Map<string, { timed: Occurrence[]; allDay: Occurrence[] }>
  kindOf: ReturnType<typeof useTaskKindOf>
}) {
  const [open, setOpen] = useState(false)
  const most = Math.max(0, ...days.map((d) => byDay.get(d)!.allDay.length))
  const LIMIT = 2
  return (
    <div className="flex border-b border-white/[0.07]">
      <div className="flex w-12 shrink-0 flex-col items-end justify-start px-2 pt-1.5 sm:w-14">
        <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-600">All day</span>
        {most > LIMIT && (
          <button onClick={() => setOpen((o) => !o)} className="mt-0.5 text-[10px] font-medium text-indigo-300 hover:text-indigo-200">
            {open ? 'Less' : 'More'}
          </button>
        )}
      </div>
      <div className="grid min-h-[30px] flex-1 border-l border-white/[0.07]" style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}>
        {days.map((d) => {
          const list = byDay.get(d)!.allDay
          const shown = open ? list : list.slice(0, LIMIT)
          return (
            <div
              key={d}
              onClick={(e) => e.target === e.currentTarget && useStore.getState().openModal({ type: 'task', date: d, start: null })}
              title="Add an all-day task"
              className="min-w-0 cursor-cell space-y-0.5 border-r border-white/[0.05] p-0.5 last:border-r-0"
            >
              {shown.map((o) => {
                const c = taskColor(kindOf(o.task.kind))
                return (
                  <button
                    key={o.task.id}
                    onClick={() => useStore.getState().openModal({ type: 'task', editId: o.task.id })}
                    className={`flex w-full min-w-0 items-center gap-1 rounded-md border-l-[3px] ${c.edge} ${c.block} px-1.5 py-0.5 text-left text-[11.5px] font-semibold ${c.title} ${
                      o.done ? 'line-through opacity-55' : ''
                    }`}
                  >
                    <span className="truncate">{o.task.title}</span>
                    {o.task.repeat && <Repeat className="h-2.5 w-2.5 shrink-0 opacity-70" />}
                  </button>
                )
              })}
              {!open && list.length > LIMIT && (
                <button onClick={() => setOpen(true)} className="w-full truncate px-1 text-left text-[10.5px] font-medium text-zinc-400 hover:text-white">
                  +{list.length - LIMIT} more
                </button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
