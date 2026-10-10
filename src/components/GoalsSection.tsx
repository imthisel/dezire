import { useEffect, useLayoutEffect, useRef, useState, type DragEvent } from 'react'
import {
  ArrowDown, ArrowRight, ArrowUp, Check, Flag, GripVertical, MoreHorizontal, Pencil, Plus, RotateCcw, SlidersHorizontal, Trash2, Trophy,
} from 'lucide-react'
import { MAX_AREA_NAME, useAreaOf, useGoalAreas, useStore } from '../store'
import { DEFAULT_GOAL_AREAS, areaColor, areaIcon } from '../lib/meta'
import { END_YEAR } from '../lib/time'
import type { Goal, GoalAreaDef } from '../lib/types'
import { card } from './Dashboard'
import { toast } from '../toast'
import { goalDrag } from '../dnd'

const EMPTY: never[] = []

export function GoalsSection() {
  const year = useStore((s) => s.year)
  const goals = useStore((s) => s.goals[year] ?? EMPTY)
  const areas = useGoalAreas()
  const openModal = useStore((s) => s.openModal)

  const done = goals.filter((g) => g.done).length
  const open = goals.length - done
  const pct = goals.length ? done / goals.length : 0

  function carryOver() {
    const n = useStore.getState().carryOverGoals(year)
    if (n) toast.success(`Copied ${n} unfinished goal${n > 1 ? 's' : ''} to ${year + 1}.`)
    else toast.info(`Everything unfinished is already in ${year + 1}.`)
  }

  return (
    <section id="goals" className={`${card} relative overflow-hidden p-4 sm:p-6`}>
      <div aria-hidden className="pointer-events-none absolute -top-24 left-1/2 h-48 w-[70%] -translate-x-1/2 rounded-full bg-indigo-500/10 blur-3xl" />

      {/* Header */}
      <div className="relative flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-fuchsia-400 to-amber-300 shadow-lg shadow-fuchsia-500/20">
            <Flag className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {year} <span className="text-zinc-400">goals</span>
            </h2>
            <p className="text-sm text-zinc-500">
              {goals.length === 0
                ? 'Who do you want to be by the end of the year?'
                : open === 0
                  ? 'Every goal done. What a year.'
                  : `${open} to go · ${done} done`}
            </p>
          </div>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            onClick={() => openModal({ type: 'goalAreas' })}
            title="Rename, add, restyle or remove goal areas"
            aria-label="Edit goal areas"
            className="inline-flex h-11 shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white sm:h-10"
          >
            <SlidersHorizontal className="h-4 w-4" /> <span className="hidden sm:inline">Areas</span>
          </button>
          {open > 0 && year < END_YEAR && (
            <button
              onClick={carryOver}
              title={`Copy unfinished goals into ${year + 1}`}
              className="inline-flex h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white sm:h-10 sm:flex-none sm:gap-2"
            >
              <span className="sm:hidden">Carry</span>
              <span className="hidden sm:inline">Carry unfinished</span> <ArrowRight className="h-4 w-4" /> {year + 1}
            </button>
          )}
          <button
            onClick={() => openModal({ type: 'goal', year })}
            className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl sm:h-10 sm:flex-none bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
          >
            <Plus className="h-4 w-4" strokeWidth={2.5} /> Add goal
          </button>
        </div>
      </div>

      {/* Overall progress, split by area */}
      {goals.length > 0 && (
        <div className="relative mt-5">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="text-zinc-400">Year progress</span>
            <span className="font-semibold tabular-nums text-zinc-200">{Math.round(pct * 100)}%</span>
          </div>
          <div className="flex h-2 gap-0.5 overflow-hidden rounded-full bg-white/5">
            {areas.map((a) => {
              const n = goals.filter((g) => g.area === a.id && g.done).length
              return n ? (
                <div
                  key={a.id}
                  className="h-full transition-all duration-500"
                  style={{ width: `${(n / goals.length) * 100}%`, background: areaColor(a).stroke }}
                />
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Areas */}
      <div className="relative mt-5 grid grid-cols-1 gap-3 md:grid-cols-2">
        {areas.map((a) => (
          <AreaCard key={a.id} area={a} year={year} goals={goals.filter((g) => g.area === a.id)} />
        ))}
        <button
          onClick={() => openModal({ type: 'goalAreas', add: true })}
          className="flex min-h-[4.5rem] items-center justify-center gap-2 rounded-2xl border border-dashed border-white/[0.09] text-sm text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
        >
          <Plus className="h-4 w-4" /> New area
        </button>
      </div>
    </section>
  )
}

function AreaCard({ area, year, goals }: { area: GoalAreaDef; year: number; goals: Goal[] }) {
  const a = areaColor(area)
  const Icon = areaIcon(area)
  const openModal = useStore((s) => s.openModal)
  const done = goals.filter((g) => g.done).length
  const complete = goals.length > 0 && done === goals.length
  const [dropping, setDropping] = useState(false)

  // Dropped on the card itself (not on a goal): goes to the end of this area.
  function onDragOver(e: DragEvent) {
    if (!goalDrag.current) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDropping(true)
  }
  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDropping(false)
    const d = goalDrag.current
    goalDrag.current = null
    if (!d) return
    const from = useStore.getState().goals[year]?.find((g) => g.id === d.id)
    useStore.getState().moveGoal(year, d.id, area.id)
    if (from && from.area !== area.id) toast.info(`Moved to ${area.label}.`)
  }

  return (
    <article
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropping(false)}
      onDrop={onDrop}
      className={`group/card relative flex min-w-0 flex-col rounded-2xl border bg-gradient-to-b ${a.glow} to-transparent to-40% p-3.5 transition sm:p-4 ${
        dropping ? `${a.border} ring-2 ${a.ring}` : complete ? a.border : 'border-white/[0.07] hover:border-white/[0.12]'
      }`}
    >
      <header className="mb-3 flex items-start gap-3">
        <button
          onClick={() => openModal({ type: 'goalAreas', openId: area.id })}
          title="Change icon, colour or name"
          aria-label={`Customize ${area.label}`}
          className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition hover:ring-2 ${a.ring} ${a.iconBg} ${a.text}`}
        >
          <Icon className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <AreaName area={area} />
          <p className="truncate text-xs text-zinc-500">{area.hint}</p>
        </div>
        {goals.length > 0 && <Ring done={done} total={goals.length} color={a.stroke} complete={complete} />}
      </header>

      {/* In the order you put them: drag, or use ⋯ → Move up / down */}
      <ul className="flex flex-1 flex-col gap-1">
        {goals.map((g, i) => (
          <GoalRow key={g.id} goal={g} year={year} prevId={goals[i - 1]?.id} nextId={goals[i + 1]?.id} />
        ))}
        {goals.length === 0 && (
          <li>
            <button
              onClick={() => openModal({ type: 'goal', year, area: area.id })}
              className={`flex w-full items-center justify-center gap-2 rounded-xl border border-dashed py-5 text-sm transition ${
                dropping ? `${a.border} ${a.text}` : 'border-white/[0.09] text-zinc-500 hover:border-white/20 hover:text-zinc-300'
              }`}
            >
              {dropping ? 'Drop here' : <><Plus className="h-4 w-4" /> No goals here yet</>}
            </button>
          </li>
        )}
      </ul>

      {goals.length > 0 && (
        <button
          onClick={() => openModal({ type: 'goal', year, area: area.id })}
          className={`mt-2 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-2 text-xs font-medium sm:py-1.5 text-zinc-500 transition hover:bg-white/5 ${a.hoverText}`}
        >
          <Plus className="h-3.5 w-3.5" /> Add to this area
        </button>
      )}
    </article>
  )
}

/** The area's name — click it to rename. */
function AreaName({ area }: { area: GoalAreaDef }) {
  const label = area.label
  const starter = DEFAULT_GOAL_AREAS.find((d) => d.id === area.id)
  const custom = !!starter && starter.label !== label
  const updateArea = useStore((s) => s.updateArea)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  function commit() {
    updateArea(area.id, { label: draft })
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        maxLength={MAX_AREA_NAME}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit()
          if (e.key === 'Escape') {
            e.stopPropagation()
            setEditing(false)
          }
        }}
        aria-label="Area name"
        className="-ml-1.5 h-7 w-full rounded-md border border-white/15 bg-black/40 px-1.5 text-base font-semibold text-white outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
      />
    )
  }

  return (
    <div className="group/name flex min-w-0 items-center gap-1">
      <button
        onClick={() => {
          setDraft(label)
          setEditing(true)
        }}
        title="Rename this area (applies to every year)"
        className="-ml-1.5 flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-left transition hover:bg-white/5"
      >
        <h3 className="break-words text-base font-semibold leading-snug text-white sm:truncate">{label}</h3>
        <Pencil className="h-3 w-3 shrink-0 text-zinc-600 transition sm:opacity-0 sm:group-hover/name:opacity-100" />
      </button>
      {custom && (
        <button
          onClick={() => updateArea(area.id, { label: starter!.label })}
          title={`Reset to “${starter!.label}”`}
          aria-label="Reset name"
          className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-zinc-600 transition hover:bg-white/5 hover:text-zinc-300 sm:h-6 sm:w-6 sm:opacity-0 sm:group-hover/name:opacity-100"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function GoalRow({ goal, year, prevId, nextId }: { goal: Goal; year: number; prevId?: string; nextId?: string }) {
  const area = useAreaOf()(goal.area)
  const a = areaColor(area)
  const { updateGoal, removeGoal, openModal } = useStore.getState()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(goal.text)
  const [dropAt, setDropAt] = useState<null | 'above' | 'below'>(null)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.focus()
  }, [editing])

  function commit() {
    const t = draft.trim()
    if (t && t !== goal.text) updateGoal(year, goal.id, { text: t })
    setEditing(false)
  }

  function toggle() {
    updateGoal(year, goal.id, { done: !goal.done })
    if (!goal.done) toast.success(`Done: “${goal.text}”`)
  }

  const half = (e: DragEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below'
  }

  function onDragOver(e: DragEvent<HTMLLIElement>) {
    const d = goalDrag.current
    if (!d || d.year !== year) return
    setDropAt(d.id === goal.id ? null : half(e))
  }

  function onDrop(e: DragEvent<HTMLLIElement>) {
    setDropAt(null)
    const d = goalDrag.current
    if (!d || d.year !== year || d.id === goal.id) return
    // Handled here; clearing it makes the area card's own drop handler skip it.
    goalDrag.current = null
    e.preventDefault()
    const from = useStore.getState().goals[year]?.find((g) => g.id === d.id)
    useStore.getState().moveGoal(year, d.id, goal.area, { id: goal.id, after: half(e) === 'below' })
    if (from && from.area !== goal.area) toast.info(`Moved to ${area.label}.`)
  }

  return (
    <li
      draggable={!editing}
      onDragStart={(e) => {
        goalDrag.current = { year, id: goal.id }
        e.dataTransfer.effectAllowed = 'move'
        e.dataTransfer.setData('text/plain', goal.text)
      }}
      onDragEnd={() => (goalDrag.current = null)}
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
      onDrop={onDrop}
      className="group/row animate-fade relative flex items-start gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.04] sm:cursor-grab sm:px-2 sm:py-1.5 sm:active:cursor-grabbing"
    >
      {dropAt && (
        <span
          className={`pointer-events-none absolute inset-x-1 h-0.5 rounded-full ${dropAt === 'above' ? '-top-0.5' : '-bottom-0.5'}`}
          style={{ background: a.stroke }}
        />
      )}
      <GripVertical
        aria-hidden
        className="pointer-events-none absolute -left-2.5 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-zinc-600 opacity-0 transition sm:block sm:group-hover/row:opacity-100"
      />
      <button
        onClick={toggle}
        role="checkbox"
        aria-checked={goal.done}
        aria-label={goal.done ? 'Mark as not done' : 'Mark as done'}
        className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 transition sm:h-5 sm:w-5 ${
          goal.done ? a.check : `border-zinc-600 ${a.hoverBorder}`
        }`}
      >
        {goal.done && <Check className="animate-tick h-3 w-3 text-black" strokeWidth={3.5} />}
      </button>

      {editing ? (
        <input
          ref={input}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') commit()
            if (e.key === 'Escape') {
              setDraft(goal.text)
              setEditing(false)
            }
          }}
          aria-label="Goal"
          className="-my-0.5 h-7 min-w-0 flex-1 rounded-md border border-white/15 bg-black/40 px-1.5 text-sm text-white outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
        />
      ) : (
        <p
          onDoubleClick={() => {
            setDraft(goal.text)
            setEditing(true)
          }}
          title="Double-click to edit · drag to move"
          className={`min-w-0 flex-1 break-words py-0.5 text-[15px] leading-6 transition sm:py-0 sm:text-sm ${
            goal.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'
          }`}
        >
          {goal.text}
        </p>
      )}

      {!editing && (
        <div className="-my-1 flex shrink-0 items-center opacity-100 sm:my-0 sm:gap-0.5 transition sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-within:opacity-100 sm:has-[[aria-expanded=true]]:opacity-100">
          <button
            onClick={() => openModal({ type: 'goal', year, editId: goal.id })}
            title="Edit"
            aria-label="Edit goal"
            className="hidden h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white sm:grid"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => {
              removeGoal(year, goal.id)
              toast.info(`Deleted “${goal.text}”.`)
            }}
            title="Delete"
            aria-label="Delete goal"
            className="hidden h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-red-300 sm:grid"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
          <GoalMenu goal={goal} year={year} prevId={prevId} nextId={nextId} />
        </div>
      )}
    </li>
  )
}

