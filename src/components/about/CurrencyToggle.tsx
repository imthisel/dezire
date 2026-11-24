import { PHP_PER_USD, setAboutCurrency, useAboutCurrency, type AboutCurrency } from './currency'

const OPTIONS: { id: AboutCurrency; label: string }[] = [
  { id: 'PHP', label: '₱ PHP' },
  { id: 'USD', label: '$ USD' },
]

/**
 * The About page's small PHP / USD switch. Every amount on the page follows it.
 * `compact`: a little narrower on phones (the Try it now toolbar, which has to fit on one row).
 */
export function CurrencyToggle({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const cur = useAboutCurrency((s) => s.cur)
  return (
    <div
      role="group"
      aria-label="Currency"
      title={`US dollars at ₱${PHP_PER_USD} per $1 (BSP reference rate, Nov 24, 2026)`}
      className={`inline-flex h-7 shrink-0 items-center rounded-full border border-white/10 bg-white/[0.03] p-0.5 ${className}`}
    >
      {OPTIONS.map((o) => (
        <button
          key={o.id}
          type="button"
          aria-pressed={cur === o.id}
          onClick={() => setAboutCurrency(o.id)}
          className={`h-6 whitespace-nowrap rounded-full text-[11px] font-semibold tabular-nums transition ${compact ? 'px-2 sm:px-2.5' : 'px-2.5'} ${
            cur === o.id ? 'bg-brand-600 text-white shadow-[0_4px_14px_-6px_rgb(58_109_240/0.8)]' : 'text-zinc-400 hover:text-white'
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
