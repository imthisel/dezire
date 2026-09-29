import { create } from 'zustand'

export type Toast = { id: number; kind: 'error' | 'success' | 'info'; message: string }

let nextId = 1

export const useToasts = create<{ toasts: Toast[]; dismiss: (id: number) => void }>((set) => ({
  toasts: [],
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

function push(kind: Toast['kind'], message: string, ms = kind === 'error' ? 6000 : 2800) {
  const id = nextId++
  useToasts.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, message }] }))
  setTimeout(() => useToasts.getState().dismiss(id), ms)
}

export const toast = {
  error: (m: string) => push('error', m),
  success: (m: string) => push('success', m),
  info: (m: string) => push('info', m),
}
