import { useStore } from './store'
import { toast } from './toast'

/**
 * Undo and redo for everything that belongs to the account (Ctrl+Z, and Ctrl+Shift+Z or Ctrl+Y to redo).
 * The store never changes its data in place, so a step is just the references from before the change: cheap to keep.
 */

/** The account's data: what an undo puts back. `modeId` goes with it, so a mode's plan always returns to its own mode. */
const KEYS = [
  'months', 'kinds', 'goals', 'goalAreas', 'sources', 'birthday', 'yearNotes', 'currency', 'expenses', 'expenseCats', 'places',
  'layouts', 'setupNotes', 'setupFavorites', 'modes', 'modeId', 'modeData', 'tasks', 'taskKinds', 'prefs',
] as const

type State = ReturnType<typeof useStore.getState>
type Snapshot = Pick<State, (typeof KEYS)[number]>
type Step = { id: number; before: Snapshot; after: Snapshot; keys: string; at: number }

const LIMIT = 100
/** Changes to the same things this close together are one step (typing a note, dragging a task). */
const MERGE_MS = 1000
/** Changes this close together are one step whatever they touch (one action that saves in a few parts). */
const SAME_ACTION_MS = 50

let past: Step[] = []
let future: Step[] = []
let nextId = 1
/** The latest step may not grow any more (an Undo button was offered for it). */
let sealed = false
let quiet = 0

const take = (s: State): Snapshot => Object.fromEntries(KEYS.map((k) => [k, s[k]])) as Snapshot
const changed = (s: State, prev: State) => KEYS.filter((k) => s[k] !== prev[k])

/** Runs `fn` without it becoming a step (e.g. data arriving from another device). */
export function quietly(fn: () => void) {
  quiet++
  try {
    fn()
  } finally {
    quiet--
  }
}

/** Forgets every step: after signing out, or when another device's changes replace what's here. */
export function clearHistory() {
  past = []
  future = []
}

/** The newest step's id, so an Undo button can tell whether it's still the latest change. */
export const latestStep = () => {
  sealed = true
  return past.at(-1)?.id ?? 0
}

/** Undoes step `id` if nothing has changed since it. False when it isn't the latest any more. */
export function undoStep(id: number) {
  if (!id || past.at(-1)?.id !== id) return false
  return undo()
}

export function undo() {
  const step = past.pop()
  if (!step) return false
  quietly(() => useStore.setState(step.before))
  future.push(step)
  return true
}

export function redo() {
  const step = future.pop()
  if (!step) return false
  quietly(() => useStore.setState(step.after))
  past.push(step)
  sealed = true
  return true
}

/** Text fields keep their own undo for what's being typed. */
function typing(el: Element | null) {
  if (!(el instanceof HTMLElement)) return false
  if (el.isContentEditable) return true
  if (el instanceof HTMLTextAreaElement) return true
  return el instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'submit', 'reset', 'range', 'color', 'file'].includes(el.type)
}

let started = false

export function startHistory() {
  if (started) return
  started = true

  useStore.subscribe((s, prev) => {
    if (quiet) return
    const keys = changed(s, prev)
    if (!keys.length) return
    // Opening another mode isn't a change to undo. Steps keep the mode they were made in, so they still undo correctly.
    if (keys.length === 1 && keys[0] === 'modeId') return
    if (s.modeId !== prev.modeId && s.modes === prev.modes) return

    const now = Date.now()
    const sig = keys.join()
    const last = past.at(-1)
    future = []
    if (last && !sealed && (now - last.at < SAME_ACTION_MS || (sig === last.keys && now - last.at < MERGE_MS))) {
      last.after = take(s)
      last.at = now
      return
    }
    past.push({ id: nextId++, before: take(prev), after: take(s), keys: sig, at: now })
    sealed = false
    if (past.length > LIMIT) past.shift()
  })

  window.addEventListener('keydown', (e) => {
    if (!(e.ctrlKey || e.metaKey) || e.altKey) return
    const key = e.key.toLowerCase()
    const isUndo = key === 'z' && !e.shiftKey
    const isRedo = (key === 'z' && e.shiftKey) || (key === 'y' && !e.shiftKey)
    if (!isUndo && !isRedo) return
    if (typing(document.activeElement)) return
    e.preventDefault()
    if (isUndo) {
      if (undo()) toast.action('Undone.', 'Redo', redo)
      else toast.info('Nothing to undo.')
    } else if (redo()) toast.action('Redone.', 'Undo', undo)
    else toast.info('Nothing to redo.')
  })
}
