import { memo, useDeferredValue, useEffect, useMemo } from 'react'
import { inNeedsMode, useStore, type View } from './store'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { YearSection } from './components/YearSection'
import { MoneyPlan } from './components/MoneyPlan'
import { Favorites } from './components/Favorites'
import { Expenses } from './components/Expenses'
import { NeedsPage } from './components/NeedsPage'
import { NeedItemModal } from './components/NeedItemModal'
import { ExpenseModal } from './components/ExpenseModal'
import { Assets } from './components/Assets'
import { Schedule } from './components/Schedule'
import { School } from './components/School'
import { TaskModal } from './components/TaskModal'
import { SchoolTaskModal } from './components/SchoolTaskModal'
import { ItemModal } from './components/ItemModal'
import { MoveDialog } from './components/MoveDialog'
import { GoalModal } from './components/GoalModal'
import { KindsModal } from './components/KindsModal'
import { GoalAreasModal } from './components/GoalAreasModal'
import { ClipboardBar } from './components/ClipboardBar'
import { SelectionBar } from './components/SelectionBar'
import { Toasts } from './components/Toasts'
import { AuthGate } from './components/AuthGate'
import { MobileNav } from './components/MobileNav'
import { Sidebar } from './components/Sidebar'
import { ZoomHud } from './components/Zoom'
import { PlansModal, TrialBanner } from './components/Plans'
import { InstallGuide, UpdateBanner } from './components/AppInstall'
import { useModeGuard } from './components/Modes'
import { usePinchZoom } from './zoom'
import { useDragAutoScroll } from './autoscroll'
import { useTouchDrag } from './touchdrag'
import { useBackgroundJobs } from './reminders'
import { startSettingsNav } from './settingsNav'
import { Settings } from './components/settings/Settings'

export default function App() {
  return (
    <>
      <AuthGate>
        <Planner />
        <BackgroundJobs />
      </AuthGate>
      {/* Everywhere, signed in or not (the About page too) */}
      <Toasts />
      <UpdateBanner />
      <InstallGuide />
    </>
  )
}

/** The planner itself (also shown read-only on the admin page, with someone else's data). */
export function Planner() {
  const sidebar = useStore((s) => s.sidebar)
  const hideBackup = useStore((s) => s.prefs.hideBackup)
  const needs = useStore(inNeedsMode)
  useModeGuard()
  usePinchZoom()
  useDragAutoScroll()
  useTouchDrag()
  useEffect(startSettingsNav, [])

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        {/* A Needs mode is green from the top of the page, so it's clear at a glance which kind of mode this is. */}
        <div className={`absolute -top-40 left-1/4 h-[420px] w-[620px] rounded-full blur-[120px] ${needs ? 'bg-emerald-500/25' : 'bg-indigo-600/20'}`} />
        <div className={`absolute -top-32 right-0 h-[360px] w-[480px] rounded-full blur-[120px] ${needs ? 'bg-teal-400/15' : 'bg-emerald-500/10'}`} />
      </div>

      <SidebarM />

      <div className={`relative transition-[padding] duration-200 ease-out ${sidebar ? 'lg:pl-64' : ''}`}>
        <TrialBanner />
        <HeaderM />
        <Pages />
        <footer className="px-4 pb-28 text-center text-xs text-zinc-600 sm:pb-10">
          Saved automatically to your Google account{!hideBackup && ' · use Export for an offline backup'}
        </footer>
      </div>

      <MobileNavM />
      <ClipboardBar />
      <SelectionBar />
      <ZoomHud />
      <Modals />
      <PlansModal />
    </div>
  )
}

// Each of these only redraws for its own changes, not whenever something else on the screen does (e.g. a dialog opening).
const SidebarM = memo(Sidebar)
const HeaderM = memo(Header)
const MobileNavM = memo(MobileNav)

/** The page for a view (built once per view, so redrawing around it doesn't redo it). */
function page(view: View, needs: boolean) {
  if (view === 'plan') return <MoneyPlan />
  if (view === 'expenses') return <Expenses />
  if (view === 'favorites') return <Favorites />
  if (view === 'assets') return <Assets />
  if (view === 'calendar') return <Schedule />
  if (view === 'school') return <School />
  if (view === 'settings') return <Settings />
  if (needs) return <NeedsPage />
  return (
    <>
      <Dashboard />
      <YearSection />
    </>
  )
}

/**
 * The page being looked at. A new one is built in the background, so the button that asked for it answers right away
 * (the old page dims meanwhile), then it fades in.
 */
const Pages = memo(function Pages() {
  const view = useStore((s) => s.view)
  const needs = useStore(inNeedsMode)
  const shown = useDeferredValue(view)
  const content = useMemo(() => page(shown, needs), [shown, needs])
  return (
    <main
      data-view={shown}
      aria-busy={view !== shown}
      className={`mx-auto max-w-[1440px] px-4 pb-16 transition-opacity duration-150 sm:px-6 sm:pb-32 lg:px-8 ${view !== shown ? 'opacity-50' : ''}`}
    >
      <div key={`${shown}-${needs}`} className="animate-page space-y-6 sm:space-y-8">
        {content}
      </div>
    </main>
  )
})

function BackgroundJobs() {
  useBackgroundJobs()
  return null
}

/** The open dialog, if any. */
function Modals() {
  const modal = useStore((s) => s.modal)
  if (!modal) return null
  const close = useStore.getState().closeModal
  return (
    <>
      {modal.type === 'item' && <ItemModal key={`${modal.key}-${modal.editId ?? 'new'}`} monthKey={modal.key} editId={modal.editId} />}
      {modal.type === 'move' && <MoveDialog key={modal.id} monthKey={modal.key} id={modal.id} group={modal.group} startCopy={modal.copy} />}
      {modal.type === 'expense' && <ExpenseModal key={modal.editId ?? `new-${modal.date ?? ''}`} editId={modal.editId} date={modal.date} />}
      {modal.type === 'need' && <NeedItemModal key={modal.editId ?? `new-${modal.date ?? ''}`} editId={modal.editId} date={modal.date} />}
      {modal.type === 'task' && <TaskModal key={modal.editId ?? `new-${modal.date ?? ''}-${modal.start ?? ''}`} {...modal} />}
      {modal.type === 'school' && <SchoolTaskModal key={modal.editId ?? `new-${modal.column ?? ''}-${modal.due ?? ''}`} {...modal} />}
      {modal.type === 'kinds' && <KindsModal onClose={close} />}
      {modal.type === 'goalAreas' && <GoalAreasModal onClose={close} openId={modal.openId} add={modal.add} />}
      {modal.type === 'goal' && (
        <GoalModal key={`${modal.year}-${modal.editId ?? modal.area ?? 'new'}`} year={modal.year} editId={modal.editId} area={modal.area} />
      )}
    </>
  )
}
