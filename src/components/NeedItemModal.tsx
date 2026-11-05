import { useMemo, useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, Copy, Receipt, Settings2, StickyNote, Trash2 } from 'lucide-react'
import { useCurrentNeeds, useFmt, useStore } from '../store'
import { useExpenseCats } from '../expenseHooks'
import { MAX_CAT_NAME, MAX_DATE, MAX_ITEM_NAME, MIN_DATE, WEEKDAYS, addDays, catColor, catIcon, clampDate, fromKey, todayKey } from '../lib/expenses'
import { budgetFor, daysOfWeek, isSent, needsByMonth, weekLabel, weekOfDay } from '../lib/needs'
import { MONTHS } from '../lib/time'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { toast } from '../toast'

/** Add or edit something in a week of a Needs mode. It stays out of Expenses unless the box here is ticked. */
export function NeedItemModal({ editId, date: startDate }: { editId?: string; date?: string }) {
  const close = useStore((s) => s.closeModal)
  const plan = useCurrentNeeds()
  const editing = editId ? plan?.items.find((e) => e.id === editId) : undefined
  const allCats = useExpenseCats()
  const f = useFmt()
  const wasSent = useStore((s) => !!editing?.expenseId && s.expenses.some((e) => e.id === editing.expenseId))
  // An item keeps its category even when that's since been taken off the list.
  const cats = plan ? [...plan.cats, ...(editing && !plan.cats.includes(editing.category) ? [editing.category] : [])].flatMap((id) => allCats.filter((c) => c.id === id)) : []

  const [category, setCategory] = useState(editing?.category ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null)
  const [date, setDate] = useState(clampDate(editing?.date ?? startDate ?? todayKey()))
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  const [picking, setPicking] = useState(false)
  const [send, setSend] = useState(wasSent)
  const amountBox = useRef<HTMLDivElement>(null)

  const week = weekOfDay(date)
  const days = daysOfWeek(week)
  const picked = cats.find((c) => c.id === category)
  const ready = !!picked && (amount ?? 0) > 0

  // What this month has left once this is counted (a moved item counts in its new month).
  const monthKey = date.slice(0, 7)
  const left = useMemo(() => {
    if (!plan) return 0
    const spent = (needsByMonth(plan).get(monthKey) ?? []).filter((e) => e.id !== editId).reduce((n, e) => n + e.amount, 0)
    return budgetFor(plan, monthKey) - spent - (amount ?? 0)
  }, [plan, monthKey, editId, amount])
  const hasBudget = !!plan && budgetFor(plan, monthKey) > 0

  function save(again: boolean) {
    if (!ready) return
    const data = { date, amount: amount!, name, category, place: editing?.place ?? '', notes: notesOpen ? notes : '' }
    const s = useStore.getState()
    const what = name.trim() || picked!.label
    if (editing) {
      s.updateNeedItem(editing.id, data)
      if (send !== wasSent) s.setNeedsSent([editing.id], send)
      toast.success(send === wasSent ? `Updated “${what}”.` : send ? `Updated “${what}” and sent it to Expenses.` : `Updated “${what}” and took it out of Expenses.`)
      return close()
    }
    s.addNeedItem(data, send)
    toast.success(`Added ${f(amount!)} · ${what} to Week ${week.n}${send ? ' and to Expenses' : ''}.`)
    if (!again) return close()
    // Ready for the next one: same week and category, the shopping-list way.
    setName('')
    setAmount(null)
    setNotes('')
    setNotesOpen(false)
    setSend(false)
    requestAnimationFrame(() => amountBox.current?.querySelector('input')?.focus())
  }

  function remove() {
    if (!editing) return
    const gone = useStore.getState().removeNeedItem(editing.id)
    close()
    const what = gone?.item.name || picked?.label || 'item'
    if (gone) toast.undo(gone.wasSent ? `Deleted “${what}” from Needs and Expenses.` : `Deleted “${what}”.`, gone.undo)
  }

  function copyToNextWeek() {
    if (!editing) return
    const to = addDays(editing.date, 7)
    if (to > MAX_DATE) return
    const s = useStore.getState()
    const id = s.addNeedItem({ ...editing, date: to })
    close()
    toast.undo(`Copied to Week ${weekOfDay(to).n} of ${MONTHS[fromKey(to).getMonth()]}.`, () => useStore.getState().removeNeedItem(id))
  }

  return (
    <Modal
      title={editing ? 'Edit item' : `Add to Week ${week.n}`}
      subtitle={`${weekLabel(week)}, ${date.slice(0, 4)}`}
      onClose={close}
      width="max-w-lg"
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            {hasBudget ? (
              <>
                Left in {MONTHS[fromKey(date).getMonth()]} after this: <span className={`font-semibold tabular-nums ${left < 0 ? 'text-red-300' : 'text-zinc-200'}`}>{f(left)}</span>
              </>
            ) : (
              send ? 'Goes to Expenses too.' : 'Stays in Needs only.'
            )}
          </p>
          <div className="flex gap-2">
            {!editing && (
              <button type="button" onClick={() => save(true)} disabled={!ready} className="h-11 flex-1 whitespace-nowrap rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40 sm:h-10 sm:flex-none">
                Add another
              </button>
            )}
            {editing && (
              <button type="button" onClick={close} className="h-11 flex-1 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 sm:h-10 sm:flex-none">
                Cancel
              </button>
            )}
            <button type="button" onClick={() => save(false)} disabled={!ready} className="h-11 flex-[2] whitespace-nowrap rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:h-10 sm:flex-none">
              {editing ? 'Save changes' : 'Add item'}
            </button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          save(false)
        }}
      >
        <Step
          n={1}
          title="What is it for?"
          done={!!picked}
          aside={
            <button type="button" onClick={() => setPicking(true)} className="ml-auto inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
              <Settings2 className="h-3.5 w-3.5" /> Edit categories
            </button>
          }
        >
          {cats.length === 0 ? (
            <button type="button" onClick={() => setPicking(true)} className="w-full rounded-2xl border border-dashed border-white/15 py-5 text-sm font-medium text-zinc-300 transition hover:border-emerald-400/40">
              Choose your categories first
            </button>
          ) : (
            <div role="radiogroup" aria-label="Category" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {cats.map((c) => {
                const Icon = catIcon(c)
                const on = c.id === category
                const col = catColor(c)
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setCategory(c.id)}
                    className={`relative flex min-w-0 items-center gap-2.5 rounded-2xl border p-2.5 text-left transition ${on ? `border-white/30 ${col.soft} ring-2 ${col.ring}` : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'}`}
                  >
                    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${col.soft} ${col.text}`}>
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 break-words text-sm font-semibold leading-tight text-white">{c.label}</span>
                  </button>
                )
              })}
            </div>
          )}
        </Step>

        <Step n={2} title="What and how much?" done={(amount ?? 0) > 0}>
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_10rem]">
            <label className="block min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">
                Name <span className="text-zinc-600">· optional</span>
              </span>
              <input
                value={name}
                maxLength={MAX_ITEM_NAME}
                onChange={(e) => setName(e.target.value)}
                placeholder={picked?.items[0] ? `e.g. ${picked.items[0]}` : 'What did you get?'}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20 sm:text-sm"
              />
            </label>
            <div ref={amountBox} className="min-w-0">
              <span className="mb-1.5 block text-xs font-medium text-zinc-400">Amount</span>
              <MoneyInput value={amount} onChange={(v) => setAmount(v || null)} ariaLabel="Amount" size="md" nullable />
            </div>
          </div>
          {!!picked?.items.length && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {picked.items.slice(0, 8).map((i) => (
                <button key={i} type="button" onClick={() => setName(i)} aria-pressed={name === i} className={`h-7 rounded-lg border px-2 text-xs font-medium transition ${name === i ? 'border-emerald-400/50 bg-emerald-400/10 text-emerald-100' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'}`}>
                  {i}
                </button>
              ))}
            </div>
          )}
        </Step>

        <Step n={3} title="Which day?" done>
          <div role="radiogroup" aria-label="Day" className="flex gap-1.5">
            {days.map((k) => {
              const d = fromKey(k)
              const on = k === date
              const isToday = k === todayKey()
              return (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  aria-label={`${WEEKDAYS[d.getDay()]} ${d.getDate()}`}
                  onClick={() => setDate(k)}
                  className={`flex h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-xl border transition ${on ? 'border-emerald-400/60 bg-emerald-500/15 text-white ring-1 ring-emerald-400/40' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'}`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-wide">{WEEKDAYS[d.getDay()].slice(0, days.length > 5 ? 1 : 3)}</span>
                  <span className={`text-sm font-semibold tabular-nums ${isToday && !on ? 'text-emerald-300' : ''}`}>{d.getDate()}</span>
                </button>
              )
            })}
          </div>
          <label className="mt-2 flex items-center justify-between gap-3 text-xs text-zinc-500">
            <span>Or another date</span>
            <input
              type="date"
              value={date}
              min={MIN_DATE}
              max={MAX_DATE}
              onChange={(e) => e.target.value && setDate(clampDate(e.target.value))}
              aria-label="Another date"
              className="h-8 rounded-lg border border-white/10 bg-black/30 px-2 text-xs text-zinc-200 outline-none transition [color-scheme:dark] hover:border-white/20 focus:border-emerald-400/60"
            />
          </label>
        </Step>

        <section>
          <button type="button" onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen} className="group flex w-full items-center gap-2.5 text-left">
            <span className={`grid h-6 w-6 place-items-center rounded-full ${notes.trim() ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10 text-zinc-300'}`}>
              <StickyNote className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-zinc-200">Notes</span>
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">optional</span>
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform ${notesOpen ? 'rotate-180' : ''}`} />
          </button>
          {notesOpen && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              maxLength={2000}
              placeholder="Anything to remember"
              className="animate-fade mt-2.5 block w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/15 sm:text-sm"
            />
          )}
        </section>

        <button
          type="button"
          role="switch"
          aria-checked={send}
          onClick={() => setSend((v) => !v)}
          className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${send ? 'border-emerald-400/60 bg-emerald-500/15 ring-1 ring-emerald-400/30' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'}`}
        >
          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl transition ${send ? 'bg-emerald-400/25 text-emerald-200' : 'bg-white/[0.06] text-zinc-400'}`}>
            <Receipt className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-white">Send to Expenses</span>
            <span className="block text-xs leading-relaxed text-zinc-400">{send ? 'This will count in your Expenses totals too.' : 'Off: this stays in Needs and won’t touch Expenses.'}</span>
          </span>
          <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${send ? 'bg-emerald-400' : 'bg-white/15'}`}>
            <span className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all ${send ? 'left-[18px] text-emerald-600' : 'left-0.5 text-transparent'}`}>
              <Check className="h-3 w-3" strokeWidth={3.5} />
            </span>
          </span>
        </button>

        {editing && (
          <div className="flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
            <button type="button" onClick={copyToNextWeek} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-white/10 px-3 text-[13px] font-medium text-zinc-200 transition hover:bg-white/5">
              <Copy className="h-3.5 w-3.5" /> Copy to next week
            </button>
            <button type="button" onClick={remove} className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium text-red-300 transition hover:bg-red-500/10">
              <Trash2 className="h-3.5 w-3.5" /> Delete
            </button>
          </div>
        )}
        <button type="submit" hidden />
      </form>
      {picking && <NeedsPicker onClose={() => setPicking(false)} />}
    </Modal>
  )
}

function Step({ n, title, done, aside, children }: { n: number; title: string; done: boolean; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold transition ${done ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-zinc-300'}`}>{done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}</span>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

