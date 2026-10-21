import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarClock, CalendarDays, CalendarRange, ChevronDown, CircleCheck, CircleSlash, NotebookPen, Plus, Repeat, Trash2, X } from 'lucide-react'
import { useStore, type ModalState } from '../store'
import { WEEKDAYS, addDays, dayLabel, fromKey, longDate, todayKey } from '../lib/expenses'
import {
  DAY_MINUTES, EVERY_DAY, MAX_TASK_TITLE, SNAP, WEEKDAYS_ONLY, WEEKENDS, fmtDuration, fmtRange, fmtTime, fromTimeInput, nowMinutes, occurrencesIn, repeatLabel,
  taskColor, taskIcon, toTimeInput,
} from '../lib/tasks'
import { MONTHS_SHORT } from '../lib/time'
import type { TaskType } from '../lib/types'
import { Calendar } from './Calendar'
import { Modal } from './Modal'
import { toast } from '../toast'

type Props = Extract<NonNullable<ModalState>, { type: 'task' }>
type When = 'none' | 'date' | 'repeat'

const field =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm'
const LAST_KIND = 'viszionary-last-task-kind'
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

/**
 * Add or edit an event (time set aside on the calendar) or a task (something to get done, maybe by a deadline).
 * Asks what it's for, then when: an event's day and time, or whether a task has a deadline. Either can repeat.
 */
