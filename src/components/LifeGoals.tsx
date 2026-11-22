import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Cake, Check, ChevronDown, Flag, GripVertical, LayoutGrid, ListOrdered, Mountain, Pencil, Plus, Quote, StickyNote, Trash2, Trophy, X } from 'lucide-react'
import { MAX_AGE, useAreaOf, useGoalAreas, useStore } from '../store'
import { areaColor, areaIcon } from '../lib/meta'
import { clampYear } from '../lib/time'
import type { Goal, GoalArea, GoalAreaDef, LifeGoal } from '../lib/types'
import { card } from './Dashboard'
import { Modal } from './Modal'
import { BirthdayInput, useBirthday } from './Birthday'
import { toast } from '../toast'
import { useSortable } from '../sortable'
import { OPEN_EVENT } from '../nav'

/*
 * Life goals: the very final ones, what you want your whole life to add up to. Above the yearly goals: each yearly goal
 * can be linked to one (see GoalModal), and shows up under it here, so a life goal you'll reach at 50 still moves every year.
 *
 * The page: a one-line life vision, then the goals by area (cards you can drag into order) or on a timeline by age
 * (worked out from your birthday). Reached ones are kept, folded away at the bottom, with the date they were reached.
 */

const EMPTY: never[] = []
const thisYear = () => new Date().getFullYear()

/** Ideas for a first life goal, with the starter area each fits (any area works if that one's gone). */
const IDEAS: { text: string; area: string }[] = [
  { text: 'Never have to worry about money again', area: 'mind' },
  { text: 'Own my home outright', area: 'status' },
  { text: 'Build a business that runs without me', area: 'mind' },
  { text: 'Stay strong and healthy into my 80s', area: 'body' },
  { text: 'Raise a close, happy family', area: 'identity' },
  { text: 'See every continent', area: 'status' },
  { text: 'Master one craft', area: 'mind' },
  { text: 'Give back more than I take', area: 'identity' },
]

// ---- Age ----

/** Your age today and the year you were born, or null with no birthday saved. */
function useAge() {
  const b = useBirthday()
  if (!b) return null
  const now = new Date()
  const before = now.getMonth() < b.month || (now.getMonth() === b.month && now.getDate() < b.day)
  return { age: now.getFullYear() - b.year - (before ? 1 : 0), born: b.year }
}
type Age = ReturnType<typeof useAge>

/** When a life goal is due: "By 40", and with a birthday its year and how long is left. */
function timing(g: LifeGoal, me: Age) {
  if (g.byAge === null) return { label: 'Someday', sub: '', late: false }
  const label = `By ${g.byAge}`
  if (!me) return { label, sub: '', late: false }
  const year = me.born + g.byAge
  const left = year - thisYear()
  const late = !g.done && g.byAge <= me.age
  const sub = late ? `${year} · past that age` : left === 0 ? `${year} · this year` : `${year} · ${left} ${left === 1 ? 'year' : 'years'} left`
  return { label, sub, late }
}

// ---- Linked yearly goals ----

type Linked = { year: number; goal: Goal }
/** Every yearly goal linked to a life goal, by life goal id (latest year first). */
function useLinked() {
  const goals = useStore((s) => s.goals)
  return useMemo(() => {
    const map = new Map<string, Linked[]>()
    for (const [y, list] of Object.entries(goals))
      for (const goal of list) if (goal.lifeId) map.set(goal.lifeId, [...(map.get(goal.lifeId) ?? []), { year: Number(y), goal }])
    for (const list of map.values()) list.sort((a, b) => b.year - a.year || Number(a.goal.done) - Number(b.goal.done))
    return map
  }, [goals])
}

// ---- The page ----

type ViewMode = 'areas' | 'timeline'
const VIEW_KEY = 'dz-life-view'
const readView = (): ViewMode => {
  try {
    return localStorage.getItem(VIEW_KEY) === 'timeline' ? 'timeline' : 'areas'
  } catch {
    return 'areas'
  }
}

