import { useMemo, useState } from 'react'
import { ArrowUpDown, CalendarDays, ChevronDown, Gem, Home, Star } from 'lucide-react'
import { valueAfter } from '../../lib/calc'
import { DEFAULT_KINDS, TREND, kindColor, kindIcon } from '../../lib/meta'
import type { Item, Trend } from '../../lib/types'
import { DEMO_MONTHS, useDemo } from './demoStore'
import { money } from './TryOverview'

/*
 * A playable copy of Assets on the About page: everything in the Wants playground's three months, by kind, with what it
 * cost, what it will be worth, and how it changes in value, as the app shows it. Star one to make it a favorite, pick how
 * far ahead to look, filter and sort. It shares the playground's plan, so changes under Wants show here too.
 */

type Asset = { item: Item; month: number }
type Sort = 'date' | 'price' | 'value' | 'name'
const SORTS: { id: Sort; label: string }[] = [
  { id: 'date', label: 'By month' },
  { id: 'value', label: 'By value' },
  { id: 'price', label: 'By price' },
  { id: 'name', label: 'By name' },
]
/** How far ahead "worth" looks, in months after the first month. */
const AHEAD: { id: number; label: string; short: string }[] = [
  { id: 2, label: `End of ${DEMO_MONTHS[2].name}`, short: `${DEMO_MONTHS[2].short} ${DEMO_MONTHS[2].year}` },
  { id: 12, label: 'In 1 year', short: 'in 1 year' },
  { id: 60, label: 'In 5 years', short: 'in 5 years' },
  { id: 120, label: 'In 10 years', short: 'in 10 years' },
]
const TRENDS: Trend[] = ['appreciating', 'stable', 'depreciating']
const kindOf = (id: string) => DEFAULT_KINDS.find((k) => k.id === id) ?? DEFAULT_KINDS[3]

