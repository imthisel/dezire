import { KIND_COLORS } from './meta'
import { addDays, fromKey, isDate, todayKey, uniq } from './expenses'
import { MONTHS_SHORT } from './time'

/**
 * School: a board of tasks in columns (Not started, In progress, Done…), each task for a subject and due on a day.
 *
 * Columns have a role:
 * - 'open': still to do. The user's own columns are these.
 * - 'week': done this week (Sunday to Saturday). Its title shows the week's dates.
 * - 'done': done before this week. Every Sunday, what's in the 'week' column from earlier weeks moves here by itself.
 */
export type ColumnRole = 'open' | 'week' | 'done'

export interface SchoolColumn {
  id: string
  name: string
  /** Key into KIND_COLORS */
  color: string
  role: ColumnRole
}

export interface SchoolTask {
  id: string
  /** The class it's for (matches a SchoolSubject's name, ignoring case) */
  subject: string
  title: string
  /** "YYYY-MM-DD" */
  due: string
  notes: string
  /** SchoolColumn id */
  column: string
  /** "YYYY-MM-DD" it was finished ('' = not done) */
  doneAt: string
  /** Done tasks: the column it was in before, so un-ticking puts it back there */
  from?: string
  createdAt: number
}

/** Every subject typed is kept here (so it's offered next time), with its colour. Starred ones come first. */
export interface SchoolSubject {
  name: string
  color: string
  fav: boolean
}

export interface School {
  columns: SchoolColumn[]
  tasks: SchoolTask[]
  subjects: SchoolSubject[]
}

export const MAX_SUBJECT = 40
export const MAX_TITLE = 120
export const MAX_COLUMN = 32
export const MAX_NOTES = 4000

export const DEFAULT_SCHOOL: School = {
  columns: [
    { id: 'todo', name: 'Not started', color: 'slate', role: 'open' },
    { id: 'doing', name: 'In progress', color: 'blue', role: 'open' },
    { id: 'week', name: 'Done', color: 'teal', role: 'week' },
    { id: 'done', name: 'Done earlier', color: 'lime', role: 'done' },
  ],
  tasks: [],
  subjects: [],
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36)

export const colColor = (c: { color: string }) => KIND_COLORS[c.color] ?? KIND_COLORS.slate
export const isDoneRole = (r: ColumnRole) => r !== 'open'
const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

// ---- Weeks (always Sunday to Saturday) ----

export const weekStartOf = (k: string) => addDays(k, -fromKey(k).getDay())
export const thisWeek = (today = todayKey()) => {
  const start = weekStartOf(today)
  return { start, end: addDays(start, 6) }
}
/** "Nov 8 – 14", or "Oct 27 – Nov 2" across months */
export function weekLabel({ start, end }: { start: string; end: string }) {
  const a = fromKey(start)
  const b = fromKey(end)
  return a.getMonth() === b.getMonth()
    ? `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${b.getDate()}`
    : `${MONTHS_SHORT[a.getMonth()]} ${a.getDate()} – ${MONTHS_SHORT[b.getMonth()]} ${b.getDate()}`
}

// ---- Due dates ----

const DAY = 86400000
export const daysBetween = (from: string, to: string) => Math.round((fromKey(to).getTime() - fromKey(from).getTime()) / DAY)

export type DueTone = 'late' | 'today' | 'soon' | 'later' | 'done'
/** How a due date reads next to today: "Today", "Tomorrow", "In 3 days", "2 days late"… */
export function dueInfo(due: string, today = todayKey(), done = false): { label: string; tone: DueTone; days: number } {
  const days = daysBetween(today, due)
  if (done) return { label: shortDate(due), tone: 'done', days }
  if (days < 0) return { label: days === -1 ? 'Due yesterday' : `${-days} days late`, tone: 'late', days }
  if (days === 0) return { label: 'Due today', tone: 'today', days }
  if (days === 1) return { label: 'Tomorrow', tone: 'soon', days }
  if (days <= 6) return { label: `In ${days} days`, tone: 'soon', days }
  return { label: `In ${days} days`, tone: 'later', days }
}