export function LifeGoals() {
  const goals = useStore((s) => s.life.goals)
  const areas = useGoalAreas()
  const linked = useLinked()
  const me = useAge()
  const [view, setViewState] = useState<ViewMode>(readView)
  const setView = (v: ViewMode) => {
    setViewState(v)
    try {
      localStorage.setItem(VIEW_KEY, v)
    } catch {
      /* not remembered */
    }
  }
  const [filter, setFilter] = useState<GoalArea | 'all'>('all')
  // The filter's area may have been deleted meanwhile.
  const area = filter !== 'all' && areas.some((a) => a.id === filter) ? filter : 'all'

  const open = goals.filter((g) => !g.done)
  const reached = goals.filter((g) => g.done)
  const shown = open.filter((g) => area === 'all' || g.area === area)
  const usedAreas = areas.filter((a) => open.some((g) => g.area === a.id))
  const linkedCount = goals.reduce((n, g) => n + (linked.get(g.id)?.length ?? 0), 0)

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className={`${card} relative overflow-hidden p-4 sm:p-7`}>
        <div aria-hidden className="pointer-events-none absolute -top-28 left-1/4 h-56 w-[70%] rounded-full bg-violet-500/[0.12] blur-3xl" />
        <div className="relative flex flex-wrap items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-400 to-sky-400 shadow-lg shadow-violet-500/25">
            <Mountain className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Life goals</h2>
            <p className="text-sm text-zinc-400">The very final ones: what you want your whole life to add up to.</p>
          </div>
          {goals.length > 0 && <AddButton className="w-full justify-center sm:w-auto" />}
        </div>

        <Vision />

        {goals.length > 0 && (
          <div className="relative mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/[0.06] pt-4 text-sm">
            <Stat n={open.length} label={open.length === 1 ? 'goal ahead' : 'goals ahead'} />
            <Stat n={reached.length} label="reached" tone="text-emerald-300" />
            <Stat n={linkedCount} label={linkedCount === 1 ? 'yearly goal working toward them' : 'yearly goals working toward them'} tone="text-violet-200" />
            <span className="ml-auto">
              <AgeLine me={me} />
            </span>
          </div>
        )}
      </section>

      {goals.length === 0 ? (
        <Ideas />
      ) : (
        <>
          {open.length > 0 && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap gap-1.5" role="radiogroup" aria-label="Show area">
                {usedAreas.length > 1 && (
                  <>
                    <Chip on={area === 'all'} onClick={() => setFilter('all')}>
                      All <span className="tabular-nums text-zinc-500">{open.length}</span>
                    </Chip>
                    {usedAreas.map((a) => {
                      const Icon = areaIcon(a)
                      const n = open.filter((g) => g.area === a.id).length
                      return (
                        <Chip key={a.id} on={area === a.id} onClick={() => setFilter(a.id)}>
                          <Icon className={`h-3.5 w-3.5 ${areaColor(a).text}`} /> {a.label} <span className="tabular-nums text-zinc-500">{n}</span>
                        </Chip>
                      )
                    })}
                  </>
                )}
              </div>
              <div className="flex shrink-0 rounded-xl border border-white/[0.08] bg-white/[0.02] p-1" role="radiogroup" aria-label="Layout">
                <Seg on={view === 'areas'} onClick={() => setView('areas')} icon={LayoutGrid} label="Cards" />
                <Seg on={view === 'timeline'} onClick={() => setView('timeline')} icon={ListOrdered} label="By age" />
              </div>
            </div>
          )}

          {open.length > 0 &&
            (view === 'areas' ? <Cards goals={shown} linked={linked} me={me} /> : <Timeline goals={shown} linked={linked} me={me} />)}

          {open.length === 0 && (
            <section className={`${card} flex flex-col items-center gap-3 px-6 py-10 text-center`}>
              <Trophy className="h-8 w-8 text-amber-300" />
              <p className="text-base font-semibold text-white">Every life goal reached.</p>
              <p className="max-w-sm text-sm text-zinc-400">Time to dream bigger. What comes next?</p>
              <AddButton />
            </section>
          )}

          {reached.length > 0 && <Reached goals={reached} linked={linked} me={me} />}
        </>
      )}
    </div>
  )
}

