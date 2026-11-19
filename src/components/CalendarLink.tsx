import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, CalendarCheck, Check, GraduationCap, Link2 } from 'lucide-react'
import { useStore } from '../store'
import { findSubject, toggleDone, type School } from '../lib/school'
import { TASK_COLORS } from '../lib/tasks'
import { goTo } from '../nav'
import { toast } from '../toast'

/*
 * The link between the two calendars: School's deadlines can show on the Calendar page, and the Calendar's events and
 * tasks can show on School's calendar. Each is a setting that follows the account, switched here or in Settings → Calendar.
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

/** The "Linked" button on either calendar: both switches, and a way over to the other page. */
export function LinkMenu({ from }: { from: 'calendar' | 'school' }) {
  const schoolOnCalendar = useStore((s) => s.prefs.schoolOnCalendar)
  const calendarOnSchool = useStore((s) => s.prefs.calendarOnSchool)
  const setPrefs = useStore((s) => s.setPrefs)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const linked = from === 'calendar' ? schoolOnCalendar : calendarOnSchool

  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', esc)
    }
  }, [open])

  const rows = [
    {
      on: schoolOnCalendar,
      set: (v: boolean) => setPrefs({ schoolOnCalendar: v }),
      icon: GraduationCap,
      title: 'School on Calendar',
      hint: 'Deadlines show on the Calendar page, on the day they’re due.',
    },
    {
      on: calendarOnSchool,
      set: (v: boolean) => setPrefs({ calendarOnSchool: v }),
      icon: CalendarCheck,
      title: 'Calendar on School',
      hint: 'Your events and tasks show on School’s calendar, so you see what else is on.',
    },
  ]
  // The switch for this page goes first.
  if (from === 'school') rows.reverse()

  return (
    <div ref={box} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Linked calendars"
        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 text-sm font-medium transition ${
          linked ? 'border-indigo-400/40 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/15' : 'border-white/10 text-zinc-400 hover:bg-white/5 hover:text-white'
        }`}
      >
        <Link2 className="h-4 w-4" />
        <span className="hidden sm:inline">{from === 'calendar' ? 'School' : 'Calendar'}</span>
        <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${linked ? 'bg-indigo-300' : 'bg-zinc-600'}`} />
      </button>
      {open && (
        <div role="dialog" aria-label="Linked calendars" className="animate-fade absolute right-0 top-11 z-30 w-[19rem] max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-[#11131a]/95 p-2 shadow-2xl shadow-black/50 backdrop-blur-xl">
          <p className="px-2 pb-1.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Linked calendars</p>
          {rows.map((r) => (
            <button
              key={r.title}
              role="switch"
              aria-checked={r.on}
              onClick={() => r.set(!r.on)}
              className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.05]"
            >
              <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${r.on ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/[0.05] text-zinc-500'}`}>
                <r.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-100">{r.title}</span>
                <span className="mt-0.5 block text-xs leading-snug text-zinc-500">{r.hint}</span>
              </span>
              <span aria-hidden className={`mt-1 flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${r.on ? 'bg-indigo-500' : 'bg-white/15'}`}>
                <span className={`h-4 w-4 rounded-full bg-white shadow transition-transform ${r.on ? 'translate-x-4' : ''}`} />
              </span>
            </button>
          ))}
          <button
            onClick={() => (setOpen(false), goTo(from === 'calendar' ? 'school' : 'calendar'))}
            className="mt-1 flex w-full items-center justify-between rounded-xl border-t border-white/[0.06] px-2 pb-1 pt-2.5 text-xs font-medium text-zinc-400 transition hover:text-white"
          >
            Open {from === 'calendar' ? 'School' : 'Calendar'} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
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
