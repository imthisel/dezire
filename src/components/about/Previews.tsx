import { Fragment } from 'react'
import { Car, Check, Mountain, Minus, Plane, ShoppingBag, TrendingDown, TrendingUp, Watch, type LucideIcon } from 'lucide-react'
import { SOURCE_KIND, SOURCE_STAGE } from '../../lib/meta'
import type { SourceKind, SourceStage } from '../../lib/types'

/*
 * Small pictures of the app for the About page, drawn in code (not screenshots), so they stay sharp and load instantly.
 * The amounts are examples: someone planning a very comfortable life, priced realistically in pesos.
 */

/** "₱28,500,000" */
export const peso = (n: number) => `₱${Math.round(n).toLocaleString('en-US')}`

/** "₱612M", "₱1.2B" */
export function pesoShort(n: number) {
  if (n >= 1e9) return `₱${+(n / 1e9).toFixed(1)}B`
  if (n >= 1e6) return `₱${+(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `₱${+(n / 1e3).toFixed(1)}K`
  return peso(n)
}

type Trend = 'up' | 'down' | 'flat'
const TREND: Record<Trend, { icon: LucideIcon; cls: string; label: string }> = {
  up: { icon: TrendingUp, cls: 'text-emerald-300', label: 'Appreciating' },
  down: { icon: TrendingDown, cls: 'text-rose-300', label: 'Depreciating' },
  flat: { icon: Minus, cls: 'text-sky-300', label: 'Stable' },
}

/** Kind tints, the same family the app uses, kept quiet. */
const TINT = {
  vehicle: 'bg-cyan-400/10 text-cyan-200 ring-cyan-300/15',
  status: 'bg-fuchsia-400/10 text-fuchsia-200 ring-fuchsia-300/15',
  travel: 'bg-orange-400/10 text-orange-200 ring-orange-300/15',
  property: 'bg-teal-400/10 text-teal-200 ring-teal-300/15',
} as const
type Kind = keyof typeof TINT

const card = 'rounded-[22px] border border-white/10 bg-[#0d0e12]/95 shadow-[0_40px_120px_-30px_rgba(0,0,0,0.85)] ring-1 ring-inset ring-white/[0.03] backdrop-blur-xl'

// ---- Hero: one whole month ----

type MonthItem = { name: string; kind: Kind; kindLabel: string; icon: LucideIcon; trend: Trend; rate?: string; price: number }

const JUNE_2028: MonthItem[] = [
  { name: 'Porsche 911 GT3 RS', kind: 'vehicle', kindLabel: 'Vehicle', icon: Car, trend: 'up', rate: '3%/yr', price: 28_500_000 },
  { name: 'Patek Philippe Nautilus 5711/1A', kind: 'status', kindLabel: 'Watch', icon: Watch, trend: 'up', rate: '6%/yr', price: 10_000_000 },
  { name: 'Maldives · overwater villa, 7 nights', kind: 'travel', kindLabel: 'Travel', icon: Plane, trend: 'flat', price: 2_400_000 },
  { name: 'Hermès Birkin 25', kind: 'status', kindLabel: 'Status', icon: ShoppingBag, trend: 'up', rate: '5%/yr', price: 1_600_000 },
]

/** A month as the app shows it: what to make, the budget, what's spent, running totals, and everything planned for it. */
export function MonthOverview() {
  const goal = 50_000_000
  const budget = 45_000_000
  const spent = JUNE_2028.reduce((s, i) => s + i.price, 0)
  const left = budget - spent
  const pct = spent / budget
  const earnedToDate = 612_000_000
  const spentToDate = 318_000_000
  return (
    <div className={`${card} p-4 sm:p-5`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-lg font-semibold tracking-tight text-white">June</p>
          <p className="text-xs text-zinc-400">2028</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Net worth</p>
          <p className="text-sm font-semibold tabular-nums text-brand-200">{peso(486_200_000)}</p>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2">
        <Stat label="Goal to make" value={peso(goal)} cls="border-brand-300/25 bg-brand-300/[0.07] text-brand-100" />
        <Stat label="Budget" value={peso(budget)} />
        <Stat label="Spent" value={peso(spent)} cls="border-white/[0.06] bg-white/[0.03] text-zinc-300" />
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
          <span className="text-zinc-400">
            Spent <span className="font-medium tabular-nums text-zinc-200">{pesoShort(spent)}</span> of {pesoShort(budget)}
          </span>
          <span className="font-medium tabular-nums text-zinc-200">{peso(left)} left</span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className="bar-grow h-full rounded-full bg-gradient-to-r from-brand-400 to-brand-200" style={{ width: `${pct * 100}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/25">
        <Total k="Total earned" v={pesoShort(earnedToDate)} cls="text-emerald-300" />
        <Total k="Total spent" v={pesoShort(spentToDate)} cls="text-rose-300" />
        <Total k="Money left" v={pesoShort(earnedToDate - spentToDate)} cls="text-white" />
      </div>

      <ul className="mt-3 space-y-1.5">
        {JUNE_2028.map((it) => (
          <Row key={it.name} item={it} />
        ))}
      </ul>
    </div>
  )
}

