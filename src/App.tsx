import { memo, useDeferredValue, useMemo } from 'react'
import { useStore, type View } from './store'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { YearSection } from './components/YearSection'
import { MoneyPlan } from './components/MoneyPlan'
import { Favorites } from './components/Favorites'
import { Expenses } from './components/Expenses'
import { ExpenseModal } from './components/ExpenseModal'
import { Assets } from './components/Assets'
import { Schedule } from './components/Schedule'
import { TaskModal } from './components/TaskModal'
import { ItemModal } from './components/ItemModal'
import { MoveDialog } from './components/MoveDialog'
import { GoalModal } from './components/GoalModal'
import { KindsModal } from './components/KindsModal'
import { GoalAreasModal } from './components/GoalAreasModal'
import { ClipboardBar } from './components/ClipboardBar'
import { Toasts } from './components/Toasts'
import { AuthGate } from './components/AuthGate'
import { MobileNav } from './components/MobileNav'
import { Sidebar } from './components/Sidebar'
import { ZoomHud } from './components/Zoom'
import { PlansModal, TrialBanner } from './components/Plans'
import { usePinchZoom } from './zoom'
import { useDragAutoScroll } from './autoscroll'
import { useTouchDrag } from './touchdrag'

export default function App() {
  return (
    <AuthGate>
      <Planner />
    </AuthGate>
  )
}

function Planner() {
  const sidebar = useStore((s) => s.sidebar)
  usePinchZoom()
  useDragAutoScroll()
  useTouchDrag()

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[620px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -top-32 right-0 h-[360px] w-[480px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <SidebarM />

      <div className={`relative transition-[padding] duration-200 ease-out ${sidebar ? 'lg:pl-64' : ''}`}>
        <TrialBanner />
        <HeaderM />
        <Pages />
        <footer className="px-4 pb-28 text-center text-xs text-zinc-600 sm:pb-10">
          Saved automatically to your Google account · use Export for an offline backup
        </footer>
      </div>

      <MobileNavM />
      <ClipboardBar />
      <Toasts />
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
function page(view: View) {
  if (view === 'plan') return <MoneyPlan />
  if (view === 'expenses') return <Expenses />
  if (view === 'favorites') return <Favorites />
  if (view === 'assets') return <Assets />
  if (view === 'calendar') return <Schedule />
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
  const shown = useDeferredValue(view)
  const content = useMemo(() => page(shown), [shown])
  return (
    <main
      data-view={shown}
      aria-busy={view !== shown}
      className={`mx-auto max-w-[1440px] px-4 pb-16 transition-opacity duration-150 sm:px-6 sm:pb-32 lg:px-8 ${view !== shown ? 'opacity-50' : ''}`}
    >
      <div key={shown} className="animate-page space-y-6 sm:space-y-8">
        {content}
      </div>
    </main>
  )
})

/** The open dialog, if any. */
function Modals() {
  const modal = useStore((s) => s.modal)
  if (!modal) return null
  const close = useStore.getState().closeModal
  return (
    <>
      {modal.type === 'item' && <ItemModal key={`${modal.key}-${modal.editId ?? 'new'}`} monthKey={modal.key} editId={modal.editId} />}
      {modal.type === 'move' && <MoveDialog key={modal.id} monthKey={modal.key} id={modal.id} />}
      {modal.type === 'expense' && <ExpenseModal key={modal.editId ?? `new-${modal.date ?? ''}`} editId={modal.editId} date={modal.date} />}
      {modal.type === 'task' && <TaskModal key={modal.editId ?? `new-${modal.date ?? ''}-${modal.start ?? ''}`} {...modal} />}
      {modal.type === 'kinds' && <KindsModal onClose={close} />}
      {modal.type === 'goalAreas' && <GoalAreasModal onClose={close} openId={modal.openId} add={modal.add} />}
      {modal.type === 'goal' && (
        <GoalModal key={`${modal.year}-${modal.editId ?? modal.area ?? 'new'}`} year={modal.year} editId={modal.editId} area={modal.area} />
      )}
    </>
  )
}
