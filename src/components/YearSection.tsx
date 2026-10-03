import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Wand2 } from 'lucide-react'
import { useFmt, usePlan, useStore, useUsd } from '../store'
import { END_YEAR, START_YEAR, YEARS, currentYear } from '../lib/time'
import { MonthCard } from './MonthCard'
import { GoalsSection } from './GoalsSection'
import { MoneyInput } from './MoneyInput'
import { card } from './Dashboard'
import { toast } from '../toast'

export function YearSection() {
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const start = (year - START_YEAR) * 12

  return (
    <section className="space-y-4">
      <YearTabs />
      <YearSummary />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 12 }, (_, m) => (
          <MonthCard key={start + m} index={start + m} />
        ))}
      </div>
      <div className="flex justify-center gap-3 pt-2">
        <button
          disabled={year <= START_YEAR}
          onClick={() => {
            setYear(year - 1)
            window.scrollTo({ top: document.getElementById('years')!.offsetTop - 8, behavior: 'smooth' })
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" /> {year - 1 >= START_YEAR ? year - 1 : ''}
        </button>
        <button
          disabled={year >= END_YEAR}
          onClick={() => {
            setYear(year + 1)
            window.scrollTo({ top: document.getElementById('years')!.offsetTop - 8, behavior: 'smooth' })
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-white/10 px-4 py-2 text-sm text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
        >
          {year + 1 <= END_YEAR ? year + 1 : ''} <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <GoalsSection />
    </section>
  )
}

function YearTabs() {
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const plan = usePlan()
  const f = useFmt()
  const scroller = useRef<HTMLDivElement>(null)
  const thisYear = currentYear()

  useEffect(() => {
    scroller.current
      ?.querySelector<HTMLElement>(`[data-year="${year}"]`)
      ?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' })
  }, [year])

  return (
    <div id="years" className="sticky top-0 z-30 -mx-4 bg-[#07080c]/85 px-4 py-3 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setYear(year - 1)}
          disabled={year <= START_YEAR}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
          aria-label="Previous year"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div ref={scroller} className="scrollbar-none flex flex-1 gap-1.5 overflow-x-auto">
          {YEARS.map((y) => {
            const dec = plan[(y - START_YEAR) * 12 + 11]
            const has = plan.slice((y - START_YEAR) * 12, (y - START_YEAR) * 12 + 12).some((p) => p.hasData)
            const active = y === year
            return (
              <button
                key={y}
                data-year={y}
                onClick={() => setYear(y)}
                onDragEnter={() => setYear(y)}
                onDragOver={(e) => e.preventDefault()}
                className={`relative flex min-w-[76px] shrink-0 flex-col items-center rounded-xl px-3 py-1.5 transition ${
                  active
                    ? 'bg-gradient-to-b from-indigo-500/30 to-indigo-500/10 text-white ring-1 ring-indigo-400/50'
                    : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'
                }`}
              >
                <span className="text-sm font-semibold tabular-nums">{y}</span>
                <span className={`text-[10px] tabular-nums ${has ? (active ? 'text-indigo-200' : 'text-zinc-500') : 'text-transparent'}`}>
                  {has ? f(dec.netWorth, true) : '·'}
                </span>
                {y === thisYear && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-emerald-400" title="This year" />}
              </button>
            )
          })}
        </div>
        <button
          onClick={() => setYear(year + 1)}
          disabled={year >= END_YEAR}
          className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 text-zinc-300 transition hover:bg-white/5 disabled:opacity-30"
          aria-label="Next year"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}

function YearSummary() {
  const year = useStore((s) => s.year)
  const fillYear = useStore((s) => s.fillYear)
  const plan = usePlan()
  const f = useFmt()
  const u = useUsd()
  const [open, setOpen] = useState(false)
  const [goal, setGoal] = useState<number | null>(null)
  const [budget, setBudget] = useState<number | null>(null)
  const [onlyEmpty, setOnlyEmpty] = useState(true)

  const ms = plan.slice((year - START_YEAR) * 12, (year - START_YEAR) * 12 + 12)
  const sum = (k: 'goal' | 'budget' | 'earned' | 'spent') => ms.reduce((s, m) => s + m[k], 0)
  const goalT = sum('goal'), budgetT = sum('budget'), earned = sum('earned'), spent = sum('spent')
  const end = ms[11]

  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-baseline gap-3">
          <h2 className="text-3xl font-bold tracking-tight text-white">{year}</h2>
          <span className="text-sm text-zinc-500">year at a glance</span>
        </div>
        <button
          onClick={() => setOpen((o) => !o)}
          className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition ${
            open ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:bg-white/5'
          }`}
        >
          <Wand2 className="h-4 w-4" /> Fill whole year
        </button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3 lg:grid-cols-6">
        <Mini k="Goal (year)" v={f(goalT)} usd={u(goalT, true)} />
        <Mini k="Earned (year)" v={f(earned)} usd={u(earned, true)} cls="text-emerald-300" />
        <Mini k="Budget (year)" v={f(budgetT)} usd={u(budgetT, true)} />
        <Mini k="Spent (year)" v={f(spent)} usd={u(spent, true)} cls="text-red-300" />
        <Mini k="Saved (year)" v={f(earned - spent)} usd={u(earned - spent, true)} cls={earned - spent < 0 ? 'text-red-300' : 'text-white'} />
        <Mini k={`Net worth · Dec ${year}`} v={f(end.netWorth)} usd={u(end.netWorth, true)} cls="text-indigo-200" />
      </div>

      {open && (
        <div className="animate-fade mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-white/10 bg-black/20 p-4">
          <label className="w-40">
            <span className="mb-1 block text-xs text-zinc-400">Goal every month</span>
            <MoneyInput value={goal} nullable onChange={setGoal} placeholder="e.g. 100k" />
          </label>
          <label className="w-40">
            <span className="mb-1 block text-xs text-zinc-400">Budget every month</span>
            <MoneyInput value={budget} nullable onChange={setBudget} placeholder="e.g. 50k" />
          </label>
          <label className="flex h-9 items-center gap-2 text-sm text-zinc-300">
            <input type="checkbox" checked={onlyEmpty} onChange={(e) => setOnlyEmpty(e.target.checked)} className="accent-indigo-400" />
            Only fill empty months
          </label>
          <button
            disabled={goal === null && budget === null}
            onClick={() => {
              fillYear(year, goal, budget, onlyEmpty)
              toast.success(`Applied to all 12 months of ${year}.`)
              setOpen(false)
            }}
            className="h-9 rounded-lg bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
          >
            Apply to {year}
          </button>
        </div>
      )}
    </div>
  )
}

function Mini({ k, v, usd, cls = 'text-white' }: { k: string; v: string; usd: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="truncate text-[11px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className={`truncate text-lg font-semibold tabular-nums ${cls}`}>{v}</p>
      <p className="truncate text-xs tabular-nums text-zinc-500">≈ {usd}</p>
    </div>
  )
}
