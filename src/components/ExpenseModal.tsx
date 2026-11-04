import { useMemo, useRef, useState, type ReactNode } from 'react'
import { CalendarDays, ChevronDown, History, MapPin, NotebookPen, Plus, Settings2, Star, Tag, Trash2, X } from 'lucide-react'
import { useFmt, useStore } from '../store'
import { useCatOf, useExpenseCats, useHistory } from '../expenseHooks'
import { MAX_ITEM_NAME, MAX_PLACE_NAME, addDays, catColor, catIcon, dayLabel, fromKey, longDate, todayKey } from '../lib/expenses'
import { MONTHS_SHORT } from '../lib/time'
import { Calendar } from './Calendar'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { ExpenseSettings, type SettingsTab } from './ExpenseSettings'
import { toast } from '../toast'

const field =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm'

/** Add or edit an expense. Only the amount and the day are needed. */
export function ExpenseModal({ editId, date: startDate }: { editId?: string; date?: string }) {
  const editing = useStore((s) => (editId ? s.expenses.find((e) => e.id === editId) : undefined))
  const close = useStore((s) => s.closeModal)
  const f = useFmt()

  const [amount, setAmount] = useState<number | null>(editing?.amount ?? null)
  const [date, setDate] = useState(editing?.date ?? startDate ?? todayKey())
  const [name, setName] = useState(editing?.name ?? '')
  const [category, setCategory] = useState(editing?.category ?? '')
  const [place, setPlace] = useState(editing?.place ?? '')
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  const [calOpen, setCalOpen] = useState(false)
  const [settings, setSettings] = useState<SettingsTab | null>(null)
  const [added, setAdded] = useState(0)
  const amountBox = useRef<HTMLDivElement>(null)

  const ok = (amount ?? 0) > 0
  const today = todayKey()

  function save(again: boolean) {
    if (!ok) {
      amountBox.current?.querySelector('input')?.focus()
      return toast.error('Type how much was spent.')
    }
    const data = { date, amount: amount!, name, category, place, notes: notesOpen ? notes : '' }
    const s = useStore.getState()
    if (editing) {
      s.updateExpense(editing.id, data)
      toast.success('Expense updated.')
      return close()
    }
    s.addExpense(data)
    const what = name.trim() || (category ? s.expenseCats.find((c) => c.id === category)?.label : '') || 'Expense'
    toast.success(`Added ${f(amount!)} · ${what}${date === today ? '' : ` · ${dayLabel(date)}`}.`)
    if (!again) return close()
    // Ready for the next one: same day, everything else cleared.
    setAmount(null)
    setName('')
    setCategory('')
    setPlace('')
    setNotes('')
    setNotesOpen(false)
    setAdded((n) => n + 1)
    requestAnimationFrame(() => amountBox.current?.querySelector('input')?.focus())
  }

  function remove() {
    if (!editing) return
    const gone = useStore.getState().removeExpense(editing.id)
    close()
    if (gone) toast.undo(`Deleted ${f(gone.amount)}${gone.name ? ` · ${gone.name}` : ''}.`, () => useStore.getState().restoreExpense(gone))
  }

  // Spending per day, as dots on the calendar.
  const expenses = useStore((s) => s.expenses)
  const marks = useMemo(() => {
    const t = new Map<string, number>()
    for (const e of expenses) t.set(e.date, (t.get(e.date) ?? 0) + e.amount)
    return new Map([...t].map(([k, v]) => [k, `${f(v)} spent`]))
  }, [expenses, f])

  const d = fromKey(date)
  const shortDate = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`

  return (
    <>
      <Modal
        title={editing ? 'Edit expense' : 'Add expense'}
        subtitle={added > 0 ? `${added} added · keep going, or close when done` : longDate(date)}
        onClose={close}
        width="max-w-3xl"
        footer={
          <div className="flex items-center gap-2">
            {editing && (
              <button
                onClick={remove}
                className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 transition hover:bg-red-500/10 hover:text-red-300 sm:h-10"
              >
                <Trash2 className="h-4 w-4" /> <span className="hidden sm:inline">Delete</span>
              </button>
            )}
            <span className="flex-1" />
            {!editing && (
              <button
                onClick={() => save(true)}
                disabled={!ok}
                className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40 sm:h-10"
              >
                Save &amp; add another
              </button>
            )}
            <button
              onClick={() => save(false)}
              disabled={!ok}
              className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:h-10"
            >
              {editing ? 'Save' : 'Add'}
            </button>
          </div>
        }
      >
        <div
          className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_19rem] sm:gap-6"
          onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save(false)}
        >
          <div className="min-w-0 space-y-5">
            {/* How much */}
            <Section label="How much" required>
              <div ref={amountBox}>
                <MoneyInput value={amount} nullable onChange={setAmount} size="md" placeholder="0" autoFocus={!editing} ariaLabel="Amount spent" key={added} />
              </div>
            </Section>

            {/* When (phones: a row that unfolds the calendar) */}
            <div className="sm:hidden">
              <Section label="When" required>
                <div className="flex flex-wrap gap-1.5">
                  <Chip on={date === today} onClick={() => setDate(today)}>
                    Today
                  </Chip>
                  <Chip on={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>
                    Yesterday
                  </Chip>
                  <button
                    type="button"
                    onClick={() => setCalOpen((o) => !o)}
                    aria-expanded={calOpen}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                      date !== today && date !== addDays(today, -1)
                        ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100'
                        : 'border-white/10 text-zinc-300 hover:border-white/20'
                    }`}
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    {date !== today && date !== addDays(today, -1) ? shortDate : 'Pick a day'}
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

            <NameField name={name} setName={setName} category={category} setCategory={setCategory} amount={amount} setAmount={setAmount} setPlace={setPlace} place={place} />

            <CategoryField category={category} setCategory={setCategory} setName={setName} name={name} onEdit={() => setSettings('categories')} />

            <PlaceField place={place} setPlace={setPlace} onEdit={() => setSettings('places')} />

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
              <button
                type="button"
                onClick={() => setNotesOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm text-zinc-500 transition hover:text-zinc-200"
              >
                <NotebookPen className="h-4 w-4" /> Add a note
              </button>
            )}
          </div>

          {/* When (wider screens: the calendar is always showing) */}
          <div className="hidden sm:block">
            <Section label="When" required>
              <div className="mb-2 flex gap-1.5">
                <Chip on={date === today} onClick={() => setDate(today)}>
                  Today
                </Chip>
                <Chip on={date === addDays(today, -1)} onClick={() => setDate(addDays(today, -1))}>
                  Yesterday
                </Chip>
              </div>
              <Calendar value={date} onChange={setDate} marks={marks} />
              <p className="mt-2 text-center text-xs text-zinc-500">{longDate(date)}</p>
            </Section>
          </div>
        </div>
      </Modal>
      {settings && <ExpenseSettings tab={settings} onClose={() => setSettings(null)} />}
    </>
  )
}