/** ⋯ menu: move up / down, move to another area, edit, delete. Works everywhere, including phones (no dragging there). */
function GoalMenu({ goal, year, prevId, nextId }: { goal: Goal; year: number; prevId?: string; nextId?: string }) {
  const areas = useGoalAreas()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number; up: boolean } | null>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const menu = useRef<HTMLDivElement>(null)
  const s = useStore.getState

  // Fixed position next to the button, flipped upward near the bottom of the screen, so cards never clip it.
  useLayoutEffect(() => {
    if (!open || !btn.current) return
    const r = btn.current.getBoundingClientRect()
    const h = menu.current?.offsetHeight ?? 300
    const up = r.bottom + h + 8 > window.innerHeight && r.top - h - 8 > 0
    setPos({ top: up ? r.top - h - 4 : r.bottom + 4, left: Math.max(8, Math.min(r.right - 224, window.innerWidth - 232)), up })
  }, [open])

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      if (e.type === 'keydown' && (e as KeyboardEvent).key !== 'Escape') return
      if (e.type === 'pointerdown' && (menu.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node))) return
      setOpen(false)
    }
    window.addEventListener('pointerdown', close)
    window.addEventListener('keydown', close)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('pointerdown', close)
      window.removeEventListener('keydown', close)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [open])

  const run = (fn: () => void) => () => {
    fn()
    setOpen(false)
  }
  const moveTo = (area: GoalAreaDef) => {
    s().moveGoal(year, goal.id, area.id)
    toast.info(`Moved to ${area.label}.`)
  }

  const item = 'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm transition disabled:pointer-events-none disabled:opacity-30'

  return (
    <>
      <button
        ref={btn}
        onClick={() => {
          setPos(null)
          setOpen((o) => !o)
        }}
        aria-label="More: move, edit, delete"
        aria-haspopup="menu"
        aria-expanded={open}
        title="Move, edit, delete"
        className={`grid h-9 w-9 place-items-center rounded-md transition hover:bg-white/10 hover:text-white sm:h-7 sm:w-7 ${open ? 'bg-white/10 text-white' : 'text-zinc-500'}`}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menu}
          role="menu"
          style={pos ? { top: pos.top, left: pos.left } : { visibility: 'hidden', top: 0, left: 0 }}
          className={`fixed z-[60] w-56 rounded-xl border border-white/10 bg-[#0e1016]/95 p-1.5 shadow-2xl shadow-black/60 backdrop-blur-xl ${pos ? 'animate-fade' : ''}`}
        >
          <button role="menuitem" disabled={!prevId} onClick={run(() => s().moveGoal(year, goal.id, goal.area, { id: prevId!, after: false }))} className={`${item} text-zinc-200 hover:bg-white/[0.07]`}>
            <ArrowUp className="h-4 w-4 text-zinc-400" /> Move up
          </button>
          <button role="menuitem" disabled={!nextId} onClick={run(() => s().moveGoal(year, goal.id, goal.area, { id: nextId!, after: true }))} className={`${item} text-zinc-200 hover:bg-white/[0.07]`}>
            <ArrowDown className="h-4 w-4 text-zinc-400" /> Move down
          </button>

          <p className="mt-1.5 border-t border-white/[0.06] px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-zinc-500">Move to</p>
          {areas.filter((x) => x.id !== goal.area).map((x) => {
            const ga = areaColor(x)
            const Icon = areaIcon(x)
            return (
              <button key={x.id} role="menuitem" onClick={run(() => moveTo(x))} className={`${item} text-zinc-200 hover:bg-white/[0.07]`}>
                <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-md ${ga.iconBg} ${ga.text}`}>
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1 truncate">{x.label}</span>
              </button>
            )
          })}

          <div className="mt-1.5 border-t border-white/[0.06] pt-1.5">
            <button role="menuitem" onClick={run(() => s().openModal({ type: 'goal', year, editId: goal.id }))} className={`${item} text-zinc-200 hover:bg-white/[0.07]`}>
              <Pencil className="h-4 w-4 text-zinc-400" /> Edit
            </button>
            <button
              role="menuitem"
              onClick={run(() => {
                s().removeGoal(year, goal.id)
                toast.info(`Deleted “${goal.text}”.`)
              })}
              className={`${item} text-red-300 hover:bg-red-500/10`}
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          </div>
        </div>
      )}
    </>
  )
}

function Ring({ done, total, color, complete }: { done: number; total: number; color: string; complete: boolean }) {
  const r = 15
  const c = 2 * Math.PI * r
  return (
    <div className="relative grid h-10 w-10 shrink-0 place-items-center" title={`${done} of ${total} done`}>
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle
          cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - done / total)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      {complete ? (
        <Trophy className="h-4 w-4" style={{ color }} />
      ) : (
        <span className="text-[10px] font-semibold tabular-nums text-zinc-300">
          {done}/{total}
        </span>
      )}
    </div>
  )
}
