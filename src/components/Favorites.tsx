import { useMemo, useState, type ReactNode } from 'react'
import { CalendarDays, Pencil, Star } from 'lucide-react'
import { useFmt, useKindOf, useStore, useUsd } from '../store'
import { TREND, kindIcon } from '../lib/meta'
import { valueAfter } from '../lib/calc'
import { END_YEAR, TOTAL_MONTHS, indexOfKey, labelOf } from '../lib/time'
import type { Item, Trend } from '../lib/types'
import { card } from './Dashboard'
import { goTo, goToMonth } from '../nav'
import { toast } from '../toast'
import { Kept } from './Kept'

type Fav = { item: Item; key: string; index: number; year: number }
type Filter = 'all' | Trend

const TRENDS = Object.keys(TREND) as Trend[]

/** Every starred item across all months, grouped by year. */
export function Favorites() {
  const months = useStore((s) => s.months)
  const f = useFmt()
  const u = useUsd()
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
        years.map((y) => (
          <section key={y} className="space-y-2.5">
            <h3 className="px-1 text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">{y}</h3>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {shown.filter((x) => x.year === y).map((x) => (
                <FavCard key={x.item.id} fav={x} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  )
}

function FavCard({ fav: { item, key, index } }: { fav: Fav }) {
  const f = useFmt()
  const u = useUsd()
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
          <p className="truncate text-xs tabular-nums text-zinc-500">≈ {u(item.price)}</p>
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
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition disabled:opacity-30 ${
        on ? cls : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}
