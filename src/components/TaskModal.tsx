import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarClock, CalendarDays, ChevronDown, CircleSlash, NotebookPen, Plus, Repeat, Trash2, X } from 'lucide-react'
import { useStore, type ModalState } from '../store'
import { WEEKDAYS, addDays, dayLabel, fromKey, longDate, todayKey } from '../lib/expenses'
import {
  DAY_MINUTES, EVERY_DAY, MAX_TASK_TITLE, SNAP, WEEKDAYS_ONLY, WEEKENDS, fmtDuration, fmtTime, fromTimeInput, nowMinutes, occurrencesIn, repeatLabel,
  taskColor, taskIcon, toTimeInput,
} from '../lib/tasks'
import { MONTHS_SHORT } from '../lib/time'
import { Calendar } from './Calendar'
import { Modal } from './Modal'
import { toast } from '../toast'

type Props = Extract<NonNullable<ModalState>, { type: 'task' }>
type When = 'none' | 'date' | 'repeat'

const field =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm'
const LAST_KIND = 'obseszion-last-task-kind'
const DURATIONS = [15, 30, 60, 90, 120, 180]

const readLastKind = () => {
  try {
    return localStorage.getItem(LAST_KIND)
  } catch {
    return null
  }
}

/** The next full hour from now (or 9 AM when that's past the end of the day). */
const nextHour = () => {
  const h = Math.ceil((nowMinutes() + 1) / 60) * 60
  return h > DAY_MINUTES - 60 ? 9 * 60 : h
}

