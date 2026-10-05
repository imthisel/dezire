import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Landmark, PiggyBank, Wallet } from 'lucide-react'
import { useFmt, usePlan, useStore, useUsd } from '../store'
import { lastDataIndex, portfolioAt } from '../lib/calc'
import { END_YEAR, START_YEAR, currentIndex, indexOf, labelOf } from '../lib/time'
import { CATEGORY, TREND } from '../lib/meta'
import type { Category, Trend } from '../lib/types'
import { NetWorthChart } from './NetWorthChart'
import { useIsPhone } from '../lib/useMedia'

export const card =
  'rounded-2xl border border-white/[0.07] bg-white/[0.025] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]'

export function Dashboard() {
  const plan = usePlan()
  const months = useStore((s) => s.months)
  const yearMode = useStore((s) => s.dashMode) === 'year'
  const setMode = useStore((s) => s.setDashMode)
  const year = useStore((s) => s.year)
  const setYear = useStore((s) => s.setYear)
  const f = useFmt()
  const u = useUsd()
  const phone = useIsPhone()

  // Whole plan: running totals up to the last month with anything in it.
  // Year: only the 12 months of the selected year; net worth and assets as of its December.
  const first = yearMode ? indexOf(year, 0) : 0
  const asOf = yearMode ? first + 11 : lastDataIndex(plan, currentIndex())
  const c = plan[asOf]
  const before = first > 0 ? plan[first - 1] : null
  const t = {
    goal: c.cumGoal - (before?.cumGoal ?? 0),
    budget: c.cumBudget - (before?.cumBudget ?? 0),
    earned: c.cumEarned - (before?.cumEarned ?? 0),
    spent: c.cumSpent - (before?.cumSpent ?? 0),
  }
  const left = t.earned - t.spent
  const nwChange = c.netWorth - (before?.netWorth ?? 0)
  const port = portfolioAt(months, asOf, first)
  const goalPct = t.goal > 0 ? Math.round((t.earned / t.goal) * 100) : null
  const gain = port.value - port.cost
  const yr = yearMode ? ` in ${year}` : ''

  return (
    <section id="overview" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold uppercase tracking-[0.14em] text-zinc-400">Overview</h2>
          {yearMode ? (
            <div className="flex items-center gap-1 text-sm text-zinc-500">
              <button
                onClick={() => setYear(year - 1)}
                disabled={year <= START_YEAR}
                aria-label="Previous year"
                className="-ml-1.5 grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/5 hover:text-white disabled:opacity-30"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="font-medium tabular-nums text-zinc-200">{year}</span>
              <button
                onClick={() => setYear(year + 1)}
                disabled={year >= END_YEAR}
                aria-label="Next year"
                className="grid h-7 w-7 place-items-center rounded-lg transition hover:bg-white/5 hover:text-white disabled:opacity-30"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <span className="hidden sm:inline">· January to December only</span>
            </div>
          ) : (
            <p className="text-sm text-zinc-500">
              As of <span className="text-zinc-300">{labelOf(asOf)}</span>
              <span className="hidden sm:inline"> · everything you have planned so far</span>
            </p>
          )}
        </div>
        <div className="inline-flex shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
          {(['plan', 'year'] as const).map((m) => {
            const on = (m === 'year') === yearMode
            return (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={on}
                className={`rounded-lg px-2.5 py-1.5 font-medium transition sm:px-3 ${
                  on ? 'bg-white/10 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {m === 'plan' ? 'Whole plan' : 'Year'}
              </button>
            )
          })}
        </div>
      </div>

      {phone ? (
        <PhoneStats
          netWorth={c.netWorth}
          cash={c.cash}
          assets={c.assets}
          earned={t.earned}
          spent={t.spent}
          left={left}
          goalPct={goalPct}
          budgetPct={t.budget > 0 ? t.spent / t.budget : undefined}
        />
      ) : (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat
          icon={<ArrowUpRight className="h-4 w-4" />}
          iconCls="bg-emerald-500/15 text-emerald-300"
          label={yearMode ? `Earned in ${year}` : 'Total earned'}
          value={f(t.earned)}
          usd={u(t.earned)}
          sub={goalPct !== null ? `${goalPct}% of ${f(t.goal, true)} goal${yr}` : 'Set a monthly goal to start'}
          progress={goalPct !== null ? goalPct / 100 : undefined}
        />
        <Stat
          icon={<ArrowDownRight className="h-4 w-4" />}
          iconCls="bg-red-500/15 text-red-300"
          label={yearMode ? `Spent in ${year}` : 'Total spent'}
          value={f(t.spent)}
          usd={u(t.spent)}
          sub={t.budget > 0 ? `of ${f(t.budget, true)} budgeted${yr}` : `No budgets set${yr} yet`}
          progress={t.budget > 0 ? t.spent / t.budget : undefined}
          warn
        />
        <Stat
          icon={<Wallet className="h-4 w-4" />}
          iconCls="bg-sky-500/15 text-sky-300"
          label={yearMode ? `Saved in ${year}` : 'Money left'}
          value={f(left)}
          usd={u(left)}
          valueCls={left < 0 ? 'text-red-300' : undefined}
          sub={yearMode ? `Earned − spent in ${year}` : 'Total earned − total spent'}
        />
        <Stat
          highlight
          icon={<Landmark className="h-4 w-4" />}
          iconCls="bg-indigo-500/20 text-indigo-200"
          label={yearMode ? `Net worth, end of ${year}` : 'Net worth'}
          value={f(c.netWorth)}
          usd={u(c.netWorth)}
          valueCls={c.netWorth < 0 ? 'text-red-300' : undefined}
          sub={
            yearMode
              ? `${nwChange >= 0 ? '+' : ''}${f(nwChange, true)} during ${year}`
              : `${f(c.cash, true)} cash + ${f(c.assets, true)} in assets`
          }
        />
      </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className={`${card} min-w-0 p-4 sm:p-5 lg:col-span-2`}>
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-white">Net worth over time</h3>
            <p className="hidden text-xs text-zinc-500 sm:block">Hover for details · click to open a year</p>
          </div>
          <NetWorthChart />
        </div>

        <div className={`${card} flex min-w-0 flex-col p-4 sm:p-5`}>
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h3 className="font-semibold text-white">{yearMode ? `Bought in ${year}` : 'Assets'}</h3>
            <span className="truncate text-sm tabular-nums text-zinc-300">{f(port.value)} <span className="text-zinc-500">· {u(port.value)}</span></span>
          </div>

          {port.cost === 0 ? (
            <div className="grid flex-1 place-items-center py-8 text-center text-sm text-zinc-500">
              <div>
                <PiggyBank className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                {yearMode ? `Nothing bought in ${year} yet.` : 'Items you add to a month show up here.'}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                {(Object.keys(CATEGORY) as Category[]).map((k) => {
                  const cat = CATEGORY[k]
                  const v = port.byCategory[k]
                  const share = port.value > 0 ? v.value / port.value : 0
                  return (
                    <div key={k}>
                      <div className="mb-1.5 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-2 text-zinc-300">
                          <cat.icon className="h-4 w-4 text-zinc-400" /> {cat.short}
                          <span className="text-xs text-zinc-500">×{v.count}</span>
                        </span>
                        <span className="tabular-nums text-zinc-200">{f(v.value, true)} <span className="text-xs text-zinc-500">· {u(v.value, true)}</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className="h-full rounded-full bg-indigo-400/80 transition-all" style={{ width: `${share * 100}%` }} />
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {(Object.keys(TREND) as Trend[]).map((k) => {
                  const t = TREND[k]
                  return (
                    <span key={k} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${t.border} ${t.bg} ${t.text}`}>
                      <t.icon className="h-3.5 w-3.5" /> {port.byTrend[k]} {t.label.toLowerCase()}
                    </span>
                  )
                })}
              </div>

              <div className="mt-auto flex items-center justify-between border-t border-white/[0.06] pt-4 text-sm">
                <span className="text-zinc-400">Value change vs. price paid</span>
                <span className={`font-semibold tabular-nums ${gain >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                  {gain >= 0 ? '+' : ''}
                  {f(gain)}
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </section>
  )
}

function Stat(props: {
  icon: ReactNode
  iconCls: string
  label: string
  value: string
  usd: string
  sub: string
  valueCls?: string
  progress?: number
  warn?: boolean
  highlight?: boolean
}) {
  const p = props.progress
  const barCls = props.warn && p !== undefined && p > 1 ? 'bg-red-400' : props.warn ? 'bg-amber-300/80' : 'bg-emerald-400/80'
  return (
    <div
      className={`${card} relative overflow-hidden p-5 ${
        props.highlight ? 'border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.14] via-white/[0.02] to-emerald-500/[0.08]' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${props.iconCls}`}>{props.icon}</span>
        <span className="text-sm font-medium text-zinc-400">{props.label}</span>
      </div>
      <p
        key={props.value}
        className={`animate-tick mt-3 truncate text-[28px] font-bold leading-none tracking-tight tabular-nums ${props.valueCls ?? 'text-white'}`}
      >
        {props.value}
      </p>
      <p className="mt-1.5 truncate text-sm font-medium tabular-nums text-zinc-400">≈ {props.usd} USD</p>
      <p className="mt-1.5 truncate text-xs text-zinc-500">{props.sub}</p>
      {p !== undefined && (
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${Math.min(100, p * 100)}%` }} />
        </div>
      )}
    </div>
  )
}

