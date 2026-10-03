import { useStore } from './store'
import { Header } from './components/Header'
import { Dashboard } from './components/Dashboard'
import { YearSection } from './components/YearSection'
import { ItemModal } from './components/ItemModal'
import { MoveDialog } from './components/MoveDialog'
import { GoalModal } from './components/GoalModal'
import { ClipboardBar } from './components/ClipboardBar'
import { Toasts } from './components/Toasts'

export default function App() {
  const modal = useStore((s) => s.modal)

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[520px] overflow-hidden">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[620px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -top-32 right-0 h-[360px] w-[480px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>

      <div className="relative">
        <Header />
        <main className="mx-auto max-w-[1440px] space-y-8 px-4 pb-32 sm:px-6 lg:px-8">
          <Dashboard />
          <YearSection />
        </main>
        <footer className="pb-10 text-center text-xs text-zinc-600">
          Saved automatically in this browser · use Export to back up
        </footer>
      </div>

      <ClipboardBar />
      <Toasts />
      {modal?.type === 'item' && <ItemModal key={`${modal.key}-${modal.editId ?? 'new'}`} monthKey={modal.key} editId={modal.editId} />}
      {modal?.type === 'move' && <MoveDialog key={modal.id} monthKey={modal.key} id={modal.id} />}
      {modal?.type === 'goal' && (
        <GoalModal key={`${modal.year}-${modal.editId ?? modal.area ?? 'new'}`} year={modal.year} editId={modal.editId} area={modal.area} />
      )}
    </div>
  )
}
