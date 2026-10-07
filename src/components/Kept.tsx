import type { DragEvent } from 'react'
import { Car, Home } from 'lucide-react'
import { useFmt, useItemIndex } from '../store'
import { TREND } from '../lib/meta'
import { labelOfKey } from '../lib/time'
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

/** For item cards: a property lists the vehicles kept there; a vehicle shows where it's kept. Nothing for other kinds. */
/** `drag`: vehicles can be dragged to another property (Assets). */
export function Kept({ item, drag = false }: { item: Item; drag?: boolean }) {
  const index = useItemIndex()
  const f = useFmt()

  if (item.category === 'property') {
    const vehicles = index.vehiclesAt.get(item.id) ?? []
    if (!vehicles.length) return null
    const home = index.byId.get(item.id)?.key ?? ''
    return (
      <div className="mt-3 rounded-xl border border-teal-300/15 bg-black/25 p-2">
        <p className="mb-1 flex items-center gap-1.5 px-0.5 text-[10px] font-semibold uppercase tracking-wider text-teal-100/70">
          <Car className="h-3.5 w-3.5" /> Vehicles kept here · {vehicles.length}
        </p>
        <ul className="space-y-0.5">
          {vehicles.map((v) => {
            const t = TREND[v.item.trend]
            return (
              <li key={v.item.id}>
                <button
                  onClick={() => goToMonth(v.key)}
                  title={drag ? `Open ${labelOfKey(v.key)} · drag to another property` : `Open ${labelOfKey(v.key)}`}
                  {...(drag ? dragVehicle(v.item.id, v.item.name) : {})}
                  className={`flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left transition hover:bg-white/[0.06] ${drag ? 'cursor-grab active:cursor-grabbing' : ''}`}
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

  if (item.category === 'vehicle' && item.propertyId) {
    const home = index.byId.get(item.propertyId)
    if (home?.item.category !== 'property') return null
    return (
      <button
        onClick={() => goToMonth(home.key)}
        title={`Open ${labelOfKey(home.key)}`}
        className="mt-3 flex w-full items-center gap-2 rounded-xl border border-teal-300/15 bg-black/25 px-2.5 py-2 text-left transition hover:bg-black/40"
      >
        <Home className="h-3.5 w-3.5 shrink-0 text-teal-200/80" />
        <span className="min-w-0 flex-1 truncate text-xs text-zinc-300">
          Kept at <span className="font-medium text-white">{home.item.name}</span>
        </span>
        <span className="shrink-0 text-[11px] text-zinc-500">{labelOfKey(home.key)}</span>
      </button>
    )
  }

  return null
}