function AddButton({ text, area, className = '' }: { text?: string; area?: GoalArea; className?: string }) {
  return (
    <button
      onClick={() => useStore.getState().openModal({ type: 'life', text, area })}
      className={`${className} inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-4 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 active:scale-[0.98]`}
    >
      <Plus className="h-4 w-4" strokeWidth={2.5} /> Add a life goal
    </button>
  )
}

function Stat({ n, label, tone = 'text-white' }: { n: number; label: string; tone?: string }) {
  return (
    <span className="text-zinc-400">
      <span className={`font-semibold tabular-nums ${tone}`}>{n}</span> {label}
    </span>
  )
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition ${
        on ? 'border-violet-400/50 bg-violet-500/15 text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
      }`}
    >
      {children}
    </button>
  )
}

function Seg({ on, onClick, icon: Icon, label }: { on: boolean; onClick: () => void; icon: typeof Flag; label: string }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition ${on ? 'bg-white/[0.09] text-white' : 'text-zinc-500 hover:text-zinc-200'}`}
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  )
}

// ---- Vision ----

/** The one sentence above everything: the life you're building. Click it to edit. */
function Vision() {
  const vision = useStore((s) => s.life.vision)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(vision)
  const box = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    if (!editing) setDraft(vision)
  }, [vision, editing])
  useEffect(() => {
    const el = box.current
    if (!editing || !el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [editing])

  function save() {
    const t = draft.trim()
    if (t !== vision) {
      useStore.getState().setLifeVision(t)
      if (t) toast.success('Life vision saved.')
    }
    setEditing(false)
  }

  if (editing)
    return (
      <div className="relative mt-5">
        <label htmlFor="life-vision" className="mb-1.5 block text-xs font-medium text-zinc-400">
          Your life, in a sentence
        </label>
        <textarea
          id="life-vision"
          ref={box}
          rows={2}
          maxLength={400}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              save()
            }
            if (e.key === 'Escape') {
              setDraft(vision)
              setEditing(false)
            }
          }}
          placeholder="e.g. A free, healthy life close to the people I love, doing work that matters."
          className="w-full resize-none rounded-2xl border border-violet-400/30 bg-black/30 px-4 py-3 font-verse text-xl leading-snug text-white outline-none transition placeholder:text-zinc-600 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20 sm:text-2xl"
        />
        <p className="mt-1.5 text-[11px] text-zinc-500">Enter to save · Esc to cancel</p>
      </div>
    )

  if (!vision)
    return (
      <button
        onClick={() => setEditing(true)}
        className="relative mt-5 flex w-full items-center gap-3 rounded-2xl border border-dashed border-white/15 px-4 py-4 text-left transition hover:border-violet-400/40 hover:bg-violet-500/[0.05]"
      >
        <Quote className="h-5 w-5 shrink-0 text-violet-300" />
        <span className="min-w-0">
          <span className="block text-sm font-medium text-zinc-200">Write your life vision</span>
          <span className="block text-xs text-zinc-500">One sentence about the life you’re building. Everything else here serves it.</span>
        </span>
      </button>
    )

  return (
    <button onClick={() => setEditing(true)} title="Click to edit" className="group relative mt-5 block w-full rounded-2xl text-left">
      <Quote aria-hidden className="absolute -left-0.5 -top-1 h-6 w-6 text-violet-400/40" />
      <p className="whitespace-pre-line pl-8 font-verse text-2xl leading-snug text-white sm:text-[1.9rem]">{vision}</p>
      <span className="mt-1 inline-flex items-center gap-1 pl-8 text-xs text-zinc-500 opacity-0 transition group-hover:opacity-100 group-focus-visible:opacity-100">
        <Pencil className="h-3 w-3" /> Edit
      </span>
    </button>
  )
}

