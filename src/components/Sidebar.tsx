import { useEffect, useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarDays, Download, Flag, Gem, GripVertical, LayoutDashboard, PanelLeftClose, Plus, Receipt, Rocket, Settings2, Star, Target, X } from 'lucide-react'
import { useFmt, useKinds, useStore } from '../store'
import { SOURCE_KIND, kindColor, kindIcon } from '../lib/meta'
import { useMedia } from '../lib/useMedia'
import { goTo, useActiveSection } from '../nav'
import { todayKey } from '../lib/expenses'
import { happensOn, isDoneOn, isEvent } from '../lib/tasks'
import { useSortable } from '../sortable'
import { installApp, useApp } from '../appUpdate'
import type { IncomeSource } from '../lib/types'

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
  const assetCat = useStore((s) => s.assetCat)
  const assetFavorite = useStore((s) => s.assetFavorite)
  const kinds = useKinds()
  // "3,1,…" (one count per kind) keeps the selector's result a plain string, so it only re-renders on real changes.
  const assetCounts = useStore((s) => {
    const n: Record<string, number> = {}
    for (const m of Object.values(s.months)) for (const i of m.items) n[i.category] = (n[i.category] ?? 0) + 1
    return s.kinds.map((k) => n[k.id] ?? 0).join(',')
  })
    .split(',')
    .map(Number)
  const active = useActiveSection()
  const f = useFmt()
  // This month's spending, shown next to Expenses.
  const month = todayKey().slice(0, 7)
  const spentThisMonth = useStore((s) => s.expenses.reduce((n, e) => (e.date.startsWith(month) ? n + e.amount : n), 0))
  // Tasks still to do today, shown next to Calendar.
  const today = todayKey()
  const dueToday = useStore((s) => s.tasks.filter((t) => !isEvent(t) && happensOn(t, today) && !isDoneOn(t, today)).length)
  const shown = docked ? sidebar : drawer
  const appInstalled = useApp((s) => s.installed)
  // Money plans can be put in order by dragging them in the list below.
  const [dragSource, setDragSource] = useState<string | null>(null)

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
            <span className="font-bold tracking-tight text-white">Dizayr</span>
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

          <Group label="Time">
            <Link
              icon={CalendarCheck}
              label="Calendar"
              on={active === 'calendar'}
              onClick={() => goTo('calendar')}
              note={dueToday > 0 ? `${dueToday} today` : undefined}
              noteTitle="Tasks left to do today"
            />
            <button
              onClick={() => {
                useStore.getState().setDrawer(false)
                useStore.getState().openModal({ type: 'task', entry: 'event', date: todayKey() })
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Plan an event
            </button>
            <button
              onClick={() => {
                useStore.getState().setDrawer(false)
                useStore.getState().openModal({ type: 'task', entry: 'todo' })
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add a task
            </button>
          </Group>

          <Group label="Spending">
            <Link
              icon={Receipt}
              label="Expenses"
              on={active === 'expenses'}
              onClick={() => goTo('expenses')}
              iconCls="text-rose-300"
              note={spentThisMonth > 0 ? f(spentThisMonth, true) : undefined}
              noteTitle="Spent this month"
            />
            <button
              onClick={() => {
                useStore.getState().setDrawer(false)
                useStore.getState().openModal({ type: 'expense' })
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add an expense
            </button>
          </Group>

          <Group label="What you own">
            <Link
              icon={Gem}
              label="Assets"
              on={active === 'assets' && assetCat === 'all'}
              onClick={() => goTo('assets')}
              badge={assetCounts.reduce((a, b) => a + b, 0) || undefined}
            />
            <ul className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/[0.07] pl-2">
              {kinds.map((k, i) => {
                const Icon = kindIcon(k)
                const on = active === 'assets' && assetCat === k.id
                return (
                  <li key={k.id}>
                    <button
                      onClick={() => goTo(`assets-${k.id}`)}
                      aria-current={on ? 'page' : undefined}
                      className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] transition ${
                        on ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
                      }`}
                    >
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${on ? kindColor(k).text : ''}`} />
                      <span className="min-w-0 flex-1 truncate">{k.label}</span>
                      {k.id === assetFavorite && <Star className="h-3 w-3 shrink-0 fill-amber-300 text-amber-300" aria-label="Assets opens here" />}
                      {assetCounts[i] > 0 && <span className="shrink-0 text-[11px] tabular-nums text-zinc-500">{assetCounts[i]}</span>}
                    </button>
                  </li>
                )
              })}
              <li>
                <button
                  onClick={() => {
                    useStore.getState().setDrawer(false)
                    useStore.getState().openModal({ type: 'kinds' })
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-600 transition hover:bg-white/5 hover:text-zinc-200"
                >
                  <Settings2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="min-w-0 flex-1 truncate">Edit kinds</span>
                </button>
              </li>
            </ul>
          </Group>

          <Group label="Making the money">
            <Link icon={Rocket} label="Money plan" on={active === 'plan'} onClick={() => goTo('plan')} badge={sources.length || undefined} />
            {sources.length > 0 && (
              <ul className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/[0.07] pl-2">
                {sources.map((s, i) => (
                  <SourceLink key={s.id} source={s} index={i} dragId={dragSource} setDragId={setDragSource} />
                ))}
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

        {!appInstalled && (
          <button
            onClick={() => {
              useStore.getState().setDrawer(false)
              void installApp()
            }}
            className="mx-3 mb-2 flex items-center gap-3 rounded-xl border border-indigo-400/20 bg-indigo-500/[0.07] px-3 py-2.5 text-left text-sm text-indigo-100 transition hover:bg-indigo-500/15"
          >
            <Download className="h-4 w-4 shrink-0 text-indigo-300" />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">Download the app</span>
              <span className="block truncate text-[11px] text-indigo-200/60">Works offline · stays in sync</span>
            </span>
          </button>
        )}
        {docked && (
          <p className="border-t border-white/[0.06] px-4 py-3 text-[11px] text-zinc-600">
            Hide this anytime with <PanelLeftClose className="inline h-3 w-3" /> · bring it back from the top left
          </p>
        )}
      </aside>
    </>
  )
}

/** One money plan in the sidebar: click to jump to it; hold and drag up or down to put the plans in order. */
function SourceLink({ source: s, index, dragId, setDragId }: { source: IncomeSource; index: number; dragId: string | null; setDragId: (id: string | null) => void }) {
  const f = useFmt()
  const k = SOURCE_KIND[s.kind]
  const sort = useSortable({
    id: s.id,
    index,
    ids: () => useStore.getState().sources.map((x) => x.id),
    dragId,
    setDragId,
    onMove: useStore.getState().moveSource,
  })
  return (
    <li {...sort.zone} className="relative">
      {/* Where it lands */}
      {sort.dropAt && (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-1 z-10 h-0.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.8)] ${sort.dropAt === 'above' ? '-top-px' : '-bottom-px'}`}
        />
      )}
      <button
        {...sort.handle('li')}
        onClick={() => goTo(`source-${s.id}`)}
        title="Click to open · hold and drag to reorder"
        className={`group flex w-full cursor-grab items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-zinc-400 transition hover:bg-white/5 hover:text-white active:cursor-grabbing ${
          sort.dragging ? 'opacity-40' : ''
        }`}
      >
        <k.icon className={`h-3.5 w-3.5 shrink-0 ${k.text}`} />
        <span className="min-w-0 flex-1 truncate">{s.name.trim() || k.label}</span>
        {s.monthlyGoal > 0 && <span className="shrink-0 text-[11px] tabular-nums text-zinc-500 group-hover:hidden">{f(s.monthlyGoal, true)}</span>}
        <GripVertical className="hidden h-3.5 w-3.5 shrink-0 text-zinc-500 group-hover:block" />
      </button>
    </li>
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

function Link({ icon: Icon, label, on, onClick, badge, iconCls, note, noteTitle }: { icon: typeof Flag; label: string; on: boolean; onClick: () => void; badge?: number; iconCls?: string; note?: string; noteTitle?: string }) {
  return (
    <button
      onClick={onClick}
      aria-current={on ? 'page' : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${
        on ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
      }`}
    >
      <Icon className={`h-4 w-4 ${on ? (iconCls ?? 'text-indigo-300') : ''} ${on && iconCls && !note ? 'fill-current' : ''}`} />
      <span className="flex-1 text-left">{label}</span>
      {badge !== undefined && <span className="rounded-full bg-white/[0.08] px-1.5 text-[11px] tabular-nums text-zinc-400">{badge}</span>}
      {note && (
        <span title={noteTitle} className="text-[11px] tabular-nums text-zinc-500">
          {note}
        </span>
      )}
    </button>
  )
}
