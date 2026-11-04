import type { ReactNode } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, type LucideIcon } from 'lucide-react'
import { Switch } from '../CurrencyMenu'

/** A titled block of settings. */
export function Group({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">{title}</h3>
      {hint && <p className="mt-1 px-1 text-[13px] leading-relaxed text-zinc-500">{hint}</p>}
      <div className="mt-2.5 divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
        {children}
      </div>
    </section>
  )
}

/** The anchor search jumps to (see `SEARCH` in search.ts). */
const anchor = (id?: string) => (id ? `set-${id}` : undefined)

type RowProps = {
  id?: string
  title: ReactNode
  hint?: ReactNode
  /** The control goes under the text instead of beside it, for wide ones */
  stacked?: boolean
  children?: ReactNode
}

/** One setting: what it is on the left, its control on the right (or underneath). */
export function Row({ id, title, hint, stacked, children }: RowProps) {
  return (
    <div id={anchor(id)} className={`scroll-mt-4 gap-x-4 gap-y-2.5 px-4 py-3.5 ${stacked ? 'space-y-2.5' : 'flex flex-wrap items-center justify-between'}`}>
      {/* The text keeps at least 12rem: on a narrow screen a wide control moves under it rather than squeezing it. */}
      <div className={`min-w-0 ${stacked ? '' : 'flex-1 basis-48'}`}>
        <p className="text-sm font-medium text-zinc-100">{title}</p>
        {hint && <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">{hint}</p>}
      </div>
      {children && <div className={stacked ? '' : 'max-w-full shrink-0'}>{children}</div>}
    </div>
  )
}

export function ToggleRow({ id, title, hint, on, onChange }: { id?: string; title: string; hint?: ReactNode; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <Row id={id} title={title} hint={hint}>
      <Switch on={on} onChange={onChange} label={title} />
    </Row>
  )
}

/** A row that does something when pressed. `value`: what it's set to, shown on the right. `href`: opens that address instead. */
export function ActionRow({ id, icon: Icon, title, hint, value, onClick, href, danger }: {
  id?: string
  icon?: LucideIcon
  title: string
  hint?: ReactNode
  value?: ReactNode
  onClick?: () => void
  href?: string
  danger?: boolean
}) {
  const body = (
    <>
      {Icon && (
        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${danger ? 'bg-red-500/10 text-red-300' : 'bg-white/[0.05] text-zinc-300'}`}>
          <Icon className="h-4 w-4" />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={`block text-sm font-medium ${danger ? 'text-red-200' : 'text-zinc-100'}`}>{title}</span>
        {hint && <span className="mt-0.5 block text-[13px] leading-snug text-zinc-500">{hint}</span>}
      </span>
      {value !== undefined && <span className="shrink-0 text-[13px] tabular-nums text-zinc-500">{value}</span>}
      {href ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-zinc-600" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />}
    </>
  )
  const cls = 'flex w-full scroll-mt-4 items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.04] focus-visible:bg-white/[0.04] focus-visible:outline-none'
  return href ? (
    <a id={anchor(id)} href={href} target="_blank" rel="noreferrer" className={cls}>
      {body}
    </a>
  ) : (
    <button id={anchor(id)} type="button" onClick={onClick} className={cls}>
      {body}
    </button>
  )
}

/** Pick one of a few choices, all in view. */
export function Segmented<T extends string | number>({ value, options, onChange, label, full }: {
  value: T
  options: { id: T; label: string }[]
  onChange: (v: T) => void
  label: string
  /** Stretch across the row */
  full?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`${full ? 'flex' : 'inline-flex'} max-w-full gap-0.5 rounded-xl border border-white/10 bg-black/20 p-0.5`}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.id)}
            className={`h-8 min-w-0 whitespace-nowrap rounded-[0.6rem] px-2.5 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60 ${full ? 'flex-1' : ''} ${
              on ? 'bg-indigo-500/25 text-white ring-1 ring-indigo-400/40' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/** Pick one of many choices. */
export function Select<T extends string | number>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <span className="relative inline-flex max-w-[11rem]">
      <select
        aria-label={label}
        value={String(value)}
        onChange={(e) => {
          const picked = options.find((o) => String(o.id) === e.target.value)
          if (picked) onChange(picked.id)
        }}
        className="h-9 w-full cursor-pointer appearance-none truncate rounded-xl border border-white/10 bg-black/30 pl-3 pr-8 text-[13px] font-medium text-zinc-100 outline-none transition [color-scheme:dark] hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
      >
        {options.map((o) => (
          <option key={o.id} value={String(o.id)} className="bg-[#0e1016]">
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-500" />
    </span>
  )
}

const TONES = {
  primary: 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-lg shadow-indigo-500/20 hover:brightness-110',
  plain: 'border border-white/10 text-zinc-200 hover:bg-white/5 hover:text-white',
  danger: 'bg-red-500/90 text-white hover:bg-red-500',
}

export function Button({ tone = 'plain', icon: Icon, children, className = '', ...rest }: {
  tone?: keyof typeof TONES
  icon?: LucideIcon
  children: ReactNode
  className?: string
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'children'>) {
  return (
    <button type="button" {...rest} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${TONES[tone]} ${className}`}>
      {Icon && <Icon className="h-3.5 w-3.5 shrink-0" />}
      {children}
    </button>
  )
}