/** "You're 24", or a way to add your birthday so goals can be placed by age. */
function AgeLine({ me }: { me: Age }) {
  const [adding, setAdding] = useState(false)
  if (me) return <span className="text-xs text-zinc-500">You’re {me.age}</span>
  if (adding)
    return (
      <span className="block w-56">
        <BirthdayInput autoFocus onDone={() => setAdding(false)} />
      </span>
    )
  return (
    <button onClick={() => setAdding(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200">
      <Cake className="h-3.5 w-3.5" /> Add your birthday to plan by age
    </button>
  )
}

// ---- Empty ----

function Ideas() {
  const areas = useGoalAreas()
  const pick = (id: string) => (areas.some((a) => a.id === id) ? id : areas[0]?.id)
  return (
    <section className={`${card} p-5 sm:p-7`}>
      <h3 className="text-base font-semibold text-white">What do you want your life to add up to?</h3>
      <p className="mt-1 max-w-2xl text-sm text-zinc-400">
        Not this year’s goals: the final ones. Picture yourself at 80, looking back. What has to be true? Start with one; tap an idea to make it yours.
      </p>
      <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {IDEAS.map((idea) => (
          <button
            key={idea.text}
            onClick={() => useStore.getState().openModal({ type: 'life', text: idea.text, area: pick(idea.area) })}
            className="group flex items-center gap-2.5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-3 text-left text-sm text-zinc-300 transition hover:border-violet-400/40 hover:bg-violet-500/[0.06] hover:text-white"
          >
            <Plus className="h-4 w-4 shrink-0 text-zinc-500 transition group-hover:text-violet-300" />
            {idea.text}
          </button>
        ))}
      </div>
      <div className="mt-5">
        <AddButton />
      </div>
    </section>
  )
}

// ---- Cards (by area, in your order) ----

function Cards({ goals, linked, me }: { goals: LifeGoal[]; linked: Map<string, Linked[]>; me: Age }) {
  const [dragId, setDragId] = useState<string | null>(null)
  const ids = goals.map((g) => g.id)
  if (!goals.length) return <p className="px-1 text-sm text-zinc-500">No life goals in this area yet.</p>
  return (
    <div className="grid items-start gap-3 sm:gap-4 md:grid-cols-2 xl:grid-cols-3">
      {goals.map((g, i) => (
        <SortableCard key={g.id} goal={g} index={i} ids={ids} dragId={dragId} setDragId={setDragId} linked={linked.get(g.id) ?? EMPTY} me={me} />
      ))}
    </div>
  )
}

function SortableCard({ goal, index, ids, dragId, setDragId, linked, me }: {
  goal: LifeGoal; index: number; ids: string[]; dragId: string | null; setDragId: (id: string | null) => void; linked: Linked[]; me: Age
}) {
  const sort = useSortable({
    id: goal.id,
    index,
    ids: () => ids,
    dragId,
    setDragId,
    onMove: (id, to) => useStore.getState().moveLifeGoal(id, to, ids),
  })
  return (
    <div {...sort.zone} className={`relative ${sort.dragging ? 'opacity-40' : ''}`}>
      {sort.dropAt && (
        <span className={`pointer-events-none absolute inset-x-3 z-10 h-1 rounded-full bg-violet-400 shadow-[0_0_12px] shadow-violet-400/60 ${sort.dropAt === 'above' ? '-top-2' : '-bottom-2'}`} />
      )}
      <LifeCard
        goal={goal}
        linked={linked}
        me={me}
        grip={
          ids.length > 1 && (
            <span
              {...sort.handle('article')}
              title="Drag to reorder"
              className="grid h-8 w-5 shrink-0 cursor-grab touch-none place-items-center text-zinc-600 transition hover:text-zinc-300 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </span>
          )
        }
      />
    </div>
  )
}

// ---- Timeline (by age) ----

function Timeline({ goals, linked, me }: { goals: LifeGoal[]; linked: Map<string, Linked[]>; me: Age }) {
  const dated = goals.filter((g) => g.byAge !== null).sort((a, b) => a.byAge! - b.byAge!)
  const someday = goals.filter((g) => g.byAge === null)
  // "You're here": before the first goal that's still ahead of your age.
  const here = me ? dated.findIndex((g) => g.byAge! > me.age) : -1

  if (!goals.length) return <p className="px-1 text-sm text-zinc-500">No life goals in this area yet.</p>
  return (
    <ol className="relative ml-4 space-y-4 border-l border-white/[0.08] pl-6 sm:ml-6 sm:pl-8">
      {dated.map((g, i) => (
        <TimelineRow key={g.id} marker={<AgeDot age={g.byAge!} late={timing(g, me).late} />} here={me && i === here ? me.age : null}>
          <LifeCard goal={g} linked={linked.get(g.id) ?? EMPTY} me={me} />
        </TimelineRow>
      ))}
      {me && here === -1 && dated.length > 0 && <Here age={me.age} />}
      {someday.length > 0 && (
        <li className="relative">
          <span className="absolute -left-[2.1rem] top-0 grid h-7 w-14 -translate-x-1/2 place-items-center rounded-full border border-white/10 bg-[#0d0e14] text-[11px] font-semibold text-zinc-400 sm:-left-[2.6rem]">
            Someday
          </span>
          <div className="grid items-start gap-3 pt-10 md:grid-cols-2">
            {someday.map((g) => (
              <LifeCard key={g.id} goal={g} linked={linked.get(g.id) ?? EMPTY} me={me} />
            ))}
          </div>
        </li>
      )}
    </ol>
  )
}

function TimelineRow({ marker, here, children }: { marker: ReactNode; here: number | null; children: ReactNode }) {
  return (
    <>
      {here !== null && <Here age={here} />}
      <li className="relative">
        <span className="absolute -left-6 top-4 -translate-x-1/2 sm:-left-8">{marker}</span>
        {children}
      </li>
    </>
  )
}

function AgeDot({ age, late }: { age: number; late: boolean }) {
  return (
    <span
      className={`grid h-9 w-9 place-items-center rounded-full border text-xs font-bold tabular-nums shadow-[0_0_0_4px_#07080c] ${
        late ? 'border-amber-400/50 bg-amber-500/15 text-amber-200' : 'border-violet-400/40 bg-violet-500/15 text-violet-100'
      }`}
    >
      {age}
    </span>
  )
}

function Here({ age }: { age: number }) {
  return (
    <li className="relative flex items-center gap-2 py-1" aria-label={`You're ${age} now`}>
      <span className="absolute -left-6 h-3 w-3 -translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_0_4px_#07080c,0_0_12px_2px_rgb(52_211_153/0.5)] sm:-left-8" />
      <span className="text-xs font-semibold uppercase tracking-wider text-emerald-300">You’re here · {age}</span>
    </li>
  )
}

// ---- One life goal ----

function LifeCard({ goal: g, linked, me, grip }: { goal: LifeGoal; linked: Linked[]; me: Age; grip?: ReactNode }) {
  const area = useAreaOf()(g.area)
  const a = areaColor(area)
  const Icon = areaIcon(area)
  const t = timing(g, me)
  const done = linked.filter((l) => l.goal.done).length
  const [flash, setFlash] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const shownLinks = showAll ? linked : linked.slice(0, 3)

  // Jumped to from a yearly goal's tag: light up for a moment.
  useEffect(() => {
    const on = (e: Event) => {
      if ((e as CustomEvent<string>).detail !== `life-${g.id}`) return
      setFlash(true)
      setTimeout(() => setFlash(false), 1600)
    }
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [g.id])

  function reach() {
    useStore.getState().updateLifeGoal(g.id, { done: !g.done })
    if (!g.done) toast.success(`Reached: “${g.text}”. Well done.`)
  }

  function addYearly() {
    useStore.getState().openModal({ type: 'goal', year: clampYear(thisYear()), area: g.area, lifeId: g.id })
  }

  return (
    <article
      id={`life-${g.id}`}
      className={`${card} group relative scroll-mt-4 overflow-hidden p-4 transition-shadow duration-500 sm:p-5 ${flash ? 'ring-2 ring-violet-400/70' : ''}`}
    >
      <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${a.stroke}, transparent)` }} />
      <div className="flex items-center gap-2">
        {grip && <span className="-ml-2 -mr-1">{grip}</span>}
        <span className={`inline-flex min-w-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium ${a.iconBg} ${a.text}`}>
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{area.label}</span>
        </span>
        <span className={`ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-medium ${t.late ? 'text-amber-200' : 'text-zinc-400'}`}>{t.label}</span>
        <div className="-mr-1.5 flex shrink-0 items-center opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          <IconBtn label="Edit" onClick={() => useStore.getState().openModal({ type: 'life', editId: g.id })}>
            <Pencil className="h-3.5 w-3.5" />
          </IconBtn>
          <IconBtn label="Delete" danger onClick={() => removeLife(g)}>
            <Trash2 className="h-3.5 w-3.5" />
          </IconBtn>
        </div>
      </div>

      <div className="mt-3 flex items-start gap-3">
        <button
          onClick={reach}
          role="checkbox"
          aria-checked={g.done}
          aria-label={g.done ? 'Mark as not reached' : 'Mark as reached'}
          title={g.done ? 'Reached · click to undo' : 'Mark as reached'}
          className={`mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full border-2 transition active:scale-90 ${
            g.done ? a.check : 'border-zinc-600 hover:border-emerald-400 hover:bg-emerald-400/10'
          }`}
        >
          {g.done && <Check className="h-4 w-4 text-black" strokeWidth={3.5} />}
        </button>
        <div className="min-w-0 flex-1">
          <h3 className={`break-words text-lg font-semibold leading-snug tracking-tight ${g.done ? 'text-zinc-300' : 'text-white'}`}>{g.text}</h3>
          {g.why && <p className="mt-1 break-words text-sm italic leading-relaxed text-zinc-400">{g.why}</p>}
          {g.done ? (
            g.doneAt && <p className="mt-1.5 text-xs text-emerald-300">Reached {new Date(g.doneAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
          ) : (
            t.sub && <p className={`mt-1.5 text-xs tabular-nums ${t.late ? 'text-amber-200/80' : 'text-zinc-500'}`}>{t.sub}</p>
          )}
        </div>
      </div>

      {/* The yearly goals working toward it */}
      {!g.done && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          {linked.length > 0 && (
            <>
              <div className="mb-2 flex items-center gap-2 text-xs text-zinc-400">
                <Flag className="h-3.5 w-3.5 text-zinc-500" />
                <span className="flex-1">
                  {linked.length} yearly {linked.length === 1 ? 'goal' : 'goals'} · <span className="tabular-nums text-zinc-300">{done} done</span>
                </span>
                <span className="h-1.5 w-16 overflow-hidden rounded-full bg-white/5">
                  <span className="block h-full rounded-full transition-all duration-500" style={{ width: `${(done / linked.length) * 100}%`, background: a.stroke }} />
                </span>
              </div>
              <ul className="space-y-1">
                {shownLinks.map(({ year, goal }) => (
                  <li key={goal.id} className="flex min-w-0 items-center gap-2 text-[13px]">
                    <span className="w-9 shrink-0 tabular-nums text-zinc-500">{year}</span>
                    <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full border ${goal.done ? 'border-emerald-400 bg-emerald-400' : 'border-zinc-600'}`}>
                      {goal.done && <Check className="h-2.5 w-2.5 text-black" strokeWidth={3.5} />}
                    </span>
                    <span className={`min-w-0 truncate ${goal.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-200'}`}>{goal.text}</span>
                    {goal.notes?.trim() && (
                      <span title={goal.notes.trim()} aria-label={`Note: ${goal.notes.trim()}`} role="img" className="shrink-0 text-zinc-500">
                        <StickyNote className="h-3 w-3" />
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {linked.length > 3 && (
                <button onClick={() => setShowAll((v) => !v)} className="mt-1 text-xs font-medium text-zinc-500 transition hover:text-zinc-200">
                  {showAll ? 'Show fewer' : `Show all ${linked.length}`}
                </button>
              )}
            </>
          )}
          <button
            onClick={addYearly}
            className={`inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-xs font-medium text-zinc-500 transition hover:bg-white/5 hover:text-zinc-200 ${linked.length ? 'mt-1.5' : ''}`}
          >
            <Plus className="h-3.5 w-3.5" /> {linked.length ? `Add a ${clampYear(thisYear())} goal for it` : `Set a ${clampYear(thisYear())} goal toward it`}
          </button>
        </div>
      )}
    </article>
  )
}

