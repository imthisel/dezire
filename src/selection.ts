import { useEffect, useSyncExternalStore, type RefObject } from 'react'

/*
 * Picking several month items at once, the way a file manager does: Ctrl/⌘-click adds or removes one, Shift-click
 * picks everything between the last one clicked and this one, and holding the mouse down on an empty spot then
 * dragging draws a box that picks every item it touches. Dragging any picked item then takes all of them along.
 * Item rows mark themselves with `data-sel-id`.
 */

let picked: ReadonlySet<string> = new Set()
/** Where a Shift-click range starts from */
let anchor: string | null = null
const subs = new Set<() => void>()
const subscribe = (f: () => void) => (subs.add(f), () => void subs.delete(f))

function set(next: ReadonlySet<string>) {
  if (next.size === picked.size && [...next].every((id) => picked.has(id))) return
  picked = next
  subs.forEach((f) => f())
}

/** Item rows on the screen, top to bottom, month by month. */
const rows = () => [...document.querySelectorAll<HTMLElement>('[data-sel-id]')]

export const selection = {
  get: () => picked,
  has: (id: string) => picked.has(id),
  clear() {
    anchor = null
    set(new Set())
  },
  /** Ctrl/⌘-click: adds or takes away one item. */
  toggle(id: string) {
    const next = new Set(picked)
    if (!next.delete(id)) next.add(id)
    anchor = id
    set(next)
  },
  /** Shift-click: everything from the last item clicked to this one (Ctrl/⌘ too: added to what's already picked). */
  range(id: string, add: boolean) {
    const ids = rows().map((el) => el.dataset.selId!)
    const a = anchor ? ids.indexOf(anchor) : -1
    const b = ids.indexOf(id)
    if (a < 0 || b < 0) return selection.toggle(id)
    const next = new Set(add ? picked : [])
    for (let i = Math.min(a, b); i <= Math.max(a, b); i++) next.add(ids[i])
    set(next)
  },
  set: (ids: Iterable<string>) => set(new Set(ids)),
  /** A plain click: Shift-clicking another item next picks from this one. */
  setAnchor: (id: string) => void (anchor = id),
}

export const useSelected = (id: string) => useSyncExternalStore(subscribe, () => picked.has(id))
export const useSelection = () => useSyncExternalStore(subscribe, () => picked)

/** Things that do their own thing on a click, so pressing on them never starts a selection box. */
const OWN_CLICK = '[data-sel-id], input, textarea, select, button, a, label, [contenteditable], [role="button"], [draggable="true"]'

/**
 * Hold the left mouse button on an empty spot inside `area` and drag: a box is drawn and every item it touches gets
 * picked (Ctrl/⌘/Shift adds them to what's already picked). A plain click on an empty spot lets go of the selection.
 * Near the top or bottom of the window the page scrolls, so the box can reach months further away.
 */
export function useBoxSelect(area: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const root = area.current
    if (!root) return
    let start: { x: number; y: number } | null = null
    let base: ReadonlySet<string> = new Set()
    let box: HTMLDivElement | null = null
    let x = 0
    let y = 0
    let raf = 0

    function down(e: PointerEvent) {
      if (e.pointerType !== 'mouse' || e.button !== 0 || (e.target as Element).closest(OWN_CLICK)) return
      start = { x: e.pageX, y: e.pageY }
      x = e.clientX
      y = e.clientY
      base = e.ctrlKey || e.metaKey || e.shiftKey ? picked : new Set()
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      window.addEventListener('scroll', scrolled)
    }

    // Scrolling with the wheel mid-drag stretches the box too.
    const scrolled = () => box && !raf && (raf = requestAnimationFrame(frame))

    function move(e: PointerEvent) {
      x = e.clientX
      y = e.clientY
      if (!start) return
      if (!box) {
        if (Math.hypot(e.pageX - start.x, e.pageY - start.y) < 5) return
        box = document.createElement('div')
        box.className = 'pointer-events-none absolute z-50 rounded-md border border-indigo-400/70 bg-indigo-400/15'
        document.body.append(box)
        document.body.classList.add('select-none')
        window.getSelection()?.removeAllRanges()
      }
      if (!raf) raf = requestAnimationFrame(frame)
    }

    function frame() {
      raf = 0
      if (!start || !box) return
      // Scroll near the window's edges, faster the closer to them.
      const zone = 60
      const dy = y < zone ? -(zone - y) : y > window.innerHeight - zone ? y - (window.innerHeight - zone) : 0
      if (dy) window.scrollBy(0, Math.round(dy / 3))

      const px = x + window.scrollX
      const py = y + window.scrollY
      const l = Math.min(start.x, px)
      const t = Math.min(start.y, py)
      const r = Math.max(start.x, px)
      const b = Math.max(start.y, py)
      Object.assign(box.style, { left: `${l}px`, top: `${t}px`, width: `${r - l}px`, height: `${b - t}px` })

      const next = new Set(base)
      for (const el of rows()) {
        const rc = el.getBoundingClientRect()
        if (!rc.width || !rc.height) continue
        const el0 = rc.left + window.scrollX
        const et0 = rc.top + window.scrollY
        if (el0 < r && el0 + rc.width > l && et0 < b && et0 + rc.height > t) next.add(el.dataset.selId!)
      }
      set(next)
      if (dy) raf = requestAnimationFrame(frame)
    }

    function up(e: PointerEvent) {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('scroll', scrolled)
      cancelAnimationFrame(raf)
      raf = 0
      start = null
      if (!box) {
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) selection.clear()
        return
      }
      box.remove()
      box = null
      document.body.classList.remove('select-none')
      // The click that follows letting go shouldn't also open (or un-pick) the item it landed on.
      const eat = (ev: Event) => (ev.stopPropagation(), ev.preventDefault())
      window.addEventListener('click', eat, { capture: true, once: true })
      setTimeout(() => window.removeEventListener('click', eat, { capture: true }))
    }

    root.addEventListener('pointerdown', down)
    return () => {
      root.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
      window.removeEventListener('scroll', scrolled)
      cancelAnimationFrame(raf)
      box?.remove()
      document.body.classList.remove('select-none')
    }
  }, [area])
}
