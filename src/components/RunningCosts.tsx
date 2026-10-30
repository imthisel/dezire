import { useState } from 'react'
import { ChevronDown, Fuel, Gauge, Route, Wrench } from 'lucide-react'
import { useAlt, useFmt, useStore } from '../store'
import { fuelPerYear, litersPerYear, runningPerYear } from '../lib/running'
import { plain } from '../lib/money'
import type { RunningCosts } from '../lib/types'
import { MoneyInput } from './MoneyInput'

const KM_PRESETS = [5000, 10000, 15000, 20000]

/** What the running-cost boxes hold while being typed (km boxes keep exactly what's typed). */
export type RunningDraft = { maintenance: number | null; kmPerYear: string; kmPerLiter: string; fuelPrice: number | null }

export const draftOf = (r: RunningCosts | undefined, fuelPrice: number): RunningDraft => ({
  maintenance: r?.maintenance || null,
  kmPerYear: r?.kmPerYear ? String(r.kmPerYear) : '',
  kmPerLiter: r?.kmPerLiter ? String(r.kmPerLiter) : '',
  fuelPrice: r?.fuelPrice || fuelPrice || null,
})

export const runningOf = (d: RunningDraft): RunningCosts => ({
  maintenance: d.maintenance ?? 0,
  kmPerYear: parseFloat(d.kmPerYear) || 0,
  kmPerLiter: parseFloat(d.kmPerLiter) || 0,
  fuelPrice: d.fuelPrice ?? 0,
})

const box =
  'h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-base tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'

