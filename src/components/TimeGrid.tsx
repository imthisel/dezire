import { useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { AlertCircle, Check, Plus, Repeat } from 'lucide-react'
import { useStore, useTaskKindOf } from '../store'
import { WEEKDAYS, addDays, fromKey, todayKey } from '../lib/expenses'
import {
  DAY_MINUTES, DUE_SPAN, MAX_DURATION, SNAP, byTime, daysBetween, fmtDuration, fmtRange, fmtTime, isEvent, layoutDay, nowMinutes, segmentsOf, snap,
  taskColor, type Occurrence, type Segment,
} from '../lib/tasks'
import { openTaskMenu } from './TaskMenu'
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
/** After a task's end is carried past midnight, wait this long before it can be carried again. */
const CARRY_PAUSE = 600
/** After carrying into the next day, the end picks up again once the pointer is within this many minutes of 12 AM. */
const ARM = 60

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
/** How much of the grid something takes: an event its length, a task's due-time marker a fixed bit (never past midnight). */
const spanOf = (o: Occurrence, start: number, duration: number) => (isEvent(o.task) ? duration : Math.min(DUE_SPAN, DAY_MINUTES - start))

type Drag =
  /** Dragging out a new task on empty space */
  | { mode: 'create'; col: number; anchor: number; cur: number }
  /** Moving a task: `grab` is how far after its start it was picked up (it may be a piece after midnight); `pcol` the column it was picked up in */
  | { mode: 'move'; occ: Occurrence; col: number; start: number; grab: number; pcol: number }
  /**
   * Dragging a task's bottom edge. Normally the end follows the pointer (in whichever day's column it's over).
   * Once it's been pulled past the bottom of the grid it carries on into the next day: `from` is that midnight
   * (minutes after the task's day began). The end waits there until the pointer comes up to 12 AM (`armed`),
   * then follows it down through that day.
   */
  | { mode: 'resize'; occ: Occurrence; duration: number; from: number | null; armed: boolean }

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
  /** Everything happening on those days (and the week before, for tasks that carry on past midnight) */
  occurrences: Occurrence[]
  /** A day's heading was clicked */
  onPickDay: (day: string) => void
  /** Bring `day` into view (a task being stretched has run into it) */
  onShowDay: (day: string) => void
}

/**
 * Google-Calendar-style day / week grid covering the full 24 hours.
 * Drag on empty space to add a task for that time, drag a task to move it, drag its bottom edge to make it longer —
 * past 12 AM it carries on into the next day. Right-click a task for its menu.
 * On phones: tap empty space to add, hold a task to move it, drag the handle at its bottom to resize.
 */
