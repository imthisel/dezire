import { useEffect, useRef, useState } from 'react'
import { Cake, X } from 'lucide-react'
import { useStore } from '../store'
import { MONTHS } from '../lib/time'

/** The saved birthday as numbers (month is 0-based), or null when not set. */
export function useBirthday() {
  const b = useStore((s) => s.birthday)
  if (!b) return null
  const [year, month, day] = b.split('-').map(Number)
  return { year, month: month - 1, day }
}

/** How old you turn in `year`'s birth month: null before you were born. */
export const ageIn = (b: { year: number } | null, year: number) => (b && year >= b.year ? year - b.year : null)

/** "Turns 28", or "Born" in the year you were born. */
export const turnsLabel = (age: number) => (age === 0 ? 'Born' : `Turns ${age}`)

const today = () => new Date().toISOString().slice(0, 10)

/** Date box for the birthday, used in the account menu and the year summary. */
export function BirthdayInput({ autoFocus, onDone }: { autoFocus?: boolean; onDone?: () => void }) {
  const birthday = useStore((s) => s.birthday)
  const setBirthday = useStore((s) => s.setBirthday)
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="date"
        value={birthday ?? ''}
        min="1900-01-01"
        max={today()}
        autoFocus={autoFocus}
        onChange={(e) => {
          setBirthday(e.target.value || null)
          if (e.target.value) onDone?.()
        }}
        aria-label="Your birthday"
        className="h-9 min-w-0 flex-1 rounded-lg border border-white/10 bg-black/30 px-2.5 text-sm text-zinc-100 outline-none transition [color-scheme:dark] hover:border-white/20 focus:border-pink-400/50 focus:ring-2 focus:ring-pink-400/15"
      />
      {birthday && (
        <button
          onClick={() => setBirthday(null)}
          title="Remove birthday"
          aria-label="Remove birthday"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

/** Year summary line: "you turn 28 in March", or a quiet "Add birthday" link that opens a small date box. */
export function BirthdayNote({ year }: { year: number }) {
  const b = useBirthday()
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return
      if (e.type === 'pointerdown' && root.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
    }
  }, [open])

  const age = ageIn(b, year)
  if (b) {
    return age === null ? null : (
      <span className="inline-flex items-center gap-1 truncate text-sm text-pink-200/80">
        <Cake className="h-3.5 w-3.5 shrink-0" />
        {age === 0 ? `born in ${MONTHS[b.month]}` : `you turn ${age} in ${MONTHS[b.month]}`}
      </span>
    )
  }

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        title="Add your birthday to see your age on your birth month"
        className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-xs text-zinc-600 transition hover:text-pink-200"
      >
        <Cake className="h-3.5 w-3.5" /> Add birthday
      </button>
      {open && (
        <div className="animate-fade absolute left-0 top-8 z-40 w-64 rounded-xl border border-white/10 bg-[#0e1016] p-3 shadow-2xl shadow-black/60">
          <p className="mb-2 text-xs text-zinc-400">Your age will show on your birth month, every year.</p>
          <BirthdayInput autoFocus onDone={() => setOpen(false)} />
        </div>
      )}
    </div>
  )
}
