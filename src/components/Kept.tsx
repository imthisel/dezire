import type { DragEvent } from 'react'
import { Car, Home, Pencil, X } from 'lucide-react'
import { useFmt, useItemIndex, useStore, type Parking } from '../store'
import { toast } from '../toast'
import { TREND } from '../lib/meta'
import { MONTHS_SHORT, labelOfKey } from '../lib/time'
import type { Item } from '../lib/types'
import { goToMonth } from '../nav'
import { vehicleDrag } from '../dnd'

/** A quiet tag for a vehicle bought after the property it's kept at (keys are `YYYY-MM`, so they compare as text). */
export function NotYet({ vehicleKey, propertyKey }: { vehicleKey: string; propertyKey: string }) {
  if (vehicleKey <= propertyKey) return null
  return (
    <span title={`Bought ${labelOfKey(vehicleKey)}, after this property (${labelOfKey(propertyKey)})`} className="shrink-0 text-[10px] italic text-zinc-500">
      not bought yet
    </span>
  )
}

/** Drag handlers for a vehicle that can be dropped onto a property card in Assets. */
export const dragVehicle = (id: string, name: string) => ({
  draggable: true,
  onDragStart: (e: DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', name)
    vehicleDrag.set(id)
  },
  onDragEnd: () => vehicleDrag.set(null),
})

/** Opens the edit dialog for an item, right where you are. */
export const editItem = (p: { item: Item; key: string }) => useStore.getState().openModal({ type: 'item', key: p.key, editId: p.item.id })

/**
 * For item cards: a property lists the vehicles kept there; a vehicle shows where it's kept. Nothing for other kinds.
 * `drag`: vehicles can be dragged to another property (Assets).
 * `parking`: follow one setup instead of where vehicles are usually kept (Assets → Setups).
 */
export function Kept({ item, drag = false, parking }: { item: Item; drag?: boolean; parking?: Parking | null }) {
  const index = useItemIndex()
  const f = useFmt()
  const unpark = (v: Item) => {
    if (!parking) return
    useStore.getState().setKeptAt(parking.monthKey, v.id, null)
    toast.info(`“${v.name}” isn't at a property in the ${labelOfKey(parking.monthKey)} setup · counts as sold from then.`)
  }

  if (item.category === 'property') {
    const vehicles = (parking ? parking.vehiclesAt.get(item.id) : index.vehiclesAt.get(item.id)) ?? []
    if (!vehicles.length)
      return parking ? (
        <p className="mt-3 rounded-xl border border-dashed border-teal-300/15 px-3 py-2 text-[11px] text-zinc-500">
          No vehicles here in the {labelOfKey(parking.monthKey)} setup · drag one onto this card
        </p>
      ) : null
    const home = index.byId.get(item.id)?.key ?? ''
    // Setups: the vehicles placed here get full-size rows (the compact boxes are only for the lists above the cards).
    if (parking)
      return (
        <div className="mt-3 rounded-xl border border-teal-300/20 bg-black/25 p-2">
          <p className="mb-1.5 flex items-center gap-1.5 px-0.5 text-[11px] font-semibold uppercase tracking-wider text-teal-100/80">
            <Car className="h-3.5 w-3.5" /> Vehicles here · {vehicles.length}
          </p>
          <ul className="space-y-1">
            {vehicles.map((v) => {
              const t = TREND[v.item.trend]
              return (
                <li
                  key={v.item.id}
                  {...(drag ? dragVehicle(v.item.id, v.item.name) : {})}
                  title={drag ? 'Drag to another property' : undefined}
                  className={`flex items-center gap-2 rounded-lg border border-white/[0.07] bg-white/[0.03] py-1 pl-1 pr-1 ${drag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-md ${t.iconBg} ${t.text}`}>
                    <Car className="h-3.5 w-3.5" />
                  </span>
                  {/* Name, when it was bought and its price, all on one line. Click to edit it right here. */}
                  <button
                    onClick={() => editItem(v)}
                    title={`Edit ${v.item.name}`}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-0.5 py-0.5 text-left transition hover:bg-white/[0.05]"
                  >
                    <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-white">{v.item.name}</span>
                    <span className="shrink-0 text-[11px] text-zinc-500" title={`Bought ${labelOfKey(v.key)}`}>
                      {MONTHS_SHORT[Number(v.key.slice(5)) - 1]} {v.key.slice(0, 4)}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-200">{f(v.item.price, true)}</span>
                  </button>
                  <button
                    onClick={() => editItem(v)}
                    title={`Edit ${v.item.name}`}
                    aria-label={`Edit ${v.item.name}`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => unpark(v.item)}
                    title="Not at a property (sold)"
                    aria-label={`Take ${v.item.name} off this property in this setup`}
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )
    return (
      <div className="mt-3 rounded-xl border border-teal-300/15 bg-black/25 p-2">
        <p className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-100/70">
          <Car className="h-3.5 w-3.5" /> Vehicles kept here · {vehicles.length}
        </p>
        <ul className="space-y-0.5">
          {vehicles.map((v) => {
            const t = TREND[v.item.trend]
            return (
              <li key={v.item.id} className="flex items-center gap-1">
                <button
                  onClick={() => goToMonth(v.key)}
                  title={drag ? `Open ${labelOfKey(v.key)} · drag to another property` : `Open ${labelOfKey(v.key)}`}
                  {...(drag ? dragVehicle(v.item.id, v.item.name) : {})}
                  className={`flex min-w-0 flex-1 items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-white/[0.06] ${drag ? 'cursor-grab active:cursor-grabbing' : ''}`}
                >
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${t.iconBg} ${t.text}`}>
                    <Car className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-zinc-200">{v.item.name}</span>
                  <NotYet vehicleKey={v.key} propertyKey={home} />
                  <span className="shrink-0 text-[11px] text-zinc-500">{labelOfKey(v.key)}</span>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-zinc-300">{f(v.item.price, true)}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  if (item.category === 'vehicle') {
    const pid = parking ? parking.at.get(item.id) : item.propertyId
    const home = pid ? index.byId.get(pid) : undefined
    if (home?.item.category !== 'property')
      return parking ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl border border-dashed border-white/10 px-3 py-2 text-[11px] text-zinc-500">
          <Home className="h-3.5 w-3.5 shrink-0" /> Not at a property in the {labelOfKey(parking.monthKey)} setup · counts as sold
        </p>
      ) : null
    return (
      <div className="mt-3 flex items-center gap-1 rounded-xl border border-teal-300/15 bg-black/25 pr-1">
        <button
          onClick={() => goToMonth(home.key)}
          title={`Open ${labelOfKey(home.key)}`}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-xl px-2.5 py-2 text-left transition hover:bg-black/40"
        >
          <Home className="h-3.5 w-3.5 shrink-0 text-teal-200/80" />
          <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
            Kept at <span className="font-medium text-white">{home.item.name}</span>
            {parking && <span className="text-zinc-500"> · {labelOfKey(parking.monthKey)}</span>}
          </span>
          {!parking && <span className="shrink-0 text-[11px] text-zinc-500">{labelOfKey(home.key)}</span>}
        </button>
        {parking && <Unpark name={item.name} onClick={() => unpark(item)} />}
      </div>
    )
  }

  return null
}

function Unpark({ name, onClick }: { name: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title="Not at a property (sold)"
      aria-label={`Take ${name} off this property in this setup`}
      className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white"
    >
      <X className="h-3.5 w-3.5" />
    </button>
  )
}
