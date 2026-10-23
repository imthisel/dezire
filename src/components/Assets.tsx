import { useMemo, useState, type ReactNode } from 'react'
import {
  ArrowUpDown, BadgeDollarSign, Cake, CalendarCheck, CalendarDays, CalendarRange, Car, ChevronDown, ChevronLeft, ChevronRight, Copy, Gem, Home, Infinity as All, Pencil,
  Plus, RotateCcw, Settings2, Star, Trash2, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import {
  placementAt, setupMonths, useFmt, useItemIndex, useKindOf, useKinds, useParking, useStore, useAlt, type AssetCat, type AssetPeriod, type Parking,
} from '../store'
import { SetupNote } from './YearNote'
import { useBirthday } from './Birthday'
import { TREND, kindColor, kindIcon } from '../lib/meta'
import { valueAfter } from '../lib/calc'
import { END_YEAR, MONTHS, MONTHS_SHORT, START_YEAR, TOTAL_MONTHS, YEARS, currentIndex, currentYear, fromIndex, indexOf, indexOfKey, keyOf, labelOfKey } from '../lib/time'
import type { Item, Trend } from '../lib/types'
import { card } from './Dashboard'
import { goTo, goToMonth } from '../nav'
import { toast } from '../toast'
import { Kept, dragVehicle, editItem } from './Kept'
import { useVehicleDrag, vehicleDrag } from '../dnd'
import { ItemTile } from './Tiles'
import { ZoomControl } from './Zoom'
import { PHONE_GRID, useCols, zoomName } from '../zoom'

type Asset = { item: Item; key: string; index: number; year: number }
type Sort = 'date' | 'price' | 'value' | 'name'

const TRENDS = Object.keys(TREND) as Trend[]

const SORTS: { id: Sort; label: string }[] = [
  { id: 'date', label: 'Date bought' },
  { id: 'price', label: 'Price (high → low)' },
  { id: 'value', label: 'Worth (high → low)' },
  { id: 'name', label: 'Name (A → Z)' },
]

/** First and last month index covered by the period filter. */
function periodRange(p: AssetPeriod): [number, number] {
  if (p.mode === 'all') return [0, TOTAL_MONTHS - 1]
  // One month: everything owned by then.
  if (p.mode === 'month') return [0, indexOf(p.from, p.month)]
  if (p.mode === 'year') return [indexOf(p.from, 0), indexOf(p.from, 11)]
  return [indexOf(p.from, 0), indexOf(p.to, 11)]
}

const periodLabel = (p: AssetPeriod) =>
  p.mode === 'month'
    ? `${MONTHS[p.month]} ${p.from} setup`
    : p.mode === 'all' ? `${START_YEAR} – ${END_YEAR}` : p.mode === 'year' || p.from === p.to ? String(p.from) : `${p.from} – ${p.to}`

/** Everything you plan to own, by kind, for the years you pick. */
export function Assets() {
  const months = useStore((s) => s.months)
  const picked = useStore((s) => s.assetCat)
  const kinds = useKinds()
  const kind = kinds.find((k) => k.id === picked)
  const cat: AssetCat = kind ? kind.id : 'all'
  const savedPeriod = useStore((s) => s.assetPeriod)
  const birthMonth = useBirthday()?.month ?? null
  const setups = setupMonths(birthMonth)
  const period: AssetPeriod =
    savedPeriod.mode === 'month' && !setups.includes(savedPeriod.month) ? { ...savedPeriod, month: setups[0] } : savedPeriod
  const { setAssetCat } = useStore.getState()
  const f = useFmt()
  const u = useAlt()
  const [trend, setTrend] = useState<'all' | Trend>('all')
  const [sort, setSort] = useState<Sort>('date')

  const [first, last] = periodRange(period)
  // Values are shown as of the end of the period (December of its last year, or the picked month).
  const asOf = last
  const asOfLabel = `${period.mode === 'month' ? MONTHS_SHORT[period.month] : 'Dec'} ${fromIndex(asOf).year}`
  // Setups: vehicles are arranged across properties, a separate version for each setup.
  const parking = useParking(period.mode === 'month' ? keyOf(asOf) : null, setups)

  /** Every item in the chosen years, any kind. */
  // Setups: vehicles sold in an earlier setup are listed on their own, not as cards.
  const soldIds = useMemo(() => (parking ? new Set(parking.sold.map((x) => x.placed.item.id)) : null), [parking])
  const inPeriod = useMemo(() => {
    const out: Asset[] = []
    for (const key of Object.keys(months).sort()) {
      const index = indexOfKey(key)
      if (!(index >= first && index <= last)) continue
      for (const item of months[key].items) if (!soldIds?.has(item.id)) out.push({ item, key, index, year: Number(key.slice(0, 4)) })
    }
    return out
  }, [months, first, last, soldIds])

  const ofKind = cat === 'all' ? inPeriod : inPeriod.filter((a) => a.item.category === cat)
  const trendOn = trend !== 'all' && ofKind.some((a) => a.item.trend === trend) ? trend : 'all'
  const shown = useMemo(() => {
    const list = trendOn === 'all' ? ofKind : ofKind.filter((a) => a.item.trend === trendOn)
    const worth = (a: Asset) => valueAfter(a.item, asOf - a.index)
    const by: Record<Sort, (a: Asset, b: Asset) => number> = {
      date: (a, b) => a.index - b.index,
      price: (a, b) => b.item.price - a.item.price,
      value: (a, b) => worth(b) - worth(a),
      name: (a, b) => a.item.name.localeCompare(b.item.name),
    }
    return [...list].sort(by[sort])
  }, [ofKind, trendOn, sort, asOf])

  const paid = ofKind.reduce((s, a) => s + a.item.price, 0)
  const worth = ofKind.reduce((s, a) => s + valueAfter(a.item, asOf - a.index), 0)
  const change = worth - paid
  const changePct = paid > 0 ? (change / paid) * 100 : 0
  const title = kind ? kind.label : 'All assets'
  const HeadIcon = kind ? kindIcon(kind) : Gem
  const headGrad = kind ? kindColor(kind).grad : 'from-indigo-400 via-violet-400 to-emerald-400'

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-violet-500/10 blur-3xl" />

        {/* Title */}
        <div className="relative flex items-center gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-lg shadow-black/30 ${headGrad}`}>
            <HeadIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">{title}</h2>
            <p className="truncate text-sm text-zinc-400">
              {ofKind.length} item{ofKind.length === 1 ? '' : 's'} · {periodLabel(period)}
            </p>
          </div>
        </div>

        {/* Kind tabs (same as the sidebar's sub-tabs; handy on phones) */}
        <div className="scrollbar-none relative -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Kind">
          {[null, ...kinds].map((kd) => {
            const c: AssetCat = kd ? kd.id : 'all'
            const on = cat === c
            const n = kd ? inPeriod.filter((a) => a.item.category === c).length : inPeriod.length
            const Icon = kd ? kindIcon(kd) : Gem
            return (
              <button
                key={c}
                role="tab"
                aria-selected={on}
                onClick={() => setAssetCat(c)}
                className={`inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                  on ? 'border-indigo-400/60 bg-indigo-500/15 text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                }`}
              >
                <Icon className={`h-4 w-4 ${on ? (kd ? kindColor(kd).text : 'text-indigo-300') : ''}`} />
                {kd ? kd.label : 'All'}
                <span className={`tabular-nums ${on ? 'text-indigo-200/70' : 'text-zinc-600'}`}>{n}</span>
              </button>
            )
          })}
          <button
            onClick={() => useStore.getState().openModal({ type: 'kinds' })}
            title="Add, rename or delete kinds"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-sm font-medium text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
          >
            <Settings2 className="h-4 w-4" /> Edit kinds
          </button>
        </div>

        <PeriodPicker period={period} setups={setups} birthSet={birthMonth !== null} />
        {parking && (cat === 'all' || cat === 'property' || cat === 'vehicle') && <LayoutBar parking={parking} setups={setups} birthMonth={birthMonth} />}
        {/* Each setup has its own note */}
        {parking && (
          <div className="relative mt-3">
            <SetupNote monthKey={parking.monthKey} birthday={period.month !== 11 || setups.length === 1} />
          </div>
        )}

        {/* Totals */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Tile k="Items" v={String(ofKind.length)} sub={ofKind.length ? `${ofKind.filter((a) => a.item.favorite).length} favorite` : 'Nothing yet'} />
          <Tile k="Price paid" v={f(paid)} sub={`≈ ${u(paid)}`} />
          <Tile k={`Worth by ${asOfLabel}`} v={f(worth)} sub={`≈ ${u(worth)}`} cls="text-indigo-200" />
          <Tile
            k="Value change"
            v={`${change >= 0 ? '+' : ''}${f(change)}`}
            sub={paid > 0 ? `${change >= 0 ? '+' : ''}${changePct.toFixed(1)}% vs. price` : '—'}
            cls={change > 0.005 ? 'text-emerald-300' : change < -0.005 ? 'text-red-300' : 'text-white'}
          />
        </div>

        {/* What it's made of (All only) */}
        {cat === 'all' && worth > 0 && (
          <div className="relative mt-4">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/5">
              {kinds.map((kd) => {
                const v = inPeriod.filter((a) => a.item.category === kd.id).reduce((s, a) => s + valueAfter(a.item, asOf - a.index), 0)
                return v > 0 ? <div key={kd.id} className={`h-full ${kindColor(kd).bar}`} style={{ width: `${(v / worth) * 100}%` }} title={`${kd.label}: ${f(v)}`} /> : null
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              {kinds.map((kd) => {
                const v = inPeriod.filter((a) => a.item.category === kd.id).reduce((s, a) => s + valueAfter(a.item, asOf - a.index), 0)
                return v > 0 ? (
                  <button key={kd.id} onClick={() => setAssetCat(kd.id)} className="inline-flex items-center gap-1.5 transition hover:text-white">
                    <span className={`h-2 w-2 rounded-full ${kindColor(kd).bar}`} /> {kd.label}
                    <span className="tabular-nums text-zinc-500">{Math.round((v / worth) * 100)}%</span>
                  </button>
                ) : null
              })}
            </div>
          </div>
        )}
      </section>

      {ofKind.length === 0 ? (
        <section className={`${card} grid place-items-center px-6 py-14 text-center`}>
          <div className="max-w-sm">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-white/15 text-zinc-500">
              <HeadIcon className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-white">
              No {kind ? `“${kind.label}” items` : 'assets'} {period.mode === 'all' ? 'yet' : period.mode === 'month' ? periodLabel(period) : `in ${periodLabel(period)}`}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {period.mode === 'all'
                ? 'Add items to any month in the Planner and pick this kind. They show up here.'
                : period.mode === 'month'
                  ? 'Try a later month, or show all years.'
                  : 'Try a different year, or show all years.'}
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {period.mode !== 'all' && (
                <button
                  onClick={() => useStore.getState().setAssetPeriod({ mode: 'all' })}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
                >
                  <All className="h-4 w-4" /> Show all years
                </button>
              )}
              <button
                onClick={() => goTo('years')}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
              >
                <Plus className="h-4 w-4" /> Add in my months
              </button>
            </div>
          </div>
        </section>
      ) : (
        <>
          {/* Trend filter + sort */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="scrollbar-none -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
              <Chip on={trendOn === 'all'} onClick={() => setTrend('all')} cls="border-white/30 bg-white/10 text-white">
                Any value change
              </Chip>
              {TRENDS.map((t) => {
                const tr = TREND[t]
                const n = ofKind.filter((a) => a.item.trend === t).length
                return (
                  <Chip key={t} on={trendOn === t} onClick={() => setTrend(t)} cls={`${tr.border} ${tr.bg} ${tr.text}`} disabled={!n}>
                    <tr.icon className="h-3.5 w-3.5" /> {tr.label} <span className="opacity-60">{n}</span>
                  </Chip>
                )
              })}
            </div>
            <label className="relative inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] pl-3 pr-8 text-sm text-zinc-300">
              <ArrowUpDown className="h-3.5 w-3.5 text-zinc-500" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as Sort)}
                aria-label="Sort by"
                className="cursor-pointer appearance-none bg-transparent outline-none"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#0e1016]">
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-zinc-500" />
            </label>
          </div>

          {parking && (cat === 'all' || cat === 'property' || cat === 'vehicle') && <SetupVehicles parking={parking} setups={setups} />}

          <ZoomControl />

          {parking ? (
            // Setups (birthday month / December): all side by side, what each year adds up to at the bottom.
            <>
              <Grid list={shown} asOf={asOf} asOfLabel={asOfLabel} parking={parking} />
              <YearTotals list={shown} asOf={asOf} asOfLabel={asOfLabel} />
            </>
          ) : sort === 'date' ? (
            // Everywhere else, sorted by date: a section per year.
            [...new Set(shown.map((a) => a.year))].map((y) => {
              const list = shown.filter((a) => a.year === y)
              const sum = list.reduce((s, a) => s + a.item.price, 0)
              return (
                <section key={y} className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3 px-1">
                    <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">{y}</h3>
                    <span className="text-xs tabular-nums text-zinc-500">
                      {list.length} · {f(sum)}
                    </span>
                  </div>
                  <Grid list={list} asOf={asOf} asOfLabel={asOfLabel} parking={null} />
                </section>
              )
            })
          ) : (
            <Grid list={shown} asOf={asOf} asOfLabel={asOfLabel} parking={null} />
          )}
        </>
      )}
    </div>
  )
}

/** What the items shown add up to, year by year (the year each was bought), with the total underneath. */
function YearTotals({ list, asOf, asOfLabel }: { list: Asset[]; asOf: number; asOfLabel: string }) {
  const f = useFmt()
  const years = [...new Set(list.map((a) => a.year))].sort((a, b) => a - b)
  if (!years.length) return null
  const rows = years.map((y) => {
    const inYear = list.filter((a) => a.year === y)
    return {
      y,
      count: inYear.length,
      paid: inYear.reduce((s, a) => s + a.item.price, 0),
      worth: inYear.reduce((s, a) => s + valueAfter(a.item, asOf - a.index), 0),
    }
  })
  const total = { count: list.length, paid: rows.reduce((s, r) => s + r.paid, 0), worth: rows.reduce((s, r) => s + r.worth, 0) }
  const max = Math.max(...rows.map((r) => r.paid), 1)
  const cols = 'grid grid-cols-[3.5rem_minmax(0,1fr)_auto_auto] items-center gap-x-3 sm:grid-cols-[4rem_minmax(0,1fr)_7rem_7rem]'

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <h3 className="mb-3 font-semibold text-white">By year</h3>
      <div className={`${cols} px-1 pb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-500`}>
        <span>Year</span>
        <span>Items</span>
        <span className="text-right">Paid</span>
        <span className="text-right">Worth by {asOfLabel}</span>
      </div>
      <ul className="divide-y divide-white/[0.05]">
        {rows.map((r) => {
          const change = r.worth - r.paid
          return (
            <li key={r.y} className={`${cols} px-1 py-2 text-sm`}>
              <span className="font-semibold tabular-nums text-zinc-200">{r.y}</span>
              <span className="flex min-w-0 items-center gap-2">
                <span className="w-6 shrink-0 tabular-nums text-zinc-400">{r.count}</span>
                <span className="hidden h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.05] sm:block">
                  <span className="block h-full rounded-full bg-indigo-400/70" style={{ width: `${(r.paid / max) * 100}%` }} />
                </span>
              </span>
              <span className="text-right font-medium tabular-nums text-zinc-100">{f(r.paid, true)}</span>
              <span className={`text-right tabular-nums ${change > 0.005 ? 'text-emerald-300' : change < -0.005 ? 'text-red-300' : 'text-zinc-300'}`}>{f(r.worth, true)}</span>
            </li>
          )
        })}
      </ul>
      <div className={`${cols} mt-1 rounded-xl bg-white/[0.04] px-1 py-2.5 text-sm`}>
        <span className="font-semibold text-white">Total</span>
        <span className="tabular-nums text-zinc-300">{total.count}</span>
        <span className="text-right font-semibold tabular-nums text-white">{f(total.paid, true)}</span>
        <span className="text-right font-semibold tabular-nums text-indigo-200">{f(total.worth, true)}</span>
      </div>
    </section>
  )
}

function Grid({ list, asOf, asOfLabel, parking }: { list: Asset[]; asOf: number; asOfLabel: string; parking: Parking | null }) {
  const cols = useCols()
  return (
    <div data-zoom-grid className={`grid md:grid-cols-2 2xl:grid-cols-3 ${PHONE_GRID[cols]}`}>
      {list.map((a) => {
        if (cols === 1) return <AssetCard key={a.item.id} asset={a} asOf={asOf} asOfLabel={asOfLabel} parking={parking} />
        const { month, year } = fromIndex(a.index)
        return <ItemTile key={a.item.id} item={a.item} domId={`asset-${a.item.id}`} when={`${MONTHS_SHORT[month]} ${year}`} cols={cols} />
      })}
    </div>
  )
}

/** All years / one year / a range of years. */
function PeriodPicker({ period, setups, birthSet }: { period: AssetPeriod; setups: number[]; birthSet: boolean }) {
  const set = useStore.getState().setAssetPeriod
  const modes: { id: AssetPeriod['mode']; label: string; icon: typeof All }[] = [
    { id: 'all', label: 'All years', icon: All },
    { id: 'year', label: 'One year', icon: CalendarDays },
    { id: 'range', label: 'From – to', icon: CalendarRange },
    { id: 'month', label: 'Setups', icon: CalendarCheck },
  ]
  const thisYear = currentYear()
  // Every setup from 2026 to 2040, in order; the arrows step through them.
  const all = YEARS.flatMap((y) => setups.map((m) => indexOf(y, m)))
  const at = indexOf(period.from, period.month)
  const pos = all.indexOf(at)
  const goSetup = (i: number) => {
    const { year, month } = fromIndex(i)
    set({ from: year, to: year, month })
  }
  // Opening Setups starts on the next one coming up (or the last one).
  const upcoming = all.find((i) => i >= currentIndex()) ?? all[all.length - 1]

  return (
    <div className="relative mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm sm:inline-grid sm:grid-cols-4">
        {modes.map((m) => {
          const on = period.mode === m.id
          return (
            <button
              key={m.id}
              // Opening "One month" starts on this month, the one you most likely want to arrange.
              onClick={() => (m.id === 'month' && period.mode !== 'month' ? (set({ mode: 'month' }), goSetup(upcoming)) : set({ mode: m.id }))}
              aria-pressed={on}
              className={`inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${
                on ? 'bg-white/10 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <m.icon className="hidden h-3.5 w-3.5 sm:block" /> {m.label}
            </button>
          )
        })}
      </div>

      {period.mode === 'year' && (
        <div className="animate-fade flex items-center gap-2">
          <YearSelect value={period.from} onChange={(y) => set({ from: y, to: y })} label="Year" />
          {period.from !== thisYear && (
            <button onClick={() => set({ from: thisYear, to: thisYear })} className="h-9 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
              This year
            </button>
          )}
        </div>
      )}
      {period.mode === 'month' && (
        <div className="animate-fade flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => goSetup(all[pos - 1])}
            disabled={pos <= 0}
            aria-label="Previous setup"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <YearSelect value={period.from} onChange={(y) => set({ from: y, to: y })} label="Year" />
          <div className="flex rounded-xl border border-white/10 bg-black/30 p-0.5">
            {setups.map((m) => {
              const on = period.month === m
              const bday = m !== 11 || setups.length === 1
              return (
                <button
                  key={m}
                  onClick={() => set({ month: m })}
                  aria-pressed={on}
                  title={bday ? (birthSet ? 'Your birthday month' : 'June until you set your birthday (account menu)') : 'End of the year'}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium transition ${on ? 'bg-teal-500/20 text-white ring-1 ring-teal-400/40' : 'text-zinc-400 hover:text-zinc-200'}`}
                >
                  {bday && <Cake className={`h-3.5 w-3.5 ${on ? 'text-pink-300' : ''}`} />}
                  {MONTHS[m]}
                </button>
              )
            })}
          </div>
          <button
            onClick={() => goSetup(all[pos + 1])}
            disabled={pos < 0 || pos >= all.length - 1}
            aria-label="Next setup"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {!birthSet && <span className="w-full text-[11px] text-zinc-500 sm:w-auto">Using June · set your birthday in the account menu to use your birth month</span>}
        </div>
      )}
      {period.mode === 'range' && (
        <div className="animate-fade flex items-center gap-2">
          <YearSelect value={period.from} onChange={(y) => set({ from: y })} label="From" />
          <span className="text-sm text-zinc-500">to</span>
          <YearSelect value={period.to} onChange={(y) => set({ to: y })} label="To" />
        </div>
      )}
    </div>
  )
}

