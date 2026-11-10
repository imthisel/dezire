import { useMemo, useRef, useState } from 'react'
import { CalendarDays, Check, ChevronDown, Copy, NotebookPen, Receipt, Settings2, Trash2 } from 'lucide-react'
import { useCurrentNeeds, useFmt, useStore } from '../store'
import { useExpenseCats } from '../expenseHooks'
import { MAX_CAT_NAME, MAX_DATE, addDays, catColor, catIcon, clampDate, fromKey, longDate, todayKey } from '../lib/expenses'
import { budgetFor, needsByMonth, weekLabel, weekOfDay } from '../lib/needs'
import { MONTHS, MONTHS_SHORT } from '../lib/time'
import { walletState } from '../lib/wallet'
import { Calendar } from './Calendar'
import { Chip, NameField, PAID_KEY, PlaceField, Section, lastPaid } from './ExpenseModal'
import { ExpenseSettings } from './ExpenseSettings'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { AccountPicker } from './Wallet'
import { toast } from '../toast'

/** A picked day chip, in the Needs green. */
const ON = 'border-emerald-400/50 bg-emerald-500/15 text-emerald-100'

/**
 * Add or edit something in a Needs mode: laid out like adding an expense, worded for what's coming up. It stays out of
 * Expenses unless "Send to Expenses" is on.
 */
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
  const [date, setDateRaw] = useState(clampDate(editing?.date ?? startDate ?? todayKey()))
  const setDate = (k: string) => setDateRaw(clampDate(k))
  const [place, setPlace] = useState(editing?.place ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  // Paying with: one of your money accounts, the same choice as when adding an expense.
  const accounts = useStore((s) => s.wallet.accounts)
  const [account, setAccount] = useState(() => {
    const ids = accounts.map((a) => a.id)
    const want = editing ? editing.account || ids[0] : lastPaid()
    return want && ids.includes(want) ? want : (ids[0] ?? '')
  })
  const [calOpen, setCalOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const [places, setPlaces] = useState(false)
  const [send, setSend] = useState(wasSent)
  const [added, setAdded] = useState(0)
  const amountBox = useRef<HTMLDivElement>(null)

  const today = todayKey()
  const tomorrow = addDays(today, 1)
  const week = weekOfDay(date)
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

  // What's already planned per day, as dots on the calendar.
  const marks = useMemo(() => {
    const t = new Map<string, number>()
    for (const e of plan?.items ?? []) if (e.id !== editId) t.set(e.date, (t.get(e.date) ?? 0) + e.amount)
    return new Map([...t].map(([k, v]) => [k, `${f(v)} planned`]))
  }, [plan, editId, f])

  function save(again: boolean) {
    if ((amount ?? 0) <= 0) {
      amountBox.current?.querySelector('input')?.focus()
      return toast.error('Type how much it will cost.')
    }
    if (!picked) return toast.error(cats.length ? 'Pick a category.' : 'Choose your categories first.')
    const data = { date, amount: amount!, name, category, place, notes: notesOpen ? notes : '', ...(accounts.length ? { account } : {}) }
    if (accounts.length) {
      try {
        localStorage.setItem(PAID_KEY, account)
      } catch {
        // Not remembered: fine.
      }
    }
    const s = useStore.getState()
    const what = name.trim() || picked.label
    if (editing) {
      s.updateNeedItem(editing.id, data)
      if (send !== wasSent) s.setNeedsSent([editing.id], send)
      toast.success(send === wasSent ? `Updated “${what}”.` : send ? `Updated “${what}” and sent it to Expenses.` : `Updated “${what}” and took it out of Expenses.`)
      return close()
    }
    const before = walletState(s.wallet, s.expenses)
    s.addNeedItem(data, send)
    // Sent to Expenses: say what's left in the account it comes out of, like adding an expense does.
    const now = useStore.getState()
    const after = walletState(now.wallet, now.expenses)
    const from = after?.accounts.find((a) => a.account.id === account)
    const leftIn = send && before && after && from && after.total !== before.total ? ` ${f(from.balance)} left in ${from.account.name}.` : ''
    toast.success(`Added ${f(amount!)} · ${what} to Week ${week.n}${send ? ' and to Expenses' : ''}.${leftIn}`)
    if (!again) return close()
    // Ready for the next one: same day and category, everything else cleared.
    setAmount(null)
    setName('')
    setPlace('')
    setNotes('')
    setNotesOpen(false)
    setSend(false)
    setAdded((n) => n + 1)
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

  const d = fromKey(date)
  const shortDate = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  const other = date !== today && date !== tomorrow

  return (
    <>
      <Modal
        title={editing ? 'Edit need' : 'Add need'}
        subtitle={added > 0 ? `${added} added · keep going, or close when done` : `${longDate(date)} · Week ${week.n}`}
        onClose={close}
        width="max-w-3xl"
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <>
                <button
                  type="button"
                  onClick={remove}
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 sm:h-10"
                >
                  <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
                </button>
                <button
                  type="button"
                  onClick={copyToNextWeek}
                  title="Copy to next week"
                  className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-zinc-100 sm:h-10"
                >
                  <Copy className="h-4 w-4" /> <span className="hidden sm:inline">Copy to next week</span>
                </button>
              </>
            )}
            <span className="flex-1" />
            {!editing && (
              <button
                type="button"
                onClick={() => save(true)}
                disabled={!ready}
                className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40 sm:h-10"
              >
                Save &amp; add another
              </button>
            )}
            <button
              type="button"
              onClick={() => save(false)}
              disabled={!ready}
              className="h-11 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-400 px-6 text-sm font-semibold text-emerald-950 shadow-lg shadow-emerald-500/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:h-10"
            >
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        }
      >
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_19rem] sm:gap-6" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save(false)}>
          <div className="min-w-0 space-y-5">
            {/* How much */}
            <Section label="How much" required>
              <div ref={amountBox}>
                <MoneyInput value={amount} nullable onChange={(v) => setAmount(v || null)} size="md" placeholder="0" autoFocus={!editing} ariaLabel="How much it will cost" key={added} />
              </div>
              {hasBudget && (
                <p className="mt-1.5 text-xs text-zinc-500">
                  Left in {MONTHS[d.getMonth()]} after this: <span className={`font-semibold tabular-nums ${left < 0 ? 'text-red-300' : 'text-zinc-200'}`}>{f(left)}</span>
                </p>
              )}
            </Section>

            {/* When (phones: a row that unfolds the calendar) */}
            <div className="sm:hidden">
              <Section label="When" required>
                <div className="flex flex-wrap gap-1.5">
                  <Chip on={date === today} onClick={() => setDate(today)} cls={ON}>
                    Today
                  </Chip>
                  <Chip on={date === tomorrow} onClick={() => setDate(tomorrow)} cls={ON}>
                    Tomorrow
                  </Chip>
                  <button
                    type="button"
                    onClick={() => setCalOpen((o) => !o)}
                    aria-expanded={calOpen}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${other ? ON : 'border-white/10 text-zinc-300 hover:border-white/20'}`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {other ? shortDate : 'Pick a day'}
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${calOpen ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <div className={`grid transition-all duration-300 ease-out ${calOpen ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!calOpen}>
                  <div className="min-h-0 overflow-hidden">
                    <Calendar value={date} onChange={setDate} marks={marks} />
                  </div>
                </div>
              </Section>
            </div>

            <NameField
              label="What will it be"
              placeholder={picked?.items[0] ? `e.g. ${picked.items[0]}` : 'e.g. Groceries, Load, Rent'}
              name={name}
              setName={setName}
              category={category}
              setCategory={(c) => {
                if (cats.some((x) => x.id === c)) setCategory(c)
              }}
              amount={amount}
              setAmount={setAmount}
              place={place}
              setPlace={setPlace}
            />

            {accounts.length > 1 && (
              <Section label="Paying with">
                <AccountPicker accounts={accounts} value={account} onChange={setAccount} />
              </Section>
            )}

            {/* Category: the ones this mode offers. Needed, since it's how Needs groups things. */}
            <Section label="Category" required>
              {cats.length === 0 ? (
                <button type="button" onClick={() => setPicking(true)} className="w-full rounded-2xl border border-dashed border-white/15 py-4 text-sm font-medium text-zinc-300 transition hover:border-emerald-400/40">
                  Choose your categories first
                </button>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {cats.map((c) => {
                    const Icon = catIcon(c)
                    const col = catColor(c)
                    const on = category === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setCategory(c.id)
                          // A category with just one usual thing names it too, when nothing's typed yet.
                          if (!on && !name.trim() && c.items.length === 1) setName(c.items[0])
                        }}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
                          on ? `${col.soft} border-transparent text-white ring-1 ${col.ring}` : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
                        }`}
                      >
                        <Icon className={`h-3.5 w-3.5 ${col.text}`} /> {c.label}
                      </button>
                    )
                  })}
                  <button
                    type="button"
                    onClick={() => setPicking(true)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-sm text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Edit
                  </button>
                </div>
              )}
            </Section>

            <PlaceField place={place} setPlace={setPlace} onEdit={() => setPlaces(true)} />

            {notesOpen ? (
              <Section label="Notes" onClear={() => (setNotes(''), setNotesOpen(false))}>
                <textarea
                  value={notes}
                  autoFocus={!editing?.notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  maxLength={2000}
                  placeholder="Anything to remember about it"
                  className="block min-h-[3.5rem] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-base text-zinc-100 outline-none transition [field-sizing:content] placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
                />
              </Section>
            ) : (
              <button type="button" onClick={() => setNotesOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-zinc-500 transition hover:text-zinc-200">
                <NotebookPen className="h-4 w-4" /> Add a note
              </button>
            )}

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
                <span className="block text-xs leading-relaxed text-zinc-400">{send ? 'Counts in Expenses too.' : 'Off: stays in Needs only.'}</span>
              </span>
              <span className={`relative h-6 w-10 shrink-0 rounded-full transition ${send ? 'bg-emerald-400' : 'bg-white/15'}`}>
                <span className={`absolute top-0.5 grid h-5 w-5 place-items-center rounded-full bg-white shadow transition-all ${send ? 'left-[18px] text-emerald-600' : 'left-0.5 text-transparent'}`}>
                  <Check className="h-3 w-3" strokeWidth={3.5} />
                </span>
              </span>
            </button>
          </div>

          {/* When (wider screens: the calendar is always showing) */}
          <div className="hidden sm:block">
            <Section label="When" required>
              <div className="mb-2 flex gap-1.5">
                <Chip on={date === today} onClick={() => setDate(today)} cls={ON}>
                  Today
                </Chip>
                <Chip on={date === tomorrow} onClick={() => setDate(tomorrow)} cls={ON}>
                  Tomorrow
                </Chip>
              </div>
              <Calendar value={date} onChange={setDate} marks={marks} />
              <p className="mt-2 text-center text-xs text-zinc-500">{longDate(date)}</p>
              <p className="mt-0.5 text-center text-[11px] text-zinc-600">
                Week {week.n} · {weekLabel(week)}
              </p>
            </Section>
          </div>
        </div>
      </Modal>
      {picking && <NeedsPicker onClose={() => setPicking(false)} />}
      {places && <ExpenseSettings tab="places" onClose={() => setPlaces(false)} />}
    </>
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
