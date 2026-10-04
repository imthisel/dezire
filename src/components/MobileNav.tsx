import { CalendarDays, Flag, LayoutDashboard, Rocket } from 'lucide-react'
import { goTo, useActiveSection, type Section } from '../nav'

const SECTIONS: { id: Section; label: string; icon: typeof Flag }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'years', label: 'Months', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Flag },
  { id: 'plan', label: 'Money plan', icon: Rocket },
]

/** Bottom tab bar on phones that jumps between the main sections of the app. */
export function MobileNav() {
  const active = useActiveSection()

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0b0c11]/90 backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-md">
        {SECTIONS.map((s) => {
          const on = active === s.id
          return (
            <button
              key={s.id}
              onClick={() => goTo(s.id)}
              aria-current={on ? 'true' : undefined}
              className={`relative flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium transition ${
                on ? 'text-white' : 'text-zinc-500 active:text-zinc-300'
              }`}
            >
              <span className={`absolute top-0 h-0.5 w-8 rounded-full bg-indigo-400 transition-opacity ${on ? 'opacity-100' : 'opacity-0'}`} />
              <s.icon className={`h-5 w-5 ${on ? 'text-indigo-300' : ''}`} strokeWidth={on ? 2.4 : 2} />
              {s.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
