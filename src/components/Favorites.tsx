import { useMemo, useState, type ReactNode } from 'react'
import { BarChart3, CalendarDays, Pencil, Star } from 'lucide-react'
import { useFmt, useKindOf, useStore, useAlt } from '../store'
import { TREND, kindIcon } from '../lib/meta'
import { valueAfter } from '../lib/calc'
import { END_YEAR, MONTHS_SHORT, TOTAL_MONTHS, YEARS, currentYear, fromIndex, indexOfKey, labelOf } from '../lib/time'
import type { Item, Trend } from '../lib/types'
import { card } from './Dashboard'
import { goTo, goToMonth } from '../nav'
import { toast } from '../toast'
import { Kept } from './Kept'
import { YearNote } from './YearNote'
import { ItemTile } from './Tiles'
import { ZoomControl } from './Zoom'
import { PHONE_GRID, useCols, zoomName } from '../zoom'

type Fav = { item: Item; key: string; index: number; year: number }
type Filter = 'all' | Trend

const TRENDS = Object.keys(TREND) as Trend[]

/** Every starred item across all months, grouped by year. */
export function Favorites() {
  const months = useStore((s) => s.months)
  const f = useFmt()
  const u = useAlt()
  const cols = useCols()
  const [picked, setFilter] = useState<Filter>('all')

  const favs = useMemo(() => {
    const out: Fav[] = []
    for (const key of Object.keys(months).sort()) {
      const index = indexOfKey(key)
      if (!(index >= 0 && index < TOTAL_MONTHS)) continue
      for (const item of months[key].items) if (item.favorite) out.push({ item, key, index, year: Number(key.slice(0, 4)) })
    }
    return out
  }, [months])

  // Unstarring the last item of the picked trend falls back to showing everything.
  const filter: Filter = picked !== 'all' && !favs.some((x) => x.item.trend === picked) ? 'all' : picked
  const shown = filter === 'all' ? favs : favs.filter((x) => x.item.trend === filter)
  const total = favs.reduce((s, x) => s + x.item.price, 0)
  const worth = favs.reduce((s, x) => s + valueAfter(x.item, TOTAL_MONTHS - 1 - x.index), 0)
  const years = [...new Set(shown.map((x) => x.year))]

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 via-amber-400 to-orange-400 shadow-lg shadow-amber-500/20">
            <Star className="h-5 w-5 fill-white text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Favorites</h2>
            <p className="text-sm text-zinc-400">
              {favs.length ? `${favs.length} item${favs.length > 1 ? 's' : ''} you starred` : 'The things you want most, all in one place.'}
            </p>
          </div>
        </div>

        {favs.length > 0 && (
          <>
            <div className="relative mt-4 grid grid-cols-2 gap-2.5">
              <Tile k="Total price" v={f(total)} sub={`≈ ${u(total)}`} />
              <Tile
                k={`Worth by end of ${END_YEAR}`}
                v={f(worth)}
                sub={`${worth >= total ? '+' : ''}${f(worth - total, true)} vs. price`}
                cls={worth >= total ? 'text-emerald-300' : 'text-red-300'}
              />
            </div>
            <div className="relative mt-3 flex flex-wrap gap-2" role="group" aria-label="Show">
              <Chip on={filter === 'all'} onClick={() => setFilter('all')} cls="border-white/30 bg-white/10 text-white">
                All <span className="opacity-60">{favs.length}</span>
              </Chip>
              {TRENDS.map((k) => {
                const t = TREND[k]
                const n = favs.filter((x) => x.item.trend === k).length
                return (
                  <Chip key={k} on={filter === k} onClick={() => setFilter(k)} cls={`${t.border} ${t.bg} ${t.text}`} disabled={!n}>
                    <t.icon className="h-3.5 w-3.5" /> {t.label} <span className="opacity-60">{n}</span>
                  </Chip>
                )
              })}
            </div>
          </>
        )}
      </section>

      {favs.length === 0 ? (
        <section className={`${card} grid place-items-center px-6 py-14 text-center`}>
          <div className="max-w-sm">
            <span className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl border border-dashed border-amber-300/40 text-amber-300">
              <Star className="h-6 w-6" />
            </span>
            <h3 className="text-base font-semibold text-white">No favorites yet</h3>
            <p className="mt-1 text-sm text-zinc-400">
              Tap the <Star className="inline h-3.5 w-3.5 -translate-y-px text-amber-300" /> next to any item in your months and it will show up here.
            </p>
            <button
              onClick={() => goTo('years')}
              className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-400 px-4 text-sm font-semibold text-black shadow-lg shadow-amber-500/20 transition hover:brightness-110"
            >
              <CalendarDays className="h-4 w-4" /> Go to my months
            </button>
          </div>
        </section>
      ) : (
        <>
          <YearTotals favs={shown} filter={filter} />
          <ZoomControl />
          {years.map((y) => {
            const inYear = shown.filter((x) => x.year === y)
            const sum = inYear.reduce((s, x) => s + x.item.price, 0)
            return (
              <section key={y} id={`fav-year-${y}`} className="scroll-mt-4 space-y-2.5">
                <div className="flex items-baseline justify-between gap-3 px-1">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">
                    {y}{' '}
                    <span className="font-medium normal-case tracking-normal text-zinc-600">
                      · {inYear.length} item{inYear.length > 1 ? 's' : ''}
                    </span>
                  </h3>
                  <p className="shrink-0 text-sm font-semibold tabular-nums text-zinc-300">{f(sum)}</p>
                </div>
                <YearNote year={y} compact />
                <div data-zoom-grid className={`grid md:grid-cols-2 xl:grid-cols-3 ${PHONE_GRID[cols]}`}>
                  {inYear.map((x) => {
                    if (cols === 1) return <FavCard key={x.item.id} fav={x} />
                    const { month, year } = fromIndex(x.index)
                    return <ItemTile key={x.item.id} item={x.item} domId={`fav-${x.item.id}`} when={`${MONTHS_SHORT[month]} ${year}`} cols={cols} />
                  })}
                </div>
              </section>
            )
          })}
        </>
      )}
    </div>
  )
}

