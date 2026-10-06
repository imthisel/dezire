import { useEffect, useState } from 'react'
import { PESO, fitText, parseMoney, plain } from '../lib/money'

interface Props {
  value: number | null
  onChange: (v: number | null) => void
  placeholder?: string
  /** When true, an empty box means null (e.g. "earned" falls back to the goal). */
  nullable?: boolean
  className?: string
  ariaLabel?: string
  autoFocus?: boolean
  size?: 'sm' | 'md'
}

const toText = (v: number | null, nullable?: boolean) => (v === null || (v === 0 && !nullable) ? '' : plain(v))

/** Money box that accepts "100k", "1.5m", "250,000" and updates totals as you type. */
export function MoneyInput({ value, onChange, placeholder = '0', nullable, className = '', ariaLabel, autoFocus, size = 'sm' }: Props) {
  const symbol = PESO
  const [text, setText] = useState(() => toText(value, nullable))
  const [focused, setFocused] = useState(false)
  const [bad, setBad] = useState(false)

  useEffect(() => {
    if (!focused) setText(toText(value, nullable))
  }, [value, focused, nullable])

  function handle(t: string) {
    setText(t)
    const p = parseMoney(t)
    if (p === null) {
      setBad(false)
      onChange(nullable ? null : 0)
    } else if (Number.isNaN(p)) setBad(true)
    else {
      setBad(false)
      onChange(p)
    }
  }

  // (Phones always use 16px in inputs so iPhones don't zoom in; see index.css.)
  const pad = size === 'md' ? 'h-11 pl-8 text-base' : `h-9 pl-6 ${fitText(text)}`

  return (
    <div className={`relative min-w-0 ${className}`}>
      <span
        className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-zinc-500 ${size === 'md' ? 'left-3 text-base' : 'left-2.5 text-xs'}`}
      >
        {symbol}
      </span>
      <input
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={bad}
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          setBad(false)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onChange={(e) => handle(e.target.value)}
        className={`w-full min-w-0 rounded-lg border bg-black/30 pr-2 font-medium tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:bg-black/50 ${pad} ${
          bad
            ? 'border-red-500/60 focus:ring-2 focus:ring-red-500/30'
            : 'border-white/10 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'
        }`}
      />
    </div>
  )
}
