import { useEffect, useMemo, useRef, useState, type DragEvent, type KeyboardEvent } from 'react'
import { AlarmClock, CalendarDays, CalendarRange, Check, CheckCheck, ChevronLeft, ChevronRight, Eye, EyeOff, Flame, Plus, StickyNote } from 'lucide-react'
import { useStore } from '../store'
import { WEEKDAYS, addDays, daysInMonth, fromKey, longDate, startOfWeek, toKey, weekOrder } from '../lib/expenses'
import { MONTHS, MONTHS_SHORT } from '../lib/time'
import { KIND_COLORS } from '../lib/meta'
import { daysBetween, findSubject, shortDate, type School as SchoolData, type SchoolTask } from '../lib/school'
import { card } from './Dashboard'
import { toast } from '../toast'

/*
 * School → Calendar: every task on the day it's due, so a busy week (or a free one) is easy to see.
 * Month or week at a time. Pick a day to see its tasks on the side; drag a task to another day to move its due date.
 */

type Mode = 'month' | 'week'

const openTask = (id: string) => useStore.getState().openModal({ type: 'school', editId: id })
const newTaskOn = (due: string) => useStore.getState().openModal({ type: 'school', due })

/** Subject chip looks, by colour (written out in full so Tailwind keeps them). */
const CHIP: Record<string, string> = {
  slate: 'bg-white/[0.07] hover:bg-white/[0.12] text-zinc-100',
  teal: 'bg-teal-500/[0.14] hover:bg-teal-500/25 text-teal-50',
  cyan: 'bg-cyan-500/[0.14] hover:bg-cyan-500/25 text-cyan-50',
  blue: 'bg-blue-500/[0.16] hover:bg-blue-500/25 text-blue-50',
  violet: 'bg-violet-500/[0.16] hover:bg-violet-500/25 text-violet-50',
  pink: 'bg-fuchsia-500/[0.14] hover:bg-fuchsia-500/25 text-fuchsia-50',
  rose: 'bg-rose-500/[0.14] hover:bg-rose-500/25 text-rose-50',
  orange: 'bg-orange-500/[0.14] hover:bg-orange-500/25 text-orange-50',
  yellow: 'bg-yellow-400/[0.12] hover:bg-yellow-400/20 text-yellow-50',
  lime: 'bg-lime-500/[0.14] hover:bg-lime-500/25 text-lime-50',
}

const subjectColor = (school: SchoolData, name: string) => findSubject(school, name)?.color ?? 'slate'
const bar = (color: string) => (KIND_COLORS[color] ?? KIND_COLORS.slate).bar

function useStored<T extends string>(key: string, fallback: T, options: readonly T[]) {
  const [v, setV] = useState<T>(() => {
    try {
      const x = localStorage.getItem(key) as T | null
      return x && options.includes(x) ? x : fallback
    } catch {
      return fallback
    }
  })
  const set = (x: T) => {
    setV(x)
    try {
      localStorage.setItem(key, x)
    } catch {
      // Not remembered: fine.
    }
  }
  return [v, set] as const
}

/** The same day of the month `by` months away (the 31st becomes the 30th, or the 28th, when that month is shorter). */
function shiftMonth(k: string, by: number) {
  const d = fromKey(k)
  const y = d.getFullYear()
  const m = d.getMonth() + by
  const first = new Date(y, m, 1, 12)
  return toKey(new Date(first.getFullYear(), first.getMonth(), Math.min(d.getDate(), daysInMonth(first.getFullYear(), first.getMonth())), 12))
}

/** "In 3 days", "2 days ago", "Today"… */
function relative(k: string, today: string) {
  const n = daysBetween(today, k)
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  return n > 0 ? `In ${n} days` : `${-n} days ago`
}

