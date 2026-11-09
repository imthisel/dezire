import { useEffect, useLayoutEffect, useMemo, useRef, useState, type DragEvent, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import {
  AlarmClock, ArrowDownUp, ArrowLeft, ArrowRight, BookOpen, CalendarClock, CalendarDays, Check, CheckCheck, ChevronDown, Columns3, GraduationCap,
  GripVertical, List, MoreHorizontal, MousePointerClick, Plus, RotateCcw, Search, Settings2, StickyNote, Trash2, X,
} from 'lucide-react'
import { useStore } from '../store'
import { quietly } from '../history'
import { addDays, todayKey } from '../lib/expenses'
import { KIND_COLORS } from '../lib/meta'
import {
  MAX_COLUMN, addColumn, colColor, dueInfo, findSubject, isDoneRole, moveColumn, moveTask, removeColumn, rollWeek, shortDate, thisWeek, toggleDone,
  updateColumn, weekLabel, type ColumnRole, type School as SchoolData, type SchoolColumn, type SchoolTask,
} from '../lib/school'
import { card } from './Dashboard'
import { ColorRow, SubjectsModal } from './SchoolSubjects'
import { toast } from '../toast'

// ---- Looks ----

/** Soft backgrounds for a column and its cards, by colour (written out in full so Tailwind keeps them). */
const TINT: Record<string, { col: string; card: string; pill: string }> = {
  slate: { col: 'bg-white/[0.025]', card: 'bg-[#15161c] border-white/[0.07] hover:border-white/[0.16]', pill: 'bg-white/[0.08] text-zinc-200' },
  teal: { col: 'bg-teal-500/[0.05]', card: 'bg-[#121a1a] border-teal-300/[0.09] hover:border-teal-300/25', pill: 'bg-teal-500/20 text-teal-100' },
  cyan: { col: 'bg-cyan-500/[0.05]', card: 'bg-[#11191d] border-cyan-300/[0.09] hover:border-cyan-300/25', pill: 'bg-cyan-500/20 text-cyan-100' },
  blue: { col: 'bg-blue-500/[0.06]', card: 'bg-[#131824] border-blue-300/[0.1] hover:border-blue-300/25', pill: 'bg-blue-500/25 text-blue-100' },
  violet: { col: 'bg-violet-500/[0.06]', card: 'bg-[#171523] border-violet-300/[0.1] hover:border-violet-300/25', pill: 'bg-violet-500/25 text-violet-100' },
  pink: { col: 'bg-fuchsia-500/[0.05]', card: 'bg-[#1b141d] border-fuchsia-300/[0.09] hover:border-fuchsia-300/25', pill: 'bg-fuchsia-500/20 text-fuchsia-100' },
  rose: { col: 'bg-rose-500/[0.05]', card: 'bg-[#1c1418] border-rose-300/[0.09] hover:border-rose-300/25', pill: 'bg-rose-500/20 text-rose-100' },
  orange: { col: 'bg-orange-500/[0.05]', card: 'bg-[#1c1713] border-orange-300/[0.09] hover:border-orange-300/25', pill: 'bg-orange-500/20 text-orange-100' },
  yellow: { col: 'bg-yellow-400/[0.04]', card: 'bg-[#1b1a12] border-yellow-200/[0.09] hover:border-yellow-200/25', pill: 'bg-yellow-400/20 text-yellow-50' },
  lime: { col: 'bg-lime-500/[0.05]', card: 'bg-[#151a12] border-lime-300/[0.09] hover:border-lime-300/25', pill: 'bg-lime-500/20 text-lime-100' },
}
const tint = (c: { color: string }) => TINT[c.color] ?? TINT.slate
const subjectDot = (school: SchoolData, name: string) => (KIND_COLORS[findSubject(school, name)?.color ?? 'slate'] ?? KIND_COLORS.slate).bar

const DUE_TONE = {
  late: 'bg-rose-500/15 text-rose-200 ring-1 ring-rose-400/25',
  today: 'bg-amber-400/15 text-amber-100 ring-1 ring-amber-300/25',
  soon: 'bg-white/[0.06] text-zinc-200',
  later: 'text-zinc-500',
  done: 'text-zinc-500',
}

// ---- Remembered on this device ----

function useLocal<T extends string>(key: string, fallback: T, options: readonly T[]) {
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

/** Today's date, kept current while the page stays open (so Done turns over at midnight on Sunday). */
function useToday() {
  const [today, setToday] = useState(todayKey)
  useEffect(() => {
    const check = () => setToday((t) => (t === todayKey() ? t : todayKey()))
    const id = setInterval(check, 30_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}

type When = 'late' | 'week' | null
type Sort = 'due' | 'manual'

const openTask = (id: string) => useStore.getState().openModal({ type: 'school', editId: id })
const newTask = (column?: string, subject?: string) => useStore.getState().openModal({ type: 'school', column, subject })

function tick(id: string) {
  let done = false
  const before = useStore.getState().school
  useStore.getState().changeSchool((s) => {
    const r = toggleDone(s, id)
    done = r.done
    return r.school
  })
  const t = before.tasks.find((x) => x.id === id)
  if (t && done) toast.undo(`Done: “${t.title}” 🎉`, () => useStore.getState().changeSchool((s) => ({ ...s, tasks: s.tasks.map((x) => (x.id === id ? t : x)) })))
}

// ---- The page ----

export function School() {
  const school = useStore((s) => s.school)
  const today = useToday()
  const [view, setView] = useLocal('dizayr-school-view', 'board', ['board', 'list'] as const)
  const [sort, setSort] = useLocal<Sort>('dizayr-school-sort', 'due', ['due', 'manual'] as const)
  const [subject, setSubject] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [when, setWhen] = useState<When>(null)
  const [managing, setManaging] = useState(false)
  const searchBox = useRef<HTMLInputElement>(null)

  // Every Sunday, last week's Done moves to "Done earlier". Not an undo step: it's the calendar doing it, not you.
  useEffect(() => {
    quietly(() => useStore.getState().changeSchool((s) => rollWeek(s, today)))
  }, [today])

  // N: new task. /: search. (Not while typing, or with a dialog open.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select, [contenteditable="true"]') || useStore.getState().modal) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        newTask()
      } else if (e.key === '/') {
        e.preventDefault()
        searchBox.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const week = thisWeek(today)
  const roleOf = useMemo(() => new Map(school.columns.map((c) => [c.id, c.role])), [school.columns])
  const isOpen = (t: SchoolTask) => roleOf.get(t.column) === 'open'

  const stats = useMemo(() => {
    let open = 0, late = 0, soon = 0, done = 0
    for (const t of school.tasks) {
      if (roleOf.get(t.column) === 'open') {
        open++
        if (t.due < today) late++
        else if (t.due <= addDays(today, 6)) soon++
      } else if (t.doneAt >= week.start) done++
    }
    return { open, late, soon, done }
  }, [school.tasks, roleOf, today, week.start])

  // Subjects that have tasks, for the filter row (in the order of your subject list).
  const usedSubjects = useMemo(() => {
    const used = new Set(school.tasks.map((t) => t.subject.toLowerCase()))
    const known = school.subjects.filter((s) => used.has(s.name.toLowerCase())).map((s) => s.name)
    const rest = [...new Set(school.tasks.map((t) => t.subject))].filter((n) => !known.some((k) => k.toLowerCase() === n.toLowerCase()))
    return [...known, ...rest]
  }, [school.tasks, school.subjects])

  const q = query.trim().toLowerCase()
  const shown = useMemo(
    () =>
      school.tasks.filter((t) => {
        if (subject && t.subject.toLowerCase() !== subject.toLowerCase()) return false
        if (when === 'late' && !(roleOf.get(t.column) === 'open' && t.due < today)) return false
        if (when === 'week' && !(roleOf.get(t.column) === 'open' && t.due >= today && t.due <= addDays(today, 6))) return false
        return !q || t.title.toLowerCase().includes(q) || t.subject.toLowerCase().includes(q) || t.notes.toLowerCase().includes(q)
      }),
    [school.tasks, subject, when, q, roleOf, today],
  )
  const filtering = !!subject || !!when || !!q
  const clearFilters = () => (setSubject(null), setWhen(null), setQuery(''))

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Title */}
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-sky-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-indigo-400 to-violet-400 shadow-lg shadow-indigo-500/20">
            <GraduationCap className="h-5 w-5 text-white" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">School</h2>
            <p className="truncate text-sm text-zinc-400">Every class, every deadline, and what you got done this week.</p>
          </div>
          <button
            onClick={() => setManaging(true)}
            title="Your subjects"
            aria-label="Your subjects"
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <button
            onClick={() => newTask()}
            title="New task (N)"
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:px-4"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> <span className="hidden sm:inline">New task</span>
          </button>
        </div>

        {/* At a glance; Late and Due this week also filter the board. */}
        <div className="relative mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
          <Stat icon={Columns3} label="To do" value={stats.open} hint={stats.open ? 'still open' : 'all clear'} />
          <Stat
            icon={AlarmClock}
            label="Late"
            value={stats.late}
            hint={stats.late ? 'past the due date' : 'nothing late'}
            tone={stats.late ? 'rose' : undefined}
            on={when === 'late'}
            onClick={stats.late || when === 'late' ? () => setWhen(when === 'late' ? null : 'late') : undefined}
          />
          <Stat
            icon={CalendarClock}
            label="Due in 7 days"
            value={stats.soon}
            hint="today to next week"
            tone={stats.soon ? 'amber' : undefined}
            on={when === 'week'}
            onClick={stats.soon || when === 'week' ? () => setWhen(when === 'week' ? null : 'week') : undefined}
          />
          <Stat icon={CheckCheck} label="Done this week" value={stats.done} hint={weekLabel(week)} tone={stats.done ? 'teal' : undefined} />
        </div>
      </section>

      {school.tasks.length === 0 && <Welcome />}

      {/* Tools */}
      {school.tasks.length > 0 && (
        <div className="space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div role="tablist" aria-label="Show as" className="flex rounded-xl border border-white/10 bg-white/[0.03] p-1">
              {(
                [
                  ['board', 'Board', Columns3],
                  ['list', 'List', List],
                ] as const
              ).map(([id, label, Icon]) => (
                <button
                  key={id}
                  role="tab"
                  aria-selected={view === id}
                  onClick={() => setView(id)}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-sm font-medium transition ${view === id ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  <Icon className="h-4 w-4" /> {label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[10rem] flex-1 sm:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                ref={searchBox}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Escape' && (setQuery(''), e.currentTarget.blur())}
                placeholder="Search tasks"
                aria-label="Search tasks"
                className="h-10 w-full rounded-xl border border-white/10 bg-white/[0.03] pl-9 pr-9 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
              />
              {query ? (
                <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 hover:bg-white/5 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              ) : (
                <kbd className="pointer-events-none absolute right-2.5 top-1/2 hidden -translate-y-1/2 rounded border border-white/10 px-1.5 text-[10px] text-zinc-500 sm:block">/</kbd>
              )}
            </div>
            {view === 'board' && (
              <button
                onClick={() => setSort(sort === 'due' ? 'manual' : 'due')}
                title={sort === 'due' ? 'Cards are sorted by due date. Click to put them in your own order.' : 'Cards are in your own order (drag to arrange). Click to sort by due date.'}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
              >
                {sort === 'due' ? <ArrowDownUp className="h-4 w-4" /> : <GripVertical className="h-4 w-4" />}
                <span className="hidden sm:inline">{sort === 'due' ? 'By due date' : 'My order'}</span>
              </button>
            )}
          </div>

          {usedSubjects.length > 1 && (
            <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
              <FilterChip on={!subject} onClick={() => setSubject(null)}>
                All subjects
              </FilterChip>
              {usedSubjects.map((n) => (
                <FilterChip key={n} on={subject?.toLowerCase() === n.toLowerCase()} onClick={() => setSubject(subject?.toLowerCase() === n.toLowerCase() ? null : n)}>
                  <span className={`h-2 w-2 rounded-full ${subjectDot(school, n)}`} /> {n}
                </FilterChip>
              ))}
            </div>
          )}

          {filtering && (
            <p className="animate-fade flex items-center gap-2 text-xs text-zinc-500">
              Showing {shown.length} of {school.tasks.length} task{school.tasks.length === 1 ? '' : 's'}
              {when === 'late' && ' · late only'}
              {when === 'week' && ' · due in the next 7 days'}
              <button onClick={clearFilters} className="rounded-md px-1.5 py-0.5 text-indigo-300 transition hover:bg-indigo-500/10">
                Show all
              </button>
            </p>
          )}
        </div>
      )}

      {view === 'board' || school.tasks.length === 0 ? (
        <Board school={school} tasks={shown} today={today} sort={sort} filtering={filtering} />
      ) : (
        <ListView school={school} tasks={shown} today={today} isOpen={isOpen} />
      )}

      {managing && <SubjectsModal onClose={() => setManaging(false)} />}
    </div>
  )
}

function Stat({ icon: Icon, label, value, hint, tone, on, onClick }: {
  icon: typeof Plus
  label: string
  value: number
  hint: string
  tone?: 'rose' | 'amber' | 'teal'
  on?: boolean
  onClick?: () => void
}) {
  const color = tone === 'rose' ? 'text-rose-300' : tone === 'amber' ? 'text-amber-200' : tone === 'teal' ? 'text-teal-300' : 'text-zinc-400'
  const inner = (
    <>
      <span className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="mt-1 block text-2xl font-bold tabular-nums tracking-tight text-white">{value}</span>
      <span className="block truncate text-[11px] text-zinc-500">{on ? 'Showing only these · tap to undo' : hint}</span>
    </>
  )
  const cls = `rounded-xl border p-3 text-left transition ${on ? 'border-indigo-400/50 bg-indigo-500/10' : 'border-white/[0.06] bg-black/20'}`
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={on} className={`${cls} hover:border-white/20 active:scale-[0.98]`}>
      {inner}
    </button>
  ) : (
    <div className={cls}>{inner}</div>
  )
}

function FilterChip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
        on ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function Welcome() {
  const tips = [
    { icon: BookOpen, title: 'Type a subject once', text: 'It’s saved for next time. Star the classes you take now.' },
    { icon: MousePointerClick, title: 'Drag cards across', text: 'From Not started to In progress to Done. Hold to drag on a phone.' },
    { icon: RotateCcw, title: 'Done starts fresh on Sunday', text: 'Last week’s finished tasks move to Done earlier by themselves.' },
  ]
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">Your school board is ready</h3>
          <p className="mt-0.5 text-sm text-zinc-400">Add a task with just its subject, what to do, and when it’s due. Rename or add columns any time.</p>
        </div>
        <button
          onClick={() => newTask()}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add your first task
        </button>
      </div>
      <ol className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {tips.map((t) => (
          <li key={t.title} className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
            <span>
              <span className="block text-sm font-medium text-zinc-200">{t.title}</span>
              <span className="block text-xs text-zinc-500">{t.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---- Board ----

type Drop = { column: string; before: string | null }

/** Cards in the order a column shows them. */
function ordered(list: SchoolTask[], role: ColumnRole, sort: Sort) {
  if (sort === 'manual') return list
  if (role === 'open') return [...list].sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt)
  return [...list].sort((a, b) => b.doneAt.localeCompare(a.doneAt) || b.due.localeCompare(a.due))
}

function Board({ school, tasks, today, sort, filtering }: { school: SchoolData; tasks: SchoolTask[]; today: string; sort: Sort; filtering: boolean }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<Drop | null>(null)
  const byColumn = useMemo(() => {
    const m = new Map<string, SchoolTask[]>()
    for (const c of school.columns) m.set(c.id, [])
    for (const t of tasks) m.get(t.column)?.push(t)
    return m
  }, [school.columns, tasks])

  useEffect(() => {
    if (!dragId) setDrop(null)
  }, [dragId])

  function onDrop(column: string, before: string | null) {
    if (!dragId) return
    const t = school.tasks.find((x) => x.id === dragId)
    setDragId(null)
    if (!t) return
    if (t.column === column && sort === 'due') return
    const col = school.columns.find((c) => c.id === column)!
    useStore.getState().changeSchool((s) => moveTask(s, t.id, column, sort === 'manual' ? before : null))
    const wasDone = isDoneRole(school.columns.find((c) => c.id === t.column)?.role ?? 'open')
    if (isDoneRole(col.role) && !wasDone) toast.success(`Done: “${t.title}” 🎉`)
  }

  return (
    <div className="scrollbar-thin -mx-4 overflow-x-auto px-4 pb-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8" style={{ scrollSnapType: 'x proximity' }}>
      <div className="flex w-max items-start gap-3">
        {school.columns.map((c, i) => (
          <Column
            key={c.id}
            school={school}
            column={c}
            index={i}
            tasks={ordered(byColumn.get(c.id) ?? [], c.role, sort)}
            total={school.tasks.filter((t) => t.column === c.id).length}
            today={today}
            sort={sort}
            filtering={filtering}
            dragId={dragId}
            setDragId={setDragId}
            drop={drop?.column === c.id ? drop : null}
            setDrop={setDrop}
            onDrop={onDrop}
          />
        ))}
        <AddColumn school={school} />
      </div>
    </div>
  )
}

function Column({ school, column: c, index, tasks, total, today, sort, filtering, dragId, setDragId, drop, setDrop, onDrop }: {
  school: SchoolData
  column: SchoolColumn
  index: number
  tasks: SchoolTask[]
  total: number
  today: string
  sort: Sort
  filtering: boolean
  dragId: string | null
  setDragId: (id: string | null) => void
  drop: Drop | null
  setDrop: (d: Drop | null) => void
  onDrop: (column: string, before: string | null) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [limit, setLimit] = useState(12)
  const body = useRef<HTMLDivElement>(null)
  const look = tint(c)
  const col = colColor(c)
  const week = c.role === 'week' ? weekLabel(thisWeek(today)) : null
  const shown = c.role === 'done' ? tasks.slice(0, limit) : tasks

  /** The card the pointer is above (the dragged one lands before it), or null for the end. */
  function beforeAt(y: number) {
    const cards = [...(body.current?.querySelectorAll<HTMLElement>('[data-card]') ?? [])]
    for (const el of cards) {
      const r = el.getBoundingClientRect()
      if (y < r.top + r.height / 2) return el.dataset.card!
    }
    return null
  }

  const zone = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      const before = beforeAt(e.clientY)
      if (drop?.before !== before || !drop) setDrop({ column: c.id, before })
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node) && setDrop(null),
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      onDrop(c.id, beforeAt(e.clientY))
    },
  }

  const draggingHere = !!dragId && !!drop
  const line = <span aria-hidden className="block h-0.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)]" />

  return (
    <section
      aria-label={c.name}
      {...zone}
      style={{ scrollSnapAlign: 'start' }}
      className={`flex w-[82vw] max-w-[19rem] shrink-0 flex-col rounded-2xl border p-2 transition-colors sm:w-72 ${look.col} ${
        draggingHere ? 'border-indigo-400/40 ring-2 ring-indigo-400/20' : 'border-white/[0.05]'
      }`}
    >
      {/* Header */}
      <div className="group/col flex items-center gap-2 px-1 pb-2 pt-0.5">
        {renaming ? (
          <RenameBox
            value={c.name}
            onDone={(name) => {
              setRenaming(false)
              if (name) useStore.getState().changeSchool((s) => updateColumn(s, c.id, { name }))
            }}
          />
        ) : (
          <button
            type="button"
            onDoubleClick={() => setRenaming(true)}
            onClick={() => setRenaming(true)}
            title="Click to rename"
            className={`inline-flex h-7 min-w-0 max-w-full items-center gap-1.5 rounded-full px-2.5 text-[13px] font-medium transition hover:brightness-125 ${look.pill}`}
          >
            <span className={`h-2 w-2 shrink-0 rounded-full ${col.bar}`} />
            <span className="truncate">{c.name}</span>
            {week && <span className="shrink-0 opacity-75">({week})</span>}
          </button>
        )}
        {!renaming && <span className={`text-sm tabular-nums ${col.text}`}>{filtering && tasks.length !== total ? `${tasks.length}/${total}` : total}</span>}
        <span className="flex-1" />
        {!renaming && (
          <>
            {c.role !== 'done' && (
              <button
                onClick={() => newTask(c.id)}
                aria-label={`New task in ${c.name}`}
                title={`New task in ${c.name}`}
                className="grid h-7 w-7 place-items-center rounded-lg text-zinc-500 opacity-100 transition hover:bg-white/[0.07] hover:text-white sm:opacity-0 sm:group-hover/col:opacity-100 sm:focus-visible:opacity-100"
              >
                <Plus className="h-4 w-4" />
              </button>
            )}
            <ColumnMenu school={school} column={c} index={index} count={total} onRename={() => setRenaming(true)} />
          </>
        )}
      </div>

      {/* Cards */}
      <div ref={body} className="flex min-h-[3rem] flex-col gap-2">
        {shown.map((t) => (
          <div key={t.id} data-card={t.id} className="flex flex-col gap-2">
            {sort === 'manual' && drop?.before === t.id && dragId !== t.id && line}
            <Card task={t} school={school} role={c.role} today={today} dragging={dragId === t.id} onDragStart={() => setDragId(t.id)} onDragEnd={() => setDragId(null)} />
          </div>
        ))}
        {sort === 'manual' && drop && drop.before === null && line}
        {tasks.length === 0 && (
          <p className={`rounded-xl border border-dashed px-3 py-4 text-center text-xs transition ${draggingHere ? 'border-indigo-400/50 text-indigo-200' : 'border-white/[0.08] text-zinc-600'}`}>
            {draggingHere ? 'Drop here' : filtering && total ? 'None match' : c.role === 'week' ? 'Finish something this week ✨' : c.role === 'done' ? 'Earlier weeks land here' : 'Nothing here'}
          </p>
        )}
        {c.role === 'done' && tasks.length > limit && (
          <button onClick={() => setLimit((n) => n + 24)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
            <ChevronDown className="h-3.5 w-3.5" /> Show {Math.min(24, tasks.length - limit)} more
          </button>
        )}
        {c.role !== 'done' && (
          <button
            onClick={() => newTask(c.id)}
            className="flex h-10 items-center gap-2 rounded-xl px-3 text-sm text-zinc-500 transition hover:bg-white/[0.05] hover:text-zinc-200"
          >
            <Plus className="h-4 w-4" /> New task
          </button>
        )}
      </div>
    </section>
  )
}

function Card({ task: t, school, role, today, dragging, onDragStart, onDragEnd }: {
  task: SchoolTask
  school: SchoolData
  role: ColumnRole
  today: string
  dragging: boolean
  onDragStart: () => void
  onDragEnd: () => void
}) {
  const done = isDoneRole(role)
  const due = dueInfo(t.due, today, done)
  const col = school.columns.find((c) => c.id === t.column)!
  const look = tint(col)

  return (
    <article
      draggable
      tabIndex={0}
      role="button"
      aria-label={`${t.subject}: ${t.title}, ${done ? 'done' : due.label}`}
      onClick={() => openTask(t.id)}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return
        if (e.key === 'Enter') openTask(t.id)
        if (e.key === ' ') {
          e.preventDefault()
          tick(t.id)
        }
      }}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', t.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      className={`group/card relative cursor-pointer select-none rounded-xl border p-3 shadow-sm shadow-black/20 outline-none transition hover:-translate-y-px hover:shadow-md focus-visible:ring-2 focus-visible:ring-indigo-400/60 active:cursor-grabbing ${look.card} ${
        dragging ? 'scale-[0.98] opacity-40' : ''
      }`}
    >
      <div className="flex items-start gap-2.5">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            tick(t.id)
          }}
          aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
          title={done ? 'Not done after all' : 'Mark done'}
          className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border transition active:scale-90 ${
            done ? 'border-teal-400 bg-teal-400 text-[#06120f]' : 'border-white/20 text-transparent hover:border-teal-300 hover:text-teal-300'
          }`}
        >
          <Check className="h-3 w-3" strokeWidth={3.2} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${subjectDot(school, t.subject)}`} />
            <span className="truncate">{t.subject}</span>
          </p>
          <p className={`mt-0.5 break-words text-[15px] font-semibold leading-snug ${done ? 'text-zinc-300' : 'text-white'}`}>{t.title}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
            <span className="inline-flex items-center gap-1 text-zinc-400">
              <CalendarDays className="h-3.5 w-3.5" /> {shortDate(t.due)}
            </span>
            {done ? (
              t.doneAt && <span className="text-teal-300/80">Done {t.doneAt === today ? 'today' : shortDate(t.doneAt).replace(/^\w+, /, '')}</span>
            ) : (
              <span className={`rounded-full px-1.5 py-0.5 font-medium ${DUE_TONE[due.tone]}`}>{due.label}</span>
            )}
          </div>
          {t.notes && (
            <p className="mt-2 flex gap-1.5 text-xs leading-relaxed text-zinc-500">
              <StickyNote className="mt-0.5 h-3 w-3 shrink-0" />
              <span className="line-clamp-2 whitespace-pre-line">{t.notes}</span>
            </p>
          )}
        </div>
      </div>
    </article>
  )
}

function RenameBox({ value, onDone }: { value: string; onDone: (name: string | null) => void }) {
  const [name, setName] = useState(value)
  return (
    <input
      value={name}
      autoFocus
      maxLength={MAX_COLUMN}
      aria-label="Column name"
      onFocus={(e) => e.currentTarget.select()}
      onChange={(e) => setName(e.target.value)}
      onBlur={() => onDone(name.trim() && name.trim() !== value ? name.trim() : null)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
        if (e.key === 'Escape') {
          e.stopPropagation()
          setName(value)
          onDone(null)
        }
      }}
      className="h-8 min-w-0 flex-1 rounded-lg border border-indigo-400/50 bg-black/40 px-2.5 text-sm font-medium text-white outline-none ring-2 ring-indigo-500/20"
    />
  )
}

const ROLE_ABOUT: Record<ColumnRole, string> = {
  open: 'Tasks still to do.',
  week: 'What you finished this week, Sunday to Saturday. Every Sunday it moves to your earlier column and starts fresh.',
  done: 'Everything finished before this week. It fills up by itself every Sunday.',
}

/** A column's ⋯ menu: rename, colour, move, delete. */
function ColumnMenu({ school, column: c, index, count, onRename }: { school: SchoolData; column: SchoolColumn; index: number; count: number; onRename: () => void }) {
  const [open, setOpen] = useState(false)
  const [sure, setSure] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })
  const change = useStore.getState().changeSchool
  const last = school.columns.length <= 1
  const left = school.columns.filter((x) => x.id !== c.id)
  const moveTo = left[Math.max(0, index - 1)]

  useLayoutEffect(() => {
    if (!open || !btn.current || !box.current) return
    const r = btn.current.getBoundingClientRect()
    const w = box.current.offsetWidth
    const h = box.current.offsetHeight
    setPos({
      left: Math.max(8, Math.min(r.right - w, window.innerWidth - w - 8)),
      top: r.bottom + 6 + h > window.innerHeight - 8 ? Math.max(8, r.top - h - 6) : r.bottom + 6,
    })
  }, [open])

  useEffect(() => {
    if (!open) return setSure(false)
    const outside = (e: Event) => !box.current?.contains(e.target as Node) && !btn.current?.contains(e.target as Node) && setOpen(false)
    const key = (e: KeyboardEvent) => e.key === 'Escape' && (setOpen(false), btn.current?.focus())
    const away = () => setOpen(false)
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('keydown', key)
    window.addEventListener('resize', away)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('resize', away)
    }
  }, [open])

  function remove() {
    if (count && !sure) return setSure(true)
    const before = useStore.getState().school
    change((s) => removeColumn(s, c.id))
    setOpen(false)
    toast.undo(count ? `Deleted “${c.name}”. Its ${count} task${count === 1 ? '' : 's'} moved to “${moveTo.name}”.` : `Deleted “${c.name}”.`, () =>
      useStore.getState().changeSchool(() => before),
    )
  }

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-200 outline-none transition hover:bg-white/[0.07] focus-visible:bg-white/[0.07] disabled:opacity-35 disabled:hover:bg-transparent'

  return (
    <>
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        aria-label={`${c.name} options`}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/[0.07] hover:text-white ${open ? 'bg-white/[0.07] text-white' : 'text-zinc-500'}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open &&
        createPortal(
          <div
            ref={box}
            role="menu"
            style={pos}
            className="animate-menu fixed z-[60] w-64 rounded-2xl border border-white/10 bg-[#12141b]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl"
          >
            <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-snug text-zinc-500">{ROLE_ABOUT[c.role]}</p>
            <button role="menuitem" className={item} onClick={() => (setOpen(false), onRename())}>
              <Settings2 className="h-4 w-4 text-zinc-400" /> Rename
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <p className="px-2.5 pt-1 text-[11px] font-medium text-zinc-500">Colour</p>
            <ColorRow value={c.color} onChange={(color) => change((s) => updateColumn(s, c.id, { color }))} />
            <div className="my-1 border-t border-white/[0.06]" />
            <button role="menuitem" className={item} disabled={index === 0} onClick={() => change((s) => moveColumn(s, c.id, index - 1))}>
              <ArrowLeft className="h-4 w-4 text-zinc-400" /> Move left
            </button>
            <button role="menuitem" className={item} disabled={index === school.columns.length - 1} onClick={() => change((s) => moveColumn(s, c.id, index + 1))}>
              <ArrowRight className="h-4 w-4 text-zinc-400" /> Move right
            </button>
            <div className="my-1 border-t border-white/[0.06]" />
            <button
              role="menuitem"
              className={`${item} ${sure ? 'bg-red-500/15 text-red-200 hover:bg-red-500/20' : 'hover:bg-red-500/10 hover:text-red-200'}`}
              disabled={last}
              title={last ? 'The board needs at least one column' : undefined}
              onClick={remove}
            >
              <Trash2 className="h-4 w-4" />
              {sure ? `Delete? ${count} task${count === 1 ? '' : 's'} go to “${moveTo.name}”` : 'Delete column'}
            </button>
          </div>,
          document.body,
        )}
    </>
  )
}

/** The last spot on the board: add a column (and put back the Done columns, if they were deleted). */
function AddColumn({ school }: { school: SchoolData }) {
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const change = useStore.getState().changeSchool
  const hasWeek = school.columns.some((c) => c.role === 'week')
  const hasDone = school.columns.some((c) => c.role === 'done')

  function add(role: ColumnRole = 'open', label = name) {
    change((s) => addColumn(s, label, role).school)
    setName('')
    setAdding(role === 'open')
  }

  return (
    <div className="w-[82vw] max-w-[19rem] shrink-0 space-y-2 sm:w-64" style={{ scrollSnapAlign: 'start' }}>
      {adding ? (
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (name.trim()) add()
          }}
          className="animate-fade space-y-2 rounded-2xl border border-white/[0.08] bg-white/[0.025] p-2"
        >
          <input
            value={name}
            autoFocus
            maxLength={MAX_COLUMN}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), setAdding(false), setName(''))}
            placeholder="Column name, e.g. Waiting on group"
            aria-label="New column name"
            className="h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />
          <div className="flex gap-1.5">
            <button disabled={!name.trim()} className="h-9 flex-1 rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
              Add column
            </button>
            <button type="button" onClick={() => (setAdding(false), setName(''))} className="h-9 rounded-xl px-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
              Cancel
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setAdding(true)}
          className="flex h-12 w-full items-center gap-2 rounded-2xl border border-dashed border-white/10 px-4 text-sm text-zinc-500 transition hover:border-white/25 hover:bg-white/[0.02] hover:text-zinc-200"
        >
          <Plus className="h-4 w-4" /> Add column
        </button>
      )}
      {!hasWeek && (
        <button onClick={() => add('week', 'Done')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200">
          <RotateCcw className="h-3.5 w-3.5" /> Put back “Done this week”
        </button>
      )}
      {!hasDone && (
        <button onClick={() => add('done', 'Done earlier')} className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200">
          <RotateCcw className="h-3.5 w-3.5" /> Put back “Done earlier”
        </button>
      )}
    </div>
  )
}

// ---- List ----

/** Everything by when it's due: late first, then today, tomorrow, this week, later. Done this week at the bottom. */
function ListView({ school, tasks, today, isOpen }: { school: SchoolData; tasks: SchoolTask[]; today: string; isOpen: (t: SchoolTask) => boolean }) {
  const [showDone, setShowDone] = useState(false)
  const week = thisWeek(today)
  const groups = useMemo(() => {
    const open = tasks.filter(isOpen).sort((a, b) => a.due.localeCompare(b.due) || a.createdAt - b.createdAt)
    const g = [
      { id: 'late', title: 'Late', tone: 'text-rose-300', list: open.filter((t) => t.due < today) },
      { id: 'today', title: 'Today', tone: 'text-amber-200', list: open.filter((t) => t.due === today) },
      { id: 'tomorrow', title: 'Tomorrow', tone: 'text-zinc-200', list: open.filter((t) => t.due === addDays(today, 1)) },
      { id: 'week', title: 'Next few days', tone: 'text-zinc-300', list: open.filter((t) => t.due > addDays(today, 1) && t.due <= addDays(today, 6)) },
      { id: 'later', title: 'Later', tone: 'text-zinc-400', list: open.filter((t) => t.due > addDays(today, 6)) },
    ]
    return g.filter((x) => x.list.length)
  }, [tasks, isOpen, today])
  const doneWeek = useMemo(() => tasks.filter((t) => !isOpen(t) && t.doneAt >= week.start).sort((a, b) => b.doneAt.localeCompare(a.doneAt)), [tasks, isOpen, week.start])

  if (!groups.length && !doneWeek.length)
    return (
      <p className={`${card} px-4 py-10 text-center text-sm text-zinc-500`}>
        Nothing to show here. {tasks.length ? '' : 'Clear the filters to see everything.'}
      </p>
    )

  return (
    <div className="space-y-4">
      {groups.length === 0 && (
        <p className={`${card} flex items-center justify-center gap-2 px-4 py-6 text-sm text-teal-200`}>
          <CheckCheck className="h-4 w-4" /> All caught up. Nothing left to do.
        </p>
      )}
      {groups.map((g) => (
        <section key={g.id} className={`${card} overflow-hidden`}>
          <h3 className={`flex items-center gap-2 border-b border-white/[0.05] px-4 py-2.5 text-sm font-semibold ${g.tone}`}>
            {g.title} <span className="text-xs font-normal tabular-nums text-zinc-500">{g.list.length}</span>
          </h3>
          <ul className="divide-y divide-white/[0.04]">
            {g.list.map((t) => (
              <Row key={t.id} task={t} school={school} today={today} />
            ))}
          </ul>
        </section>
      ))}
      {doneWeek.length > 0 && (
        <section className={`${card} overflow-hidden`}>
          <button onClick={() => setShowDone((o) => !o)} aria-expanded={showDone} className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-teal-300 transition hover:bg-white/[0.02]">
            <CheckCheck className="h-4 w-4" /> Done this week <span className="text-xs font-normal text-zinc-500">({weekLabel(week)}) · {doneWeek.length}</span>
            <ChevronDown className={`ml-auto h-4 w-4 text-zinc-500 transition-transform duration-200 ${showDone ? 'rotate-180' : ''}`} />
          </button>
          <div className={`grid transition-all duration-300 ease-out ${showDone ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!showDone}>
            <ul className="min-h-0 divide-y divide-white/[0.04] overflow-hidden border-t border-white/[0.05]">
              {doneWeek.map((t) => (
                <Row key={t.id} task={t} school={school} today={today} done />
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  )
}

function Row({ task: t, school, today, done }: { task: SchoolTask; school: SchoolData; today: string; done?: boolean }) {
  const due = dueInfo(t.due, today, done)
  const col = school.columns.find((c) => c.id === t.column)
  return (
    <li className="group flex items-center gap-3 px-3 py-2.5 transition hover:bg-white/[0.025] sm:px-4">
      <button
        type="button"
        onClick={() => tick(t.id)}
        aria-label={done ? `Mark “${t.title}” not done` : `Mark “${t.title}” done`}
        className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border transition active:scale-90 ${
          done ? 'border-teal-400 bg-teal-400 text-[#06120f]' : 'border-white/20 text-transparent hover:border-teal-300 hover:text-teal-300'
        }`}
      >
        <Check className="h-3 w-3" strokeWidth={3.2} />
      </button>
      <button type="button" onClick={() => openTask(t.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${done ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100'}`}>{t.title}</span>
          <span className="flex items-center gap-1.5 text-xs text-zinc-500">
            <span className={`h-1.5 w-1.5 rounded-full ${subjectDot(school, t.subject)}`} /> {t.subject}
            {col && !done && col.role === 'open' && (
              <>
                <span className="text-zinc-700">·</span> {col.name}
              </>
            )}
            {t.notes && <StickyNote className="ml-0.5 h-3 w-3" aria-label="Has notes" />}
          </span>
        </span>
        <span className="hidden shrink-0 text-xs text-zinc-500 sm:block">{shortDate(t.due)}</span>
        {!done && <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${DUE_TONE[due.tone]}`}>{due.label}</span>}
      </button>
    </li>
  )
}