/** Choose which spending categories are offered in this mode, or make a new one. */
export function NeedsPicker({ onClose }: { onClose: () => void }) {
  const cats = useExpenseCats()
  const plan = useCurrentNeeds()
  const [name, setName] = useState('')
  const { addNeed, removeNeed, addExpenseCat } = useStore.getState()

  function create() {
    if (!name.trim()) return
    addNeed(addExpenseCat(name))
    setName('')
  }

  return (
    <Modal
      title="Your categories"
      subtitle="What you can pick when adding an item. Taking one off only removes the choice; what’s already in it stays."
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="h-10 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-5 text-sm font-semibold text-emerald-950">
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-1.5">
        {cats.map((c) => {
          const on = !!plan?.cats.includes(c.id)
          const Icon = catIcon(c)
          return (
            <button
              key={c.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => (on ? removeNeed(c.id) : addNeed(c.id))}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-emerald-400/50 bg-emerald-400/10' : 'border-white/[0.07] hover:border-white/20'}`}
            >
              <Icon className={`h-4 w-4 shrink-0 ${catColor(c).text}`} />
              <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">{c.label}</span>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? 'border-emerald-400 bg-emerald-500 text-white' : 'border-white/20 text-transparent'}`}>
                <Check className="h-3.5 w-3.5" strokeWidth={3} />
              </span>
            </button>
          )
        })}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          value={name}
          maxLength={MAX_CAT_NAME}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              create()
            }
          }}
          placeholder="Something else, like Rent or Baby"
          aria-label="New category"
          className="h-10 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-400/60 focus:ring-2 focus:ring-emerald-500/20"
        />
        <button type="button" onClick={create} disabled={!name.trim()} className="h-10 shrink-0 rounded-xl border border-white/10 px-3 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40">
          Add
        </button>
      </div>
    </Modal>
  )
}
