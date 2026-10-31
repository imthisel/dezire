import { useEffect } from 'react'
import { ListChecks, X } from 'lucide-react'
import { useFmt, useItemIndex, useStore } from '../store'
import { selection, useSelection } from '../selection'

/** Shows how many month items are picked (see selection.ts), and lets go of them. */
export function SelectionBar() {
  const picked = useSelection()
  const index = useItemIndex()
  const clip = useStore((s) => s.clipboard)
  const f = useFmt()
  // Deleted items drop out
  const items = [...picked].flatMap((id) => index.byId.get(id) ?? [])

  useEffect(() => {
    if (!picked.size) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useStore.getState().modal && selection.clear()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked])

  if (items.length < 2) return null
  const total = items.reduce((s, p) => s + p.item.price, 0)

  return (
    <div
      className={`animate-rise fixed inset-x-3 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-indigo-400/30 bg-[#11131c]/95 py-2.5 pl-4 pr-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl ${
        // Sits above the clipboard bar when that's showing
        clip ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] sm:bottom-[5.5rem]' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-6'
      }`}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">
        <ListChecks className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium text-white">
          {items.length} items picked · {f(total)}
        </p>
        <p className="truncate text-xs text-zinc-400">Drag any of them onto another month · hold Ctrl to copy</p>
      </div>
      <button
        onClick={selection.clear}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Clear selection"
        title="Clear selection (Esc)"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
