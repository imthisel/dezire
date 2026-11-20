import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Calculator, Check, ChevronDown, GripVertical, Lightbulb, ListChecks, NotebookPen, Plus, Rocket, Target, Trash2, Wand2, X } from 'lucide-react'
import { useFmt, usePlan, useStore, useAlt } from '../store'
import { SOURCE_KIND, SOURCE_KINDS, SOURCE_STAGE, SOURCE_STAGES } from '../lib/meta'
import { currentIndex, labelOf } from '../lib/time'
import type { IncomeSource, SourceKind } from '../lib/types'
import { MoneyInput } from './MoneyInput'
import { card } from './Dashboard'
import { toast } from '../toast'
import { useSortable } from '../sortable'
import { OPEN_EVENT } from '../nav'

const WEEKS_PER_MONTH = 52 / 12

/*
 * "How am I going to make the money": one card per way of earning, every field optional.
 * To keep it calm, plans fold down to a one-line summary (with their next step, tickable right there), the top shows
 * only what matters (does the plan cover this month's goal, and what to do next), and the extra parts of a plan
 * (money math, ideas, notes) open only when asked for.
 */

// Which plans are open, remembered on this device. Not set = the default (open only when it's the only plan).
const OPEN_KEY = 'dz-plan-open'
function readOpen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(OPEN_KEY) || '{}') ?? {}
  } catch {
    return {}
  }
}
function saveOpen(id: string, open: boolean) {
  try {
    localStorage.setItem(OPEN_KEY, JSON.stringify({ ...readOpen(), [id]: open }))
  } catch {
    /* private mode: just not remembered */
  }
}

