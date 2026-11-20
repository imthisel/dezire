import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Menu, type LucideIcon } from 'lucide-react'
import { goTo, useActiveSection } from '../nav'
import { inNeedsMode, useStore } from '../store'
import type { TabId } from '../lib/prefs'
import { CopyModeModal, ModesModal, enterKind } from './Modes'
import { EDIT_TABS_EVENT, HIDDEN_BY, TAB_LOOK, TabBarSheet } from './TabBarEditor'

/**
 * Bottom tab bar on phones: the tabs you picked (Wants, Needs, School, Expenses by default), then More for the rest.
 * Press and hold the bar (or More → Edit tab bar, or Settings → Layout) to choose them.
 */
export function MobileNav() {
  const active = useActiveSection()
  const drawer = useStore((s) => s.drawer)
  const hiddenNav = useStore((s) => s.prefs.hiddenNav)
  const tabBar = useStore((s) => s.prefs.tabBar)
  const needsMode = useStore(inNeedsMode)
  const [modal, setModal] = useState<null | 'needs' | 'copy' | 'edit'>(null)

  useEffect(() => {
    const edit = () => setModal('edit')
    window.addEventListener(EDIT_TABS_EVENT, edit)
    return () => window.removeEventListener(EDIT_TABS_EVENT, edit)
  }, [])

  // Press and hold anywhere on the bar: edit it. The tap that ends the hold doesn't also open a tab.
  const hold = useRef<{ timer: number; x: number; y: number; fired: boolean } | null>(null)
  const endHold = () => {
    if (hold.current) clearTimeout(hold.current.timer)
  }
  const holdProps = {
    onPointerDown: (e: React.PointerEvent) => {
      endHold()
      const h = { x: e.clientX, y: e.clientY, fired: false, timer: 0 }
      h.timer = window.setTimeout(() => {
        h.fired = true
        navigator.vibrate?.(12)
        useStore.getState().setDrawer(false)
        setModal('edit')
      }, 550)
      hold.current = h
    },
    onPointerMove: (e: React.PointerEvent) => {
      const h = hold.current
      if (h && Math.hypot(e.clientX - h.x, e.clientY - h.y) > 10) endHold()
    },
    onPointerUp: endHold,
    onPointerCancel: endHold,
    onPointerLeave: endHold,
    onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    onClickCapture: (e: React.MouseEvent) => {
      if (hold.current?.fired) {
        e.stopPropagation()
        e.preventDefault()
        hold.current = null
      }
    },
  }

  const tabs = tabBar.filter((id) => !(HIDDEN_BY[id] && hiddenNav.includes(HIDDEN_BY[id]!)))
  // Months and Goals are part of the overview, which is Wants or Needs depending on the mode in use.
  const home = active === 'overview' || active === 'years' || active === 'goals'
  const isOn = (id: TabId) => (id === 'wants' ? home && !needsMode : id === 'needs' ? home && needsMode : active === id)
  const inMore = !tabs.some(isOn)

  function open(id: TabId) {
    if (id === 'needs') {
      // No Needs mode yet: offer to set one up.
      if (enterKind('needs')) goTo('overview')
      else setModal('needs')
    } else if (id === 'wants') enterKind('wants') && goTo('overview')
    // These pages belong to Wants, as in the side menu.
    else if (id === 'life' || id === 'assets' || id === 'favorites' || id === 'plan') enterKind('wants') && goTo(id)
    else goTo(id)
  }

  return (
    <>
      <nav
        data-tabbar
        {...holdProps}
        aria-description="Press and hold to edit the tabs"
        className="pb-safe fixed inset-x-0 bottom-0 z-40 touch-manipulation select-none border-t border-white/[0.08] bg-[#0b0c11]/90 backdrop-blur-xl [-webkit-touch-callout:none] sm:hidden"
      >
        <div className="mx-auto flex max-w-md">
          {tabs.map((id) => (
            <Tab key={id} on={!drawer && isOn(id)} label={TAB_LOOK[id].label} icon={TAB_LOOK[id].icon} onClick={() => open(id)} />
          ))}
          <Tab on={drawer || inMore} label="More" icon={Menu} onClick={() => useStore.getState().setDrawer(!drawer)} />
        </div>
      </nav>
      {modal === 'needs' && <ModesModal startAdding="needs" onCopy={() => setModal('copy')} onClose={() => setModal(null)} />}
      {modal === 'copy' && <CopyModeModal onClose={() => setModal(null)} />}
      {modal === 'edit' && <TabBarSheet onClose={() => setModal(null)} />}
    </>
  )
}

function Tab({ on, label, icon: Icon, onClick }: { on: boolean; label: string; icon: LucideIcon; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'true' : undefined}
      className={`relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition ${
        on ? 'text-white' : 'text-zinc-500 active:text-zinc-300'
      }`}
    >
      <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-indigo-400 transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
      <Icon className={`h-5 w-5 ${on ? 'text-indigo-300' : ''}`} strokeWidth={on ? 2.4 : 2} />
      <span className="max-w-full truncate px-px text-[11px]">{label}</span>
    </button>
  )
}
