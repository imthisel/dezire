import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  AlertCircle, CalendarCheck, CalendarRange, Check, ChevronDown, ChevronLeft, ChevronRight, Circle, CircleCheck, Eye, EyeOff, Inbox, Plus, Repeat, Settings2,
} from 'lucide-react'
import { useStore, useTaskKindOf } from '../store'
import { MAX_DATE, MIN_DATE, WEEKDAYS, addDays, dayLabel, fromKey, longDate, periodLabel, todayKey } from '../lib/expenses'
import {
  DAY_MINUTES, byTime, fmtRange, fmtTime, happensOn, isEvent, nextOpenDay, nowMinutes, occurrencesIn, repeatLabel, taskColor, taskIcon, type Occurrence,
} from '../lib/tasks'
import { MONTHS } from '../lib/time'
import type { Task } from '../lib/types'
import { useMedia } from '../lib/useMedia'
import { card } from './Dashboard'
import { Calendar } from './Calendar'
import { TimeGrid } from './TimeGrid'
import { TaskKinds } from './TaskKinds'
import { TaskMenu, openTaskMenu } from './TaskMenu'
import { toast } from '../toast'

type CalView = 'day' | '3day' | 'week' | 'month'
const VIEWS: { id: CalView; label: string; short: string; key: string }[] = [
  { id: 'day', label: 'Day', short: 'Day', key: 'D' },
  { id: '3day', label: '3 days', short: '3D', key: '3' },
  { id: 'week', label: 'Week', short: 'Week', key: 'W' },
  { id: 'month', label: 'Month', short: 'Month', key: 'M' },
]
const VIEW_KEY = 'viszionary-calendar-view'
const HIDDEN_KEY = 'viszionary-hidden-task-kinds'

const pad = (n: number) => String(n).padStart(2, '0')
const clampDay = (k: string) => (k < MIN_DATE ? MIN_DATE : k > MAX_DATE ? MAX_DATE : k)

function read<T>(key: string, fallback: T, ok: (v: unknown) => boolean): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) ?? 'null')
    return ok(v) ? (v as T) : fallback
  } catch {
    return fallback
  }
}
function save(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // Not remembered; fine.
  }
}

/** The days a view shows around `anchor`. */
function daysOf(view: CalView, anchor: string): string[] {
  if (view === 'day') return [anchor]
  if (view === '3day') return [anchor, addDays(anchor, 1), addDays(anchor, 2)]
  if (view === 'week') {
    const start = addDays(anchor, -fromKey(anchor).getDay())
    return Array.from({ length: 7 }, (_, i) => addDays(start, i))
  }
  // Six weeks, starting on the Sunday on or before the 1st.
  const first = `${anchor.slice(0, 7)}-01`
  const start = addDays(first, -fromKey(first).getDay())
  return Array.from({ length: 42 }, (_, i) => addDays(start, i))
}

function shift(view: CalView, anchor: string, by: number) {
  if (view === 'day') return clampDay(addDays(anchor, by))
  if (view === '3day') return clampDay(addDays(anchor, 3 * by))
  if (view === 'week') return clampDay(addDays(anchor, 7 * by))
  const d = fromKey(anchor)
  const m = new Date(d.getFullYear(), d.getMonth() + by, 1, 12)
  return clampDay(`${m.getFullYear()}-${pad(m.getMonth() + 1)}-01`)
}

function titleOf(view: CalView, anchor: string, days: string[]) {
  if (view === 'day') return longDate(anchor)
  if (view === 'month') return `${MONTHS[fromKey(anchor).getMonth()]} ${anchor.slice(0, 4)}`
  return periodLabel({ kind: 'week', start: days[0], end: days[days.length - 1] })
}

const isTyping = (el: EventTarget | null) => !!(el as HTMLElement | null)?.closest?.('input, textarea, select, [contenteditable="true"]')