/** Opens when the sidebar jumps to `id` (see goTo). */
function useOpenOn(id: string, open: () => void) {
  const ref = useRef(open)
  ref.current = open
  useEffect(() => {
    const on = (e: Event) => (e as CustomEvent<string>).detail === id && ref.current()
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [id])
}

export function MoneyPlan() {
  const sources = useStore((s) => s.sources)
  const [fresh, setFresh] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)

  // While a plan is being dragged, every card folds down to its header so they're quick to reorder.
  // The card being moved stays put on screen when they fold and unfold.
  const [folded, setFolded] = useState(false)
  const foldedRef = useRef(false)
  const lastDrag = useRef<string | null>(null)
  const anchor = useRef<{ id: string; top: number } | null>(null)
  const keep = (id: string) => {
    const el = document.getElementById(`source-${id}`)
    anchor.current = el ? { id, top: el.getBoundingClientRect().top } : null
  }
  useEffect(() => {
    if (dragId) {
      lastDrag.current = dragId
      // Not during dragstart itself: changing the page then can cancel a mouse drag.
      const t = setTimeout(() => {
        keep(dragId)
        foldedRef.current = true
        setFolded(true)
      })
      return () => clearTimeout(t)
    }
    if (foldedRef.current && lastDrag.current) keep(lastDrag.current)
    foldedRef.current = false
    setFolded(false)
  }, [dragId])
  useLayoutEffect(() => {
    const a = anchor.current
    anchor.current = null
    const el = a && document.getElementById(`source-${a.id}`)
    if (a && el) window.scrollBy(0, el.getBoundingClientRect().top - a.top)
  }, [folded])

  function add(kind: SourceKind) {
    const id = useStore.getState().addSource(kind)
    saveOpen(id, true)
    setFresh(id)
    requestAnimationFrame(() => document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  const empty = sources.length === 0

  return (
    <div className="space-y-4 sm:space-y-5">
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-indigo-400 shadow-lg shadow-emerald-500/20">
            <Rocket className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Money plan</h2>
            <p className="text-sm text-zinc-400">How you're going to make the money. Fill in only what helps.</p>
          </div>
        </div>
        {empty ? <HowItWorks /> : <Summary sources={sources} />}
      </section>

      {sources.length > 1 && <NextUp sources={sources} />}

      {sources.map((s, i) => (
        <SourceCard
          key={s.id}
          source={s}
          index={i}
          total={sources.length}
          autoFocus={s.id === fresh}
          folded={folded}
          dragId={dragId}
          setDragId={setDragId}
        />
      ))}

      <AddPlan first={empty} onAdd={add} />
    </div>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Plus, title: 'Add a way to earn', text: 'A business, a job, freelancing, anything.' },
    { icon: Target, title: 'Set a goal for it', text: 'How much you want it to make each month.' },
    { icon: ListChecks, title: 'Write the next steps', text: 'Small things you can do this week. Tick them off.' },
  ]
  return (
    <ol className="relative mt-4 grid gap-2.5 sm:grid-cols-3">
      {steps.map((s, i) => (
        <li key={s.title} className="flex gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-sm font-bold text-indigo-200">{i + 1}</span>
          <span className="min-w-0">
            <span className="block text-sm font-medium text-zinc-100">{s.title}</span>
            <span className="block text-xs text-zinc-500">{s.text}</span>
          </span>
        </li>
      ))}
    </ol>
  )
}

/**
 * One clear answer: do my plans cover this month's "Goal to make"? The bar splits what's already coming in (plans that
 * are already earning, solid) from what's still being built (faded), one piece per plan.
 */
function Summary({ sources }: { sources: IncomeSource[] }) {
  const f = useFmt()
  const u = useAlt()
  const plan = usePlan()
  const today = currentIndex()
  const month = plan[today]
  const target = month.goal
  const total = sources.reduce((s, x) => s + x.monthlyGoal, 0)
  const earning = sources.filter((s) => s.stage === 'running').reduce((s, x) => s + x.monthlyGoal, 0)
  const scale = Math.max(target, total)
  const gap = target - total
  const pct = target > 0 ? Math.round((total / target) * 100) : null
  const shown = sources.filter((s) => s.monthlyGoal > 0)

  return (
    <div className="relative mt-5">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-zinc-500">Your plans aim for</p>
          <p className="mt-0.5 text-3xl font-bold tracking-tight tabular-nums text-white">
            {f(total)}
            <span className="text-base font-medium text-zinc-500"> a month</span>
          </p>
          <p className="text-xs tabular-nums text-zinc-500">
            {total > 0 ? (
              <>
                {f(total * 12)} a year<span className="alt-i">&nbsp;· ≈ {u(total)} a month</span>
              </>
            ) : (
              'Give a plan a monthly goal to see it here.'
            )}
          </p>
        </div>
        <div className="sm:text-right">
          <p className="text-xs font-medium text-zinc-500">Goal for {labelOf(today)}</p>
          <p className="mt-0.5 text-lg font-semibold tabular-nums text-zinc-200">{target > 0 ? f(target) : 'Not set'}</p>
          {pct !== null && <p className={`text-xs font-medium tabular-nums ${pct >= 100 ? 'text-emerald-300' : 'text-amber-200'}`}>{pct}% covered</p>}
        </div>
      </div>

      {scale > 0 && (
        <div className="relative mt-4">
          <div className="flex h-3 gap-0.5 overflow-hidden rounded-full bg-white/5">
            {shown.map((s) => (
              <div
                key={s.id}
                title={`${s.name.trim() || SOURCE_KIND[s.kind].label}: ${f(s.monthlyGoal)} (${SOURCE_STAGE[s.stage].label.toLowerCase()})`}
                className={`h-full transition-all duration-500 ${SOURCE_KIND[s.kind].bar} ${s.stage === 'running' ? '' : 'opacity-40'}`}
                style={{ width: `${(s.monthlyGoal / scale) * 100}%` }}
              />
            ))}
          </div>
          {/* Where this month's goal sits on the bar */}
          {target > 0 && total > target && (
            <span aria-hidden className="absolute -top-1 h-5 w-0.5 rounded-full bg-white/80" style={{ left: `${(target / scale) * 100}%` }} title="This month's goal" />
          )}
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
            {shown.map((s) => (
              <span key={s.id} className="inline-flex min-w-0 items-center gap-1.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${SOURCE_KIND[s.kind].bar} ${s.stage === 'running' ? '' : 'opacity-40'}`} />
                <span className="max-w-[10rem] truncate">{s.name.trim() || SOURCE_KIND[s.kind].label}</span>
                <span className="tabular-nums text-zinc-500">{f(s.monthlyGoal, true)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] pt-3 text-xs">
        <span className="text-zinc-400">
          {total > 0 && (
            <>
              <span className="font-medium text-emerald-300">{f(earning)}</span> already coming in
              {total > earning && (
                <>
                  {' · '}
                  <span className="font-medium text-zinc-200">{f(total - earning)}</span> still being built
                </>
              )}
              {target > 0 && ' · '}
            </>
          )}
          {target > 0 && (gap > 0 ? <span className="text-amber-200">{f(gap)} of the goal has no plan yet</span> : <span className="text-emerald-300">the goal is covered</span>)}
          {target <= 0 && total <= 0 && 'Set a “Goal to make” in the Planner to compare.'}
        </span>
        {target <= 0 && total > 0 && (
          <button
            onClick={() => {
              useStore.getState().setMonthField(month.key, 'goal', total)
              toast.success(`${labelOf(today)}'s goal set to ${f(total)}.`)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 px-2.5 py-1 font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            <Wand2 className="h-3.5 w-3.5" /> Use {f(total, true)} as this month's goal
          </button>
        )}
      </div>
    </div>
  )
}

/** The one thing to do next for each plan, all in one place, so there's no digging through cards. */
function NextUp({ sources }: { sources: IncomeSource[] }) {
  const { updateStep } = useStore.getState()
  const next = sources.flatMap((s) => {
    const step = s.steps.find((x) => !x.done)
    return step ? [{ s, step }] : []
  })
  // Plans with nothing to do yet get a nudge to write their first step.
  const blank = sources.filter((s) => !s.steps.length)
  const all = sources.flatMap((s) => s.steps)
  const done = all.filter((x) => x.done).length
  const openPlan = (id: string) => {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: `source-${id}` }))
    requestAnimationFrame(() => document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <section className={`${card} p-4 sm:p-5`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListChecks className="h-4 w-4 text-indigo-300" /> Next up
        </h3>
        {all.length > 0 && <span className="flex items-center gap-2 text-xs tabular-nums text-zinc-400">
          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5 sm:w-24">
            <span className="block h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${(done / all.length) * 100}%` }} />
          </span>
          {done} of {all.length} steps done
        </span>}
      </div>
      {next.length || blank.length ? (
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {next.map(({ s, step }) => {
            const k = SOURCE_KIND[s.kind]
            return (
              <li key={step.id} className="animate-fade flex min-w-0 items-center gap-2.5 rounded-xl border border-white/[0.06] bg-black/20 py-2 pl-2.5 pr-3">
                <CheckBox
                  done={false}
                  onToggle={() => {
                    updateStep(s.id, step.id, { done: true })
                    toast.success(`Done: ${step.text}`)
                  }}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-zinc-100">{step.text}</span>
                  <span className={`flex items-center gap-1 truncate text-[11px] ${k.text}`}>
                    <k.icon className="h-3 w-3 shrink-0" /> {s.name.trim() || k.label}
                  </span>
                </span>
              </li>
            )
          })}
          {blank.map((s) => {
            const k = SOURCE_KIND[s.kind]
            return (
              <li key={s.id} className="min-w-0">
                <button
                  onClick={() => openPlan(s.id)}
                  className="flex w-full min-w-0 items-center gap-2.5 rounded-xl border border-dashed border-white/10 py-2 pl-2.5 pr-3 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/[0.05]"
                >
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-white/[0.06] text-zinc-400">
                    <Plus className="h-3.5 w-3.5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-400">Write a first step</span>
                    <span className={`flex items-center gap-1 truncate text-[11px] ${k.text}`}>
                      <k.icon className="h-3 w-3 shrink-0" /> {s.name.trim() || k.label}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="rounded-xl border border-emerald-400/20 bg-emerald-500/[0.06] px-3 py-2.5 text-sm text-emerald-200">Every step is done. Add the next ones in your plans below.</p>
      )}
    </section>
  )
}

/** The kinds of plan to pick from. Shown in full the first time; after that it's one button that opens them. */
function AddPlan({ first, onAdd }: { first: boolean; onAdd: (k: SourceKind) => void }) {
  const [open, setOpen] = useState(false)
  useOpenOn('plan-add', () => setOpen(true))
  const shown = first || open

  return (
    <section id="plan-add" className={shown ? `${card} p-4 sm:p-6` : ''}>
      {shown ? (
        <>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-white">{first ? 'How will you make money?' : 'Add another way to earn'}</h3>
              <p className="mt-0.5 text-sm text-zinc-500">Pick the one that fits best. You can change it later.</p>
            </div>
            {!first && (
              <button onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {SOURCE_KINDS.map((kind) => {
              const k = SOURCE_KIND[kind]
              return (
                <button
                  key={kind}
                  onClick={() => {
                    onAdd(kind)
                    setOpen(false)
                  }}
                  className={`group flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-white/[0.07] bg-gradient-to-b ${k.glow} to-transparent p-3.5 text-left transition hover:border-white/20 hover:brightness-125 active:scale-[0.98]`}
                >
                  <span className={`grid h-9 w-9 place-items-center rounded-xl ${k.iconBg} ${k.text}`}>
                    <k.icon className="h-[18px] w-[18px]" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-zinc-100">{k.label}</span>
                    <span className="block text-xs text-zinc-500">{k.hint}</span>
                  </span>
                </button>
              )
            })}
          </div>
        </>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/15 text-sm font-medium text-zinc-300 transition hover:border-indigo-400/50 hover:bg-indigo-500/[0.06] hover:text-white"
        >
          <Plus className="h-4 w-4" /> Add another way to earn
        </button>
      )}
    </section>
  )
}

type CardProps = {
  source: IncomeSource
  index: number
  total: number
  autoFocus: boolean
  /** Shown as just its header (while plans are being reordered) */
  folded: boolean
  dragId: string | null
  setDragId: (id: string | null) => void
}

function SourceCard({ source: s, index, total, autoFocus, folded, dragId, setDragId }: CardProps) {
  const f = useFmt()
  const [open, setOpenState] = useState(() => readOpen()[s.id] ?? (total === 1 || autoFocus))
  const setOpen = (o: boolean) => {
    setOpenState(o)
    saveOpen(s.id, o)
  }
  useOpenOn(`source-${s.id}`, () => setOpen(true))
  const shown = open && !folded
  const k = SOURCE_KIND[s.kind]
  const st = SOURCE_STAGE[s.stage]
  const { updateSource, removeSource, moveSource } = useStore.getState()
  const sort = useSortable({
    id: s.id,
    index,
    ids: () => useStore.getState().sources.map((x) => x.id),
    dragId,
    setDragId,
    onMove: moveSource,
  })
  const set = (patch: Parameters<typeof updateSource>[1]) => updateSource(s.id, patch)
  const name = s.name.trim() || k.label
  const done = s.steps.filter((x) => x.done).length

  function remove() {
    const hasContent = s.name.trim() || s.monthlyGoal || s.price || s.steps.length || s.notes.trim()
    if (hasContent && !confirm(`Delete “${name}” and everything written in it?`)) return
    removeSource(s.id)
    toast.info(`Deleted “${name}”.`)
  }

  return (
    <div {...sort.zone} className="relative">
      {sort.dropAt && (
        <span
          className={`pointer-events-none absolute inset-x-4 z-10 h-1 rounded-full bg-indigo-400 shadow-[0_0_12px] shadow-indigo-400/60 ${
            sort.dropAt === 'above' ? '-top-2.5 sm:-top-3' : '-bottom-2.5 sm:-bottom-3'
          }`}
        />
      )}
      <article
        id={`source-${s.id}`}
        className={`${card} relative scroll-mt-4 overflow-hidden bg-gradient-to-b ${k.glow} to-transparent to-30% transition-[opacity,transform] duration-200 ${shown ? 'p-4 sm:p-6' : 'p-3 sm:p-4'} ${
          sort.dragging ? 'scale-[0.99] opacity-40' : ''
        }`}
      >
        {/* Header: the whole row opens and folds the plan, except the name while it's open (to type in it) */}
        <header className="flex items-center gap-3">
          {total > 1 && (
            <span
              {...sort.handle('header')}
              title="Drag to reorder"
              className="-ml-1.5 -mr-1.5 grid h-10 w-6 shrink-0 cursor-grab touch-none place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-300 active:cursor-grabbing sm:-ml-2.5 sm:text-zinc-600"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )}
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-2xl ${k.iconBg} ${k.text}`}>
            <k.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            {shown ? (
              <input
                value={s.name}
                autoFocus={autoFocus}
                onChange={(e) => set({ name: e.target.value })}
                placeholder={`Name it (${k.placeholder})`}
                aria-label="Name"
                className="w-full min-w-0 rounded-lg bg-transparent py-0.5 text-lg font-semibold text-white outline-none placeholder:font-normal placeholder:text-zinc-600 focus:bg-white/[0.03] sm:text-xl"
              />
            ) : (
              <button onClick={() => setOpen(true)} className="block w-full min-w-0 truncate text-left text-base font-semibold text-white sm:text-lg">
                {name}
              </button>
            )}
            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              {shown ? (
                <label className="relative inline-flex items-center">
                  <select
                    value={s.kind}
                    onChange={(e) => set({ kind: e.target.value as SourceKind })}
                    aria-label="Kind"
                    className={`cursor-pointer appearance-none rounded-md bg-transparent py-0.5 pr-4 font-medium outline-none hover:text-white ${k.text}`}
                  >
                    {SOURCE_KINDS.map((x) => (
                      <option key={x} value={x} className="bg-[#0e1016] text-zinc-200">
                        {SOURCE_KIND[x].label}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className={`pointer-events-none absolute right-0 h-3 w-3 ${k.text}`} />
                </label>
              ) : (
                <>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-px text-[11px] font-medium ${st.chip}`}>
                    <st.icon className="h-3 w-3" /> {st.label}
                  </span>
                  {s.monthlyGoal > 0 && <span className="font-medium tabular-nums text-zinc-300">{f(s.monthlyGoal)}/mo</span>}
                  {s.steps.length > 0 && (
                    <span className="tabular-nums">
                      {done}/{s.steps.length} steps
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            {shown && (
              <button onClick={remove} title="Delete" aria-label="Delete" className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-red-300">
                <Trash2 className="h-4 w-4" />
              </button>
            )}
            <button
              onClick={() => setOpen(!open)}
              title={open ? 'Fold up' : 'Open'}
              aria-label={open ? `Fold up ${name}` : `Open ${name}`}
              aria-expanded={shown}
              className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${shown ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </header>

        {shown && (
          <div className="animate-fade mt-5 space-y-6">
            {/* Stage and goal: the two things that matter most, side by side */}
            <div className="grid gap-5 sm:grid-cols-2">
              <Part title="Where are you at?">
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/[0.06] bg-black/20 p-1">
                  {SOURCE_STAGES.map((x) => {
                    const g = SOURCE_STAGE[x]
                    const on = s.stage === x
                    return (
                      <button
                        key={x}
                        onClick={() => set({ stage: x })}
                        aria-pressed={on}
                        className={`flex min-w-0 flex-col items-center gap-0.5 rounded-lg border px-1 py-1.5 text-[11px] font-medium transition sm:text-xs ${
                          on ? g.chip : 'border-transparent text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200'
                        }`}
                      >
                        <g.icon className="h-3.5 w-3.5" />
                        <span className="max-w-full truncate">{g.label}</span>
                      </button>
                    )
                  })}
                </div>
              </Part>
              <Goal s={s} set={set} />
            </div>

            {k.calc && <MoneyMath s={s} set={set} />}

            <Steps s={s} />

            <Notes s={s} set={set} />
          </div>
        )}
      </article>
    </div>
  )
}

function Goal({ s, set }: { s: IncomeSource; set: (p: Partial<IncomeSource>) => void }) {
  const f = useFmt()
  const u = useAlt()
  return (
    <Part title="Goal to make from this">
      <div className="flex items-center gap-2">
        <MoneyInput value={s.monthlyGoal} onChange={(v) => set({ monthlyGoal: v ?? 0 })} size="md" className="max-w-[14rem] flex-1" ariaLabel="Monthly goal" />
        <span className="text-sm text-zinc-500">a month</span>
      </div>
      <p className="mt-1.5 text-xs tabular-nums text-zinc-500">
        {s.monthlyGoal > 0 ? (
          <>
            That's <span className="font-medium text-zinc-300">{f(s.monthlyGoal * 12)}</span> a year, or {f(Math.round(s.monthlyGoal / WEEKS_PER_MONTH))} a week
            <span className="alt-i">&nbsp;· ≈ {u(s.monthlyGoal)} a month</span>
          </>
        ) : (
          'How much you want it to bring in each month.'
        )}
      </p>
    </Part>
  )
}

/** Turns a monthly goal into "how many sales is that", the easiest number to act on. Opens when asked, or once a price is in. */
function MoneyMath({ s, set }: { s: IncomeSource; set: (p: Partial<IncomeSource>) => void }) {
  const f = useFmt()
  const [asked, setAsked] = useState(false)
  const [one, many] = SOURCE_KIND[s.kind].unit
  const profit = s.price - s.costPerSale
  const need = profit > 0 && s.monthlyGoal > 0 ? Math.ceil((s.monthlyGoal + s.monthlyCosts) / profit) : null
  const breakEven = profit > 0 && s.monthlyCosts > 0 ? Math.ceil(s.monthlyCosts / profit) : null
  const n = (x: number, word: [string, string] = [one, many]) => `${x.toLocaleString('en-US')} ${x === 1 ? word[0] : word[1]}`
  const used = s.price > 0 || s.costPerSale > 0 || s.monthlyCosts > 0

  if (!used && !asked)
    return (
      <button
        onClick={() => setAsked(true)}
        className="flex w-full items-center gap-3 rounded-xl border border-dashed border-white/10 px-3 py-2.5 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/[0.05]"
      >
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-indigo-500/15 text-indigo-200">
          <Calculator className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-200">How many {many} do I need?</span>
          <span className="block text-xs text-zinc-500">Type your price and costs, and it works out the number for your goal.</span>
        </span>
      </button>
    )

  let result: ReactNode
  if (s.price <= 0) result = <span className="text-zinc-500">Type a price to see how many {many} you need.</span>
  else if (profit <= 0) result = <span className="text-red-300">Each {one} costs as much as it brings in. Raise the price or bring the cost down.</span>
  else if (need !== null)
    result = (
      <>
        <span className="text-zinc-300">
          You need about <span className="font-semibold text-white">{n(need)}</span> a month.
        </span>
        <span className="mt-2 flex flex-wrap gap-1.5">
          <Chip>{n(Math.ceil(need / WEEKS_PER_MONTH))} a week</Chip>
          <Chip>{n(Math.ceil(need / 30))} a day</Chip>
          <Chip>you keep {f(profit)} each</Chip>
        </span>
      </>
    )
  else
    result = (
      <span className="text-zinc-300">
        You keep <span className="font-semibold text-white">{f(profit)}</span> from each {one}. Set a goal above to see how many you need.
      </span>
    )

  return (
    <Part title={`How many ${many} you need`} icon={Calculator}>
      <div className="grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="grid grid-cols-3 gap-2">
          <Small label={`Price per ${one}`}>
            <MoneyInput value={s.price} onChange={(v) => set({ price: v ?? 0 })} ariaLabel={`Price per ${one}`} />
          </Small>
          <Small label={`Cost per ${one}`}>
            <MoneyInput value={s.costPerSale} onChange={(v) => set({ costPerSale: v ?? 0 })} ariaLabel={`Cost per ${one}`} />
          </Small>
          <Small label="Monthly costs">
            <MoneyInput value={s.monthlyCosts} onChange={(v) => set({ monthlyCosts: v ?? 0 })} ariaLabel="Monthly costs (rent, tools, ads)" />
          </Small>
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm leading-relaxed">
          {result}
          {breakEven !== null && profit > 0 && (
            <span className="mt-1.5 block text-xs text-zinc-500">
              The first {n(breakEven)} each month just cover your {f(s.monthlyCosts)} of monthly costs.
            </span>
          )}
        </div>
      </div>
    </Part>
  )
}

function Chip({ children }: { children: ReactNode }) {
  return <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs tabular-nums text-zinc-300">{children}</span>
}

function Steps({ s }: { s: IncomeSource }) {
  const [text, setText] = useState('')
  const [showIdeas, setShowIdeas] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const { addStep, updateStep, removeStep, moveStep } = useStore.getState()
  const done = s.steps.filter((x) => x.done).length
  const have = new Set(s.steps.map((x) => x.text.toLowerCase()))
  const ideas = SOURCE_KIND[s.kind].steps.filter((x) => !have.has(x.toLowerCase()))
  // With no steps yet the ideas are the quickest way in; after that they wait behind a button.
  const ideasShown = ideas.length > 0 && (s.steps.length === 0 || showIdeas)

  function add() {
    if (!text.trim()) return
    addStep(s.id, text)
    setText('')
    input.current?.focus()
  }

  return (
    <Part
      title="Next steps"
      icon={ListChecks}
      right={s.steps.length > 0 && <span className="text-xs tabular-nums text-zinc-400">{done} of {s.steps.length} done</span>}
    >
      {s.steps.length > 0 && (
        <>
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${(done / s.steps.length) * 100}%` }} />
          </div>
          <ul className="mb-2 space-y-1">
            {s.steps.map((x, i) => (
              <StepRow
                key={x.id}
                id={x.id}
                index={i}
                sortable={s.steps.length > 1}
                ids={() => useStore.getState().sources.find((y) => y.id === s.id)?.steps.map((y) => y.id) ?? []}
                dragId={dragId}
                setDragId={setDragId}
                onMove={(id, to) => moveStep(s.id, id, to)}
                text={x.text}
                done={x.done}
                onToggle={() => updateStep(s.id, x.id, { done: !x.done })}
                onEdit={(t) => updateStep(s.id, x.id, { text: t })}
                onRemove={() => removeStep(s.id, x.id)}
              />
            ))}
          </ul>
        </>
      )}

      <div className="flex gap-2">
        <input
          ref={input}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          placeholder="Add a step, e.g. “Ask 5 friends if they’d buy it”"
          aria-label="New step"
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
        />
        <button
          onClick={add}
          disabled={!text.trim()}
          aria-label="Add step"
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-indigo-500 text-white transition hover:brightness-110 disabled:opacity-30"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>

      {ideasShown ? (
        <div className="animate-fade mt-3">
          <p className="mb-1.5 text-[11px] text-zinc-500">Not sure where to start? Tap one to add it:</p>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((idea) => (
              <button
                key={idea}
                onClick={() => addStep(s.id, idea)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-white/15 px-2.5 py-1 text-left text-xs text-zinc-400 transition hover:border-indigo-400/50 hover:bg-indigo-500/10 hover:text-indigo-200"
              >
                <Plus className="h-3 w-3 shrink-0" /> {idea}
              </button>
            ))}
          </div>
        </div>
      ) : (
        ideas.length > 0 && (
          <button onClick={() => setShowIdeas(true)} className="mt-2 inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-zinc-500 transition hover:text-indigo-200">
            <Lightbulb className="h-3.5 w-3.5" /> Ideas for steps ({ideas.length})
          </button>
        )
      )}
    </Part>
  )
}

/** Notes take no room until there's something in them. */
function Notes({ s, set }: { s: IncomeSource; set: (p: Partial<IncomeSource>) => void }) {
  const [asked, setAsked] = useState(false)
  if (!s.notes && !asked)
    return (
      <button onClick={() => setAsked(true)} className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-sm font-medium text-zinc-500 transition hover:text-zinc-200">
        <NotebookPen className="h-4 w-4" /> Add notes
      </button>
    )
  return (
    <Part title="Notes" icon={NotebookPen}>
      <textarea
        value={s.notes}
        autoFocus={asked && !s.notes}
        onChange={(e) => set({ notes: e.target.value })}
        rows={3}
        placeholder="Anything else: who your customers are, ideas, what you need to buy, where to start…"
        className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
      />
    </Part>
  )
}

function CheckBox({ done, onToggle }: { done: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      role="checkbox"
      aria-checked={done}
      aria-label={done ? 'Mark as not done' : 'Mark as done'}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition active:scale-90 ${
        done ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-zinc-600 hover:border-emerald-400 hover:bg-emerald-400/10'
      }`}
    >
      {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </button>
  )
}

type StepProps = Parameters<typeof useSortable>[0] & {
  sortable: boolean
  text: string
  done: boolean
  onToggle: () => void
  onEdit: (t: string) => void
  onRemove: () => void
}

function StepRow({ sortable, text, done, onToggle, onEdit, onRemove, ...sortProps }: StepProps) {
  const [draft, setDraft] = useState(text)
  useEffect(() => setDraft(text), [text])
  const sort = useSortable(sortProps)

  return (
    <li
      {...sort.zone}
      className={`group relative flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.03] ${sort.dragging ? 'opacity-40' : ''} ${
        sortable ? 'sm:-ml-5' : ''
      }`}
    >
      {sort.dropAt && (
        <span className={`pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-indigo-400 ${sort.dropAt === 'above' ? '-top-[3px]' : '-bottom-[3px]'}`} />
      )}
      {sortable && (
        <span
          {...sort.handle('li')}
          title="Drag to reorder"
          className="-mr-1.5 grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center text-zinc-600 transition hover:text-zinc-300 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
        >
          <GripVertical className="h-3.5 w-3.5" />
        </span>
      )}
      <CheckBox done={done} onToggle={onToggle} />
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => (draft.trim() ? draft !== text && onEdit(draft.trim()) : setDraft(text))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Step"
        className={`min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-white/[0.04] ${done ? 'text-zinc-500 line-through' : 'text-zinc-100'}`}
      />
      <button
        onClick={onRemove}
        aria-label="Remove step"
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-600 transition hover:bg-white/5 hover:text-red-300 sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

/** A titled part of an open plan. */
function Part({ title, icon: Icon, right, children }: { title: string; icon?: typeof Check; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-end justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
          {Icon && <Icon className="h-4 w-4 text-zinc-500" />}
          {title}
        </h4>
        {right}
      </div>
      {children}
    </div>
  )
}

function Small({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      {children}
    </label>
  )
}