const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
/** "Tue, Oct 20" (the year too when it isn't this year) */
export function shortDate(k: string) {
  const d = fromKey(k)
  const y = d.getFullYear() === new Date().getFullYear() ? '' : `, ${d.getFullYear()}`
  return `${WEEKDAY[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${y}`
}

// ---- Reading what's saved ----

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const color = (v: unknown, fallback = 'slate') => (typeof v === 'string' && v in KIND_COLORS ? v : fallback)

/** Cleans up School from a backup file, the cloud or this browser. Anything missing gets its default. */
export function parseSchool(raw: unknown): School {
  if (!raw || typeof raw !== 'object') return DEFAULT_SCHOOL
  const r = raw as Record<string, unknown>
  const seen = new Set<string>()
  const columns: SchoolColumn[] = []
  for (const x of Array.isArray(r.columns) ? (r.columns as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object' || typeof x.id !== 'string' || !x.id || seen.has(x.id)) continue
    seen.add(x.id)
    const role: ColumnRole = x.role === 'week' || x.role === 'done' ? x.role : 'open'
    columns.push({ id: x.id, name: str(x.name, MAX_COLUMN).trim() || 'Untitled', color: color(x.color), role })
  }
  if (!columns.length) columns.push(...DEFAULT_SCHOOL.columns)
  const ids = new Set(columns.map((c) => c.id))
  const tasks: SchoolTask[] = []
  const taskIds = new Set<string>()
  for (const x of Array.isArray(r.tasks) ? (r.tasks as Record<string, unknown>[]) : []) {
    if (!x || typeof x !== 'object') continue
    const title = str(x.title, MAX_TITLE).trim()
    const subject = str(x.subject, MAX_SUBJECT).trim()
    if (!title || !subject) continue
    const id = typeof x.id === 'string' && x.id && !taskIds.has(x.id) ? x.id : uid()
    taskIds.add(id)
    const column = typeof x.column === 'string' && ids.has(x.column) ? x.column : columns[0].id
    const doneRole = isDoneRole(columns.find((c) => c.id === column)!.role)
    const doneAt = typeof x.doneAt === 'string' && isDate(x.doneAt) ? x.doneAt : ''
    tasks.push({
      id,
      subject,
      title,
      due: typeof x.due === 'string' && isDate(x.due) ? x.due : todayKey(),
      notes: str(x.notes, MAX_NOTES),
      column,
      doneAt: doneRole ? doneAt || todayKey() : '',
      ...(doneRole && typeof x.from === 'string' && ids.has(x.from) ? { from: x.from } : {}),
      createdAt: Number(x.createdAt) || Date.now(),
    })
  }
  const subjects: SchoolSubject[] = []
  for (const x of Array.isArray(r.subjects) ? (r.subjects as Record<string, unknown>[]) : []) {
    const name = x && typeof x === 'object' ? str(x.name, MAX_SUBJECT).trim() : ''
    if (!name || subjects.some((s) => same(s.name, name))) continue
    subjects.push({ name, color: color(x.color, 'violet'), fav: x.fav === true })
  }
  return { columns, tasks, subjects }
}

// ---- Changes (each returns a new School, or the same one when nothing changes) ----

const SUBJECT_COLORS = ['violet', 'cyan', 'orange', 'pink', 'lime', 'blue', 'rose', 'yellow', 'teal']

/** The subject `name` as saved (its colour etc.), or undefined. */
export const findSubject = (s: School, name: string) => s.subjects.find((x) => same(x.name, name))

/** Makes sure `name` is in the subjects list (new ones get an unused colour). */
export function rememberSubject(s: School, name: string): School {
  const n = name.trim().slice(0, MAX_SUBJECT)
  if (!n || findSubject(s, n)) return s
  const used = new Set(s.subjects.map((x) => x.color))
  const c = SUBJECT_COLORS.find((x) => !used.has(x)) ?? SUBJECT_COLORS[s.subjects.length % SUBJECT_COLORS.length]
  return { ...s, subjects: [...s.subjects, { name: n, color: c, fav: false }] }
}

export function updateSubject(s: School, name: string, patch: Partial<SchoolSubject>): School {
  const base = rememberSubject(s, name)
  const to = patch.name?.trim().slice(0, MAX_SUBJECT)
  // Renaming onto another saved subject merges the two.
  const merge = to && !same(to, name) ? findSubject(base, to) : undefined
  const subjects = base.subjects
    .filter((x) => x !== merge)
    .map((x) => (same(x.name, name) ? { ...x, ...patch, name: to || x.name, fav: patch.fav ?? (x.fav || !!merge?.fav) } : x))
  const tasks = to && !same(to, name) ? base.tasks.map((t) => (same(t.subject, name) ? { ...t, subject: to } : t)) : base.tasks
  return { ...base, subjects, tasks }
}

/** Forgets a subject (its tasks keep their subject's name, so it comes back if they're edited). */
export const forgetSubject = (s: School, name: string): School => ({ ...s, subjects: s.subjects.filter((x) => !same(x.name, name)) })

export type TaskInput = { subject: string; title: string; due: string; notes?: string; column?: string }

export function addTask(s: School, d: TaskInput): { school: School; id: string } {
  const base = rememberSubject(s, d.subject)
  const col = base.columns.find((c) => c.id === d.column) ?? base.columns.find((c) => c.role === 'open') ?? base.columns[0]
  const task: SchoolTask = {
    id: uid(),
    subject: findSubject(base, d.subject)?.name ?? d.subject.trim().slice(0, MAX_SUBJECT),
    title: d.title.trim().slice(0, MAX_TITLE),
    due: isDate(d.due) ? d.due : todayKey(),
    notes: (d.notes ?? '').slice(0, MAX_NOTES),
    column: col.id,
    doneAt: isDoneRole(col.role) ? todayKey() : '',
    createdAt: Date.now(),
  }
  return { school: { ...base, tasks: [...base.tasks, task] }, id: task.id }
}

export function updateTask(s: School, id: string, d: TaskInput): School {
  const base = rememberSubject(s, d.subject)
  const next = {
    ...base,
    tasks: base.tasks.map((t) =>
      t.id === id
        ? {
            ...t,
            subject: findSubject(base, d.subject)?.name ?? d.subject.trim(),
            title: d.title.trim().slice(0, MAX_TITLE) || t.title,
            due: isDate(d.due) ? d.due : t.due,
            notes: (d.notes ?? '').slice(0, MAX_NOTES),
          }
        : t,
    ),
  }
  // Only a new column moves it (moving puts it at the end, which would lose its place in "My order").
  return d.column && d.column !== s.tasks.find((t) => t.id === id)?.column ? moveTask(next, id, d.column) : next
}

/**
 * Moves a task to column `columnId`, just before task `before` (null = at the end). Moving into a done column
 * marks it done today (and remembers where it was); moving back out un-marks it.
 */
export function moveTask(s: School, id: string, columnId: string, before: string | null = null): School {
  const t = s.tasks.find((x) => x.id === id)
  const col = s.columns.find((c) => c.id === columnId)
  if (!t || !col || before === id) return s
  const wasCol = s.columns.find((c) => c.id === t.column)
  const wasDone = !!wasCol && isDoneRole(wasCol.role)
  const nowDone = isDoneRole(col.role)
  const moved: SchoolTask = {
    ...t,
    column: col.id,
    doneAt: nowDone ? (wasDone && t.doneAt ? t.doneAt : todayKey()) : '',
  }
  if (nowDone && !wasDone) moved.from = t.column
  if (!nowDone) delete moved.from
  const rest = s.tasks.filter((x) => x.id !== id)
  const at = before ? rest.findIndex((x) => x.id === before) : -1
  if (at < 0) rest.push(moved)
  else rest.splice(at, 0, moved)
  return { ...s, tasks: rest }
}

/** Ticks a task off (into this week's Done) or back on (into the column it came from). */
export function toggleDone(s: School, id: string): { school: School; done: boolean } {
  const t = s.tasks.find((x) => x.id === id)
  if (!t) return { school: s, done: false }
  const col = s.columns.find((c) => c.id === t.column)
  if (col && isDoneRole(col.role)) {
    const back = s.columns.find((c) => c.id === t.from && c.role === 'open') ?? s.columns.find((c) => c.role === 'open')
    return back ? { school: moveTask(s, id, back.id), done: false } : { school: s, done: true }
  }
  const to = s.columns.find((c) => c.role === 'week') ?? s.columns.find((c) => c.role === 'done')
  return to ? { school: moveTask(s, id, to.id), done: true } : { school: s, done: false }
}

/**
 * The weekly turnover: what's in the "this week" column but was finished before this Sunday moves to the
 * "done earlier" column. Safe to run any time; it only changes something once a week.
 */
export function rollWeek(s: School, today = todayKey()): School {
  const week = s.columns.find((c) => c.role === 'week')
  const done = s.columns.find((c) => c.role === 'done')
  if (!week || !done) return s
  const start = weekStartOf(today)
  if (!s.tasks.some((t) => t.column === week.id && t.doneAt < start)) return s
  return { ...s, tasks: s.tasks.map((t) => (t.column === week.id && t.doneAt < start ? { ...t, column: done.id } : t)) }
}

const COLUMN_COLORS = ['violet', 'orange', 'pink', 'cyan', 'yellow', 'rose', 'blue', 'lime', 'teal', 'slate']

export function addColumn(s: School, name: string, role: ColumnRole = 'open', at?: number): { school: School; id: string } {
  const used = new Set(s.columns.map((c) => c.color))
  const col: SchoolColumn = {
    id: uid(),
    name: name.trim().slice(0, MAX_COLUMN) || (role === 'week' ? 'Done' : role === 'done' ? 'Done earlier' : 'New column'),
    color: role === 'week' ? 'teal' : role === 'done' ? 'lime' : (COLUMN_COLORS.find((c) => !used.has(c)) ?? 'slate'),
    role,
  }
  // New columns go before the done ones, so the board keeps reading left to right towards "finished".
  const firstDone = s.columns.findIndex((c) => c.role !== 'open')
  const pos = at ?? (role === 'open' && firstDone >= 0 ? firstDone : role === 'week' && firstDone >= 0 ? firstDone : s.columns.length)
  const columns = [...s.columns]
  columns.splice(pos, 0, col)
  return { school: { ...s, columns }, id: col.id }
}

export const updateColumn = (s: School, id: string, patch: Partial<Pick<SchoolColumn, 'name' | 'color'>>): School => ({
  ...s,
  columns: s.columns.map((c) =>
    c.id === id ? { ...c, ...patch, name: patch.name === undefined ? c.name : patch.name.trim().slice(0, MAX_COLUMN) || c.name } : c,
  ),
})

export function moveColumn(s: School, id: string, to: number): School {
  const from = s.columns.findIndex((c) => c.id === id)
  const at = Math.max(0, Math.min(s.columns.length - 1, to))
  if (from < 0 || from === at) return s
  const columns = [...s.columns]
  columns.splice(at, 0, ...columns.splice(from, 1))
  return { ...s, columns }
}

/** Deletes a column; its tasks move to column `to` (or the nearest one left). The last column can't go. */
export function removeColumn(s: School, id: string, to?: string): School {
  if (s.columns.length <= 1) return s
  const i = s.columns.findIndex((c) => c.id === id)
  const left = s.columns.filter((c) => c.id !== id)
  const target = left.find((c) => c.id === to) ?? left[Math.max(0, i - 1)]
  let next: School = { ...s, columns: [...s.columns] }
  for (const t of s.tasks.filter((x) => x.column === id)) next = moveTask(next, t.id, target.id)
  return { ...next, columns: left }
}

/** Subjects to offer: starred first, then the rest by how recently they were used. */
export function subjectOptions(s: School): SchoolSubject[] {
  const last = new Map<string, number>()
  for (const t of s.tasks) {
    const k = t.subject.toLowerCase()
    last.set(k, Math.max(last.get(k) ?? 0, t.createdAt))
  }
  const rank = (x: SchoolSubject) => last.get(x.name.toLowerCase()) ?? 0
  return [...s.subjects].sort((a, b) => Number(b.fav) - Number(a.fav) || rank(b) - rank(a))
}

export const subjectNames = (s: School) => uniq(s.subjects.map((x) => x.name))