/** Add or edit a task: what it is, what it's for, and whether it has a deadline or repeats. */
export function TaskModal({ editId, date: startDate, start: startAt, duration: startDuration, kind: startKind, title: startTitle }: Props) {
  const editing = useStore((s) => (editId ? s.tasks.find((t) => t.id === editId) : undefined))
  const kinds = useStore((s) => s.taskKinds)
  const close = useStore((s) => s.closeModal)
  const today = todayKey()

  const firstKind = () => {
    const want = editing?.kind ?? startKind ?? readLastKind()
    return kinds.some((k) => k.id === want) ? want! : kinds[0].id
  }
  const [title, setTitle] = useState(editing?.title ?? startTitle ?? '')
  const [kind, setKind] = useState(firstKind)
  const [when, setWhen] = useState<When>(editing ? (editing.repeat ? 'repeat' : editing.date ? 'date' : 'none') : startDate ? 'date' : 'none')
  const [date, setDate] = useState(editing?.date || startDate || today)
  const [allDay, setAllDay] = useState(editing ? editing.date !== '' && editing.start === null : startAt === null)
  const [start, setStart] = useState(editing?.start ?? startAt ?? nextHour())
  const [duration, setDuration] = useState(editing?.start != null ? editing.duration : (startDuration ?? 60))
  const [days, setDays] = useState<number[]>(editing?.repeat?.days ?? [fromKey(startDate || today).getDay()])
  const [until, setUntil] = useState(editing?.repeat?.until ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  const [calOpen, setCalOpen] = useState(false)
  const titleBox = useRef<HTMLInputElement>(null)

  const end = Math.min(DAY_MINUTES, start + duration)
  const ok = title.trim().length > 0 && (when !== 'repeat' || days.length > 0)

  function save() {
    if (!title.trim()) {
      titleBox.current?.focus()
      return toast.error('Say what the task is first.')
    }
    if (when === 'repeat' && !days.length) return toast.error('Pick at least one day it repeats on.')
    const data = {
      title,
      kind,
      notes: notesOpen ? notes : '',
      date: when === 'none' ? '' : date,
      start: when === 'none' || allDay ? null : start,
      duration,
      repeat: when === 'repeat' ? { days, until } : null,
    }
    const s = useStore.getState()
    try {
      localStorage.setItem(LAST_KIND, kind)
    } catch {
      // Not remembered; fine.
    }
    if (editing) {
      s.updateTask(editing.id, data)
      toast.success('Task updated.')
    } else {
      s.addTask(data)
      const at = when === 'none' ? '' : allDay ? ` · ${dayLabel(date)}` : ` · ${dayLabel(date)}, ${fmtTime(start, true)}`
      toast.success(when === 'repeat' ? `Added · ${repeatLabel({ days, until })}${allDay ? '' : `, ${fmtTime(start, true)}`}.` : `Added${at}.`)
    }
    close()
  }

  function remove() {
    if (!editing) return
    const gone = useStore.getState().removeTask(editing.id)
    close()
    if (gone) toast.undo(`Deleted “${gone.title}”.`, () => useStore.getState().restoreTask(gone))
  }

  function setEnd(m: number) {
    // Ending at or before it starts: keep the shortest length instead.
    setDuration(Math.max(SNAP, (m === 0 ? DAY_MINUTES : m) - start))
  }

  function changeStart(m: number) {
    setStart(m)
    setDuration((d) => Math.min(d, DAY_MINUTES - m))
  }

  // Days that already have tasks, as dots on the date picker.
  const tasks = useStore((s) => s.tasks)
  const marks = useMemo(() => {
    const n = new Map<string, number>()
    const from = addDays(today, -60)
    for (const o of occurrencesIn(tasks, from, addDays(today, 400))) if (o.task.id !== editId) n.set(o.day, (n.get(o.day) ?? 0) + 1)
    return new Map([...n].map(([k, v]) => [k, `${v} task${v === 1 ? '' : 's'}`]))
  }, [tasks, today, editId])

  const d = fromKey(date)
  const shortDate = `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${date.slice(0, 4) === today.slice(0, 4) ? '' : `, ${d.getFullYear()}`}`
  const color = taskColor(kinds.find((k) => k.id === kind) ?? kinds[0])

  return (
    <Modal
      title={editing ? 'Edit task' : 'New task'}
      subtitle={when === 'none' ? 'On your to-do list, no deadline' : when === 'repeat' ? `${repeatLabel({ days: days.length ? days : [0], until })}${allDay ? '' : ` · ${fmtTime(start, true)}`}` : `${longDate(date)}${allDay ? '' : ` · ${fmtTime(start)}`}`}
      onClose={close}
      width="max-w-2xl"
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
          <span className="flex-1" />
          <button onClick={close} className="h-11 rounded-xl px-4 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white sm:h-10">
            Cancel
          </button>
          <button
            onClick={save}
            disabled={!ok}
            className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:h-10"
          >
            {editing ? 'Save' : 'Add task'}
          </button>
        </div>
      }
    >
      <div className="space-y-6" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save()}>
        {/* What */}
        <div className="flex items-center gap-3">
          <span className={`h-10 w-1.5 shrink-0 rounded-full ${color.dot}`} aria-hidden />
          <input
            ref={titleBox}
            value={title}
            autoFocus={!editing}
            maxLength={MAX_TASK_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
            placeholder="What do you need to do?"
            aria-label="Task"
            className="h-12 min-w-0 flex-1 bg-transparent text-xl font-semibold text-white outline-none placeholder:font-medium placeholder:text-zinc-600"
          />
        </div>

        {/* What it's for */}
        <Section label="What's it for?">
          <KindPicker value={kind} onChange={setKind} />
        </Section>

        {/* Deadline? */}
        <Section label="Is there a deadline?">
          <div className="grid grid-cols-3 gap-2">
            <WhenCard on={when === 'none'} onClick={() => setWhen('none')} icon={CircleSlash} label="No deadline" hint="Just a to-do" />
            <WhenCard on={when === 'date'} onClick={() => setWhen('date')} icon={CalendarClock} label="Has a deadline" hint="A day & time" />
            <WhenCard on={when === 'repeat'} onClick={() => setWhen('repeat')} icon={Repeat} label="Repeats" hint="Every week" />
          </div>
        </Section>

        {when !== 'none' && (
          <div key={when} className="animate-fade space-y-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
            {when === 'repeat' && (
              <Section label="Every">
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((w, i) => {
                    const on = days.includes(i)
                    return (
                      <button
                        key={w}
                        type="button"
                        aria-pressed={on}
                        aria-label={w}
                        onClick={() => setDays((x) => (on ? x.filter((y) => y !== i) : [...x, i].sort()))}
                        className={`grid h-10 min-w-0 flex-1 place-items-center rounded-xl border text-sm font-semibold transition active:scale-95 ${
                          on ? 'border-indigo-400/60 bg-indigo-500/25 text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        {w.slice(0, 1)}
                        <span className="sr-only">{w.slice(1)}</span>
                      </button>
                    )
                  })}
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Chip on={same(days, EVERY_DAY)} onClick={() => setDays(EVERY_DAY)}>Every day</Chip>
                  <Chip on={same(days, WEEKDAYS_ONLY)} onClick={() => setDays(WEEKDAYS_ONLY)}>Weekdays</Chip>
                  <Chip on={same(days, WEEKENDS)} onClick={() => setDays(WEEKENDS)}>Weekends</Chip>
                </div>
              </Section>
            )}

            {/* Day */}
            <Section label={when === 'repeat' ? 'Starting' : 'Day'}>
              <div className="flex flex-wrap gap-1.5">
                <Chip on={date === today} onClick={() => setDate(today)}>Today</Chip>
                <Chip on={date === addDays(today, 1)} onClick={() => setDate(addDays(today, 1))}>Tomorrow</Chip>
                <button
                  type="button"
                  onClick={() => setCalOpen((o) => !o)}
                  aria-expanded={calOpen}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                    date !== today && date !== addDays(today, 1) ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {date !== today && date !== addDays(today, 1) ? shortDate : 'Pick a day'}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${calOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <div className={`grid transition-all duration-300 ease-out ${calOpen ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!calOpen}>
                <div className="min-h-0 overflow-hidden">
                  <div className="mx-auto max-w-sm">
                    <Calendar
                      value={date}
                      marks={marks}
                      onChange={(k) => {
                        setDate(k)
                        setCalOpen(false)
                        // A repeating task that starts on a day it doesn't repeat on would be confusing: include that day.
                        if (when === 'repeat' && days.length === 1) setDays([fromKey(k).getDay()])
                      }}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Time */}
            <Section
              label="Time"
              right={
                <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                  All day
                  <Toggle on={allDay} onChange={setAllDay} label="All day" />
                </label>
              }
            >
              {allDay ? (
                <p className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-zinc-500">No set time · shows at the top of the day.</p>
              ) : (
                <>
                  <div className="flex items-center gap-2">
                    <input
                      type="time"
                      step={SNAP * 60}
                      value={toTimeInput(start)}
                      onChange={(e) => {
                        const m = fromTimeInput(e.target.value)
                        if (m != null) changeStart(m)
                      }}
                      aria-label="Starts"
                      className={`${field} min-w-0 flex-1 tabular-nums`}
                    />
                    <span className="text-zinc-500">to</span>
                    <input
                      type="time"
                      step={SNAP * 60}
                      value={toTimeInput(end % DAY_MINUTES)}
                      onChange={(e) => {
                        const m = fromTimeInput(e.target.value)
                        if (m != null) setEnd(m)
                      }}
                      aria-label="Ends"
                      className={`${field} min-w-0 flex-1 tabular-nums`}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    {DURATIONS.filter((m) => start + m <= DAY_MINUTES).map((m) => (
                      <Chip key={m} on={duration === m} onClick={() => setDuration(m)} small>
                        {fmtDuration(m)}
                      </Chip>
                    ))}
                    {!DURATIONS.includes(duration) && <span className="px-1 text-xs tabular-nums text-zinc-500">{fmtDuration(duration)}</span>}
                  </div>
                  <p className="mt-2 text-xs text-zinc-500">Tip: on the calendar, drag a task to move it, or drag its bottom edge to make it longer.</p>
                </>
              )}
            </Section>

            {when === 'repeat' && (
              <Section label="Ends">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Chip on={!until} onClick={() => setUntil('')}>Never</Chip>
                  <Chip on={!!until} onClick={() => setUntil(until || addDays(date > today ? date : today, 7 * 12))}>On a day</Chip>
                  {until && (
                    <input
                      type="date"
                      value={until}
                      min={date}
                      onChange={(e) => setUntil(e.target.value)}
                      aria-label="Last day"
                      className={`${field} h-9 w-auto rounded-full`}
                    />
                  )}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* Notes */}
        {notesOpen ? (
          <Section label="Notes" right={<ClearBtn onClick={() => (setNotes(''), setNotesOpen(false))} label="Remove notes" />}>
            <textarea
              value={notes}
              autoFocus={!editing?.notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Details, links, what to bring…"
              className="block min-h-[3.5rem] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-base text-zinc-100 outline-none transition [field-sizing:content] placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
          </Section>
        ) : (
          <button type="button" onClick={() => setNotesOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-zinc-500 transition hover:text-zinc-200">
            <NotebookPen className="h-4 w-4" /> Add notes
          </button>
        )}
      </div>
    </Modal>
  )
}

const same = (a: number[], b: number[]) => a.length === b.length && [...a].sort().every((x, i) => x === b[i])

/** Coloured chips for each kind of task, plus a box to make a new one. */
export function KindPicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const kinds = useStore((s) => s.taskKinds)
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')

  function add() {
    if (!name.trim()) return setAdding(false)
    onChange(useStore.getState().addTaskKind(name))
    setName('')
    setAdding(false)
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {kinds.map((k) => {
        const c = taskColor(k)
        const Icon = taskIcon(k)
        const on = k.id === value
        return (
          <button
            key={k.id}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(k.id)}
            className={`inline-flex h-9 max-w-full items-center gap-2 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
              on ? c.chip : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
            }`}
          >
            <Icon className={`h-3.5 w-3.5 shrink-0 ${on ? '' : c.text}`} />
            <span className="truncate">{k.label}</span>
          </button>
        )
      })}
      {adding ? (
        <input
          autoFocus
          value={name}
          maxLength={28}
          onChange={(e) => setName(e.target.value)}
          onBlur={add}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              e.stopPropagation()
              add()
            }
            if (e.key === 'Escape') {
              e.stopPropagation()
              setAdding(false)
            }
          }}
          placeholder="New kind, e.g. Gym"
          className="h-9 w-44 rounded-full border border-indigo-400/50 bg-black/30 px-3 text-sm text-white outline-none placeholder:text-zinc-600"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-sm text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
        >
          <Plus className="h-3.5 w-3.5" /> New kind
        </button>
      )}
    </div>
  )
}

function WhenCard({ on, onClick, icon: Icon, label, hint }: { on: boolean; onClick: () => void; icon: typeof Repeat; label: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-w-0 flex-col items-start gap-1.5 rounded-2xl border p-3 text-left transition active:scale-[0.98] ${
        on ? 'border-indigo-400/60 bg-indigo-500/15 shadow-lg shadow-indigo-500/10' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.03]'
      }`}
    >
      <Icon className={`h-4 w-4 ${on ? 'text-indigo-200' : 'text-zinc-500'}`} />
      <span className={`text-sm font-semibold leading-tight ${on ? 'text-white' : 'text-zinc-300'}`}>{label}</span>
      <span className="hidden text-xs text-zinc-500 sm:block">{hint}</span>
    </button>
  )
}

function Section({ label, right, children }: { label: string; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400">{label}</span>
        {right}
      </div>
      {children}
    </div>
  )
}

function ClearBtn({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button type="button" onClick={onClick} aria-label={label} className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white">
      <X className="h-3.5 w-3.5" />
    </button>
  )
}

function Chip({ on, onClick, children, small }: { on: boolean; onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex max-w-full items-center gap-1.5 rounded-full border font-medium transition active:scale-95 ${small ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm'} ${
        on ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-6 w-10 shrink-0 rounded-full transition ${on ? 'bg-indigo-500' : 'bg-white/10'}`}
    >
      <span className={`absolute left-0 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-[18px]' : 'translate-x-0.5'}`} />
    </button>
  )
}
