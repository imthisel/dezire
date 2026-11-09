import { useMemo, useState, type MouseEvent } from 'react'
import { ArrowRight, Check, Download, Minus, Receipt, Undo2 } from 'lucide-react'
import { useFmt, useStore } from '../store'
import { useExpenseCats } from '../expenseHooks'
import { NO_CATEGORY, WEEKDAYS, catColor, catIcon, fromKey } from '../lib/expenses'
import { MONTHS } from '../lib/time'
import type { Expense } from '../lib/types'
import { Modal } from './Modal'
import { toast } from '../toast'

/** The tick that sends something to Expenses. Used for one item, and for a whole week (where `partly` can show). */
/**
 * The name of something already bought (a ticked Wants or Needs item): a thin soft-green line through it, the same in
 * both. The text keeps its full colour, so it reads as easily as before; the line fades in and out with the tick.
 */
const STRIKE = 'line-through decoration-[1.5px] transition-[text-decoration-color] duration-300'
export const BOUGHT_TEXT = `${STRIKE} decoration-emerald-300/75`
/** The same line, invisible, so ticking fades it in instead of popping. */
export const NOT_BOUGHT_TEXT = `${STRIKE} decoration-transparent`

export function SendTick({ on, partly, label, onChange, size = 'md' }: { on: boolean; partly?: boolean; label: string; onChange: () => void; size?: 'sm' | 'md' }) {
  const box = size === 'sm' ? 'h-5 w-5 rounded-md' : 'h-6 w-6 rounded-lg'
  const click = (e: MouseEvent) => {
    e.stopPropagation()
    onChange()
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={partly ? 'mixed' : on}
      aria-label={label}
      title={label}
      onClick={click}
      draggable={false}
      className="group/tick -m-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/70"
    >
      <span
        className={`grid place-items-center border transition duration-150 group-active/tick:scale-90 ${box} ${
          on
            ? 'border-emerald-300 bg-emerald-400 text-emerald-950 shadow-[0_0_12px_rgba(52,211,153,0.35)]'
            : partly
              ? 'border-emerald-400/70 bg-emerald-400/20 text-emerald-200'
              : 'border-white/25 bg-black/20 text-transparent group-hover/tick:border-emerald-300/80 group-hover/tick:bg-emerald-400/10 group-hover/tick:text-emerald-300/70'
        }`}
      >
        {partly && !on ? <Minus className="h-3.5 w-3.5" strokeWidth={3} /> : <Check key={String(on)} className={`h-3.5 w-3.5 ${on ? 'animate-pop' : ''}`} strokeWidth={3} />}
      </span>
    </button>
  )
}

const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

/** Sends or takes back items, and says what happened with a way to undo it. `what`: how to name them, like “Lunch” or “Week 2”. */
export function flipSent(ids: string[], on: boolean, what?: string) {
  const { count, undo } = useStore.getState().setNeedsSent(ids, on)
  if (!count) return
  const name = what ?? plural(count)
  toast.undo(on ? `${name} sent to Expenses.` : `${name} taken out of Expenses. Still here in Needs.`, undo)
}

