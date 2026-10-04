import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, ListChecks, NotebookPen, Plus, Rocket, Target, Trash2, Wand2, X } from 'lucide-react'
import { useFmt, usePlan, useStore, useUsd } from '../store'
import { SOURCE_KIND, SOURCE_KINDS, SOURCE_STAGE, SOURCE_STAGES } from '../lib/meta'
import { currentIndex, labelOf } from '../lib/time'
import type { IncomeSource, SourceKind } from '../lib/types'
import { MoneyInput } from './MoneyInput'
import { card } from './Dashboard'
import { toast } from '../toast'

const WEEKS_PER_MONTH = 52 / 12

/** "How am I going to make the money" — one card per way of earning. Every field is optional. */
export function MoneyPlan() {
  const sources = useStore((s) => s.sources)
  const [fresh, setFresh] = useState<string | null>(null)

  function add(kind: SourceKind) {
    const id = useStore.getState().addSource(kind)
    setFresh(id)
    requestAnimationFrame(() => document.getElementById(`source-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 via-teal-400 to-indigo-400 shadow-lg shadow-emerald-500/20">
            <Rocket className="h-5 w-5 text-white" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Money plan</h2>
            <p className="text-sm text-zinc-400">How you're going to make the money.</p>
          </div>
        </div>
        <p className="relative mt-4 rounded-xl border border-white/[0.06] bg-black/20 px-3.5 py-2.5 text-sm text-zinc-400">
          <span className="font-medium text-zinc-200">Nothing here is required.</span> Fill in only what helps you. You can always come back and
          add more.
        </p>
        {sources.length === 0 ? <HowItWorks /> : <Summary sources={sources} />}
      </section>

      {sources.map((s) => (
        <SourceCard key={s.id} source={s} autoFocus={s.id === fresh} />
      ))}

      <section id="plan-add" className={`${card} p-4 sm:p-6`}>
        <h3 className="text-base font-semibold text-white">{sources.length ? 'Add another way to earn' : 'How will you make money?'}</h3>
        <p className="mt-0.5 text-sm text-zinc-500">Pick the one that fits best. You can change it later.</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SOURCE_KINDS.map((kind) => {
            const k = SOURCE_KIND[kind]
            return (
              <button
                key={kind}
                onClick={() => add(kind)}
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
      </section>
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

/** How the plans add up against this month's "Goal to make" from the Planner. */
function Summary({ sources }: { sources: IncomeSource[] }) {
  const f = useFmt()
  const u = useUsd()
  const plan = usePlan()
  const today = currentIndex()
  const month = plan[today]
  const target = month.goal
  const total = sources.reduce((s, x) => s + x.monthlyGoal, 0)
  const scale = Math.max(target, total)
  const steps = sources.flatMap((s) => s.steps)
  const done = steps.filter((s) => s.done).length
  const gap = target - total

  return (
    <div className="relative mt-4 space-y-3">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        <Tile k={`Goal for ${labelOf(today)}`} v={target > 0 ? f(target) : '—'} sub={target > 0 ? `≈ ${u(target)}` : 'Not set in the Planner'} />
        <Tile k="Your plans aim for" v={f(total)} sub={`a month · ≈ ${u(total)}`} cls="text-emerald-300" />
        <Tile k="Steps done" v={steps.length ? `${done} / ${steps.length}` : '—'} sub={steps.length ? `${Math.round((done / steps.length) * 100)}% of your to-dos` : 'Add steps below'} className="col-span-2 sm:col-span-1" />
      </div>

      {scale > 0 && (
        <div>
          <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full bg-white/5">
            {sources.map((s) =>
              s.monthlyGoal > 0 ? (
                <div
                  key={s.id}
                  title={`${s.name.trim() || SOURCE_KIND[s.kind].label}: ${f(s.monthlyGoal)}`}
                  className={`h-full transition-all duration-500 ${SOURCE_KIND[s.kind].bar}`}
                  style={{ width: `${(s.monthlyGoal / scale) * 100}%` }}
                />
              ) : null,
            )}
          </div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className={gap > 0 ? 'text-amber-200' : 'text-emerald-300'}>
              {target <= 0
                ? 'Set a “Goal to make” in the Planner to compare.'
                : gap > 0
                  ? `${f(gap)} of this month's goal has no plan yet.`
                  : 'Your plans cover this month’s goal.'}
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
      )}
    </div>
  )
}

