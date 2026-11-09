import { useMemo, useRef, useState, type ReactNode, type RefObject } from 'react'
import { BookOpen, CalendarDays, ChevronDown, NotebookPen, PenLine, Settings2, Star, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { addDays, longDate, todayKey } from '../lib/expenses'
import {
  MAX_NOTES, MAX_SUBJECT, MAX_TITLE, addTask, colColor, dueInfo, findSubject, isDoneRole, shortDate, subjectOptions, updateSubject, updateTask,
  type SchoolTask,
} from '../lib/school'
import { KIND_COLORS } from '../lib/meta'
import { Calendar } from './Calendar'
import { Modal } from './Modal'
import { SubjectsModal } from './SchoolSubjects'
import { toast } from '../toast'

const field =
  'h-11 w-full rounded-xl border bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm'

type Props = { editId?: string; column?: string; due?: string; subject?: string }

/** Add or edit a School task. The subject, the task's name and its due date are needed; notes are optional. */
export function SchoolTaskModal({ editId, column: startColumn, due: startDue, subject: startSubject }: Props) {
  const editing = useStore((s) => (editId ? s.school.tasks.find((t) => t.id === editId) : undefined))
  const columns = useStore((s) => s.school.columns)
  const close = useStore((s) => s.closeModal)
  const firstOpen = columns.find((c) => c.role === 'open') ?? columns[0]

  const [subject, setSubject] = useState(editing?.subject ?? startSubject ?? '')
  const [title, setTitle] = useState(editing?.title ?? '')
  const [due, setDue] = useState(editing?.due ?? startDue ?? '')
  const [column, setColumn] = useState(editing?.column ?? (columns.some((c) => c.id === startColumn) ? startColumn! : firstOpen.id))
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  const [calOpen, setCalOpen] = useState(false)
  const [tried, setTried] = useState(false)
  const [added, setAdded] = useState(0)
  const [managing, setManaging] = useState(false)
  const subjectBox = useRef<HTMLInputElement>(null)
  const titleBox = useRef<HTMLInputElement>(null)
  const dueBox = useRef<HTMLDivElement>(null)

  const missing = { subject: !subject.trim(), title: !title.trim(), due: !due }
  const ok = !missing.subject && !missing.title && !missing.due
  const today = todayKey()

  function save(again: boolean) {
    if (!ok) {
      setTried(true)
      if (missing.subject) subjectBox.current?.focus()
      else if (missing.title) titleBox.current?.focus()
      else {
        setCalOpen(true)
        dueBox.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
      }
      return toast.error(`Add ${[missing.subject && 'the subject', missing.title && 'the task', missing.due && 'the due date'].filter(Boolean).join(', ').replace(/, ([^,]*)$/, ' and $1')}.`)
    }
    const data = { subject, title, due, notes: notesOpen ? notes : '', column }
    const s = useStore.getState()
    if (editing) {
      s.changeSchool((sc) => updateTask(sc, editing.id, data))
      toast.success('Task updated.')
      return close()
    }
    s.changeSchool((sc) => addTask(sc, data).school)
    const when = due === today ? 'due today' : due === addDays(today, 1) ? 'due tomorrow' : `due ${shortDate(due)}`
    toast.success(`Added “${title.trim()}” · ${subject.trim()} · ${when}.`)
    if (!again) return close()
    // Ready for the next one: same subject, due date and column (homework often comes in batches).
    setTitle('')
    setNotes('')
    setNotesOpen(false)
    setTried(false)
    setAdded((n) => n + 1)
    requestAnimationFrame(() => titleBox.current?.focus())
  }

  function remove() {
    if (!editing) return
    const gone: SchoolTask = editing
    useStore.getState().changeSchool((sc) => ({ ...sc, tasks: sc.tasks.filter((t) => t.id !== gone.id) }))
    close()
    toast.undo(`Deleted “${gone.title}”.`, () =>
      useStore.getState().changeSchool((sc) =>
        sc.tasks.some((t) => t.id === gone.id) ? sc : { ...sc, tasks: [...sc.tasks, sc.columns.some((c) => c.id === gone.column) ? gone : { ...gone, column: sc.columns[0].id }] },
      ),
    )
  }

  // Days that already have something due, as dots on the calendar (to spread work out).
  const tasks = useStore((s) => s.school.tasks)
  const marks = useMemo(() => {
    const n = new Map<string, number>()
    for (const t of tasks) if (t.id !== editId && !t.doneAt) n.set(t.due, (n.get(t.due) ?? 0) + 1)
    return new Map([...n].map(([k, v]) => [k, `${v} due`]))
  }, [tasks, editId])

  const quick = [
    { label: 'Today', day: today },
    { label: 'Tomorrow', day: addDays(today, 1) },
    { label: 'In a week', day: addDays(today, 7) },
  ]
  const custom = !!due && !quick.some((q) => q.day === due)

  const dueChips = (
    <div className="flex flex-wrap gap-1.5">
      {quick.map((q) => (
        <Chip key={q.label} on={due === q.day} onClick={() => setDue(q.day)}>
          {q.label}
        </Chip>
      ))}
    </div>
  )

  return (
    <>
      <Modal
        title={editing ? 'Edit task' : 'New school task'}
        subtitle={added > 0 ? `${added} added · keep going, or close when done` : editing ? `${editing.subject} · ${shortDate(editing.due)}` : 'Subject, task and due date are all you need'}
        onClose={close}
        width="max-w-3xl"
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <button
                onClick={remove}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 sm:h-10"
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <span className="hidden flex-1 text-xs text-zinc-600 sm:block">{!editing && 'Ctrl + Enter to add'}</span>
            <span className="flex-1 sm:hidden" />
            {!editing && (
              <button
                onClick={() => save(true)}
                className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 sm:h-10"
              >
                Save &amp; add another
              </button>
            )}
            <button
              onClick={() => save(false)}
              className={`h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:h-10 ${ok ? '' : 'opacity-60 shadow-none'}`}
            >
              {editing ? 'Save' : 'Add task'}
            </button>
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_19rem] sm:gap-6" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save(false)}>
          <div className="min-w-0 space-y-5">
            <SubjectField value={subject} onChange={setSubject} inputRef={subjectBox} error={tried && missing.subject} autoFocus={!editing && !startSubject} onManage={() => setManaging(true)} />

            <Section label="Task" required error={tried && missing.title ? 'What do you need to do?' : undefined}>
              <div className="relative">
                <PenLine className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                <input
                  ref={titleBox}
                  value={title}
                  autoFocus={!editing && !!startSubject}
                  maxLength={MAX_TITLE}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !e.ctrlKey && !e.metaKey && save(false)}
                  placeholder="e.g. Problem set 3, Essay draft, Quiz review"
                  className={`${field} pl-9 ${tried && missing.title ? 'border-rose-400/60' : 'border-white/10'}`}
                />
              </div>
            </Section>

            {/* Due (phones: chips, and a row that unfolds the calendar) */}
            <div className="sm:hidden" ref={dueBox}>
              <Section label="Due" required error={tried && missing.due ? 'Pick the day it’s due.' : undefined}>
                <div className="flex flex-wrap gap-1.5">
                  {dueChips}
                  <button
                    type="button"
                    onClick={() => setCalOpen((o) => !o)}
                    aria-expanded={calOpen}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                      custom ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : tried && missing.due ? 'border-rose-400/60 text-rose-200' : 'border-white/10 text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {custom ? shortDate(due) : 'Pick a day'}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${calOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className={`grid transition-all duration-300 ease-out ${calOpen ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!calOpen}>
                  <div className="min-h-0 overflow-hidden">
                    <Calendar value={due} onChange={(d) => (setDue(d), setCalOpen(false))} marks={marks} />
                  </div>
                </div>
                {due && <DueLine due={due} />}
              </Section>
            </div>

            <Section label="Status" required>
              <div className="flex flex-wrap gap-1.5">
                {columns.map((c) => {
                  const col = colColor(c)
                  const on = column === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      aria-pressed={on}
                      onClick={() => setColumn(c.id)}
                      className={`inline-flex h-9 items-center gap-2 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
                        on ? `${col.soft} border-transparent text-white ring-1 ${col.ring}` : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
                      }`}
                    >
                      <span className={`h-2 w-2 rounded-full ${col.bar}`} /> {c.name}
                    </button>
                  )
                })}
              </div>
              {isDoneRole(columns.find((c) => c.id === column)?.role ?? 'open') && !editing?.doneAt && (
                <p className="mt-2 text-xs text-zinc-500">It’ll be marked done today.</p>
              )}
            </Section>

            {notesOpen ? (
              <Section label="Notes" onClear={() => (setNotes(''), setNotesOpen(false))}>
                <textarea
                  value={notes}
                  autoFocus={!editing?.notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  maxLength={MAX_NOTES}
                  placeholder="Instructions, pages to read, links, who’s in your group…"
                  className="block min-h-[5rem] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-base text-zinc-100 outline-none transition [field-sizing:content] placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
                />
              </Section>
            ) : (
              <button type="button" onClick={() => setNotesOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-zinc-500 transition hover:text-zinc-200">
                <NotebookPen className="h-4 w-4" /> Add notes
              </button>
            )}
          </div>

          {/* Due (wider screens: the calendar is always showing) */}
          <div className="hidden sm:block">
            <Section label="Due" required error={tried && missing.due ? 'Pick the day it’s due.' : undefined}>
              <div className="mb-2">{dueChips}</div>
              <div className={`rounded-2xl transition ${tried && missing.due ? 'ring-1 ring-rose-400/50' : ''}`}>
                <Calendar value={due} onChange={setDue} marks={marks} />
              </div>
              {due ? <DueLine due={due} center /> : <p className="mt-2 text-center text-xs text-zinc-500">Pick the day it’s due</p>}
            </Section>
          </div>
        </div>
      </Modal>
      {managing && <SubjectsModal onClose={() => setManaging(false)} onPick={(n) => (setSubject(n), setManaging(false))} />}
    </>
  )
}