/** A setup's summary, with ways to fill it: copy the setup before, or start from where vehicles are usually kept. */
function LayoutBar({ parking, setups, birthMonth }: { parking: Parking; setups: number[]; birthMonth: number | null }) {
  const layouts = useStore((s) => s.layouts)
  const label = labelOfKey(parking.monthKey)
  const { vehicles, properties, at } = parking
  if (!vehicles.length && !properties.length) return null
  const month = Number(parking.monthKey.slice(5)) - 1
  const isBday = month !== 11 || setups.length === 1

  // The closest earlier setup that has anything in it.
  const earlier = Object.keys(layouts)
    .filter((k) => k < parking.monthKey && setups.includes(Number(k.slice(5)) - 1) && Object.keys(layouts[k]).length)
    .sort()
    .pop()
  // Where vehicles are usually kept (chosen when adding them), for the ones owned by now.
  const usual: Record<string, string> = {}
  for (const v of vehicles) if (v.item.propertyId && properties.some((p) => p.item.id === v.item.propertyId)) usual[v.item.id] = v.item.propertyId
  const { fillLayout, resetLayout } = useStore.getState()

  function fill(from: Record<string, string>, what: string) {
    if (at.size && !confirm(`Replace the ${label} setup with ${what}?`)) return
    fillLayout(parking.monthKey, from)
    toast.success(`${label} setup now matches ${what}.`)
  }

  return (
    <div className="animate-fade relative mt-3 rounded-xl border border-teal-300/15 bg-teal-400/[0.04] px-3 py-2.5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg max-sm:hidden ${isBday ? 'bg-pink-400/15 text-pink-200' : 'bg-teal-400/15 text-teal-200'}`}>
          {isBday ? <Cake className="h-4 w-4" /> : <Car className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">
            {label} setup{isBday && <span className="font-normal text-zinc-500"> · {birthMonth === null ? 'June (birthday not set)' : 'your birthday month'}</span>}
          </p>
          <p className="text-xs text-zinc-500">
            {at.size} at a property · {parking.unplaced.length} not (counts as sold) · {parking.sold.length} sold before · {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {earlier && (
            <button
              onClick={() => fill(layouts[earlier], `the ${labelOfKey(earlier)} setup`)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Copy className="h-3.5 w-3.5" /> Copy {labelOfKey(earlier)}
            </button>
          )}
          {Object.keys(usual).length > 0 && (
            <button
              onClick={() => fill(usual, 'where vehicles are usually kept')}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Home className="h-3.5 w-3.5" /> Usual spots
            </button>
          )}
          {at.size > 0 && (
            <button
              onClick={() => {
                if (!confirm(`Clear the ${label} setup? Its vehicles will show as not at a property.`)) return
                resetLayout(parking.monthKey)
                toast.info(`Cleared the ${label} setup.`)
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/**
 * Every vehicle in a setup as small boxes, in three groups: at a property, not at one (counts as sold from this setup on),
 * and sold in an earlier setup (kept visible so nothing quietly disappears; put one at a property to bring it back).
 */
function SetupVehicles({ parking, setups }: { parking: Parking; setups: number[] }) {
  const { at, unplaced, sold, properties, vehicles, monthKey } = parking
  const index = useItemIndex()
  const layouts = useStore((s) => s.layouts)
  const [showSold, setShowSold] = useState(true)
  if (!vehicles.length) return null
  const label = labelOfKey(monthKey)
  const placed = vehicles.filter((v) => at.has(v.item.id))

  function put(v: Item, pid: string) {
    const home = properties.find((p) => p.item.id === pid)
    if (!home) return
    useStore.getState().setKeptAt(monthKey, v.id, pid)
    toast.info(`“${v.name}” is at ${home.item.name} in the ${label} setup.`)
  }
  function takeOff(v: Item) {
    useStore.getState().setKeptAt(monthKey, v.id, null)
    toast.info(`“${v.name}” isn't at a property in the ${label} setup · counts as sold from then.`)
  }

  return (
    <section className={`${card} animate-fade p-3 sm:p-4`}>
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 px-0.5">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <Car className="h-4 w-4 text-teal-200" /> Vehicles · {label} setup
        </h3>
        <p className="text-[11px] text-zinc-500">Not at a property = sold by then</p>
      </div>

      <SetupTotals parking={parking} setups={setups} />

      <div className="grid gap-2.5 lg:grid-cols-2">
        <Group tone="teal" title="At a property" count={placed.length} empty="None yet · drag one onto a property, or tap its house button">
          {placed.map((v) => (
            <Box key={v.item.id} v={v} sub={`at ${index.byId.get(at.get(v.item.id)!)?.item.name ?? ''}`} subCls="text-teal-200/80">
              <IconBtn label={`Take ${v.item.name} off its property (sold)`} onClick={() => takeOff(v.item)}>
                <X className="h-3.5 w-3.5" />
              </IconBtn>
            </Box>
          ))}
        </Group>

        <Group tone="rose" title="Not at a property" note="sold" count={unplaced.length} empty="Everything you still have is at a property">
          {unplaced.map((v) => (
            <Box key={v.item.id} v={v} sub={`Bought ${shortLabel(v.key)}`} tone="rose">
              <PutAt v={v.item} properties={properties} onPut={put} />
            </Box>
          ))}
        </Group>
      </div>

      {sold.length > 0 && (
        <div className="mt-2.5">
          <button
            onClick={() => setShowSold((x) => !x)}
            aria-expanded={showSold}
            className="flex w-full items-center gap-1.5 rounded-lg px-0.5 py-1 text-left text-xs text-zinc-400 transition hover:text-zinc-200"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showSold ? '' : '-rotate-90'}`} />
            <span className="font-semibold uppercase tracking-wider">Sold before</span>
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[11px] tabular-nums">{sold.length}</span>
            <span className="truncate text-zinc-600">· left off an earlier setup · sold there means sold in every setup after</span>
          </button>
          {showSold && (
            <ul className="animate-fade mt-1 grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-1.5">
              {sold.map(({ placed: v, since }) => {
                // This setup had it at a property, but the earlier sale wins (kept, in case the sale is undone).
                const planned = layouts[monthKey]?.[v.item.id]
                const plannedAt = planned ? index.byId.get(planned)?.item.name : undefined
                return (
                  <Box key={v.item.id} v={v} sub={`Sold by ${shortLabel(since)}${plannedAt ? ` · was at ${plannedAt}` : ''}`} dim>
                    <button
                      onClick={() => {
                        const y = Number(since.slice(0, 4))
                        useStore.getState().setAssetPeriod({ mode: 'month', from: y, to: y, month: Number(since.slice(5)) - 1 })
                        toast.info(`This is the ${labelOfKey(since)} setup · put “${v.item.name}” at a property here to undo the sale.`)
                      }}
                      title={`Undo the sale: open the ${labelOfKey(since)} setup and put it at a property there`}
                      className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-white/10 px-1.5 text-[11px] font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
                    >
                      <RotateCcw className="h-3 w-3" /> Undo
                    </button>
                  </Box>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

/**
 * What a setup's vehicles add up to: the ones still yours (at a property), and the ones sold —
 * left off this setup or an earlier one. A sold vehicle's "sold for" is an estimate: what it was worth at the setup it left.
 */
/** What one setup's vehicles add up to (see `SetupTotals`). */
function totalsOf(p: Parking) {
  const now = indexOfKey(p.monthKey)
  const worthAt = (v: { item: Item; key: string }, when: number) => valueAfter(v.item, when - indexOfKey(v.key))
  const kept = p.vehicles.filter((v) => p.at.has(v.item.id))
  const soldNow = p.unplaced.map((v) => ({ v, value: worthAt(v, now) }))
  // Sold in an earlier setup: worth what it was then.
  const soldBefore = p.sold.map(({ placed: v, since }) => ({ v, value: worthAt(v, indexOfKey(since)) }))
  const allSold = [...soldNow, ...soldBefore]
  return {
    kept: kept.length,
    keptPaid: kept.reduce((n, v) => n + v.item.price, 0),
    keptWorth: kept.reduce((n, v) => n + worthAt(v, now), 0),
    soldNow: soldNow.length,
    soldBefore: soldBefore.length,
    sold: allSold.length,
    soldPaid: allSold.reduce((n, x) => n + x.v.item.price, 0),
    soldFor: allSold.reduce((n, x) => n + x.value, 0),
  }
}

/** The setup before `monthKey` (the other setup month, going back), or null before the first one. */
function previousSetup(monthKey: string, setups: number[]) {
  for (let i = indexOfKey(monthKey) - 1; i >= 0; i--) if (setups.includes(i % 12)) return keyOf(i)
  return null
}

function SetupTotals({ parking, setups }: { parking: Parking; setups: number[] }) {
  const f = useFmt()
  const u = useAlt()
  const index = useItemIndex()
  const layouts = useStore((s) => s.layouts)
  const { vehicles, monthKey } = parking
  const { kept, keptPaid, keptWorth, soldNow, soldBefore, sold: soldCount, soldPaid, soldFor } = totalsOf(parking)
  // The same totals for the setup before, to see what changed.
  const prevKey = previousSetup(monthKey, setups)
  const prev = useMemo(() => (prevKey ? totalsOf(placementAt(index, layouts, prevKey, setups)) : null), [prevKey, index, layouts, setups.join()])

  const totalPaid = keptPaid + soldPaid
  const keptShare = totalPaid > 0 ? (keptPaid / totalPaid) * 100 : 0
  const label = labelOfKey(monthKey)
  const isBday = Number(monthKey.slice(5)) - 1 !== 11 || setups.length === 1

  return (
    <div className="mb-3 space-y-2.5">
      <p className="flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className={`h-1.5 w-1.5 rounded-full ${isBday ? 'bg-pink-300' : 'bg-teal-300'}`} />
        Totals for the {label} setup
        <span className="font-normal normal-case tracking-normal text-zinc-600">· {isBday ? 'birthday month' : 'December'}</span>
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TotalCard
          tone="teal"
          icon={<Car className="h-4 w-4" />}
          title="Still yours"
          note="at a property"
          count={kept}
          big={f(keptWorth)}
          bigLabel={`worth by ${shortLabel(monthKey)}`}
          alt={u(keptWorth)}
          paid={keptPaid}
          change={keptWorth - keptPaid}
          changeLabel="since bought"
          empty="No vehicles at a property in this setup"
        />
        <TotalCard
          tone="rose"
          icon={<BadgeDollarSign className="h-4 w-4" />}
          title="Sold"
          note={soldCount ? `${soldNow} this setup · ${soldBefore} before` : undefined}
          count={soldCount}
          big={f(soldFor)}
          bigLabel="sold for (est.)"
          alt={u(soldFor)}
          paid={soldPaid}
          change={soldFor - soldPaid}
          changeLabel="vs. what you paid"
          empty="Nothing sold by this setup"
        />
      </div>

      {/* Of everything bought by this setup: how much (by price) is still yours */}
      {totalPaid > 0 && (
        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
          <div className="flex items-baseline justify-between gap-3 text-[11px]">
            <span className="font-medium text-zinc-400">
              All vehicles by the {label} setup · <span className="tabular-nums text-zinc-500">{vehicles.length}</span>
            </span>
            <span className="tabular-nums text-zinc-300">
              <span className="text-zinc-500">paid </span>
              <span className="font-semibold text-white">{f(totalPaid)}</span>
            </span>
          </div>
          <div className="mt-2 flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/5" role="img" aria-label={`${Math.round(keptShare)}% still yours, ${100 - Math.round(keptShare)}% sold`}>
            {keptPaid > 0 && <div className="h-full rounded-l-full bg-gradient-to-r from-teal-400 to-emerald-300 transition-[width] duration-500" style={{ width: `${keptShare}%` }} />}
            {soldPaid > 0 && <div className="h-full flex-1 rounded-r-full bg-gradient-to-r from-rose-400/80 to-rose-300/70" />}
          </div>
          <div className="mt-1.5 flex justify-between text-[10.5px] tabular-nums">
            <span className="text-teal-200/80">{Math.round(keptShare)}% still yours</span>
            <span className="text-rose-200/80">{100 - Math.round(keptShare)}% sold</span>
          </div>

          {/* What changed since the setup before */}
          {prev && prevKey && (prev.kept + prev.sold > 0 || vehicles.length > 0) && (
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5 border-t border-white/[0.06] pt-2.5 text-[11px]">
              <span className="mr-0.5 text-zinc-500">Since the {labelOfKey(prevKey)} setup</span>
              <Delta label="Still yours" from={String(prev.kept)} to={String(kept)} diff={kept - prev.kept} />
              <Delta label="Worth" from={f(prev.keptWorth, true)} to={f(keptWorth, true)} diff={keptWorth - prev.keptWorth} money />
              <Delta label="Sold" from={String(prev.sold)} to={String(soldCount)} diff={soldCount - prev.sold} neutral />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** "Worth ₱4.2M → ₱4.6M (+₱400K)" */
function Delta({ label, from, to, diff, money, neutral }: { label: string; from: string; to: string; diff: number; money?: boolean; neutral?: boolean }) {
  const f = useFmt()
  const same = Math.abs(diff) < 0.005
  const tone = same || neutral ? 'bg-white/[0.05] text-zinc-300' : diff > 0 ? 'bg-emerald-400/10 text-emerald-200' : 'bg-red-400/10 text-red-200'
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 tabular-nums ${tone}`}>
      <span className="text-zinc-500">{label}</span>
      {same ? (
        <span className="font-medium">{to} · no change</span>
      ) : (
        <>
          <span className="opacity-60">{from}</span>→<span className="font-semibold">{to}</span>
          <span className="opacity-75">({diff > 0 ? '+' : ''}{money ? f(diff, true) : diff})</span>
        </>
      )}
    </span>
  )
}

function TotalCard({
  tone, icon, title, note, count, big, bigLabel, alt, paid, change, changeLabel, empty,
}: {
  tone: 'teal' | 'rose'
  icon: ReactNode
  title: string
  note?: string
  count: number
  big: string
  bigLabel: string
  alt: string
  paid: number
  change: number
  changeLabel: string
  empty: string
}) {
  const f = useFmt()
  const teal = tone === 'teal'
  const pct = paid > 0 ? (change / paid) * 100 : 0
  const up = change > 0.005
  const down = change < -0.005
  const Trend = down ? TrendingDown : TrendingUp
  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-xl border p-3 sm:p-3.5 ${
        teal ? 'border-teal-300/20 bg-gradient-to-br from-teal-400/[0.09] to-transparent' : 'border-rose-300/20 bg-gradient-to-br from-rose-400/[0.09] to-transparent'
      }`}
    >
      <div aria-hidden className={`pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full blur-2xl ${teal ? 'bg-teal-400/10' : 'bg-rose-400/10'}`} />
      <div className="relative flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${teal ? 'bg-teal-400/15 text-teal-200' : 'bg-rose-400/15 text-rose-200'}`}>{icon}</span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-zinc-200">
          {title}
          {note && <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-500">{note}</span>}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-px text-[11px] font-semibold tabular-nums ${teal ? 'bg-teal-400/15 text-teal-100' : 'bg-rose-400/15 text-rose-100'}`}>
          {count} {count === 1 ? 'vehicle' : 'vehicles'}
        </span>
      </div>

      {count === 0 ? (
        <p className="relative mt-3 text-sm text-zinc-500">{empty}</p>
      ) : (
        <>
          <div className="relative mt-2.5 flex flex-wrap items-baseline gap-x-2">
            <p key={big} className="animate-tick text-2xl font-bold tabular-nums tracking-tight text-white">{big}</p>
            <p className="text-xs text-zinc-400">{bigLabel}</p>
          </div>
          <p className="alt relative text-[11px] tabular-nums text-zinc-500">≈ {alt}</p>
          <div className="relative mt-2.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-white/[0.06] pt-2.5 text-xs tabular-nums">
            <span className="text-zinc-400">
              Paid <span className="font-semibold text-zinc-100">{f(paid)}</span>
            </span>
            <span
              title={changeLabel}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold ${
                up ? 'bg-emerald-400/10 text-emerald-300' : down ? 'bg-red-400/10 text-red-300' : 'bg-white/5 text-zinc-300'
              }`}
            >
              {(up || down) && <Trend className="h-3 w-3" />}
              {up ? '+' : ''}
              {f(change)}
              {paid > 0 && <span className="font-normal opacity-75">({up ? '+' : ''}{pct.toFixed(1)}%)</span>}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/** "Jun 2027" */
const shortLabel = (key: string) => `${MONTHS_SHORT[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`

function Group({ tone, title, note, count, empty, children }: { tone: 'teal' | 'rose'; title: string; note?: string; count: number; empty: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl border p-2 ${tone === 'teal' ? 'border-teal-300/15 bg-teal-400/[0.03]' : 'border-rose-300/15 bg-rose-400/[0.03]'}`}>
      <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
        <span className={`h-1.5 w-1.5 rounded-full ${tone === 'teal' ? 'bg-teal-300' : 'bg-rose-300'}`} />
        {title}
        {note && <span className="font-normal normal-case tracking-normal text-zinc-500">({note})</span>}
        <span className={`ml-auto rounded-full px-1.5 py-px text-[11px] tabular-nums ${tone === 'teal' ? 'bg-teal-400/15 text-teal-100' : 'bg-rose-400/15 text-rose-100'}`}>{count}</span>
      </p>
      {count === 0 ? (
        <p className="px-0.5 pb-0.5 text-[11px] text-zinc-500">{empty}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(11.5rem,1fr))] gap-1.5">{children}</ul>
      )}
    </div>
  )
}

/** One vehicle as a small box: icon, name, one short line, and one action. Drag it onto a property card. */
function Box({ v, sub, subCls = 'text-zinc-500', tone, dim, children }: { v: { item: Item; key: string }; sub: string; subCls?: string; tone?: 'rose'; dim?: boolean; children?: ReactNode }) {
  const f = useFmt()
  const t = TREND[v.item.trend]
  return (
    <li
      {...dragVehicle(v.item.id, v.item.name)}
      title={`${v.item.name} · bought ${labelOfKey(v.key)} · ${f(v.item.price)}`}
      className={`flex min-w-0 cursor-grab items-center gap-1.5 rounded-lg border bg-black/25 py-1 pl-1 pr-1 active:cursor-grabbing ${
        tone === 'rose' ? 'border-rose-300/15' : 'border-white/[0.07]'
      } ${dim ? 'opacity-60 hover:opacity-100' : ''}`}
    >
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${dim ? 'bg-white/5 text-zinc-500' : `${t.iconBg} ${t.text}`}`}>
        <Car className="h-3.5 w-3.5" />
      </span>
      {/* Click to edit it right here */}
      <button onClick={() => editItem(v)} title={`Edit ${v.item.name}`} className="min-w-0 flex-1 rounded-md text-left leading-tight transition hover:opacity-80">
        <span className={`block truncate text-[13px] font-medium ${dim ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100'}`}>{v.item.name}</span>
        <span className={`block truncate text-[10px] ${subCls}`}>{sub}</span>
      </button>
      <IconBtn label={`Edit ${v.item.name}`} onClick={() => editItem(v)}>
        <Pencil className="h-3.5 w-3.5" />
      </IconBtn>
      {children}
    </li>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} title={label} aria-label={label} className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white">
      {children}
    </button>
  )
}

/** A small house button that opens the list of properties (a real menu underneath, so it works well on phones). */
function PutAt({ v, properties, onPut, back }: { v: Item; properties: Parking['properties']; onPut: (v: Item, pid: string) => void; back?: boolean }) {
  if (!properties.length) return null
  const label = back ? `Bring ${v.name} back: put it at…` : `Put ${v.name} at…`
  return (
    <label title={label} className="relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md border border-teal-300/25 bg-teal-400/10 text-teal-100 transition hover:bg-teal-400/20">
      <Home className="h-3.5 w-3.5" />
      <span className="sr-only">{label}</span>
      <select value="" onChange={(e) => onPut(v, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        <option value="" disabled>
          {back ? 'Bring back to…' : 'Put at…'}
        </option>
        {properties.map((p) => (
          <option key={p.item.id} value={p.item.id}>
            {p.item.name}
          </option>
        ))}
      </select>
    </label>
  )
}

function YearSelect({ value, onChange, label }: { value: number; onChange: (y: number) => void; label: string }) {
  return (
    <label className="relative inline-flex h-9 flex-1 items-center rounded-xl border border-white/10 bg-black/30 pl-3 pr-8 text-sm font-medium tabular-nums text-white transition hover:border-white/20 sm:flex-none">
      <span className="mr-2 text-xs font-normal text-zinc-500">{label}</span>
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={label} className="w-full cursor-pointer appearance-none bg-transparent outline-none">
        {YEARS.map((y) => (
          <option key={y} value={y} className="bg-[#0e1016]">
            {y}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-zinc-500" />
    </label>
  )
}

function AssetCard({ asset: { item, key, index }, asOf, asOfLabel, parking }: { asset: Asset; asOf: number; asOfLabel: string; parking: Parking | null }) {
  const f = useFmt()
  const u = useAlt()
  const t = TREND[item.trend]
  const kind = useKindOf()(item.category)
  const KindIcon = kindIcon(kind)
  const fav = !!item.favorite
  const later = valueAfter(item, asOf - index)
  const change = later - item.price
  const { month, year } = fromIndex(index)
  const items = useItemIndex()
  const isVehicle = item.category === 'vehicle'
  // Property cards take a dragged vehicle (unless it's already kept here).
  const dragging = useVehicleDrag()
  const dragged = dragging ? items.byId.get(dragging) : undefined
  // Where a vehicle is now: in the picked month's setup, or where it's normally kept.
  const keptAt = (id: string) => (parking ? parking.at.get(id) : items.byId.get(id)?.item.propertyId)
  const target = item.category === 'property' && !!dragged && keptAt(dragged.item.id) !== item.id
  const [over, setOver] = useState(false)

  function drop() {
    const v = vehicleDrag.get()
    setOver(false)
    vehicleDrag.set(null)
    const placed = v ? items.byId.get(v) : undefined
    if (!placed || placed.item.category !== 'vehicle' || keptAt(placed.item.id) === item.id) return
    if (parking) {
      useStore.getState().setKeptAt(parking.monthKey, placed.item.id, item.id)
      toast.info(`“${placed.item.name}” is at ${item.name} in the ${labelOfKey(parking.monthKey)} setup.`)
    } else {
      useStore.getState().keepVehicleAt(placed.item.id, item.id)
      toast.info(`Keeping “${placed.item.name}” at ${item.name}.`)
    }
  }

  function star() {
    const now = useStore.getState().toggleFavorite(key, item.id)
    toast.info(now ? `★ Added “${item.name}” to Favorites.` : `Removed “${item.name}” from Favorites.`)
  }

  return (
    <article
      id={`asset-${item.id}`}
      {...zoomName(`i-${item.id}`)}
      {...(isVehicle ? dragVehicle(item.id, item.name) : {})}
      onDragOver={
        target
          ? (e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'move'
              setOver(true)
            }
          : undefined
      }
      onDragLeave={target ? (e) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver(false) : undefined}
      onDrop={
        target
          ? (e) => {
              e.preventDefault()
              drop()
            }
          : undefined
      }
      title={isVehicle ? 'Drag onto a property to keep it there' : undefined}
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 transition ${t.border} ${t.bg} ${
        fav ? 'bg-gradient-to-br from-amber-300/[0.12] via-transparent to-transparent ring-1 ring-amber-300/30' : ''
      } ${isVehicle ? 'cursor-grab active:cursor-grabbing' : ''} ${dragging === item.id ? 'opacity-50' : ''} ${
        target ? (over ? 'ring-2 ring-teal-300/80' : 'ring-1 ring-teal-300/40') : ''
      }`}
    >
      {target && (
        <span
          aria-hidden
          className={`pointer-events-none absolute right-12 top-3 rounded-full px-2 py-0.5 text-[10px] font-medium transition ${
            over ? 'bg-teal-400/25 text-teal-100' : 'bg-black/40 text-teal-200/70'
          }`}
        >
          Drop to keep here
        </span>
      )}
      {fav && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200 to-amber-400" />}
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.iconBg} ${t.text}`}>
          <KindIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-white">{item.name}</h4>
          <p className="truncate text-xs text-zinc-400">
            {kind.label} · {MONTHS_SHORT[month]} {year}
            {parking && key === parking.monthKey && <span className="ml-1.5 rounded-full bg-emerald-400/15 px-1.5 py-px text-[10px] font-semibold text-emerald-200">New</span>}
          </p>
        </div>
        <button
          onClick={star}
          title={fav ? 'Remove from Favorites' : 'Add to Favorites'}
          aria-label={fav ? 'Remove from Favorites' : 'Add to Favorites'}
          aria-pressed={fav}
          className={`-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition active:scale-90 ${
            fav ? 'text-amber-300 hover:bg-amber-300/10' : 'text-zinc-600 hover:bg-white/10 hover:text-amber-300'
          }`}
        >
          <Star className={`h-5 w-5 ${fav ? 'fill-amber-300' : ''}`} strokeWidth={fav ? 2 : 1.75} />
        </button>
      </div>

      <div className="mt-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xl font-bold tabular-nums text-white">{f(item.price)}</p>
          <p className="alt truncate text-xs tabular-nums text-zinc-500">≈ {u(item.price)}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${t.border} ${t.bg} ${t.text}`}>
          <t.icon className="h-3.5 w-3.5" /> {t.label}
          {item.trend !== 'stable' && item.rate > 0 && <span className="opacity-80">· {item.rate}%/yr</span>}
        </span>
      </div>

      <Kept item={item} drag parking={parking} />

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <p className="min-w-0 truncate text-xs text-zinc-400">
          {item.trend === 'stable' ? (
            'Holds its value'
          ) : (
            <>
              <span className="font-medium tabular-nums text-zinc-200">{f(later, true)}</span> by {asOfLabel}{' '}
              <span className={`tabular-nums ${change >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                ({change >= 0 ? '+' : ''}
                {f(change, true)})
              </span>
            </>
          )}
        </p>
        <div className="flex shrink-0 gap-0.5">
          <button
            onClick={() => useStore.getState().openModal({ type: 'item', key, editId: item.id })}
            title="Edit"
            aria-label="Edit"
            className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => goToMonth(key)}
            title="Open this month in the Planner"
            className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <CalendarDays className="h-3.5 w-3.5" /> Open month
          </button>
        </div>
      </div>
    </article>
  )
}

function Tile({ k, v, sub, cls = 'text-white' }: { k: string; v: string; sub: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="truncate text-[11px] font-medium text-zinc-500">{k}</p>
      <p key={v} className={`animate-tick mt-1 truncate text-lg font-bold tabular-nums ${cls}`}>
        {v}
      </p>
      <p className="alt truncate text-[11px] tabular-nums text-zinc-500">{sub}</p>
    </div>
  )
}

function Chip({ on, onClick, cls, disabled, children }: { on: boolean; onClick: () => void; cls: string; disabled?: boolean; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition disabled:opacity-30 ${
        on ? cls : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
