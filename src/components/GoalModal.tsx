import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, CornerDownLeft, SlidersHorizontal } from 'lucide-react'
import { useAreaOf, useGoalAreas, useStore } from '../store'
import { areaColor, areaIcon, goalPlaceholder } from '../lib/meta'
import type { GoalArea } from '../lib/types'
import { Modal } from './Modal'
import { GoalAreasModal } from './GoalAreasModal'
import { toast } from '../toast'

const EMPTY: never[] = []

export function GoalModal({ year, editId, area: preset }: { year: number; editId?: string; area?: GoalArea }) {
  const close = useStore((s) => s.closeModal)
  const goals = useStore((s) => s.goals[year] ?? EMPTY)
  const areas = useGoalAreas()
  const areaOf = useAreaOf()
  const label = (id: GoalArea) => areaOf(id).label
  const editing = editId ? goals.find((g) => g.id === editId) : undefined

  const [area, setArea] = useState<GoalArea | null>(editing?.area ?? preset ?? null)
  const [text, setText] = useState(editing?.text ?? '')
  const [added, setAdded] = useState(0)
  const [managing, setManaging] = useState(false)
  const stopManaging = useCallback(() => setManaging(false), [])
  const input = useRef<HTMLTextAreaElement>(null)

  // The picked area may have been deleted meanwhile (Edit areas).
  const ready = !!area && areas.some((a) => a.id === area) && text.trim().length > 0
  const siblings = area ? goals.filter((g) => g.area === area && g.id !== editId) : EMPTY

  useEffect(() => {
    if (area) input.current?.focus()
  }, [area])

  function save(another = false) {
    if (!ready) return
    const s = useStore.getState()
    if (editing) {
      s.updateGoal(year, editing.id, { text: text.trim(), area: area! })
      toast.success(editing.area === area ? 'Goal updated.' : `Goal moved to ${label(area!)}.`)
      return close()
    }
    s.addGoal(year, area!, text)
    if (another) {
      setText('')
      setAdded((n) => n + 1)
      input.current?.focus()
    } else {
      toast.success(`Added to ${label(area!)} · ${year}.`)
      close()
    }
  }

  return (
    <Modal
      title={editing ? 'Edit goal' : 'Add a goal'}
      subtitle={`Goals for ${year}`}
      onClose={close}
      width="max-w-2xl"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {added > 0 ? (
            <p className="text-xs text-emerald-300">
              {added} goal{added > 1 ? 's' : ''} added
            </p>
          ) : (
            <p className="hidden items-center gap-1 text-xs text-zinc-500 sm:inline-flex">
              <CornerDownLeft className="h-3 w-3" /> Enter to save · Shift+Enter for a new line
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={close} className="h-11 rounded-xl px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 sm:h-10 sm:px-4">
              {added > 0 ? 'Done' : 'Cancel'}
            </button>
            {!editing && (
              <button
                onClick={() => save(true)}
                disabled={!ready}
                className="h-11 flex-1 whitespace-nowrap rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 sm:h-10 sm:flex-none sm:px-4 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <span className="sm:hidden">+ Another</span>
                <span className="hidden sm:inline">Add &amp; another</span>
              </button>
            )}
            <button
              onClick={() => save()}
              disabled={!ready}
              className="h-11 flex-1 rounded-xl bg-gradient-to-r sm:h-10 sm:flex-none from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {editing ? 'Save changes' : 'Add goal'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-6">
        <Step
          n={1}
          title="What is this goal for?"
          done={!!area}
          action={
            <button
              type="button"
              onClick={() => setManaging(true)}
              className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Edit areas
            </button>
          }
        >
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {areas.map((def) => {
              const k = def.id
              const a = areaColor(def)
              const Icon = areaIcon(def)
              const on = area === k
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setArea(k)}
                  aria-pressed={on}
                  className={`group relative flex flex-col items-center gap-2 overflow-hidden rounded-2xl border px-2 py-4 text-center transition ${
                    on ? `${a.border} ${a.bg} ring-2 ${a.ring}` : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                  }`}
                >
                  <span
                    className={`grid h-11 w-11 place-items-center rounded-xl transition ${on ? `${a.iconBg} ${a.text}` : 'bg-white/5 text-zinc-400 group-hover:text-zinc-200'}`}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="break-words text-sm font-semibold leading-tight text-white">{def.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500">{def.hint}</span>
                  {on && (
                    <span className={`absolute right-2 top-2 grid h-4 w-4 place-items-center rounded-full ${a.check}`}>
                      <Check className="h-2.5 w-2.5 text-black" strokeWidth={3.5} />
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </Step>

        <Step n={2} title="What's the goal?" done={text.trim().length > 0}>
          <textarea
            ref={input}
            rows={2}
            enterKeyHint="done"
            value={text}
            disabled={!area}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                save(e.ctrlKey || e.metaKey)
              }
            }}
            placeholder={area ? goalPlaceholder(areaOf(area)) : 'Pick an area first'}
            className="w-full resize-none rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40"
          />
          {area && siblings.length > 0 && (
            <div className="animate-fade mt-3">
              <p className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-zinc-500">
                Grouped with {siblings.length} other {label(area)} goal{siblings.length > 1 ? 's' : ''}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {siblings.map((g) => (
                  <span
                    key={g.id}
                    className={`max-w-full truncate rounded-full border px-2.5 py-1 text-xs ${areaColor(areaOf(area)).border} ${areaColor(areaOf(area)).bg} ${
                      g.done ? 'text-zinc-500 line-through' : 'text-zinc-200'
                    }`}
                  >
                    {g.text}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Step>
      </div>
      {managing && <GoalAreasModal onClose={stopManaging} />}
    </Modal>
  )
}

function Step({ n, title, done, action, children }: { n: number; title: string; done: boolean; action?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition ${
            done ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-zinc-300'
          }`}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
        </span>
        <h3 className="flex-1 text-sm font-semibold text-zinc-200">{title}</h3>
        {action}
      </div>
      {children}
    </section>
  )
}
