import { useMemo, useState, type ReactNode } from 'react'
import { ArrowUpDown, CalendarDays, CalendarRange, ChevronDown, Gem, Infinity as All, Pencil, Plus, Star } from 'lucide-react'
import { useFmt, useStore, useUsd, type AssetCat, type AssetPeriod } from '../store'
import { CATEGORY, TREND } from '../lib/meta'
import { valueAfter } from '../lib/calc'
import { END_YEAR, MONTHS_SHORT, START_YEAR, TOTAL_MONTHS, YEARS, currentYear, fromIndex, indexOf, indexOfKey } from '../lib/time'
import type { Category, Item, Trend } from '../lib/types'
import { card } from './Dashboard'
import { goTo, goToMonth } from '../nav'
import { toast } from '../toast'

type Asset = { item: Item; key: string; index: number; year: number }
type Sort = 'date' | 'price' | 'value' | 'name'

const CATS = Object.keys(CATEGORY) as Category[]
const TRENDS = Object.keys(TREND) as Trend[]

/** Page titles and a colour per kind (written out in full so Tailwind keeps them). */
const KIND: Record<AssetCat, { title: string; empty: string; grad: string; bar: string }> = {
  all: { title: 'All assets', empty: 'assets', grad: 'from-indigo-400 via-violet-400 to-emerald-400', bar: '' },
  property: { title: 'Land & property', empty: 'land or property', grad: 'from-teal-300 to-emerald-500', bar: 'bg-teal-400' },
  vehicle: { title: 'Vehicles', empty: 'vehicles', grad: 'from-cyan-300 to-sky-500', bar: 'bg-cyan-400' },
  status: { title: 'Status & other', empty: 'status or other items', grad: 'from-fuchsia-300 to-pink-500', bar: 'bg-fuchsia-400' },
  travel: { title: 'Travel', empty: 'trips', grad: 'from-amber-300 to-orange-500', bar: 'bg-orange-400' },
}

const SORTS: { id: Sort; label: string }[] = [
  { id: 'date', label: 'Date bought' },
  { id: 'price', label: 'Price (high → low)' },
  { id: 'value', label: 'Worth (high → low)' },
  { id: 'name', label: 'Name (A → Z)' },
]

/** First and last month index covered by the period filter. */
function periodRange(p: AssetPeriod): [number, number] {
  if (p.mode === 'all') return [0, TOTAL_MONTHS - 1]
  if (p.mode === 'year') return [indexOf(p.from, 0), indexOf(p.from, 11)]
  return [indexOf(p.from, 0), indexOf(p.to, 11)]
}

const periodLabel = (p: AssetPeriod) =>
  p.mode === 'all' ? `${START_YEAR} – ${END_YEAR}` : p.mode === 'year' || p.from === p.to ? String(p.from) : `${p.from} – ${p.to}`