function IconBtn({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className={`grid h-8 w-8 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 ${danger ? 'hover:text-red-300' : 'hover:text-white'}`}
    >
      {children}
    </button>
  )
}

function removeLife(g: LifeGoal) {
  const { life, goals, removeLifeGoal } = useStore.getState()
  removeLifeGoal(g.id)
  toast.undo(`Deleted “${g.text}”.`, () => useStore.setState({ life, goals }))
}

// ---- Reached ----

function Reached({ goals, linked, me }: { goals: LifeGoal[]; linked: Map<string, Linked[]>; me: Age }) {
  const [open, setOpen] = useState(false)
  // Jumped to a reached one (e.g. from a yearly goal's tag): open the list.
  useEffect(() => {
    const on = (e: Event) => {
      const id = (e as CustomEvent<string>).detail
      if (goals.some((g) => `life-${g.id}` === id)) setOpen(true)
    }
    window.addEventListener(OPEN_EVENT, on)
    return () => window.removeEventListener(OPEN_EVENT, on)
  }, [goals])
  const sorted = [...goals].sort((a, b) => (b.doneAt ?? 0) - (a.doneAt ?? 0))
  return (
    <section>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.04] px-4 py-3 text-left transition hover:border-emerald-400/30"
      >
        <Trophy className="h-5 w-5 shrink-0 text-amber-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">Reached</span>
          <span className="block text-xs text-zinc-400">
            {goals.length} life {goals.length === 1 ? 'goal' : 'goals'} done. Kept here for good.
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="animate-fade mt-3 grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">
          {sorted.map((g) => (
            <LifeCard key={g.id} goal={g} linked={linked.get(g.id) ?? EMPTY} me={me} />
          ))}
        </div>
      )}
    </section>
  )
}