/** Calendar & to-dos: a Google-Calendar-like planner with colour-coded kinds of tasks. */
export function Schedule() {
  const tasks = useStore((s) => s.tasks)
  const kinds = useStore((s) => s.taskKinds)
  const modalOpen = useStore((s) => s.modal !== null)
  const wide = useMedia('(min-width: 640px)')
  const today = todayKey()
  const [view, setViewState] = useState<CalView>(() => read(VIEW_KEY, wide ? 'week' : '3day', (v) => VIEWS.some((x) => x.id === v)))
  const [anchor, setAnchor] = useState(today)
  const [hidden, setHiddenState] = useState<string[]>(() => read(HIDDEN_KEY, [], Array.isArray))
  const [editKinds, setEditKinds] = useState(false)

  function setView(v: CalView) {
    save(VIEW_KEY, v)
    setViewState(v)
  }
  function setHidden(next: string[]) {
    save(HIDDEN_KEY, next)
    setHiddenState(next)
  }
  function pickDay(d: string) {
    setAnchor(d)
    setView('day')
  }

  const days = useMemo(() => daysOf(view, anchor), [view, anchor])
  const shown = useMemo(() => (hidden.length ? tasks.filter((t) => !hidden.includes(t.kind)) : tasks), [tasks, hidden])
  // The hours grid also needs the week before: a task that runs past midnight shows on the days after it starts.
  const occurrences = useMemo(
    () => occurrencesIn(shown, view === 'month' ? days[0] : addDays(days[0], -7), days[days.length - 1]),
    [shown, days, view],
  )
  const isNow = days.includes(today) && (view !== 'month' || anchor.slice(0, 7) === today.slice(0, 7))

  // Keyboard: T today, D / 3 / W / M views, E new event, N new task, ← → move.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (modalOpen || e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return
      const k = e.key.toLowerCase()
      const v = VIEWS.find((x) => x.key.toLowerCase() === k)
      if (v) setView(v.id)
      else if (k === 't') setAnchor(today)
      else if (k === 'e' || k === 'c') newEntry('event')
      else if (k === 'n') newEntry('todo')
      else if (e.key === 'ArrowLeft' || k === 'j') setAnchor((a) => shift(view, a, -1))
      else if (e.key === 'ArrowRight' || k === 'k') setAnchor((a) => shift(view, a, 1))
      else return
      e.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalOpen, view, anchor, today])

  // Days with something on them, as dots on the small calendar.
  const marks = useMemo(() => {
    const n = new Map<string, number>()
    const from = addDays(today, -120)
    for (const o of occurrencesIn(shown, from, addDays(today, 365))) if (!o.done) n.set(o.day, (n.get(o.day) ?? 0) + 1)
    return new Map([...n].map(([k, v]) => [k, `${v} planned`]))
  }, [shown, today])

  /** A new event (on the day being looked at) or a new task (asks about a deadline). */
  function newEntry(entry: 'event' | 'todo') {
    const day = view !== 'month' && anchor !== today ? anchor : undefined
    useStore.getState().openModal({ type: 'task', entry, ...(entry === 'event' || day ? { date: day ?? today } : {}) })
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Title */}
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-400 shadow-lg shadow-indigo-500/20">
            <CalendarCheck className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Calendar</h2>
            <p className="truncate text-sm text-zinc-400">Plan your time, and keep track of what's due.</p>
          </div>
          <button
            onClick={() => setEditKinds(true)}
            title="Kinds of tasks & colours"
            aria-label="Kinds of tasks and colours"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <Settings2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => newEntry('todo')}
            title="New task: something to get done (N)"
            aria-label="New task"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 hover:text-white sm:px-4"
          >
            <CircleCheck className="h-4 w-4" /> <span className="hidden sm:inline">Task</span>
          </button>
          <button
            onClick={() => newEntry('event')}
            title="New event: time on your calendar (E)"
            aria-label="New event"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:px-4"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> <span className="hidden sm:inline">Event</span>
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Calendar */}
        <section className={`${card} min-w-0 overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-white/[0.07] p-3 sm:p-4">
            <button
              onClick={() => setAnchor(today)}
              disabled={isNow}
              title="Today (T)"
              className="h-9 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40"
            >
              Today
            </button>
            <div className="flex items-center">
              <NavBtn label="Previous (←)" onClick={() => setAnchor((a) => shift(view, a, -1))} disabled={days[0] <= MIN_DATE}>
                <ChevronLeft className="h-4 w-4" />
              </NavBtn>
              <NavBtn label="Next (→)" onClick={() => setAnchor((a) => shift(view, a, 1))} disabled={days[days.length - 1] >= MAX_DATE}>
                <ChevronRight className="h-4 w-4" />
              </NavBtn>
            </div>
            <h3 key={`${view}-${days[0]}`} className="animate-tick min-w-0 flex-1 truncate text-[15px] font-semibold text-white sm:text-lg">
              {titleOf(view, anchor, days)}
            </h3>
            <div role="tablist" aria-label="Show" className="relative grid w-full grid-cols-4 rounded-xl border border-white/10 bg-white/[0.03] p-1 sm:w-auto">
              <span
                aria-hidden
                className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/4)] rounded-lg bg-indigo-500/25 ring-1 ring-indigo-400/40 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
                style={{ transform: `translateX(${VIEWS.findIndex((v) => v.id === view) * 100}%)` }}
              />
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  role="tab"
                  aria-selected={view === v.id}
                  title={`${v.label} (${v.key})`}
                  onClick={() => setView(v.id)}
                  className={`relative h-8 px-3 text-sm font-medium transition ${view === v.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <span className="sm:hidden">{v.short}</span>
                  <span className="hidden sm:inline">{v.label}</span>
                </button>
              ))}
            </div>
          </div>

          {view === 'month' ? (
            <MonthGrid days={days} month={anchor.slice(0, 7)} occurrences={occurrences} onPickDay={pickDay} />
          ) : (
            <TimeGrid days={days} occurrences={occurrences} onPickDay={pickDay} onShowDay={setAnchor} />
          )}
        </section>

        {/* Side: jump to a day, kinds, to-do list */}
        <aside className="min-w-0 space-y-4 sm:space-y-6">
          <div className="hidden xl:block">
            <Calendar value={anchor} onChange={setAnchor} marks={marks} />
          </div>
          <TodayPlan tasks={shown} />
          <TodoList tasks={shown} />
          <KindFilter hidden={hidden} setHidden={setHidden} onEdit={() => setEditKinds(true)} />
        </aside>
      </div>

      {editKinds && <TaskKinds onClose={() => setEditKinds(false)} />}
      <TaskMenu />
    </div>
  )
}

function NavBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/[0.07] hover:text-white disabled:pointer-events-none disabled:opacity-25"
    >
      {children}
    </button>
  )
}

// ---- Month ----

function MonthGrid({ days, month, occurrences, onPickDay }: { days: string[]; month: string; occurrences: Occurrence[]; onPickDay: (d: string) => void }) {
  const kindOf = useTaskKindOf()
  const today = todayKey()
  const [over, setOver] = useState<string | null>(null)
  const byDay = useMemo(() => {
    const m = new Map<string, Occurrence[]>()
    for (const o of occurrences) m.set(o.day, [...(m.get(o.day) ?? []), o])
    for (const v of m.values()) v.sort(byTime)
    return m
  }, [occurrences])
  const LIMIT = 3

  function drop(day: string, id: string) {
    const t = useStore.getState().tasks.find((x) => x.id === id)
    if (!t || t.repeat || t.date === day) return
    useStore.getState().updateTask(id, { date: day })
    toast.undo(`Moved “${t.title}” to ${dayLabel(day)}.`, () => useStore.getState().updateTask(id, { date: t.date }))
  }

  return (
    <div className="select-none">
      <div className="grid grid-cols-7 border-b border-white/[0.07]">
        {WEEKDAYS.map((w, i) => (
          <span key={w} className={`py-2 text-center text-[10.5px] font-semibold uppercase tracking-wider ${i === 0 ? 'text-rose-300/60' : 'text-zinc-500'}`}>
            {w}
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((d) => {
          const list = byDay.get(d) ?? []
          const inMonth = d.startsWith(month)
          const isToday = d === today
          return (
            <div
              key={d}
              onClick={(e) => e.target === e.currentTarget && useStore.getState().openModal({ type: 'task', entry: 'event', date: d })}
              onDragOver={(e) => {
                if (!e.dataTransfer.types.includes('text/task')) return
                e.preventDefault()
                setOver(d)
              }}
              onDragLeave={() => setOver((o) => (o === d ? null : o))}
              onDrop={(e) => {
                setOver(null)
                const id = e.dataTransfer.getData('text/task')
                if (id) drop(d, id)
              }}
              className={`min-h-[84px] min-w-0 cursor-cell border-b border-r border-white/[0.05] p-1 transition-colors [&:nth-child(7n)]:border-r-0 sm:min-h-[112px] sm:p-1.5 ${
                over === d ? 'bg-indigo-500/15' : isToday ? 'bg-indigo-500/[0.05]' : inMonth ? '' : 'bg-black/20'
              }`}
            >
              <button
                onClick={() => onPickDay(d)}
                title="Show this day"
                className={`mb-0.5 grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-semibold tabular-nums transition ${
                  isToday ? 'bg-indigo-500 text-white' : inMonth ? 'text-zinc-300 hover:bg-white/[0.08]' : 'text-zinc-600 hover:bg-white/[0.05]'
                }`}
              >
                {fromKey(d).getDate()}
              </button>
              <div className="pointer-events-none space-y-0.5">
                {list.slice(0, LIMIT).map((o) => {
                  const c = taskColor(kindOf(o.task.kind))
                  const event = isEvent(o.task)
                  const timed = o.task.start != null
                  return (
                    <button
                      key={o.task.id}
                      draggable={!o.task.repeat}
                      onDragStart={(e) => {
                        e.dataTransfer.setData('text/task', o.task.id)
                        e.dataTransfer.effectAllowed = 'move'
                      }}
                      onClick={() => useStore.getState().openModal({ type: 'task', editId: o.task.id })}
                      onContextMenu={(e) => openTaskMenu(e, o.task.id, o.day)}
                      title={`${event ? '' : 'Task: '}${o.task.title}${timed ? ` · ${event ? '' : 'due '}${fmtTime(o.task.start!)}` : ''}`}
                      className={`pointer-events-auto flex w-full min-w-0 items-center gap-1 rounded px-1 py-px text-left text-[10.5px] leading-tight transition sm:text-[11.5px] ${
                        event && !timed ? `${c.block} ${c.title} font-semibold` : 'hover:bg-white/[0.06]'
                      } ${o.done ? 'line-through opacity-50' : ''}`}
                    >
                      {/* Events: a dot. Tasks: an empty circle (ticked when done). */}
                      {!event ? (
                        o.done ? <CircleCheck className={`h-3 w-3 shrink-0 ${c.text}`} /> : <Circle className={`h-3 w-3 shrink-0 ${c.text}`} strokeWidth={2.5} />
                      ) : (
                        timed && <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
                      )}
                      {timed && <span className="hidden shrink-0 tabular-nums text-zinc-500 sm:inline">{fmtTime(o.task.start!, true).replace(' ', '').toLowerCase()}</span>}
                      <span className={`truncate ${event && !timed ? '' : 'text-zinc-200'}`}>{o.task.title}</span>
                    </button>
                  )
                })}
                {list.length > LIMIT && (
                  <button onClick={() => onPickDay(d)} className="pointer-events-auto w-full truncate px-1 text-left text-[10.5px] font-medium text-zinc-400 hover:text-white">
                    +{list.length - LIMIT} more
                  </button>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---- Kinds ----

function KindFilter({ hidden, setHidden, onEdit }: { hidden: string[]; setHidden: (h: string[]) => void; onEdit: () => void }) {
  const kinds = useStore((s) => s.taskKinds)
  const tasks = useStore((s) => s.tasks)
  const today = todayKey()
  const open = useMemo(() => {
    const n = new Map<string, number>()
    for (const t of tasks) {
      if (isEvent(t)) continue
      if (t.repeat ? happensOn(t, today) && !t.doneOn.includes(today) : !t.done) n.set(t.kind, (n.get(t.kind) ?? 0) + 1)
    }
    return n
  }, [tasks, today])

  return (
    <div className={`${card} p-3`}>
      <div className="mb-1.5 flex items-center justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Kinds</span>
        <button onClick={onEdit} className="rounded-md px-1.5 py-0.5 text-xs font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200">
          Edit
        </button>
      </div>
      <ul className="grid grid-cols-2 gap-0.5 xl:grid-cols-1">
        {kinds.map((k) => {
          const c = taskColor(k)
          const Icon = taskIcon(k)
          const off = hidden.includes(k.id)
          return (
            <li key={k.id}>
              <button
                onClick={() => setHidden(off ? hidden.filter((x) => x !== k.id) : [...hidden, k.id])}
                aria-pressed={!off}
                title={off ? 'Show on the calendar' : 'Hide from the calendar'}
                className={`group flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition hover:bg-white/5 ${off ? 'text-zinc-600' : 'text-zinc-200'}`}
              >
                <span className={`grid h-4 w-4 shrink-0 place-items-center rounded ${off ? 'border border-white/15' : c.dot}`}>
                  {!off && <Check className="h-3 w-3 text-black/70" strokeWidth={3.5} />}
                </span>
                <Icon className={`h-3.5 w-3.5 shrink-0 ${off ? '' : c.text}`} />
                <span className={`min-w-0 flex-1 truncate ${off ? 'line-through' : ''}`}>{k.label}</span>
                {(open.get(k.id) ?? 0) > 0 && <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{open.get(k.id)}</span>}
                {off ? <EyeOff className="h-3 w-3 shrink-0" /> : <Eye className="hidden h-3 w-3 shrink-0 text-zinc-600 group-hover:block" />}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---- Today's plan ----

/** Today's events in order, with the one happening now picked out. */
function TodayPlan({ tasks }: { tasks: Task[] }) {
  const kindOf = useTaskKindOf()
  const today = todayKey()
  const [now, setNow] = useState(nowMinutes)
  useEffect(() => {
    const t = setInterval(() => setNow(nowMinutes()), 30_000)
    return () => clearInterval(t)
  }, [])
  // Also what started yesterday and runs past midnight into today.
  const list = useMemo(() => {
    const out: { o: Occurrence; from: number; to: number }[] = []
    for (const o of occurrencesIn(tasks.filter(isEvent), addDays(today, -7), today)) {
      if (o.task.start == null) {
        if (o.day === today) out.push({ o, from: -1, to: DAY_MINUTES })
        continue
      }
      const offset = Math.round((fromKey(today).getTime() - fromKey(o.day).getTime()) / 86400000) * DAY_MINUTES
      const from = o.task.start - offset
      const to = from + o.task.duration
      if (to > 0 && from < DAY_MINUTES) out.push({ o, from, to })
    }
    return out.sort((a, b) => a.from - b.from || a.to - b.to)
  }, [tasks, today])
  const next = list.find((x) => x.from > now)

  return (
    <div className={`${card} p-3`}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Today's plan</span>
        {next && <span className="text-xs tabular-nums text-zinc-500">Next at {fmtTime(next.from, true)}</span>}
      </div>
      {list.length === 0 ? (
        <button
          onClick={() => useStore.getState().openModal({ type: 'task', entry: 'event', date: today })}
          className="flex w-full items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-3 text-left text-xs text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
        >
          <CalendarRange className="h-4 w-4 shrink-0" />
          Nothing planned today. Drag on the calendar, or tap here, to set time aside.
        </button>
      ) : (
        <ul className="space-y-0.5">
          {list.map(({ o, from, to }) => {
            const c = taskColor(kindOf(o.task.kind))
            const allDay = from < 0
            const live = !allDay && from <= now && now < to
            const past = !allDay && to <= now
            return (
              <li key={`${o.task.id}-${o.day}`}>
                <button
                  onClick={() => useStore.getState().openModal({ type: 'task', editId: o.task.id })}
                  onContextMenu={(e) => openTaskMenu(e, o.task.id, o.day)}
                  className={`flex w-full min-w-0 items-center gap-2.5 rounded-xl px-1.5 py-1.5 text-left transition hover:bg-white/[0.04] ${live ? 'bg-white/[0.04]' : ''} ${past ? 'opacity-45' : ''}`}
                >
                  <span className={`h-8 w-1 shrink-0 rounded-full ${c.dot}`} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm leading-snug text-zinc-100">{o.task.title}</span>
                    <span className="block truncate text-[11.5px] tabular-nums text-zinc-500">
                      {allDay ? 'All day' : o.day !== today ? `until ${fmtTime(to % DAY_MINUTES, true)}` : fmtRange(from, o.task.duration)}
                    </span>
                  </span>
                  {live && <span className="shrink-0 rounded-full bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">Now</span>}
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

// ---- To-do list ----

type Row = { task: Task; day: string | null; done: boolean }

function TodoList({ tasks }: { tasks: Task[] }) {
  const today = todayKey()
  const [quick, setQuick] = useState('')
  const [showDone, setShowDone] = useState(false)
  const [showRoutines, setShowRoutines] = useState(false)

  const groups = useMemo(() => {
    const overdue: Row[] = []
    const todayRows: Row[] = []
    const week: Row[] = []
    const later: Row[] = []
    const someday: Row[] = []
    const routines: Row[] = []
    const done: Row[] = []
    const weekEnd = addDays(today, 7)
    // Events are time on the calendar, not things to tick off.
    for (const t of tasks) {
      if (isEvent(t)) continue
      if (t.repeat) {
        routines.push({ task: t, day: nextOpenDay(t, today), done: false })
        if (happensOn(t, today)) todayRows.push({ task: t, day: today, done: t.doneOn.includes(today) })
        continue
      }
      // Ticked off today: stays under Today (crossed out) so the day's progress shows.
      if (t.done && t.date === today) todayRows.push({ task: t, day: t.date, done: true })
      else if (t.done) done.push({ task: t, day: t.date || null, done: true })
      else if (!t.date) someday.push({ task: t, day: null, done: false })
      else if (t.date < today) overdue.push({ task: t, day: t.date, done: false })
      else if (t.date === today) todayRows.push({ task: t, day: t.date, done: false })
      else if (t.date <= weekEnd) week.push({ task: t, day: t.date, done: false })
      else later.push({ task: t, day: t.date, done: false })
    }
    const byWhen = (a: Row, b: Row) =>
      (a.day ?? '9999').localeCompare(b.day ?? '9999') || (a.task.start ?? -1) - (b.task.start ?? -1) || a.task.createdAt - b.task.createdAt
    // Today: still to do first, by time; the ones ticked off go to the bottom.
    todayRows.sort((a, b) => Number(a.done) - Number(b.done) || byWhen(a, b))
    for (const g of [overdue, week, later, routines]) g.sort(byWhen)
    someday.sort((a, b) => a.task.createdAt - b.task.createdAt)
    done.sort((a, b) => b.task.createdAt - a.task.createdAt)
    return { overdue, today: todayRows, week, later, someday, routines, done }
  }, [tasks, today])

  function add() {
    const title = quick.trim()
    if (!title) return
    setQuick('')
    // The dialog asks what it's for and whether there's a deadline.
    useStore.getState().openModal({ type: 'task', entry: 'todo', title })
  }

  const left = groups.today.filter((r) => !r.done).length
  const nothing = !tasks.some((t) => !isEvent(t))

  return (
    <div className={`${card} p-3`}>
      <div className="mb-2 flex items-baseline justify-between px-1">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">To do</span>
        {groups.today.length > 0 && (
          <span className="text-xs tabular-nums text-zinc-500">
            {left === 0 ? 'All done today 🎉' : `${left} left today`}
          </span>
        )}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="mb-2 flex items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 transition focus-within:border-indigo-400/60 focus-within:ring-2 focus-within:ring-indigo-500/20"
      >
        <Plus className="h-4 w-4 shrink-0 text-zinc-500" />
        <input
          value={quick}
          onChange={(e) => setQuick(e.target.value)}
          placeholder="Add a task… then press Enter"
          aria-label="New task"
          className="h-10 min-w-0 flex-1 bg-transparent text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
        />
      </form>

      {nothing ? (
        <div className="px-2 py-6 text-center">
          <Inbox className="mx-auto h-7 w-7 text-zinc-600" />
          <p className="mt-2 text-sm font-medium text-zinc-300">Nothing to do yet</p>
          <p className="mt-1 text-xs text-zinc-500">Add something you need to get done above. To plan your time instead, drag on the calendar.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <Group label="Overdue" tone="text-rose-300" icon={<AlertCircle className="h-3 w-3" />} rows={groups.overdue} today={today} late />
          <Group label="Today" tone="text-indigo-300" rows={groups.today} today={today} empty="Nothing due today." />
          <Group label="Next 7 days" rows={groups.week} today={today} />
          <Group label="Later" rows={groups.later} today={today} />
          <Group label="No deadline" rows={groups.someday} today={today} />
          {groups.routines.length > 0 && (
            <Fold label={`Repeating · ${groups.routines.length}`} open={showRoutines} onToggle={() => setShowRoutines((o) => !o)}>
              {groups.routines.map((r) => (
                <TaskRow key={r.task.id} row={r} today={today} routine />
              ))}
            </Fold>
          )}
          {groups.done.length > 0 && (
            <Fold label={`Done · ${groups.done.length}`} open={showDone} onToggle={() => setShowDone((o) => !o)}>
              {groups.done.map((r) => (
                <TaskRow key={r.task.id} row={r} today={today} />
              ))}
            </Fold>
          )}
        </div>
      )}
    </div>
  )
}

function Group({ label, rows, today, tone, icon, late, empty }: { label: string; rows: Row[]; today: string; tone?: string; icon?: ReactNode; late?: boolean; empty?: string }) {
  if (!rows.length && !empty) return null
  return (
    <div>
      <p className={`mb-0.5 flex items-center gap-1 px-1 text-[11px] font-semibold ${tone ?? 'text-zinc-500'}`}>
        {icon}
        {label}
        {rows.length > 0 && <span className="font-normal text-zinc-600">· {rows.length}</span>}
      </p>
      {rows.length ? (
        <ul>
          {rows.map((r) => (
            <TaskRow key={`${r.task.id}-${r.day}`} row={r} today={today} late={late} />
          ))}
        </ul>
      ) : (
        <p className="px-1 py-1 text-xs text-zinc-600">{empty}</p>
      )}
    </div>
  )
}

function Fold({ label, open, onToggle, children }: { label: string; open: boolean; onToggle: () => void; children: ReactNode }) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-1 px-1 text-[11px] font-semibold text-zinc-500 transition hover:text-zinc-300">
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? '' : '-rotate-90'}`} />
        {label}
      </button>
      {open && <ul className="animate-fade mt-0.5">{children}</ul>}
    </div>
  )
}

/** "2 days late", "Today · 3 PM", "Fri, Oct 23 · 9:30 AM" */
function whenLabel(r: Row, today: string, late?: boolean) {
  const t = r.task
  if (!r.day) return null
  const time = t.start != null ? fmtTime(t.start, true) : ''
  if (late) {
    const n = Math.round((fromKey(today).getTime() - fromKey(r.day).getTime()) / 86400000)
    return `${n === 1 ? 'Yesterday' : `${n} days late`}${time ? ` · ${time}` : ''}`
  }
  return `${dayLabel(r.day, today)}${time ? ` · ${time}` : ''}`
}

function TaskRow({ row, today, late, routine }: { row: Row; today: string; late?: boolean; routine?: boolean }) {
  const kind = useTaskKindOf()(row.task.kind)
  const c = taskColor(kind)
  const t = row.task
  const [pop, setPop] = useState(false)
  const sub = routine
    ? `${repeatLabel(t.repeat!)}${t.start != null ? ` · ${fmtTime(t.start, true)}` : ''}`
    : t.repeat && row.day === today
      ? `${t.start != null ? fmtTime(t.start, true) : 'All day'} · repeats`
      : whenLabel(row, today, late)

  function toggle() {
    const s = useStore.getState()
    const done = s.toggleTask(t.id, t.repeat ? (row.day ?? undefined) : undefined)
    if (done) {
      setPop(true)
      setTimeout(() => setPop(false), 400)
      if (!t.repeat) toast.undo(`Done · “${t.title}”`, () => useStore.getState().toggleTask(t.id))
    }
  }

  return (
    <li className="group flex min-w-0 items-start gap-2.5 rounded-xl px-1.5 py-1.5 transition hover:bg-white/[0.04]">
      {routine ? (
        <span className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full ${c.text}`}>
          <Repeat className="h-3.5 w-3.5" />
        </span>
      ) : (
        <button
          onClick={toggle}
          role="checkbox"
          aria-checked={row.done}
          aria-label={row.done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
          className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${c.ring} ${
            row.done ? `${c.dot} border-transparent` : 'hover:bg-white/10'
          } ${pop ? 'scale-125' : ''}`}
        >
          {row.done && <Check className="h-3 w-3 text-black/75" strokeWidth={3.5} />}
        </button>
      )}
      <button onClick={() => useStore.getState().openModal({ type: 'task', editId: t.id })} className="min-w-0 flex-1 text-left">
        <p className={`truncate text-sm leading-snug ${row.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{t.title}</p>
        <p className={`flex min-w-0 items-center gap-1.5 truncate text-[11.5px] ${late ? 'text-rose-300/80' : 'text-zinc-500'}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${c.dot}`} />
          <span className="truncate">{sub ?? kind.label}</span>
        </p>
      </button>
    </li>
  )
}
