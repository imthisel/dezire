import { useState } from 'react'
import { ArrowDown, ArrowUp, ChevronDown, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { DEFAULT_TASK_KINDS, MAX_TASK_KIND_NAME, TASK_COLORS, TASK_ICONS, taskColor, taskIcon } from '../lib/tasks'
import { Modal } from './Modal'
import { toast } from '../toast'

/** Rename, recolour, reorder, add and delete the kinds of tasks. */
export function TaskKinds({ onClose }: { onClose: () => void }) {
  const kinds = useStore((s) => s.taskKinds)
  const tasks = useStore((s) => s.tasks)
  const [open, setOpen] = useState<string | null>(null)
  const [name, setName] = useState('')
  const missing = DEFAULT_TASK_KINDS.filter((d) => !kinds.some((k) => k.id === d.id))

  function add() {
    if (!name.trim()) return
    const id = useStore.getState().addTaskKind(name)
    setName('')
    setOpen(id)
  }

  function remove(id: string, label: string) {
    const used = tasks.filter((t) => t.kind === id).length
    const left = kinds.filter((k) => k.id !== id)
    if (used && !confirm(`Delete “${label}”? Its ${used} task${used === 1 ? '' : 's'} will move to “${left[0]?.label}”.`)) return
    const r = useStore.getState().removeTaskKind(id)
    if (!r.ok) return toast.error(r.error)
    toast.info(`Deleted “${label}”.`)
  }

  return (
    <Modal title="Kinds of tasks" subtitle="Each kind has its own colour on the calendar." onClose={onClose} width="max-w-lg">
      <ul className="space-y-1.5">
        {kinds.map((k, i) => {
          const c = taskColor(k)
          const Icon = taskIcon(k)
          const isOpen = open === k.id
          const count = tasks.filter((t) => t.kind === k.id).length
          return (
            <li key={k.id} className={`rounded-2xl border transition ${isOpen ? 'border-white/15 bg-white/[0.03]' : 'border-white/[0.07]'}`}>
              <div className="flex items-center gap-2 p-2">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${c.block}`}>
                  <Icon className={`h-4 w-4 ${c.text}`} />
                </span>
                <input
                  value={k.label}
                  maxLength={MAX_TASK_KIND_NAME}
                  onChange={(e) => useStore.getState().updateTaskKind(k.id, { label: e.target.value })}
                  aria-label="Name"
                  className="h-9 min-w-0 flex-1 rounded-lg bg-transparent px-2 text-sm font-medium text-white outline-none transition hover:bg-white/[0.04] focus:bg-black/30"
                />
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">{count || ''}</span>
                <button
                  onClick={() => setOpen(isOpen ? null : k.id)}
                  aria-expanded={isOpen}
                  aria-label="Colour and icon"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
                >
                  <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              {isOpen && (
                <div className="animate-fade space-y-3 border-t border-white/[0.06] p-3">
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(TASK_COLORS).map(([id, col]) => (
                      <button
                        key={id}
                        onClick={() => useStore.getState().updateTaskKind(k.id, { color: id })}
                        aria-label={col.label}
                        aria-pressed={k.color === id}
                        title={col.label}
                        className={`h-7 w-7 rounded-full ${col.dot} transition hover:scale-110 ${k.color === id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0e1016]' : ''}`}
                      />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {Object.entries(TASK_ICONS).map(([id, I]) => (
                      <button
                        key={id}
                        onClick={() => useStore.getState().updateTaskKind(k.id, { icon: id })}
                        aria-label={id}
                        aria-pressed={k.icon === id}
                        className={`grid h-8 w-8 place-items-center rounded-lg transition ${k.icon === id ? `${c.block} ${c.text}` : 'text-zinc-500 hover:bg-white/5 hover:text-white'}`}
                      >
                        <I className="h-4 w-4" />
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={i === 0}
                      onClick={() => useStore.getState().moveTaskKind(k.id, i - 1)}
                      aria-label="Move up"
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-25"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      disabled={i === kinds.length - 1}
                      onClick={() => useStore.getState().moveTaskKind(k.id, i + 1)}
                      aria-label="Move down"
                      className="grid h-8 w-8 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:opacity-25"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <span className="flex-1" />
                    <button
                      disabled={kinds.length <= 1}
                      onClick={() => remove(k.id, k.label)}
                      className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 disabled:opacity-25"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              )}
            </li>
          )
        })}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="mt-3 flex gap-2"
      >
        <input
          value={name}
          maxLength={MAX_TASK_KIND_NAME}
          onChange={(e) => setName(e.target.value)}
          placeholder="New kind, e.g. Thesis, Gym, Side project"
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60"
        />
        <button disabled={!name.trim()} className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {missing.length > 0 && (
        <div className="mt-4 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-zinc-500">Bring back:</span>
          {missing.map((d) => (
            <button
              key={d.id}
              onClick={() => useStore.getState().restoreTaskKind(d.id)}
              className="inline-flex h-7 items-center gap-1 rounded-full border border-white/10 px-2.5 text-xs text-zinc-300 transition hover:border-white/20 hover:text-white"
            >
              <RotateCcw className="h-3 w-3" /> {d.label}
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}
