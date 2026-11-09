import { useEffect } from 'react'
import { ArrowRightLeft, Copy, ListChecks, Receipt, Star, Trash2, X } from 'lucide-react'
import { useFmt, useItemIndex, useStore } from '../store'
import { selection, usePicking, useSelection } from '../selection'
import { toast } from '../toast'
import { flipSpent } from './Spent'

/** Shows how many month items are picked (see selection.ts), and lets go of them. On touch screens, what to do with them too. */
export function SelectionBar() {
  const picked = useSelection()
  const picking = usePicking()
  const index = useItemIndex()
  const clip = useStore((s) => s.clipboard)
  const view = useStore((s) => s.view)
  const modeId = useStore((s) => s.modeId)
  const f = useFmt()
  // Deleted items drop out
  const items = [...picked].flatMap((id) => index.byId.get(id) ?? [])
  // All of them already spent? Then the action takes them back out; otherwise it marks the rest.
  const allSpent = useStore((s) => {
    const ids = new Set(s.expenses.map((e) => e.id))
    return items.length > 0 && items.every((p) => !!p.item.expenseId && ids.has(p.item.expenseId))
  })
  function spend() {
    flipSpent(items.map((p) => p.item.id), !allSpent)
    selection.clear()
  }

  useEffect(() => {
    if (!picked.size && !picking) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useStore.getState().modal && selection.clear()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picked, picking])

  // The rows being picked from are gone on another page or in another mode.
  useEffect(() => () => void (selection.picking() && selection.clear()), [view, modeId])

  if (!picking && items.length < 2) return null
  const total = items.reduce((s, p) => s + p.item.price, 0)
  // Sits above the clipboard bar when that's showing
  const place = clip ? 'bottom-[calc(9rem+env(safe-area-inset-bottom))] sm:bottom-[5.5rem]' : 'bottom-[calc(4.75rem+env(safe-area-inset-bottom))] sm:bottom-6'

  if (picking) {
    const none = items.length === 0
    const allFav = !none && items.every((p) => p.item.favorite)

    function send(copy: boolean) {
      const [first] = items
      useStore.getState().openModal({ type: 'move', key: first.key, id: first.item.id, group: items.map((p) => p.item.id), copy })
    }

    function favorite() {
      const s = useStore.getState()
      for (const p of items) if (!!p.item.favorite === allFav) s.toggleFavorite(p.key, p.item.id)
      toast.info(`${allFav ? 'Removed' : '★ Added'} ${count(items.length)} ${allFav ? 'from' : 'to'} Favorites.`)
      selection.clear()
    }

    function remove() {
      const undo = useStore.getState().removeItems(items.map((p) => p.item.id))
      toast.undo(`Deleted ${count(items.length)}.`, undo)
      selection.clear()
    }

    return (
      <>
        {/* Room to scroll the last items out from under the bar */}
        <div aria-hidden className="h-28" />
        {/* Out of the way during a drag: the items under it are places to drop on */}
        <div role="toolbar" aria-label="Selected items" className={`animate-rise fixed inset-x-3 z-40 mx-auto max-w-xl rounded-2xl border border-indigo-400/30 bg-[#11131c]/95 p-2 shadow-2xl shadow-black/60 backdrop-blur-xl transition-opacity duration-150 in-data-[touch-drag]:pointer-events-none in-data-[touch-drag]:opacity-0 ${place}`}>
          <div className="flex items-center gap-2 pb-2 pl-2.5">
            <div aria-live="polite" className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{none ? 'Select items' : `${items.length} selected`}</p>
              <p className="truncate text-xs tabular-nums text-zinc-400">{none ? 'Tap the items you want' : f(total)}</p>
            </div>
            <button onClick={selection.clear} className="h-9 shrink-0 rounded-xl bg-white/[0.07] px-3.5 text-sm font-medium text-zinc-100 transition active:bg-white/15">
              Done
            </button>
          </div>
          <div className="grid grid-cols-5 gap-1 border-t border-white/[0.07] pt-1.5">
            <BarAction icon={ArrowRightLeft} label="Move" disabled={none} onClick={() => send(false)} />
            <BarAction icon={Copy} label="Copy" disabled={none} onClick={() => send(true)} />
            <BarAction icon={Star} label={allFav ? 'Unfavorite' : 'Favorite'} disabled={none} onClick={favorite} />
            <BarAction icon={Receipt} label={allSpent ? 'Not spent' : 'Spent'} disabled={none} onClick={spend} />
            <BarAction icon={Trash2} label="Delete" danger disabled={none} onClick={remove} />
          </div>
        </div>
      </>
    )
  }

  return (
    <div className={`animate-rise fixed inset-x-3 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-indigo-400/30 bg-[#11131c]/95 py-2.5 pl-4 pr-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl ${place}`}>
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
        onClick={spend}
        title={allSpent ? 'Take them out of Expenses (no longer spent)' : 'Mark them spent and add them to Expenses'}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-emerald-400/35 bg-emerald-400/10 px-3 text-xs font-semibold text-emerald-100 transition hover:bg-emerald-400/20"
      >
        <Receipt className="h-3.5 w-3.5" /> {allSpent ? 'Not spent' : 'Mark spent'}
      </button>
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

const count = (n: number) => `${n} item${n === 1 ? '' : 's'}`

function BarAction({ icon: Icon, label, danger, disabled, onClick }: { icon: typeof Star; label: string; danger?: boolean; disabled: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-medium transition active:scale-95 disabled:pointer-events-none disabled:opacity-35 ${
        danger ? 'text-red-300 active:bg-red-500/15' : 'text-zinc-200 active:bg-white/10'
      }`}
    >
      <Icon className="h-[18px] w-[18px]" />
      <span className="max-w-full truncate px-0.5">{label}</span>
    </button>
  )
}