export function SchoolCalendar({ school, tasks, today, isOpen, onTick }: {
  school: SchoolData
  tasks: SchoolTask[]
  today: string
  isOpen: (t: SchoolTask) => boolean
  onTick: (id: string) => void
}) {
  const [mode, setMode] = useStored<Mode>('dizayr-school-cal-mode', 'month', ['month', 'week'] as const)
  const [done, setDone] = useStored('dizayr-school-cal-done', 'show', ['show', 'hide'] as const)
  const [day, setDay] = useState(today)
  const [dir, setDir] = useState(0)
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const showDone = done === 'show'

  // When the page has been open past midnight, follow the new today if it was showing the old one.
  const lastToday = useRef(today)
  useEffect(() => {
    if (lastToday.current !== today) setDay((d) => (d === lastToday.current ? today : d))
    lastToday.current = today
  }, [today])

  useEffect(() => {
    if (!dragId) setOver(null)
  }, [dragId])

  /** Tasks by due day: late ones first, then still open, then done; within those by subject. */
  const byDay = useMemo(() => {
    const m = new Map<string, SchoolTask[]>()
    for (const t of tasks) {
      if (!showDone && !isOpen(t)) continue
      const list = m.get(t.due)
      if (list) list.push(t)
      else m.set(t.due, [t])
    }
    for (const list of m.values())
      list.sort((a, b) => Number(!isOpen(a)) - Number(!isOpen(b)) || a.subject.localeCompare(b.subject) || a.createdAt - b.createdAt)
    return m
  }, [tasks, showDone, isOpen])

  // The days on screen.
  const d = fromKey(day)
  const first = toKey(new Date(d.getFullYear(), d.getMonth(), 1, 12))
  const days = useMemo(() => {
    if (mode === 'week') {
      const s = startOfWeek(day)
      return Array.from({ length: 7 }, (_, i) => addDays(s, i))
    }
    const s = startOfWeek(first)
    const last = addDays(first, daysInMonth(fromKey(first).getFullYear(), fromKey(first).getMonth()) - 1)
    const weeks = Math.ceil((daysBetween(s, last) + 1) / 7)
    return Array.from({ length: weeks * 7 }, (_, i) => addDays(s, i))
  }, [mode, day, first])
  const range = { start: days[0], end: days[days.length - 1] }
  const month = first.slice(0, 7)

  // Numbers for the period on screen (the whole month, or the week).
  const summary = useMemo(() => {
    let due = 0, late = 0, finished = 0, busiest = '', most = 0
    const inView = (k: string) => (mode === 'month' ? k.startsWith(month) : k >= range.start && k <= range.end)
    const counts = new Map<string, number>()
    for (const t of tasks) {
      if (!inView(t.due)) continue
      due++
      if (!isOpen(t)) finished++
      else {
        if (t.due < today) late++
        counts.set(t.due, (counts.get(t.due) ?? 0) + 1)
      }
    }
    for (const [k, n] of counts) if (n > most && k >= today) (most = n), (busiest = k)
    return { due, late, finished, busiest: most >= 2 ? busiest : '', most }
  }, [tasks, isOpen, mode, month, range.start, range.end, today])

  function go(next: string) {
    setDir(next > day ? 1 : next < day ? -1 : 0)
    setDay(next)
  }
  const step = (by: number) => go(mode === 'month' ? shiftMonth(day, by) : addDays(day, by * 7))
  const viewKey = mode === 'month' ? month : range.start
  const showingToday = mode === 'month' ? today.startsWith(month) : today >= range.start && today <= range.end

  function onKey(e: KeyboardEvent<HTMLDivElement>) {
    const moves: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }
    if (e.key in moves) {
      e.preventDefault()
      go(addDays(day, moves[e.key]))
    } else if (e.key === 'PageUp' || e.key === 'PageDown') {
      e.preventDefault()
      step(e.key === 'PageUp' ? -1 : 1)
    } else if (e.key === 'Home' || e.key === 't' || e.key === 'T') {
      e.preventDefault()
      go(today)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      newTaskOn(day)
    }
  }

  function move(id: string, to: string) {
    const t = useStore.getState().school.tasks.find((x) => x.id === id)
    setDragId(null)
    if (!t || t.due === to) return
    const from = t.due
    useStore.getState().changeSchool((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, due: to } : x)) }))
    toast.undo(`Moved “${t.title}” to ${shortDate(to)}.`, () =>
      useStore.getState().changeSchool((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? { ...x, due: from } : x)) })),
    )
  }

  const dropZone = (k: string) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== k) setOver(k)
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node) && over === k && setOver(null),
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      move(dragId, k)
    },
  })

  const chipProps = (t: SchoolTask) => ({
    task: t,
    school,
    today,
    open: isOpen(t),
    dragging: dragId === t.id,
    onDragStart: () => setDragId(t.id),
    onDragEnd: () => setDragId(null),
  })

  const title =
    mode === 'month'
      ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}`
      : fromKey(range.start).getMonth() === fromKey(range.end).getMonth()
        ? `${MONTHS_SHORT[fromKey(range.start).getMonth()]} ${fromKey(range.start).getDate()} – ${fromKey(range.end).getDate()}, ${fromKey(range.end).getFullYear()}`
        : `${MONTHS_SHORT[fromKey(range.start).getMonth()]} ${fromKey(range.start).getDate()} – ${MONTHS_SHORT[fromKey(range.end).getMonth()]} ${fromKey(range.end).getDate()}, ${fromKey(range.end).getFullYear()}`

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <section className={`${card} overflow-hidden`}>
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.05] px-3 py-3 sm:px-4">
          <div className="flex items-center gap-1">
            <button onClick={() => step(-1)} aria-label={mode === 'month' ? 'Previous month' : 'Previous week'} className="grid h-9 w-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white active:scale-95">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button onClick={() => step(1)} aria-label={mode === 'month' ? 'Next month' : 'Next week'} className="grid h-9 w-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/[0.06] hover:text-white active:scale-95">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
          <h3 className="min-w-0 flex-1 truncate text-lg font-bold tracking-tight text-white" aria-live="polite">
            {title}
          </h3>
          {!showingToday || day !== today ? (
            <button onClick={() => go(today)} className="h-9 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
              Today
            </button>
          ) : null}
          <button
            onClick={() => setDone(showDone ? 'hide' : 'show')}
            aria-pressed={showDone}
            title={showDone ? 'Hide finished tasks' : 'Show finished tasks'}
            className={`grid h-9 w-9 place-items-center rounded-xl border transition ${showDone ? 'border-white/10 text-zinc-300 hover:bg-white/5' : 'border-indigo-400/40 bg-indigo-500/10 text-indigo-200'}`}
          >
            {showDone ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
          <div role="tablist" aria-label="Calendar shows" className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
            {(
              [
                ['month', 'Month', CalendarDays],
                ['week', 'Week', CalendarRange],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                aria-selected={mode === id}
                onClick={() => (setDir(0), setMode(id))}
                className={`inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition ${mode === id ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        </div>

        {/* The period at a glance */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-white/[0.05] bg-black/10 px-4 py-2 text-xs text-zinc-500">
          <span>
            <b className="font-semibold tabular-nums text-zinc-200">{summary.due}</b> due this {mode}
          </span>
          {summary.finished > 0 && (
            <span className="inline-flex items-center gap-1 text-teal-300/90">
              <CheckCheck className="h-3.5 w-3.5" /> <b className="font-semibold tabular-nums">{summary.finished}</b> done
            </span>
          )}
          {summary.late > 0 && (
            <span className="inline-flex items-center gap-1 text-rose-300">
              <AlarmClock className="h-3.5 w-3.5" /> <b className="font-semibold tabular-nums">{summary.late}</b> late
            </span>
          )}
          {summary.busiest && (
            <button onClick={() => go(summary.busiest)} className="inline-flex items-center gap-1 rounded-md text-amber-200/90 transition hover:text-amber-100">
              <Flame className="h-3.5 w-3.5" /> Busiest: {shortDate(summary.busiest).replace(/, \d{4}$/, '')} ({summary.most})
            </button>
          )}
          {summary.due > 0 && summary.finished === summary.due && (
            <span className="text-teal-300">All done. Nice work ✨</span>
          )}
        </div>

        {/* Weekday names */}
        <div className={`grid grid-cols-7 border-b border-white/[0.05] ${mode === 'week' ? 'max-sm:hidden' : ''}`}>
          {weekOrder().map((i) => (
            <div key={i} className={`py-2 text-center text-[11px] font-semibold uppercase tracking-wider ${i === 0 || i === 6 ? 'text-zinc-600' : 'text-zinc-500'}`}>
              <span className="sm:hidden">{WEEKDAYS[i][0]}</span>
              <span className="hidden sm:inline">{WEEKDAYS[i]}</span>
            </div>
          ))}
        </div>

        {/* Days */}
        <div
          key={`${mode}-${viewKey}`}
          tabIndex={0}
          role="grid"
          aria-label={`${title}. Arrow keys move between days, Page Up and Page Down change ${mode}, Enter adds a task.`}
          onKeyDown={onKey}
          style={dir ? { animation: `${dir > 0 ? 'cal-next' : 'cal-prev'} 0.22s cubic-bezier(0.2, 0.9, 0.3, 1)` } : undefined}
          className={`grid outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-400/40 ${mode === 'month' ? 'grid-cols-7' : 'grid-cols-1 sm:grid-cols-7'}`}
        >
          {days.map((k, i) =>
            mode === 'month' ? (
              <MonthCell
                key={k}
                k={k}
                today={today}
                selected={k === day}
                outside={!k.startsWith(month)}
                lastCol={i % 7 === 6}
                lastRow={i >= days.length - 7}
                list={byDay.get(k) ?? []}
                isOpen={isOpen}
                school={school}
                over={over === k}
                onPick={() => go(k)}
                zone={dropZone(k)}
                chip={chipProps}
              />
            ) : (
              <WeekDay
                key={k}
                k={k}
                today={today}
                selected={k === day}
                last={i === 6}
                list={byDay.get(k) ?? []}
                over={over === k}
                onPick={() => go(k)}
                zone={dropZone(k)}
                chip={chipProps}
              />
            ),
          )}
        </div>

        <p className="hidden border-t border-white/[0.05] px-4 py-2 text-[11px] text-zinc-600 sm:block">
          Drag a task to another day to change its due date · double-click a day to add a task · arrow keys move around
        </p>
      </section>

      <DayPanel day={day} today={today} list={byDay.get(day) ?? []} all={tasks} school={school} isOpen={isOpen} onTick={onTick} onPick={go} hiddenDone={!showDone} />
    </div>
  )
}

