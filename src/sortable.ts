import { useEffect, useState, type DragEvent } from 'react'

/**
 * Drag-to-reorder for one entry of a list: shows where a drop would land and moves the dragged entry there.
 * Spread `zone` on the entry, and `handle(...)` on its grip.
 */
export function useSortable({ id, index, ids, dragId, setDragId, onMove }: {
  id: string
  index: number
  /** The list's ids, in order */
  ids: () => string[]
  dragId: string | null
  setDragId: (id: string | null) => void
  onMove: (id: string, to: number) => void
}) {
  const [dropAt, setDropAt] = useState<null | 'above' | 'below'>(null)
  useEffect(() => {
    if (!dragId) setDropAt(null)
  }, [dragId])
  const half = (e: DragEvent<HTMLElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below'
  }
  const zone = {
    onDragOver: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'move'
      setDropAt(dragId === id ? null : half(e))
    },
    onDragLeave: (e: DragEvent<HTMLElement>) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null),
    onDrop: (e: DragEvent<HTMLElement>) => {
      if (!dragId) return
      e.preventDefault()
      setDropAt(null)
      if (dragId === id) return
      const from = ids().indexOf(dragId)
      // Position in the list once the dragged entry has been taken out of it.
      onMove(dragId, index + (half(e) === 'below' ? 1 : 0) - (from < index ? 1 : 0))
      setDragId(null)
    },
  }
  /** Props for the grip. `ghost` picks the element (closest to the grip) shown under the pointer while dragging. */
  const handle = (ghost: string) => ({
    draggable: true,
    onDragStart: (e: DragEvent<HTMLElement>) => {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', id)
      const el = e.currentTarget.closest(ghost)
      if (el) {
        const r = el.getBoundingClientRect()
        e.dataTransfer.setDragImage(el, e.clientX - r.left, e.clientY - r.top)
      }
      setDragId(id)
    },
    onDragEnd: () => setDragId(null),
  })
  return { dropAt, zone, handle, dragging: dragId === id }
}
