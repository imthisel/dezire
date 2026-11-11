import { useEffect, type KeyboardEvent, type ReactNode } from 'react'
import { Eye, EyeClosed } from 'lucide-react'
import { useStore } from '../store'
import { toast } from '../toast'

/** Whether overview card `id` is blurred (remembered on this device). */
export const useBlurred = (id: string) => useStore((s) => s.blurred.includes(id))

const stopPeek = () => useStore.getState().peeking !== null && useStore.setState({ peeking: null })

/**
 * The button that blurs or unblurs one card. On a card it only shows on hover (always on touch screens,
 * and always while the card is blurred, so it's clear how to undo it). `label`: also show "Blur" / "Unblur" as text.
 */
export function BlurToggle({ id, name, label, small, className = '' }: { id: string; name: string; label?: boolean; small?: boolean; className?: string }) {
  const on = useBlurred(id)
  const text = on ? `Unblur ${name}` : `Blur ${name}`
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        stopPeek()
        useStore.getState().toggleBlur(id)
      }}
      aria-pressed={on}
      aria-label={text}
      title={text}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg border text-xs font-medium transition focus-visible:opacity-100 ${label ? 'h-8 px-2' : small ? 'h-6 w-6' : 'h-7 w-7'} ${
        on
          ? 'border-violet-400/30 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25'
          : label
            ? 'border-white/10 text-zinc-400 hover:border-white/20 hover:bg-white/5 hover:text-white'
            : 'border-transparent text-zinc-500 opacity-0 hover:bg-white/10 hover:text-white group-hover/blur:opacity-100 [@media(hover:none)]:opacity-100'
      } ${className}`}
    >
      {on ? <Eye className="h-3.5 w-3.5" /> : <EyeClosed className="h-3.5 w-3.5" />}
      {label && <span className="hidden sm:inline">{on ? 'Unblur' : 'Blur'}</span>}
    </button>
  )
}

/**
 * Wraps the part of a card that holds amounts. Blurred, it can't be read (and isn't read out or selectable),
 * and pressing and holding it peeks for as long as it's held. Several pieces can share one `id`: they blur and peek together;
 * only one of them needs `hint` (the "Hold to peek" button). `compact`: a small card, so just the icon.
 */
export function Blurred({ id, name, children, hint = true, compact, className = '', innerClassName = '' }: { id: string; name: string; children: ReactNode; hint?: boolean; compact?: boolean; className?: string; innerClassName?: string }) {
  const on = useBlurred(id)
  const peek = useStore((s) => s.peeking === id)
  const hidden = on && !peek

  return (
    <div className={`relative ${className}`}>
      <div
        aria-hidden={hidden || undefined}
        inert={hidden || undefined}
        className={`transition-[filter,opacity] duration-300 ease-out ${innerClassName} ${hidden ? 'pointer-events-none select-none opacity-70 blur-[10px] saturate-50' : ''}`}
      >
        {children}
      </div>
      {on && hint && <Peek id={id} name={name} peek={peek} compact={compact} />}
    </div>
  )
}

function Peek({ id, name, peek, compact }: { id: string; name: string; peek: boolean; compact?: boolean }) {
  const start = () => useStore.setState({ peeking: id })
  // Leaving the page or switching tabs mid-peek blurs it again.
  useEffect(() => {
    if (!peek) return
    const end = () => stopPeek()
    window.addEventListener('blur', end)
    document.addEventListener('visibilitychange', end)
    return () => {
      window.removeEventListener('blur', end)
      document.removeEventListener('visibilitychange', end)
    }
  }, [peek])
  useEffect(() => () => void (useStore.getState().peeking === id && stopPeek()), [id])

  const key = (e: KeyboardEvent, down: boolean) => {
    if (e.key !== ' ' && e.key !== 'Enter') return
    e.preventDefault()
    if (down && !e.repeat) start()
    if (!down) stopPeek()
  }

  return (
    <button
      type="button"
      onPointerDown={(e) => {
        if (e.button !== 0) return
        e.currentTarget.setPointerCapture(e.pointerId)
        start()
      }}
      onPointerUp={stopPeek}
      onPointerCancel={stopPeek}
      onLostPointerCapture={stopPeek}
      onKeyDown={(e) => key(e, true)}
      onKeyUp={(e) => key(e, false)}
      onBlur={stopPeek}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
      aria-label={`${name} is blurred. Press and hold to peek.`}
      className="absolute inset-0 grid cursor-pointer select-none place-items-center rounded-xl outline-none [-webkit-touch-callout:none] [-webkit-tap-highlight-color:transparent] focus-visible:ring-2 focus-visible:ring-violet-400/50"
    >
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-[#0e1016]/80 font-medium text-zinc-200 shadow-lg shadow-black/40 backdrop-blur-sm transition duration-200 ${
          compact ? 'p-1.5' : 'px-3 py-1.5 text-xs'
        } ${peek ? 'scale-90 opacity-0' : 'opacity-100'}`}
      >
        <EyeClosed className={compact ? 'h-3.5 w-3.5 text-violet-200' : 'h-3.5 w-3.5 shrink-0 text-violet-200'} />
        {!compact && <span className="whitespace-nowrap">Hold to peek</span>}
      </span>
    </button>
  )
}

/** "Blur all" / "Unblur all" for a page's overview cards. */
export function BlurAll({ ids, what, className = 'h-10 w-10' }: { ids: string[]; what: string; className?: string }) {
  const all = useStore((s) => ids.every((id) => s.blurred.includes(id)))
  const text = all ? `Unblur ${what}` : `Blur ${what}`
  return (
    <button
      type="button"
      onClick={() => {
        const s = useStore.getState()
        const before = s.blurred
        stopPeek()
        s.setBlurred(ids, !all)
        if (!all) toast.undo('Overview blurred. Press and hold a card to peek.', () => useStore.setState({ blurred: before }))
      }}
      aria-pressed={all}
      aria-label={text}
      title={text}
      className={`grid ${className} shrink-0 place-items-center rounded-xl border transition ${
        all ? 'border-violet-400/30 bg-violet-500/15 text-violet-100 hover:bg-violet-500/25' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
      }`}
    >
      {all ? <Eye className="h-4 w-4" /> : <EyeClosed className="h-4 w-4" />}
    </button>
  )
}