type ChipFor = (t: SchoolTask) => Parameters<typeof Chip>[0]
type Zone = { onDragOver: (e: DragEvent<HTMLElement>) => void; onDragLeave: (e: DragEvent<HTMLElement>) => void; onDrop: (e: DragEvent<HTMLElement>) => void }

function DayNumber({ k, today, selected, outside, big }: { k: string; today: string; selected: boolean; outside?: boolean; big?: boolean }) {
  const n = fromKey(k).getDate()
  const isToday = k === today
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full font-semibold tabular-nums transition ${big ? 'h-8 min-w-8 px-1 text-sm' : 'h-6 min-w-6 px-1 text-xs sm:h-7 sm:min-w-7 sm:text-[13px]'} ${
        isToday
          ? 'bg-gradient-to-br from-indigo-400 to-violet-500 text-white shadow-md shadow-indigo-500/30'
          : selected
            ? 'bg-white/[0.12] text-white'
            : outside
              ? 'text-zinc-600'
              : k < today
                ? 'text-zinc-500'
                : 'text-zinc-200'
      }`}
    >
      {n === 1 && !big ? `${MONTHS_SHORT[fromKey(k).getMonth()]} ${n}` : n}
    </span>
  )
}

function MonthCell({ k, today, selected, outside, lastCol, lastRow, list, isOpen, school, over, onPick, zone, chip }: {
  k: string
  today: string
  selected: boolean
  outside: boolean
  lastCol: boolean
  lastRow: boolean
  list: SchoolTask[]
  isOpen: (t: SchoolTask) => boolean
  school: SchoolData
  over: boolean
  onPick: () => void
  zone: Zone
  chip: ChipFor
}) {
  const open = list.filter(isOpen)
  const late = k < today && open.length > 0
  const weekend = [0, 6].includes(fromKey(k).getDay())
  const max = list.length > 3 ? 2 : 3
  // Busier days glow a little warmer.
  const heat = Math.min(open.length, 4)

  return (
    <div
      role="gridcell"
      aria-selected={selected}
      aria-label={`${longDate(k)}: ${list.length ? `${list.length} task${list.length === 1 ? '' : 's'}` : 'nothing due'}`}
      onClick={onPick}
      onDoubleClick={() => newTaskOn(k)}
      {...zone}
      className={`group/day relative flex min-h-[3.75rem] cursor-pointer flex-col gap-1 p-1 transition-colors sm:min-h-[6.75rem] sm:p-1.5 lg:min-h-[7.5rem] ${lastCol ? '' : 'border-r'} ${lastRow ? '' : 'border-b'} border-white/[0.05] ${
        over ? 'bg-indigo-500/15 ring-2 ring-inset ring-indigo-400/50' : selected ? 'bg-white/[0.045]' : weekend ? 'bg-black/[0.12] hover:bg-white/[0.025]' : 'hover:bg-white/[0.025]'
      } ${outside ? 'opacity-50' : ''}`}
    >
      {heat > 0 && !over && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 ${late ? 'bg-rose-500' : 'bg-amber-400'}`}
          style={{ opacity: late ? 0.07 : 0.018 * heat }}
        />
      )}
      {selected && <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-indigo-400/40" />}

      <div className="relative flex items-center justify-between gap-1">
        <DayNumber k={k} today={today} selected={selected} outside={outside} />
        <button
          onClick={(e) => (e.stopPropagation(), newTaskOn(k))}
          aria-label={`Add a task due ${longDate(k)}`}
          title="Add a task due this day"
          className="hidden h-6 w-6 place-items-center rounded-md text-zinc-500 opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover/day:opacity-100 sm:grid"
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Phones: a dot per task */}
      {list.length > 0 && (
        <div className="relative flex flex-wrap items-center justify-center gap-[3px] px-0.5 sm:hidden">
          {list.slice(0, 4).map((t) => (
            <span key={t.id} className={`h-1.5 w-1.5 rounded-full ${bar(subjectColor(school, t.subject))} ${isOpen(t) ? '' : 'opacity-35'}`} />
          ))}
          {list.length > 4 && <span className="text-[9px] font-semibold leading-none text-zinc-400">+{list.length - 4}</span>}
        </div>
      )}

      {/* Bigger screens: the tasks themselves */}
      <div className="relative hidden min-w-0 flex-col gap-1 sm:flex">
        {list.slice(0, max).map((t) => (
          <Chip key={t.id} {...chip(t)} />
        ))}
        {list.length > max && (
          <button
            onClick={(e) => (e.stopPropagation(), onPick())}
            className="rounded-md px-1.5 py-0.5 text-left text-[11px] font-medium text-zinc-400 transition hover:bg-white/[0.07] hover:text-white"
          >
            +{list.length - max} more
          </button>
        )}
      </div>
    </div>
  )
}

