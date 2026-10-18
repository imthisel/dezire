import { useEffect } from 'react'

/*
 * One-finger dragging on touch screens. Phones' own drag and drop is unreliable (and fights with scrolling),
 * so on touch we do it ourselves: press and hold a draggable row, then move it with the same finger.
 * The row follows the finger, and the usual drag events (dragstart / dragover / drop / dragend) are sent to the
 * page, so every list that can be sorted with a mouse works the same way here — including scrolling near the edges
 * (see autoscroll.ts).
 */

const HOLD_MS = 280
/** Moving further than this before the hold ends means the finger is scrolling, not picking something up. */
const SLOP = 10

/** True while a finger drag is in progress (the pinch zoom stays out of the way). */
export const touchDragging = () => document.documentElement.hasAttribute('data-touch-drag')

type DT = DataTransfer & { _image?: { el: Element; x: number; y: number } }

function makeDataTransfer(): DT {
  let dt: DT
  try {
    dt = new DataTransfer() as DT
  } catch {
    const data: Record<string, string> = {}
    dt = {
      dropEffect: 'none',
      effectAllowed: 'all',
      files: [] as unknown as FileList,
      items: [] as unknown as DataTransferItemList,
      get types() {
        return Object.keys(data)
      },
      setData: (k: string, v: string) => void (data[k] = v),
      getData: (k: string) => data[k] ?? '',
      clearData: (k?: string) => (k ? delete data[k] : Object.keys(data).forEach((x) => delete data[x])),
      setDragImage: () => {},
    } as unknown as DT
  }
  // Remember the picture the page asks for, to use for the floating copy under the finger.
  dt.setDragImage = (el: Element, x: number, y: number) => void (dt._image = { el, x, y })
  return dt
}

function fire(target: EventTarget, type: string, x: number, y: number, dt: DT, related?: EventTarget | null) {
  const init: MouseEventInit = { bubbles: true, cancelable: type !== 'dragleave' && type !== 'dragend', clientX: x, clientY: y, relatedTarget: related ?? null }
  let ev: MouseEvent
  try {
    ev = new DragEvent(type, init)
  } catch {
    ev = new MouseEvent(type, init)
  }
  Object.defineProperty(ev, 'dataTransfer', { value: dt })
  target.dispatchEvent(ev)
  return ev
}

const isField = (el: Element) => !!el.closest('input, textarea, select, [contenteditable="true"]')

