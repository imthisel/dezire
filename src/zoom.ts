import { useEffect, useSyncExternalStore, type CSSProperties } from 'react'
import { flushSync } from 'react-dom'
import { useStore, type PhoneCols } from './store'
import { useIsPhone } from './lib/useMedia'

/*
 * Phones: pinch with two fingers to switch the month and item grids between 1, 2 and 3 columns.
 * Grids mark themselves with `data-zoom-grid`; each card / tile with `data-zoom-item`, an `id` that stays the same
 * between its card and tile form, and `zoomName(...)` so the browser can morph one into the other.
 */

/** Columns the grids show right now: the phone setting on phones, 1 (= normal layout) everywhere else. */
export function useCols(): PhoneCols {
  const phone = useIsPhone()
  const cols = useStore((s) => s.phoneCols)
  return phone ? cols : 1
}

/** Grid classes for phones at each zoom level (bigger screens keep their own breakpoints). */
export const PHONE_GRID: Record<PhoneCols, string> = {
  1: 'grid-cols-1 gap-3',
  2: 'grid-cols-2 gap-2.5',
  3: 'grid-cols-3 gap-2',
}

/** Props that let a card and its tile morph into each other while zooming (names only apply during the switch). */
export const zoomName = (name: string) => ({ 'data-zoom-item': '', style: { '--vt': `z-${name}` } as CSSProperties })

// ---- The little "1 · 2 · 3" indicator shown while pinching ----

export type Hud = { active: boolean; target: PhoneCols; at: number }
let hud: Hud = { active: false, target: 1, at: 0 }
const subs = new Set<() => void>()
const setHud = (h: Omit<Hud, 'at'>) => {
  hud = { ...h, at: Date.now() }
  subs.forEach((f) => f())
}
export const useZoomHud = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => void subs.delete(f)),
    () => hud,
  )

// ---- Switching ----

/** Month to show unfolded after zooming in on its tile (read by MonthCard when it appears). */
export let openOnZoom: string | null = null

/**
 * Switches the phone grids to `cols` columns. Cards glide to their new places, and `anchor` stays where it is on screen.
 * `before` runs right before the layout changes (after the old look has been captured).
 */
export function zoomTo(cols: PhoneCols, opts: { anchor?: Element | null; open?: string; before?: () => void } = {}) {
  const { phoneCols, setPhoneCols } = useStore.getState()
  if (phoneCols === cols) return opts.before?.()
  const id = opts.anchor?.id
  const top = opts.anchor?.getBoundingClientRect().top
  if (opts.open) openOnZoom = opts.open
  setHud({ active: false, target: cols })

  const update = () => {
    opts.before?.()
    flushSync(() => setPhoneCols(cols))
    const el = id ? document.getElementById(id) : null
    if (el && top !== undefined) {
      // Keep it on screen (and clear of the header area) at about the same height.
      const want = Math.min(Math.max(top, 12), window.innerHeight * 0.45)
      window.scrollBy(0, el.getBoundingClientRect().top - want)
    }
  }

  const root = document.documentElement
  const motion = !window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || !motion) {
    update()
  } else {
    root.classList.add('zooming')
    const t = document.startViewTransition(update)
    t.finished.finally(() => root.classList.remove('zooming'))
  }
  setTimeout(() => (openOnZoom = null), 800)
}

// ---- The pinch gesture ----

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** Which column count a pinch to `ratio` (finger distance now ÷ at the start) lands on. */
function targetFor(cols: PhoneCols, ratio: number): PhoneCols {
  let t: number = cols
  if (ratio < 0.8) t = cols + (ratio < 0.5 ? 2 : 1)
  else if (ratio > 1.25) t = cols - (ratio > 1.8 ? 2 : 1)
  return clamp(t, 1, 3) as PhoneCols
}

