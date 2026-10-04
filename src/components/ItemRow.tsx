import { useState, type MouseEvent } from 'react'
import { AlertTriangle, ArrowRightLeft, Copy, CopyPlus, GripVertical, Pencil, Scissors, Trash2 } from 'lucide-react'
import type { Item } from '../lib/types'
import { CATEGORY, TREND } from '../lib/meta'
import { useFmt, useStore, useUsd } from '../store'
import { drag } from '../dnd'
import { toast } from '../toast'

export function ItemRow({ item, monthKey, over = false }: { item: Item; monthKey: string; over?: boolean }) {
  const f = useFmt()
  const u = useUsd()
  const [open, setOpen] = useState(false)
  const clipboard = useStore((s) => s.clipboard)
  const t = TREND[item.trend]
  const cat = CATEGORY[item.category]
  const isCut = clipboard?.mode === 'cut' && clipboard.item.id === item.id

  const act = (fn: () => void) => (e: MouseEvent) => {
    e.stopPropagation()
    fn()
  }
  const s = useStore.getState

  const actions = [
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

  return (
    <li
      draggable
      onDragStart={(e) => {
        drag.current = { fromKey: monthKey, id: item.id }
        e.dataTransfer.effectAllowed = 'copyMove'
        e.dataTransfer.setData('text/plain', item.name)
      }}
      onDragEnd={() => (drag.current = null)}
      onClick={() => setOpen((o) => !o)}
      title={over ? 'Not enough budget / earnings this month — move it to another month' : undefined}
      className={`group relative flex cursor-grab flex-wrap items-center gap-2.5 rounded-xl border py-2 pl-2.5 pr-2 transition sm:flex-nowrap sm:pl-1.5 active:cursor-grabbing ${
        over ? 'border-red-500/60 bg-red-500/15 ring-1 ring-red-500/40' : `${t.border} ${t.bg}`
      } ${
        isCut ? 'border-dashed opacity-45' : 'hover:brightness-125'
      }`}
    >
      <GripVertical className="hidden h-4 w-4 shrink-0 text-zinc-600 transition group-hover:text-zinc-400 sm:block" />
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.iconBg} ${t.text}`}>
        <cat.icon className="h-4 w-4" />
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