function Tile({ k, v, sub, cls = 'text-white', className = '' }: { k: string; v: string; sub: string; cls?: string; className?: string }) {
  return (
    <div className={`min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3 ${className}`}>
      <p className="truncate text-[11px] font-medium text-zinc-500">{k}</p>
      <p className={`mt-1 truncate text-lg font-bold tabular-nums ${cls}`}>{v}</p>
      <p className="truncate text-[11px] tabular-nums text-zinc-500">{sub}</p>
    </div>
  )
}

function SourceCard({ source: s, autoFocus }: { source: IncomeSource; autoFocus: boolean }) {
  const f = useFmt()
  const u = useUsd()
  const [open, setOpen] = useState(true)
  const k = SOURCE_KIND[s.kind]
  const st = SOURCE_STAGE[s.stage]
  const { updateSource, removeSource } = useStore.getState()
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
    <article
      id={`source-${s.id}`}
      className={`${card} relative scroll-mt-4 overflow-hidden bg-gradient-to-b ${k.glow} to-transparent to-30% p-4 sm:p-6`}
    >
      {/* Header */}
      <header className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${k.iconBg} ${k.text}`}>
          <k.icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={s.name}
            autoFocus={autoFocus}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={`Name it (${k.placeholder})`}
            aria-label="Name"
            className="w-full min-w-0 rounded-lg bg-transparent py-0.5 text-lg font-semibold text-white outline-none placeholder:font-normal placeholder:text-zinc-600 focus:bg-white/[0.03] sm:text-xl"
          />
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
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
            {!open && (
              <>
                <span>·</span>
                <span>{st.label}</span>
                {s.monthlyGoal > 0 && <span>· {f(s.monthlyGoal)}/mo</span>}
                {s.steps.length > 0 && <span>· {done}/{s.steps.length} steps</span>}
              </>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            onClick={remove}
            title="Delete"
            aria-label="Delete"
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-red-300"
          >
            <Trash2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => setOpen((o) => !o)}
            title={open ? 'Fold up' : 'Open'}
            aria-label={open ? 'Fold up' : 'Open'}
            aria-expanded={open}
            className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            <ChevronDown className={`h-5 w-5 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {open && (
        <div className="animate-fade mt-5 space-y-5">
          {/* Stage */}
          <Part title="Where are you at?">
            <div className="flex flex-wrap gap-2">
              {SOURCE_STAGES.map((x) => {
                const g = SOURCE_STAGE[x]
                const on = s.stage === x
                return (
                  <button
                    key={x}
                    onClick={() => set({ stage: x })}
                    aria-pressed={on}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                      on ? g.chip : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
                    }`}
                  >
                    <g.icon className="h-3.5 w-3.5" /> {g.label}
                  </button>
                )
              })}
            </div>
          </Part>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Goal */}
            <Part title="Goal to make from this" hint="How much you want it to bring in each month.">
              <div className="flex items-center gap-2">
                <MoneyInput value={s.monthlyGoal} onChange={(v) => set({ monthlyGoal: v ?? 0 })} size="md" className="max-w-[14rem] flex-1" ariaLabel="Monthly goal" />
                <span className="text-sm text-zinc-500">a month</span>
              </div>
              {s.monthlyGoal > 0 && (
                <p className="mt-2 text-xs tabular-nums text-zinc-500">
                  That's <span className="font-medium text-zinc-300">{f(s.monthlyGoal * 12)}</span> a year · ≈ {u(s.monthlyGoal)} a month
                </p>
              )}
            </Part>

            {k.calc && <MoneyMath s={s} set={set} />}
          </div>

          <Steps s={s} />

          <Part title="Notes" icon={NotebookPen}>
            <textarea
              value={s.notes}
              onChange={(e) => set({ notes: e.target.value })}
              rows={3}
              placeholder="Anything else: who your customers are, ideas, what you need to buy, where to start…"
              className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
            />
          </Part>
        </div>
      )}
    </article>
  )
}

/** Turns a monthly goal into "how many sales is that", the easiest number to act on. */
function MoneyMath({ s, set }: { s: IncomeSource; set: (p: Partial<IncomeSource>) => void }) {
  const f = useFmt()
  const [one, many] = SOURCE_KIND[s.kind].unit
  const profit = s.price - s.costPerSale
  const need = profit > 0 && s.monthlyGoal > 0 ? Math.ceil((s.monthlyGoal + s.monthlyCosts) / profit) : null
  const breakEven = profit > 0 && s.monthlyCosts > 0 ? Math.ceil(s.monthlyCosts / profit) : null
  const n = (x: number, word: [string, string] = [one, many]) => `${x.toLocaleString('en-US')} ${x === 1 ? word[0] : word[1]}`

  let result: ReactNode
  if (s.price <= 0) result = <span className="text-zinc-500">Type a price to see how many {many} you need.</span>
  else if (profit <= 0)
    result = (
      <span className="text-red-300">
        Each {one} costs as much as it brings in. Raise the price or bring the cost down.
      </span>
    )
  else if (need !== null)
    result = (
      <>
        <span className="text-zinc-300">
          To make {f(s.monthlyGoal)} a month you need about <span className="font-semibold text-white">{n(need)}</span> a month.
        </span>
        <span className="mt-1 block text-zinc-500">
          That's around {n(Math.ceil(need / WEEKS_PER_MONTH))} a week, or {n(Math.ceil(need / 30))} a day.
        </span>
      </>
    )
  else
    result = (
      <span className="text-zinc-300">
        You keep <span className="font-semibold text-white">{f(profit)}</span> from each {one}. Set a goal to see how many you need.
      </span>
    )

  return (
    <Part title="Money math" hint={`Works out how many ${many} you need to hit your goal.`}>
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
      <p className="mt-2.5 rounded-xl border border-white/[0.06] bg-black/20 px-3 py-2.5 text-sm leading-relaxed">
        {result}
        {breakEven !== null && profit > 0 && (
          <span className="mt-1 block text-xs text-zinc-500">
            The first {n(breakEven)} each month just cover your {f(s.monthlyCosts)} of monthly costs.
          </span>
        )}
      </p>
    </Part>
  )
}

function Steps({ s }: { s: IncomeSource }) {
  const [text, setText] = useState('')
  const input = useRef<HTMLInputElement>(null)
  const { addStep, updateStep, removeStep } = useStore.getState()
  const done = s.steps.filter((x) => x.done).length
  const have = new Set(s.steps.map((x) => x.text.toLowerCase()))
  const ideas = SOURCE_KIND[s.kind].steps.filter((x) => !have.has(x.toLowerCase()))

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
      hint="Small things you can actually do. Tick them off as you go."
      right={s.steps.length > 0 && <span className="text-xs tabular-nums text-zinc-400">{done} of {s.steps.length} done</span>}
    >
      {s.steps.length > 0 && (
        <>
          <div className="mb-2 h-1 overflow-hidden rounded-full bg-white/5">
            <div className="h-full rounded-full bg-emerald-400 transition-all duration-500" style={{ width: `${(done / s.steps.length) * 100}%` }} />
          </div>
          <ul className="mb-2 space-y-1">
            {s.steps.map((x) => (
              <StepRow
                key={x.id}
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

      {ideas.length > 0 && (
        <div className="mt-3">
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
      )}
    </Part>
  )
}

function StepRow({ text, done, onToggle, onEdit, onRemove }: { text: string; done: boolean; onToggle: () => void; onEdit: (t: string) => void; onRemove: () => void }) {
  const [draft, setDraft] = useState(text)
  useEffect(() => setDraft(text), [text])

  return (
    <li className="group flex items-center gap-2.5 rounded-xl px-1.5 py-1 transition hover:bg-white/[0.03]">
      <button
        onClick={onToggle}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Mark as not done' : 'Mark as done'}
        className={`grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition ${
          done ? 'border-emerald-400 bg-emerald-400 text-black' : 'border-zinc-600 hover:border-emerald-400'
        }`}
      >
        {done && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
      </button>
      <input
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => (draft.trim() ? draft !== text && onEdit(draft.trim()) : setDraft(text))}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        aria-label="Step"
        className={`min-w-0 flex-1 rounded-md bg-transparent px-1 py-1 text-sm outline-none focus:bg-white/[0.04] ${
          done ? 'text-zinc-500 line-through' : 'text-zinc-100'
        }`}
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

/** A titled part of a plan card. Everything is optional, and says so. */
function Part({ title, hint, icon: Icon, right, children }: { title: string; hint?: string; icon?: typeof Check; right?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-end justify-between gap-2">
        <div className="min-w-0">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-zinc-200">
            {Icon && <Icon className="h-4 w-4 text-zinc-500" />}
            {title}
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">optional</span>
          </h4>
          {hint && <p className="text-xs text-zinc-500">{hint}</p>}
        </div>
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