export function TaskModal({ editId, entry, date: startDate, start: startAt, duration: startDuration, kind: startKind, title: startTitle }: Props) {
  const editing = useStore((s) => (editId ? s.tasks.find((t) => t.id === editId) : undefined))
  const kinds = useStore((s) => s.taskKinds)
  const close = useStore((s) => s.closeModal)
  const today = todayKey()

  const firstKind = () => {
    const want = editing?.kind ?? startKind ?? readLastKind()
    return kinds.some((k) => k.id === want) ? want! : kinds[0].id
  }
  // Opened from a time on the calendar: an event. From the to-do list: a task.
  const [type, setTypeState] = useState<TaskType>(editing?.type ?? entry ?? (startAt !== undefined ? 'event' : 'todo'))
  const [title, setTitle] = useState(editing?.title ?? startTitle ?? '')
  const [kind, setKind] = useState(firstKind)
  const [when, setWhen] = useState<When>(
    editing ? (editing.repeat ? 'repeat' : editing.date ? 'date' : 'none') : startDate || type === 'event' ? 'date' : 'none',
  )
  const [date, setDate] = useState(editing?.date || startDate || today)
  // Events: all day. Tasks: due any time that day (no due time).
  const [allDay, setAllDay] = useState(editing ? editing.date !== '' && editing.start === null : startAt === null || (type === 'todo' && startAt === undefined))
  const [start, setStart] = useState(editing?.start ?? startAt ?? (type === 'todo' ? 17 * 60 : nextHour()))
  const [duration, setDuration] = useState(editing?.start != null && editing.type === 'event' ? editing.duration : (startDuration ?? 60))
  const [days, setDays] = useState<number[]>(editing?.repeat?.days ?? [fromKey(startDate || today).getDay()])
  const [until, setUntil] = useState(editing?.repeat?.until ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  const [calOpen, setCalOpen] = useState(false)
  const titleBox = useRef<HTMLInputElement>(null)

  const event = type === 'event'
  const end = start + duration
  const ok = title.trim().length > 0 && (when !== 'repeat' || days.length > 0)
  const noun = event ? 'event' : 'task'

  function setType(t: TaskType) {
    setTypeState(t)
    // An event always happens on a day.
    if (t === 'event' && when === 'none') setWhen('date')
  }

  function save() {
    if (!title.trim()) {
      titleBox.current?.focus()
      return toast.error(event ? 'Say what the event is first.' : 'Say what the task is first.')
    }
    if (when === 'repeat' && !days.length) return toast.error('Pick at least one day it repeats on.')
    const data = {
      type,
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
      toast.success(event ? 'Event updated.' : 'Task updated.')
    } else {
      s.addTask(data)
      const time = allDay ? '' : event ? fmtRange(start, duration) : `due ${fmtTime(start, true)}`
      const what = event ? 'Event added' : 'Task added'
      if (when === 'none') toast.success(`${what} to your to-do list.`)
      else if (when === 'repeat') toast.success(`${what} · ${repeatLabel({ days, until })}${time ? `, ${time}` : ''}.`)
      else toast.success(`${what} · ${dayLabel(date)}${time ? `, ${time}` : ''}.`)
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
    // Ending at or before the time it starts means the next day (e.g. 10 PM to 2 AM).
    const days = Math.floor(duration / DAY_MINUTES)
    const same = days * DAY_MINUTES + m - start
    setDuration(same >= SNAP ? same : same + DAY_MINUTES)
  }

  // Days that already have something on them, as dots on the date picker.
  const tasks = useStore((s) => s.tasks)
  const marks = useMemo(() => {
    const n = new Map<string, number>()
    const from = addDays(today, -60)
    for (const o of occurrencesIn(tasks, from, addDays(today, 400))) if (o.task.id !== editId) n.set(o.day, (n.get(o.day) ?? 0) + 1)
    return new Map([...n].map(([k, v]) => [k, `${v} planned`]))
  }, [tasks, today, editId])

  const d = fromKey(date)
  const shortDate = `${WEEKDAYS[d.getDay()]}, ${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}${date.slice(0, 4) === today.slice(0, 4) ? '' : `, ${d.getFullYear()}`}`
  const color = taskColor(kinds.find((k) => k.id === kind) ?? kinds[0])
  const timeText = allDay ? '' : event ? ` · ${fmtRange(start, duration)}` : ` · due ${fmtTime(start)}`
  const subtitle =
    when === 'none'
      ? 'On your to-do list, no deadline'
      : when === 'repeat'
        ? `${repeatLabel({ days: days.length ? days : [0], until })}${timeText}`
        : `${longDate(date)}${timeText}`

  return (
    <Modal
      title={editing ? `Edit ${noun}` : `New ${noun}`}
      subtitle={subtitle}
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
            {editing ? 'Save' : `Add ${noun}`}
          </button>
        </div>
      }
    >
      <div className="space-y-6" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save()}>
        {/* Event or task */}
        <div role="radiogroup" aria-label="Kind of entry" className="relative grid grid-cols-2 rounded-2xl border border-white/10 bg-white/[0.03] p-1">
          <span
            aria-hidden
            className="absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-xl bg-indigo-500/25 ring-1 ring-indigo-400/40 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
            style={{ transform: `translateX(${event ? 0 : 100}%)` }}
          />
          <TypeOption on={event} onClick={() => setType('event')} icon={CalendarRange} label="Event" hint="Time set aside to do something" />
          <TypeOption on={!event} onClick={() => setType('todo')} icon={CircleCheck} label="Task" hint="Something to get done, ticked off" />
        </div>

        {/* What */}
        <div className="flex items-center gap-3">
          <span className={`h-10 w-1.5 shrink-0 ${event ? 'rounded-full' : 'rounded-full opacity-60'} ${color.dot}`} aria-hidden />
          <input
            ref={titleBox}
            value={title}
            autoFocus={!editing}
            maxLength={MAX_TASK_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.nativeEvent.isComposing && save()}
            placeholder={event ? 'What are you doing? e.g. Study for finals' : 'What do you need to do?'}
            aria-label={event ? 'Event' : 'Task'}
            className="h-12 min-w-0 flex-1 bg-transparent text-xl font-semibold text-white outline-none placeholder:font-medium placeholder:text-zinc-600"
          />
        </div>

        {/* What it's for */}
        <Section label="What's it for?">
          <KindPicker value={kind} onChange={setKind} />
        </Section>

        {/* When */}
        {event ? (
          <Section
            label="When"
            right={
              <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                <Repeat className="h-3.5 w-3.5" /> Repeats
                <Toggle on={when === 'repeat'} onChange={(on) => setWhen(on ? 'repeat' : 'date')} label="Repeats" />
              </label>
            }
          >
            <span className="sr-only">Pick the day and time below.</span>
          </Section>
        ) : (
          <Section label="Is there a deadline?">
            <div className="grid grid-cols-3 gap-2">
              <WhenCard on={when === 'none'} onClick={() => setWhen('none')} icon={CircleSlash} label="No deadline" hint="Just a to-do" />
              <WhenCard on={when === 'date'} onClick={() => setWhen('date')} icon={CalendarClock} label="Has a deadline" hint="Due on a day" />
              <WhenCard on={when === 'repeat'} onClick={() => setWhen('repeat')} icon={Repeat} label="Repeats" hint="Every week" />
            </div>
          </Section>
        )}

        {when !== 'none' && (
          <div key={`${type}-${when}`} className={`animate-fade space-y-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4 ${event ? '-mt-3' : ''}`}>
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
            <Section label={when === 'repeat' ? 'Starting' : event ? 'Day' : 'Due'}>
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
                        // Repeating from a day it doesn't repeat on would be confusing: include that day.
                        if (when === 'repeat' && days.length === 1) setDays([fromKey(k).getDay()])
                      }}
                    />
                  </div>
                </div>
              </div>
            </Section>

            {/* Time */}
            {event ? (
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
                      <TimeInput value={start} onChange={setStart} label="Starts" />
                      <span className="text-zinc-500">to</span>
                      <TimeInput value={end % DAY_MINUTES} onChange={setEnd} label="Ends" />
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {DURATIONS.map((m) => (
                        <Chip key={m} on={duration === m} onClick={() => setDuration(m)} small>
                          {fmtDuration(m)}
                        </Chip>
                      ))}
                      {!DURATIONS.includes(duration) && <span className="px-1 text-xs tabular-nums text-zinc-500">{fmtDuration(duration)}</span>}
                      {end > DAY_MINUTES && (
                        <span className="rounded-full bg-indigo-500/15 px-2 py-0.5 text-xs font-medium text-indigo-200">
                          Ends {end >= 2 * DAY_MINUTES ? `${Math.floor(end / DAY_MINUTES)} days later` : 'the next day'}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 text-xs text-zinc-500">
                      Tip: on the calendar, drag an event to move it, or drag its bottom edge to make it longer (past 12 AM it carries on into the next day).
                    </p>
                  </>
                )}
              </Section>
            ) : (
              <Section
                label="Due time"
                right={
                  <label className="inline-flex cursor-pointer items-center gap-2 text-xs text-zinc-400">
                    Set a time
                    <Toggle on={!allDay} onChange={(on) => setAllDay(!on)} label="Set a due time" />
                  </label>
                }
              >
                {allDay ? (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-sm text-zinc-500">Any time that day.</p>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-400">Due by</span>
                    <TimeInput value={start} onChange={setStart} label="Due by" />
                  </div>
                )}
              </Section>
            )}

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

function TypeOption({ on, onClick, icon: Icon, label, hint }: { on: boolean; onClick: () => void; icon: typeof Repeat; label: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`relative flex min-w-0 items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition ${on ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
    >
      <Icon className={`h-5 w-5 shrink-0 ${on ? 'text-indigo-200' : ''}`} />
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight">{label}</span>
        <span className="hidden truncate text-xs text-zinc-500 sm:block">{hint}</span>
      </span>
    </button>
  )
}

function TimeInput({ value, onChange, label }: { value: number; onChange: (m: number) => void; label: string }) {
  return (
    <input
      type="time"
      step={SNAP * 60}
      value={toTimeInput(value)}
      onChange={(e) => {
        const m = fromTimeInput(e.target.value)
        if (m != null) onChange(m)
      }}
      aria-label={label}
      className={`${field} min-w-0 flex-1 tabular-nums`}
    />
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