function WeekDay({ k, today, selected, last, list, over, onPick, zone, chip }: {
  k: string
  today: string
  selected: boolean
  last: boolean
  list: SchoolTask[]
  over: boolean
  onPick: () => void
  zone: Zone
  chip: ChipFor
}) {
  const wd = fromKey(k).getDay()
  return (
    <div
      role="gridcell"
      aria-selected={selected}
      aria-label={`${longDate(k)}: ${list.length ? `${list.length} task${list.length === 1 ? '' : 's'}` : 'nothing due'}`}
      onClick={onPick}
      onDoubleClick={() => newTaskOn(k)}
      {...zone}
      className={`group/day relative flex cursor-pointer flex-col gap-2 border-white/[0.05] p-2 transition-colors max-sm:border-b sm:min-h-[22rem] ${last ? 'max-sm:border-b-0' : 'sm:border-r'} ${
        over ? 'bg-indigo-500/15 ring-2 ring-inset ring-indigo-400/50' : selected ? 'bg-white/[0.045]' : wd === 0 || wd === 6 ? 'bg-black/[0.12] hover:bg-white/[0.025]' : 'hover:bg-white/[0.025]'
      }`}
    >
      {selected && <span aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-indigo-400/40" />}
      <div className="relative flex items-center gap-2 sm:flex-col sm:items-center sm:gap-1">
        <span className={`text-[11px] font-semibold uppercase tracking-wider ${k === today ? 'text-indigo-300' : 'text-zinc-500'}`}>{WEEKDAYS[wd]}</span>
        <DayNumber k={k} today={today} selected={selected} big />
        <span className="flex-1 sm:hidden" />
        <button
          onClick={(e) => (e.stopPropagation(), newTaskOn(k))}
          aria-label={`Add a task due ${longDate(k)}`}
          className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white sm:hidden"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="relative flex min-w-0 flex-col gap-1.5">
        {list.map((t) => (
          <Chip key={t.id} {...chip(t)} tall />
        ))}
        {list.length === 0 && <span className="hidden py-6 text-center text-[11px] text-zinc-700 sm:block">—</span>}
      </div>
      <button
        onClick={(e) => (e.stopPropagation(), newTaskOn(k))}
        aria-label={`Add a task due ${longDate(k)}`}
        className="relative mt-auto hidden h-8 items-center justify-center gap-1 rounded-lg text-xs text-zinc-500 opacity-0 transition hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:opacity-100 group-hover/day:opacity-100 sm:flex"
      >
        <Plus className="h-3.5 w-3.5" /> Add
      </button>
    </div>
  )
}

/** A task on the calendar: its subject's colour, its name; drag it to another day. */
function Chip({ task: t, school, today, open, dragging, onDragStart, onDragEnd, tall }: {
  task: SchoolTask
  school: SchoolData
  today: string
  open: boolean
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
  tall?: boolean
}) {
  const color = subjectColor(school, t.subject)
  const late = open && t.due < today
  return (
    <button
      type="button"
      draggable
      onClick={(e) => (e.stopPropagation(), openTask(t.id))}
      onDoubleClick={(e) => e.stopPropagation()}
      onDragStart={(e) => {
        e.stopPropagation()
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', t.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      title={`${t.subject}: ${t.title}${open ? '' : ' (done)'}`}
      className={`relative flex w-full min-w-0 select-none items-start gap-1.5 overflow-hidden rounded-md text-left transition active:cursor-grabbing ${CHIP[color] ?? CHIP.slate} ${
        tall ? 'px-2 py-1.5' : 'px-1.5 py-[3px]'
      } ${late ? 'ring-1 ring-inset ring-rose-400/50' : ''} ${open ? '' : 'opacity-45'} ${dragging ? 'scale-95 opacity-30' : ''}`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${bar(color)}`} />
      {open ? null : <Check className={`shrink-0 text-teal-300 ${tall ? 'mt-0.5 h-3.5 w-3.5' : 'mt-px h-3 w-3'}`} strokeWidth={3} />}
      <span className="min-w-0 flex-1 pl-0.5">
        {tall && <span className="block truncate text-[10px] font-semibold uppercase tracking-wide opacity-70">{t.subject}</span>}
        <span className={`block font-medium leading-snug ${tall ? 'line-clamp-3 break-words text-xs' : 'truncate text-[11px]'} ${open ? '' : 'line-through decoration-white/40'}`}>
          {t.title}
        </span>
      </span>
      {late && <AlarmClock className={`shrink-0 text-rose-300 ${tall ? 'mt-0.5 h-3.5 w-3.5' : 'mt-px h-3 w-3'}`} />}
    </button>
  )
}

/** The picked day: its tasks in full, a way to add one, and what's next after it. */
function DayPanel({ day, today, list, all, school, isOpen, onTick, onPick, hiddenDone }: {
  day: string
  today: string
  list: SchoolTask[]
  all: SchoolTask[]
  school: SchoolData
  isOpen: (t: SchoolTask) => boolean
  onTick: (id: string) => void
  onPick: (k: string) => void
  hiddenDone: boolean
}) {
  const d = fromKey(day)
  const open = list.filter(isOpen).length
  const hidden = hiddenDone ? all.filter((t) => t.due === day && !isOpen(t)).length : 0
  const next = useMemo(
    () => all.filter((t) => isOpen(t) && t.due > day && t.due >= today).sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt).slice(0, 4),
    [all, isOpen, day, today],
  )
  const rel = relative(day, today)

  return (
    <aside className={`${card} overflow-hidden lg:sticky lg:top-4`} aria-label={`Tasks due ${longDate(day)}`}>
      <div key={day} className="animate-fade relative overflow-hidden border-b border-white/[0.05] p-4">
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-32 w-40 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className={`flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl border ${day === today ? 'border-indigo-400/40 bg-gradient-to-br from-indigo-500/30 to-violet-500/20' : 'border-white/10 bg-black/25'}`}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-200/80">{MONTHS_SHORT[d.getMonth()]}</span>
            <span className="text-xl font-bold leading-none tabular-nums text-white">{d.getDate()}</span>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-white">{longDate(day).split(',')[0]}</p>
            <p className="text-xs text-zinc-500">
              <span className={day < today ? 'text-zinc-500' : day === today ? 'text-indigo-300' : 'text-zinc-400'}>{rel}</span>
              {list.length > 0 && (
                <>
                  {' · '}
                  {open ? `${open} to do` : 'all done'}
                  {list.length - open > 0 && open ? `, ${list.length - open} done` : ''}
                </>
              )}
            </p>
          </div>
          <button
            onClick={() => newTaskOn(day)}
            aria-label={`Add a task due ${longDate(day)}`}
            title="Add a task due this day"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-400 text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 active:scale-95"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {list.length > 0 ? (
        <ul key={`l-${day}`} className="animate-fade divide-y divide-white/[0.04]">
          {list.map((t) => {
            const isDone = !isOpen(t)
            const late = !isDone && t.due < today
            const col = school.columns.find((c) => c.id === t.column)
            const color = subjectColor(school, t.subject)
            return (
              <li key={t.id} className="flex items-start gap-3 px-4 py-3 transition hover:bg-white/[0.02]">
                <button
                  type="button"
                  onClick={() => onTick(t.id)}
                  aria-label={isDone ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
                  className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition active:scale-90 ${
                    isDone ? 'border-teal-400 bg-teal-400 text-[#06120f]' : 'border-white/20 text-transparent hover:border-teal-300 hover:text-teal-300'
                  }`}
                >
                  <Check className="h-3 w-3" strokeWidth={3.2} />
                </button>
                <button type="button" onClick={() => openTask(t.id)} className="min-w-0 flex-1 text-left">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${bar(color)}`} />
                    <span className="truncate">{t.subject}</span>
                  </span>
                  <span className={`mt-0.5 block break-words text-sm font-medium leading-snug ${isDone ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'}`}>{t.title}</span>
                  <span className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                    {late && <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 font-medium text-rose-200 ring-1 ring-rose-400/25">Late</span>}
                    {col && !isDone && <span className="rounded-full bg-white/[0.06] px-1.5 py-0.5 text-zinc-400">{col.name}</span>}
                    {isDone && t.doneAt && <span className="text-teal-300/80">Done {t.doneAt === today ? 'today' : shortDate(t.doneAt).replace(/^\w+, /, '')}</span>}
                    {t.notes && <StickyNote className="h-3 w-3 text-zinc-500" aria-label="Has notes" />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div key={`e-${day}`} className="animate-fade px-4 py-8 text-center">
          <p className="text-2xl" aria-hidden>
            {day < today ? '🌙' : '🌤️'}
          </p>
          <p className="mt-2 text-sm font-medium text-zinc-300">Nothing due {day === today ? 'today' : 'this day'}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{hidden ? `${hidden} finished task${hidden === 1 ? ' is' : 's are'} hidden.` : day >= today ? 'A free day. Enjoy it, or get ahead.' : ''}</p>
          {day >= today && (
            <button onClick={() => newTaskOn(day)} className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
              <Plus className="h-3.5 w-3.5" /> Add a task for this day
            </button>
          )}
        </div>
      )}

      {next.length > 0 && (
        <div className="border-t border-white/[0.05] bg-black/10 px-4 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Coming up</p>
          <ul className="space-y-1">
            {next.map((t) => (
              <li key={t.id}>
                <button onClick={() => onPick(t.due)} className="group flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-white/[0.04]">
                  <span className={`h-6 w-1 shrink-0 rounded-full ${bar(subjectColor(school, t.subject))}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium text-zinc-200">{t.title}</span>
                    <span className="block truncate text-[11px] text-zinc-500">{t.subject}</span>
                  </span>
                  <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 group-hover:text-zinc-300">{relative(t.due, today)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </aside>
  )
}