export function TryAssets({ onOpenMonth }: { onOpenMonth: () => void }) {
  const months = useDemo((s) => s.months)
  const layout = useDemo((s) => s.layout)
  const update = useDemo((s) => s.update)
  const [cat, setCat] = useState<string>('all')
  const [ahead, setAhead] = useState(60)
  const [trend, setTrend] = useState<'all' | Trend>('all')
  const [sort, setSort] = useState<Sort>('date')

  const all = useMemo<Asset[]>(() => months.flatMap((m, month) => m.items.map((item) => ({ item, month }))), [months])
  const worthOf = (a: Asset) => valueAfter(a.item, Math.max(0, ahead - a.month))
  const ofKind = cat === 'all' ? all : all.filter((a) => a.item.category === cat)
  const trendOn = trend !== 'all' && ofKind.some((a) => a.item.trend === trend) ? trend : 'all'
  const shown = useMemo(() => {
    const list = trendOn === 'all' ? ofKind : ofKind.filter((a) => a.item.trend === trendOn)
    const by: Record<Sort, (a: Asset, b: Asset) => number> = {
      date: (a, b) => a.month - b.month,
      price: (a, b) => b.item.price - a.item.price,
      value: (a, b) => worthOf(b) - worthOf(a),
      name: (a, b) => a.item.name.localeCompare(b.item.name),
    }
    return [...list].sort(by[sort])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ofKind, trendOn, sort, ahead])

  const paid = ofKind.reduce((s, a) => s + a.item.price, 0)
  const worth = ofKind.reduce((s, a) => s + worthOf(a), 0)
  const change = worth - paid
  const pct = paid > 0 ? (change / paid) * 100 : 0
  const kind = cat === 'all' ? null : kindOf(cat)
  const HeadIcon = kind ? kindIcon(kind) : Gem
  const when = AHEAD.find((a) => a.id === ahead)!
  const propName = (id?: string) => all.find((a) => a.item.id === id)?.item.name

  function star(a: Asset) {
    update(a.month, { items: months[a.month].items.map((x) => (x.id === a.item.id ? { ...x, favorite: !x.favorite } : x)) })
  }

  return (
    <div className="space-y-4">
      <section className="relative overflow-hidden rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-4 sm:p-6">
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br shadow-lg shadow-black/30 ${kind ? kindColor(kind).grad : 'from-indigo-400 via-violet-400 to-emerald-400'}`}>
            <HeadIcon className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">{kind ? kind.label : 'All assets'}</h3>
            <p className="truncate text-sm text-zinc-400">
              {ofKind.length} item{ofKind.length === 1 ? '' : 's'} · {DEMO_MONTHS[0].short} – {DEMO_MONTHS[2].short} {DEMO_MONTHS[2].year}
            </p>
          </div>
        </div>

        {/* Kinds */}
        <div className="scrollbar-none relative -mx-4 mt-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0" role="tablist" aria-label="Kind">
          {[null, ...DEFAULT_KINDS].map((kd) => {
            const c = kd ? kd.id : 'all'
            const on = cat === c
            const n = kd ? all.filter((a) => a.item.category === c).length : all.length
            const Icon = kd ? kindIcon(kd) : Gem
            return (
              <button
                key={c}
                role="tab"
                aria-selected={on}
                onClick={() => setCat(c)}
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
        </div>

        {/* How far ahead to look */}
        <div className="relative mt-4 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs font-medium text-zinc-500">Worth</span>
          {AHEAD.map((a) => (
            <button
              key={a.id}
              onClick={() => setAhead(a.id)}
              aria-pressed={ahead === a.id}
              className={`inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition ${
                ahead === a.id ? 'border-violet-400/50 bg-violet-500/15 text-violet-100' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Totals */}
        <div className="relative mt-4 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          <Tile k="Items" v={String(ofKind.length)} sub={ofKind.length ? `${ofKind.filter((a) => a.item.favorite).length} favorite` : 'Nothing yet'} />
          <Tile k="Price paid" v={money(paid)} sub="what it all costs" />
          <Tile k={`Worth ${when.short}`} v={money(worth)} sub="as values change" cls="text-indigo-200" />
          <Tile k="Value change" v={`${change >= 0 ? '+' : '−'}${money(Math.abs(change))}`} sub={paid > 0 ? `${change >= 0 ? '+' : ''}${pct.toFixed(1)}% vs. price` : '—'} cls={change > 0.5 ? 'text-emerald-300' : change < -0.5 ? 'text-red-300' : 'text-white'} />
        </div>

        {/* What it's made of (All only) */}
        {cat === 'all' && worth > 0 && (
          <div className="relative mt-4">
            <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/5">
              {DEFAULT_KINDS.map((kd) => {
                const v = all.filter((a) => a.item.category === kd.id).reduce((s, a) => s + worthOf(a), 0)
                return v > 0 ? <div key={kd.id} className={`h-full ${kindColor(kd).bar} transition-all duration-500`} style={{ width: `${(v / worth) * 100}%` }} title={`${kd.label}: ${money(v)}`} /> : null
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
              {DEFAULT_KINDS.map((kd) => {
                const v = all.filter((a) => a.item.category === kd.id).reduce((s, a) => s + worthOf(a), 0)
                return v > 0 ? (
                  <button key={kd.id} onClick={() => setCat(kd.id)} className="inline-flex items-center gap-1.5 transition hover:text-white">
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
        <section className="grid place-items-center rounded-[24px] border border-white/[0.08] bg-[#0b0c10] px-6 py-12 text-center">
          <p className="text-base font-semibold text-white">No {kind ? `“${kind.label}” items` : 'assets'} yet</p>
          <p className="mt-1 text-sm text-zinc-400">Add one under Wants and pick this kind. It shows up here.</p>
          <button onClick={onOpenMonth} className="mt-4 inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white transition hover:brightness-110">
            Go to Wants
          </button>
        </section>
      ) : (
        <>
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
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sort by" className="cursor-pointer appearance-none bg-transparent outline-none">
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id} className="bg-[#0e1016]">
                    {s.label}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 h-4 w-4 text-zinc-500" />
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {shown.map((a) => {
              const { item } = a
              const t = TREND[item.trend]
              const k = kindOf(item.category)
              const KindIcon = kindIcon(k)
              const later = worthOf(a)
              const diff = later - item.price
              const fav = !!item.favorite
              const keptAt = item.category === 'vehicle' ? propName(layout[item.id] ?? item.propertyId) : undefined
              return (
                <article
                  key={item.id}
                  className={`relative min-w-0 overflow-hidden rounded-2xl border p-4 transition ${t.border} ${t.bg} ${fav ? 'bg-gradient-to-br from-amber-300/[0.12] via-transparent to-transparent ring-1 ring-amber-300/30' : ''}`}
                >
                  {fav && <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200 to-amber-400" />}
                  <div className="flex items-start gap-3">
                    <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${t.iconBg} ${t.text}`}>
                      <KindIcon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate font-semibold text-white">{item.name}</h4>
                      <p className="truncate text-xs text-zinc-400">
                        {k.label} · {DEMO_MONTHS[a.month].short} {DEMO_MONTHS[a.month].year}
                      </p>
                    </div>
                    <button
                      onClick={() => star(a)}
                      aria-pressed={fav}
                      aria-label={fav ? `Remove ${item.name} from Favorites` : `Add ${item.name} to Favorites`}
                      className={`-mr-1 -mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-lg transition active:scale-90 ${fav ? 'text-amber-300 hover:bg-amber-300/10' : 'text-zinc-600 hover:bg-white/10 hover:text-amber-300'}`}
                    >
                      <Star className={`h-5 w-5 ${fav ? 'fill-amber-300' : ''}`} strokeWidth={fav ? 2 : 1.75} />
                    </button>
                  </div>

                  <div className="mt-4 flex items-end justify-between gap-3">
                    <p className="truncate text-xl font-bold tabular-nums text-white">{money(item.price)}</p>
                    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-medium ${t.border} ${t.bg} ${t.text}`}>
                      <t.icon className="h-3.5 w-3.5" /> {t.label}
                      {item.trend !== 'stable' && item.rate > 0 && <span className="opacity-80">· {item.rate}%/yr</span>}
                    </span>
                  </div>

                  {keptAt && (
                    <p className="mt-3 flex items-center gap-1.5 truncate rounded-lg border border-teal-300/15 bg-teal-400/[0.06] px-2.5 py-1.5 text-xs text-teal-100/80">
                      <Home className="h-3.5 w-3.5 shrink-0 text-teal-300" /> Kept at {keptAt}
                    </p>
                  )}

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/[0.06] pt-3">
                    <p className="min-w-0 truncate text-xs text-zinc-400">
                      {item.trend === 'stable' ? (
                        'Holds its value'
                      ) : (
                        <>
                          <span className="font-medium tabular-nums text-zinc-200">{money(later)}</span> {when.short}{' '}
                          <span className={`tabular-nums ${diff >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                            ({diff >= 0 ? '+' : '−'}
                            {money(Math.abs(diff))})
                          </span>
                        </>
                      )}
                    </p>
                    <button onClick={onOpenMonth} title="Open its month under Wants" className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white">
                      <CalendarDays className="h-3.5 w-3.5" /> Open month
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function Tile({ k, v, sub, cls = 'text-white' }: { k: string; v: string; sub: string; cls?: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <p className="truncate text-[11px] font-medium text-zinc-500">{k}</p>
      <p key={v} className={`animate-tick mt-1 truncate text-lg font-bold tabular-nums ${cls}`}>{v}</p>
      <p className="truncate text-[11px] tabular-nums text-zinc-500">{sub}</p>
    </div>
  )
}

function Chip({ on, onClick, cls, disabled, children }: { on: boolean; onClick: () => void; cls: string; disabled?: boolean; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={on}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-medium transition disabled:opacity-30 ${on ? cls : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'}`}
    >
      {children}
    </button>
  )
}
