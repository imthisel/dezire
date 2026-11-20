import { useMemo } from 'react'
import { CalendarCheck, Check, GraduationCap } from 'lucide-react'
import { useStore } from '../store'
import { findSubject, toggleDone, type School } from '../lib/school'
import { TASK_COLORS } from '../lib/tasks'
import { toast } from '../toast'

/*
 * The link between the two calendars: School's deadlines can show on Time's Calendar page, and Time's to-dos can show on
 * School's calendar. Each is a setting that follows the account, switched on either calendar or in Settings → Calendar.
 */

/** A School task as the Calendar page shows it: on the day it's due, in its subject's colour. */
export type SchoolDue = { id: string; title: string; subject: string; due: string; done: boolean; color: string }

/** School tasks due from `from` to `to` (both "YYYY-MM-DD"), finished ones included. */
export function schoolDues(school: School, from: string, to: string): SchoolDue[] {
  const open = new Set(school.columns.filter((c) => c.role === 'open').map((c) => c.id))
  return school.tasks
    .filter((t) => t.due >= from && t.due <= to)
    .map((t) => ({ id: t.id, title: t.title, subject: t.subject, due: t.due, done: !open.has(t.column), color: findSubject(school, t.subject)?.color ?? 'slate' }))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.subject.localeCompare(b.subject) || a.title.localeCompare(b.title))
}

/** School deadlines for the Calendar page, by day; empty while that's switched off. */
export function useSchoolByDay(from: string, to: string) {
  const on = useStore((s) => s.prefs.schoolOnCalendar)
  const school = useStore((s) => s.school)
  return useMemo(() => {
    const m = new Map<string, SchoolDue[]>()
    if (!on) return m
    for (const d of schoolDues(school, from, to)) m.set(d.due, [...(m.get(d.due) ?? []), d])
    return m
  }, [on, school, from, to])
}

export const dueColor = (d: Pick<SchoolDue, 'color'>) => TASK_COLORS[d.color] ?? TASK_COLORS.slate
export const openSchoolTask = (id: string) => useStore.getState().openModal({ type: 'school', editId: id })

/** Ticks a School task off (or back on), with Undo. */
export function tickSchool(id: string) {
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

/**
 * The switch on either calendar that brings in the other page's tasks: School deadlines on Time's Calendar, or Time's
 * to-dos on School's calendar. One look on both pages, and it acts right where it is (no menu to open). Each is a setting
 * that follows the account; Settings → Calendar has the same two.
 */
export function LinkToggle({ from }: { from: 'calendar' | 'school' }) {
  const schoolOnCalendar = useStore((s) => s.prefs.schoolOnCalendar)
  const timeTasksOnSchool = useStore((s) => s.prefs.timeTasksOnSchool)
  const setPrefs = useStore((s) => s.setPrefs)
  const t =
    from === 'calendar'
      ? {
          on: schoolOnCalendar,
          set: (v: boolean) => setPrefs({ schoolOnCalendar: v }),
          icon: GraduationCap,
          label: 'School tasks',
          hint: 'School tasks show on this calendar, on the day they’re due.',
        }
      : {
          on: timeTasksOnSchool,
          set: (v: boolean) => setPrefs({ timeTasksOnSchool: v }),
          icon: CalendarCheck,
          label: 'Time tasks',
          hint: 'Your to-dos from Time show on this calendar, dashed, on the day they’re for.',
        }
  return (
    <button
      type="button"
      role="switch"
      aria-checked={t.on}
      aria-label={`Show ${t.label.toLowerCase()} on this calendar`}
      title={`${t.on ? 'Showing' : 'Show'} ${t.label.toLowerCase()}: ${t.hint}`}
      onClick={() => t.set(!t.on)}
      className={`inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border pl-2.5 pr-2 text-sm font-medium transition active:scale-[0.97] ${
        t.on ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/15' : 'border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      <t.icon className="h-4 w-4 shrink-0" />
      <span className="hidden sm:inline">{t.label}</span>
      <span aria-hidden className={`flex h-[18px] w-8 shrink-0 items-center rounded-full p-0.5 transition-colors ${t.on ? 'bg-indigo-500' : 'bg-white/15'}`}>
        <span className={`h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${t.on ? 'translate-x-3.5' : ''}`} />
      </span>
    </button>
  )
}

/** A School deadline on the Calendar page: tick it off right there, or open it. */
export function SchoolDueChip({ d, compact }: { d: SchoolDue; compact?: boolean }) {
  const c = dueColor(d)
  return (
    <div
      title={`${d.subject}: ${d.title} (due${d.done ? ', done' : ''})`}
      className={`pointer-events-auto flex w-full min-w-0 items-center gap-1 rounded-md border border-dashed ${c.ring} bg-[#101219]/90 ${compact ? 'px-0.5 py-px' : 'py-px pl-0.5 pr-1.5'} ${d.done ? 'opacity-55' : ''}`}
    >
      <button
        role="checkbox"
        aria-checked={d.done}
        aria-label={d.done ? `Mark “${d.title}” not done` : `Mark “${d.title}” done`}
        onClick={(e) => (e.stopPropagation(), tickSchool(d.id))}
        className={`grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[4px] border-2 transition active:scale-90 ${d.done ? `${c.dot} border-transparent` : `${c.ring} hover:bg-white/10`}`}
      >
        {d.done && <Check className="h-2.5 w-2.5 text-black/75" strokeWidth={4} />}
      </button>
      <button onClick={(e) => (e.stopPropagation(), openSchoolTask(d.id))} className="flex min-w-0 flex-1 items-center gap-1 text-left">
        <GraduationCap className={`h-3 w-3 shrink-0 ${c.text}`} />
        <span className={`truncate text-[10.5px] font-semibold sm:text-[11.5px] ${d.done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}>{d.title}</span>
      </button>
    </div>
  )
}
