import { CalendarCheck, Flag, Gem, LayoutDashboard, Menu, Receipt } from 'lucide-react'
import { goTo, useActiveSection, type Section } from '../nav'
import { useStore } from '../store'

/** The everyday places; everything else is one tap away under More (the side menu). */
const SECTIONS: { id: Section; label: string; icon: typeof Flag }[] = [
  { id: 'overview', label: 'Home', icon: LayoutDashboard },
  { id: 'calendar', label: 'Calendar', icon: CalendarCheck },
  { id: 'expenses', label: 'Expenses', icon: Receipt },
  { id: 'assets', label: 'Assets', icon: Gem },
]

/** Bottom tab bar on phones: the main sections, plus More for the rest (Months, Goals, Favorites, Money plan…). */
export function MobileNav() {
  const active = useActiveSection()
  const drawer = useStore((s) => s.drawer)
  // Months and Goals are part of Home; Favorites and Money plan live under More.
  const current = active === 'years' || active === 'goals' ? 'overview' : active
  const inMore = !SECTIONS.some((s) => s.id === current)

  return (
    <nav data-tabbar className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0b0c11]/90 backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-md">
        {SECTIONS.map((s) => (
          <Tab key={s.id} on={!drawer && current === s.id} label={s.label} icon={s.icon} onClick={() => goTo(s.id)} />
        ))}
        <Tab on={drawer || inMore} label="More" icon={Menu} onClick={() => useStore.getState().setDrawer(!drawer)} />
      </div>
    </nav>
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
