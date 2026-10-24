import { useEffect, useLayoutEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'

interface Props {
  title: ReactNode
  subtitle?: ReactNode
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  width?: string
}

/** Open modals, newest last: Esc only closes the one on top (one can open over another). */
const open: object[] = []

/**
 * When a dialog closes, a copy of how it last looked stays on screen for a moment and slides / fades away,
 * so every dialog closes smoothly however it was closed (Esc, Save, Delete…) without touching its own logic.
 */
function leaveGently(node: HTMLElement, scrolls: number[]) {
  const ghost = node.cloneNode(true) as HTMLElement
  ghost.removeAttribute('role')
  ghost.setAttribute('aria-hidden', 'true')
  ghost.inert = true
  ghost.style.pointerEvents = 'none'
  const [backdrop, panel] = Array.from(ghost.children) as HTMLElement[]
  backdrop?.classList.remove('animate-fade')
  backdrop?.classList.add('animate-fade-out')
  panel?.classList.remove('animate-pop')
  panel?.classList.add('animate-sheet-out', 'sm:animate-pop-out')
  document.body.appendChild(ghost)
  // Same scroll position as the dialog had, so the copy matches exactly.
  ghost.querySelectorAll<HTMLElement>('.overflow-y-auto').forEach((el, i) => (el.scrollTop = scrolls[i] ?? 0))
  setTimeout(() => ghost.remove(), 240)
}

export function Modal({ title, subtitle, onClose, children, footer, width = 'max-w-xl' }: Props) {
  const root = useRef<HTMLDivElement>(null)

  // Runs while the dialog is still on screen, just before it's removed.
  useLayoutEffect(() => {
    const node = root.current
    return () => {
      if (!node) return
      const scrolls = Array.from(node.querySelectorAll<HTMLElement>('.overflow-y-auto'), (el) => el.scrollTop)
      // Only when it really went away (development mode also unmounts and remounts once to check effects).
      queueMicrotask(() => !node.isConnected && leaveGently(node, scrolls))
    }
  }, [])

  useEffect(() => {
    const me = {}
    open.push(me)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open[open.length - 1] === me && onClose()
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      open.splice(open.indexOf(me), 1)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [onClose])

  return createPortal(
    <div ref={root} className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div
        className={`animate-pop relative flex max-h-[92dvh] w-full ${width} flex-col overflow-hidden rounded-t-3xl border border-white/10 bg-[#0e1016] shadow-2xl shadow-black/60 sm:rounded-3xl`}
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-10 shrink-0 rounded-full bg-white/15 sm:hidden" />
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 pb-4 pt-3 sm:px-6 sm:py-5">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-zinc-400">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="-mr-2 rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">{children}</div>
        {footer && (
          <div className="border-t border-white/[0.06] bg-black/20 px-5 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-4">{footer}</div>
        )}
      </div>
    </div>,
    document.body,
  )
}
