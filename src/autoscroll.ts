import { useEffect } from 'react'

/*
 * While anything is being dragged (items between months, goals, plan steps, kinds…), holding it near the top or bottom
 * edge scrolls the page — or the modal it's in — faster the closer it gets. Phones barely do this on their own,
 * and you can't scroll with another finger mid-drag.
 */

/** Height of the phone tab bar, which covers the bottom of the screen. */
const tabBar = () => (window.matchMedia('(max-width: 639px)').matches ? (document.querySelector<HTMLElement>('[data-tabbar]')?.offsetHeight ?? 0) : 0)

/** The nearest scrollable box around `el`, or null for the page itself. */
function scroller(el: Element | null): HTMLElement | null {
  for (let n = el; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    if (!(n instanceof HTMLElement)) continue
    const oy = getComputedStyle(n).overflowY
    if ((oy === 'auto' || oy === 'scroll') && n.scrollHeight > n.clientHeight + 1) return n
  }
  return null
}

/** Listens for drags and scrolls near the edges. Mount once. */
export function useDragAutoScroll() {
  useEffect(() => {
    const coarse = window.matchMedia('(pointer: coarse)').matches
    let dragging = false
    let x = 0
    let y = 0
    let box: HTMLElement | null = null
    let lastMove = 0
    let raf = 0
    let prev = 0

    function frame(now: number) {
      raf = 0
      // Drags that ended without telling us (dropped outside the window, etc.)
      if (!dragging || now - lastMove > 1500) return stop()
      const dt = prev ? Math.min(now - prev, 50) / 16.7 : 1
      prev = now

      const r = box?.getBoundingClientRect()
      const top = r ? Math.max(r.top, 0) : 0
      const bottom = r ? Math.min(r.bottom, window.innerHeight) : window.innerHeight - tabBar()
      const zone = Math.min(coarse ? 110 : 80, (bottom - top) / 3)
      let dir = 0
      let t = 0
      if (y < top + zone) {
        dir = -1
        t = (top + zone - y) / zone
      } else if (y > bottom - zone) {
        dir = 1
        t = (y - (bottom - zone)) / zone
      }
      if (dir) {
        const speed = (3 + 24 * Math.min(1, t) ** 2) * dt
        if (box) box.scrollTop += dir * speed
        else window.scrollBy(0, dir * speed)
      }
      raf = requestAnimationFrame(frame)
    }

    function stop() {
      dragging = false
      box = null
      prev = 0
      cancelAnimationFrame(raf)
      raf = 0
    }

    function start() {
      dragging = true
      lastMove = performance.now()
      // A little tick so you know the hold turned into a drag.
      if (coarse) navigator.vibrate?.(10)
    }

    function over(e: DragEvent) {
      if (!dragging) return
      // Some browsers report 0,0 for the last event of a drag.
      if (!e.clientX && !e.clientY) return
      x = e.clientX
      y = e.clientY
      lastMove = performance.now()
      box = scroller(document.elementFromPoint(x, y))
      if (!raf) raf = requestAnimationFrame(frame)
    }

    document.addEventListener('dragstart', start, true)
    document.addEventListener('dragover', over, true)
    document.addEventListener('drag', over, true)
    document.addEventListener('dragend', stop, true)
    document.addEventListener('drop', stop, true)
    return () => {
      stop()
      document.removeEventListener('dragstart', start, true)
      document.removeEventListener('dragover', over, true)
      document.removeEventListener('drag', over, true)
      document.removeEventListener('dragend', stop, true)
      document.removeEventListener('drop', stop, true)
    }
  }, [])
}
