import { useEffect, useId, useState, type ReactNode } from 'react'
import { CalendarCheck, CalendarDays, ChevronDown, Download, Flag, Gem, GraduationCap, GripVertical, Wallet, LayoutDashboard, PanelLeftClose, Plus, Receipt, Rocket, Settings, Settings2, ShoppingBasket, Sparkles, Star, Target, X } from 'lucide-react'
import { modeKind } from '../lib/needs'
import { CopyModeModal, ModesModal } from './Modes'
import type { ModeInfo, ModeKind } from '../lib/types'
import { inNeedsMode, useFmt, useKinds, useStore } from '../store'
import { SOURCE_KIND, kindColor, kindIcon } from '../lib/meta'
import { useMedia } from '../lib/useMedia'
import { goHome, goTo, useActiveSection } from '../nav'
import { openSettings } from '../settingsNav'
import { todayKey } from '../lib/expenses'
import { happensOn, isDoneOn, isEvent } from '../lib/tasks'
import { daysBetween } from '../lib/school'
import { walletState } from '../lib/wallet'
import { useSortable } from '../sortable'
import { installApp, useApp } from '../appUpdate'
import { PremiumCard } from './Plans'
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
  // School: tasks that are late, else due in the next three days (a "late,soon" string, so it only redraws on a real change).
  const [schoolLate, schoolSoon] = useStore((s) => {
    const open = new Set(s.school.columns.filter((c) => c.role === 'open').map((c) => c.id))
    let late = 0
    let soon = 0
    for (const t of s.school.tasks) {
      if (!open.has(t.column)) continue
      const d = daysBetween(today, t.due)
      if (d < 0) late++
      else if (d <= 3) soon++
    }
    return `${late},${soon}`
  })
    .split(',')
    .map(Number)
  // Money on hand, live (null until it's set up).
  const onHand = useStore((s) => walletState(s.wallet, s.expenses, today)?.balance ?? null)
  const shown = docked ? sidebar : drawer
  const appInstalled = useApp((s) => s.installed)
  const hiddenNav = useStore((s) => s.prefs.hiddenNav)
  const needsMode = useStore(inNeedsMode)
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

  // Which mode each section opens: the one in use, else the last one used of that kind, else its main one.
  const modes = useStore((s) => s.modes)
  const modeId = useStore((s) => s.modeId)
  const inUse = modes.find((m) => m.id === modeId)
  if (inUse) lastMode[modeKind(inUse)] = inUse.id
  const wantsName = modeFor('wants', modes)?.name
  const needsName = modeFor('needs', modes)?.name
  const inWants = !needsMode
  const [modal, setModal] = useState<null | 'needs' | 'copy'>(null)

  /** A Wants page: from a Needs mode, step back into Wants first. */
  const wants = (id: string) => enterKind('wants') && goTo(id)

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
          <a
            href="/"
            onClick={goHome}
            title="Go to Overview"
            className="flex items-center gap-2.5 rounded-xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400">
              <Target className="h-4 w-4 text-white" strokeWidth={2.5} />
            </span>
            <span className="font-bold tracking-tight text-white">Dizayr</span>
          </a>
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
          <KindSection kind="wants" on={!needsMode} mode={wantsName}>
            <Link icon={LayoutDashboard} label="Overview" on={inWants && active === 'overview'} onClick={() => wants('overview')} />
            <Link icon={CalendarDays} label="Months" on={inWants && active === 'years'} onClick={() => wants('years')} />
            <Link icon={Flag} label="Yearly goals" on={inWants && active === 'goals'} onClick={() => wants('goals')} />
            {!hiddenNav.includes('favorites') && <Link
              icon={Star}
              label="Favorites"
              on={inWants && active === 'favorites'}
              onClick={() => wants('favorites')}
              badge={favorites || undefined}
              iconCls="text-amber-300"
            />}

            {!hiddenNav.includes('assets') && <SubGroup label="What you own">
            <Link
              icon={Gem}
              label="Assets"
              on={inWants && active === 'assets' && assetCat === 'all'}
              onClick={() => wants('assets')}
              badge={assetCounts.reduce((a, b) => a + b, 0) || undefined}
            />
            <ul className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/[0.07] pl-2">
              {kinds.map((k, i) => {
                const Icon = kindIcon(k)
                const on = inWants && active === 'assets' && assetCat === k.id
                return (
                  <li key={k.id}>
                    <button
                      onClick={() => wants(`assets-${k.id}`)}
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
            </SubGroup>}
          </KindSection>

          <KindSection kind="needs" on={needsMode} mode={needsName}>
            {needsName ? (
              <Link
                icon={ShoppingBasket}
                label="Everyday budget"
                on={needsMode && (active === 'overview' || active === 'years' || active === 'goals')}
                onClick={() => enterKind('needs') && goTo('overview')}
                iconCls="text-emerald-300"
              />
            ) : (
              <button
                onClick={() => {
                  useStore.getState().setDrawer(false)
                  setModal('needs')
                }}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-zinc-400 transition hover:bg-white/5 hover:text-zinc-200"
              >
                <Plus className="h-4 w-4 text-emerald-300" />
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">Set up a budget</span>
                  <span className="block text-[11px] text-zinc-500">Everyday money, week by week</span>
                </span>
              </button>
            )}
          </KindSection>

          {/* Its own section: making the money serves the whole plan, not one Wants page. (It opens in Wants, where the page lives.) */}
          {!hiddenNav.includes('plan') && <KindSection
            kind="plan"
            on={inWants && active === 'plan'}
            mode={sources.length ? `${sources.length} ${sources.length === 1 ? 'way' : 'ways'} to earn` : 'Making the money'}
            defaultOpen
          >
            <Link icon={Rocket} label="Money plan" on={inWants && active === 'plan'} onClick={() => wants('plan')} badge={sources.length || undefined} />
            {sources.length > 0 && (
              <ul className="ml-[1.4rem] mt-1 space-y-0.5 border-l border-white/[0.07] pl-2">
                {sources.map((s, i) => (
                  <SourceLink key={s.id} source={s} index={i} dragId={dragSource} setDragId={setDragSource} />
                ))}
              </ul>
            )}
            <button
              onClick={() => wants('plan-add')}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add a way to earn
            </button>
          </KindSection>}

          {!hiddenNav.includes('calendar') && <Group label="Time">
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
          </Group>}

          {!hiddenNav.includes('school') && <Group label="School">
            <Link
              icon={GraduationCap}
              label="School"
              on={active === 'school'}
              onClick={() => goTo('school')}
              note={schoolLate > 0 ? `${schoolLate} late` : schoolSoon > 0 ? `${schoolSoon} due soon` : undefined}
              noteTitle={schoolLate > 0 ? 'School tasks past their due date' : 'School tasks due in the next 3 days'}
            />
            <button
              onClick={() => {
                useStore.getState().setDrawer(false)
                useStore.getState().openModal({ type: 'school' })
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add a school task
            </button>
          </Group>}

          {!hiddenNav.includes('expenses') && <Group label="Spending">
            <Link
              icon={Receipt}
              label="Expenses"
              on={active === 'expenses'}
              onClick={() => goTo('expenses')}
              iconCls="text-rose-300"
              note={spentThisMonth > 0 ? f(spentThisMonth, true) : undefined}
              noteTitle="Spent this month"
            />
            {onHand !== null && (
              <Link
                icon={Wallet}
                label="Money on hand"
                on={false}
                onClick={() => goTo('expenses')}
                note={f(onHand, true)}
                noteTitle="What you have right now, after your expenses"
              />
            )}
            <button
              onClick={() => {
                useStore.getState().setDrawer(false)
                useStore.getState().openModal({ type: 'expense' })
              }}
              className="mt-1 flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <Plus className="h-4 w-4" /> Add an expense
            </button>
          </Group>}

          <Group label="You">
            <Link icon={Settings} label="Settings" on={active === 'settings'} onClick={() => openSettings()} />
          </Group>
        </nav>

        <PremiumCard onOpen={() => useStore.getState().setDrawer(false)} />
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

      {modal === 'needs' && <ModesModal startAdding="needs" onCopy={() => setModal('copy')} onClose={() => setModal(null)} />}
      {modal === 'copy' && <CopyModeModal onClose={() => setModal(null)} />}
    </>
  )
}

/** The last mode used of each kind, so going back to Wants or Needs lands where you were. */
const lastMode: Partial<Record<ModeKind, string>> = {}

function modeFor(kind: ModeKind, modes: ModeInfo[]) {
  return modes.find((m) => m.id === lastMode[kind] && modeKind(m) === kind) ?? modes.find((m) => modeKind(m) === kind)
}

/** Switches to a mode of this kind if one isn't in use. False when there is none of that kind yet. */
function enterKind(kind: ModeKind) {
  const s = useStore.getState()
  if (modeKind(s.modes.find((m) => m.id === s.modeId)) === kind) return true
  const to = modeFor(kind, s.modes)
  if (!to) return false
  s.switchMode(to.id)
  return true
}

/** The sidebar's fold-open blocks: Wants and Needs, plus the Money plan, which serves both. */
type FoldKind = ModeKind | 'plan'

const KIND_LOOK: Record<FoldKind, { title: string; icon: typeof Flag; chip: string; box: string; dot: string }> = {
  wants: { title: 'Wants', icon: Sparkles, chip: 'bg-gradient-to-br from-indigo-400 to-indigo-600', box: 'border-indigo-400/20 bg-indigo-500/[0.04]', dot: 'bg-indigo-400' },
  needs: { title: 'Needs', icon: ShoppingBasket, chip: 'bg-gradient-to-br from-emerald-400 to-teal-500', box: 'border-emerald-400/20 bg-emerald-500/[0.04]', dot: 'bg-emerald-400' },
  plan: { title: 'Money plan', icon: Rocket, chip: 'bg-gradient-to-br from-amber-400 to-orange-500', box: 'border-amber-400/20 bg-amber-500/[0.04]', dot: 'bg-amber-400' },
}

/** Which blocks are folded open, remembered on this device. Unset: only the one in use is open (or its default). */
const OPEN_KEY = 'dz-sidebar-open'
function readOpen(): Partial<Record<FoldKind, boolean>> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) ?? '{}') ?? {}
  } catch {
    return {}
  }
}
function saveOpen(kind: FoldKind, open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [kind]: open }))
  } catch {
    // Private mode or storage full: it just won't be remembered.
  }
}