/** Turns press-and-hold on draggable rows into a drag on touch screens. Mount once. */
export function useTouchDrag() {
  useEffect(() => {
    const root = document.documentElement

    type Pending = { el: HTMLElement; x: number; y: number; timer: ReturnType<typeof setTimeout> }
    type Active = {
      src: HTMLElement
      dt: DT
      ghost: HTMLElement
      dx: number
      dy: number
      x: number
      y: number
      over: Element | null
      accepted: boolean
      tick: ReturnType<typeof setInterval>
    }
    let pending: Pending | null = null
    let active: Active | null = null

    const cancelPending = () => {
      if (pending) clearTimeout(pending.timer)
      pending = null
    }

    function begin(p: Pending) {
      pending = null
      const dt = makeDataTransfer()
      const start = fire(p.el, 'dragstart', p.x, p.y, dt)
      if (start.defaultPrevented) return
      navigator.vibrate?.(12)

      // Floating copy of the row (or of whatever the page picked as the drag picture).
      const pic = (dt._image?.el as HTMLElement | undefined) ?? p.el
      const r = pic.getBoundingClientRect()
      const ghost = pic.cloneNode(true) as HTMLElement
      ghost.removeAttribute('id')
      ghost.querySelectorAll('[id]').forEach((n) => n.removeAttribute('id'))
      Object.assign(ghost.style, {
        position: 'fixed',
        left: '0',
        top: '0',
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: '0',
        zIndex: '9999',
        pointerEvents: 'none',
        opacity: '0.95',
        borderRadius: '14px',
        boxShadow: '0 18px 40px -8px rgba(0,0,0,0.7), 0 0 0 1px rgba(129,140,248,0.5)',
        transition: 'transform 0.18s cubic-bezier(0.34, 1.56, 0.64, 1)',
        transform: `translate(${r.left}px, ${r.top}px) scale(1)`,
        willChange: 'transform',
        background: '#11131b',
      } satisfies Partial<CSSStyleDeclaration>)
      document.body.appendChild(ghost)
      const dx = dt._image ? Math.min(dt._image.x, r.width) : p.x - r.left
      const dy = dt._image ? Math.min(dt._image.y, r.height) : p.y - r.top
      // "Lift" it a little, then follow the finger without lag.
      requestAnimationFrame(() => {
        ghost.style.transform = `translate(${p.x - dx}px, ${p.y - dy}px) scale(1.03)`
        setTimeout(() => (ghost.style.transition = 'none'), 180)
      })

      root.setAttribute('data-touch-drag', '')
      active = { src: p.el, dt, ghost, dx, dy, x: p.x, y: p.y, over: null, accepted: false, tick: 0 as never }
      // Keep telling the page where the finger is even when it's still: the list scrolls under it.
      active.tick = setInterval(() => active && hover(active.x, active.y), 90)
      hover(p.x, p.y)
    }

    function hover(x: number, y: number) {
      const a = active
      if (!a) return
      a.x = x
      a.y = y
      a.ghost.style.transform = `translate(${x - a.dx}px, ${y - a.dy}px) scale(1.03)`
      const el = document.elementFromPoint(x, y)
      if (el !== a.over) {
        if (a.over) fire(a.over, 'dragleave', x, y, a.dt, el)
        if (el) fire(el, 'dragenter', x, y, a.dt, a.over)
        a.over = el
      }
      a.accepted = el ? fire(el, 'dragover', x, y, a.dt).defaultPrevented : false
    }

    function finish(drop: boolean) {
      const a = active
      if (!a) return
      active = null
      clearInterval(a.tick)
      if (drop && a.over && a.accepted) fire(a.over, 'drop', a.x, a.y, a.dt)
      else if (a.over) fire(a.over, 'dragleave', a.x, a.y, a.dt, null)
      // The row may have left the page mid-drag (e.g. another year opened); still let everyone know it ended.
      fire(a.src.isConnected ? a.src : document, 'dragend', a.x, a.y, a.dt)
      root.removeAttribute('data-touch-drag')
      // Settle into place, then disappear.
      a.ghost.style.transition = 'opacity 0.16s ease, transform 0.16s ease'
      a.ghost.style.opacity = '0'
      a.ghost.style.transform += ' scale(0.97)'
      setTimeout(() => a.ghost.remove(), 170)
    }

    function onStart(e: TouchEvent) {
      if (active) return
      if (e.touches.length !== 1) return cancelPending()
      const t = e.touches[0]
      const target = e.target as Element
      const el = target.closest?.<HTMLElement>('[draggable="true"]')
      if (!el || isField(target)) return
      cancelPending()
      const p: Pending = { el, x: t.clientX, y: t.clientY, timer: 0 as never }
      p.timer = setTimeout(() => pending === p && begin(p), HOLD_MS)
      pending = p
    }

    function onMove(e: TouchEvent) {
      if (pending) {
        const t = e.touches[0]
        if (e.touches.length !== 1 || Math.hypot(t.clientX - pending.x, t.clientY - pending.y) > SLOP) cancelPending()
        return
      }
      if (!active) return
      // The finger is moving the row, not the page.
      if (e.cancelable) e.preventDefault()
      const t = e.touches[0]
      if (t) hover(t.clientX, t.clientY)
    }

    function onEnd(e: TouchEvent) {
      cancelPending()
      if (!active) return
      // No tap / click on whatever is under the finger after a drop.
      if (e.cancelable) e.preventDefault()
      finish(e.type === 'touchend')
    }

    // The phone's own drag (and its long-press menu) would start on top of ours.
    const stopNative = (e: Event) => {
      if ((pending || active) && e.isTrusted) {
        e.preventDefault()
        e.stopImmediatePropagation()
      }
    }

    const passive = { passive: false } as const
    document.addEventListener('touchstart', onStart, passive)
    document.addEventListener('touchmove', onMove, passive)
    document.addEventListener('touchend', onEnd, passive)
    document.addEventListener('touchcancel', onEnd, passive)
    document.addEventListener('dragstart', stopNative, true)
    document.addEventListener('contextmenu', stopNative, true)
    return () => {
      cancelPending()
      finish(false)
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onEnd)
      document.removeEventListener('dragstart', stopNative, true)
      document.removeEventListener('contextmenu', stopNative, true)
    }
  }, [])
}