/** How much the shown favorites cost in each year: a bar per year split by trend, with the running total. */
function YearTotals({ favs, filter }: { favs: Fav[]; filter: Filter }) {
  const f = useFmt()
  const u = useAlt()
  const now = currentYear()

  const rows = useMemo(() => {
    const by = new Map<number, { total: number; count: number; trend: Record<Trend, number> }>()
    for (const x of favs) {
      const r = by.get(x.year) ?? { total: 0, count: 0, trend: { appreciating: 0, depreciating: 0, stable: 0 } }
      r.total += x.item.price
      r.count++
      r.trend[x.item.trend] += x.item.price
      by.set(x.year, r)
    }
    // Every year of the plan, so years with nothing starred show as ₱0 instead of disappearing.
    let run = 0
    return YEARS.map((year) => {
      const r = by.get(year) ?? { total: 0, count: 0, trend: { appreciating: 0, depreciating: 0, stable: 0 } }
      return { year, ...r, running: (run += r.total) }
    })
  }, [favs])

  const used = rows.filter((r) => r.count > 0)
  if (!used.length) return null
  const grand = rows[rows.length - 1].running
  const max = Math.max(...rows.map((r) => r.total))
  const top = used.reduce((a, b) => (b.total > a.total ? b : a))
  const jump = (y: number) => document.getElementById(`fav-year-${y}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <section className={`${card} p-4 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-300">
            <BarChart3 className="h-[18px] w-[18px]" />
          </span>
          <div className="min-w-0">
            <h3 className="font-semibold text-white">Total per year</h3>
            <p className="truncate text-xs text-zinc-500">
              What your favorites cost each year{filter !== 'all' && <> · {TREND[filter].label.toLowerCase()} only</>}
            </p>
          </div>
        </div>
        {used.length > 1 && (
          <dl className="flex gap-5 text-right">
            <div>
              <dt className="text-[11px] font-medium text-zinc-500">Average / year</dt>
              <dd className="text-sm font-semibold tabular-nums text-zinc-200">{f(grand / used.length, true)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-medium text-zinc-500">Biggest year</dt>
              <dd className="text-sm font-semibold tabular-nums text-amber-200">
                {top.year} <span className="font-normal text-zinc-500">· {f(top.total, true)}</span>
              </dd>
            </div>
          </dl>
        )}
      </div>

      <ul className="mt-4 grid grid-cols-1 gap-x-6 gap-y-1 lg:grid-cols-2">
        {rows.map((r) => {
          const share = grand > 0 ? Math.round((r.total / grand) * 100) : 0
          if (!r.count)
            return (
              <li key={r.year} className="-mx-2 flex items-baseline justify-between gap-3 rounded-xl px-2 py-2 text-zinc-600">
                <p className="flex min-w-0 items-baseline gap-2">
                  <span className="text-sm font-semibold tabular-nums text-zinc-500">{r.year}</span>
                  {r.year === now && (
                    <span className="rounded-full bg-amber-300/10 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-amber-200/70">
                      This year
                    </span>
                  )}
                  <span className="truncate text-xs">No favorites</span>
                </p>
                <span className="shrink-0 text-sm tabular-nums">{f(0)}</span>
              </li>
            )
          return (
            <li key={r.year}>
              <button
                onClick={() => jump(r.year)}
                title={`Show ${r.year}`}
                className="group -mx-2 block w-[calc(100%+1rem)] rounded-xl px-2 py-2.5 text-left transition hover:bg-white/[0.04]"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <p className="flex min-w-0 items-baseline gap-2">
                    <span className="text-base font-bold tabular-nums text-white">{r.year}</span>
                    {r.year === now && (
                      <span className="rounded-full bg-amber-300/15 px-1.5 py-px text-[10px] font-semibold uppercase tracking-wider text-amber-200">
                        This year
                      </span>
                    )}
                    <span className="truncate text-xs text-zinc-500">
                      {r.count} item{r.count > 1 ? 's' : ''}
                    </span>
                  </p>
                  <p className="shrink-0 text-right">
                    <span className="text-base font-bold tabular-nums text-white">{f(r.total)}</span>
                    <span className="alt-i ml-1.5 hidden text-[11px] tabular-nums text-zinc-500 sm:inline-block">≈ {u(r.total, true)}</span>
                  </p>
                </div>

                {/* Bar length = this year vs. the biggest year; its colours = how much went to each trend */}
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.05]">
                  <div
                    className="flex h-full overflow-hidden rounded-full transition-[width] duration-500 group-hover:brightness-125"
                    style={{ width: `${max > 0 ? Math.max((r.total / max) * 100, 2) : 0}%` }}
                  >
                    {TRENDS.map((k) =>
                      r.trend[k] > 0 ? (
                        <span
                          key={k}
                          title={`${TREND[k].label}: ${f(r.trend[k])}`}
                          className={`h-full ${TREND[k].solid}`}
                          style={{ width: `${(r.trend[k] / r.total) * 100}%` }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>

                <div className="mt-1.5 flex justify-between gap-3 text-[11px] tabular-nums text-zinc-500">
                  <span>{share}% of all</span>
                  <span>
                    Running total <span className="font-medium text-zinc-300">{f(r.running, true)}</span>
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t border-white/[0.06] pt-3">
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-zinc-500">
          {TRENDS.filter((k) => rows.some((r) => r.trend[k] > 0)).map((k) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className={`h-2 w-2 rounded-full ${TREND[k].solid}`} /> {TREND[k].label}
            </span>
          ))}
        </div>
        <p className="text-sm text-zinc-400">
          All years <span className="ml-1 font-bold tabular-nums text-white">{f(grand)}</span>
          <span className="alt-i ml-1.5 text-[11px] tabular-nums text-zinc-500">≈ {u(grand, true)}</span>
        </p>
      </div>
    </section>
  )
}

function FavCard({ fav: { item, key, index } }: { fav: Fav }) {
  const f = useFmt()
  const u = useAlt()
  const t = TREND[item.trend]
  const kind = useKindOf()(item.category)
  const KindIcon = kindIcon(kind)
  const later = valueAfter(item, TOTAL_MONTHS - 1 - index)
  const change = later - item.price

  function unstar() {
    useStore.getState().toggleFavorite(key, item.id)
    toast.info(`Removed “${item.name}” from Favorites.`)
  }

  return (
    <article
      id={`fav-${item.id}`}
      {...zoomName(`i-${item.id}`)}
      className={`relative min-w-0 overflow-hidden rounded-2xl border bg-gradient-to-br from-amber-300/[0.12] via-transparent to-transparent p-4 ring-1 ring-amber-300/30 ${t.border} ${t.bg}`}
    >
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200 to-amber-400" />
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.iconBg} ${t.text}`}>
          <KindIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="truncate font-semibold text-white">{item.name}</h4>
          <p className="truncate text-xs text-zinc-400">
            {kind.label} · {labelOf(index)}
          </p>
        </div>
        <button
          onClick={unstar}
          title="Remove from Favorites"
          aria-label="Remove from Favorites"
          className="-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-amber-300 transition hover:bg-amber-300/10 active:scale-90"
        >
          <Star className="h-5 w-5 fill-amber-300" />
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

      <Kept item={item} />

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
        <p className="min-w-0 truncate text-xs text-zinc-400">
          {item.trend === 'stable' ? (
            'Holds its value'
          ) : (
            <>
              Worth <span className="font-medium tabular-nums text-zinc-200">{f(later, true)}</span> by {END_YEAR}{' '}
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
            title={`Open ${labelOf(index)}`}
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
      <p className={`mt-1 truncate text-lg font-bold tabular-nums ${cls}`}>{v}</p>
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
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:opacity-30 ${
        on ? cls : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
