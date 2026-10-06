import { useEffect, useState, type DragEvent, type ReactNode } from 'react'
import { AlertTriangle, ChevronDown, ClipboardPaste, Lock, Plus, Target } from 'lucide-react'
import { useFmt, usePlan, useStore, useUsd } from '../store'
import { MONTHS, currentIndex } from '../lib/time'
import { overLimitIds } from '../lib/calc'
import { MoneyInput } from './MoneyInput'
import { ItemRow } from './ItemRow'
import { drag } from '../dnd'
import { toast } from '../toast'
import { useIsPhone } from '../lib/useMedia'

const EMPTY: never[] = []

export function MonthCard({ index }: { index: number }) {
  const c = usePlan()[index]
  const f = useFmt()
  const u = useUsd()
  const month = useStore((s) => s.months[c.key])
  const items = month?.items ?? EMPTY
  const over = overLimitIds(month, c.available)
  const clipboard = useStore((s) => s.clipboard)
  const { setMonthField, openModal, pasteInto, transferItem } = useStore.getState()
  const [dropMode, setDropMode] = useState<null | 'move' | 'copy'>(null)

  const today = currentIndex()
  const isCurrent = index === today
  // On phones months are collapsed to a summary; tap to open. The current month starts open,
  // or every month does with "Open all months" on. Flipping that switch resets any month tapped open/closed.
  const phone = useIsPhone()
  const openAll = useStore((s) => s.openAllMonths)
  const [expanded, setExpanded] = useState(openAll || isCurrent)
  useEffect(() => setExpanded(openAll || isCurrent), [openAll, isCurrent])
  const open = !phone || expanded
  const isPast = index < today
  const left = c.budget - c.spent
  const risk = c.goal - c.budget
  const nwGoal = c.netWorthGoal
  // Only possible when an "earned" amount was saved for this month that doesn't match the worked-out goal.
  const nwShort = nwGoal !== null ? nwGoal - c.netWorth : 0
  const pct = c.budget > 0 ? c.spent / c.budget : 0
  const barCls = pct > 1 ? 'bg-red-400' : pct >= 0.85 ? 'bg-amber-300' : 'bg-emerald-400'

  const isCopy = (e: DragEvent) => e.ctrlKey || e.altKey || e.metaKey

  function onDragOver(e: DragEvent) {
    if (!drag.current) return
    e.preventDefault()
    const copy = isCopy(e)
    e.dataTransfer.dropEffect = copy ? 'copy' : 'move'
    setDropMode(copy ? 'copy' : 'move')
  }

  function onDrop(e: DragEvent) {
    e.preventDefault()
    setDropMode(null)
    const d = drag.current
    drag.current = null
    if (!d) return
    const mode = isCopy(e) ? 'copy' : 'move'
    const r = transferItem(d.fromKey, d.id, c.key, mode)
    // Dropped on an empty spot of its own month: just sent to the bottom of the list
    if (d.fromKey === c.key && mode === 'move') return
    toast.result(r, `${mode === 'copy' ? 'Copied' : 'Moved'} to ${MONTHS[c.month]} ${c.year}.`)
  }

  function paste() {
    const r = pasteInto(c.key)
    toast.result(r, `Pasted into ${MONTHS[c.month]} ${c.year}.`)
  }

  return (
    <article
      id={`month-${c.key}`}
      onDragOver={onDragOver}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropMode(null)}
      onDrop={onDrop}
      onClick={phone && !open ? () => setExpanded(true) : undefined}
      className={`relative flex min-w-0 flex-col rounded-2xl border bg-white/[0.025] p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition ${
        dropMode
          ? 'border-indigo-400/60 bg-indigo-500/[0.07] ring-2 ring-indigo-400/30'
          : isCurrent
            ? 'border-emerald-400/30'
            : 'border-white/[0.07] hover:border-white/[0.12]'
      }`}
    >
      {/* Header */}
      <header
        {...(phone && {
          role: 'button',
          tabIndex: 0,
          'aria-expanded': expanded,
          onClick: () => setExpanded((e) => !e),
          onKeyDown: (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), setExpanded((x) => !x)),
        })}
        className={`flex items-start justify-between gap-3 ${open ? 'mb-3' : ''} ${phone ? 'cursor-pointer' : ''}`}
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className={`text-lg font-semibold tracking-tight ${isPast ? 'text-zinc-300' : 'text-white'}`}>{MONTHS[c.month]}</h3>
            {isCurrent && (
              <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                This month
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">
            {phone && !open ? (
              <span className="text-zinc-400">
                Goal {f(c.goal, true)} · Budget {f(c.budget, true)}
              </span>
            ) : (
              c.year
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-start gap-2 text-right">
          <div>
          <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Net worth</p>
          <p className={`text-sm font-semibold tabular-nums ${c.netWorth < 0 ? 'text-red-300' : 'text-indigo-200'}`}>{f(c.netWorth)}</p>
          <p className="text-[11px] tabular-nums text-zinc-500">≈ {u(c.netWorth)}</p>
          </div>
          {phone && (
            <ChevronDown className={`mt-1 h-5 w-5 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
          )}
        </div>
      </header>

      {/* Net worth goal (optional) — when set it decides the goal to make */}
      {open && (
      <div
        className={`mb-2 flex items-center gap-2.5 rounded-xl border p-2 pl-2.5 transition ${
          nwGoal !== null ? 'border-indigo-400/25 bg-indigo-500/[0.07]' : 'border-white/[0.06] bg-black/10'
        }`}
      >
        <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${nwGoal !== null ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/5 text-zinc-500'}`}>
          <Target className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-400">Net worth goal</p>
          <p className={`truncate text-[11px] ${nwGoal === null ? 'text-zinc-600' : nwShort > 0.005 ? 'text-amber-300' : 'text-emerald-300'}`}>
            {nwGoal === null
              ? 'Optional · by the end of the month'
              : nwShort > 0.005
                ? `${f(nwShort, true)} short of it`
                : c.goal === 0 && c.netWorth > nwGoal
                  ? `Already there · ${f(c.netWorth - nwGoal, true)} above`
                  : `Needs ${f(c.goal, true)} made this month`}
          </p>
        </div>
        <MoneyInput
          value={nwGoal}
          nullable
          placeholder="Not set"
          onChange={(v) => setMonthField(c.key, 'netWorthGoal', v)}
          className="w-32 shrink-0 sm:w-36"
          ariaLabel={`${MONTHS[c.month]} net worth goal by the end of the month`}
        />
      </div>
      )}

      {/* Month label: goal / budget / risk */}
      {open && (
      <div className="grid grid-cols-3 gap-2">
        <Field label="Goal to make" hint={c.goalFromNetWorth ? 'auto' : undefined}>
          {c.goalFromNetWorth ? (
            <ReadOnly
              title="Worked out from your net worth goal. Clear the net worth goal to type your own."
              ariaLabel={`${MONTHS[c.month]} goal to make, worked out from the net worth goal`}
              cls="border-indigo-400/20 bg-indigo-500/[0.06] text-indigo-100"
            >
              <Lock className="mr-1.5 h-3 w-3 shrink-0 text-indigo-300/70" />
              <span className="truncate">{f(c.goal)}</span>
            </ReadOnly>
          ) : (
            <MoneyInput value={c.goal} onChange={(v) => setMonthField(c.key, 'goal', v)} ariaLabel={`${MONTHS[c.month]} goal`} />
          )}
        </Field>
        <Field label="Budget">
          <MoneyInput value={c.budget} onChange={(v) => setMonthField(c.key, 'budget', v)} ariaLabel={`${MONTHS[c.month]} budget`} />
        </Field>
        <Field label="Risk" hint="goal − budget">
          <ReadOnly ariaLabel={`${MONTHS[c.month]} risk (goal minus budget)`} cls={`border-white/[0.06] bg-white/[0.03] ${risk < 0 ? 'text-red-300' : 'text-zinc-300'}`}>
            <span className="truncate">{f(risk)}</span>
          </ReadOnly>
        </Field>
      </div>
      )}

      {/* Budget usage */}
      <div className="mt-3">
        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 text-xs">
          <span className="text-zinc-400">
            Spent <span className="font-medium tabular-nums text-zinc-200">{f(c.spent)}</span>
            {c.budget > 0 && <span className="text-zinc-500"> of {f(c.budget)}</span>}
          </span>
          {c.budget > 0 ? (
            <span className={`font-medium tabular-nums ${left < 0 ? 'text-red-300' : 'text-zinc-300'}`}>
              {left < 0 ? `${f(-left)} over` : `${f(left)} left`}
              <span className="hidden font-normal text-zinc-500 sm:inline"> · {u(Math.abs(left), true)}</span>
            </span>
          ) : (
            <span className="text-zinc-500">No budget yet</span>
          )}
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-white/5">
          <div className={`h-full rounded-full transition-all duration-500 ${barCls}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
        </div>
      </div>

      {!open && items.length > 0 && (
        <p className={`mt-2.5 flex items-center gap-1.5 text-xs ${over.size ? 'text-red-300' : 'text-zinc-400'}`}>
          {over.size > 0 && <AlertTriangle className="h-3.5 w-3.5" />}
          {items.length} item{items.length > 1 ? 's' : ''}
          {over.size > 0 && ` · ${over.size} over the limit`}
        </p>
      )}

      {open && (
        <>
      {/* Running totals (everything from Jan 2026 up to this month) */}
      <div className="mt-3 grid grid-cols-3 divide-x divide-white/[0.06] rounded-xl border border-white/[0.06] bg-black/20">
        <Total k="Total earned" v={f(c.cumEarned, true)} usd={u(c.cumEarned, true)} cls="text-emerald-300" />
        <Total k="Total spent" v={f(c.cumSpent, true)} usd={u(c.cumSpent, true)} cls="text-red-300" />
        <Total k="Money left" v={f(c.cash, true)} usd={u(c.cash, true)} cls={c.cash < 0 ? 'text-red-300' : 'text-white'} />
      </div>

      {/* Items */}
      <ul className="mt-3 flex flex-1 flex-col gap-1.5">
        {items.map((it, i) => (
          <ItemRow
            key={it.id}
            item={it}
            monthKey={c.key}
            over={over.has(it.id)}
            prevId={items[i - 1]?.id}
            nextId={items[i + 1]?.id}
          />
        ))}
        {items.length === 0 && (
          <li className="grid flex-1 place-items-center rounded-xl border border-dashed border-white/[0.08] py-4 text-center text-xs text-zinc-500">
            {phone ? 'No items yet' : 'No items yet · add one or drop one here'}
          </li>
        )}
      </ul>

      {/* Actions */}
      <div className="mt-3 flex gap-2">
        <button
          onClick={() => openModal({ type: 'item', key: c.key })}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl border border-white/10 bg-white/[0.04] text-sm font-medium text-zinc-200 transition hover:border-indigo-400/40 hover:bg-indigo-500/10 hover:text-white"
        >
          <Plus className="h-4 w-4" /> Add item
        </button>
        {clipboard && (
          <button
            onClick={paste}
            title={`Paste “${clipboard.item.name}”`}
            className="animate-fade inline-flex h-9 items-center gap-1.5 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-3 text-sm font-medium text-indigo-100 transition hover:bg-indigo-500/25"
          >
            <ClipboardPaste className="h-4 w-4" /> Paste
          </button>
        )}
      </div>

        </>
      )}

      {dropMode && (
        <div className="pointer-events-none absolute inset-x-4 bottom-14 rounded-lg bg-indigo-500/90 px-3 py-1.5 text-center text-xs font-medium text-white shadow-lg">
          {dropMode === 'copy' ? 'Drop to copy here' : 'Drop to move here · hold Ctrl to copy'}
        </div>
      )}
    </article>
  )
}

/** A box that looks like an input but is worked out for you. */
function ReadOnly({ children, cls, title, ariaLabel }: { children: ReactNode; cls: string; title?: string; ariaLabel: string }) {
  return (
    <div
      title={title}
      aria-label={ariaLabel}
      className={`flex h-9 min-w-0 items-center rounded-lg border px-2.5 text-sm font-medium tabular-nums ${cls}`}
    >
      {children}
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="min-w-0">
      <span className="mb-1 flex items-center justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
        {hint && <span className="normal-case tracking-normal text-zinc-600">{hint}</span>}
      </span>
      {children}
    </label>
  )
}

function Total({ k, v, usd, cls }: { k: string; v: string; usd: string; cls: string }) {
  return (
    <div className="min-w-0 px-2.5 py-2">
      <p className="truncate text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className={`truncate text-sm font-semibold tabular-nums ${cls}`}>{v}</p>
      <p className="truncate text-[10px] tabular-nums text-zinc-500">≈ {usd}</p>
    </div>
  )
}
