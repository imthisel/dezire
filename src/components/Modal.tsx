import { useEffect, type ReactNode } from 'react'
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

export function Modal({ title, subtitle, onClose, children, footer, width = 'max-w-xl' }: Props) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
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
