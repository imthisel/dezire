import { useLayoutEffect, useRef, type ReactNode } from 'react'

/**
 * One line of text that shrinks to fit its box instead of being cut off: big amounts on narrow phone cards stay whole.
 * Its size comes from `className` (e.g. "text-[28px]"); it never goes below `min` px, and only past that is it cut off with "…".
 */
export function FitText({ children, className = '', min = 12, as: Tag = 'p' }: { children: ReactNode; className?: string; min?: number; as?: 'p' | 'span' }) {
  const ref = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let width = -1
    const fit = () => {
      el.style.fontSize = ''
      const room = el.clientWidth
      width = room
      const need = el.scrollWidth
      if (!room || need <= room) return
      const base = parseFloat(getComputedStyle(el).fontSize)
      // Text width scales with font size, so one step gets it there; the small margin covers rounding.
      el.style.fontSize = `${Math.max(min, Math.floor(((base * room) / need) * 10) / 10 - 0.2)}px`
    }
    fit()
    // Again once the web fonts are in (they're a different width), and whenever the box changes width.
    document.fonts?.ready.then(fit).catch(() => {})
    const ro = new ResizeObserver(() => el.clientWidth !== width && fit())
    ro.observe(el)
    return () => ro.disconnect()
  }, [children, min])

  return (
    <Tag ref={ref as never} className={`block overflow-hidden text-ellipsis whitespace-nowrap ${className}`}>
      {children}
    </Tag>
  )
}
