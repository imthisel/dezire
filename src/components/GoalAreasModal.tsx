import { useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, GripVertical, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { MAX_AREA_NAME, useGoalAreas, useStore } from '../store'
import { DEFAULT_GOAL_AREAS, GOAL_COLORS, GOAL_ICONS, areaColor, areaIcon } from '../lib/meta'
import type { GoalAreaDef } from '../lib/types'
import { Modal } from './Modal'
import { toast } from '../toast'

const input =
  'h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm'

/** Add, rename, restyle, reorder and delete the goal areas. Every change applies right away, to every year. */
export function GoalAreasModal({ onClose, openId: initial, add: adding }: { onClose: () => void; openId?: string; add?: boolean }) {
  const areas = useGoalAreas()
  const goals = useStore((s) => s.goals)
  const [openId, setOpenId] = useState<string | null>(initial ?? null)
  /** The area just added: its name box gets focus so it can be renamed straight away */
  const [fresh, setFresh] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const list = useRef<HTMLUListElement>(null)

  /** How many goals each area has, across every year. */
  const counts = useMemo(() => {
    const n = new Map<string, number>()
    for (const year of Object.values(goals)) for (const g of year) n.set(g.area, (n.get(g.area) ?? 0) + 1)
    return n
  }, [goals])
  const missing = DEFAULT_GOAL_AREAS.filter((d) => !areas.some((a) => a.id === d.id))

  function add() {
    const id = useStore.getState().addArea(draft)
    setDraft('')
    setOpenId(id)
    setFresh(id)
    requestAnimationFrame(() => list.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <Modal
      title="Goal areas"
      subtitle="Name them however you like and pick an icon. Changes apply to every year right away."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {areas.length} area{areas.length === 1 ? '' : 's'} · you need at least one
          </p>
          <button
            onClick={onClose}
            className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:h-10"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <ul ref={list} className="space-y-2">
          {areas.map((a, i) => (
            <AreaRow
              key={a.id}
              area={a}
              index={i}
              total={areas.length}
              count={counts.get(a.id) ?? 0}
              open={openId === a.id}
              fresh={fresh === a.id}
              onToggle={() => setOpenId((o) => (o === a.id ? null : a.id))}
              onDeleted={() => setOpenId(null)}
              dragId={dragId}
              setDragId={setDragId}
            />
          ))}
        </ul>

        {/* Add an area */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex gap-2"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">New area name</span>
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={draft}
              maxLength={MAX_AREA_NAME}
              autoFocus={adding}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add an area, e.g. Relationships, Faith, Fun"
              className={`${input} pl-9`}
            />
          </label>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-11 shrink-0 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-4 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"
          >
            Add
          </button>
        </form>

        {missing.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-zinc-500">Starter areas you removed, tap to bring one back:</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((d) => {
                const Icon = areaIcon(d)
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      useStore.getState().restoreArea(d.id)
                      toast.info(`Added “${d.label}” back.`)
                    }}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <Icon className="h-3.5 w-3.5" /> {d.label}
                  </button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}

interface RowProps {
  area: GoalAreaDef
  index: number
  total: number
  count: number
  open: boolean
  fresh: boolean
  onToggle: () => void
  onDeleted: () => void
  dragId: string | null
  setDragId: (id: string | null) => void
}

function AreaRow({ area, index, total, count, open, fresh, onToggle, onDeleted, dragId, setDragId }: RowProps) {
  const { updateArea, moveArea } = useStore.getState()
  const Icon = areaIcon(area)
  const c = areaColor(area)
  const starter = DEFAULT_GOAL_AREAS.find((d) => d.id === area.id)
  const changed = !!starter && (starter.label !== area.label || starter.hint !== area.hint || starter.icon !== area.icon || starter.color !== area.color)
  const [dropAt, setDropAt] = useState<null | 'above' | 'below'>(null)

  const half = (e: DragEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below'
  }

  return (
    <li
      onDragOver={(e) => {
        if (!dragId) return
        e.preventDefault()
        setDropAt(dragId === area.id ? null : half(e))
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
      onDrop={(e) => {
        e.preventDefault()
        setDropAt(null)
        if (!dragId || dragId === area.id) return
        const areas = useStore.getState().goalAreas
        const from = areas.findIndex((a) => a.id === dragId)
        // Position in the list once the dragged area has been taken out of it.
        const to = index + (half(e) === 'below' ? 1 : 0) - (from < index ? 1 : 0)
        moveArea(dragId, to)
        setDragId(null)
      }}
      className={`relative rounded-2xl border transition ${open ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'} ${
        dragId === area.id ? 'opacity-40' : ''
      }`}
    >
      {dropAt && <span className={`pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-indigo-400 ${dropAt === 'above' ? '-top-[5px]' : '-bottom-[5px]'}`} />}

      <div className="flex items-center gap-1 py-1.5 pl-1 pr-2">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', area.label)
            setDragId(area.id)
          }}
          onDragEnd={() => setDragId(null)}
          title="Drag to reorder"
          className="hidden h-9 w-6 shrink-0 cursor-grab place-items-center text-zinc-600 transition hover:text-zinc-300 active:cursor-grabbing sm:grid"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pl-2 text-left sm:pl-0">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${c.iconBg} ${c.text}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{area.label}</span>
            <span className="block truncate text-xs text-zinc-500">{area.hint.trim() || 'No description yet'}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
            {count} goal{count === 1 ? '' : 's'}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="animate-fade space-y-4 border-t border-white/[0.06] px-3 pb-3 pt-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <NameField area={area} focus={fresh} />
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">What fits here (optional)</span>
              <input
                value={area.hint}
                maxLength={80}
                onChange={(e) => updateArea(area.id, { hint: e.target.value })}
                placeholder="e.g. Partner, family, friends"
                className={input}
              />
            </label>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs text-zinc-400">Icon</legend>
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-[repeat(12,minmax(0,1fr))]">
              {Object.entries(GOAL_ICONS).map(([name, I]) => {
                const on = area.icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateArea(area.id, { icon: name })}
                    aria-label={`${name} icon`}
                    aria-pressed={on}
                    title={name[0].toUpperCase() + name.slice(1)}
                    className={`grid aspect-square place-items-center rounded-lg transition ${
                      on ? `${c.iconBg} ${c.text} ring-2 ${c.ring}` : 'text-zinc-400 hover:bg-white/[0.07] hover:text-white'
                    }`}
                  >
                    <I className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs text-zinc-400">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(GOAL_COLORS).map(([name, col]) => {
                const on = area.color === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateArea(area.id, { color: name })}
                    aria-label={col.label}
                    aria-pressed={on}
                    title={col.label}
                    style={{ background: col.stroke }}
                    className={`grid h-8 w-8 place-items-center rounded-full transition ${
                      on ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0e1016]' : 'opacity-70 hover:scale-110 hover:opacity-100'
                    }`}
                  >
                    {on && <Check className="h-4 w-4 text-black/70" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </fieldset>

          {starter && changed && (
            <button
              onClick={() => updateArea(area.id, { label: starter.label, hint: starter.hint, icon: starter.icon, color: starter.color })}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 transition hover:text-zinc-200"
            >
              <RotateCcw className="h-3 w-3" /> Back to the original “{starter.label}”
            </button>
          )}

          <Actions area={area} index={index} total={total} count={count} onDeleted={onDeleted} />
        </div>
      )}
    </li>
  )
}

/** Renamed as you type; an emptied name goes back to the last one when you leave the box. */
function NameField({ area, focus }: { area: GoalAreaDef; focus: boolean }) {
  const [draft, setDraft] = useState(area.label)
  const update = useStore((s) => s.updateArea)
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">Name</span>
      <input
        value={draft}
        maxLength={MAX_AREA_NAME}
        autoFocus={focus}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setDraft(e.target.value)
          update(area.id, { label: e.target.value })
        }}
        onBlur={() => setDraft(useStore.getState().goalAreas.find((a) => a.id === area.id)?.label.trim() ?? draft)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={input}
      />
    </label>
  )
}

/** Move up / down, and delete (asking where its goals should go). */
function Actions({ area, index, total, count, onDeleted }: { area: GoalAreaDef; index: number; total: number; count: number; onDeleted: () => void }) {
  const areas = useGoalAreas()
  const others = areas.filter((a) => a.id !== area.id)
  const [confirming, setConfirming] = useState(false)
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '')
  const target = others.find((a) => a.id === moveTo) ?? others[0]
  const last = total <= 1
  const { moveArea, removeArea } = useStore.getState()

  function remove() {
    const r = removeArea(area.id, target?.id)
    if (!r.ok) return toast.error(r.error)
    toast.info(count ? `Deleted “${area.label}”. Its ${count} goal${count === 1 ? '' : 's'} moved to “${target!.label}”.` : `Deleted “${area.label}”.`)
    onDeleted()
  }

  if (confirming) {
    return (
      <div role="alert" className="animate-fade rounded-xl border border-red-500/30 bg-red-500/[0.08] p-3">
        <p className="flex items-start gap-2 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>
            “{area.label}” has {count} goal{count === 1 ? '' : 's'}. Nothing gets deleted, pick the area they should move to:
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Move goals to">
          {others.map((a) => {
            const on = target?.id === a.id
            const I = areaIcon(a)
            return (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMoveTo(a.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
                  on ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                }`}
              >
                <I className={`h-3.5 w-3.5 ${areaColor(a).text}`} /> {a.label}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setConfirming(false)} className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5">
            Cancel
          </button>
          <button onClick={remove} className="h-9 rounded-lg bg-red-500/90 px-3 text-sm font-semibold text-white transition hover:bg-red-500">
            Move {count} &amp; delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-3">
      <button
        onClick={() => moveArea(area.id, index - 1)}
        disabled={index === 0}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
      >
        <ArrowUp className="h-3.5 w-3.5" /> Up
      </button>
      <button
        onClick={() => moveArea(area.id, index + 1)}
        disabled={index === total - 1}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
      >
        <ArrowDown className="h-3.5 w-3.5" /> Down
      </button>
      <span className="flex-1" />
      {last ? (
        <span className="inline-flex items-center gap-1.5 px-2 text-xs text-zinc-500">
          <Lock className="h-3.5 w-3.5" /> Your only area, it can’t be deleted
        </span>
      ) : (
        <button
          onClick={() => (count ? setConfirming(true) : remove())}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete area
        </button>
      )}
    </div>
  )
}
