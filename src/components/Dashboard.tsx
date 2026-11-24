import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Eye, EyeOff, Landmark, PiggyBank, Wallet } from 'lucide-react'
import { useFmt, useKinds, usePlan, useStore, useAlt } from '../store'
import { lastDataIndex, portfolioAt } from '../lib/calc'
import { END_YEAR, START_YEAR, currentIndex, indexOf, labelOf } from '../lib/time'
import { TREND, kindColor, kindIcon } from '../lib/meta'
import type { Trend } from '../lib/types'
import { NetWorthChart } from './NetWorthChart'
import { ChartToggle, useChartHidden } from './ChartToggle'
import { useIsPhone } from '../lib/useMedia'
import { ModeStrip } from './Modes'
import { BlurToggle, Blurred } from './Blur'
import { FitText } from './FitText'

/** The whole overview (totals, chart, assets) folded away with the eye button; kept with the other hidden cards (remembered). */
const OVERVIEW = 'overview'
/** The n-th card to rise back into place when the overview is shown again (see .ov-in in index.css). */
const riseStyle = (i: number) => ({ '--i': i }) as CSSProperties

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
  const u = useAlt()
  const phone = useIsPhone()
  const chartHidden = useChartHidden('networth')
  const assetsHidden = useChartHidden('assets')
  const overviewHidden = useChartHidden(OVERVIEW)
  // Just shown again: the cards rise back in, one after another.
  const [rising, setRising] = useState(false)
  const riseTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  useEffect(() => () => clearTimeout(riseTimer.current), [])
  function toggleOverview() {
    const showing = overviewHidden
    useStore.setState({ peeking: null })
    useStore.getState().toggleChart(OVERVIEW)
    clearTimeout(riseTimer.current)
    setRising(showing)
    if (showing) riseTimer.current = setTimeout(() => setRising(false), 1200)
  }
  const eyeText = overviewHidden ? 'Show the overview' : 'Hide the overview'
  // One folded away: it becomes a slim bar and the other takes the full width. Both: two slim bars side by side.
  const wide = chartHidden !== assetsHidden ? 'lg:col-span-3' : ''

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
  const kinds = useKinds()
  const goalPct = t.goal > 0 ? Math.round((t.earned / t.goal) * 100) : null
  const gain = port.value - port.cost
  const yr = yearMode ? ` in ${year}` : ''

  return (
    <section id="overview" className="space-y-4">
      <ModeStrip />
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
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={toggleOverview}
            aria-pressed={overviewHidden}
            aria-expanded={!overviewHidden}
            aria-controls="overview-body"
            aria-label={eyeText}
            title={eyeText}
            className={`grid h-[42px] w-[42px] shrink-0 place-items-center rounded-xl border transition ${
              overviewHidden ? 'border-indigo-400/30 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25' : 'border-white/10 bg-white/[0.03] text-zinc-400 hover:border-white/20 hover:text-white'
            }`}
          >
            {overviewHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
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
      </div>

      {overviewHidden && (
        <button
          type="button"
          onClick={toggleOverview}
          className={`${card} animate-fade flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm text-zinc-400 transition hover:border-white/15 hover:text-zinc-200`}
        >
          <span className="flex items-center gap-2">
            <EyeOff className="h-4 w-4 shrink-0" /> Overview hidden
          </span>
          <span className="inline-flex items-center gap-1.5 font-medium text-indigo-200">
            <Eye className="h-4 w-4" /> Show
          </span>
        </button>
      )}

      <Fold id="overview-body" open={!overviewHidden} className={rising ? 'ov-in' : ''}>
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
          i={0}
          blurId="w-earned"
          icon={<ArrowUpRight className="h-4 w-4" />}
          iconCls="bg-emerald-500/15 text-emerald-300"
          label={yearMode ? `Earned in ${year}` : 'Total earned'}
          value={f(t.earned)}
          usd={u(t.earned)}
          sub={goalPct !== null ? `${goalPct}% of ${f(t.goal, true)} goal${yr}` : 'Set a monthly goal to start'}
          progress={goalPct !== null ? goalPct / 100 : undefined}
        />
        <Stat
          i={1}
          blurId="w-spent"
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
          i={2}
          blurId="w-left"
          icon={<Wallet className="h-4 w-4" />}
          iconCls="bg-sky-500/15 text-sky-300"
          label={yearMode ? `Saved in ${year}` : 'Money left'}
          value={f(left)}
          usd={u(left)}
          valueCls={left < 0 ? 'text-red-300' : undefined}
          sub={yearMode ? `Earned − spent in ${year}` : 'Total earned − total spent'}
        />
        <Stat
          i={3}
          highlight
          blurId="w-networth"
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
        <div style={riseStyle(4)} className={`ov-item ${card} min-w-0 ${chartHidden ? 'px-4 py-2.5 sm:px-5' : 'p-4 sm:p-5'} ${wide || 'lg:col-span-2'}`}>
          <div className={`flex items-center justify-between gap-3 ${chartHidden ? '' : 'mb-3'}`}>
            <div className="flex min-w-0 items-baseline gap-2.5">
              <h3 className="shrink-0 font-semibold text-white">Net worth over time</h3>
              {chartHidden && <p className="truncate text-xs text-zinc-500">Chart hidden</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {!chartHidden && <p className="hidden text-xs text-zinc-500 md:block">Hover for details · click to open a year</p>}
              {!chartHidden && <BlurToggle id="w-chart" name="the net worth chart" label />}
              <ChartToggle id="networth" name="net worth chart" />
            </div>
          </div>
          {!chartHidden && (
            <Blurred id="w-chart" name="Net worth over time" hide className="animate-fade">
              <NetWorthChart />
            </Blurred>
          )}
        </div>

        <div style={riseStyle(5)} className={`ov-item ${card} flex min-w-0 flex-col ${assetsHidden ? 'px-4 py-2.5 sm:px-5' : 'p-4 sm:p-5'} ${wide}`}>
          <div className={`flex items-center justify-between gap-3 ${assetsHidden ? '' : 'mb-4'}`}>
            <h3 className="shrink-0 font-semibold text-white">{yearMode ? `Bought in ${year}` : 'Assets'}</h3>
            <div className="flex min-w-0 items-center gap-3">
              <Blurred id="w-assets" name="Assets" hint={false} className="min-w-0">
                <span className="block truncate text-sm tabular-nums text-zinc-300">{f(port.value)} <span className="alt-i text-zinc-500">· {u(port.value)}</span></span>
              </Blurred>
              <BlurToggle id="w-assets" name={yearMode ? `bought in ${year}` : 'assets'} label />
              <ChartToggle id="assets" name={yearMode ? `bought in ${year}` : 'assets'} show="Show" />
            </div>
          </div>

          {assetsHidden ? null : port.cost === 0 ? (
            <div className="animate-fade grid flex-1 place-items-center py-8 text-center text-sm text-zinc-500">
              <div>
                <PiggyBank className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                {yearMode ? `Nothing bought in ${year} yet.` : 'Items you add to a month show up here.'}
              </div>
            </div>
          ) : (
            <Blurred id="w-assets" name={yearMode ? `Bought in ${year}` : 'Assets'} className="animate-fade flex flex-1 flex-col" innerClassName="flex flex-1 flex-col">
              <div className={`space-y-3 ${chartHidden ? 'lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-3 lg:space-y-0' : ''}`}>
                {kinds.map((k) => {
                  const Icon = kindIcon(k)
                  const v = port.byCategory[k.id] ?? { value: 0, count: 0 }
                  const share = port.value > 0 ? v.value / port.value : 0
                  return (
                    <div key={k.id}>
                      {/* The name takes all the room the amount leaves, and wraps to a second line before it gets cut off. */}
                      <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
                        <span className="flex min-w-0 flex-1 items-start gap-2 text-zinc-300" title={`${k.label} ×${v.count}`}>
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${kindColor(k).text}`} />
                          <span className="min-w-0 break-words leading-snug line-clamp-2">
                            {k.label}
                            <span className="ml-1.5 whitespace-nowrap text-xs text-zinc-500">×{v.count}</span>
                          </span>
                        </span>
                        <span className="shrink-0 whitespace-nowrap leading-snug tabular-nums text-zinc-200">{f(v.value, true)} <span className="alt-i text-xs text-zinc-500">· {u(v.value, true)}</span></span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
                        <div className={`h-full rounded-full ${kindColor(k).bar} opacity-80 transition-all`} style={{ width: `${share * 100}%` }} />
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
            </Blurred>
          )}
        </div>
      </div>
      </Fold>
    </section>
  )
}

/**
 * Folds its content away (height and opacity together) and back. Clipped only while folded or folding, so shadows and the
 * chart's tooltips aren't cut off once it's open. Folded, nothing inside can be reached or read out.
 */
function Fold({ id, open, className = '', children }: { id?: string; open: boolean; className?: string; children: ReactNode }) {
  const [settled, setSettled] = useState(open)
  useEffect(() => {
    if (!open) setSettled(false)
  }, [open])
  return (
    <div
      id={id}
      aria-hidden={!open || undefined}
      inert={!open || undefined}
      onTransitionEnd={(e) => e.target === e.currentTarget && e.propertyName === 'grid-template-rows' && open && setSettled(true)}
      className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}
    >
      <div className={`min-h-0 space-y-4 ${settled ? '' : 'overflow-hidden'} ${className}`}>{children}</div>
    </div>
  )
}

function Stat(props: {
  /** Its place when the overview rises back in */
  i: number
  blurId: string
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
  const altCode = useStore((s) => s.currency.alt.code)
  return (
    <div
      style={riseStyle(props.i)}
      className={`ov-item ${card} group/blur relative overflow-hidden p-5 ${
        props.highlight ? 'border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.14] via-white/[0.02] to-emerald-500/[0.08]' : ''
      }`}
    >
      <div className="flex items-center gap-2.5">
        <span className={`grid h-7 w-7 place-items-center rounded-lg ${props.iconCls}`}>{props.icon}</span>
        <span className="min-w-0 truncate text-sm font-medium text-zinc-400">{props.label}</span>
        <BlurToggle id={props.blurId} name={props.label} className="-my-1 -mr-1.5 ml-auto" />
      </div>
      <Blurred id={props.blurId} name={props.label}>
        <FitText key={props.value} min={16} className={`animate-tick mt-3 pb-px text-[28px] font-bold leading-none tracking-tight tabular-nums ${props.valueCls ?? 'text-white'}`}>
          {props.value}
        </FitText>
        <p className="alt mt-1.5 truncate text-sm font-medium tabular-nums text-zinc-400">≈ {props.usd} {altCode}</p>
        <p className="mt-1.5 truncate text-xs text-zinc-500">{props.sub}</p>
        {p !== undefined && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-white/5">
            <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${Math.min(100, p * 100)}%` }} />
          </div>
        )}
      </Blurred>
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
  const u = useAlt()
  const altCode = useStore((s) => s.currency.alt.code)
  return (
    <div className="space-y-2.5">
      <div
        style={riseStyle(0)}
        className={`ov-item ${card} group/blur relative overflow-hidden border-indigo-400/30 bg-gradient-to-br from-indigo-500/[0.16] via-white/[0.02] to-emerald-500/[0.08] p-4`}
      >
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-indigo-500/20 text-indigo-200">
            <Landmark className="h-4 w-4" />
          </span>
          <span className="text-sm font-medium text-zinc-300">Net worth</span>
          <BlurToggle id="w-networth" name="Net worth" className="-my-1 -mr-1 ml-auto" />
        </div>
        <Blurred id="w-networth" name="Net worth">
          <FitText
            key={p.netWorth}
            min={18}
            className={`animate-tick mt-2.5 pb-px text-[32px] font-bold leading-none tracking-tight tabular-nums ${p.netWorth < 0 ? 'text-red-300' : 'text-white'}`}
          >
            {f(p.netWorth)}
          </FitText>
          <p className="alt mt-1.5 truncate text-sm font-medium tabular-nums text-zinc-400">≈ {u(p.netWorth)} {altCode}</p>
          <div className="mt-3 flex min-w-0 gap-2 text-xs">
            <span className="min-w-0 truncate rounded-full bg-white/[0.06] px-2.5 py-1 tabular-nums text-zinc-300">
              <span className="text-zinc-500">Cash</span> {f(p.cash, true)}
            </span>
            <span className="min-w-0 truncate rounded-full bg-white/[0.06] px-2.5 py-1 tabular-nums text-zinc-300">
              <span className="text-zinc-500">Assets</span> {f(p.assets, true)}
            </span>
          </div>
        </Blurred>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        <MiniStat i={1} blurId="w-earned" icon={<ArrowUpRight className="h-3.5 w-3.5" />} iconCls="bg-emerald-500/15 text-emerald-300" label="Earned" value={f(p.earned, true)} usd={u(p.earned, true)} progress={p.goalPct !== null ? p.goalPct / 100 : undefined} />
        <MiniStat i={2} blurId="w-spent" icon={<ArrowDownRight className="h-3.5 w-3.5" />} iconCls="bg-red-500/15 text-red-300" label="Spent" value={f(p.spent, true)} usd={u(p.spent, true)} progress={p.budgetPct} warn />
        <MiniStat i={3} blurId="w-left" icon={<Wallet className="h-3.5 w-3.5" />} iconCls="bg-sky-500/15 text-sky-300" label="Left" value={f(p.left, true)} usd={u(p.left, true)} valueCls={p.left < 0 ? 'text-red-300' : undefined} />
      </div>
    </div>
  )
}

function MiniStat(props: { i: number; blurId: string; icon: ReactNode; iconCls: string; label: string; value: string; usd: string; valueCls?: string; progress?: number; warn?: boolean }) {
  const p = props.progress
  const barCls = props.warn && p !== undefined && p > 1 ? 'bg-red-400' : props.warn ? 'bg-amber-300/80' : 'bg-emerald-400/80'
  return (
    <div style={riseStyle(props.i)} className={`ov-item ${card} group/blur relative min-w-0 overflow-hidden p-3`}>
      {/* Icon and hide button on top, the label on its own line: three cards side by side leave no room for all three in a row. */}
      <div className="flex items-center justify-between gap-1">
        <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md ${props.iconCls}`}>{props.icon}</span>
        <BlurToggle id={props.blurId} name={props.label} small className="-my-1 -mr-1.5" />
      </div>
      <p className="mt-1.5 truncate text-xs font-medium text-zinc-400">{props.label}</p>
      <Blurred id={props.blurId} name={props.label} compact>
        <FitText key={props.value} min={12} className={`animate-tick mt-0.5 text-lg font-bold leading-tight tabular-nums ${props.valueCls ?? 'text-white'}`}>
          {props.value}
        </FitText>
        <p className="alt truncate text-[11px] tabular-nums text-zinc-500">≈ {props.usd}</p>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/5">
          {p !== undefined && <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${Math.min(100, p * 100)}%` }} />}
        </div>
      </Blurred>
    </div>
  )
}
