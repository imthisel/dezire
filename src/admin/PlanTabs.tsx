import { useMemo, useState } from 'react'
import { CalendarDays, Check, CheckCircle2, Circle, Copy, Download, Gem, NotebookPen, Receipt, Repeat, Rocket, Search, Star, Target } from 'lucide-react'
import type { ExpenseCategory, GoalAreaDef, ItemKind, TaskKind } from '../lib/types'
import { SOURCE_KIND, SOURCE_STAGE, TREND, UNKNOWN_AREA, UNKNOWN_KIND, areaColor, areaIcon, kindColor, kindIcon } from '../lib/meta'
import { fmt } from '../lib/money'
import { MONTHS, MONTHS_SHORT, labelOfKey } from '../lib/time'
import { NO_CATEGORY, catColor, catIcon, longDate, todayKey } from '../lib/expenses'
import { UNKNOWN_TASK_KIND, fmtRange, fmtTime, isEvent, repeatLabel, taskColor } from '../lib/tasks'
import { download, dreamsOf, type Plan } from './data'
import { Card, Empty, Segmented, cx } from './ui'

const byId = <T extends { id: string }>(list: T[], fallback: T) => {
  const m = new Map(list.map((x) => [x.id, x]))
  return (id: string) => m.get(id) ?? fallback
}

// ---------------------------------------------------------------- dreams & items