/**
 * Wants, Needs or the Money plan: a block that folds open and shut from its header, so the sidebar stays tidy.
 * Tinted when it's the one in use, with a short line under the title. Moving into a block opens it.
 */
function KindSection({ kind, on, mode, defaultOpen = false, children }: { kind: FoldKind; on: boolean; mode?: string; defaultOpen?: boolean; children: ReactNode }) {
  const k = KIND_LOOK[kind]
  const [open, setOpen] = useState(() => readOpen()[kind] ?? (on || defaultOpen))
  const body = useId()

  // Moving into this kind (from the header's mode menu, or a link here) opens it, so where you are is always showing.
  useEffect(() => {
    if (on) setOpen(true)
  }, [on])

  function toggle() {
    setOpen((o) => {
      saveOpen(kind, !o)
      return !o
    })
  }

  return (
    <section aria-label={k.title} className={`rounded-2xl border transition-colors duration-200 ${on ? k.box : 'border-white/[0.06] hover:border-white/[0.1]'}`}>
      <h3>
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={body}
          title={open ? `Fold ${k.title} away` : `Show ${k.title}`}
          className="group/head flex w-full items-center gap-2.5 rounded-[15px] px-3 py-2.5 text-left outline-none transition hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-indigo-400/60"
        >
          <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-white shadow-sm transition ${k.chip} ${on ? '' : 'opacity-60 group-hover/head:opacity-90'}`}>
            <k.icon className="h-3.5 w-3.5" strokeWidth={2.4} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={`text-[13px] font-semibold ${on ? 'text-white' : 'text-zinc-300 group-hover/head:text-white'}`}>{k.title}</span>
              {on && <span aria-label="In use" title="In use" className={`h-1.5 w-1.5 rounded-full ${k.dot}`} />}
            </span>
            {mode && (
              <span title={kind === 'plan' ? mode : on ? `In use: ${mode}` : `Opens ${mode}`} className="block truncate text-[11px] leading-tight text-zinc-500">
                {mode}
              </span>
            )}
          </span>
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-300 ease-out group-hover/head:text-zinc-300 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
          />
        </button>
      </h3>
      {/* Folds by animating its height (grid rows 0fr ↔ 1fr), and can't be tabbed into while shut. */}
      <div
        id={body}
        inert={!open}
        className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out motion-reduce:transition-none ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-0.5 px-1.5 pb-1.5">{children}</div>
        </div>
      </div>
    </section>
  )
}

function SubGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pt-3">
      <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-600">{label}</p>
      <div className="space-y-0.5">{children}</div>
    </div>
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
        onClick={() => enterKind('wants') && goTo(`source-${s.id}`)}
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
