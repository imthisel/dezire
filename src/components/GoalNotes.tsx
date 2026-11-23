import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronUp, Pencil, StickyNote, Trash2 } from 'lucide-react'
import { MAX_GOAL_NOTE } from '../store'
import { cleanUrl } from '../lib/links'
import type { Goal } from '../lib/types'
import { useGoalsApi } from './goalsApi'

const URL_RE = /((?:https?:\/\/|www\.)[^\s<>()]+)/gi

/** Note text with web addresses turned into links (opened in a new tab). Only checked web addresses become links. */
export function Linkified({ text }: { text: string }) {
  const parts: ReactNode[] = []
  let last = 0
  for (const m of text.matchAll(URL_RE)) {
    const raw = m[0].replace(/[.,;:!?'"]+$/, '')
    const url = cleanUrl(raw)
    const at = m.index ?? 0
    if (!url) continue
    if (at > last) parts.push(text.slice(last, at))
    parts.push(
      <a
        key={at}
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        title={url}
        draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="break-all text-sky-300 underline decoration-sky-300/30 underline-offset-2 transition hover:text-sky-200 hover:decoration-sky-200"
      >
        {raw}
      </a>,
    )
    last = at + raw.length
  }
  if (last < text.length) parts.push(text.slice(last))
  return <>{parts}</>
}

/** The first line of a note, for the one-line preview. */
const firstLine = (note: string) => note.trim().split('\n').find((l) => l.trim())?.trim() ?? ''

/**
 * A yearly goal's note, shown under the goal.
 * - Closed: a one-line preview (click to read it all).
 * - Open: the whole note, with its links clickable (click the text to edit).
 * - Editing: saves as you type; Done, Esc or Ctrl+Enter to finish, or click away.
 */
export function GoalNoteBlock({
  goal, year, color, editing, setEditing,
}: {
  goal: Goal
  year: number
  /** The area's colour (for the line beside the note) */
  color: string
  editing: boolean
  setEditing: (on: boolean) => void
}) {
  const api = useGoalsApi()
  const note = goal.notes ?? ''
  const has = note.trim().length > 0
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(note)
  const box = useRef<HTMLDivElement>(null)
  const area = useRef<HTMLTextAreaElement>(null)

  // Starting to edit: begin from the saved note, cursor at the end.
  useEffect(() => {
    if (!editing) return
    setDraft(note)
    requestAnimationFrame(() => {
      const t = area.current
      if (!t) return
      t.focus()
      t.setSelectionRange(t.value.length, t.value.length)
    })
    // Only when editing starts: the note changes with every key typed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  function change(text: string) {
    setDraft(text)
    api.get().updateGoal(year, goal.id, { notes: text })
  }

  function finish() {
    setEditing(false)
    // Opened right after writing, so you see what you wrote.
    setOpen(draft.trim().length > 0)
  }

  function remove() {
    const before = goal.notes ?? ''
    api.get().updateGoal(year, goal.id, { notes: '' })
    setEditing(false)
    setOpen(false)
    api.toast.undo(`Deleted the note on “${goal.text}”.`, () => api.get().updateGoal(year, goal.id, { notes: before }))
  }

  if (editing) {
    return (
      <div
        ref={box}
        onBlur={(e) => {
          // Clicked somewhere else on the page: finished.
          if (!box.current?.contains(e.relatedTarget as Node)) finish()
        }}
        className="animate-fade relative mt-1.5 rounded-lg border border-white/10 bg-black/30 py-1.5 pl-3 pr-1.5"
      >
        <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full" style={{ background: color }} />
        <textarea
          ref={area}
          value={draft}
          onChange={(e) => change(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape' || (e.key === 'Enter' && (e.ctrlKey || e.metaKey))) {
              e.preventDefault()
              e.stopPropagation()
              finish()
            }
          }}
          rows={2}
          maxLength={MAX_GOAL_NOTE}
          aria-label={`Note for “${goal.text}”`}
          placeholder="The plan, steps, progress, why it matters, links…"
          className="block min-h-[3.5rem] w-full resize-none bg-transparent text-base leading-relaxed text-zinc-100 outline-none [field-sizing:content] placeholder:text-zinc-600 sm:text-[13px]"
        />
        <div className="mt-1 flex items-center justify-between gap-2">
          <span className="hidden truncate text-[11px] text-zinc-600 sm:block">
            Saves as you type · Ctrl+Enter or Esc to finish
            {draft.length > MAX_GOAL_NOTE * 0.9 && ` · ${MAX_GOAL_NOTE - draft.length} left`}
          </span>
          <div className="ml-auto flex shrink-0 gap-0.5">
            {draft.trim() && (
              <button
                type="button"
                onClick={remove}
                title="Delete note"
                aria-label="Delete note"
                className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-red-300 sm:h-7 sm:w-7"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={finish}
              className="inline-flex h-8 items-center gap-1 rounded-md bg-white/10 px-2.5 text-xs font-semibold text-zinc-100 transition hover:bg-white/15 sm:h-7"
            >
              <Check className="h-3.5 w-3.5" /> Done
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (!has) return null

  if (!open) {
    const line = firstLine(note)
    const more = note.trim().split('\n').filter((l) => l.trim()).length > 1
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Show the note"
        aria-expanded={false}
        className="mt-0.5 flex w-full min-w-0 items-center gap-1.5 rounded-md py-0.5 text-left text-xs text-zinc-500 transition hover:text-zinc-300"
      >
        <StickyNote className="h-3 w-3 shrink-0" style={{ color }} />
        <span className="min-w-0 truncate">{line}</span>
        {more && <span className="shrink-0 text-zinc-600">· more</span>}
      </button>
    )
  }

  return (
    <div className="animate-fade group/note relative mt-1.5 rounded-lg bg-white/[0.03] py-1.5 pl-3 pr-1">
      <span aria-hidden className="absolute inset-y-1.5 left-0 w-0.5 rounded-full" style={{ background: color }} />
      <div className="flex items-start gap-1">
        <p
          onClick={() => setEditing(true)}
          title="Click to edit"
          className="min-w-0 flex-1 cursor-text whitespace-pre-wrap break-words py-0.5 text-[13px] leading-relaxed text-zinc-300"
        >
          <Linkified text={note.trim()} />
        </p>
        <div className="-mr-0.5 flex shrink-0 flex-col gap-0.5 sm:flex-row">
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Edit note"
            aria-label="Edit note"
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover/note:opacity-100 sm:focus-visible:opacity-100"
          >
            <Pencil className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            title="Fold the note"
            aria-label="Fold the note"
            aria-expanded
            className="grid h-8 w-8 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white sm:h-6 sm:w-6"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  )
}
