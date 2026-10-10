import { useStore } from './store'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { YearSection } from './components/YearSection'
import { MoneyPlan } from './components/MoneyPlan'
import { Favorites } from './components/Favorites'
import { Assets } from './components/Assets'
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

export default function App() {
  return (
    <AuthGate>
      <Planner />
    </AuthGate>
  )
}

function Planner() {
  const modal = useStore((s) => s.modal)
  const view = useStore((s) => s.view)
  const sidebar = useStore((s) => s.sidebar)

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[620px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -top-32 right-0 h-[360px] w-[480px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <Sidebar />

      <div className={`relative transition-[padding] duration-200 ease-out ${sidebar ? 'lg:pl-64' : ''}`}>
        <Header />
        <main className="mx-auto max-w-[1440px] space-y-6 px-4 pb-16 sm:space-y-8 sm:px-6 sm:pb-32 lg:px-8">
          {view === 'plan' ? (
            <MoneyPlan />
          ) : view === 'favorites' ? (
            <Favorites />
          ) : view === 'assets' ? (
            <Assets />
          ) : (
            <>
              <Dashboard />
              <YearSection />
            </>
          )}
        </main>
        <footer className="px-4 pb-28 text-center text-xs text-zinc-600 sm:pb-10">
          Saved automatically to your Google account · use Export for an offline backup
        </footer>
      </div>

      <MobileNav />
      <ClipboardBar />
      <Toasts />
      {modal?.type === 'item' && <ItemModal key={`${modal.key}-${modal.editId ?? 'new'}`} monthKey={modal.key} editId={modal.editId} />}
      {modal?.type === 'move' && <MoveDialog key={modal.id} monthKey={modal.key} id={modal.id} />}
      {modal?.type === 'kinds' && <KindsModal onClose={useStore.getState().closeModal} />}
      {modal?.type === 'goalAreas' && <GoalAreasModal onClose={useStore.getState().closeModal} openId={modal.openId} add={modal.add} />}
      {modal?.type === 'goal' && (
        <GoalModal key={`${modal.year}-${modal.editId ?? modal.area ?? 'new'}`} year={modal.year} editId={modal.editId} area={modal.area} />
      )}
    </div>
  )
}
