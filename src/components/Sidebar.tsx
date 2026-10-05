import { useEffect, type ReactNode } from 'react'
import { CalendarDays, Flag, LayoutDashboard, PanelLeftClose, Plus, Rocket, Star, Target, X } from 'lucide-react'
import { useFmt, useStore } from '../store'
import { SOURCE_KIND } from '../lib/meta'
import { useMedia } from '../lib/useMedia'
import { goTo, useActiveSection } from '../nav'

/** Wide screens keep the sidebar docked on the left; smaller ones slide it over the page. */
export const useDocked = () => useMedia('(min-width: 1024px)')

/** Opens or closes the sidebar, whichever way it is shown on this screen. */
export function toggleSidebar(docked: boolean) {
  const s = useStore.getState()
  if (docked) s.setSidebar(!s.sidebar)
  else s.setDrawer(!s.drawer)
}

export function Sidebar() {
  const docked = useDocked()
  const sidebar = useStore((s) => s.sidebar)
  const drawer = useStore((s) => s.drawer)
  const sources = useStore((s) => s.sources)
  const favorites = useStore((s) => Object.values(s.months).reduce((n, m) => n + m.items.filter((i) => i.favorite).length, 0))
  const active = useActiveSection()
  const f = useFmt()
  const shown = docked ? sidebar : drawer

  // Esc closes the slide-over; growing the window to docked size drops it.
  useEffect(() => {
    if (!drawer) return
    if (docked) return useStore.getState().setDrawer(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && useStore.getState().setDrawer(false)
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [drawer, docked])

  function addPlan() {
    goTo('plan-add')
  }

  return (
    <>
      {!docked && drawer && (
        <div className="animate-fade fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => useStore.getState().setDrawer(false)} />
      )}
      <aside
        aria-label="Sections"
        aria-hidden={!shown}
        inert={!shown}
        className={`fixed inset-y-0 left-0 z-50 flex w-[17rem] max-w-[85vw] flex-col border-r border-white/[0.07] bg-[#0a0b10]/95 backdrop-blur-xl transition-transform duration-200 ease-out lg:w-64 lg:bg-[#0a0b10]/80 ${
          shown ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] lg:pt-6">
          <div className="flex items-center gap-2.5">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400">
              <Target className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="font-bold tracking-tight text-white">Dezire</span>
          </div>
          <button
            onClick={() => toggleSidebar(docked)}
            title={docked ? 'Hide sidebar' : 'Close'}
            aria-label={docked ? 'Hide sidebar' : 'Close menu'}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            {docked ? <PanelLeftClose className="h-4 w-4" /> : <X className="h-5 w-5" />}
          </button>
        </div>

        <nav className="scrollbar-none flex-1 space-y-6 overflow-y-auto px-3 pb-6 pt-2">
          <Group label="Planner">
            <Link icon={LayoutDashboard} label="Overview" on={active === 'overview'} onClick={() => goTo('overview')} />
            <Link icon={CalendarDays} label="Months" on={active === 'years'} onClick={() => goTo('years')} />
            <Link icon={Flag} label="Yearly goals" on={active === 'goals'} onClick={() => goTo('goals')} />
            <Link
              icon={Star}
              label="Favorites"
              on={active === 'favorites'}
              onClick={() => goTo('favorites')}
              badge={favorites || undefined}
              iconCls="text-amber-300"
            />
          </Group>

          <Group label="Making the money">
            <Link icon={Rocket} label="Money plan" on={active === 'plan'} onClick={() => goTo('plan')} badge={sources.length || undefined} />
            {sources.length > 0 && (
              <ul className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/[0.07] pl-2">
                {sources.map((s) => {
                  const k = SOURCE_KIND[s.kind]
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => goTo(`source-${s.id}`)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-400 transition hover:bg-white/5 hover:text-white"
                      >
                        <k.icon className={`h-3.5 w-3.5 shrink-0 ${k.text}`} />
                        <span className="min-w-0 flex-1 truncate">{s.name.trim() || k.label}</span>
                        {s.monthlyGoal > 0 && <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{f(s.monthlyGoal, true)}</span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
            <button
              onClick={addPlan}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add a way to earn
            </button>
          </Group>
        </nav>

        {docked && (
          <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] text-zinc-600">
            Hide this anytime with <PanelLeftClose className="inline h-3 w-3" /> · bring it back from the top left
          </p>
        )}
      </aside>
    </>
  )
}

function Group({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Link({ icon: Icon, label, on, onClick, badge, iconCls }: { icon: typeof Flag; label: string; on: boolean; onClick: () => void; badge?: number; iconCls?: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
        on ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
      }`}
    >
      <Icon className={`h-4 w-4 ${on ? (iconCls ?? 'text-indigo-300') : ''} ${on && iconCls ? 'fill-current' : ''}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && <span className="rounded-full bg-white/[0.08] px-1.5 text-[11px] tabular-nums text-zinc-400">{badge}</span>}
    </button>
  )
}