/** Add / edit item, vehicles: an optional, folded section for what the car costs to run each year. */
export function RunningCostsField({ value, onChange, startOpen }: { value: RunningDraft; onChange: (d: RunningDraft) => void; startOpen: boolean }) {
  const f = useFmt()
  const u = useAlt()
  const altCode = useStore((s) => s.currency.alt.code)
  const [open, setOpen] = useState(startOpen)
  const r = runningOf(value)
  const fuel = fuelPerYear(r)
  const total = runningPerYear(r)
  const liters = litersPerYear(r)
  const set = (patch: Partial<RunningDraft>) => onChange({ ...value, ...patch })
  const digits = (t: string) => t.replace(/[^\d.]/g, '')

  return (
    <section className="animate-fade">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex w-full items-center gap-2.5 text-left">
        <span className={`grid h-6 w-6 place-items-center rounded-full transition ${total > 0 ? 'bg-orange-400/20 text-orange-200' : 'bg-white/10 text-zinc-300'}`}>
          <Fuel className="h-3.5 w-3.5" />
        </span>
        <span className="text-sm font-semibold text-zinc-200">Yearly running costs</span>
        <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">advanced · optional</span>
        {!open && total > 0 && <span className="min-w-0 flex-1 truncate text-right text-xs tabular-nums text-orange-200/80">≈ {f(total, true)} a year</span>}
        <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:text-zinc-300 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-fade mt-3 space-y-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-3.5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <Wrench className="h-3.5 w-3.5 text-zinc-500" /> Maintenance a year
              </span>
              <MoneyInput value={value.maintenance} nullable onChange={(v) => set({ maintenance: v })} placeholder="e.g. 30k" size="md" ariaLabel="Maintenance a year" />
              <span className="mt-1 block text-[11px] text-zinc-500">Servicing, tyres, insurance, registration…</span>
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <Fuel className="h-3.5 w-3.5 text-zinc-500" /> Fuel price per litre
              </span>
              <MoneyInput value={value.fuelPrice} nullable onChange={(v) => set({ fuelPrice: v })} placeholder="e.g. 65" size="md" ariaLabel="Fuel price per litre" />
              <span className="mt-1 block text-[11px] text-zinc-500">Remembered for your next car</span>
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <Route className="h-3.5 w-3.5 text-zinc-500" /> Km you’ll drive a year
              </span>
              <div className="relative">
                <input inputMode="decimal" value={value.kmPerYear} onChange={(e) => set({ kmPerYear: digits(e.target.value) })} placeholder="e.g. 15000" aria-label="Kilometres a year" className={`${box} pr-12`} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">km</span>
              </div>
              <span className="mt-1.5 flex flex-wrap gap-1">
                {KM_PRESETS.map((km) => (
                  <button
                    key={km}
                    type="button"
                    onClick={() => set({ kmPerYear: String(km) })}
                    className={`h-6 rounded-full border px-2 text-[11px] tabular-nums transition ${
                      parseFloat(value.kmPerYear) === km ? 'border-orange-300/50 bg-orange-400/15 text-orange-100' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                    }`}
                  >
                    {plain(km)}
                  </button>
                ))}
              </span>
            </label>
            <label className="block">
              <span className="mb-1 flex items-center gap-1.5 text-xs text-zinc-400">
                <Gauge className="h-3.5 w-3.5 text-zinc-500" /> Fuel economy
              </span>
              <div className="relative">
                <input inputMode="decimal" value={value.kmPerLiter} onChange={(e) => set({ kmPerLiter: digits(e.target.value) })} placeholder="e.g. 12" aria-label="Kilometres per litre" className={`${box} pr-14`} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-zinc-500">km/L</span>
              </div>
              <span className="mt-1 block text-[11px] text-zinc-500">How far it goes on one litre</span>
            </label>
          </div>

          {/* The math, as it's typed */}
          <div className="space-y-1.5 rounded-xl border border-orange-300/15 bg-gradient-to-br from-orange-400/[0.08] to-transparent p-3 text-xs">
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-zinc-400">
                Fuel
                {liters > 0 && (
                  <span className="text-zinc-500">
                    {' '}
                    · {plain(r.kmPerYear)} km ÷ {plain(r.kmPerLiter)} km/L = {plain(Math.round(liters))} L{r.fuelPrice > 0 && ` × ${f(r.fuelPrice)}`}
                  </span>
                )}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-zinc-200">{fuel > 0 ? f(fuel) : '—'}</span>
            </p>
            <p className="flex items-baseline justify-between gap-3">
              <span className="text-zinc-400">Maintenance</span>
              <span className="shrink-0 font-medium tabular-nums text-zinc-200">{r.maintenance > 0 ? f(r.maintenance) : '—'}</span>
            </p>
            <div className="flex items-baseline justify-between gap-3 border-t border-white/[0.07] pt-1.5">
              <span className="font-semibold text-white">To run it a year</span>
              <span className="text-right">
                <span className="block text-base font-bold tabular-nums text-orange-200">{total > 0 ? f(total) : '—'}</span>
                {total > 0 && (
                  <span className="block text-[11px] tabular-nums text-zinc-500">
                    {f(total / 12)} a month<span className="alt-i">&nbsp;· ≈ {u(total)} {altCode}</span>
                  </span>
                )}
              </span>
            </div>
            {liters === 0 && (r.kmPerYear > 0 || r.kmPerLiter > 0) && <p className="text-[11px] text-zinc-500">Add both the km a year and the km per litre to work out the fuel.</p>}
          </div>
        </div>
      )}
    </section>
  )
}

/** On a vehicle (asset card, opened item): what it costs to run a year, with the split. Nothing when not set. */
export function RunningCostsSummary({ running, compact = false }: { running?: RunningCosts; compact?: boolean }) {
  const f = useFmt()
  if (!running) return null
  const total = runningPerYear(running)
  if (total <= 0) return null
  const fuel = fuelPerYear(running)
  return (
    <div className={`flex items-center gap-2.5 rounded-xl border border-orange-300/15 bg-orange-400/[0.06] ${compact ? 'px-2.5 py-2' : 'mt-3 px-3 py-2.5'}`}>
      <Fuel className="h-3.5 w-3.5 shrink-0 text-orange-200/80" />
      <span className="min-w-0 flex-1 truncate text-xs text-zinc-400">
        Runs <span className="font-semibold tabular-nums text-white">{f(total, true)}</span> a year
        <span className="text-zinc-500"> · {f(total / 12, true)}/mo</span>
      </span>
      <span className="shrink-0 truncate text-[11px] tabular-nums text-zinc-500">
        {fuel > 0 && `fuel ${f(fuel, true)}`}
        {fuel > 0 && running.maintenance > 0 && ' · '}
        {running.maintenance > 0 && `upkeep ${f(running.maintenance, true)}`}
      </span>
    </div>
  )
}
