import { useLayoutEffect, useRef, type ReactNode } from 'react'

/*
 * Shows its content whole inside one screen: on wide screens (where the top menu is) it scales the content down just
 * enough that the section it's in, under the 4rem sticky bar, fits the window with nothing cut off. The content is laid
 * out wider by the same amount, so after scaling it still fills the width (no empty sides). It never scales below `min`;
 * past that the section simply grows. Pop-up windows are portalled to <body>, so they keep their full size.
 *
 * The section must have the `screen` class, and the element holding everything in it (heading, tabs, this) must be
 * marked `data-fit-root`, so the space taken by everything else can be measured.
 */
/** The sticky bar: 4rem plus its 1px bottom line. */
const HEADER = 65

export function FitScreen({ children, min = 0.55 }: { children: ReactNode; min?: number }) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const box = outer.current
    const el = inner.current
    if (!box || !el) return
    const wide = matchMedia('(min-width: 1024px)')
    let busy = false

    const fit = () => {
      if (busy) return
      busy = true
      try {
        if (!wide.matches) {
          el.style.cssText = ''
          box.style.height = ''
          return
        }
        const section = box.closest<HTMLElement>('.screen')
        const root = box.closest<HTMLElement>('[data-fit-root]')
        if (!section || !root) return
        const cs = getComputedStyle(section)
        // Everything in the section that isn't this box (heading, tabs, gaps), measured without the centring.
        const others = root.offsetHeight - box.offsetHeight
        const avail = window.innerHeight - HEADER - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom) - others
        const W = box.clientWidth
        el.style.position = 'absolute'
        el.style.left = '0'
        el.style.top = '0'
        el.style.transformOrigin = '0 0'
        // Wider layout → shorter content, so settle the scale in a few steps.
        let s = 1
        for (let k = 0; k < 5; k++) {
          el.style.width = `${W / s}px`
          const next = Math.max(min, Math.min(1, avail / el.offsetHeight))
          if (Math.abs(next - s) < 0.004) {
            s = next
            break
          }
          s = next
        }
        el.style.width = `${W / s}px`
        el.style.transform = s < 1 ? `scale(${s})` : ''
        box.style.height = `${Math.ceil(el.offsetHeight * s)}px`
      } finally {
        busy = false
      }
    }

    fit()
    const ro = new ResizeObserver(() => requestAnimationFrame(fit))
    ro.observe(el)
    window.addEventListener('resize', fit)
    wide.addEventListener('change', fit)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', fit)
      wide.removeEventListener('change', fit)
    }
  }, [min])

  return (
    <div ref={outer} className="relative">
      <div ref={inner}>{children}</div>
    </div>
  )
}
