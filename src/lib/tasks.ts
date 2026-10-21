import {
  BookOpen, Briefcase, Code, Dumbbell, GraduationCap, HeartPulse, Home, Music, Package, Plane, ShoppingBag, Sparkles, User, Users, Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { Repeat, Task, TaskKind, TaskType } from './types'
import { WEEKDAYS, addDays, fromKey, isDate, todayKey } from './expenses'

// ---- Kinds ----

/** Icons a kind of task can use, by name. */
export const TASK_ICONS: Record<string, LucideIcon> = {
  school: GraduationCap, work: Briefcase, personal: User, health: HeartPulse, errands: ShoppingBag, social: Users, home: Home,
  fitness: Dumbbell, reading: BookOpen, code: Code, travel: Plane, money: Wallet, music: Music, box: Package, other: Sparkles,
}

/** Colours a kind of task can use (written out in full so Tailwind keeps them). */
export const TASK_COLORS: Record<
  string,
  {
    label: string
    /** Small dot / checkbox fill */
    dot: string
    /** Text in the kind's colour */
    text: string
    /** A block on the calendar: background, its left edge, title and time text */
    block: string
    edge: string
    title: string
    sub: string
    /** A picked chip */
    chip: string
    /** Checkbox outline */
    ring: string
  }
> = {
  violet: { label: 'Violet', dot: 'bg-violet-400', text: 'text-violet-300', block: 'bg-violet-500/25 hover:bg-violet-500/35', edge: 'border-violet-400', title: 'text-violet-50', sub: 'text-violet-200/75', chip: 'border-violet-400/60 bg-violet-500/20 text-violet-100', ring: 'border-violet-400' },
  blue: { label: 'Blue', dot: 'bg-blue-400', text: 'text-blue-300', block: 'bg-blue-500/25 hover:bg-blue-500/35', edge: 'border-blue-400', title: 'text-blue-50', sub: 'text-blue-200/75', chip: 'border-blue-400/60 bg-blue-500/20 text-blue-100', ring: 'border-blue-400' },
  cyan: { label: 'Cyan', dot: 'bg-cyan-400', text: 'text-cyan-300', block: 'bg-cyan-500/25 hover:bg-cyan-500/35', edge: 'border-cyan-400', title: 'text-cyan-50', sub: 'text-cyan-200/75', chip: 'border-cyan-400/60 bg-cyan-500/20 text-cyan-100', ring: 'border-cyan-400' },
  teal: { label: 'Teal', dot: 'bg-teal-400', text: 'text-teal-300', block: 'bg-teal-500/25 hover:bg-teal-500/35', edge: 'border-teal-400', title: 'text-teal-50', sub: 'text-teal-200/75', chip: 'border-teal-400/60 bg-teal-500/20 text-teal-100', ring: 'border-teal-400' },
  lime: { label: 'Lime', dot: 'bg-lime-400', text: 'text-lime-300', block: 'bg-lime-500/25 hover:bg-lime-500/35', edge: 'border-lime-400', title: 'text-lime-50', sub: 'text-lime-200/75', chip: 'border-lime-400/60 bg-lime-500/20 text-lime-100', ring: 'border-lime-400' },
  yellow: { label: 'Yellow', dot: 'bg-yellow-300', text: 'text-yellow-200', block: 'bg-yellow-400/20 hover:bg-yellow-400/30', edge: 'border-yellow-300', title: 'text-yellow-50', sub: 'text-yellow-100/75', chip: 'border-yellow-300/60 bg-yellow-400/20 text-yellow-50', ring: 'border-yellow-300' },
  orange: { label: 'Orange', dot: 'bg-orange-400', text: 'text-orange-300', block: 'bg-orange-500/25 hover:bg-orange-500/35', edge: 'border-orange-400', title: 'text-orange-50', sub: 'text-orange-200/75', chip: 'border-orange-400/60 bg-orange-500/20 text-orange-100', ring: 'border-orange-400' },
  rose: { label: 'Red', dot: 'bg-rose-400', text: 'text-rose-300', block: 'bg-rose-500/25 hover:bg-rose-500/35', edge: 'border-rose-400', title: 'text-rose-50', sub: 'text-rose-200/75', chip: 'border-rose-400/60 bg-rose-500/20 text-rose-100', ring: 'border-rose-400' },
  pink: { label: 'Pink', dot: 'bg-fuchsia-400', text: 'text-fuchsia-300', block: 'bg-fuchsia-500/25 hover:bg-fuchsia-500/35', edge: 'border-fuchsia-400', title: 'text-fuchsia-50', sub: 'text-fuchsia-200/75', chip: 'border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100', ring: 'border-fuchsia-400' },
  slate: { label: 'Grey', dot: 'bg-zinc-400', text: 'text-zinc-300', block: 'bg-zinc-500/25 hover:bg-zinc-500/35', edge: 'border-zinc-400', title: 'text-zinc-50', sub: 'text-zinc-300/75', chip: 'border-zinc-400/60 bg-zinc-500/20 text-zinc-100', ring: 'border-zinc-400' },
}

/** The kinds every account starts with (ids fixed, so a removed one can be brought back). */
export const DEFAULT_TASK_KINDS: TaskKind[] = [
  { id: 'school', label: 'School', icon: 'school', color: 'violet' },
  { id: 'work', label: 'Work', icon: 'work', color: 'blue' },
  { id: 'personal', label: 'Personal', icon: 'personal', color: 'teal' },
  { id: 'health', label: 'Health & fitness', icon: 'health', color: 'rose' },
  { id: 'errands', label: 'Errands', icon: 'errands', color: 'orange' },
  { id: 'social', label: 'Friends & family', icon: 'social', color: 'pink' },
]

/** Shown for a task whose kind was deleted (e.g. on another device a moment ago). */
export const UNKNOWN_TASK_KIND: TaskKind = { id: '', label: 'No kind', icon: 'box', color: 'slate' }

export const MAX_TASK_KIND_NAME = 28
export const MAX_TASK_TITLE = 120

export const taskIcon = (k: TaskKind) => TASK_ICONS[k.icon] ?? Package
export const taskColor = (k: TaskKind) => TASK_COLORS[k.color] ?? TASK_COLORS.slate

const ICON_WORDS: [RegExp, string][] = [
  [/school|class|study|exam|homework|uni|college|course|thesis/, 'school'],
  [/work|job|office|business|client/, 'work'],
  [/gym|fitness|workout|sport|run/, 'fitness'],
  [/health|doctor|medic|dental/, 'health'],
  [/errand|shop|grocer|buy/, 'errands'],
  [/friend|family|social|date|party/, 'social'],
  [/home|house|chore|clean/, 'home'],
  [/read|book/, 'reading'],
  [/code|dev|program|project/, 'code'],
  [/travel|trip|flight/, 'travel'],
  [/money|bill|pay|bank|finance/, 'money'],
  [/music|band|practice/, 'music'],
  [/personal|me|self/, 'personal'],
]
export const guessTaskIcon = (name: string) => ICON_WORDS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 'other'

// ---- Time ----

export const DAY_MINUTES = 24 * 60
/** The longest a task can run: a week (it carries on past midnight into the next days). */
export const MAX_DURATION = 7 * DAY_MINUTES
/** Times snap to quarter hours when dragged. */
export const SNAP = 15
export const snap = (m: number) => Math.round(m / SNAP) * SNAP
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))
const pad = (n: number) => String(n).padStart(2, '0')

