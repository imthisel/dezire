import { useState } from 'react'
import { Check, ChevronDown, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { toast } from '../toast'

/** Long notes start folded to this many lines. */
const FOLD_LINES = 6

/**
 * The note for one year: a quiet "Add a note" button when empty, the note itself once written.
 * `compact`: shows nothing until there is a note (used under the year headings in Favorites).
 */
export function YearNote({ year, compact = false }: { year: number; compact?: boolean }) {
  const note = useStore((s) => s.yearNotes[year]) ?? ''
  const setNote = useStore((s) => s.setYearNote)
  const [editing, setEditing] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const has = note.trim().length > 0

  function done() {
    setEditing(false)
    if (!has && note) setNote(year, '')
  }

  function remove() {
    if (!confirm(`Delete your note for ${year}?`)) return
    setNote(year, '')
    setEditing(false)
    toast.info(`Deleted the note for ${year}.`)
  }

  if (!has && !editing) {
    if (compact) return null
    return (
      <button
        onClick={() => setEditing(true)}
        className="group flex w-full items-center gap-3 rounded-2xl border border-dashed border-amber-200/20 px-3.5 py-3 text-left transition hover:border-amber-200/40 hover:bg-amber-200/[0.03] active:scale-[0.995]"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-200/10 text-amber-200/70 transition group-hover:text-amber-200">
          <StickyNote className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium text-zinc-200">Add a note for {year}</span>
          <span className="block truncate text-xs text-zinc-500">What this year is about, plans, reminders…</span>
        </span>
      </button>
    )
  }

  const lines = note.split('\n').length
  const long = lines > FOLD_LINES || note.length > FOLD_LINES * 90

  return (
    <div
      className={`animate-fade relative overflow-hidden border border-amber-200/15 bg-gradient-to-br from-amber-200/[0.07] via-amber-200/[0.025] to-transparent ${
        compact ? 'rounded-xl py-2.5 pl-4 pr-2' : 'rounded-2xl py-3 pl-5 pr-3 sm:py-4'
      }`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200 to-amber-400" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-amber-100/70">
          <StickyNote className="h-3.5 w-3.5" /> Note for {year}
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
              <button
                onClick={done}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-amber-300/15 px-2.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-300/25"
              >
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
            onChange={(e) => setNote(year, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
                e.preventDefault()
                done()
              }
            }}
            autoFocus
            rows={3}
            maxLength={4000}
            aria-label={`Note for ${year}`}
            placeholder={`What is ${year} about? Big plans, reminders, things to remember…`}
            className="mt-1.5 block min-h-[5rem] w-full resize-y rounded-lg bg-black/20 px-2 py-1.5 text-base leading-relaxed text-zinc-100 outline-none ring-1 ring-amber-200/10 [field-sizing:content] placeholder:text-zinc-600 focus:ring-amber-200/30 sm:text-sm"
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
            <button
              onClick={() => setExpanded((x) => !x)}
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-amber-200/80 transition hover:text-amber-100"
            >
              {expanded ? 'Show less' : 'Show more'}
              <ChevronDown className={`h-3.5 w-3.5 transition ${expanded ? 'rotate-180' : ''}`} />
            </button>
          )}
        </>
      )}
    </div>
  )
}
