import { create } from 'zustand'
import type { Result } from './lib/types'

export type Toast = { id: number; kind: 'error' | 'success' | 'info' | 'warning'; message: string }

let nextId = 1

export const useToasts = create<{ toasts: Toast[]; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

function push(kind: Toast['kind'], message: string, ms = kind === 'error' || kind === 'warning' ? 6000 : 2800) {
  const id = nextId++
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }))
  setTimeout(() => useToasts.getState().dismiss(id), ms)
}

export const toast = {
  error: (m: string) => push('error', m),
  success: (m: string) => push('success', m),
  info: (m: string) => push('info', m),
  warning: (m: string) => push('warning', m),
  /** Error, success, or (when it went over a month's limit) a warning. */
  result: (r: Result, success: string) =>
    !r.ok ? push('error', r.error) : r.warning ? push('warning', `${success} ${r.warning}`) : push('success', success),
}