export function DreamsTab({ plan }: { plan: Plan }) {
  const [modeId, setModeId] = useState(plan.modes[0].id)
  const [kind, setKind] = useState('all')
  const [q, setQ] = useState('')
  const [favs, setFavs] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  const kindOf = useMemo(() => byId<ItemKind>(plan.kinds, UNKNOWN_KIND), [plan.kinds])
  const sym = plan.currency.main.symbol
  const mode = plan.modes.find((m) => m.id === modeId) ?? plan.modes[0]
  const all = useMemo(() => dreamsOf(mode), [mode])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return all.filter((d) => (kind === 'all' || d.category === kind) && (!favs || d.favorite) && (!t || d.name.toLowerCase().includes(t) || d.notes?.toLowerCase().includes(t)))
  }, [all, kind, favs, q])

  const years = useMemo(() => {
    const g = new Map<number, typeof list>()
    for (const d of list) g.set(d.year, [...(g.get(d.year) ?? []), d])
    return [...g.entries()]
  }, [list])

  const byKind = useMemo(() => {
    const c = new Map<string, number>()
    for (const d of all) c.set(d.category, (c.get(d.category) ?? 0) + 1)
    return c
  }, [all])

  const total = list.reduce((s, d) => s + d.price, 0)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        {plan.modes.length > 1 && <Segmented value={modeId} onChange={setModeId} options={plan.modes.map((m) => ({ id: m.id, label: m.name }))} />}
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search their dreams…"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0e1016]/80 pl-10 pr-3 text-sm text-white outline-none placeholder:text-zinc-600 focus:border-indigo-400/50"
          />
        </div>
        <button
          onClick={() => setFavs((f) => !f)}
          className={cx('inline-flex h-10 items-center gap-2 rounded-xl border px-3.5 text-sm font-medium transition', favs ? 'border-amber-400/50 bg-amber-500/15 text-amber-100' : 'border-white/10 text-zinc-400 hover:text-white')}
        >
          <Star className={cx('h-4 w-4', favs && 'fill-amber-300 text-amber-300')} /> Favorites
        </button>
      </div>

      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        <KindChip on={kind === 'all'} onClick={() => setKind('all')} label="All kinds" count={all.length} />
        {plan.kinds.map((k) => {
          const Icon = kindIcon(k)
          return byKind.get(k.id) ? (
            <KindChip key={k.id} on={kind === k.id} onClick={() => setKind(k.id)} label={k.label} count={byKind.get(k.id)!} icon={<Icon className={cx('h-3.5 w-3.5', kindColor(k).text)} />} />
          ) : null
        })}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Num label="Showing" value={list.length.toLocaleString()} />
        <Num label="Total price" value={fmt(total, sym, true)} />
        <Num label="Favorites" value={list.filter((d) => d.favorite).length} />
        <Num label="Years with dreams" value={years.length} />
      </div>

      {years.length === 0 ? (
        <Card>
          <Empty icon={Gem} title={all.length ? 'Nothing matches those filters' : 'No dreams listed yet'} />
        </Card>
      ) : (
        years.map(([year, items]) => (
          <Card
            key={year}
            pad={false}
            title={<span className="text-base">{year}</span>}
            action={
              <span className="text-xs tabular-nums text-zinc-500">
                {items.length} item{items.length === 1 ? '' : 's'} · <span className="text-zinc-300">{fmt(items.reduce((s, d) => s + d.price, 0), sym)}</span>
              </span>
            }
          >
            <ul className="divide-y divide-white/[0.05]">
              {items.map((d) => {
                const k = kindOf(d.category)
                const Icon = kindIcon(k)
                const tr = TREND[d.trend]
                const id = `${d.key}-${d.id}`
                return (
                  <li key={id}>
                    <button onClick={() => setOpen(open === id ? null : id)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.025]">
                      <span className="w-9 shrink-0 text-xs font-medium uppercase text-zinc-500">{MONTHS_SHORT[d.month]}</span>
                      <span className={cx('grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white', kindColor(k).grad)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-medium text-zinc-100">{d.name}</span>
                          {d.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" aria-label="Favorite" />}
                          {d.notes && <NotebookPen className="h-3 w-3 shrink-0 text-zinc-500" aria-label="Has notes" />}
                        </span>
                        <span className="block truncate text-xs text-zinc-500">{k.label}</span>
                      </span>
                      <span className={cx('hidden items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium sm:inline-flex', tr.bg, tr.text)}>
                        <tr.icon className="h-3 w-3" />
                        {tr.label}
                        {d.trend !== 'stable' && d.rate ? ` ${d.rate}%/yr` : ''}
                      </span>
                      <span className="w-28 shrink-0 text-right text-sm font-semibold tabular-nums text-white">{fmt(d.price, sym)}</span>
                    </button>
                    {open === id && (
                      <div className="animate-fade border-t border-white/[0.04] bg-black/20 px-5 py-3 pl-[4.25rem] text-[13px] leading-relaxed text-zinc-400">
                        <p>
                          Planned for <span className="text-zinc-200">{MONTHS[d.month]} {d.year}</span>
                          {d.createdAt ? ` · added ${new Date(d.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}
                        </p>
                        {d.notes ? <p className="mt-1.5 whitespace-pre-wrap text-zinc-300">{d.notes}</p> : <p className="mt-1.5 text-zinc-600">No notes.</p>}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  )
}

function KindChip({ on, onClick, label, count, icon }: { on: boolean; onClick: () => void; label: string; count: number; icon?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition', on ? 'border-white/25 bg-white/[0.09] text-white' : 'border-white/[0.07] text-zinc-400 hover:text-white')}
    >
      {icon}
      {label}
      <span className="tabular-nums text-zinc-500">{count}</span>
    </button>
  )
}

function Num({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-[#0e1016]/70 px-4 py-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-white">{value}</p>
    </div>
  )
}

// ---------------------------------------------------------------- goals

export function GoalsTab({ plan }: { plan: Plan }) {
  const areaOf = useMemo(() => byId<GoalAreaDef>(plan.goalAreas, UNKNOWN_AREA), [plan.goalAreas])
  const years = Object.keys(plan.goals).sort()
  if (!years.length)
    return (
      <Card>
        <Empty icon={Target} title="No goals set yet" />
      </Card>
    )
  return (
    <div className="space-y-4">
      {years.map((year) => {
        const goals = plan.goals[year]
        const done = goals.filter((g) => g.done).length
        const pct = Math.round((done / goals.length) * 100)
        const areas = plan.goalAreas.map((a) => a.id).concat([''])
        const grouped = areas
          .map((id) => ({ area: areaOf(id), list: goals.filter((g) => (id ? g.area === id : !plan.goalAreas.some((a) => a.id === g.area))) }))
          .filter((x) => x.list.length)
        return (
          <Card
            key={year}
            title={<span className="text-base">{year}</span>}
            action={
              <span className="flex items-center gap-3">
                <span className="hidden h-1.5 w-28 overflow-hidden rounded-full bg-white/[0.07] sm:block">
                  <span className="block h-full rounded-full bg-gradient-to-r from-indigo-400 to-emerald-400" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-xs tabular-nums text-zinc-400">
                  {done}/{goals.length} done
                </span>
              </span>
            }
          >
            <div className="grid gap-5 md:grid-cols-2">
              {grouped.map(({ area, list }) => {
                const Icon = areaIcon(area)
                const c = areaColor(area)
                return (
                  <div key={area.id || 'none'}>
                    <p className={cx('mb-2 flex items-center gap-2 text-[13px] font-semibold', c.text)}>
                      <span className={cx('grid h-6 w-6 place-items-center rounded-lg', c.iconBg)}>
                        <Icon className="h-3.5 w-3.5" />
                      </span>
                      {area.label}
                    </p>
                    <ul className="space-y-1.5">
                      {list.map((g) => (
                        <li key={g.id} className="flex items-start gap-2.5 rounded-lg px-1 py-1">
                          {g.done ? <CheckCircle2 className="mt-px h-4 w-4 shrink-0 text-emerald-400" aria-label="Done" /> : <Circle className="mt-px h-4 w-4 shrink-0 text-zinc-600" aria-label="Not done" />}
                          <span className={cx('text-sm leading-snug', g.done ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-200')}>{g.text}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )
              })}
            </div>
          </Card>
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------- money plans

export function MoneyTab({ plan }: { plan: Plan }) {
  const sym = plan.currency.main.symbol
  if (!plan.sources.length)
    return (
      <Card>
        <Empty icon={Rocket} title="No money plans yet" text="Ways of making money they’re planning (a business, a job, freelancing…)." />
      </Card>
    )
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {plan.sources.map((s) => {
        const k = SOURCE_KIND[s.kind] ?? SOURCE_KIND.other
        const st = SOURCE_STAGE[s.stage] ?? SOURCE_STAGE.idea
        const steps = Array.isArray(s.steps) ? s.steps : []
        const doneSteps = steps.filter((x) => x.done).length
        return (
          <Card key={s.id}>
            <div className="flex items-start gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
                <k.icon className="h-5 w-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[15px] font-semibold text-white">{s.name || 'Untitled'}</p>
                <p className="text-xs text-zinc-500">{k.label}</p>
              </div>
              <span className={cx('inline-flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium', st.chip)}>
                <st.icon className="h-3 w-3" /> {st.label}
              </span>
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
              <MoneyFact label="Monthly goal" v={s.monthlyGoal} sym={sym} />
              <MoneyFact label="Per sale" v={s.price} sym={sym} />
              <MoneyFact label="Monthly costs" v={s.monthlyCosts} sym={sym} />
            </div>
            {steps.length > 0 && (
              <div className="mt-4">
                <p className="mb-2 text-xs text-zinc-500">
                  Steps · {doneSteps}/{steps.length} done
                </p>
                <ul className="space-y-1">
                  {steps.map((x) => (
                    <li key={x.id} className="flex items-start gap-2 text-[13px]">
                      {x.done ? <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" /> : <Circle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" />}
                      <span className={x.done ? 'text-zinc-500 line-through' : 'text-zinc-300'}>{x.text}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {s.notes && <p className="mt-4 whitespace-pre-wrap border-t border-white/[0.05] pt-3 text-[13px] leading-relaxed text-zinc-400">{s.notes}</p>}
          </Card>
        )
      })}
    </div>
  )
}

function MoneyFact({ label, v, sym }: { label: string; v: number; sym: string }) {
  return (
    <div className="rounded-xl bg-white/[0.03] px-2 py-2.5">
      <p className="text-[11px] text-zinc-500">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular-nums text-zinc-100">{Number(v) ? fmt(Number(v), sym, true) : '—'}</p>
    </div>
  )
}

// ---------------------------------------------------------------- spending

export function SpendingTab({ plan }: { plan: Plan }) {
  const sym = plan.currency.main.symbol
  const catOf = useMemo(() => byId<ExpenseCategory>(plan.expenseCats, NO_CATEGORY), [plan.expenseCats])
  const [shown, setShown] = useState(50)
  const sorted = useMemo(() => [...plan.expenses].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt)), [plan.expenses])
  const month = todayKey().slice(0, 7)
  const total = plan.expenses.reduce((s, e) => s + e.amount, 0)
  const thisMonth = plan.expenses.filter((e) => e.date.startsWith(month)).reduce((s, e) => s + e.amount, 0)
  const cats = useMemo(() => {
    const m = new Map<string, number>()
    for (const e of plan.expenses) m.set(e.category, (m.get(e.category) ?? 0) + e.amount)
    return [...m.entries()].sort((a, b) => b[1] - a[1])
  }, [plan.expenses])

  if (!plan.expenses.length)
    return (
      <Card>
        <Empty icon={Receipt} title="No spending tracked yet" />
      </Card>
    )

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Num label="Expenses" value={plan.expenses.length.toLocaleString()} />
        <Num label="Total spent" value={fmt(total, sym, true)} />
        <Num label="This month" value={fmt(thisMonth, sym, true)} />
        <Num label="Places saved" value={new Set(plan.expenses.map((e) => e.place).filter(Boolean)).size} />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <Card title="By category">
          <ul className="space-y-3">
            {cats.slice(0, 10).map(([id, amt]) => {
              const c = catOf(id)
              const Icon = catIcon(c)
              return (
                <li key={id || 'none'}>
                  <div className="mb-1 flex items-center gap-2 text-[13px]">
                    <Icon className={cx('h-3.5 w-3.5', catColor(c).text)} />
                    <span className="flex-1 truncate text-zinc-300">{c.label}</span>
                    <span className="tabular-nums text-zinc-100">{fmt(amt, sym, true)}</span>
                    <span className="w-10 text-right text-xs tabular-nums text-zinc-500">{total ? Math.round((amt / total) * 100) : 0}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className={cx('h-full rounded-full', catColor(c).bar)} style={{ width: `${total ? (amt / total) * 100 : 0}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
        <Card title="Latest expenses" pad={false}>
          <ul className="max-h-[520px] divide-y divide-white/[0.05] overflow-y-auto">
            {sorted.slice(0, shown).map((e) => {
              const c = catOf(e.category)
              const Icon = catIcon(c)
              return (
                <li key={e.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', catColor(c).soft)}>
                    <Icon className={cx('h-4 w-4', catColor(c).text)} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-zinc-100">{e.name || c.label}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {longDate(e.date)}
                      {e.place && ` · ${e.place}`}
                    </span>
                  </span>
                  <span className="text-sm font-medium tabular-nums text-white">{fmt(e.amount, sym)}</span>
                </li>
              )
            })}
          </ul>
          {sorted.length > shown && (
            <button onClick={() => setShown((n) => n + 100)} className="w-full border-t border-white/[0.05] py-3 text-[13px] font-medium text-zinc-400 transition hover:text-white">
              Show more ({sorted.length - shown} left)
            </button>
          )}
        </Card>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- calendar

export function ScheduleTab({ plan }: { plan: Plan }) {
  const kindOf = useMemo(() => byId<TaskKind>(plan.taskKinds, UNKNOWN_TASK_KIND), [plan.taskKinds])
  const [view, setView] = useState<'upcoming' | 'todo' | 'repeating' | 'past'>('upcoming')
  const today = todayKey()
  const lists = useMemo(() => {
    const t = plan.tasks
    const byDate = (a: (typeof t)[number], b: (typeof t)[number]) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.start ?? 0) - (b.start ?? 0))
    return {
      upcoming: t.filter((x) => !x.repeat && x.date && x.date >= today).sort(byDate),
      todo: t.filter((x) => !isEvent(x) && !x.done && !x.repeat),
      repeating: t.filter((x) => x.repeat),
      past: t.filter((x) => !x.repeat && x.date && x.date < today).sort(byDate).reverse(),
    }
  }, [plan.tasks, today])
  if (!plan.tasks.length)
    return (
      <Card>
        <Empty icon={CalendarDays} title="Nothing on their calendar yet" />
      </Card>
    )
  const list = lists[view]
  return (
    <div className="space-y-4">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { id: 'upcoming', label: 'Upcoming', count: lists.upcoming.length },
          { id: 'todo', label: 'Open to-dos', count: lists.todo.length },
          { id: 'repeating', label: 'Repeating', count: lists.repeating.length },
          { id: 'past', label: 'Past', count: lists.past.length },
        ]}
      />
      <Card pad={false}>
        {list.length === 0 ? (
          <Empty icon={CalendarDays} title="Nothing here" />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {list.slice(0, 200).map((t) => {
              const k = kindOf(t.kind)
              const c = taskColor(k)
              return (
                <li key={t.id} className="flex items-center gap-3 px-5 py-3">
                  <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', c.dot)} />
                  <span className="min-w-0 flex-1">
                    <span className={cx('block truncate text-sm', t.done ? 'text-zinc-500 line-through' : 'text-zinc-100')}>{t.title || 'Untitled'}</span>
                    <span className="block truncate text-xs text-zinc-500">
                      {k.label} · {isEvent(t) ? 'Event' : 'To-do'}
                      {t.notes && ` · ${t.notes.slice(0, 80)}`}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs tabular-nums text-zinc-400">
                    {t.repeat ? (
                      <span className="inline-flex items-center gap-1">
                        <Repeat className="h-3 w-3" /> {repeatLabel(t.repeat)}
                      </span>
                    ) : t.date ? (
                      longDate(t.date)
                    ) : (
                      'No date'
                    )}
                    {t.start != null && <span className="block text-zinc-500">{isEvent(t) ? fmtRange(t.start, t.duration) : `Due ${fmtTime(t.start)}`}</span>}
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- notes

export function NotesTab({ plan }: { plan: Plan }) {
  const years = Object.entries(plan.yearNotes).sort(([a], [b]) => a.localeCompare(b))
  const months = plan.modes.flatMap((m) =>
    Object.entries(m.months)
      .filter(([, d]) => d.notes?.trim())
      .map(([k, d]) => ({ mode: m.name, key: k, text: d.notes! })),
  ).sort((a, b) => a.key.localeCompare(b.key))
  const setups = plan.modes.flatMap((m) => Object.entries(m.setupNotes).map(([k, text]) => ({ mode: m.name, key: k, text })))
  const many = plan.modes.length > 1
  if (!years.length && !months.length && !setups.length)
    return (
      <Card>
        <Empty icon={NotebookPen} title="No notes written yet" />
      </Card>
    )
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {years.length > 0 && (
        <Card title="Year notes" className="lg:col-span-2">
          <div className="grid gap-4 md:grid-cols-2">
            {years.map(([y, text]) => (
              <Note key={y} label={y} text={text} />
            ))}
          </div>
        </Card>
      )}
      {months.length > 0 && (
        <Card title="Month notes">
          <div className="space-y-4">
            {months.map((n) => (
              <Note key={n.mode + n.key} label={`${labelOfKey(n.key)}${many ? ` · ${n.mode}` : ''}`} text={n.text} />
            ))}
          </div>
        </Card>
      )}
      {setups.length > 0 && (
        <Card title="Setup notes">
          <div className="space-y-4">
            {setups.map((n) => (
              <Note key={n.mode + n.key} label={`${labelOfKey(n.key)}${many ? ` · ${n.mode}` : ''}`} text={n.text} />
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function Note({ label, text }: { label: string; text: string }) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-zinc-500">{label}</p>
      <p className="whitespace-pre-wrap rounded-xl border border-white/[0.05] bg-black/20 px-3.5 py-3 text-[13px] leading-relaxed text-zinc-300">{text}</p>
    </div>
  )
}

// ---------------------------------------------------------------- raw

export function RawTab({ data }: { data: Record<string, unknown> }) {
  const text = useMemo(() => JSON.stringify(data, null, 2), [data])
  const kb = (new Blob([text]).size / 1024).toFixed(1)
  return (
    <Card
      title={`Saved document · ${kb} KB`}
      action={
        <span className="flex gap-1">
          <button onClick={() => void navigator.clipboard?.writeText(text)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
            <Copy className="h-3.5 w-3.5" /> Copy
          </button>
          <button onClick={() => download('dizayr-data.json', data)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs text-zinc-400 transition hover:bg-white/[0.06] hover:text-white">
            <Download className="h-3.5 w-3.5" /> Download
          </button>
        </span>
      }
      pad={false}
    >
      <pre className="max-h-[70vh] overflow-auto p-5 font-mono text-[12px] leading-relaxed text-zinc-400">{text}</pre>
    </Card>
  )
}
