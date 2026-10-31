import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Check, Copy, Loader2, X, type LucideIcon } from 'lucide-react'
import { GROUP, MEMBERSHIP_LABEL, groupOf, membershipOf } from './data'
import type { Sub } from './api'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

// ---------------------------------------------------------------- buttons

type Tone = 'primary' | 'ghost' | 'danger' | 'subtle'
const TONE: Record<Tone, string> = {
  primary: 'bg-white text-zinc-950 hover:bg-zinc-200 shadow-sm shadow-white/10',
  ghost: 'border border-white/10 bg-white/[0.03] text-zinc-200 hover:border-white/20 hover:bg-white/[0.07] hover:text-white',
  subtle: 'text-zinc-400 hover:bg-white/[0.06] hover:text-white',
  danger: 'border border-rose-500/30 bg-rose-500/10 text-rose-200 hover:border-rose-400/50 hover:bg-rose-500/20',
}

export function Button({
  tone = 'ghost',
  icon: Icon,
  busy,
  size = 'md',
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; icon?: LucideIcon; busy?: boolean; size?: 'sm' | 'md' }) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || busy}
      className={cx(
        'inline-flex shrink-0 items-center justify-center gap-2 rounded-xl font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        TONE[tone],
        className,
      )}
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : Icon && <Icon className="h-4 w-4" />}
      {children}
    </button>
  )
}

export function CopyButton({ text, label = 'Copy' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(text)
        setDone(true)
        setTimeout(() => setDone(false), 1400)
      }}
      className="inline-grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
      title={label}
      aria-label={label}
    >
      {done ? <Check className="h-3.5 w-3.5 text-emerald-300" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  )
}

// ---------------------------------------------------------------- surfaces

export function Card({ title, action, children, className, pad = true }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('rounded-2xl border border-white/[0.07] bg-[#0e1016]/80 shadow-xl shadow-black/20 backdrop-blur', className)}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3.5">
          <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
          {action}
        </header>
      )}
      <div className={pad ? 'p-5' : ''}>{children}</div>
    </section>
  )
}

export function Stat({ label, value, hint, icon: Icon, accent = 'text-indigo-300 bg-indigo-400/10' }: { label: string; value: ReactNode; hint?: ReactNode; icon: LucideIcon; accent?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0e1016]/80 p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium text-zinc-400">{label}</p>
        <span className={cx('grid h-8 w-8 place-items-center rounded-lg', accent)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-white tabular-nums sm:text-[28px]">{value}</p>
      {hint && <p className="mt-1 text-xs text-zinc-500">{hint}</p>}
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-white/[0.05]', className)} />
}

export function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/[0.04] text-zinc-500">
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-sm font-medium text-zinc-200">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-zinc-500">{text}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- people

export function Avatar({ url, name, size = 'h-9 w-9' }: { url: string | null; name: string; size?: string }) {
  const [broken, setBroken] = useState(false)
  return (
    <span className={cx('grid shrink-0 place-items-center overflow-hidden rounded-full border border-white/10', size)}>
      {url && !broken ? (
        <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
      ) : (
        <span className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-500 to-emerald-500 text-[0.8em] font-semibold text-white">
          {name.charAt(0).toUpperCase()}
        </span>
      )}
    </span>
  )
}

/** Membership status: a coloured dot and the word (never colour alone). */
export function StatusChip({ sub, disabled }: { sub: Sub; disabled?: boolean }) {
  if (disabled) return <span className="inline-flex items-center gap-1.5 rounded-full bg-zinc-500/15 px-2 py-0.5 text-xs font-medium text-zinc-300 ring-1 ring-inset ring-zinc-400/30">Disabled</span>
  const m = membershipOf(sub)
  const g = GROUP[groupOf(m)]
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', g.chip)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: g.hex }} />
      {MEMBERSHIP_LABEL[m]}
    </span>
  )
}

// ---------------------------------------------------------------- dialogs

export function Dialog({ title, children, onClose, footer, width = 'max-w-md' }: { title: ReactNode; children: ReactNode; onClose: () => void; footer?: ReactNode; width?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('animate-pop relative w-full overflow-hidden rounded-t-3xl border border-white/10 bg-[#0e1016] shadow-2xl shadow-black/60 sm:rounded-3xl', width)}>
        <div className="flex items-start justify-between gap-4 px-6 pt-5">
          <h2 className="text-base font-semibold text-white">{title}</h2>
          <button onClick={onClose} className="-mr-2 -mt-1 rounded-lg p-2 text-zinc-400 transition hover:bg-white/5 hover:text-white" aria-label="Close">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-4 text-sm text-zinc-300">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.06] bg-black/20 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}

/** "Are you sure?" with an optional word to type first (for things that can't be undone). */
export function Confirm({
  title,
  text,
  confirmLabel,
  danger,
  typeToConfirm,
  onConfirm,
  onClose,
}: {
  title: string
  text: ReactNode
  confirmLabel: string
  danger?: boolean
  typeToConfirm?: string
  onConfirm: (typed: string) => Promise<void> | void
  onClose: () => void
}) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => ref.current?.focus(), [])
  const ok = !typeToConfirm || typed.trim().toLowerCase() === typeToConfirm.toLowerCase()
  const go = async () => {
    if (!ok || busy) return
    setBusy(true)
    try {
      await onConfirm(typed)
      onClose()
    } catch {
      // Already reported (a toast); keep the dialog open to try again.
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone={danger ? 'danger' : 'primary'} disabled={!ok} busy={busy} onClick={go}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="leading-relaxed">{text}</div>
        {typeToConfirm && (
          <label className="block">
            <span className="text-xs text-zinc-500">
              Type <span className="font-mono text-zinc-300">{typeToConfirm}</span> to confirm
            </span>
            <input
              ref={ref}
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void go()}
              className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-white outline-none transition focus:border-rose-400/50 focus:ring-2 focus:ring-rose-500/20"
              autoComplete="off"
              spellCheck={false}
            />
          </label>
        )}
      </div>
    </Dialog>
  )
}

// ---------------------------------------------------------------- tabs

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string; icon?: LucideIcon; count?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-1 overflow-x-auto border-b border-white/[0.07] px-4 sm:mx-0 sm:px-0" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cx(
            'relative inline-flex h-11 shrink-0 items-center gap-2 px-3 text-sm font-medium transition',
            value === t.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-200',
          )}
        >
          {t.icon && <t.icon className="h-4 w-4" />}
          {t.label}
          {t.count != null && <span className="rounded-md bg-white/[0.07] px-1.5 py-px text-[11px] tabular-nums text-zinc-400">{t.count}</span>}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400" />}
        </button>
      ))}
    </div>
  )
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { id: T; label: string; count?: number }[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="scrollbar-none flex max-w-full gap-0.5 overflow-x-auto rounded-xl border border-white/[0.07] bg-black/20 p-0.5">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={cx(
            'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition',
            value === o.id ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-100',
          )}
        >
          {o.label}
          {o.count != null && <span className="tabular-nums text-zinc-500">{o.count}</span>}
        </button>
      ))}
    </div>
  )
}
