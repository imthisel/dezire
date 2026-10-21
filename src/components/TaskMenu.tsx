import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { create } from 'zustand'
import { ArrowLeftRight, Check, Copy, Pencil, RotateCcw, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { dayLabel } from '../lib/expenses'
import { isDoneOn, isEvent } from '../lib/tasks'
import { toast } from '../toast'

type Menu = { x: number; y: number; id: string; day: string }
const useMenu = create<{ menu: Menu | null }>(() => ({ menu: null }))

/** Right-click on a task: opens its menu where the pointer is. */
export function openTaskMenu(e: ReactMouseEvent, id: string, day: string) {
  e.preventDefault()
  e.stopPropagation()
  useMenu.setState({ menu: { x: e.clientX, y: e.clientY, id, day } })
}

const closeMenu = () => useMenu.setState({ menu: null })

/** The menu for one task: edit, tick off, duplicate, delete. Mount once. */
export function TaskMenu() {
  const menu = useMenu((s) => s.menu)
  const task = useStore((s) => (menu ? s.tasks.find((t) => t.id === menu.id) : undefined))
  const box = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ left: 0, top: 0 })

  // Keep it on screen.
  useLayoutEffect(() => {
    if (!menu || !box.current) return
    const r = box.current.getBoundingClientRect()
    setPos({
      left: Math.max(8, Math.min(menu.x, window.innerWidth - r.width - 8)),
      top: Math.max(8, menu.y + r.height > window.innerHeight - 8 ? menu.y - r.height : menu.y),
    })
    box.current.querySelector('button')?.focus()
  }, [menu])

  useEffect(() => {
    if (!menu) return
    const outside = (e: Event) => !box.current?.contains(e.target as Node) && closeMenu()
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return closeMenu()
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      e.preventDefault()
      const items = [...(box.current?.querySelectorAll('button') ?? [])]
      const at = items.indexOf(document.activeElement as HTMLButtonElement)
      items[(at + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus()
    }
    window.addEventListener('pointerdown', outside, true)
    window.addEventListener('contextmenu', outside, true)
    window.addEventListener('keydown', key)
    window.addEventListener('scroll', closeMenu, true)
    window.addEventListener('resize', closeMenu)
    return () => {
      window.removeEventListener('pointerdown', outside, true)
      window.removeEventListener('contextmenu', outside, true)
      window.removeEventListener('keydown', key)
      window.removeEventListener('scroll', closeMenu, true)
      window.removeEventListener('resize', closeMenu)
    }
  }, [menu])

  if (!menu || !task) return null
  const done = isDoneOn(task, menu.day)
  const event = isEvent(task)

  function run(fn: () => void) {
    closeMenu()
    fn()
  }

  const item =
    'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm text-zinc-200 outline-none transition hover:bg-white/[0.07] focus-visible:bg-white/[0.07]'

  return createPortal(
    <div
      ref={box}
      role="menu"
      aria-label={task.title}
      onContextMenu={(e) => e.preventDefault()}
      className="animate-menu fixed z-[60] w-56 rounded-xl border border-white/10 bg-[#12141c]/95 p-1 shadow-2xl shadow-black/60 backdrop-blur-xl"
      style={pos}
    >
      <p className="truncate px-2.5 pb-1 pt-1.5 text-xs font-medium text-zinc-500">
        {task.title}
        {task.repeat && ` · ${dayLabel(menu.day)}`}
      </p>
      <button role="menuitem" className={item} onClick={() => run(() => useStore.getState().openModal({ type: 'task', editId: task.id }))}>
        <Pencil className="h-4 w-4 text-zinc-400" /> Edit
      </button>
      {/* Only tasks get ticked off; events are just time on the calendar. */}
      {!event && (
        <button role="menuitem" className={item} onClick={() => run(() => useStore.getState().toggleTask(task.id, menu.day))}>
          {done ? <RotateCcw className="h-4 w-4 text-zinc-400" /> : <Check className="h-4 w-4 text-emerald-300" />}
          {done ? 'Mark not done' : task.repeat ? 'Mark done for this day' : 'Mark done'}
        </button>
      )}
      <button
        role="menuitem"
        className={item}
        onClick={() =>
          run(() => {
            const to = event ? 'todo' : 'event'
            useStore.getState().updateTask(task.id, { type: to })
            toast.success(to === 'event' ? `“${task.title}” is now an event.` : `“${task.title}” is now a task.`)
          })
        }
      >
        <ArrowLeftRight className="h-4 w-4 text-zinc-400" /> {event ? 'Make it a task' : 'Make it an event'}
      </button>
      <button
        role="menuitem"
        className={item}
        onClick={() =>
          run(() => {
            const { id: _id, createdAt: _c, done: _d, doneOn: _o, ...copy } = task
            useStore.getState().addTask(copy)
            toast.success(`Duplicated “${task.title}”.`)
          })
        }
      >
        <Copy className="h-4 w-4 text-zinc-400" /> Duplicate
      </button>
      <div className="my-1 h-px bg-white/[0.07]" />
      <button
        role="menuitem"
        className={`${item} text-red-300 hover:bg-red-500/10 focus-visible:bg-red-500/10`}
        onClick={() =>
          run(() => {
            const gone = useStore.getState().removeTask(task.id)
            if (gone) toast.undo(`Deleted “${gone.title}”${gone.repeat ? ' and all its repeats' : ''}.`, () => useStore.getState().restoreTask(gone))
          })
        }
      >
        <Trash2 className="h-4 w-4" /> {task.repeat ? 'Delete (every repeat)' : 'Delete'}
      </button>
    </div>,
    document.body,
  )
}
