import { useMemo, useState } from 'react'
import { AlertTriangle, CalendarRange, Sparkles } from 'lucide-react'
import { useStore } from '../store'
import { AUTO_AHEAD, MAX_SPAN, MIN_START, resolveRange } from '../lib/time'
import { toast } from '../toast'
import { Modal } from './Modal'

/*
 * "Your years": which years the planner covers. The start year, and an end year or "Automatic" (always 14 years ahead of
 * today, so it grows each New Year). Set here, from the year tabs, or in Settings → Calendar. The range always includes
 * the current year. Changing it never deletes anything: months outside it are only hidden until they're back in range.
 */

const thisYear = () => new Date().getFullYear()

/** Start years you can pick: from MIN_START (or as far back as MAX_SPAN allows) up to this year. */
export function startChoices() {
  const y = thisYear()
  const from = Math.max(MIN_START, y - MAX_SPAN + 1)
  return Array.from({ length: y - from + 1 }, (_, i) => y - i)
}

/** End years you can pick for a start year: this year up to MAX_SPAN years after the start. */
export function endChoices(start: number) {
  const y = thisYear()
  const to = start + MAX_SPAN - 1
  return Array.from({ length: Math.max(0, to - y + 1) }, (_, i) => y + i)
}

/** How much of your plan falls outside a range (it stays saved, just out of view). */
function useOutside(start: number, end: number) {
  const months = useStore((s) => s.months)
  const expenses = useStore((s) => s.expenses)
  return useMemo(() => {
    let before = 0, after = 0
    for (const [k, m] of Object.entries(months)) {
      const y = Number(k.slice(0, 4))
      const used = m.items.length > 0 || !!m.goal || !!m.budget || m.earned != null || m.netWorthGoal != null || !!m.notes?.trim()
      if (!used) continue
      if (y < start) before++
      else if (y > end) after++
    }
    let spent = 0
    for (const e of expenses) {
      const y = Number(e.date.slice(0, 4))
      if (y < start || y > end) spent++
    }
    return { before, after, spent }
  }, [months, expenses, start, end])
}

/** Saves a new start and end (0 = automatic), with Undo. */
export function setYears(start: number, end: number) {
  const { prefs, setPrefs } = useStore.getState()
  const before = { yearStart: prefs.yearStart, yearEnd: prefs.yearEnd }
  if (before.yearStart === start && before.yearEnd === end) return
  setPrefs({ yearStart: start, yearEnd: end })
  const r = resolveRange(start, end)
  toast.undo(`Your plan now covers ${r.start} – ${r.end}.`, () => useStore.getState().setPrefs(before))
}

/** The two pickers and what they'll mean, shared by the dialog and Settings. */
export function YearFields({ start, end, onStart, onEnd }: { start: number; end: number; onStart: (y: number) => void; onEnd: (y: number) => void }) {
  const r = resolveRange(start, end)
  const out = useOutside(r.start, r.end)
  const y = thisYear()
  const ends = endChoices(r.start)
  const field = 'h-11 w-full appearance-none rounded-xl border border-white/10 bg-white/[0.04] px-3 text-sm font-medium text-white outline-none transition hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">Start year</span>
          <select value={r.start} onChange={(e) => onStart(Number(e.target.value))} className={field} aria-label="Start year">
            {startChoices().map((s) => (
              <option key={s} value={s} className="bg-[#11131a]">
                {s}
                {s === y ? ' (this year)' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-zinc-400">End year</span>
          <select value={end > 0 ? r.end : 0} onChange={(e) => onEnd(Number(e.target.value))} className={field} aria-label="End year">
            <option value={0} className="bg-[#11131a]">
              Automatic ({y + AUTO_AHEAD})
            </option>
            {ends.map((e) => (
              <option key={e} value={e} className="bg-[#11131a]">
                {e}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-start gap-3 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.06] px-3.5 py-3">
        <CalendarRange className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
        <p className="text-sm text-zinc-300">
          <b className="font-semibold tabular-nums text-white">
            {r.start} – {r.end}
          </b>{' '}
          · {r.end - r.start + 1} {r.end === r.start ? 'year' : 'years'}, {(r.end - r.start + 1) * 12} months
          {end === 0 && (
            <span className="mt-1 flex items-center gap-1.5 text-xs text-zinc-400">
              <Sparkles className="h-3 w-3 text-indigo-300" /> Grows with the calendar: always {AUTO_AHEAD} years ahead of today.
            </span>
          )}
        </p>
      </div>

      {(out.before > 0 || out.after > 0 || out.spent > 0) && (
        <p className="flex items-start gap-2.5 rounded-xl border border-amber-300/20 bg-amber-400/[0.06] px-3.5 py-3 text-xs leading-relaxed text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>
            {[
              out.before > 0 && `${out.before} planned month${out.before === 1 ? '' : 's'} before ${r.start}`,
              out.after > 0 && `${out.after} planned month${out.after === 1 ? '' : 's'} after ${r.end}`,
              out.spent > 0 && `${out.spent} expense${out.spent === 1 ? '' : 's'}`,
            ]
              .filter(Boolean)
              .join(', ')}{' '}
            will be out of view and not counted in your totals. Nothing is deleted: widen the years again and it all comes back.
          </span>
        </p>
      )}
      <p className="text-xs leading-relaxed text-zinc-500">
        Your years always include {y}, so today is always on your plan. Up to {MAX_SPAN} years at a time.
      </p>
    </div>
  )
}

/** The years dialog (from the year tabs). */
export function YearsDialog({ onClose }: { onClose: () => void }) {
  const prefs = useStore((s) => s.prefs)
  const [start, setStart] = useState(() => resolveRange(prefs.yearStart, prefs.yearEnd).start)
  const [end, setEnd] = useState(prefs.yearEnd)
  // A start that's later than the end you picked moves the end along (or back to automatic if it no longer fits).
  const pickStart = (s: number) => {
    setStart(s)
    if (end > 0 && (end < s || end > s + MAX_SPAN - 1)) setEnd(0)
  }
  return (
    <Modal
      title="Your years"
      subtitle="Choose which years your plan covers. Pick your own end, or let it grow with the calendar."
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="h-10 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
            Cancel
          </button>
          <button
            onClick={() => {
              setYears(start, end)
              onClose()
            }}
            className="h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
          >
            Save years
          </button>
        </div>
      }
    >
      <YearFields start={start} end={end} onStart={pickStart} onEnd={setEnd} />
    </Modal>
  )
}

/** A small button that opens the years dialog: "2026 – 2040". */
export function YearsButton({ className = '' }: { className?: string }) {
  const range = useStore((s) => s.yearRange)
  const [open, setOpen] = useState(false)
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Change your years"
        aria-label={`Your years: ${range.replace('-', ' to ')}. Change them`}
        className={`inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white ${className}`}
      >
        <CalendarRange className="h-4 w-4" />
        <span className="hidden tabular-nums md:inline">{range.replace('-', ' – ')}</span>
      </button>
      {open && <YearsDialog onClose={() => setOpen(false)} />}
    </>
  )
}
