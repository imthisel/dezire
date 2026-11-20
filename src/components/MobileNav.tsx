import { useState } from 'react'
import { Award, CalendarCheck, Flag, Gem, Mountain, GraduationCap, Menu, Receipt, Rocket, ShoppingBasket, Sparkles, Star } from 'lucide-react'
import { goTo, useActiveSection } from '../nav'
import { inNeedsMode, useStore } from '../store'
import type { NavId, TabId } from '../lib/prefs'
import { CopyModeModal, ModesModal, enterKind } from './Modes'

/** How each tab looks, and the page it's "on" for. */
export const TAB_LOOK: Record<TabId, { label: string; icon: typeof Flag; hint: string }> = {
  wants: { label: 'Wants', icon: Sparkles, hint: 'Your Wants overview' },
  needs: { label: 'Needs', icon: ShoppingBasket, hint: 'Your everyday budget' },
  life: { label: 'Life', icon: Mountain, hint: 'Your life goals' },
  school: { label: 'School', icon: GraduationCap, hint: 'Subjects and deadlines' },
  grades: { label: 'Grades', icon: Award, hint: 'Your grade tracker' },
  expenses: { label: 'Expenses', icon: Receipt, hint: 'Money spent, day by day' },
  calendar: { label: 'Calendar', icon: CalendarCheck, hint: 'Events and tasks' },
  assets: { label: 'Assets', icon: Gem, hint: 'What you own' },
  favorites: { label: 'Favorites', icon: Star, hint: 'The items you starred' },
  plan: { label: 'Income', icon: Rocket, hint: 'Your income plan' },
}

/** The setting that takes a tab's page out of the menus (a hidden page doesn't get a tab either). */
const HIDDEN_BY: Partial<Record<TabId, NavId>> = { life: 'life', school: 'school', grades: 'school', expenses: 'expenses', calendar: 'calendar', assets: 'assets', favorites: 'favorites', plan: 'plan' }

/** Bottom tab bar on phones: the tabs chosen in Settings → Layout (Wants, Needs, School, Expenses by default), then More for the rest. */
export function MobileNav() {
  const active = useActiveSection()
  const drawer = useStore((s) => s.drawer)
  const hiddenNav = useStore((s) => s.prefs.hiddenNav)
  const tabBar = useStore((s) => s.prefs.tabBar)
  const needsMode = useStore(inNeedsMode)
  const [modal, setModal] = useState<null | 'needs' | 'copy'>(null)

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
      <nav data-tabbar className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0b0c11]/90 backdrop-blur-xl sm:hidden">
        <div className="mx-auto flex max-w-md">
          {tabs.map((id) => (
            <Tab key={id} on={!drawer && isOn(id)} label={TAB_LOOK[id].label} icon={TAB_LOOK[id].icon} onClick={() => open(id)} />
          ))}
          <Tab on={drawer || inMore} label="More" icon={Menu} onClick={() => useStore.getState().setDrawer(!drawer)} />
        </div>
      </nav>
      {modal === 'needs' && <ModesModal startAdding="needs" onCopy={() => setModal('copy')} onClose={() => setModal(null)} />}
      {modal === 'copy' && <CopyModeModal onClose={() => setModal(null)} />}
    </>
  )
}

function Tab({ on, label, icon: Icon, onClick }: { on: boolean; label: string; icon: typeof Flag; onClick: () => void }) {
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
