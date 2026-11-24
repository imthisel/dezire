import { useMemo, useState, type DragEvent, type ReactNode } from 'react'
import { BadgeDollarSign, Car, GripVertical, Home, Pencil, TrendingDown, TrendingUp, Trash2, X } from 'lucide-react'
import { valueAfter } from '../../lib/calc'
import { TREND } from '../../lib/meta'
import type { Item } from '../../lib/types'
import { DemoItemModal } from './DemoDialogs'
import { compute, money, moneyShort, placesFor } from './TryOverview'
import { DEMO_OFFSETS, SETUP_MONTH, monthLabel, monthsBetween, placedOf, shortLabel, useDemo, type Placed } from './demoStore'

/*
 * A playable copy of Assets → Setups: where each vehicle is in one month's setup. Drag a vehicle onto a property to keep
 * it there; a vehicle that isn't at a property counts as sold from that setup on. Same plan as the playground above:
 * add a property or a vehicle there and it shows up here.
 */

const LABEL = monthLabel(SETUP_MONTH)
const SHORT = shortLabel(SETUP_MONTH)
/** What `p` is worth by the setup's month. */
const worth = (p: Placed) => valueAfter(p.item, monthsBetween(p.month, SETUP_MONTH))
const NONE = '__none__'

export function TrySetups() {
  const months = useDemo((s) => s.months)
  const layout = useDemo((s) => s.layout)
  const { setKeptAt, fillLayout } = useDemo.getState()
  const [dragId, setDragId] = useState<string | null>(null)
  const [over, setOver] = useState<string | null>(null)
  const [said, setSaid] = useState('')
  const [editing, setEditing] = useState<Placed | null>(null)

  const properties = useMemo(() => placedOf(months, 'property'), [months])
  const vehicles = useMemo(() => placedOf(months, 'vehicle'), [months])
  // Where each vehicle is in this setup (only properties that are still in the plan count).
  const at = useMemo(() => {
    const m = new Map<string, string>()
    for (const v of vehicles) {
      const p = layout[v.item.id]
      if (p && properties.some((x) => x.item.id === p)) m.set(v.item.id, p)
    }
    return m
  }, [vehicles, properties, layout])
  const placed = vehicles.filter((v) => at.has(v.item.id))
  const unplaced = vehicles.filter((v) => !at.has(v.item.id))
  const nameOf = (id: string) => properties.find((p) => p.item.id === id)?.item.name ?? ''
  // Where vehicles are usually kept (chosen when adding or editing them), for "Usual spots".
  const usual: Record<string, string> = {}
  for (const v of vehicles) if (v.item.propertyId && properties.some((p) => p.item.id === v.item.propertyId)) usual[v.item.id] = v.item.propertyId

  function put(v: Item, pid: string) {
    if (at.get(v.id) === pid) return
    setKeptAt(v.id, pid)
    setSaid(`“${v.name}” is at ${nameOf(pid)} in the ${LABEL} setup.`)
  }
  function takeOff(v: Item) {
    if (!at.has(v.id)) return
    setKeptAt(v.id, null)
    setSaid(`“${v.name}” isn’t at a property in the ${LABEL} setup · counts as sold from then.`)
  }

  const drag = (v: Item) => ({
    draggable: true,
    onDragStart: (e: DragEvent) => {
      e.stopPropagation()
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', v.name)
      setDragId(v.id)
    },
    onDragEnd: () => (setDragId(null), setOver(null)),
  })
  /** A place a dragged vehicle can be dropped: a property, or `NONE` (not at a property). */
  const zone = (target: string) => ({
    onDragOver: (e: DragEvent) => {
      if (!dragId || (target === NONE ? !at.has(dragId) : at.get(dragId) === target)) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      if (over !== target) setOver(target)
    },
    onDragLeave: (e: DragEvent) => !e.currentTarget.contains(e.relatedTarget as Node) && setOver((o) => (o === target ? null : o)),
    onDrop: (e: DragEvent) => {
      e.preventDefault()
      const v = vehicles.find((x) => x.item.id === dragId)?.item
      setDragId(null)
      setOver(null)
      if (!v) return
      if (target === NONE) takeOff(v)
      else put(v, target)
    },
  })

  // Totals, as in the app: what's still yours, and what's sold (worth what it was by this setup).
  const keptPaid = placed.reduce((n, v) => n + v.item.price, 0)
  const keptWorth = placed.reduce((n, v) => n + worth(v), 0)
  const soldPaid = unplaced.reduce((n, v) => n + v.item.price, 0)
  const soldFor = unplaced.reduce((n, v) => n + worth(v), 0)
  const totalPaid = keptPaid + soldPaid
  const keptShare = totalPaid > 0 ? (keptPaid / totalPaid) * 100 : 0
  const dragging = dragId ? vehicles.find((v) => v.item.id === dragId)?.item : undefined

  const edit = (p: Placed) => setEditing(p)
  const calc = useMemo(() => compute(months, undefined, DEMO_OFFSETS), [months])

  if (!vehicles.length && !properties.length)
    return (
      <div className="rounded-[24px] border border-dashed border-white/10 px-5 py-10 text-center text-sm text-zinc-400">
        Add a <span className="text-zinc-200">Land / Property</span> and a <span className="text-zinc-200">Vehicle</span> in the playground above (or tap Example) to arrange a setup.
      </div>
    )

  return (
    <div>
      {/* The setup, and ways to fill it */}
      <div className="flex flex-col gap-3 rounded-2xl border border-teal-300/15 bg-teal-400/[0.04] px-4 py-3 sm:flex-row sm:items-center">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-200 max-sm:hidden">
          <Car className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-zinc-100">{LABEL} setup</p>
          <p className="text-xs text-zinc-400">
            {at.size} at a property · {unplaced.length} not (counts as sold) · {properties.length} propert{properties.length === 1 ? 'y' : 'ies'}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {Object.keys(usual).length > 0 && (
            <button
              onClick={() => (fillLayout(usual), setSaid(`${LABEL} setup now matches where vehicles are usually kept.`))}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              <Home className="h-3.5 w-3.5" /> Usual spots
            </button>
          )}
          {at.size > 0 && (
            <button
              onClick={() => (fillLayout({}), setSaid(`Cleared the ${LABEL} setup. Its vehicles show as not at a property.`))}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-rose-500/10 hover:text-rose-300"
            >
              <Trash2 className="h-3.5 w-3.5" /> Clear
            </button>
          )}
        </div>
      </div>

      <p aria-live="polite" className="mt-2 min-h-5 px-1 text-xs text-teal-200/90">
        {said}
      </p>

      <div className="mt-2 grid gap-4 lg:grid-cols-[1.05fr_1fr]">
        {/* Vehicles and their totals */}
        <section className="min-w-0 rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
              <Car className="h-4 w-4 text-teal-200" /> Vehicles · {LABEL} setup
            </h3>
            <p className="text-[11px] text-zinc-500">Not at a property = sold by then</p>
          </div>

          <div className="grid gap-2.5 sm:grid-cols-2">
            <TotalCard tone="teal" icon={<Car className="h-4 w-4" />} title="Still yours" note="at a property" count={placed.length} big={money(keptWorth)} bigLabel={`worth by ${SHORT}`} paid={keptPaid} change={keptWorth - keptPaid} empty="No vehicles at a property in this setup" />
            <TotalCard tone="rose" icon={<BadgeDollarSign className="h-4 w-4" />} title="Sold" note={unplaced.length ? 'this setup' : undefined} count={unplaced.length} big={money(soldFor)} bigLabel="sold for (est.)" paid={soldPaid} change={soldFor - soldPaid} empty="Nothing sold by this setup" />
          </div>
          {totalPaid > 0 && (
            <div className="mt-2.5 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5">
              <div className="flex items-baseline justify-between gap-3 text-[11px]">
                <span className="text-zinc-400">
                  All vehicles by the {LABEL} setup · <span className="tabular-nums">{vehicles.length}</span>
                </span>
                <span className="tabular-nums text-zinc-500">
                  paid <span className="font-semibold text-white">{money(totalPaid)}</span>
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
            </div>
          )}

          <div className="mt-3 grid gap-2.5">
            <Group tone="teal" title="At a property" count={placed.length} empty="None yet · drag one onto a property, or tap its house button">
              {placed.map((v) => (
                <Box key={v.item.id} v={v} sub={`at ${nameOf(at.get(v.item.id)!)}`} subCls="text-teal-200/80" drag={drag(v.item)} dragging={dragId === v.item.id} onEdit={() => edit(v)}>
                  <IconBtn label={`Take ${v.item.name} off its property (sold)`} onClick={() => takeOff(v.item)}>
                    <X className="h-3.5 w-3.5" />
                  </IconBtn>
                </Box>
              ))}
            </Group>
            <div {...zone(NONE)} className={`rounded-xl transition ${over === NONE ? 'ring-2 ring-rose-400/50' : ''}`}>
              <Group tone="rose" title="Not at a property" note="sold" count={unplaced.length} empty={dragging && at.has(dragging.id) ? 'Drop here to take it off its property' : 'Everything you still have is at a property'}>
                {unplaced.map((v) => (
                  <Box key={v.item.id} v={v} sub={`Bought ${shortLabel(v.month)}`} tone="rose" drag={drag(v.item)} dragging={dragId === v.item.id} onEdit={() => edit(v)}>
                    <PutAt v={v.item} properties={properties} onPut={put} />
                  </Box>
                ))}
              </Group>
            </div>
          </div>
        </section>

        {/* Properties: drop a vehicle on one to keep it there */}
        <section className="min-w-0 space-y-3">
          {properties.length === 0 && (
            <p className="rounded-[24px] border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
              No properties yet. Add a Land / Property item in the playground above to keep vehicles there.
            </p>
          )}
          {properties.map((p) => {
            const here = placed.filter((v) => at.get(v.item.id) === p.item.id)
            const w = worth(p)
            const t = TREND[p.item.trend]
            const target = !!dragging && at.get(dragging.id) !== p.item.id
            return (
              <article
                key={p.item.id}
                {...zone(p.item.id)}
                className={`rounded-[22px] border bg-[#0b0c10] p-4 transition ${
                  over === p.item.id ? 'border-teal-300/60 bg-teal-500/[0.07] ring-2 ring-teal-400/40' : target ? 'border-teal-300/30 border-dashed' : 'border-white/[0.08]'
                }`}
              >
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-400/15 text-teal-200">
                    <Home className="h-5 w-5" />
                  </span>
                  <button onClick={() => edit(p)} className="min-w-0 flex-1 text-left" title={`Edit ${p.item.name}`}>
                    <span className="block truncate font-semibold text-white">{p.item.name}</span>
                    <span className="block text-xs text-zinc-500">
                      Bought {shortLabel(p.month)} · {money(p.item.price)}
                    </span>
                  </button>
                  <span className="shrink-0 text-right">
                    <span className="block text-sm font-semibold tabular-nums text-white">{moneyShort(w)}</span>
                    <span className={`block text-[11px] tabular-nums ${t.text}`}>by {SHORT}</span>
                  </span>
                </div>

                {here.length > 0 ? (
                  <div className="mt-3 rounded-xl border border-teal-300/20 bg-black/25 p-2">
                    <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal-100/80">
                      <Car className="h-3.5 w-3.5" /> Vehicles here · {here.length}
                    </p>
                    <ul className="space-y-1">
                      {here.map((v) => {
                        const vt = TREND[v.item.trend]
                        return (
                          <li
                            key={v.item.id}
                            {...drag(v.item)}
                            title="Drag to another property"
                            className={`flex cursor-grab items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-1 active:cursor-grabbing ${dragId === v.item.id ? 'opacity-40' : ''}`}
                          >
                            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${vt.iconBg} ${vt.text}`}>
                              <Car className="h-3.5 w-3.5" />
                            </span>
                            <button onClick={() => edit(v)} title={`Edit ${v.item.name}`} className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-0.5 py-0.5 text-left transition hover:bg-white/[0.05]">
                              <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{v.item.name}</span>
                              <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-200">{moneyShort(v.item.price)}</span>
                            </button>
                            <IconBtn label={`Take ${v.item.name} off this property in this setup`} onClick={() => takeOff(v.item)}>
                              <X className="h-3.5 w-3.5" />
                            </IconBtn>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className={`mt-3 rounded-xl border border-dashed px-3 py-2.5 text-[11px] ${over === p.item.id ? 'border-teal-300/40 text-teal-100' : 'border-teal-300/15 text-zinc-500'}`}>
                    {over === p.item.id ? `Drop to keep “${dragging?.name}” here` : `No vehicles here in the ${LABEL} setup · drag one onto this card`}
                  </p>
                )}
              </article>
            )
          })}
        </section>
      </div>

      {editing &&
        (() => {
          const m = months[editing.month]
          const c = calc[editing.month]
          const it = m.items.find((x) => x.id === editing.item.id)
          if (!it) return null
          return (
            <DemoItemModal
              month={monthLabel(editing.month)}
              budget={m.budget}
              spent={c.spent - it.price}
              available={c.available}
              places={placesFor(months, editing.month).filter((p) => p.id !== it.id)}
              editing={{ ...it, notes: it.notes ?? '' }}
              onClose={() => setEditing(null)}
              onAdd={(n) => useDemo.getState().update(editing.month, { items: m.items.map((x) => (x.id === it.id ? { ...x, ...n, links: n.links, propertyId: n.propertyId } : x)) })}
            />
          )
        })()}
    </div>
  )
}

function TotalCard({ tone, icon, title, note, count, big, bigLabel, paid, change, empty }: {
  tone: 'teal' | 'rose'; icon: ReactNode; title: string; note?: string; count: number; big: string; bigLabel: string; paid: number; change: number; empty: string
}) {
  const teal = tone === 'teal'
  const pct = paid > 0 ? (change / paid) * 100 : 0
  const up = change > 0.5
  const down = change < -0.5
  const Trend = down ? TrendingDown : TrendingUp
  return (
    <div className={`relative min-w-0 overflow-hidden rounded-xl border p-3 ${teal ? 'border-teal-300/20 bg-gradient-to-br from-teal-400/[0.09] to-transparent' : 'border-rose-300/20 bg-gradient-to-br from-rose-400/[0.09] to-transparent'}`}>
      <div className="flex items-center gap-2">
        <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${teal ? 'bg-teal-400/15 text-teal-200' : 'bg-rose-400/15 text-rose-200'}`}>{icon}</span>
        <p className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-zinc-200">
          {title}
          {note && <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-500">{note}</span>}
        </p>
        <span className={`shrink-0 rounded-full px-2 py-px text-[11px] font-semibold tabular-nums ${teal ? 'bg-teal-400/15 text-teal-100' : 'bg-rose-400/15 text-rose-100'}`}>{count}</span>
      </div>
      {count === 0 ? (
        <p className="mt-3 text-sm text-zinc-500">{empty}</p>
      ) : (
        <>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-2">
            <p key={big} className="animate-tick truncate text-xl font-bold tabular-nums tracking-tight text-white">{big}</p>
            <p className="text-[11px] text-zinc-400">{bigLabel}</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1 border-t border-white/[0.06] pt-2 text-[11px] tabular-nums">
            <span className="text-zinc-400">
              Paid <span className="font-semibold text-zinc-100">{moneyShort(paid)}</span>
            </span>
            <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold ${up ? 'bg-emerald-400/10 text-emerald-300' : down ? 'bg-red-400/10 text-red-300' : 'bg-white/5 text-zinc-300'}`}>
              {(up || down) && <Trend className="h-3 w-3" />}
              {up ? '+' : ''}
              {moneyShort(change)}
              {paid > 0 && <span className="font-normal opacity-75">({up ? '+' : ''}{pct.toFixed(1)}%)</span>}
            </span>
          </div>
        </>
      )}
    </div>
  )
}

function Group({ tone, title, note, count, empty, children }: { tone: 'teal' | 'rose'; title: string; note?: string; count: number; empty: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 rounded-xl border p-2 ${tone === 'teal' ? 'border-teal-300/15 bg-teal-400/[0.03]' : 'border-rose-300/15 bg-rose-400/[0.03]'}`}>
      <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-300">
        <span className={`h-1.5 w-1.5 rounded-full ${tone === 'teal' ? 'bg-teal-300' : 'bg-rose-300'}`} />
        {title}
        {note && <span className="font-normal normal-case tracking-normal text-zinc-500">({note})</span>}
        <span className={`ml-auto rounded-full px-1.5 py-px text-[11px] tabular-nums ${tone === 'teal' ? 'bg-teal-400/15 text-teal-100' : 'bg-rose-400/15 text-rose-100'}`}>{count}</span>
      </p>
      {count === 0 ? <p className="px-0.5 pb-0.5 text-[11px] text-zinc-500">{empty}</p> : <ul className="grid grid-cols-[repeat(auto-fill,minmax(12rem,1fr))] gap-1.5">{children}</ul>}
    </div>
  )
}

/** One vehicle as a small box: drag it onto a property card, or use its button. */
function Box({ v, sub, subCls = 'text-zinc-500', tone, drag, dragging, onEdit, children }: {
  v: Placed; sub: string; subCls?: string; tone?: 'rose'; drag: object; dragging: boolean; onEdit: () => void; children?: ReactNode
}) {
  const t = TREND[v.item.trend]
  return (
    <li
      {...drag}
      title={`${v.item.name} · ${money(v.item.price)} · drag onto a property`}
      className={`flex min-w-0 cursor-grab items-center gap-1.5 rounded-lg border bg-black/25 py-1 pl-1 pr-1 transition active:cursor-grabbing ${tone === 'rose' ? 'border-rose-300/15' : 'border-white/[0.07]'} ${dragging ? 'opacity-40' : ''}`}
    >
      <GripVertical className="h-3.5 w-3.5 shrink-0 text-zinc-600 pointer-coarse:hidden" />
      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${t.iconBg} ${t.text}`}>
        <Car className="h-3.5 w-3.5" />
      </span>
      <button onClick={onEdit} title={`Edit ${v.item.name}`} className="min-w-0 flex-1 rounded-md text-left leading-tight transition hover:opacity-80">
        <span className="block truncate text-[13px] font-medium text-zinc-100">{v.item.name}</span>
        <span className={`block truncate text-[10px] ${subCls}`}>{sub}</span>
      </button>
      <IconBtn label={`Edit ${v.item.name}`} onClick={onEdit}>
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

/** A small house button that opens the list of properties (a real menu underneath, so it works on phones too). */
function PutAt({ v, properties, onPut }: { v: Item; properties: Placed[]; onPut: (v: Item, pid: string) => void }) {
  if (!properties.length) return null
  return (
    <label title={`Put ${v.name} at…`} className="relative grid h-7 w-7 shrink-0 cursor-pointer place-items-center rounded-md border border-teal-300/25 bg-teal-400/10 text-teal-100 transition hover:bg-teal-400/20">
      <Home className="h-3.5 w-3.5" />
      <span className="sr-only">Put {v.name} at…</span>
      <select value="" onChange={(e) => onPut(v, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
        <option value="" disabled>
          Put at…
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