/** Everything you plan to own, by kind, for the years you pick. */
export function Assets() {
  const months = useStore((s) => s.months)
  const picked = useStore((s) => s.assetCat)
  const cat: AssetCat = picked in KIND ? picked : 'all'
  const period = useStore((s) => s.assetPeriod)
  const { setAssetCat } = useStore.getState()
  const f = useFmt()
  const u = useUsd()
  const [trend, setTrend] = useState<'all' | Trend>('all')
  const [sort, setSort] = useState<Sort>('date')

  const [first, last] = periodRange(period)
  // Values are shown as of the end of the period (December of its last year).
  const asOf = last
  const asOfLabel = `Dec ${fromIndex(asOf).year}`

  /** Every item in the chosen years, any kind. */
  const inPeriod = useMemo(() => {
    const out: Asset[] = []
    for (const key of Object.keys(months).sort()) {
      const index = indexOfKey(key)
      if (!(index >= first && index <= last)) continue
      for (const item of months[key].items) out.push({ item, key, index, year: Number(key.slice(0, 4)) })
    }
    return out
  }, [months, first, last])

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
  const k = KIND[cat]
  const HeadIcon = cat === 'all' ? Gem : CATEGORY[cat].icon
  const byYear = sort === 'date'
  const years = byYear ? [...new Set(shown.map((a) => a.year))] : []

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-violet-500/10 blur-3xl" />

        {/* Title */}
        <div className="relative flex items-center gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-lg shadow-black/30 ${k.grad}`}>
            <HeadIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">{k.title}</h2>
            <p className="truncate text-sm text-zinc-400">
              {ofKind.length} item{ofKind.length === 1 ? '' : 's'} · {periodLabel(period)}
            </p>
          </div>
        </div>

        {/* Kind tabs (same as the sidebar's sub-tabs; handy on phones) */}
        <div className="scrollbar-none relative -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Kind">
          {(['all', ...CATS] as AssetCat[]).map((c) => {
            const on = cat === c
            const n = c === 'all' ? inPeriod.length : inPeriod.filter((a) => a.item.category === c).length
            const Icon = c === 'all' ? Gem : CATEGORY[c].icon
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
                <Icon className={`h-4 w-4 ${on ? 'text-indigo-300' : ''}`} />
                {c === 'all' ? 'All' : CATEGORY[c].short}
                <span className={`tabular-nums ${on ? 'text-indigo-200/70' : 'text-zinc-600'}`}>{n}</span>
              </button>
            )
          })}
        </div>

        <PeriodPicker period={period} />

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
              {CATS.map((c) => {
                const v = inPeriod.filter((a) => a.item.category === c).reduce((s, a) => s + valueAfter(a.item, asOf - a.index), 0)
                return v > 0 ? <div key={c} className={`h-full ${KIND[c].bar}`} style={{ width: `${(v / worth) * 100}%` }} title={`${CATEGORY[c].short}: ${f(v)}`} /> : null
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              {CATS.map((c) => {
                const v = inPeriod.filter((a) => a.item.category === c).reduce((s, a) => s + valueAfter(a.item, asOf - a.index), 0)
                return v > 0 ? (
                  <button key={c} onClick={() => setAssetCat(c)} className="inline-flex items-center gap-1.5 transition hover:text-white">
                    <span className={`h-2 w-2 rounded-full ${KIND[c].bar}`} /> {CATEGORY[c].short}
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
              No {k.empty} {period.mode === 'all' ? 'yet' : `in ${periodLabel(period)}`}
            </h3>
            <p className="mt-1 text-sm text-zinc-400">
              {period.mode === 'all'
                ? 'Add items to any month in the Planner and pick this kind. They show up here.'
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

          {byYear ? (
            years.map((y) => {
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
                  <Grid list={list} asOf={asOf} asOfLabel={asOfLabel} />
                </section>
              )
            })
          ) : (
            <Grid list={shown} asOf={asOf} asOfLabel={asOfLabel} />
          )}
        </>
      )}
    </div>
  )
}

function Grid({ list, asOf, asOfLabel }: { list: Asset[]; asOf: number; asOfLabel: string }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
      {list.map((a) => (
        <AssetCard key={a.item.id} asset={a} asOf={asOf} asOfLabel={asOfLabel} />
      ))}
    </div>
  )
}

/** All years / one year / a range of years. */
function PeriodPicker({ period }: { period: AssetPeriod }) {
  const set = useStore.getState().setAssetPeriod
  const modes: { id: AssetPeriod['mode']; label: string; icon: typeof All }[] = [
    { id: 'all', label: 'All years', icon: All },
    { id: 'year', label: 'One year', icon: CalendarDays },
    { id: 'range', label: 'From – to', icon: CalendarRange },
  ]
  const thisYear = currentYear()

  return (
    <div className="relative mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm sm:inline-grid">
        {modes.map((m) => {
          const on = period.mode === m.id
          return (
            <button
              key={m.id}
              onClick={() => set({ mode: m.id })}
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

function AssetCard({ asset: { item, key, index }, asOf, asOfLabel }: { asset: Asset; asOf: number; asOfLabel: string }) {
  const f = useFmt()
  const u = useUsd()
  const t = TREND[item.trend]
  const cat = CATEGORY[item.category]
  const fav = !!item.favorite
  const later = valueAfter(item, asOf - index)
  const change = later - item.price
  const { month, year } = fromIndex(index)

  function star() {
    const now = useStore.getState().toggleFavorite(key, item.id)
    toast.info(now ? `★ Added “${item.name}” to Favorites.` : `Removed “${item.name}” from Favorites.`)
  }

  return (
    <article
      className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 transition ${t.border} ${t.bg} ${
        fav ? 'bg-gradient-to-br from-amber-300/[0.12] via-transparent to-transparent ring-1 ring-amber-300/30' : ''
      }`}
    >
      {fav && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200 to-amber-400" />}
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.iconBg} ${t.text}`}>
          <cat.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-white">{item.name}</h4>
          <p className="truncate text-xs text-zinc-400">
            {cat.short} · {MONTHS_SHORT[month]} {year}
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
          <p className="truncate text-xs tabular-nums text-zinc-500">≈ {u(item.price)}</p>
        </div>
        <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${t.border} ${t.bg} ${t.text}`}>
          <t.icon className="h-3.5 w-3.5" /> {t.label}
          {item.trend !== 'stable' && item.rate > 0 && <span className="opacity-80">· {item.rate}%/yr</span>}
        </span>
      </div>

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
      <p className="truncate text-[11px] tabular-nums text-zinc-500">{sub}</p>
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