function Section({ label, required, onClear, children }: { label: string; required?: boolean; onClear?: () => void; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-zinc-400">
          {label}
          {!required && <span className="ml-1.5 font-normal text-zinc-600">optional</span>}
        </span>
        {onClear && (
          <button type="button" onClick={onClear} aria-label={`Remove ${label.toLowerCase()}`} className="rounded-md p-1 text-zinc-500 transition hover:bg-white/5 hover:text-white">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      {children}
    </div>
  )
}

function Chip({ on, onClick, children, cls }: { on: boolean; onClick: () => void; children: ReactNode; cls?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
        on ? (cls ?? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100') : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

/** "What was it?" with suggestions: the category's usual things first, then what was typed before. */
function NameField(props: {
  name: string
  setName: (v: string) => void
  category: string
  setCategory: (v: string) => void
  amount: number | null
  setAmount: (v: number) => void
  place: string
  setPlace: (v: string) => void
}) {
  const { name, setName, category } = props
  const f = useFmt()
  const catOf = useCatOf()
  const { names } = useHistory()
  const q = name.trim().toLowerCase()
  const usual = catOf(category).items
  const past = names.find((n) => n.name.toLowerCase() === q)

  const suggestions = useMemo(() => {
    const seen = new Set<string>([q])
    const out: { name: string; usual: boolean }[] = []
    const add = (n: string, u: boolean) => {
      const k = n.toLowerCase()
      if (seen.has(k) || (q && !k.includes(q))) return
      seen.add(k)
      out.push({ name: n, usual: u })
    }
    usual.forEach((n) => add(n, true))
    names.filter((n) => !category || n.category === category || q).forEach((n) => add(n.name, false))
    return out.slice(0, 8)
  }, [q, usual, names, category])

  function choose(n: string) {
    setName(n)
    const p = names.find((x) => x.name.toLowerCase() === n.toLowerCase())
    if (p && !category && p.category) props.setCategory(p.category)
  }

  return (
    <Section label="What was it">
      <div className="relative">
        <Tag className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input value={name} maxLength={MAX_ITEM_NAME} onChange={(e) => setName(e.target.value)} placeholder="e.g. Lunch, Grab ride, Groceries" className={`${field} pl-9`} />
      </div>
      {past && (past.amount !== props.amount || (past.place && !props.place)) && (
        <div className="animate-fade mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          <History className="h-3.5 w-3.5" /> Last time:
          {past.amount !== props.amount && (
            <button type="button" onClick={() => props.setAmount(past.amount)} className="rounded-full bg-white/[0.06] px-2 py-0.5 font-medium tabular-nums text-zinc-200 transition hover:bg-white/10">
              {f(past.amount)}
            </button>
          )}
          {past.place && !props.place && (
            <button type="button" onClick={() => props.setPlace(past.place)} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 font-medium text-zinc-200 transition hover:bg-white/10">
              <MapPin className="h-3 w-3" /> {past.place}
            </button>
          )}
        </div>
      )}
      {suggestions.length > 0 && (
        <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
          {suggestions.map((s) => (
            <button
              key={s.name}
              type="button"
              onClick={() => choose(s.name)}
              className={`h-8 shrink-0 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
                s.usual ? 'border-white/10 bg-white/[0.04] text-zinc-200 hover:border-white/25' : 'border-dashed border-white/15 text-zinc-400 hover:border-white/30 hover:text-zinc-200'
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}

function CategoryField({ category, setCategory, name, setName, onEdit }: { category: string; setCategory: (v: string) => void; name: string; setName: (v: string) => void; onEdit: () => void }) {
  const cats = useExpenseCats()
  return (
    <Section label="Category">
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
                setCategory(on ? '' : c.id)
                // A category with just one usual thing names the expense too, when nothing's typed yet.
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
          onClick={onEdit}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-sm text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
        >
          <Settings2 className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
    </Section>
  )
}

/** Where: saved places first, then places used before. The star saves the typed place for next time. */
function PlaceField({ place, setPlace, onEdit }: { place: string; setPlace: (v: string) => void; onEdit: () => void }) {
  const saved = useStore((s) => s.places)
  const { places: past } = useHistory()
  const q = place.trim().toLowerCase()
  const isSaved = !!q && saved.some((p) => p.toLowerCase() === q)

  const options = useMemo(() => {
    const seen = new Set<string>([q])
    const out: { name: string; saved: boolean; count: number }[] = []
    const add = (n: string, s: boolean, count = 0) => {
      const k = n.toLowerCase()
      if (seen.has(k) || (q && !k.includes(q))) return
      seen.add(k)
      out.push({ name: n, saved: s, count })
    }
    saved.forEach((p) => add(p, true, past.find((x) => x.name.toLowerCase() === p.toLowerCase())?.count ?? 0))
    past.forEach((p) => add(p.name, false, p.count))
    return out.slice(0, 10)
  }, [q, saved, past])

  function toggleSave() {
    const s = useStore.getState()
    if (isSaved) {
      s.removePlace(place)
      toast.info(`Removed “${place.trim()}” from your places.`)
    } else {
      s.addPlace(place)
      toast.success(`Saved “${place.trim()}” to your places.`)
    }
  }

  return (
    <Section label="Where">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input value={place} maxLength={MAX_PLACE_NAME} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. SM North, 7-Eleven, Home" className={`${field} pl-9 pr-11`} />
        {q && (
          <button
            type="button"
            onClick={toggleSave}
            aria-pressed={isSaved}
            title={isSaved ? 'Saved to your places · tap to remove' : 'Save to your places'}
            aria-label={isSaved ? 'Remove from your places' : 'Save to your places'}
            className="absolute right-1.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg transition hover:bg-white/[0.06] active:scale-90"
          >
            <Star className={`h-4 w-4 transition ${isSaved ? 'fill-amber-300 text-amber-300' : 'text-zinc-500'}`} />
          </button>
        )}
      </div>
      <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
        {options.map((o) => (
          <button
            key={o.name}
            type="button"
            onClick={() => setPlace(o.name)}
            title={o.count ? `Used ${o.count} time${o.count > 1 ? 's' : ''}` : undefined}
            className={`inline-flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
              o.saved ? 'border-amber-300/25 bg-amber-300/[0.06] text-amber-50 hover:border-amber-300/50' : 'border-dashed border-white/15 text-zinc-400 hover:border-white/30 hover:text-zinc-200'
            }`}
          >
            {o.saved ? <Star className="h-3 w-3 fill-amber-300 text-amber-300" /> : <MapPin className="h-3 w-3" />}
            {o.name}
          </button>
        ))}
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 text-xs text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
        >
          {saved.length ? <Settings2 className="h-3 w-3" /> : <Plus className="h-3 w-3" />} {saved.length ? 'Your places' : 'Add places you go often'}
        </button>
      </div>
    </Section>
  )
}