/** Listens for two-finger pinches on phones. Mount once. */
export function usePinchZoom() {
  useEffect(() => {
    type Gesture = { d0: number; cols: PhoneCols; target: PhoneCols; grids: HTMLElement[]; anchor: Element | null; raf: number }
    let g: Gesture | null = null

    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const allowed = () => {
      const s = useStore.getState()
      return window.matchMedia('(max-width: 639px)').matches && !s.modal && s.view !== 'plan'
    }
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      return r.bottom > 0 && r.top < window.innerHeight && r.height > 0
    }

    function start(e: TouchEvent) {
      if (e.touches.length !== 2 || g || !allowed()) return
      // Only when a grid is on screen; elsewhere the browser's own zoom keeps working.
      const grids = [...document.querySelectorAll<HTMLElement>('[data-zoom-grid]')].filter(visible)
      if (!grids.length) return
      if (e.cancelable) e.preventDefault()
      const [a, b] = [e.touches[0], e.touches[1]]
      const mx = (a.clientX + b.clientX) / 2
      const my = (a.clientY + b.clientY) / 2
      const anchor =
        document.elementFromPoint(mx, my)?.closest('[data-zoom-item]') ??
        grids.flatMap((el) => [...el.querySelectorAll('[data-zoom-item]')]).find((el) => el.getBoundingClientRect().top >= 0 && visible(el)) ??
        null
      for (const el of grids) {
        const r = el.getBoundingClientRect()
        el.style.transition = ''
        el.style.transformOrigin = `${mx - r.left}px ${my - r.top}px`
        el.style.willChange = 'transform'
      }
      const cols = useStore.getState().phoneCols
      g = { d0: Math.max(dist(e.touches), 1), cols, target: cols, grids, anchor, raf: 0 }
      setHud({ active: true, target: cols })
    }

    function move(e: TouchEvent) {
      if (!g || e.touches.length < 2) return
      if (e.cancelable) e.preventDefault()
      const ratio = dist(e.touches) / g.d0
      // Follows the fingers, with resistance once there's no further to go.
      const edge = (ratio < 1 && g.cols === 3) || (ratio > 1 && g.cols === 1)
      const scale = edge ? 1 + (ratio - 1) * 0.12 : clamp(1 + (ratio - 1) * 0.55, 0.62, 1.4)
      const grids = g.grids
      cancelAnimationFrame(g.raf)
      g.raf = requestAnimationFrame(() => grids.forEach((el) => (el.style.transform = `scale(${scale})`)))
      const target = targetFor(g.cols, ratio)
      if (target !== g.target) {
        g.target = target
        navigator.vibrate?.(8)
        setHud({ active: true, target })
      }
    }

    function end(e: TouchEvent) {
      if (!g || e.touches.length >= 2) return
      const cur = g
      g = null
      cancelAnimationFrame(cur.raf)
      const clear = () =>
        cur.grids.forEach((el) => {
          el.style.transform = ''
          el.style.transformOrigin = ''
          el.style.willChange = ''
          el.style.transition = ''
        })
      if (cur.target === cur.cols) {
        // Not far enough: spring back.
        setHud({ active: false, target: cur.cols })
        cur.grids.forEach((el) => {
          el.style.transition = 'transform 0.38s cubic-bezier(0.34, 1.4, 0.64, 1)'
          el.style.transform = ''
        })
        setTimeout(clear, 400)
        return
      }
      zoomTo(cur.target, { anchor: cur.anchor, before: clear })
    }

    // iOS Safari zooms the page with its own gesture events; stop that while a pinch is ours.
    const gesture = (e: Event) => g && e.cancelable && e.preventDefault()

    const opts = { passive: false } as const
    document.addEventListener('touchstart', start, opts)
    document.addEventListener('touchmove', move, opts)
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    document.addEventListener('gesturestart', gesture, opts)
    document.addEventListener('gesturechange', gesture, opts)
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
      document.removeEventListener('gesturestart', gesture)
      document.removeEventListener('gesturechange', gesture)
    }
  }, [])
}
