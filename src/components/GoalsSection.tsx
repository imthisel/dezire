import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Flag, Pencil, Plus, RotateCcw, Trash2, Trophy } from 'lucide-react'
import { useAreaLabel, useStore } from '../store'
import { GOAL_AREA, GOAL_AREAS } from '../lib/meta'
import { END_YEAR } from '../lib/time'
import type { Goal, GoalArea } from '../lib/types'
import { card } from './Dashboard'
import { toast } from '../toast'

const EMPTY: never[] = []

export function GoalsSection() {
  const year = useStore((s) => s.year)
  const goals = useStore((s) => s.goals[year] ?? EMPTY)
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
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-sky-400 via-fuchsia-400 to-amber-300 shadow-lg shadow-fuchsia-500/20">
            <Flag className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight text-white">
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
        <div className="flex flex-wrap gap-2">
          {open > 0 && year < END_YEAR && (
            <button
              onClick={carryOver}
              title={`Copy unfinished goals into ${year + 1}`}
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
            >
              Carry unfinished <ArrowRight className="h-4 w-4" /> {year + 1}
            </button>
          )}
          <button
            onClick={() => openModal({ type: 'goal', year })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
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
            {GOAL_AREAS.map((a) => {
              const n = goals.filter((g) => g.area === a && g.done).length
              return n ? (
                <div
                  key={a}
                  className="h-full transition-all duration-500"
                  style={{ width: `${(n / goals.length) * 100}%`, background: GOAL_AREA[a].stroke }}
                />
              ) : null
            })}
          </div>
        </div>
      )}

      {/* Areas */}
      <div className="relative mt-5 grid gap-3 md:grid-cols-2">
        {GOAL_AREAS.map((a) => (
          <AreaCard key={a} area={a} year={year} goals={goals.filter((g) => g.area === a)} />
        ))}
      </div>
    </section>
  )
}

function AreaCard({ area, year, goals }: { area: GoalArea; year: number; goals: Goal[] }) {
  const a = GOAL_AREA[area]
  const openModal = useStore((s) => s.openModal)
  const done = goals.filter((g) => g.done).length
  const complete = goals.length > 0 && done === goals.length
  // Unfinished first, finished sink to the bottom; otherwise keep the order they were added in.
  const sorted = [...goals].sort((x, y) => Number(x.done) - Number(y.done))

  return (
    <article
      className={`group/card relative flex flex-col overflow-hidden rounded-2xl border bg-gradient-to-b ${a.glow} to-transparent to-40% p-4 transition ${
        complete ? a.border : 'border-white/[0.07] hover:border-white/[0.12]'
      }`}
    >
      <header className="mb-3 flex items-start gap-3">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${a.iconBg} ${a.text}`}>
          <a.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <AreaName area={area} />
          <p className="truncate text-xs text-zinc-500">{a.hint}</p>
        </div>
        {goals.length > 0 && <Ring done={done} total={goals.length} color={a.stroke} complete={complete} />}
      </header>

      <ul className="flex flex-1 flex-col gap-1">
        {sorted.map((g) => (
          <GoalRow key={g.id} goal={g} year={year} />
        ))}
        {goals.length === 0 && (
          <li>
            <button
              onClick={() => openModal({ type: 'goal', year, area })}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.09] py-5 text-sm text-zinc-500 transition hover:border-white/20 hover:text-zinc-300"
            >
              <Plus className="h-4 w-4" /> No goals here yet
            </button>
          </li>
        )}
      </ul>

      {goals.length > 0 && (
        <button
          onClick={() => openModal({ type: 'goal', year, area })}
          className={`mt-2 inline-flex items-center gap-1.5 self-start rounded-lg px-2 py-1.5 text-xs font-medium text-zinc-500 transition hover:bg-white/5 ${a.hoverText}`}
        >
          <Plus className="h-3.5 w-3.5" /> Add to this area
        </button>
      )}
    </article>
  )
}

/** The area's name — click it to rename. */
function AreaName({ area }: { area: GoalArea }) {
  const label = useAreaLabel()(area)
  const custom = useStore((s) => !!s.areaLabels[area])
  const setAreaLabel = useStore((s) => s.setAreaLabel)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) input.current?.select()
  }, [editing])

  function commit() {
    setAreaLabel(area, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        ref={input}
        value={draft}
        maxLength={40}
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
        <h3 className="truncate text-base font-semibold text-white">{label}</h3>
        <Pencil className="h-3 w-3 shrink-0 text-zinc-600 opacity-0 transition group-hover/name:opacity-100" />
      </button>
      {custom && (
        <button
          onClick={() => setAreaLabel(area, '')}
          title={`Reset to “${GOAL_AREA[area].label}”`}
          aria-label="Reset name"
          className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-zinc-600 opacity-0 transition hover:bg-white/5 hover:text-zinc-300 group-hover/name:opacity-100"
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      )}
    </div>
  )
}

function GoalRow({ goal, year }: { goal: Goal; year: number }) {
  const a = GOAL_AREA[goal.area]
  const { updateGoal, removeGoal, openModal } = useStore.getState()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(goal.text)
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

  return (
    <li className="group/row animate-fade flex items-start gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-white/[0.04]">
      <button
        onClick={toggle}
        role="checkbox"
        aria-checked={goal.done}
        aria-label={goal.done ? 'Mark as not done' : 'Mark as done'}
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${
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
          title="Double-click to edit"
          className={`min-w-0 flex-1 cursor-text break-words text-sm leading-6 transition ${
            goal.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'
          }`}
        >
          {goal.text}
        </p>
      )}

      {!editing && (
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition sm:opacity-0 sm:group-hover/row:opacity-100 sm:focus-within:opacity-100">
          <button
            onClick={() => openModal({ type: 'goal', year, editId: goal.id })}
            title="Edit or change area"
            aria-label="Edit goal"
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-white"
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
            className="grid h-7 w-7 place-items-center rounded-md text-zinc-500 transition hover:bg-white/10 hover:text-red-300"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
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