/** Everything in a month or more, sent or not, and the button that sends what's left. */
export function SendBar({ ids, sentIds, sentTotal, total, scope }: { ids: string[]; sentIds: string[]; sentTotal: number; total: number; scope: string }) {
  const f = useFmt()
  const waiting = ids.filter((id) => !sentIds.includes(id))
  const all = ids.length > 0 && waiting.length === 0
  if (!ids.length) return null
  return (
    <div className={`mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-2xl border px-3 py-2.5 transition ${all ? 'border-emerald-400/30 bg-emerald-500/[0.08]' : 'border-white/[0.08] bg-white/[0.025]'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${all ? 'bg-emerald-400/20 text-emerald-200' : 'bg-white/[0.06] text-zinc-400'}`}>
        <Receipt className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 basis-40">
        <p className="text-sm font-medium text-zinc-100">
          {sentIds.length === 0 ? 'Nothing in Expenses yet' : all ? 'All of it is in Expenses' : `${sentIds.length} of ${ids.length} in Expenses`}
        </p>
        <p className="text-xs tabular-nums text-zinc-500">{sentIds.length === 0 ? `${f(total)} stays in Needs only` : all ? `${f(total)} counted there` : `${f(sentTotal)} of ${f(total)} counted there`}</p>
      </div>
      <div className="flex shrink-0 gap-1.5">
        {sentIds.length > 0 && (
          <button type="button" onClick={() => flipSent(sentIds, false, `${plural(sentIds.length)} from ${scope}`)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-[13px] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
            <Undo2 className="h-3.5 w-3.5" /> Take {all ? 'all ' : ''}out
          </button>
        )}
        {!all && (
          <button type="button" onClick={() => flipSent(waiting, true, `${plural(waiting.length)} from ${scope}`)} className="inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-xl border border-emerald-400/40 bg-emerald-400/10 px-3 text-[13px] font-semibold text-emerald-100 transition hover:border-emerald-300/70 hover:bg-emerald-400/20">
            Send {waiting.length === 1 ? (sentIds.length ? 'the last one' : 'it') : sentIds.length ? `the other ${waiting.length}` : `all ${waiting.length}`} <ArrowRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

/** Pick expenses from before to bring in, as items of this Needs mode. */
export function BringInModal({ list, onClose }: { list: Expense[]; onClose: () => void }) {
  const f = useFmt()
  const cats = useExpenseCats()
  const [picked, setPicked] = useState<string[]>([])
  const [keep, setKeep] = useState(true)

  const groups = useMemo(() => {
    const byMonth = new Map<string, Expense[]>()
    for (const e of [...list].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt))) {
      const k = e.date.slice(0, 7)
      byMonth.set(k, [...(byMonth.get(k) ?? []), e])
    }
    return [...byMonth]
  }, [list])

  const total = list.reduce((n, e) => (picked.includes(e.id) ? n + e.amount : n), 0)
  const allOn = picked.length === list.length
  const flip = (ids: string[], on: boolean) => setPicked((p) => (on ? [...new Set([...p, ...ids])] : p.filter((x) => !ids.includes(x))))

  function bring() {
    const { count, undo } = useStore.getState().importNeedItems(picked, keep)
    onClose()
    toast.undo(keep ? `Brought in ${plural(count)}. Still ticked, so they stay in Expenses.` : `Moved ${plural(count)} out of Expenses and into Needs.`, undo)
  }

  return (
    <Modal
      title="Bring in from Expenses"
      subtitle="Pick what belongs in this budget. Everything else stays only in Expenses."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs tabular-nums text-zinc-500">{picked.length ? `${plural(picked.length)} · ${f(total)}` : 'Nothing picked yet'}</p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-11 flex-1 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 sm:h-10 sm:flex-none">
              Cancel
            </button>
            <button type="button" onClick={bring} disabled={!picked.length} className="h-11 flex-[2] whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:h-10 sm:flex-none">
              {keep ? 'Bring in' : 'Move here'}
            </button>
          </div>
        </div>
      }
    >
      <div role="radiogroup" aria-label="What happens in Expenses" className="grid gap-2 sm:grid-cols-2">
        <Choice on={keep} onClick={() => setKeep(true)} title="Keep in Expenses too" hint="Comes in ticked. Untick any one later." />
        <Choice on={!keep} onClick={() => setKeep(false)} title="Move out of Expenses" hint="Only in Needs, until you tick it." />
      </div>

      <div className="mt-4 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">{plural(list.length)} found</p>
        <button type="button" onClick={() => flip(list.map((e) => e.id), !allOn)} className="rounded-lg px-2 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-400/10">
          {allOn ? 'Clear all' : 'Pick all'}
        </button>
      </div>

      <div className="mt-2 space-y-4">
        {groups.map(([key, items]) => {
          const ids = items.map((e) => e.id)
          const count = ids.filter((id) => picked.includes(id)).length
          return (
            <section key={key}>
              <div className="mb-1.5 flex items-center gap-2">
                <SendTick size="sm" on={count === ids.length} partly={count > 0 && count < ids.length} label={`Pick all of ${MONTHS[Number(key.slice(5)) - 1]} ${key.slice(0, 4)}`} onChange={() => flip(ids, count < ids.length)} />
                <h3 className="text-sm font-semibold text-zinc-200">
                  {MONTHS[Number(key.slice(5)) - 1]} {key.slice(0, 4)}
                </h3>
                <span className="ml-auto text-xs tabular-nums text-zinc-500">{f(items.reduce((n, e) => n + e.amount, 0))}</span>
              </div>
              <ul className="space-y-1">
                {items.map((e) => {
                  const cat = cats.find((c) => c.id === e.category) ?? NO_CATEGORY
                  const Icon = catIcon(cat)
                  const on = picked.includes(e.id)
                  const d = fromKey(e.date)
                  return (
                    <li key={e.id}>
                      <div onClick={() => flip([e.id], !on)} className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-2 py-1.5 transition ${on ? 'border-emerald-400/40 bg-emerald-400/10' : 'border-white/[0.07] hover:border-white/20'}`}>
                        <SendTick size="sm" on={on} label={`Pick ${e.name || cat.label}`} onChange={() => flip([e.id], !on)} />
                        <Icon className={`h-4 w-4 shrink-0 ${catColor(cat).text}`} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium text-zinc-100">{e.name || cat.label}</span>
                          <span className="block truncate text-[11px] text-zinc-500">
                            {WEEKDAYS[d.getDay()]} {d.getDate()}
                            {e.name ? ` · ${cat.label}` : ''}
                          </span>
                        </span>
                        <span className="shrink-0 text-[13px] font-semibold tabular-nums text-white">{f(e.amount)}</span>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </section>
          )
        })}
      </div>
    </Modal>
  )
}

function Choice({ on, onClick, title, hint }: { on: boolean; onClick: () => void; title: string; hint: string }) {
  return (
    <button type="button" role="radio" aria-checked={on} onClick={onClick} className={`rounded-2xl border p-3 text-left transition ${on ? 'border-emerald-400/60 bg-emerald-500/15 ring-1 ring-emerald-400/40' : 'border-white/10 hover:border-white/20'}`}>
      <span className="block text-sm font-semibold text-white">{title}</span>
      <span className="mt-0.5 block text-xs leading-relaxed text-zinc-400">{hint}</span>
    </button>
  )
}

/** The line at the top of a Needs page: what's separate, what's crossed over, and the way in for older expenses. */
export function NeedsBridge({ sent, total, count, sentCount, month, canBring, firstTime, onBring }: { sent: number; total: number; count: number; sentCount: number; month: string; canBring: number; firstTime: boolean; onBring: () => void }) {
  const f = useFmt()
  if (firstTime && canBring > 0)
    return (
      <div className="animate-fade flex flex-wrap items-center gap-3 rounded-2xl border border-amber-300/30 bg-amber-400/[0.08] p-3.5 sm:p-4">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-amber-200">
          <Download className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1 basis-56">
          <p className="text-sm font-semibold text-white">Needs now has its own list</p>
          <p className="mt-0.5 text-xs leading-relaxed text-zinc-400">
            You have {canBring === 1 ? '1 expense' : `${canBring} expenses`} in these categories. They’re safe in Expenses. Bring in the ones you want here.
          </p>
        </div>
        <button type="button" onClick={onBring} className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl bg-amber-300 px-4 text-sm font-semibold text-amber-950 transition hover:brightness-110">
          Choose what to bring in <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.025] px-3.5 py-3">
      <span aria-hidden className="grid h-6 w-6 shrink-0 place-items-center rounded-lg border border-emerald-300 bg-emerald-400 text-emerald-950">
        <Check className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <p className="min-w-0 flex-1 basis-56 text-[13px] leading-snug text-zinc-300">
        Separate from Expenses. <span className="text-zinc-500">An item only counts there once you tick it.</span>
      </p>
      {count > 0 && (
        <p className="shrink-0 text-xs tabular-nums text-zinc-400">
          {month}: <span className="font-semibold text-emerald-200">{f(sent)}</span> of {f(total)} sent · {sentCount}/{count}
        </p>
      )}
      {canBring > 0 && (
        <button type="button" onClick={onBring} className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-300 transition hover:bg-white/5 hover:text-white">
          <Download className="h-3.5 w-3.5" /> Bring in from Expenses
        </button>
      )}
    </div>
  )
}