// ---- Add / edit ----

export function LifeGoalModal({ editId, text: presetText, area: presetArea }: { editId?: string; text?: string; area?: GoalArea }) {
  const close = useStore((s) => s.closeModal)
  const editing = useStore((s) => (editId ? s.life.goals.find((g) => g.id === editId) : undefined))
  const areas = useGoalAreas()
  const me = useAge()
  const [area, setArea] = useState<GoalArea | null>(editing?.area ?? presetArea ?? null)
  const [text, setText] = useState(editing?.text ?? presetText ?? '')
  const [why, setWhy] = useState(editing?.why ?? '')
  const [age, setAge] = useState(editing?.byAge != null ? String(editing.byAge) : '')
  const [birthday, setBirthday] = useState(false)

  const ageNum = age.trim() ? Math.round(Number(age)) : null
  const ageBad = ageNum !== null && (!Number.isFinite(ageNum) || ageNum < 1 || ageNum > MAX_AGE)
  const ready = !!area && areas.some((x) => x.id === area) && text.trim().length > 0 && !ageBad

  function save() {
    if (!ready) return
    const s = useStore.getState()
    const data = { text: text.trim(), why: why.trim(), area: area!, byAge: ageNum }
    if (editing) {
      s.updateLifeGoal(editing.id, data)
      toast.success('Life goal updated.')
    } else {
      const id = s.addLifeGoal(data)
      toast.action('Life goal added. Set this year’s goal toward it?', 'Set one', () =>
        useStore.getState().openModal({ type: 'goal', year: clampYear(thisYear()), area: area!, lifeId: id }),
      )
    }
    close()
  }

  // What the age works out to.
  let ageHint: ReactNode = 'Leave it empty for “someday”.'
  if (ageBad) ageHint = <span className="text-amber-200">Type an age from 1 to {MAX_AGE}.</span>
  else if (ageNum !== null && me) {
    const year = me.born + ageNum
    const left = year - thisYear()
    ageHint = ageNum <= me.age ? `You’re already ${me.age}: that’s ${year}, in the past.` : `That’s ${year}, ${left} ${left === 1 ? 'year' : 'years'} from now.`
  } else if (ageNum !== null && !me)
    ageHint = birthday ? (
      <span className="block w-56">
        <BirthdayInput autoFocus onDone={() => setBirthday(false)} />
      </span>
    ) : (
      <button type="button" onClick={() => setBirthday(true)} className="font-medium text-violet-300 hover:text-violet-200">
        Add your birthday to see the year
      </button>
    )

  const field =
    'w-full rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-violet-400/60 focus:ring-2 focus:ring-violet-500/20'

  return (
    <Modal
      title={editing ? 'Edit life goal' : 'Add a life goal'}
      subtitle="One of the very final goals: something you want your whole life to add up to."
      onClose={close}
      width="max-w-2xl"
      footer={
        <div className="flex items-center gap-2">
          {editing && (
            <button
              onClick={() => {
                close()
                removeLife(editing)
              }}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl px-3 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300"
            >
              <Trash2 className="h-4 w-4" /> Delete
            </button>
          )}
          <div className="ml-auto flex gap-2">
            <button onClick={close} className="h-10 rounded-xl px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!ready}
              className="h-10 rounded-xl bg-gradient-to-r from-violet-500 to-indigo-500 px-5 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {editing ? 'Save changes' : 'Add life goal'}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div>
          <label htmlFor="life-text" className="mb-1.5 block text-sm font-semibold text-zinc-200">
            The goal
          </label>
          <textarea
            id="life-text"
            rows={2}
            autoFocus
            maxLength={200}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                save()
              }
            }}
            placeholder="e.g. Never have to worry about money again"
            className={`${field} resize-none text-base`}
          />
        </div>

        <div>
          <p className="mb-1.5 text-sm font-semibold text-zinc-200">Area of life</p>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Area of life">
            {areas.map((def: GoalAreaDef) => {
              const on = area === def.id
              const c = areaColor(def)
              const Icon = areaIcon(def)
              return (
                <button
                  key={def.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setArea(def.id)}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                    on ? `${c.border} ${c.bg} text-white ring-1 ${c.ring}` : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${on ? c.text : ''}`} /> {def.label}
                </button>
              )
            })}
          </div>
          <p className="mt-1.5 text-xs text-zinc-500">The same areas as your yearly goals.</p>
        </div>

        <div className="grid gap-5 sm:grid-cols-[1fr_11rem]">
          <div>
            <label htmlFor="life-why" className="mb-1.5 flex items-center justify-between text-sm font-semibold text-zinc-200">
              Why it matters <span className="text-xs font-normal text-zinc-500">Optional</span>
            </label>
            <textarea
              id="life-why"
              rows={3}
              maxLength={400}
              value={why}
              onChange={(e) => setWhy(e.target.value)}
              placeholder="The reason you’ll read on the hard days."
              className={`${field} resize-none text-sm`}
            />
          </div>
          <div>
            <label htmlFor="life-age" className="mb-1.5 flex items-center justify-between text-sm font-semibold text-zinc-200">
              By age <span className="text-xs font-normal text-zinc-500">Optional</span>
            </label>
            <div className="relative">
              <input
                id="life-age"
                inputMode="numeric"
                value={age}
                onChange={(e) => setAge(e.target.value.replace(/\D/g, '').slice(0, 3))}
                onKeyDown={(e) => e.key === 'Enter' && save()}
                placeholder="Someday"
                aria-invalid={ageBad}
                className={`${field} h-11 pr-10 text-base tabular-nums`}
              />
              {age && (
                <button type="button" onClick={() => setAge('')} aria-label="Clear age" className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-zinc-500 hover:bg-white/10 hover:text-white">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <div className="mt-1.5 text-xs text-zinc-500">{ageHint}</div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