function DueLine({ due, center }: { due: string; center?: boolean }) {
  const d = dueInfo(due)
  const tone = d.tone === 'late' ? 'text-rose-300' : d.tone === 'today' ? 'text-amber-200' : 'text-zinc-400'
  return (
    <p className={`mt-2 text-xs ${center ? 'text-center' : ''}`}>
      <span className="text-zinc-500">{longDate(due)}</span> · <span className={tone}>{d.label}</span>
    </p>
  )
}

/** The subject: type a new one, or tap a starred or recent one. The star keeps it at the front for next time. */
function SubjectField({ value, onChange, inputRef, error, autoFocus, onManage }: {
  value: string
  onChange: (v: string) => void
  inputRef: RefObject<HTMLInputElement | null>
  error: boolean
  autoFocus: boolean
  onManage: () => void
}) {
  const school = useStore((s) => s.school)
  const q = value.trim().toLowerCase()
  const known = findSubject(school, value)
  const options = useMemo(() => subjectOptions(school).filter((x) => x.name.toLowerCase() !== q && (!q || known || x.name.toLowerCase().includes(q))), [school, q, known])
  const favs = options.filter((o) => o.fav)
  const rest = options.filter((o) => !o.fav).slice(0, 10)

  function toggleFav() {
    const name = value.trim()
    const fav = !known?.fav
    useStore.getState().changeSchool((s) => updateSubject(s, name, { fav }))
    toast.success(fav ? `Starred “${name}”: it’ll be first next time.` : `Unstarred “${name}”.`)
  }

  const dot = known ? (KIND_COLORS[known.color] ?? KIND_COLORS.slate).bar : 'bg-zinc-600'

  return (
    <Section label="Subject" required error={error ? 'Which class is it for?' : undefined}>
      <div className="relative">
        {q ? <span className={`pointer-events-none absolute left-3.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${dot}`} /> : <BookOpen className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />}
        <input
          ref={inputRef}
          value={value}
          autoFocus={autoFocus}
          maxLength={MAX_SUBJECT}
          onChange={(e) => onChange(e.target.value)}
          placeholder="e.g. CSALGCM, Calculus, History"
          className={`${field} pl-9 pr-11 ${error ? 'border-rose-400/60' : 'border-white/10'}`}
        />
        {q && (
          <button
            type="button"
            onClick={toggleFav}
            aria-pressed={!!known?.fav}
            title={known?.fav ? 'Starred · tap to unstar' : 'Star this subject so it comes first'}
            aria-label={known?.fav ? 'Unstar subject' : 'Star subject'}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg transition hover:bg-white/[0.06] active:scale-90"
          >
            <Star className={`h-4 w-4 transition ${known?.fav ? 'fill-amber-300 text-amber-300' : 'text-zinc-500'}`} />
          </button>
        )}
      </div>
      {q && !known && <p className="animate-fade mt-1.5 text-xs text-zinc-500">New subject · it’ll be saved for next time.</p>}
      <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
        {[...favs, ...rest].map((o) => {
          const c = KIND_COLORS[o.color] ?? KIND_COLORS.slate
          return (
            <button
              key={o.name}
              type="button"
              onClick={() => onChange(o.name)}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
                o.fav ? 'border-amber-300/25 bg-amber-300/[0.06] text-amber-50 hover:border-amber-300/50' : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/25 hover:text-white'
              }`}
            >
              {o.fav ? <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> : <span className={`h-2 w-2 rounded-full ${c.bar}`} />}
              {o.name}
            </button>
          )
        })}
        <button
          type="button"
          onClick={onManage}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 text-xs text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
        >
          <Settings2 className="h-3 w-3" /> {school.subjects.length ? 'Your subjects' : 'Add your subjects'}
        </button>
      </div>
    </Section>
  )
}

function Section({ label, required, error, onClear, children }: { label: string; required?: boolean; error?: string; onClear?: () => void; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400">
          {label}
          {!required && !onClear && <span className="ml-1.5 font-normal text-zinc-600">optional</span>}
        </span>
        {error && <span className="animate-fade text-xs text-rose-300">{error}</span>}
        {onClear && (
          <button type="button" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`} className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
        on ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
