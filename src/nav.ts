import { useEffect, useState } from 'react'
import { useStore, type AssetCat, type View } from './store'

/** Places the sidebar and the phone tab bar can jump to. Also `month-<key>`, `assets-<category>`, and on the Money plan page `plan-add` and `source-<id>`. */
export type Section = 'overview' | 'years' | 'goals' | 'favorites' | 'assets' | 'plan'

export const PLANNER_SECTIONS = ['overview', 'years', 'goals'] as const

/** Room for the sticky year tabs, so a section isn't hidden underneath them. */
const OFFSET = 72

const viewOf = (id: string): View =>
  id === 'favorites'
    ? 'favorites'
    : id.startsWith('assets')
      ? 'assets'
      : id.startsWith('plan') || id.startsWith('source-')
        ? 'plan'
        : 'planner'

function scrollTo(id: string, instant: boolean) {
  const behavior = instant ? 'instant' : 'smooth'
  if (id === 'overview' || id === 'plan' || id === 'favorites' || id.startsWith('assets')) return window.scrollTo({ top: 0, behavior })
  const el = document.getElementById(id)
  if (!el) return
  const offset = id === 'years' ? 0 : viewOf(id) === 'plan' ? 16 : OFFSET
  window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - offset, behavior })
}

/** Switches page if needed, then scrolls to the section. */
export function goTo(id: string) {
  const s = useStore.getState()
  const view = viewOf(id)
  const switched = s.view !== view
  if (switched) s.setView(view)
  if (id.startsWith('assets')) s.setAssetCat((id.slice('assets-'.length) || 'all') as AssetCat)
  s.setDrawer(false)
  // Let the other page render before measuring where the section is.
  requestAnimationFrame(() => requestAnimationFrame(() => scrollTo(id, switched)))
}

/** Opens the Planner on the month `key` ("2027-03"). */
export function goToMonth(key: string) {
  useStore.getState().setYear(Number(key.slice(0, 4)))
  goTo(`month-${key}`)
}

/** The section currently on screen: 'plan' on the Money plan page, otherwise whichever planner section is being read. */
export function useActiveSection(): Section {
  const view = useStore((s) => s.view)
  const [current, setCurrent] = useState<Section>('overview')

  useEffect(() => {
    if (view !== 'planner') return
    const onScroll = () => {
      let c: Section = PLANNER_SECTIONS[0]
      for (const id of PLANNER_SECTIONS) {
        const el = document.getElementById(id)
        if (el && el.getBoundingClientRect().top <= OFFSET + 40) c = id
      }
      // At the very bottom, the last section is the one being read even if its top is lower.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) c = PLANNER_SECTIONS[PLANNER_SECTIONS.length - 1]
      setCurrent(c)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [view])

  return view === 'planner' ? current : view
}
