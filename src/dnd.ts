import { useSyncExternalStore } from 'react'

/** The item currently being dragged (dataTransfer can't be read during dragover). */
export const drag: { current: { fromKey: string; id: string } | null } = { current: null }

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
