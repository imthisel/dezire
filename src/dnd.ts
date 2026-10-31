import { useSyncExternalStore } from 'react'

/**
 * The item currently being dragged (dataTransfer can't be read during dragover).
 * `group`: when it's one of several picked items, the ids of all of them (it included), which go along with it.
 */
export const drag: { current: { fromKey: string; id: string; group?: string[] } | null } = { current: null }

/** The ids a drag carries. */
export const dragIds = (d: { id: string; group?: string[] }) => d.group ?? [d.id]

/** Shows "N items" under the pointer instead of the one row being dragged. */
export function groupDragImage(e: DragEvent, count: number) {
  const el = document.createElement('div')
  el.textContent = `${count} items`
  el.className = 'fixed -left-[999px] top-0 rounded-xl border border-indigo-400/60 bg-indigo-500 px-3 py-2 text-sm font-semibold text-white shadow-lg'
  document.body.append(el)
  e.dataTransfer?.setDragImage(el, -12, -12)
  setTimeout(() => el.remove())
}

/** The yearly goal currently being dragged. */
export const goalDrag: { current: { year: number; id: string } | null } = { current: null }

let draggingVehicle: string | null = null
const vehicleSubs = new Set<() => void>()
/** The vehicle being dragged onto a property in Assets (so every property card can light up). */
export const vehicleDrag = {
  get: () => draggingVehicle,
  set(id: string | null) {
    draggingVehicle = id
    vehicleSubs.forEach((f) => f())
  },
}
export const useVehicleDrag = () =>
  useSyncExternalStore(
    (f) => (vehicleSubs.add(f), () => void vehicleSubs.delete(f)),
    () => draggingVehicle,
  )
