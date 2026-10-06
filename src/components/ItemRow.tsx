import { useState, type DragEvent, type MouseEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowRightLeft, ArrowUp, Copy, CopyPlus, GripVertical, Pencil, Scissors, Star, Trash2 } from 'lucide-react'
import type { Item } from '../lib/types'
import { CATEGORY, TREND } from '../lib/meta'
import { useFmt, useStore, useUsd } from '../store'
import { drag } from '../dnd'
import { toast } from '../toast'

interface Props {
  item: Item
  monthKey: string
  over?: boolean
  /** Neighbours in the month's list, for Move up / Move down */
  prevId?: string
  nextId?: string
}

export function ItemRow({ item, monthKey, over = false, prevId, nextId }: Props) {
  const f = useFmt()
  const u = useUsd()
  const [open, setOpen] = useState(false)
  /** Where a dragged item would land relative to this one */
  const [dropAt, setDropAt] = useState<null | 'above' | 'below'>(null)
  const clipboard = useStore((s) => s.clipboard)
  const t = TREND[item.trend]
  const cat = CATEGORY[item.category]
  const isCut = clipboard?.mode === 'cut' && clipboard.item.id === item.id

  const act = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const s = useStore.getState
  const fav = !!item.favorite

  function toggleFav() {
    const now = s().toggleFavorite(monthKey, item.id)
    toast.info(now ? `★ Added “${item.name}” to Favorites.` : `Removed “${item.name}” from Favorites.`)
  }

  const actions = [
    ...(prevId
      ? [{ icon: ArrowUp, label: 'Move up', run: () => s().transferItem(monthKey, item.id, monthKey, 'move', { id: prevId, after: false }) }]
      : []),
    ...(nextId
      ? [{ icon: ArrowDown, label: 'Move down', run: () => s().transferItem(monthKey, item.id, monthKey, 'move', { id: nextId, after: true }) }]
      : []),
    {
      icon: Copy, label: 'Copy (then Paste on any month)',
      run: () => { s().copyToClipboard(monthKey, item.id, 'copy'); toast.info(`Copied “${item.name}”. Click Paste on any month.`) },
    },
    {
      icon: Scissors, label: 'Cut (then Paste on any month)',
      run: () => { s().copyToClipboard(monthKey, item.id, 'cut'); toast.info(`Cut “${item.name}”. Click Paste on the month to move it to.`) },
    },
    { icon: ArrowRightLeft, label: 'Move / copy to…', run: () => s().openModal({ type: 'move', key: monthKey, id: item.id }) },
    {
      icon: CopyPlus, label: 'Duplicate in this month',
      run: () => toast.result(s().transferItem(monthKey, item.id, monthKey, 'copy'), 'Duplicated.'),
    },
    { icon: Pencil, label: 'Edit', run: () => s().openModal({ type: 'item', key: monthKey, editId: item.id }) },
    {
      icon: Trash2, label: 'Delete', danger: true,
      run: () => { s().removeItem(monthKey, item.id); toast.info(`Deleted “${item.name}”.`) },
    },
  ]

  const half = (e: DragEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below'
  }

  function onDragOver(e: DragEvent<HTMLLIElement>) {
    const d = drag.current
    if (!d) return
    setDropAt(d.id === item.id ? null : half(e))
  }

  function onDrop(e: DragEvent<HTMLLIElement>) {
    setDropAt(null)
    const d = drag.current
    if (!d || d.id === item.id) return
    // Handled here; clearing `drag` makes the month card's own drop handler skip it
    drag.current = null
    e.preventDefault()
    const mode = e.ctrlKey || e.altKey || e.metaKey ? 'copy' : 'move'
    const r = s().transferItem(d.fromKey, d.id, monthKey, mode, { id: item.id, after: half(e) === 'below' })
    if (d.fromKey !== monthKey || mode === 'copy') toast.result(r, mode === 'copy' ? 'Copied.' : 'Moved.')
  }

  return (
    <li
      draggable
      onDragStart={(e) => {
        drag.current = { fromKey: monthKey, id: item.id }
        e.dataTransfer.effectAllowed = 'copyMove'
        e.dataTransfer.setData('text/plain', item.name)
      }}
      onDragEnd={() => (drag.current = null)}
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
      onDrop={onDrop}
      onClick={() => setOpen((o) => !o)}
      title={over ? 'Not enough money left (or over the budget) this month — move it to another month' : undefined}
      className={`group relative flex cursor-grab flex-wrap items-center gap-2.5 rounded-xl border py-2 pl-2.5 pr-2 transition sm:flex-nowrap sm:pl-1.5 active:cursor-grabbing ${
        over ? 'border-red-500/60 bg-red-500/15 ring-1 ring-red-500/40' : `${t.border} ${t.bg}`
      } ${
        // Favorites get a gold glow and edge on top of the trend colour, so the trend still shows.
        fav ? `bg-gradient-to-r from-amber-300/[0.16] via-amber-300/[0.04] to-transparent ${over ? '' : 'ring-1 ring-amber-300/45'}` : ''
      } ${
        isCut ? 'border-dashed opacity-45' : 'hover:brightness-125'
      }`}
    >
      {dropAt && (
        <span
          className={`pointer-events-none absolute inset-x-1 h-0.5 rounded-full bg-indigo-400 ${dropAt === 'above' ? '-top-1' : '-bottom-1'}`}
        />
      )}
      {fav && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[11px] bg-gradient-to-b from-amber-200 to-amber-400" />}
      <GripVertical className="hidden h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-zinc-400 sm:block" />
      <span className={`relative grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.iconBg} ${t.text}`}>
        <cat.icon className="h-4 w-4" />
        {fav && (
          <span className="absolute -right-1.5 -top-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#14120a] ring-1 ring-amber-300/60">
            <Star className="h-2.5 w-2.5 fill-amber-300 text-amber-300" />
          </span>
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`flex items-center gap-1 truncate text-sm font-medium ${over ? 'text-red-200' : 'text-zinc-100'}`}>
          {over && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-400" />}
          {item.name}
        </p>
        <p className={`flex items-center gap-1 truncate text-[11px] ${t.text}`}>
          <t.icon className="h-3 w-3 shrink-0" />
          {t.label}
          {item.trend !== 'stable' && item.rate > 0 && <span className="opacity-80">· {item.rate}%/yr</span>}
          <span className="hidden text-zinc-500 sm:inline">· {cat.short}</span>
        </p>
      </div>

      <button
        onClick={act(toggleFav)}
        onDragStart={(e) => e.preventDefault()}
        title={fav ? 'Remove from Favorites' : 'Add to Favorites'}
        aria-label={fav ? 'Remove from Favorites' : 'Add to Favorites'}
        aria-pressed={fav}
        className={`-mx-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg transition active:scale-90 ${
          fav ? 'text-amber-300 hover:bg-amber-300/10' : 'text-zinc-600 hover:bg-white/10 hover:text-amber-300'
        }`}
      >
        <Star className={`h-4 w-4 ${fav ? 'fill-amber-300' : ''}`} strokeWidth={fav ? 2 : 1.75} />
      </button>
      <div className={`shrink-0 text-right ${open ? 'max-sm:block sm:hidden' : 'sm:group-hover:hidden'}`}>
        <p className={`text-sm font-semibold tabular-nums ${over ? 'text-red-300' : 'text-zinc-100'}`}>{f(item.price)}</p>
        <p className="text-[10px] tabular-nums text-zinc-500">≈ {u(item.price)}</p>
      </div>
      <div
        className={`shrink-0 items-center gap-0.5 max-sm:w-full max-sm:justify-between max-sm:border-t max-sm:border-white/[0.06] max-sm:pt-1.5 ${
          open ? 'animate-fade flex' : 'hidden sm:group-hover:flex'
        }`}
      >
        {actions.map((a) => (
          <button
            key={a.label}
            title={a.label}
            aria-label={a.label}
            onClick={act(a.run)}
            className={`grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 sm:h-7 sm:w-7 sm:rounded-md ${
              a.danger ? 'hover:text-red-300' : 'hover:text-white'
            }`}
          >
            <a.icon className="h-3.5 w-3.5" />
          </button>
        ))}
      </div>
    </li>
  )
}
