import { useEffect, useState } from 'react'
import { CalendarDays, Flag, LayoutDashboard } from 'lucide-react'

const SECTIONS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'years', label: 'Months', icon: CalendarDays },
  { id: 'goals', label: 'Goals', icon: Flag },
] as const

/** Room for the sticky year tabs, so a section isn't hidden underneath them. */
const OFFSET = 72

/** Bottom tab bar on phones that jumps between the main sections of the page. */
export function MobileNav() {
  const [active, setActive] = useState<string>('overview')

  useEffect(() => {
    const onScroll = () => {
      let current: string = SECTIONS[0].id
      for (const s of SECTIONS) {
        const el = document.getElementById(s.id)
        if (el && el.getBoundingClientRect().top <= OFFSET + 40) current = s.id
      }
      // At the very bottom, the last section is the one being read even if its top is lower.
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) current = SECTIONS[SECTIONS.length - 1].id
      setActive(current)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function go(id: string) {
    const el = document.getElementById(id)
    if (!el) return
    const top = id === 'overview' ? 0 : el.getBoundingClientRect().top + window.scrollY - (id === 'years' ? 0 : OFFSET)
    window.scrollTo({ top, behavior: 'smooth' })
  }

  return (
    <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 border-t border-white/[0.08] bg-[#0b0c11]/90 backdrop-blur-xl sm:hidden">
      <div className="mx-auto flex max-w-md">
        {SECTIONS.map((s) => {
          const on = active === s.id
          return (
            <button
              key={s.id}
              onClick={() => go(s.id)}
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