/** 570 → "9:30 AM"; with `short`, whole hours drop the minutes ("9 AM"). */
export function fmtTime(m: number, short = false) {
  const h = Math.floor(m / 60) % 24
  const mm = m % 60
  const ap = h < 12 ? 'AM' : 'PM'
  const h12 = h % 12 || 12
  return short && mm === 0 ? `${h12} ${ap}` : `${h12}:${pad(mm)} ${ap}`
}

/** "9:30 – 11 AM" (the AM/PM is said once when both are the same); "11 PM – 2 AM (next day)" when it runs past midnight. */
export function fmtRange(start: number, duration: number) {
  const end = start + duration
  const a = fmtTime(start, true)
  const b = fmtTime(end % DAY_MINUTES, true)
  const same = start < 720 === end % DAY_MINUTES < 720 && end < DAY_MINUTES
  // Ending exactly at midnight is still the same day.
  const later = Math.floor((end - 1) / DAY_MINUTES)
  const after = later === 0 ? '' : later === 1 ? ' (next day)' : ` (+${later} days)`
  return (same ? `${a.replace(/ [AP]M$/, '')} – ${b}` : `${a} – ${b}`) + after
}

/** "1h 30m", "45m", "2h" */
export function fmtDuration(m: number) {
  const h = Math.floor(m / 60)
  const mm = m % 60
  return h && mm ? `${h}h ${mm}m` : h ? `${h}h` : `${mm}m`
}