function Stat({ label, value, cls = 'border-white/10 bg-black/20 text-white' }: { label: string; value: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="mb-1 truncate text-[9.5px] font-medium uppercase tracking-wider text-zinc-400 sm:text-[10px]">{label}</p>
      <p className={`truncate rounded-lg border px-2 py-1.5 text-[11px] font-semibold tabular-nums sm:text-[12.5px] ${cls}`}>{value}</p>
    </div>
  )
}

function Total({ k, v, cls }: { k: string; v: string; cls: string }) {
  return (
    <div className="min-w-0 px-2 py-2 text-center">
      <p className="truncate text-[9.5px] uppercase tracking-wider text-zinc-400">{k}</p>
      <p className={`mt-0.5 truncate text-[13px] font-semibold tabular-nums ${cls}`}>{v}</p>
    </div>
  )
}

function Row({ item }: { item: MonthItem }) {
  const t = TREND[item.trend]
  return (
    <li className="flex items-center gap-2.5 rounded-xl border border-white/[0.06] bg-white/[0.025] p-2 transition-colors duration-300 hover:border-white/[0.12]">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ring-1 ring-inset ${TINT[item.kind]}`}>
        <item.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-semibold text-white">{item.name}</span>
        <span className={`flex items-center gap-1 text-[10.5px] ${t.cls}`}>
          <t.icon className="h-3 w-3" /> {t.label}
          {item.rate && ` · ${item.rate}`}
          <span className="text-zinc-500">· {item.kindLabel}</span>
        </span>
      </span>
      <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-white">{pesoShort(item.price)}</span>
    </li>
  )
}

/** Floating beside the month: this year's goals, two of three done. */
export function GoalsFloat() {
  const goals: [string, boolean][] = [
    ['Tithe every month', true],
    ['Run the Tokyo Marathon', true],
    ['Open the second branch', false],
  ]
  return (
    <div className={`${card} w-52 p-3.5`}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">2028 goals</p>
      {goals.map(([g, done]) => (
        <p key={g} className="mt-2 flex items-center gap-2 text-[12px]">
          <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${done ? 'bg-brand-500' : 'border border-brand-300/60'}`}>
            {done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
          </span>
          <span className={done ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-zinc-100'}>{g}</span>
        </p>
      ))}
    </div>
  )
}

/** Floating below: net worth heading up. */
export function NetWorthFloat() {
  const pts = [10, 12, 11, 16, 19, 18, 25, 31, 36, 44, 53, 64]
  const w = 150
  const h = 40
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${((i / (pts.length - 1)) * w).toFixed(1)},${(h - (p / 64) * h).toFixed(1)}`).join(' ')
  return (
    <div className={`${card} w-56 p-3.5`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Net worth by 2035</p>
      <p className="mt-1 flex items-center gap-2 text-xl font-semibold tabular-nums text-white">
        ₱1.2B
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
          <TrendingUp className="h-3 w-3" /> on track
        </span>
      </p>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-10 w-full overflow-visible" aria-hidden>
        <path d={line} fill="none" stroke="var(--color-brand-300)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="draw-line" />
      </svg>
    </div>
  )
}

// ---- Feature previews ----

/** Life goals as the app's "By age" view: a reached one, where you are now, and what's still ahead. */
export function LifeGoalsPreview() {
  const rows: { age: number | null; t: string; meta: string; done?: boolean; linked?: [number, number] }[] = [
    { age: 25, t: 'Debt-free, every peso', meta: 'Reached · March 2025', done: true },
    { age: 32, t: 'Own our home outright', meta: '2032 · 6 years left', linked: [2, 3] },
    { age: 40, t: 'A business that runs without me', meta: '2040 · 14 years left', linked: [1, 4] },
    { age: 50, t: 'Financially free', meta: '2050 · 24 years left' },
    { age: null, t: 'Take the whole family to Jerusalem', meta: 'Someday' },
  ]
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3.5">
      <p className="font-verse text-[15px] italic leading-snug text-zinc-200">“A life of faith, family and freedom.”</p>
      <ol className="relative mt-3 space-y-2 pl-9">
        <span aria-hidden className="absolute bottom-3 left-[13px] top-3 w-px bg-gradient-to-b from-violet-400/40 via-violet-400/20 to-transparent" />
        {rows.map((r, i) => (
          <Fragment key={r.t}>
          {i === 1 && (
            <li className="relative flex h-4 items-center text-[10.5px] font-semibold uppercase tracking-wider text-emerald-300">
              <span className="absolute -left-[27px] h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_0_3px_#0a0b0e,0_0_10px_1px_rgb(52_211_153/0.55)]" />
              You’re here · 26
            </li>
          )}
          <li className="relative">
            <span
              className={`absolute -left-9 top-1 grid h-[27px] w-[27px] place-items-center rounded-full border text-[10px] font-bold tabular-nums ${
                r.done
                  ? 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200'
                  : r.age === null
                    ? 'border-white/10 bg-white/[0.04] text-zinc-400'
                    : 'border-violet-400/40 bg-violet-500/15 text-violet-100'
              }`}
            >
              {r.done ? <Check className="h-3 w-3" strokeWidth={3.5} /> : (r.age ?? '∞')}
            </span>
            <div className="rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <p className={`truncate text-[12.5px] font-semibold ${r.done ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-white'}`}>{r.t}</p>
              <p className="flex items-center gap-2 text-[10.5px] text-zinc-400">
                <span className="truncate">{r.meta}</span>
                {r.linked && (
                  <span className="ml-auto flex shrink-0 items-center gap-1.5 tabular-nums text-violet-200">
                    <span className="h-1 w-8 overflow-hidden rounded-full bg-white/10">
                      <span className="block h-full rounded-full bg-violet-400" style={{ width: `${(r.linked[0] / r.linked[1]) * 100}%` }} />
                    </span>
                    {r.linked[0]}/{r.linked[1]} yearly
                  </span>
                )}
              </p>
            </div>
          </li>
          </Fragment>
        ))}
      </ol>
    </div>
  )
}

