import { create } from 'zustand'
import type { Result } from './lib/types'
import { latestStep, undoStep } from './history'
import { live } from './lib/prefs'

/** `action`: a button on the toast, e.g. Undo. `leaving`: on its way out (sliding away for a moment before it's gone). */
export type Toast = { id: number; kind: 'error' | 'success' | 'info' | 'warning'; message: string; action?: { label: string; run: () => void }; leaving?: boolean }

let nextId = 1

export const useToasts = create<{ toasts: Toast[]; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  dismiss: (id) => {
    set((s) => ({ toasts: s.toasts.map((t) => (t.id === id ? { ...t, leaving: true } : t)) }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 200)
  },
}))

function push(kind: Toast['kind'], message: string, ms = kind === 'error' || kind === 'warning' ? 6000 : 2800, action?: Toast['action']) {
  const id = nextId++
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message, action }] }))
  setTimeout(() => useToasts.getState().dismiss(id), ms)
}

/** For messages that only confirm what you just did: skipped when Settings → Notifications → Confirmation messages is off. */
const confirm = (show: () => void) => {
  if (live.confirmations) show()
}

/**
 * success, info, undo and done only confirm what you just did, so they're the ones the setting turns off.
 * error, warning, notice and action always show: something went wrong, needs a choice, or is news (like a reminder).
 */
export const toast = {
  error: (m: string) => push('error', m),
  success: (m: string) => confirm(() => push('success', m)),
  info: (m: string) => confirm(() => push('info', m)),
  /** Info that always shows, even with confirmation messages off: an answer to something you asked, or a reminder. */
  notice: (m: string) => push('info', m),
  warning: (m: string) => push('warning', m),
  /**
   * Info with an Undo button, shown a little longer. While the change is still the latest, the button undoes it the
   * same way Ctrl+Z does (so Ctrl+Shift+Z can bring it back); after other changes, `run` puts back just this one.
   */
  undo: (m: string, run: () => void) => {
    const step = latestStep()
    confirm(() => push('info', m, 6000, { label: 'Undo', run: () => undoStep(step) || run() }))
  },
  /** Info with a button of its own, shown long enough to read and press. */
  action: (m: string, label: string, run: () => void) => push('info', m, 10000, { label, run }),
  /** A confirmation with a button (Undone · Redo), skipped like the others when confirmation messages are off. */
  done: (m: string, label: string, run: () => void) => confirm(() => push('info', m, 6000, { label, run })),
  /** Error, success, or (when it went over a month's limit) a warning. */
  result: (r: Result, success: string) =>
    !r.ok ? push('error', r.error) : r.warning ? push('warning', `${success} ${r.warning}`) : toast.success(success),
}
