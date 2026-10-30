import { useState } from 'react'
import { Car, ChevronDown, Fuel, Gauge, Route, Wrench } from 'lucide-react'
import { useAlt, useFmt, useStore } from '../store'
import { fuelPerYear, itemRunning, litersPerYear, runningPerYear, type CarInYear, type RunningYear } from '../lib/running'
import { MONTHS_SHORT } from '../lib/time'
import { plain } from '../lib/money'
import type { Item, RunningCosts } from '../lib/types'
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

/**
 * Assets → Setups: what your cars cost to run, year by year (only cars with running costs, only the months they're yours).
 * The setup's year is picked at first; pick another year to see its cars.
 */
export function RunningByYear({ years, focusYear }: { years: RunningYear[]; focusYear: number }) {
  const f = useFmt()
  const u = useAlt()
  const shown = years.filter((y) => y.total > 0)
  const [picked, setPicked] = useState(focusYear)
  if (!shown.length) return null
  const sel = years.find((y) => y.year === picked) ?? years.find((y) => y.year === focusYear)!
  const max = Math.max(...shown.map((y) => y.total))
  const all = shown.reduce((n, y) => n + y.total, 0)
  const span = shown.length > 1 ? `${shown[0].year} – ${shown[shown.length - 1].year}` : String(shown[0].year)
  const range = (c: CarInYear) => (c.months === 12 ? 'All year' : `${MONTHS_SHORT[c.firstMonth]} – ${MONTHS_SHORT[c.lastMonth]} · ${c.months} mo`)

  return (
    <section className="animate-fade rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:p-4">
      <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-0.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-amber-300 to-orange-500 shadow-lg shadow-orange-500/20">
          <Fuel className="h-4 w-4 text-white" strokeWidth={2.5} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-white">Car running costs</h3>
          <p className="truncate text-[11px] text-zinc-500">Fuel and upkeep, counted only for the months each car is yours</p>
        </div>
        <p className="text-right text-xs text-zinc-400">
          <span className="font-semibold tabular-nums text-white">{f(all, true)}</span> in all · {span}
        </p>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        {/* Year by year */}
        <ul className="scrollbar-none max-h-[22rem] space-y-0.5 overflow-y-auto rounded-xl border border-white/[0.06] bg-black/20 p-1.5">
          {shown.map((y) => {
            const on = y.year === sel.year
            return (
              <li key={y.year}>
                <button
                  onClick={() => setPicked(y.year)}
                  aria-pressed={on}
                  className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition ${on ? 'bg-orange-400/[0.12] ring-1 ring-orange-300/30' : 'hover:bg-white/[0.04]'}`}
                >
                  <span className={`w-10 shrink-0 text-sm font-semibold tabular-nums ${on ? 'text-orange-100' : 'text-zinc-300'}`}>{y.year}</span>
                  <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <span
                      className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ${on ? 'bg-gradient-to-r from-amber-300 to-orange-400' : 'bg-orange-300/50'}`}
                      style={{ width: `${(y.total / max) * 100}%` }}
                    />
                  </span>
                  <span className="hidden w-14 shrink-0 text-right text-[11px] text-zinc-500 sm:block">
                    {y.cars.length} car{y.cars.length === 1 ? '' : 's'}
                  </span>
                  <span className={`w-16 shrink-0 text-right text-sm tabular-nums ${on ? 'font-semibold text-white' : 'text-zinc-300'}`}>{f(y.total, true)}</span>
                  {y.year === focusYear && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-orange-300" title="This setup's year" />}
                </button>
              </li>
            )
          })}
        </ul>

        {/* The picked year, car by car */}
        <div key={sel.year} className="animate-fade rounded-xl border border-orange-300/15 bg-gradient-to-br from-orange-400/[0.08] to-transparent p-3.5">
          <p className="text-xs text-zinc-400">To run your cars in {sel.year}</p>
          <p className="mt-0.5 text-2xl font-bold tabular-nums tracking-tight text-white">{f(sel.total)}</p>
          <p className="text-[11px] tabular-nums text-zinc-500">
            ≈ {f(sel.total / 12)} a month<span className="alt-i">&nbsp;· ≈ {u(sel.total)}</span>
          </p>
          {sel.cars.length === 0 ? (
            <p className="mt-4 text-sm text-zinc-500">No cars with running costs this year.</p>
          ) : (
            <ul className="mt-3 space-y-1.5">
              {sel.cars.map((c) => (
                <li key={c.item.id} className="flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-black/25 px-2.5 py-2">
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-orange-400/15 text-orange-200">
                    <Car className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[13px] font-medium text-zinc-100">{c.item.name}</span>
                    <span className="block truncate text-[11px] text-zinc-500">
                      {range(c)} · {f(c.perYear, true)}/yr
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-zinc-100">{f(c.cost, true)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  )
}

/** Under a property's vehicles: what the ones kept there cost to run a year (nothing when none have running costs). */
export function RunningAtProperty({ items }: { items: Item[] }) {
  const f = useFmt()
  const total = items.reduce((n, i) => n + itemRunning(i), 0)
  if (total <= 0) return null
  const counted = items.filter((i) => itemRunning(i) > 0).length
  return (
    <p className="mt-1.5 flex items-center gap-1.5 border-t border-white/[0.06] px-0.5 pt-1.5 text-[11px] text-zinc-400">
      <Fuel className="h-3.5 w-3.5 shrink-0 text-orange-200/80" />
      <span className="min-w-0 flex-1 truncate">
        Runs <span className="font-semibold tabular-nums text-orange-100">{f(total, true)}</span> a year
        <span className="text-zinc-500"> · {f(total / 12, true)}/mo</span>
      </span>
      {counted < items.length && <span className="shrink-0 text-zinc-600">{counted} of {items.length} cars</span>}
    </p>
  )
}