/** Phone layout: one big net worth card, then three compact stats in a row. */
function PhoneStats(p: {
  netWorth: number
  cash: number
  assets: number
  earned: number
  spent: number
  left: number
  goalPct: number | null
  budgetPct?: number
}) {
  const f = useFmt()
  const u = useUsd()
  return (
    <div className="space-y-2.5">
      <div
        className={`${card} relative overflow-hidden border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.16] via-white/[0.02] to-emerald-500/[0.08] p-4`}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/20 text-indigo-200">
            <Landmark className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-zinc-300">Net worth</span>
        </div>
        <p
          key={p.netWorth}
          className={`animate-tick mt-2.5 truncate text-[32px] font-bold leading-none tracking-tight tabular-nums ${p.netWorth < 0 ? 'text-red-300' : 'text-white'}`}
        >
          {f(p.netWorth)}
        </p>
        <p className="mt-1.5 truncate text-sm font-medium tabular-nums text-zinc-400">≈ {u(p.netWorth)} USD</p>
        <div className="mt-3 flex gap-2 text-xs">
          <span className="truncate rounded-full bg-white/[0.06] px-2.5 py-1 tabular-nums text-zinc-300">
            <span className="text-zinc-500">Cash</span> {f(p.cash, true)}
          </span>
          <span className="truncate rounded-full bg-white/[0.06] px-2.5 py-1 tabular-nums text-zinc-300">
            <span className="text-zinc-500">Assets</span> {f(p.assets, true)}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat icon={<ArrowUpRight className="h-3.5 w-3.5" />} iconCls="bg-emerald-500/15 text-emerald-300" label="Earned" value={f(p.earned, true)} usd={u(p.earned, true)} progress={p.goalPct !== null ? p.goalPct / 100 : undefined} />
        <MiniStat icon={<ArrowDownRight className="h-3.5 w-3.5" />} iconCls="bg-red-500/15 text-red-300" label="Spent" value={f(p.spent, true)} usd={u(p.spent, true)} progress={p.budgetPct} warn />
        <MiniStat icon={<Wallet className="h-3.5 w-3.5" />} iconCls="bg-sky-500/15 text-sky-300" label="Left" value={f(p.left, true)} usd={u(p.left, true)} valueCls={p.left < 0 ? 'text-red-300' : undefined} />
      </div>
    </div>
  )
}

function MiniStat(props: { icon: ReactNode; iconCls: string; label: string; value: string; usd: string; valueCls?: string; progress?: number; warn?: boolean }) {
  const p = props.progress
  const barCls = props.warn && p !== undefined && p > 1 ? 'bg-red-400' : props.warn ? 'bg-amber-300/80' : 'bg-emerald-400/80'
  return (
    <div className={`${card} min-w-0 p-3`}>
      <div className="flex items-center gap-1.5">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${props.iconCls}`}>{props.icon}</span>
        <span className="truncate text-xs font-medium text-zinc-400">{props.label}</span>
      </div>
      <p key={props.value} className={`animate-tick mt-2 truncate text-lg font-bold leading-tight tabular-nums ${props.valueCls ?? 'text-white'}`}>
        {props.value}
      </p>
      <p className="truncate text-[11px] tabular-nums text-zinc-500">≈ {props.usd}</p>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
        {p !== undefined && <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${Math.min(100, p * 100)}%` }} />}
      </div>
    </div>
  )
}