/** For `<input type="time">`: 570 ⇄ "09:30" */
export const toTimeInput = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`
export function fromTimeInput(v: string): number | null {
  const m = /^(\d{1,2}):(\d{2})/.exec(v)
  return m ? clamp(Number(m[1]) * 60 + Number(m[2]), 0, DAY_MINUTES - 1) : null
}

/** Minutes after midnight right now. */
export const nowMinutes = () => {
  const d = new Date()
  return d.getHours() * 60 + d.getMinutes()
}

// ---- Repeating ----

export const EVERY_DAY = [0, 1, 2, 3, 4, 5, 6]
export const WEEKDAYS_ONLY = [1, 2, 3, 4, 5]
export const WEEKENDS = [0, 6]

const same = (a: number[], b: number[]) => a.length === b.length && a.every((x, i) => x === b[i])

/** "Every day", "Weekdays", "Mon, Wed & Fri" */
export function repeatLabel(r: Repeat) {
  const d = [...r.days].sort()
  if (same(d, EVERY_DAY)) return 'Every day'
  if (same(d, WEEKDAYS_ONLY)) return 'Weekdays'
  if (same(d, WEEKENDS)) return 'Weekends'
  const names = d.map((x) => WEEKDAYS[x])
  return names.length === 1 ? `Every ${names[0]}` : `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`
}

/** Does task `t` happen on day `k`? */
export function happensOn(t: Task, k: string) {
  if (!t.date) return false
  if (!t.repeat) return t.date === k
  if (k < t.date || (t.repeat.until && k > t.repeat.until)) return false
  return t.repeat.days.includes(fromKey(k).getDay())
}

export const isDoneOn = (t: Task, k: string) => (t.repeat ? t.doneOn.includes(k) : t.done)

/** One showing of a task on one day (a repeating task has one every day it comes back). */
export type Occurrence = { task: Task; day: string; done: boolean }

/** Every showing of `tasks` from day `from` to day `to` (both included), day by day. */
export function occurrencesIn(tasks: Task[], from: string, to: string): Occurrence[] {
  const out: Occurrence[] = []
  for (const t of tasks) {
    if (!t.date) continue
    if (!t.repeat) {
      if (t.date >= from && t.date <= to) out.push({ task: t, day: t.date, done: t.done })
      continue
    }
    const last = t.repeat.until && t.repeat.until < to ? t.repeat.until : to
    for (let k = t.date > from ? t.date : from; k <= last; k = addDays(k, 1)) {
      if (t.repeat.days.includes(fromKey(k).getDay())) out.push({ task: t, day: k, done: t.doneOn.includes(k) })
    }
  }
  return out
}

/** The next day on or after `from` that task `t` happens and isn't ticked off (looks up to a year ahead). */
export function nextOpenDay(t: Task, from: string): string | null {
  if (!t.date) return null
  if (!t.repeat) return t.done ? null : t.date
  let k = t.date > from ? t.date : from
  for (let i = 0; i < 370; i++, k = addDays(k, 1)) {
    if (t.repeat.until && k > t.repeat.until) return null
    if (happensOn(t, k) && !t.doneOn.includes(k)) return k
  }
  return null
}

/** The part of a task shown on one day of the grid: one that runs past midnight carries on into the next day. */
export type Segment = {
  occ: Occurrence
  day: string
  /** Minutes after that day's midnight */
  start: number
  end: number
  /** Where the task starts (false: it carried on from the day before) */
  first: boolean
  /** Where the task ends */
  last: boolean
}

/** Splits a timed task into one piece per day it covers. `start` / `duration` / `day` can be overridden (e.g. while it's dragged). */
export function segmentsOf(occ: Occurrence, start = occ.task.start ?? 0, duration = occ.task.duration, day = occ.day): Segment[] {
  const end = start + duration
  const out: Segment[] = []
  for (let i = 0; i * DAY_MINUTES < end; i++) {
    const s = Math.max(0, start - i * DAY_MINUTES)
    const e = Math.min(DAY_MINUTES, end - i * DAY_MINUTES)
    if (e > s) out.push({ occ, day: addDays(day, i), start: s, end: e, first: i === 0, last: end - i * DAY_MINUTES <= DAY_MINUTES })
  }
  return out
}

/** Whole days from `a` to `b` ("2026-10-21" → "2026-10-23" = 2). */
export const daysBetween = (a: string, b: string) => Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86400000)

/** Sorts by start time (all-day first), then longest first, then by name. */
export const byTime = (a: Occurrence, b: Occurrence) =>
  (a.task.start ?? -1) - (b.task.start ?? -1) || b.task.duration - a.task.duration || a.task.title.localeCompare(b.task.title)

/**
 * Side-by-side columns for timed tasks that overlap on one day, like Google Calendar.
 * Returns, for each piece, its column and how many columns its group of overlapping tasks uses.
 */
export function layoutDay(list: Segment[]): Map<Segment, { col: number; cols: number }> {
  const out = new Map<Segment, { col: number; cols: number }>()
  const sorted = [...list].sort((a, b) => a.start - b.start || b.end - a.end || a.occ.task.title.localeCompare(b.occ.task.title))
  let group: Segment[] = []
  let ends: number[] = []
  let groupEnd = -1
  const close = () => {
    for (const o of group) out.get(o)!.cols = ends.length
    group = []
    ends = []
  }
  for (const o of sorted) {
    const s = o.start
    const e = s + Math.max(o.end - o.start, 20)
    if (s >= groupEnd) close()
    let col = ends.findIndex((end) => end <= s)
    if (col < 0) col = ends.push(e) - 1
    else ends[col] = e
    group.push(o)
    out.set(o, { col, cols: 0 })
    groupEnd = Math.max(groupEnd, e)
  }
  close()
  return out
}

// ---- Cleaning up what's typed or loaded ----

export type TaskInput = {
  type: TaskType
  title: string
  kind: string
  notes?: string
  date: string
  start: number | null
  duration: number
  repeat: Repeat | null
}

export const isEvent = (t: Pick<Task, 'type'>) => t.type === 'event'
/** How tall a to-do's due-time marker is on the calendar, in minutes of the grid (it has no length of its own). */
export const DUE_SPAN = 30

/** Tidies what was typed for a task. An event always has a day (today when none was given). */
export function cleanTask(d: TaskInput) {
  const type: TaskType = d.type === 'event' ? 'event' : 'todo'
  const date = isDate(d.date) ? d.date : type === 'event' ? todayKey() : ''
  const start = date && d.start != null && Number.isFinite(d.start) ? clamp(Math.round(d.start), 0, DAY_MINUTES - SNAP) : null
  const duration = start == null ? 60 : clamp(Math.round(Number(d.duration) || 60), SNAP, MAX_DURATION)
  const days = d.repeat ? [...new Set(d.repeat.days.filter((x) => Number.isInteger(x) && x >= 0 && x <= 6))].sort() : []
  const repeat = date && d.repeat && days.length ? { days, until: isDate(d.repeat.until) && d.repeat.until >= date ? d.repeat.until : '' } : null
  return {
    type,
    title: d.title.trim().slice(0, MAX_TASK_TITLE) || 'Untitled',
    kind: d.kind,
    notes: (d.notes ?? '').slice(0, 2000),
    date,
    start,
    duration,
    repeat,
  }
}

/** Cleans up task kinds from a backup file or the cloud. null = nothing usable. */
export function parseTaskKinds(list: unknown): TaskKind[] | null {
  if (!Array.isArray(list)) return null
  const seen = new Set<string>()
  const out: TaskKind[] = []
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || typeof x.label !== 'string' || seen.has(x.id)) continue
    seen.add(x.id)
    out.push({
      id: x.id,
      label: x.label.trim().slice(0, MAX_TASK_KIND_NAME) || 'Untitled',
      icon: typeof x.icon === 'string' && x.icon in TASK_ICONS ? x.icon : 'other',
      color: typeof x.color === 'string' && x.color in TASK_COLORS ? x.color : 'slate',
    })
  }
  return out.length ? out : null
}

/** Cleans up tasks from a backup file or the cloud. */
export function parseTasks(list: unknown): Task[] {
  if (!Array.isArray(list)) return []
  const out: Task[] = []
  for (const x of list as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || typeof x.title !== 'string') continue
    const r = x.repeat as Partial<Repeat> | null | undefined
    const date = typeof x.date === 'string' ? x.date : ''
    const clean = cleanTask({
      // Saved before events and to-dos were told apart: anything with a time was time set aside.
      type: x.type === 'event' || x.type === 'todo' ? x.type : date && x.start != null ? 'event' : 'todo',
      title: x.title,
      kind: typeof x.kind === 'string' ? x.kind : '',
      notes: typeof x.notes === 'string' ? x.notes : '',
      date,
      start: x.start == null ? null : Number(x.start),
      duration: Number(x.duration) || 60,
      repeat: r && typeof r === 'object' && Array.isArray(r.days) ? { days: r.days.map(Number), until: typeof r.until === 'string' ? r.until : '' } : null,
    })
    out.push({
      id: typeof x.id === 'string' && x.id ? x.id : Math.random().toString(36).slice(2),
      ...clean,
      done: !!x.done,
      doneOn: Array.isArray(x.doneOn) ? x.doneOn.filter((k): k is string => typeof k === 'string' && isDate(k)) : [],
      createdAt: Number(x.createdAt) || Date.now(),
    })
  }
  return out
}
