import { useState } from 'react'
import { Cake, Car, Check, ChevronDown, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { labelOfKey } from '../lib/time'
import { toast } from '../toast'

/** Long notes start folded to this many lines. */
const FOLD_LINES = 6

/** Colours a note can use (written out in full so Tailwind keeps them). */
const TONES = {
  amber: {
    dashed: 'border-amber-200/20 hover:border-amber-200/40 hover:bg-amber-200/[0.03]',
    iconBox: 'bg-amber-200/10 text-amber-200/70 group-hover:text-amber-200',
    card: 'border-amber-200/15 from-amber-200/[0.07] via-amber-200/[0.025]',
    bar: 'from-amber-200 to-amber-400',
    label: 'text-amber-100/70',
    done: 'bg-amber-300/15 text-amber-100 hover:bg-amber-300/25',
    ring: 'ring-amber-200/10 focus:ring-amber-200/30',
    more: 'text-amber-200/80 hover:text-amber-100',
  },
  pink: {
    dashed: 'border-pink-200/20 hover:border-pink-200/40 hover:bg-pink-200/[0.03]',
    iconBox: 'bg-pink-300/10 text-pink-200/70 group-hover:text-pink-200',
    card: 'border-pink-200/15 from-pink-300/[0.07] via-pink-300/[0.025]',
    bar: 'from-pink-200 to-fuchsia-400',
    label: 'text-pink-100/70',
    done: 'bg-pink-300/15 text-pink-100 hover:bg-pink-300/25',
    ring: 'ring-pink-200/10 focus:ring-pink-200/30',
    more: 'text-pink-200/80 hover:text-pink-100',
  },
  teal: {
    dashed: 'border-teal-200/20 hover:border-teal-200/40 hover:bg-teal-200/[0.03]',
    iconBox: 'bg-teal-300/10 text-teal-200/70 group-hover:text-teal-200',
    card: 'border-teal-200/15 from-teal-300/[0.07] via-teal-300/[0.025]',
    bar: 'from-teal-200 to-emerald-400',
    label: 'text-teal-100/70',
    done: 'bg-teal-300/15 text-teal-100 hover:bg-teal-300/25',
    ring: 'ring-teal-200/10 focus:ring-teal-200/30',
    more: 'text-teal-200/80 hover:text-teal-100',
  },
}

/**
 * A note: a quiet "Add a note" button when empty, the note itself once written. Saves as you type.
 * `compact`: shows nothing until there is a note, and smaller once there is.
 */
export function NoteCard({
  note, setNote, name, addHint, placeholder, tone = 'amber', icon: Icon = StickyNote, compact = false,
}: {
  note: string
  setNote: (text: string) => void
  /** What it's the note for: "2027", "the June 2027 setup" */
  name: string
  /** Under "Add a note for …" when empty */
  addHint: string
  placeholder: string
  tone?: keyof typeof TONES
  icon?: typeof StickyNote
  compact?: boolean
}) {
  const t = TONES[tone]
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const has = note.trim().length > 0

  function done() {
    setEditing(false)
    if (!has && note) setNote('')
  }

  function remove() {
    if (!confirm(`Delete your note for ${name}?`)) return
    setNote('')
    setEditing(false)
    toast.info(`Deleted the note for ${name}.`)
  }

  if (!has && !editing) {
    if (compact) return null
    return (
      <button
        onClick={() => setEditing(true)}
        className={`group flex w-full items-center gap-3 rounded-2xl border border-dashed px-3.5 py-3 text-left transition active:scale-[0.995] ${t.dashed}`}
      >
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${t.iconBox}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-200">Add a note for {name}</span>
          <span className="block truncate text-xs text-zinc-500">{addHint}</span>
        </span>
      </button>
    )
  }

  const lines = note.split('\n').length
  const long = lines > FOLD_LINES || note.length > FOLD_LINES * 90

  return (
    <div
      className={`animate-fade relative overflow-hidden border bg-gradient-to-br to-transparent ${t.card} ${
        compact ? 'rounded-xl py-2.5 pl-4 pr-2' : 'rounded-2xl py-3 pl-5 pr-3 sm:py-4'
      }`}
    >
      <span aria-hidden className={`absolute inset-y-0 left-0 w-1 bg-gradient-to-b ${t.bar}`} />
      <div className="flex items-center justify-between gap-2">
        <span className={`flex min-w-0 items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider ${t.label}`}>
          <Icon className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">Note for {name}</span>
        </span>
        <div className="-my-1 flex shrink-0 gap-0.5">
          {editing ? (
            <>
              {has && (
                <button
                  onClick={remove}
                  title="Delete note"
                  aria-label="Delete note"
                  className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-red-300"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button onClick={done} className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition ${t.done}`}>
                <Check className="h-3.5 w-3.5" /> Done
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              title="Edit note"
              aria-label="Edit note"
              className="grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {editing ? (
        <>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault()
                done()
              }
            }}
            autoFocus
            rows={3}
            maxLength={4000}
            aria-label={`Note for ${name}`}
            placeholder={placeholder}
            className={`mt-1.5 block min-h-[5rem] w-full resize-y rounded-lg bg-black/20 px-2 py-1.5 text-base leading-relaxed text-zinc-100 outline-none ring-1 [field-sizing:content] placeholder:text-zinc-600 sm:text-sm ${t.ring}`}
          />
          <p className="mt-1.5 hidden text-[11px] text-zinc-600 sm:block">Saves as you type · Ctrl+Enter or Esc to finish</p>
        </>
      ) : (
        <>
          <p
            onClick={() => setEditing(true)}
            title="Click to edit"
            style={long && !expanded ? { WebkitLineClamp: FOLD_LINES, display: '-webkit-box', WebkitBoxOrient: 'vertical' } : undefined}
            className={`mt-1 cursor-text overflow-hidden whitespace-pre-wrap break-words leading-relaxed text-zinc-200 ${compact ? 'text-xs' : 'text-sm sm:text-[15px]'}`}
          >
            {note}
          </p>
          {long && (
            <button onClick={() => setExpanded((x) => !x)} className={`mt-1 inline-flex items-center gap-1 text-xs font-medium transition ${t.more}`}>
              {expanded ? 'Show less' : 'Show more'}
              <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      )}
    </div>
  )
}

/**
 * The note for one year.
 * `compact`: shows nothing until there is a note (used under the year headings in Favorites).
 */
export function YearNote({ year, compact = false }: { year: number; compact?: boolean }) {
  const note = useStore((s) => s.yearNotes[year]) ?? ''
  const setNote = useStore((s) => s.setYearNote)
  return (
    <NoteCard
      note={note}
      setNote={(text) => setNote(year, text)}
      name={String(year)}
      addHint="What this year is about, plans, reminders…"
      placeholder={`What is ${year} about? Big plans, reminders, things to remember…`}
      compact={compact}
    />
  )
}

/** The note for one setup ("2027-06"): only ever shown with that setup. Pink for the birthday month, teal for December. */
export function SetupNote({ monthKey, birthday }: { monthKey: string; birthday: boolean }) {
  const note = useStore((s) => s.setupNotes[monthKey]) ?? ''
  const setNote = useStore((s) => s.setSetupNote)
  const label = labelOfKey(monthKey)
  return (
    <NoteCard
      key={monthKey}
      note={note}
      setNote={(text) => setNote(monthKey, text)}
      name={`the ${label} setup`}
      addHint="Plans for this setup only: what to sell, buy, move, or fix…"
      placeholder={`Anything about the ${label} setup: cars to sell or buy, where to move them, things to fix or register…`}
      tone={birthday ? 'pink' : 'teal'}
      icon={birthday ? Cake : Car}
    />
  )
}