export function TimeGrid({ days, occurrences, onPickDay, onShowDay }: Props) {
  const kindOf = useTaskKindOf()
  const scroller = useRef<HTMLDivElement>(null)
  const cols = useRef<HTMLDivElement>(null)
  const [drag, setDragState] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const press = useRef<Press | null>(null)
  const pointer = useRef({ x: 0, y: 0 })
  const carriedAt = useRef(0)
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
  // (Not while stretching a task into the next day: that sets the scroll itself.)
  const showsToday = days.includes(today)
  useLayoutEffect(() => {
    const el = scroller.current
    if (!el || dragRef.current) return
    const at = showsToday ? Math.max(0, nowMinutes() - 120) : 7 * 60
    el.scrollTop = at * PX
  }, [days[0], days.length])

  const dragKey = (o: Occurrence) => `${o.task.id}|${o.day}`
  const resizing = drag?.mode === 'resize' ? drag : null

  const byDay = useMemo(() => {
    const m = new Map<string, { timed: Segment[]; allDay: Occurrence[] }>()
    for (const d of days) m.set(d, { timed: [], allDay: [] })
    for (const o of occurrences) {
      if (o.task.start == null) {
        m.get(o.day)?.allDay.push(o)
        continue
      }
      // An event being stretched shows at its new length.
      const len = resizing && dragKey(resizing.occ) === dragKey(o) ? resizing.duration : o.task.duration
      for (const s of segmentsOf(o, o.task.start, spanOf(o, o.task.start, len))) m.get(s.day)?.timed.push(s)
    }
    for (const v of m.values()) v.allDay.sort(byTime)
    return m
  }, [days, occurrences, resizing?.duration])
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
      // Minutes from the start of the task's day to where the end should be.
      const armed = d.from != null && (d.armed || m <= ARM)
      const end = d.from == null ? daysBetween(d.occ.day, days[colAt(x)]) * DAY_MINUTES + m : armed ? d.from + m : d.from
      setDrag({ ...d, armed, duration: clamp(snap(end) - start, SNAP, MAX_DURATION) })
    } else setDrag({ ...d, ...placeMove(d, d.occ.task.repeat ? d.pcol : colAt(x), m) })
  }

  /** Where a task being moved goes: the pointer is over column `col` at minute `m`. */
  function placeMove(d: Extract<Drag, { mode: 'move' }>, col: number, m: number) {
    // Minutes from the first day shown to where the task would now start.
    const at = col * DAY_MINUTES + snap(m) - d.grab
    // Repeating tasks keep their weekdays: they only move up and down.
    const day = d.occ.task.repeat ? d.col : clamp(Math.floor(at / DAY_MINUTES), 0, days.length - 1)
    return { col: day, start: clamp(at - day * DAY_MINUTES, 0, DAY_MINUTES - SNAP) }
  }

  /** The end of a task being stretched was pulled past 12 AM: carry on from the top of the next day. */
  function carry(d: Extract<Drag, { mode: 'resize' }>) {
    const el = scroller.current!
    const end = d.occ.task.start! + d.duration
    if (end + SNAP > MAX_DURATION) return
    carriedAt.current = Date.now()
    navigator.vibrate?.(10)
    const next = addDays(d.occ.day, Math.floor(end / DAY_MINUTES))
    if (!days.includes(next)) onShowDay(next)
    el.scrollTop = 0
    setDrag({ ...d, from: Math.round(end / DAY_MINUTES) * DAY_MINUTES, armed: false })
  }

  // While dragging: follow the pointer, scroll near the edges, and finish on release.
  useEffect(() => {
    if (!drag) return
    const root = document.documentElement
    root.setAttribute('data-touch-drag', '')
    let raf = 0
    const tick = () => {
      const el = scroller.current
      const d = dragRef.current
      if (el && d) {
        const r = el.getBoundingClientRect()
        const { y } = pointer.current
        const depth = y < r.top + EDGE ? y - (r.top + EDGE) : y > r.bottom - EDGE ? y - (r.bottom - EDGE) : 0
        const atBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 1
        const waiting = d.mode === 'resize' && d.from != null && !d.armed
        if (d.mode === 'resize' && !waiting && depth > 0 && atBottom && y >= r.bottom - 6 && Date.now() - carriedAt.current > CARRY_PAUSE) carry(d)
        // Just carried into the next day: stay at its 12 AM until the pointer comes up to it.
        else if (depth && !waiting) {
          // Stretching a task scrolls gently, so its end can be placed; moving and adding scroll quicker.
          el.scrollTop += d.mode === 'resize' ? clamp(depth / 10, -4, 4) : clamp(Math.ceil(depth / 4), -14, 14)
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
      s.openModal({ type: 'task', entry: 'event', date: days[d.col], start, duration })
    } else if (d.mode === 'resize') {
      const t = d.occ.task
      if (d.duration !== t.duration) {
        s.updateTask(t.id, { duration: d.duration })
        toast.undo(`“${t.title}” now ${fmtRange(t.start!, d.duration)}${t.repeat ? ' · every time it repeats' : ''}.`, () =>
          useStore.getState().updateTask(t.id, { duration: t.duration }),
        )
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
    const startCol = daysBetween(days[0], occ.day)
    // A repeating task whose day isn't showing (only its piece after midnight is) can't be moved here.
    if (occ.task.repeat && startCol < 0) return
    // Picked up by a piece on a later day: count from where the task starts.
    const grab = snap(minuteAt(p.y)) + (p.col - startCol) * DAY_MINUTES - occ.task.start!
    const d = { mode: 'move' as const, occ, col: Math.max(0, startCol), start: occ.task.start!, grab, pcol: p.col }
    setDrag({ ...d, ...placeMove(d, p.col, minuteAt(p.y)) })
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
    useStore.getState().openModal({ type: 'task', entry: 'event', date: days[p.col], start, duration: 60 })
  }

  function onResizeDown(e: ReactPointerEvent<HTMLElement>, occ: Occurrence) {
    if (e.button !== 0) return
    e.stopPropagation()
    e.preventDefault()
    clearPress()
    pointer.current = { x: e.clientX, y: e.clientY }
    setDrag({ mode: 'resize', occ, duration: occ.task.duration, from: null, armed: false })
  }

  /** Right-click (mouse): the task's menu. A finger's long press is for moving instead. */
  function onMenu(e: ReactMouseEvent, occ: Occurrence) {
    if (press.current?.touch || dragRef.current) return e.preventDefault()
    clearPress()
    openTaskMenu(e, occ.task.id, occ.day)
  }

  const dragging = drag && drag.mode !== 'create' ? drag.occ : null
  const n = days.length
  // Where the copy of a task being moved shows: it may carry on into the next day's column.
  const moving = drag?.mode === 'move' ? segmentsOf(drag.occ, drag.start, spanOf(drag.occ, drag.start, drag.occ.task.duration), days[drag.col]) : []

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

                  {timed.map((s) => {
                    const l = lay.get(s)!
                    const o = s.occ
                    const isDragged = dragging && dragKey(dragging) === dragKey(o)
                    if (!isEvent(o.task))
                      return (
                        <DueMarker
                          key={`${dragKey(o)}|${s.day}`}
                          seg={s}
                          left={(l.col / l.cols) * 100}
                          width={(1 / l.cols) * 100}
                          faded={!!isDragged}
                          onPointerDown={(e) => {
                            e.stopPropagation()
                            onPointerDown(e, o, col)
                          }}
                          onPointerMove={onPointerMove}
                          onPointerUp={onPointerUp}
                          onContextMenu={(e) => onMenu(e, o)}
                        />
                      )
                    return (
                      <Block
                        key={`${dragKey(o)}|${s.day}`}
                        seg={s}
                        duration={isDragged && resizing ? resizing.duration : o.task.duration}
                        left={(l.col / l.cols) * 100}
                        width={(1 / l.cols) * 100}
                        // While moving, the original stays put (faded) and a copy follows the pointer.
                        faded={!!isDragged && drag?.mode === 'move'}
                        lifted={!!isDragged && !!resizing}
                        narrow={n > 3 || l.cols > 1}
                        onPointerDown={(e) => {
                          e.stopPropagation()
                          onPointerDown(e, o, col)
                        }}
                        onPointerMove={onPointerMove}
                        // Not stopped here: the window listens for the release that ends a drag.
                        onPointerUp={onPointerUp}
                        onResizeDown={(e) => onResizeDown(e, o)}
                        onContextMenu={(e) => onMenu(e, o)}
                      />
                    )
                  })}

                  {/* Copy following the pointer */}
                  {moving
                    .filter((s) => s.day === d)
                    .map((s) =>
                      isEvent(s.occ.task) ? (
                        <Block key={s.day} seg={s} duration={s.occ.task.duration} left={0} width={100} lifted narrow={n > 3} />
                      ) : (
                        <DueMarker key={s.day} seg={s} left={0} width={100} />
                      ),
                    )}

                  {/* Just carried past midnight: where to pick the end up again */}
                  {resizing && resizing.from != null && !resizing.armed && addDays(resizing.occ.day, resizing.from / DAY_MINUTES) === d && (
                    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-30">
                      <div className="h-1 animate-pulse bg-indigo-400 shadow-[0_0_12px_rgba(129,140,248,0.9)]" />
                      <p className="mx-auto mt-1.5 w-fit rounded-md bg-indigo-500 px-1.5 py-0.5 text-[10.5px] font-semibold text-white shadow-lg">↑ Keep dragging from 12 AM</p>
                    </div>
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

      {/* When a task being stretched will end (its end may be on a day that isn't showing) */}
      {resizing && <EndsLabel drag={resizing} at={pointer.current} />}
    </div>
  )
}

function EndsLabel({ drag, at }: { drag: Extract<Drag, { mode: 'resize' }>; at: { x: number; y: number } }) {
  const end = drag.occ.task.start! + drag.duration
  const later = Math.floor(end / DAY_MINUTES)
  const day = addDays(drag.occ.day, later)
  return (
    <div
      className="pointer-events-none fixed z-[60] -translate-x-1/2 whitespace-nowrap rounded-lg bg-zinc-950/90 px-2 py-1 text-xs font-medium tabular-nums text-white shadow-lg ring-1 ring-white/15"
      style={{ left: at.x, top: Math.max(8, at.y - 38) }}
    >
      Ends {later > 0 && <span className="text-indigo-200">{WEEKDAYS[fromKey(day).getDay()]} </span>}
      {fmtTime(end % DAY_MINUTES, true)}
      <span className="text-zinc-400"> · {fmtDuration(drag.duration)}</span>
      {drag.from != null && !drag.armed && <span className="block text-[11px] font-normal text-indigo-200">Move up to 12 AM to keep going</span>}
    </div>
  )
}

/** One day's piece of a timed task on the grid. */
function Block({
  seg, duration, left, width, faded, lifted, narrow, onPointerDown, onPointerMove, onPointerUp, onResizeDown, onContextMenu,
}: {
  seg: Segment
  /** The whole task's length (for its time label) */
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
  onContextMenu?: (e: ReactMouseEvent<HTMLDivElement>) => void
}) {
  const occ = seg.occ
  const kind = useTaskKindOf()(occ.task.kind)
  const c = taskColor(kind)
  const len = seg.end - seg.start
  const h = Math.max(len * PX, 18)
  const short = len < 45
  const t = occ.task
  const preview = !onPointerDown
  const range = fmtRange(t.start!, duration)
  // The first piece says when it runs; the ones after midnight say until when.
  const when = seg.first ? (short ? fmtTime(seg.start, true) : range) : seg.last ? `until ${fmtTime(seg.end % DAY_MINUTES, true)}` : 'all day'

  return (
    <div
      role={preview ? undefined : 'button'}
      tabIndex={preview ? undefined : 0}
      aria-label={preview ? undefined : `${t.title}, ${range}, ${kind.label}${occ.done ? ', done' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => e.key === 'Enter' && useStore.getState().openModal({ type: 'task', editId: t.id })}
      onContextMenu={onContextMenu ?? ((e) => e.preventDefault())}
      className={`group/b absolute overflow-hidden border-l-[3px] ${c.edge} ${c.block} ${seg.first ? 'rounded-t-lg' : ''} ${seg.last ? 'rounded-b-lg' : ''} px-1.5 text-left outline-none backdrop-blur-sm transition-[background-color,opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-white/60 ${
        preview ? 'pointer-events-none z-30 shadow-2xl shadow-black/60 ring-1 ring-white/25' : 'z-10 cursor-pointer'
      } ${lifted ? 'z-30 shadow-xl shadow-black/50 ring-1 ring-white/25' : ''} ${faded ? 'opacity-35' : ''} ${occ.done && !preview ? 'opacity-55' : ''}`}
      style={{
        top: seg.start * PX + (seg.first ? 1 : 0),
        height: h - (seg.first ? 1 : 0) - (seg.last ? 1 : 0),
        left: `calc(${left}% + 1px)`,
        width: `calc(${width}% - 3px)`,
      }}
    >
      <div className={`flex h-full min-w-0 ${short ? 'items-center gap-1' : 'flex-col pt-1'}`}>
        <p className={`flex min-w-0 items-center gap-1 text-[12px] font-semibold leading-tight ${c.title} ${occ.done ? 'line-through decoration-2' : ''}`}>
          {occ.done && <Check className="h-3 w-3 shrink-0" strokeWidth={3} />}
          <span className={short ? 'truncate' : 'line-clamp-2 break-words'}>{t.title}</span>
        </p>
        <p className={`flex min-w-0 shrink-0 items-center gap-1 text-[11px] leading-tight tabular-nums ${c.sub} ${short ? '' : 'mt-0.5'} ${narrow && short ? 'hidden sm:flex' : ''}`}>
          <span className="truncate">{when}</span>
          {t.repeat && <Repeat className="h-2.5 w-2.5 shrink-0" />}
        </p>
      </div>
      {/* Bottom edge (on the day it ends): drag to make it longer or shorter, past 12 AM into the next day */}
      {onResizeDown && seg.last && (
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

/** A task due at a time: a slim pill with a box to tick it off right on the calendar. */
function DueMarker({
  seg, left, width, faded, onPointerDown, onPointerMove, onPointerUp, onContextMenu,
}: {
  seg: Segment
  left: number
  width: number
  faded?: boolean
  onPointerDown?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerMove?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp?: (e: ReactPointerEvent<HTMLDivElement>) => void
  onContextMenu?: (e: ReactMouseEvent<HTMLDivElement>) => void
}) {
  const { occ } = seg
  const t = occ.task
  const kind = useTaskKindOf()(t.kind)
  const c = taskColor(kind)
  const preview = !onPointerDown
  const today = todayKey()
  const late = !occ.done && (occ.day < today || (occ.day === today && t.start! < nowMinutes()))

  return (
    <div
      role={preview ? undefined : 'button'}
      tabIndex={preview ? undefined : 0}
      aria-label={preview ? undefined : `Task: ${t.title}, due ${fmtTime(t.start!)}, ${kind.label}${occ.done ? ', done' : late ? ', overdue' : ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onKeyDown={(e) => e.key === 'Enter' && useStore.getState().openModal({ type: 'task', editId: t.id })}
      onContextMenu={onContextMenu ?? ((e) => e.preventDefault())}
      className={`absolute flex h-[22px] items-center gap-1.5 overflow-hidden rounded-full border bg-[#101219]/95 pl-0.5 pr-2 text-left outline-none transition-[opacity,box-shadow] focus-visible:ring-2 focus-visible:ring-white/60 ${
        late ? 'border-rose-400/80' : c.ring
      } ${preview ? 'pointer-events-none z-30 shadow-2xl shadow-black/60' : 'z-[15] cursor-pointer shadow-md shadow-black/40 hover:bg-[#171a24]'} ${faded ? 'opacity-35' : ''} ${
        occ.done && !preview ? 'opacity-60' : ''
      }`}
      style={{ top: seg.start * PX, left: `calc(${left}% + 1px)`, width: `calc(${width}% - 3px)` }}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={occ.done}
        aria-label={occ.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
        // Ticking it off doesn't pick it up or open it.
        onPointerDown={(e) => e.stopPropagation()}
        onPointerUp={(e) => e.stopPropagation()}
        onClick={() => useStore.getState().toggleTask(t.id, occ.day)}
        className={`grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
          occ.done ? `${c.dot} border-transparent` : `${late ? 'border-rose-400' : c.ring} hover:bg-white/10`
        }`}
      >
        {occ.done && <Check className="h-2.5 w-2.5 text-black/75" strokeWidth={4} />}
      </button>
      <span className={`min-w-0 truncate text-[11.5px] font-semibold ${occ.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{t.title}</span>
      <span className={`ml-auto hidden shrink-0 items-center gap-0.5 text-[10.5px] tabular-nums sm:flex ${late ? 'text-rose-300' : 'text-zinc-500'}`}>
        {late && <AlertCircle className="h-3 w-3" />}
        {fmtTime(t.start!, true)}
      </span>
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
  byDay: Map<string, { timed: Segment[]; allDay: Occurrence[] }>
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
              onClick={(e) => e.target === e.currentTarget && useStore.getState().openModal({ type: 'task', entry: 'event', date: d, start: null })}
              title="Add an all-day event"
              className="min-w-0 cursor-cell space-y-0.5 border-r border-white/[0.05] p-0.5 last:border-r-0"
            >
              {shown.map((o) => {
                const c = taskColor(kindOf(o.task.kind))
                // A task due that day (any time): ticked off right here.
                if (!isEvent(o.task))
                  return (
                    <div
                      key={o.task.id}
                      onContextMenu={(e) => openTaskMenu(e, o.task.id, o.day)}
                      className={`flex w-full min-w-0 items-center gap-1 rounded-full border ${c.ring} bg-[#101219]/95 py-px pl-0.5 pr-1.5 ${o.done ? 'opacity-60' : ''}`}
                    >
                      <button
                        role="checkbox"
                        aria-checked={o.done}
                        aria-label={o.done ? `Mark “${o.task.title}” not done` : `Mark “${o.task.title}” done`}
                        onClick={() => useStore.getState().toggleTask(o.task.id, o.day)}
                        className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${o.done ? `${c.dot} border-transparent` : `${c.ring} hover:bg-white/10`}`}
                      >
                        {o.done && <Check className="h-2.5 w-2.5 text-black/75" strokeWidth={4} />}
                      </button>
                      <button
                        onClick={() => useStore.getState().openModal({ type: 'task', editId: o.task.id })}
                        className={`min-w-0 flex-1 truncate text-left text-[11.5px] font-semibold ${o.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}
                      >
                        {o.task.title}
                      </button>
                    </div>
                  )
                return (
                  <button
                    key={o.task.id}
                    onClick={() => useStore.getState().openModal({ type: 'task', editId: o.task.id })}
                    onContextMenu={(e) => openTaskMenu(e, o.task.id, o.day)}
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
