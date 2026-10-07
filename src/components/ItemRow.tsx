import { useState, type DragEvent, type MouseEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowRightLeft, ArrowUp, Car, Copy, CopyPlus, GripVertical, Home, Pencil, Plus, Scissors, Star, StickyNote, Trash2 } from 'lucide-react'
import type { Item } from '../lib/types'
import { CATEGORY, TREND } from '../lib/meta'
import { useFmt, useItemIndex, useStore, useUsd } from '../store'
import { labelOfKey } from '../lib/time'
import { goToMonth } from '../nav'
import { drag } from '../dnd'
import { NotYet } from './Kept'
import { toast } from '../toast'

interface Props {
  item: Item
  monthKey: string
  over?: boolean
  /** Neighbours in the month's list, for Move up / Move down */
  prevId?: string
  nextId?: string
}

export function ItemRow({ item, monthKey, over = false, prevId, nextId }: Props) {
  const f = useFmt()
  const u = useUsd()
  const [open, setOpen] = useState(false)
  /** Where a dragged item would land relative to this one */
  const [dropAt, setDropAt] = useState<null | 'above' | 'below'>(null)
  const clipboard = useStore((s) => s.clipboard)
  const t = TREND[item.trend]
  const cat = CATEGORY[item.category]
  const isCut = clipboard?.mode === 'cut' && clipboard.item.id === item.id

  const act = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const s = useStore.getState
  const fav = !!item.favorite
  const note = item.notes?.trim() ?? ''
  const index = useItemIndex()
  const isProperty = item.category === 'property'
  const isVehicle = item.category === 'vehicle'
  // Property: vehicles kept here. Vehicle: the property it's kept at (if it still exists).
  const vehicles = isProperty ? (index.vehiclesAt.get(item.id) ?? []) : []
  const keptAt = isVehicle && item.propertyId ? index.byId.get(item.propertyId) : undefined
  const home = keptAt?.item.category === 'property' ? keptAt : undefined
  const edit = () => s().openModal({ type: 'item', key: monthKey, editId: item.id })

  function toggleFav() {
    const now = s().toggleFavorite(monthKey, item.id)
    toast.info(now ? `★ Added “${item.name}” to Favorites.` : `Removed “${item.name}” from Favorites.`)
  }

  const actions = [
    ...(prevId
      ? [{ icon: ArrowUp, label: 'Move up', run: () => s().transferItem(monthKey, item.id, monthKey, 'move', { id: prevId, after: false }) }]
      : []),
    ...(nextId
      ? [{ icon: ArrowDown, label: 'Move down', run: () => s().transferItem(monthKey, item.id, monthKey, 'move', { id: nextId, after: true }) }]
      : []),
    {
      icon: Copy, label: 'Copy (then Paste on any month)',
      run: () => { s().copyToClipboard(monthKey, item.id, 'copy'); toast.info(`Copied “${item.name}”. Click Paste on any month.`) },
    },
    {
      icon: Scissors, label: 'Cut (then Paste on any month)',
      run: () => { s().copyToClipboard(monthKey, item.id, 'cut'); toast.info(`Cut “${item.name}”. Click Paste on the month to move it to.`) },
    },
    { icon: ArrowRightLeft, label: 'Move / copy to…', run: () => s().openModal({ type: 'move', key: monthKey, id: item.id }) },
    {
      icon: CopyPlus, label: 'Duplicate in this month',
      run: () => toast.result(s().transferItem(monthKey, item.id, monthKey, 'copy'), 'Duplicated.'),
    },
    { icon: Pencil, label: 'Edit', run: edit },
    {
      icon: Trash2, label: 'Delete', danger: true,
      run: () => { s().removeItem(monthKey, item.id); toast.info(`Deleted “${item.name}”.`) },
    },
  ]

  const half = (e: DragEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below'
  }

  function onDragOver(e: DragEvent<HTMLLIElement>) {
    const d = drag.current
    if (!d) return
    setDropAt(d.id === item.id ? null : half(e))
  }

  function onDrop(e: DragEvent<HTMLLIElement>) {
    setDropAt(null)
    const d = drag.current
    if (!d || d.id === item.id) return
    // Handled here; clearing `drag` makes the month card's own drop handler skip it
    drag.current = null
    e.preventDefault()
    const mode = e.ctrlKey || e.altKey || e.metaKey ? 'copy' : 'move'
    const r = s().transferItem(d.fromKey, d.id, monthKey, mode, { id: item.id, after: half(e) === 'below' })
    if (d.fromKey !== monthKey || mode === 'copy') toast.result(r, mode === 'copy' ? 'Copied.' : 'Moved.')
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        drag.current = { fromKey: monthKey, id: item.id }
        e.dataTransfer.effectAllowed = 'copyMove'
        e.dataTransfer.setData('text/plain', item.name)
      }}
      onDragEnd={() => (drag.current = null)}
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
      onDrop={onDrop}
      onClick={() => setOpen((o) => !o)}
      title={over ? 'Not enough money left (or over the budget) this month — move it to another month' : undefined}
      className={`group relative flex cursor-grab flex-wrap items-center gap-2.5 rounded-xl border py-2 pl-2.5 pr-2 transition sm:pl-1.5 ${open ? '' : 'sm:flex-nowrap'} active:cursor-grabbing ${
        over ? 'border-red-500/60 bg-red-500/15 ring-1 ring-red-500/40' : `${t.border} ${t.bg}`
      } ${
        // Favorites get a gold glow and edge on top of the trend colour, so the trend still shows.
        fav ? `bg-gradient-to-r from-amber-300/[0.16] via-amber-300/[0.04] to-transparent ${over ? '' : 'ring-1 ring-amber-300/45'}` : ''
      } ${
        isCut ? 'border-dashed opacity-45' : 'hover:brightness-125'
      }`}
    >
      {dropAt && (
        <span
          className={`pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-indigo-400 ${dropAt === 'above' ? '-top-1' : '-bottom-1'}`}
        />
      )}
      {fav && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[11px] bg-gradient-to-b from-amber-200 to-amber-400" />}
      <GripVertical className="hidden h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-zinc-400 sm:block" />
      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.iconBg} ${t.text}`}>
        <cat.icon className="h-4 w-4" />
        {fav && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#14120a] ring-1 ring-amber-300/60">
            <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1 truncate text-sm font-medium ${over ? 'text-red-200' : 'text-zinc-100'}`}>
          {over && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />}
          <span className="truncate">{item.name}</span>
          {!open && vehicles.length > 0 && (
            <span title={`${vehicles.length} vehicle${vehicles.length > 1 ? 's' : ''} kept here`} className="inline-flex shrink-0 items-center gap-0.5 text-[10px] font-medium tabular-nums text-teal-200/70">
              <Car className="h-3 w-3" />
              {vehicles.length}
            </span>
          )}
          {!open && home && (
            <Home aria-label={`Kept at ${home.item.name}`} className="h-3 w-3 shrink-0 text-teal-200/60">
              <title>Kept at {home.item.name}</title>
            </Home>
          )}
          {note && !open && (
            <StickyNote aria-label="Has a note" className="h-3 w-3 shrink-0 text-amber-200/60">
              <title>Has a note · click to read</title>
            </StickyNote>
          )}
        </p>
        <p className={`flex items-center gap-1 truncate text-[11px] ${t.text}`}>
          <t.icon className="h-3 w-3 shrink-0" />
          {t.label}
          {item.trend !== 'stable' && item.rate > 0 && <span className="opacity-80">· {item.rate}%/yr</span>}
          <span className="hidden text-zinc-500 sm:inline">· {cat.short}</span>
        </p>
      </div>

      <button
        onClick={act(toggleFav)}
        onDragStart={(e) => e.preventDefault()}
        title={fav ? 'Remove from Favorites' : 'Add to Favorites'}
        aria-label={fav ? 'Remove from Favorites' : 'Add to Favorites'}
        aria-pressed={fav}
        className={`-mx-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition active:scale-90 ${
          fav ? 'text-amber-300 hover:bg-amber-300/10' : 'text-zinc-600 hover:bg-white/10 hover:text-amber-300'
        }`}
      >
        <Star className={`h-4 w-4 ${fav ? 'fill-amber-300' : ''}`} strokeWidth={fav ? 2 : 1.75} />
      </button>
      <div className={`shrink-0 text-right ${open ? 'max-sm:block sm:hidden' : 'sm:group-hover:hidden'}`}>
        <p className={`text-sm font-semibold tabular-nums ${over ? 'text-red-300' : 'text-zinc-100'}`}>{f(item.price)}</p>
        <p className="text-[10px] tabular-nums text-zinc-500">≈ {u(item.price)}</p>
      </div>
      <div
        className={`shrink-0 items-center gap-0.5 max-sm:order-last max-sm:w-full max-sm:justify-between max-sm:border-t max-sm:border-white/[0.06] max-sm:pt-1.5 ${
          open ? 'animate-fade flex' : 'hidden sm:group-hover:flex'
        }`}
      >
        {actions.map((a) => (
          <button
            key={a.label}
            title={a.label}
            aria-label={a.label}
            onClick={act(a.run)}
            className={`grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 sm:h-7 sm:w-7 sm:rounded-md ${
              a.danger ? 'hover:text-red-300' : 'hover:text-white'
            }`}
          >
            <a.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>

      {/* Property: the vehicles kept here. Vehicle: where it's kept. Only shown once clicked open. */}
      {open && isProperty && (
        <div className="animate-fade basis-full rounded-lg border border-teal-300/15 bg-black/30 p-2" onClick={(e) => e.stopPropagation()}>
          <p className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-100/70">
            <Car className="h-3.5 w-3.5" /> Vehicles kept here
            {vehicles.length > 0 && <span className="tabular-nums text-teal-100/40">· {vehicles.length}</span>}
          </p>
          {vehicles.length === 0 ? (
            <p className="px-0.5 pb-0.5 text-xs text-zinc-500">None yet. Open a vehicle and pick this property under “Where is it kept?”.</p>
          ) : (
            <ul className="space-y-0.5">
              {vehicles.map((v) => {
                const vt = TREND[v.item.trend]
                return (
                  <li key={v.item.id}>
                    <button
                      onClick={() => (v.key === monthKey ? s().openModal({ type: 'item', key: v.key, editId: v.item.id }) : goToMonth(v.key))}
                      title={v.key === monthKey ? 'Edit this vehicle' : `Open ${labelOfKey(v.key)}`}
                      className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition hover:bg-white/[0.06]"
                    >
                      <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${vt.iconBg} ${vt.text}`}>
                        <Car className="h-3.5 w-3.5" />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{v.item.name}</span>
                      <NotYet vehicleKey={v.key} propertyKey={monthKey} />
                      <span className="shrink-0 text-[11px] text-zinc-500">{labelOfKey(v.key)}</span>
                      <span className="w-16 shrink-0 text-right text-xs font-semibold tabular-nums text-zinc-300">{f(v.item.price, true)}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
      {open && isVehicle && (
        <div className="animate-fade basis-full" onClick={(e) => e.stopPropagation()}>
          {home ? (
            <button
              onClick={() => goToMonth(home.key)}
              title={`Open ${labelOfKey(home.key)}`}
              className="flex w-full items-center gap-2 rounded-lg border border-teal-300/15 bg-black/30 px-2.5 py-2 text-left transition hover:bg-black/40"
            >
              <Home className="h-3.5 w-3.5 shrink-0 text-teal-200/80" />
              <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
                Kept at <span className="font-medium text-white">{home.item.name}</span>
              </span>
              <span className="shrink-0 text-[11px] text-zinc-500">{labelOfKey(home.key)}</span>
            </button>
          ) : (
            <button onClick={edit} className="inline-flex h-7 items-center gap-1.5 rounded-md px-1 text-xs text-zinc-500 transition hover:text-teal-200">
              <Home className="h-3 w-3" /> Keep it at a property
            </button>
          )}
        </div>
      )}

      {/* Note: only shown once the item is clicked open */}
      {open && (
        <div className="animate-fade basis-full" onClick={(e) => e.stopPropagation()}>
          {note ? (
            <div className="flex gap-2.5 rounded-lg border border-amber-200/15 bg-black/30 py-2 pl-2.5 pr-1.5">
              <StickyNote className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-200/70" />
              <p className="min-w-0 flex-1 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-300">{note}</p>
              <button
                onClick={edit}
                title="Edit note"
                aria-label="Edit note"
                className="-my-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white"
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <button
              onClick={edit}
              className="inline-flex h-7 items-center gap-1.5 rounded-md px-1 text-xs text-zinc-500 transition hover:text-amber-200"
            >
              <Plus className="h-3 w-3" /> Add a note
            </button>
          )}
        </div>
      )}
    </li>
  )
}
