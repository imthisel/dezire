import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, Eraser, Home, Plus, RotateCcw, Star, StickyNote, Target, X } from 'lucide-react'
import { overLimitIds, valueAfter } from '../../lib/calc'
import { DEFAULT_KINDS, TREND, kindColor, kindIcon } from '../../lib/meta'
import type { Item, MonthData } from '../../lib/types'
import { DemoItemModal, type PlaceChoice } from './DemoDialogs'
import { DEMO_MONTHS, monthLabel, nextId, placedOf, useDemo } from './demoStore'

/*
 * A playable copy of the Overview on the About page: November 2027 and the two months after, with the same maths as the app
 * (net worth goal → goal to make, budget, spent, running totals, items that don't fit shown in red, assets that gain or lose value).
 * It lives only in this page's memory: nothing is saved anywhere, and leaving or refreshing the page starts it over.
 */

const NAMES = DEMO_MONTHS.map((m) => m.name)

// ---- Money ----

const abs = (n: number) => Math.round(Math.abs(n)).toLocaleString('en-US')
/** "₱1,250,000", "−₱40,000" */
export const money = (n: number) => `${n < -0.5 ? '−' : ''}₱${abs(n)}`
/** "₱1.3M", "₱850K" */
export function moneyShort(n: number) {
  const a = Math.abs(n)
  const sign = n < -0.5 ? '−' : ''
  if (a >= 1e9) return `${sign}₱${+(a / 1e9).toFixed(2)}B`
  if (a >= 1e6) return `${sign}₱${+(a / 1e6).toFixed(2)}M`
  if (a >= 1e3) return `${sign}₱${+(a / 1e3).toFixed(1)}K`
  return money(n)
}

// ---- Kinds and trends (as in the app) ----

const kindOf = (id: string) => DEFAULT_KINDS.find((k) => k.id === id) ?? DEFAULT_KINDS[3]

// ---- The maths (the app's computeAll, for three months) ----

export type Calc = { goal: number; fromNetWorth: boolean; spent: number; cumEarned: number; cumSpent: number; cash: number; available: number; assets: number; netWorth: number }

export function compute(months: MonthData[]): Calc[] {
  const n = months.length
  const assets = new Array<number>(n).fill(0)
  months.forEach((m, i) => m.items.forEach((it) => {
    for (let t = i; t < n; t++) assets[t] += valueAfter(it, t - i)
  }))
  let cumEarned = 0
  let cumSpent = 0
  return months.map((m, i) => {
    const spent = m.items.reduce((s, it) => s + it.price, 0)
    // A net worth goal decides the goal to make: whatever is still missing by the end of the month.
    const goal = m.netWorthGoal !== null ? Math.max(0, Math.round(m.netWorthGoal - (cumEarned - cumSpent - spent + assets[i]))) : m.goal
    cumEarned += goal
    cumSpent += spent
    const cash = cumEarned - cumSpent
    return { goal, fromNetWorth: m.netWorthGoal !== null, spent, cumEarned, cumSpent, cash, available: cash + spent, assets: assets[i], netWorth: cash + assets[i] }
  })
}

// ---- The playground ----

