import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeftRight, ChevronDown, Eye, EyeOff } from 'lucide-react'
import { useCurrency, useStore } from '../store'
import { CURRENCY_PRESETS, fmt, fmtAlt, type Currency } from '../lib/money'

/** Header control: main + alternative currency, with a quick show/hide for the alternative amounts. */
export function CurrencyMenu({ phone }: { phone: boolean }) {
  const { main, alt } = useCurrency()
  const setAlt = useStore((s) => s.setAltCurrency)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  const ease = 'duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)]'

  return (
    <div ref={root} className={`relative ${phone ? 'min-w-0 flex-1' : ''}`}>
      <div
        className={`flex items-center rounded-xl border bg-white/[0.03] transition ${phone ? 'h-10' : 'h-9'} ${
          open ? 'border-indigo-400/50 ring-2 ring-indigo-500/20' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-haspopup="dialog"
          title="Currency settings"
          className="group flex h-full min-w-0 flex-1 items-center gap-2 rounded-l-xl pl-1.5 pr-2 text-sm font-medium text-zinc-300 transition hover:text-white"
        >
          {/* Two overlapping coins; the second slides away when the alternative currency is hidden. */}
          <span className="relative flex h-6 shrink-0 items-center">
            <Coin symbol={main.symbol} cls="z-10 bg-gradient-to-br from-indigo-400 to-indigo-600 text-white shadow-md shadow-indigo-500/30" />
            <span className={`overflow-hidden transition-all ${ease} ${alt.show ? 'ml-[-6px] w-6 opacity-100' : 'ml-0 w-0 opacity-0'}`}>
              <Coin symbol={alt.symbol} cls="bg-gradient-to-br from-emerald-400 to-emerald-600 text-white ring-2 ring-[#0b0d12]" />
            </span>
          </span>
          <span className="grid min-w-0 flex-1 overflow-hidden text-left">
            <span className={`col-start-1 row-start-1 truncate tabular-nums transition-all ${ease} ${alt.show ? 'translate-y-0 opacity-100' : '-translate-y-2 opacity-0'}`}>
              {fmt(alt.rate, main.symbol)} <span className="text-zinc-500">= {alt.symbol}1</span>
            </span>
            <span
              className={`col-start-1 row-start-1 truncate text-zinc-400 transition-all ${ease} ${alt.show ? 'translate-y-2 opacity-0' : 'translate-y-0 opacity-100'}`}
              aria-hidden={alt.show}
            >
              {main.code} only
            </span>
          </span>
          <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
        <span className="h-5 w-px bg-white/10" />
        <button
          onClick={() => setAlt({ show: !alt.show })}
          title={alt.show ? `Hide ${alt.code} amounts` : `Show ${alt.code} amounts`}
          aria-label={alt.show ? `Hide ${alt.code} amounts` : `Show ${alt.code} amounts`}
          aria-pressed={alt.show}
          className={`relative grid h-full shrink-0 place-items-center rounded-r-xl transition hover:bg-white/[0.05] ${phone ? 'w-10' : 'w-9'} ${
            alt.show ? 'text-emerald-300' : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          <Eye className={`absolute h-4 w-4 transition-all ${ease} ${alt.show ? 'scale-100 rotate-0 opacity-100' : 'scale-50 -rotate-45 opacity-0'}`} />
          <EyeOff className={`absolute h-4 w-4 transition-all ${ease} ${alt.show ? 'scale-50 rotate-45 opacity-0' : 'scale-100 rotate-0 opacity-100'}`} />
        </button>
      </div>

      {open && <Panel phone={phone} />}
    </div>
  )
}

function Panel({ phone }: { phone: boolean }) {
  const { main, alt } = useCurrency()
  const setMain = useStore((s) => s.setMainCurrency)
  const setAlt = useStore((s) => s.setAltCurrency)
  const sample = 100000

  return (
    <div
      role="dialog"
      aria-label="Currency settings"
      className={`animate-menu absolute top-full z-50 mt-2 origin-top overflow-hidden rounded-2xl border border-white/10 bg-[#0e1016]/95 shadow-2xl shadow-black/60 backdrop-blur-xl ${
        phone ? 'left-0 w-[calc(100vw-2rem)] max-w-sm' : 'right-0 w-[23rem]'
      }`}
    >
      <div className="border-b border-white/[0.06] px-4 pb-3 pt-4">
        <p className="text-sm font-semibold text-white">Currency</p>
        <p className="mt-0.5 text-xs text-zinc-500">Pick what your money is in, and a second currency to compare it with.</p>
      </div>

      {/* Main currency */}
      <section className="space-y-3 border-b border-white/[0.06] p-4">
        <SectionTitle dot="bg-indigo-400">Main currency</SectionTitle>
        <CurrencyFields value={main} onChange={setMain} accent="indigo" />
        <Presets value={main} onPick={setMain} accent="indigo" />
        <p className="text-[11px] leading-relaxed text-zinc-500">All amounts are saved in this currency. Changing it only changes the sign, not the numbers.</p>
      </section>

      {/* Alternative currency */}
      <section className="p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <SectionTitle dot="bg-emerald-400">Alternative currency</SectionTitle>
            <p className="mt-0.5 truncate text-[11px] text-zinc-500">{alt.show ? `Shown as ≈ amounts under each total` : `Hidden everywhere`}</p>
          </div>
          <Switch on={alt.show} onChange={(show) => setAlt({ show })} label={`Show ${alt.code} amounts`} />
        </div>

        <div
          className={`grid transition-all duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
            alt.show ? 'grid-rows-[1fr] opacity-100' : 'pointer-events-none grid-rows-[0fr] opacity-0'
          }`}
          aria-hidden={!alt.show}
          inert={!alt.show}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="space-y-3 pt-3">
              <CurrencyFields value={alt} onChange={setAlt} accent="emerald" />
              <Presets value={alt} onPick={setAlt} accent="emerald" exclude={main.code} />
              <RateInput key={`${alt.code}-${main.code}`} />

              <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-r from-indigo-500/[0.08] to-emerald-500/[0.08] px-3 py-2.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Preview</span>
                <span className="truncate text-sm tabular-nums">
                  <span className="font-semibold text-white">{fmt(sample, main.symbol)}</span>
                  <span className="text-zinc-500"> ≈ </span>
                  <span className="font-semibold text-emerald-300">{fmtAlt(sample, alt)}</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionTitle({ dot, children }: { dot: string; children: ReactNode }) {
  return (
    <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
      <span className={`h-1.5 w-1.5 rounded-full ${dot}`} />
      {children}
    </p>
  )
}

function Coin({ symbol, cls }: { symbol: string; cls: string }) {
  return (
    <span className={`relative grid h-6 w-6 shrink-0 place-items-center rounded-full font-semibold leading-none ${symbol.length > 1 ? 'text-[9px]' : 'text-xs'} ${cls}`}>
      {symbol}
    </span>
  )
}

const ACCENT = {
  indigo: { focus: 'focus-within:border-indigo-400/60 focus-within:ring-indigo-500/20', on: 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' },
  emerald: { focus: 'focus-within:border-emerald-400/60 focus-within:ring-emerald-500/20', on: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100' },
}

/** Sign + code boxes. Empty boxes aren't saved; they go back to the current value when you leave them. */
function CurrencyFields({ value, onChange, accent }: { value: Currency; onChange: (p: Partial<Currency>) => void; accent: keyof typeof ACCENT }) {
  return (
    <div className="grid grid-cols-[5.5rem_1fr] gap-2">
      <Field label="Sign" accent={accent}>
        <DraftInput value={value.symbol} max={4} onCommit={(symbol) => onChange({ symbol })} className="text-center text-lg font-semibold" ariaLabel="Currency sign" />
      </Field>
      <Field label="Code" accent={accent}>
        <DraftInput
          value={value.code}
          max={5}
          upper
          onCommit={(code) => onChange({ code })}
          className="font-medium tracking-wider"
          ariaLabel="Currency code"
        />
      </Field>
    </div>
  )
}

function Field({ label, accent, children }: { label: string; accent: keyof typeof ACCENT; children: ReactNode }) {
  return (
    <label
      className={`flex h-12 flex-col justify-center rounded-xl border border-white/10 bg-black/30 px-3 transition focus-within:bg-black/50 focus-within:ring-2 hover:border-white/20 ${ACCENT[accent].focus}`}
    >
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  )
}

function DraftInput(props: { value: string; max: number; upper?: boolean; onCommit: (v: string) => void; className?: string; ariaLabel: string }) {
  const [text, setText] = useState(props.value)
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(props.value)
  }, [props.value, focused])
  return (
    <input
      value={text}
      maxLength={props.max}
      aria-label={props.ariaLabel}
      autoComplete="off"
      spellCheck={false}
      onFocus={(e) => {
        setFocused(true)
        e.currentTarget.select()
      }}
      onBlur={() => setFocused(false)}
      onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      onChange={(e) => {
        const t = props.upper ? e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '') : e.target.value.replace(/\s/g, '')
        setText(t)
        if (t) props.onCommit(t)
      }}
      className={`w-full min-w-0 bg-transparent leading-tight text-white outline-none ${props.className ?? ''}`}
    />
  )
}

function Presets({ value, onPick, accent, exclude }: { value: Currency; onPick: (c: Currency) => void; accent: keyof typeof ACCENT; exclude?: string }) {
  return (
    <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4">
      {CURRENCY_PRESETS.filter((c) => c.code !== exclude).map((c) => {
        const on = c.code === value.code && c.symbol === value.symbol
        return (
          <button
            key={c.code}
            onClick={() => onPick(c)}
            aria-pressed={on}
            className={`flex h-7 shrink-0 items-center gap-1 rounded-lg border px-2 text-xs font-medium transition active:scale-95 ${
              on ? ACCENT[accent].on : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
            }`}
          >
            <span className="font-semibold">{c.symbol}</span>
            <span className="text-[10px] tracking-wider opacity-70">{c.code}</span>
          </button>
        )
      })}
    </div>
  )
}

/** "1 $ = ₱ [62.7]" */
function RateInput() {
  const { main, alt } = useCurrency()
  const setAlt = useStore((s) => s.setAltCurrency)
  const [text, setText] = useState(String(alt.rate))
  const [focused, setFocused] = useState(false)
  useEffect(() => {
    if (!focused) setText(String(alt.rate))
  }, [alt.rate, focused])

  return (
    <div>
      <p className="mb-1.5 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        <ArrowLeftRight className="h-3 w-3" /> Exchange rate
      </p>
      <label className="flex h-11 items-center gap-2 rounded-xl border border-white/10 bg-black/30 px-3 text-sm transition focus-within:border-emerald-400/60 focus-within:bg-black/50 focus-within:ring-2 focus-within:ring-emerald-500/20 hover:border-white/20">
        <span className="shrink-0 tabular-nums text-zinc-400">
          1 <span className="font-semibold text-emerald-300">{alt.code}</span> =
        </span>
        <span className="shrink-0 font-semibold text-zinc-300">{main.symbol}</span>
        <input
          inputMode="decimal"
          value={text}
          aria-label={`${main.code} per 1 ${alt.code}`}
          onFocus={(e) => {
            setFocused(true)
            e.currentTarget.select()
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          onChange={(e) => {
            const t = e.target.value.replace(/[^\d.]/g, '')
            setText(t)
            if (parseFloat(t) > 0) setAlt({ rate: parseFloat(t) })
          }}
          className="w-full min-w-0 bg-transparent font-semibold tabular-nums text-white outline-none"
        />
        <span className="shrink-0 text-xs text-zinc-500">{main.code}</span>
      </label>
    </div>
  )
}

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 ${
        on ? 'border-emerald-400/40 bg-emerald-500 shadow-[0_0_16px_-2px] shadow-emerald-500/50' : 'border-white/10 bg-white/10'
      }`}
    >
      <span
        className={`absolute left-[3px] top-1/2 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow-md shadow-black/30 transition-transform duration-[380ms] ease-[cubic-bezier(0.34,1.56,0.64,1)] ${
          on ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