/** The Income plan: how much of this month's goal each way of earning covers, and the one thing to do next. */
export function IncomePreview() {
  const goal = 2_150_000
  const rows: { name: string; kind: SourceKind; stage: SourceStage; amount: number }[] = [
    { name: 'Specialty coffee roastery', kind: 'business', stage: 'running', amount: 1_200_000 },
    { name: 'Head of Sales', kind: 'job', stage: 'running', amount: 500_000 },
    { name: 'Brand strategy retainers', kind: 'freelance', stage: 'starting', amount: 900_000 },
  ]
  const earning = rows.filter((r) => r.stage === 'running').reduce((n, r) => n + r.amount, 0)
  const planned = rows.reduce((n, r) => n + r.amount, 0)
  const scale = Math.max(goal, planned)
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3.5">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-400">Goal this month</p>
          <p className="text-lg font-semibold tabular-nums text-white">{peso(goal)}</p>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-300">
          {Math.round((planned / goal) * 100)}% covered
        </span>
      </div>
      <div className="relative mt-2.5 flex h-2 overflow-hidden rounded-full bg-white/5">
        {rows.map((r) => (
          <span key={r.name} className={`${SOURCE_KIND[r.kind].bar} ${r.stage === 'running' ? '' : 'opacity-40'}`} style={{ width: `${(r.amount / scale) * 100}%` }} />
        ))}
        <span aria-hidden className="absolute inset-y-0 w-px bg-white/70" style={{ left: `${(goal / scale) * 100}%` }} />
      </div>
      <p className="mt-1.5 text-[10.5px] text-zinc-400">
        <span className="font-medium text-emerald-300">{pesoShort(earning)}</span> already coming in · {pesoShort(planned - earning)} on the way
      </p>
      <ul className="mt-3 space-y-1.5">
        {rows.map((r) => {
          const k = SOURCE_KIND[r.kind]
          const st = SOURCE_STAGE[r.stage]
          return (
            <li key={r.name} className="flex items-center gap-2.5 rounded-lg bg-white/[0.03] px-2.5 py-1.5">
              <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${k.iconBg}`}>
                <k.icon className={`h-3.5 w-3.5 ${k.text}`} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[12.5px] font-semibold text-white">{r.name}</span>
                <span className="block truncate text-[10.5px] text-zinc-400">{st.label}</span>
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-white">{pesoShort(r.amount)}</span>
            </li>
          )
        })}
      </ul>
      <p className="mt-2.5 flex items-center gap-2 rounded-lg border border-brand-300/20 bg-brand-300/[0.06] px-2.5 py-2 text-[11.5px] text-zinc-200">
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-brand-200">Next up</span>
        <span className="truncate">Package one retainer offer</span>
      </p>
    </div>
  )
}

/** One kind of list: vehicles, with what each is worth over time. */
export function ListsPreview() {
  const tabs = ['Vehicles', 'Property', 'Travel', 'Watches']
  const rows: { t: string; p: number; trend: Trend; rate?: string }[] = [
    { t: 'Porsche 911 GT3 RS', p: 28_500_000, trend: 'up', rate: '3%/yr' },
    { t: 'Mercedes-AMG G 63', p: 16_900_000, trend: 'down', rate: '9%/yr' },
    { t: 'Toyota Land Cruiser 300', p: 5_900_000, trend: 'down', rate: '7%/yr' },
  ]
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3">
      <div className="mb-2.5 flex gap-1 overflow-hidden">
        {tabs.map((t, i) => (
          <span
            key={t}
            className={`shrink-0 rounded-full px-2.5 py-1 text-[10.5px] font-medium ${i === 0 ? 'bg-brand-300/15 text-brand-100 ring-1 ring-inset ring-brand-300/30' : 'text-zinc-400'}`}
          >
            {t}
          </span>
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const tr = TREND[r.trend]
          return (
            <li key={r.t} className="flex items-center justify-between gap-2 rounded-lg bg-white/[0.03] px-2.5 py-2">
              <span className="min-w-0">
                <span className="block truncate text-[12.5px] font-medium text-white">{r.t}</span>
                <span className={`flex items-center gap-1 text-[10.5px] ${tr.cls}`}>
                  <tr.icon className="h-3 w-3" /> {tr.label} · {r.rate}
                </span>
              </span>
              <span className="shrink-0 text-[12.5px] font-semibold tabular-nums text-white">{pesoShort(r.p)}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** This year's goals: rings by area, then the goals themselves, each tagged with the life goal it moves. */
export function GoalsPreview() {
  const goals: { t: string; area: string; life: string; done?: boolean }[] = [
    { t: 'Pay ₱1.8M more off the house', area: 'Status', life: 'Own our home outright', done: true },
    { t: 'Hire a manager for the roastery', area: 'Status', life: 'A business that runs without me' },
    { t: 'Invest ₱150K every month', area: 'Mind', life: 'Financially free' },
    { t: 'Book the Jerusalem trip for 2027', area: 'Identity', life: 'Take the whole family to Jerusalem', done: true },
  ]
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-black/30 p-3.5">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-zinc-400">2026 goals</p>
      <GoalRings />
      <ul className="mt-3.5 space-y-1.5">
        {goals.map((g) => (
          <li key={g.t} className="flex items-start gap-2.5 rounded-lg bg-white/[0.03] px-2.5 py-2">
            <span className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full ${g.done ? 'bg-brand-500' : 'border border-brand-300/60'}`}>
              {g.done && <Check className="h-2.5 w-2.5 text-white" strokeWidth={4} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-[12.5px] font-medium ${g.done ? 'text-zinc-400 line-through decoration-zinc-600' : 'text-white'}`}>{g.t}</span>
              <span className="mt-0.5 flex min-w-0 items-center gap-1 text-[10.5px] text-violet-200">
                <Mountain className="h-3 w-3 shrink-0" /> <span className="truncate">{g.life}</span>
              </span>
            </span>
            <span className="shrink-0 text-[10.5px] text-zinc-500">{g.area}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function GoalRings() {
  const areas: [string, number, number][] = [
    ['Mind', 2, 3],
    ['Body', 3, 4],
    ['Status', 1, 2],
    ['Identity', 4, 4],
  ]
  const r = 18
  const c = 2 * Math.PI * r
  return (
    <div className="grid grid-cols-4 gap-2">
      {areas.map(([name, done, of]) => (
        <div key={name} className="flex flex-col items-center gap-1.5">
          <span className="relative grid h-12 w-12 place-items-center">
            <svg viewBox="0 0 44 44" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="22" cy="22" r={r} fill="none" stroke="rgb(255 255 255 / 0.07)" strokeWidth="3.5" />
              <circle
                cx="22"
                cy="22"
                r={r}
                fill="none"
                stroke="var(--color-brand-300)"
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={c}
                strokeDashoffset={c * (1 - done / of)}
                className="ring-draw"
                style={{ ['--c' as string]: c }}
              />
            </svg>
            <span className="text-[11px] font-semibold tabular-nums text-white">
              {done}/{of}
            </span>
          </span>
          <span className="text-[10.5px] text-zinc-400">{name}</span>
        </div>
      ))}
    </div>
  )
}

/** Three dreams becoming one monthly number. */
export function CostPreview() {
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-white/[0.07] bg-black/30 p-3.5 text-center">
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">3 dreams</p>
        <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-white">₱40.9M</p>
      </div>
      <span className="text-brand-300" aria-hidden>→</span>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] uppercase tracking-wider text-zinc-400">by June 2028</p>
        <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-white">19 months</p>
      </div>
      <span className="text-brand-300" aria-hidden>→</span>
      <div className="min-w-0 flex-1 rounded-xl bg-brand-300/10 py-1.5 ring-1 ring-inset ring-brand-300/25">
        <p className="text-[10px] uppercase tracking-wider text-brand-200">a month</p>
        <p className="mt-0.5 text-[13px] font-semibold tabular-nums text-brand-100">₱2.15M</p>
      </div>
    </div>
  )
}