/** `part`: the three months to plan, or the summary of them ("at a glance"); the About page shows them as two tabs. */
export function TryOverview({ part = 'plan' }: { part?: 'plan' | 'glance' }) {
  const months = useDemo((s) => s.months)
  const update = useDemo((s) => s.update)
  const calc = useMemo(() => compute(months), [months])
  const strip = useRef<HTMLDivElement>(null)
  const [page, setPage] = useState(0)
  const onStrip = () => {
    const el = strip.current
    const first = el?.children[0] as HTMLElement | undefined
    if (!el || !first) return
    setPage(Math.max(0, Math.min(months.length - 1, Math.round(el.scrollLeft / (first.offsetWidth + 12)))))
  }

  if (part === 'glance') return <Summary months={months} calc={calc} />
  return (
    <div>
      <Toolbar onReset={useDemo.getState().reset} onClear={useDemo.getState().clear} />
      <div
        ref={strip}
        onScroll={onStrip}
        className="scrollbar-none -mx-5 mt-4 flex snap-x snap-mandatory scroll-px-5 gap-3 overflow-x-auto px-5 pb-1 sm:-mx-8 sm:scroll-px-8 sm:gap-4 sm:px-8 sm:pb-4 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0 lg:pb-0"
      >
        {months.map((m, i) => (
          <SimMonth key={i} i={i} m={m} c={calc[i]} update={update} />
        ))}
      </div>
      {/* Which month you're on, when they're side by side in a strip */}
      <div className="mt-3 flex justify-center gap-1.5 sm:hidden" role="tablist" aria-label="Months">
        {months.map((_, i) => (
          <button
            key={i}
            role="tab"
            aria-selected={page === i}
            aria-label={monthLabel(i)}
            onClick={() => {
              const el = strip.current?.children[i] as HTMLElement | undefined
              strip.current?.scrollTo({ left: (el?.offsetLeft ?? 0) - 20, behavior: 'smooth' })
            }}
            className="grid h-6 place-items-center px-0.5"
          >
            <span className={`block h-1.5 rounded-full transition-all duration-300 ${page === i ? 'w-5 bg-brand-300' : 'w-1.5 bg-white/20'}`} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function Toolbar({ onReset, onClear }: { onReset: () => void; onClear: () => void }) {
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.07] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm text-zinc-400">
        <span className="font-medium text-zinc-200">Change anything.</span> Nothing here is saved: leave or refresh the page and it starts over.
      </p>
      <div className="flex shrink-0 gap-2">
        <button onClick={onReset} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white">
          <RotateCcw className="h-3.5 w-3.5" /> Example
        </button>
        <button onClick={onClear} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-white/10 px-3.5 text-sm text-zinc-300 transition hover:border-white/20 hover:text-white">
          <Eraser className="h-3.5 w-3.5" /> Start blank
        </button>
      </div>
    </div>
  )
}

/** A number box that shows commas as you type. `nullable`: empty means "not set". */
export function MoneyField({ value, onChange, label, nullable, placeholder = '0', tone = '' }: {
  value: number | null; onChange: (v: number | null) => void; label: string; nullable?: boolean; placeholder?: string; tone?: string
}) {
  return (
    <label className={`flex h-9 min-w-0 items-center rounded-lg border border-white/10 bg-black/25 px-2 transition focus-within:border-brand-400/70 focus-within:ring-2 focus-within:ring-brand-400/25 ${tone}`}>
      <span className="text-[12px] text-zinc-500">₱</span>
      <input
        data-plain
        aria-label={label}
        inputMode="numeric"
        value={value ? value.toLocaleString('en-US') : ''}
        placeholder={placeholder}
        onChange={(e) => {
          const raw = e.target.value.replace(/\D/g, '')
          if (raw === '') return onChange(nullable ? null : 0)
          onChange(Math.min(1e12, Number(raw)))
        }}
        className="w-full min-w-0 bg-transparent pl-1 text-[13px] font-semibold tabular-nums text-white outline-none placeholder:font-normal placeholder:text-zinc-600"
      />
    </label>
  )
}

function SimMonth({ i, m, c, update }: { i: number; m: MonthData; c: Calc; update: (i: number, patch: Partial<MonthData>) => void }) {
  const [notesOpen, setNotesOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const editing = editId ? m.items.find((x) => x.id === editId) : undefined
  const over = overLimitIds(m, c.available)
  const left = m.budget - c.spent
  const pct = m.budget > 0 ? c.spent / m.budget : 0
  const bar = pct > 1 ? 'bg-rose-400' : pct >= 0.85 ? 'bg-amber-300' : 'bg-emerald-400'
  const name = NAMES[i]
  const months = useDemo((s) => s.months)
  const places = placesFor(months, i)
  const propName = (id?: string) => (id ? months.flatMap((x) => x.items).find((x) => x.id === id && x.category === 'property')?.name : undefined)
  const hasNotes = !!m.notes?.trim()
  const nwShort = m.netWorthGoal !== null ? m.netWorthGoal - c.netWorth : 0

  return (
    <article className="@container flex w-full shrink-0 snap-start flex-col rounded-2xl border border-white/[0.08] bg-white/[0.025] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] sm:w-[60%] lg:w-auto">
      <header className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold tracking-tight text-white">{name}</h3>
          <p className="text-xs text-zinc-500">
            {DEMO_MONTHS[i].year}
            {i === 0 && <span className="ml-1.5 rounded-full bg-emerald-400/15 px-1.5 py-px text-[9.5px] font-semibold uppercase tracking-wider text-emerald-300">This month</span>}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2">
          <button
            onClick={() => setNotesOpen((o) => !o)}
            aria-expanded={notesOpen}
            className={`relative mt-0.5 inline-flex h-8 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition ${
              notesOpen ? 'border-amber-200/30 bg-amber-200/10 text-amber-100' : 'border-white/10 text-zinc-400 hover:text-amber-100'
            }`}
          >
            <StickyNote className="h-3.5 w-3.5" /> <span className="hidden @[19rem]:inline">Notes</span>
            {hasNotes && !notesOpen && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-amber-300 ring-2 ring-[#0b0c10]" />}
          </button>
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Net worth</p>
            <p key={Math.round(c.netWorth)} className={`animate-tick text-sm font-semibold tabular-nums ${c.netWorth < 0 ? 'text-rose-300' : 'text-brand-200'}`}>
              {money(c.netWorth)}
            </p>
          </div>
        </div>
      </header>

      {notesOpen && (
        <div className="animate-fade mb-3 rounded-xl border border-amber-200/15 bg-amber-200/[0.035] p-2.5">
          <textarea
            data-plain
            value={m.notes ?? ''}
            onChange={(e) => update(i, { notes: e.target.value.slice(0, 500) })}
            rows={2}
            aria-label={`Notes for ${name}`}
            placeholder="Reminders, plans, what you’re believing for…"
            className="block w-full resize-none bg-transparent text-sm leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-500"
          />
        </div>
      )}

      {/* Net worth goal: when set, it works out the goal to make */}
      <div className={`mb-2 flex items-center gap-2.5 rounded-xl border p-2 pl-2.5 ${m.netWorthGoal !== null ? 'border-brand-400/30 bg-brand-500/[0.08]' : 'border-white/[0.06] bg-black/15'}`}>
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${m.netWorthGoal !== null ? 'bg-brand-500/20 text-brand-200' : 'bg-white/5 text-zinc-500'}`}>
          <Target className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-400">Net worth goal</p>
          <p className={`truncate text-[11px] ${m.netWorthGoal === null ? 'text-zinc-500' : nwShort > 0.5 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {m.netWorthGoal === null
              ? 'Optional · by month’s end'
              : c.goal === 0 && c.netWorth >= m.netWorthGoal
                ? 'Already there'
                : `Needs ${moneyShort(c.goal)} made`}
          </p>
        </div>
        <div className="w-32 shrink-0 sm:w-36">
          <MoneyField value={m.netWorthGoal} nullable placeholder="Not set" onChange={(v) => update(i, { netWorthGoal: v })} label={`${name} net worth goal`} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 @[22rem]:grid-cols-3">
        <Field label="Goal to make">
          {c.fromNetWorth ? (
            <p
              title="Worked out from the net worth goal. Clear it to type your own."
              className="flex h-9 items-center truncate rounded-lg border border-brand-400/25 bg-brand-500/[0.08] px-2 text-[13px] font-semibold tabular-nums text-brand-100"
            >
              {money(c.goal)}
            </p>
          ) : (
            <MoneyField value={m.goal} onChange={(v) => update(i, { goal: v ?? 0 })} label={`${name} goal to make`} />
          )}
        </Field>
        <Field label="Budget">
          <MoneyField value={m.budget} onChange={(v) => update(i, { budget: v ?? 0 })} label={`${name} budget`} />
        </Field>
        <Field label="Spent" hint="this month" className="col-span-2 @[22rem]:col-span-1">
          <p className={`flex h-9 items-center truncate rounded-lg border border-white/[0.06] bg-white/[0.03] px-2 text-[13px] font-semibold tabular-nums ${left < 0 && m.budget > 0 ? 'text-rose-300' : 'text-zinc-300'}`}>
            {money(c.spent)}
          </p>
        </Field>
      </div>

      <div className="mt-3">
        <div className="mb-1.5 flex items-center justify-between gap-3 text-xs">
          <span className="text-zinc-400">
            Spent <span className="font-medium tabular-nums text-zinc-200">{money(c.spent)}</span>
            {m.budget > 0 && <span className="text-zinc-500"> of {money(m.budget)}</span>}
          </span>
          {m.budget > 0 ? (
            <span className={`font-medium tabular-nums ${left < 0 ? 'text-rose-300' : 'text-zinc-300'}`}>{left < 0 ? `${money(-left)} over` : `${money(left)} left`}</span>
          ) : (
            <span className="text-zinc-500">No budget yet</span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full transition-all duration-500 ${bar}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
      </div>

      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20">
        <Total k="Total earned" v={moneyShort(c.cumEarned)} cls="text-emerald-300" />
        <Total k="Total spent" v={moneyShort(c.cumSpent)} cls="text-rose-300" />
        <Total k="Money left" v={moneyShort(c.cash)} cls={c.cash < 0 ? 'text-rose-300' : 'text-white'} />
      </div>

      <ul className="mt-3 flex flex-1 flex-col gap-1.5">
        {m.items.map((it) => (
          <SimItem
            key={it.id}
            it={it}
            keptAt={it.category === 'vehicle' ? propName(it.propertyId) : undefined}
            over={over.has(it.id)}
            onEdit={() => setEditId(it.id)}
            onRemove={() => update(i, { items: m.items.filter((x) => x.id !== it.id) })}
            onStar={() => update(i, { items: m.items.map((x) => (x.id === it.id ? { ...x, favorite: !x.favorite } : x)) })}
          />
        ))}
        {!m.items.length && !adding && (
          <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/[0.08] py-4 text-center text-xs text-zinc-500">No items yet · add one</li>
        )}
      </ul>

      {over.size > 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-[11.5px] text-rose-300">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> Doesn’t fit this month’s money. Raise the goal or budget, or move it.
        </p>
      )}

      <button
        onClick={() => setAdding(true)}
        className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-200 transition hover:border-brand-400/40 hover:bg-brand-500/10 hover:text-white"
      >
        <Plus className="h-4 w-4" /> Add item
      </button>
      {adding && (
        <DemoItemModal
          month={monthLabel(i)}
          budget={m.budget}
          spent={c.spent}
          available={c.available}
          places={places}
          onClose={() => setAdding(false)}
          onAdd={(it) => update(i, { items: [...m.items, { ...it, id: nextId(), createdAt: Date.now() }] })}
        />
      )}
      {editing && (
        <DemoItemModal
          month={monthLabel(i)}
          budget={m.budget}
          spent={c.spent - editing.price}
          available={c.available}
          places={places.filter((p) => p.id !== editing.id)}
          editing={{ ...editing, notes: editing.notes ?? '' }}
          onClose={() => setEditId(null)}
          onAdd={(it) => update(i, { items: m.items.map((x) => (x.id === editing.id ? { ...x, ...it, links: it.links, propertyId: it.propertyId } : x)) })}
        />
      )}
    </article>
  )
}

function Field({ label, hint, className = '', children }: { label: string; hint?: string; className?: string; children: ReactNode }) {
  return (
    <div className={`min-w-0 ${className}`}>
      <p className="mb-1 flex items-center justify-between gap-1 truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {hint && <span className="normal-case tracking-normal text-zinc-600">{hint}</span>}
      </p>
      {children}
    </div>
  )
}

function Total({ k, v, cls }: { k: string; v: string; cls: string }) {
  return (
    <div className="min-w-0 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className={`truncate text-sm font-semibold tabular-nums ${cls}`}>{v}</p>
    </div>
  )
}

/** The properties in the plan, for "Where is it kept?": the ones bought by month `i` are yours, the rest not yet. */
export function placesFor(months: MonthData[], i: number): PlaceChoice[] {
  return placedOf(months, 'property').map((p) => ({ id: p.item.id, name: p.item.name, price: p.item.price, month: monthLabel(p.month), owned: p.month <= i, sameMonth: p.month === i }))
}

function SimItem({ it, keptAt, over, onEdit, onRemove, onStar }: { it: Item; keptAt?: string; over: boolean; onEdit: () => void; onRemove: () => void; onStar: () => void }) {
  const k = kindOf(it.category)
  const KindIcon = kindIcon(k)
  const kc = kindColor(k)
  const t = TREND[it.trend]
  return (
    <li className={`group/item relative flex items-center gap-2 overflow-hidden rounded-xl border py-2 pl-2.5 pr-1 transition @[18rem]:gap-2.5 ${over ? 'border-rose-500/40 bg-rose-500/[0.08] hover:border-rose-400/60' : it.favorite ? 'border-brand-400/30 bg-brand-500/[0.07]' : 'border-white/[0.06] bg-white/[0.025] hover:border-white/15 hover:bg-white/[0.05]'}`}>
      {it.favorite && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-amber-200 to-amber-400" />}
      <button type="button" onClick={onEdit} aria-label={`Edit ${it.name}`} className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg text-left">
      <span title={k.label} className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${kc.soft} ${kc.text}`}>
        <KindIcon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className={`truncate text-sm font-medium ${over ? 'text-rose-200' : 'text-zinc-100'}`}>{it.name}</span>
          {(it.notes?.trim() || it.links?.length) && <StickyNote aria-label="Has notes" className="h-3 w-3 shrink-0 text-amber-200/80" />}
        </span>
        <span title={it.notes?.trim() || undefined} className={`flex items-center gap-1 truncate text-[11px] ${t.text}`}>
          <t.icon className="h-3 w-3 shrink-0" /> {t.label}
          {it.trend !== 'stable' && it.rate > 0 && <span className="opacity-80">· {it.rate}%/yr</span>}
          <span className="truncate text-zinc-500">· {k.label}</span>
        </span>
        {keptAt && (
          <span className="flex items-center gap-1 truncate text-[11px] text-teal-200/80">
            <Home className="h-3 w-3 shrink-0" /> <span className="truncate">Kept at {keptAt}</span>
          </span>
        )}
      </span>
      </button>
      <button
        onClick={onStar}
        aria-pressed={!!it.favorite}
        aria-label={it.favorite ? `Remove ${it.name} from Favorites` : `Add ${it.name} to Favorites`}
        className={`hidden h-8 w-8 shrink-0 place-items-center rounded-lg transition active:scale-90 @[18rem]:grid ${it.favorite ? 'text-amber-300 hover:bg-amber-300/10' : 'text-zinc-600 hover:bg-white/10 hover:text-amber-300'}`}
      >
        <Star className={`h-4 w-4 ${it.favorite ? 'fill-amber-300' : ''}`} strokeWidth={it.favorite ? 2 : 1.75} />
      </button>
      <span className={`shrink-0 text-right text-sm font-semibold tabular-nums ${over ? 'text-rose-300' : 'text-zinc-100'}`}>{money(it.price)}</span>
      <button
        onClick={onRemove}
        aria-label={`Remove ${it.name}`}
        className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </li>
  )
}

// ---- The summary: totals and two charts ----

function Summary({ months, calc }: { months: MonthData[]; calc: Calc[] }) {
  const last = calc[calc.length - 1]
  const stats = [
    { k: `Net worth by ${DEMO_MONTHS[2].short}`, v: money(last.netWorth), cls: last.netWorth < 0 ? 'text-rose-300' : 'text-brand-200' },
    { k: 'Total earned', v: money(last.cumEarned), cls: 'text-emerald-300' },
    { k: 'Total spent', v: money(last.cumSpent), cls: 'text-rose-300' },
    { k: 'Money left', v: money(last.cash), cls: last.cash < 0 ? 'text-rose-300' : 'text-white' },
    { k: 'What you own is worth', v: money(last.assets), cls: 'text-white' },
  ]
  return (
    <div className="rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-5 sm:p-6">
      <h3 className="font-semibold text-white">Your next three months, at a glance</h3>
      <p className="mt-1 text-sm text-zinc-400">Change anything under Wants and these follow.</p>
      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => (
          <div key={s.k} className="min-w-0">
            <dt className="truncate text-[11px] uppercase tracking-wider text-zinc-400">{s.k}</dt>
            <dd key={s.v} className={`animate-tick mt-1 truncate text-lg font-semibold tabular-nums ${s.cls}`}>{s.v}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <NetWorthLine calc={calc} goals={months.map((m) => m.netWorthGoal)} />
        <SpentBars months={months} calc={calc} />
      </div>
    </div>
  )
}

function NetWorthLine({ calc, goals }: { calc: Calc[]; goals: (number | null)[] }) {
  const values = [0, ...calc.map((c) => c.netWorth)]
  const labels = ['Start', ...DEMO_MONTHS.map((m) => m.short)]
  const all = [...values, ...goals.filter((g): g is number => g !== null)]
  const max = Math.max(1, ...all)
  const min = Math.min(0, ...all)
  const w = 520
  const h = 180
  const pad = 26
  const x = (i: number) => pad + (i / (values.length - 1)) * (w - pad * 2)
  const y = (v: number) => 18 + (1 - (v - min) / (max - min || 1)) * (h - 46)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const desc = calc.map((c, i) => `${labels[i + 1]} ${money(c.netWorth)}`).join(', ')
  return (
    <figure className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <figcaption className="flex items-center justify-between text-sm">
        <span className="font-medium text-zinc-200">Net worth</span>
        <span className="flex items-center gap-1.5 text-[11px] text-zinc-400">
          <span className="h-0 w-4 border-t border-dashed border-amber-300/80" /> goal
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-44 w-full overflow-visible" role="img" aria-label={`Net worth by month: ${desc}`}>
        <defs>
          <linearGradient id="try-nw" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--color-brand-500)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && <line x1={pad} x2={w - pad} y1={y(0)} y2={y(0)} stroke="rgb(255 255 255 / 0.12)" strokeDasharray="3 4" />}
        <path d={`${line} L${x(values.length - 1)},${h - 28} L${x(0)},${h - 28} Z`} fill="url(#try-nw)" className="transition-all duration-500" />
        <path d={line} fill="none" stroke="var(--color-brand-400)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
        {goals.map((g, i) =>
          g === null ? null : <line key={i} x1={x(i + 1) - 16} x2={x(i + 1) + 16} y1={y(g)} y2={y(g)} stroke="rgb(252 211 77 / 0.85)" strokeWidth="2" strokeDasharray="4 3" />,
        )}
        {values.map((v, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(v)} r={i ? 5 : 3.5} fill={i ? 'var(--color-brand-300)' : 'rgb(255 255 255 / 0.3)'} />
            {i > 0 && (
              <text x={x(i)} y={y(v) - 12} textAnchor="middle" className="fill-white text-[13px] font-semibold tabular-nums">
                {moneyShort(v)}
              </text>
            )}
            <text x={x(i)} y={h - 6} textAnchor="middle" className="fill-zinc-400 text-[12px]">
              {labels[i]}
            </text>
          </g>
        ))}
      </svg>
    </figure>
  )
}

function SpentBars({ months, calc }: { months: MonthData[]; calc: Calc[] }) {
  const max = Math.max(1, ...months.map((m) => m.budget), ...calc.map((c) => c.spent), ...calc.map((c) => c.goal))
  const pct = (v: number) => `${Math.max(v > 0 ? 2 : 0, (v / max) * 100)}%`
  return (
    <figure className="rounded-2xl border border-white/[0.06] bg-black/20 p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span className="font-medium text-zinc-200">Each month</span>
        <span className="flex gap-3 text-[11px] text-zinc-400">
          <Legend cls="bg-emerald-400/70">To make</Legend>
          <Legend cls="bg-white/20">Budget</Legend>
          <Legend cls="bg-brand-400">Spent</Legend>
        </span>
      </figcaption>
      <div className="mt-3 grid h-44 grid-cols-3 gap-4">
        {months.map((m, i) => {
          const c = calc[i]
          const overBudget = m.budget > 0 && c.spent > m.budget
          return (
            <div key={i} className="flex min-w-0 flex-col">
              <div
                className="flex flex-1 items-end justify-center gap-1.5"
                role="img"
                aria-label={`${NAMES[i]}: goal to make ${money(c.goal)}, budget ${money(m.budget)}, spent ${money(c.spent)}`}
              >
                <Bar h={pct(c.goal)} cls="bg-emerald-400/70" title={`To make ${money(c.goal)}`} />
                <Bar h={pct(m.budget)} cls="bg-white/20" title={`Budget ${money(m.budget)}`} />
                <Bar h={pct(c.spent)} cls={overBudget ? 'bg-rose-400' : 'bg-brand-400'} title={`Spent ${money(c.spent)}`} />
              </div>
              <p className="mt-2 text-center text-[12px] text-zinc-400">{NAMES[i].slice(0, 3)}</p>
            </div>
          )
        })}
      </div>
    </figure>
  )
}

function Bar({ h, cls, title }: { h: string; cls: string; title: string }) {
  return <span title={title} className={`w-full max-w-7 rounded-t-md transition-all duration-500 ${cls}`} style={{ height: h }} />
}

function Legend({ cls, children }: { cls: string; children: ReactNode }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`h-2 w-2 rounded-sm ${cls}`} /> {children}
    </span>
  )
}
