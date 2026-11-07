import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, CalendarDays, Check, ChevronDown, History, Link2, MapPin, NotebookPen, Settings2, StickyNote, Tag, X } from 'lucide-react'
import { Modal } from '../Modal'
import { Calendar } from '../Calendar'
import { LinksEditor, emptyDraft, withDraft, type LinkDraft } from '../ItemLinks'
import { DEFAULT_KINDS, TREND, kindColor, kindIcon } from '../../lib/meta'
import { DEFAULT_EXPENSE_CATS, MAX_ITEM_NAME, MAX_PLACE_NAME, addDays, catColor, catIcon, fromKey, longDate } from '../../lib/expenses'
import { MAX_LINKS, pastedUrl } from '../../lib/links'
import { parseMoney, plain } from '../../lib/money'
import { MONTHS_SHORT } from '../../lib/time'
import type { Category, ItemLink, Trend } from '../../lib/types'

/*
 * The app's "Add an item" and "Add expense" windows, for the playgrounds on the About page.
 * Same layout, steps, choices and wording as in the app, but they only hand what was typed back to the page:
 * nothing touches the account, the device or the server.
 */

const peso = (n: number) => `${n < -0.005 ? '−' : ''}₱${Math.round(Math.abs(n)).toLocaleString('en-US')}`

// ---- Money box (the app's MoneyInput, always in pesos) ----

const toText = (v: number | null) => (v === null || v === 0 ? '' : plain(v))

function MoneyBox({ value, onChange, placeholder = '0', ariaLabel, autoFocus }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; ariaLabel?: string; autoFocus?: boolean }) {
  const [text, setText] = useState(() => toText(value))
  const [focused, setFocused] = useState(false)
  const [bad, setBad] = useState(false)

  useEffect(() => {
    if (!focused) setText(toText(value))
  }, [value, focused])

  function handle(t: string) {
    setText(t)
    const p = parseMoney(t)
    if (p === null) {
      setBad(false)
      onChange(null)
    } else if (Number.isNaN(p)) setBad(true)
    else {
      setBad(false)
      onChange(p)
    }
  }

  return (
    <div className="relative min-w-0">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-base text-zinc-500">₱</span>
      <input
        inputMode="decimal"
        autoComplete="off"
        aria-label={ariaLabel}
        aria-invalid={bad}
        autoFocus={autoFocus}
        value={text}
        placeholder={placeholder}
        onFocus={(e) => {
          setFocused(true)
          e.currentTarget.select()
        }}
        onBlur={() => {
          setFocused(false)
          setBad(false)
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onChange={(e) => handle(e.target.value)}
        className={`h-11 w-full min-w-0 rounded-lg border bg-black/30 pl-8 pr-2 text-base font-medium tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:bg-black/50 ${
          bad ? 'border-red-500/60 focus:ring-2 focus:ring-red-500/30' : 'border-white/10 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'
        }`}
      />
    </div>
  )
}

/** "Edit kinds" and "Edit" open settings in the app. Here they say so instead. */
function InAppHint({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null
  return <p className="animate-fade mb-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2 text-xs text-zinc-400">{children}</p>
}

// ---- Add an item ----

export type NewItem = { name: string; category: Category; trend: Trend; price: number; rate: number; notes: string; links?: ItemLink[] }

const KIND_COLS = ['', 'sm:grid-cols-1', 'sm:grid-cols-2', 'sm:grid-cols-3', 'sm:grid-cols-4', 'sm:grid-cols-5', 'sm:grid-cols-3']

/**
 * `budget`: the month's budget. `spent`: what its items cost so far. `available`: the month's money before its items.
 */
export function DemoItemModal({ month, budget, spent, available, onAdd, onClose }: {
  month: string; budget: number; spent: number; available: number; onAdd: (item: NewItem) => void; onClose: () => void
}) {
  const kinds = DEFAULT_KINDS
  const [category, setCategory] = useState<Category | null>(null)
  const [trend, setTrend] = useState<Trend | null>(null)
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number | null>(null)
  const [rate, setRate] = useState('')
  const [rateTouched, setRateTouched] = useState(false)
  const [notes, setNotes] = useState('')
  const [links, setLinks] = useState<ItemLink[]>([])
  const [linkDraft, setLinkDraft] = useState<LinkDraft | null>(null)
  const [notesOpen, setNotesOpen] = useState(false)
  const [kindsHint, setKindsHint] = useState(false)

  const limit = Math.min(budget > 0 ? budget : Infinity, available)
  const left = limit - spent
  const after = spent + (price ?? 0)
  const why: string[] = []
  if (budget > 0 && after > budget + 1e-9) why.push(`this goes ${peso(after - budget)} over the ${peso(budget)} budget`)
  if (after > available + 1e-9) why.push(available > 0 ? `this goes ${peso(after - available)} over the ${peso(available)} money left` : 'there is no money left')
  const warning = why.length ? `Not enough in ${month}: ${why.join(', and ')}. Marked red — move it to another month.` : null
  const rateNum = trend === 'stable' ? 0 : Math.min(100, Math.max(0, parseFloat(rate) || 0))
  const ready = !!category && !!trend && name.trim().length > 0 && !!price && price > 0
  const remaining = left - (price ?? 0)
  const kindOf = (id: Category) => kinds.find((k) => k.id === id)!

  function pickTrend(t: Trend) {
    setTrend(t)
    if (!rateTouched) setRate(t === 'stable' ? '0' : String(TREND[t].defaultRate))
  }

  function save() {
    if (!ready) return
    const allLinks = withDraft(links, linkDraft)
    if (!allLinks) {
      setNotesOpen(true)
      setLinkDraft({ ...linkDraft!, bad: true, focus: 'url' })
      return
    }
    onAdd({ name: name.trim(), category: category!, trend: trend!, price: price!, rate: rateNum, notes: notes.trim(), links: allLinks.length ? allLinks : undefined })
    onClose()
  }

  return (
    <Modal
      title="Add an item"
      subtitle={month}
      onClose={onClose}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Left after this: <span className={`font-semibold tabular-nums ${remaining < 0 ? 'text-red-300' : 'text-zinc-200'}`}>{peso(remaining)}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={onClose} className="h-11 flex-1 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 sm:h-10 sm:flex-none sm:border-transparent">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!ready}
              className="h-11 flex-[2] rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none sm:h-10 sm:flex-none"
            >
              Add item
            </button>
          </div>
        </div>
      }
    >
      <form
        className="space-y-6"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-2.5 text-center sm:p-3">
          <Info k="Budget" v={budget > 0 ? peso(budget) : '—'} />
          <Info k="Already spent" v={peso(spent)} />
          <Info k="Left to spend" v={peso(left)} cls={left <= 0 ? 'text-red-300' : 'text-emerald-300'} />
        </div>

        <Step
          n={1}
          title="What kind of item is it?"
          done={!!category}
          aside={
            <button
              type="button"
              onClick={() => setKindsHint((h) => !h)}
              aria-expanded={kindsHint}
              className="-my-1 ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <Settings2 className="h-3.5 w-3.5" /> Edit kinds
            </button>
          }
        >
          <InAppHint show={kindsHint}>In Dizayr you can rename these, add your own kinds, and pick their icon and colour.</InAppHint>
          <div className={`grid grid-cols-2 gap-2 ${KIND_COLS[Math.min(kinds.length, 6)]}`}>
            {kinds.map((k) => {
              const Icon = kindIcon(k)
              const on = category === k.id
              return (
                <Choice key={k.id} on={on} onClick={() => setCategory(k.id)} ringCls="ring-indigo-400/70" onCls="border-indigo-400/60 bg-indigo-500/15">
                  <Icon className={`h-6 w-6 ${on ? kindColor(k).text : 'text-zinc-400'}`} />
                  <span className="break-words text-sm font-semibold text-white">{k.label}</span>
                  {k.hint.trim() && <span className="text-[11px] leading-tight text-zinc-500">{k.hint}</span>}
                </Choice>
              )
            })}
          </div>
        </Step>

        <Step n={2} title="How does its value change?" done={!!trend}>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(TREND) as Trend[]).map((k) => {
              const t = TREND[k]
              const on = trend === k
              return (
                <Choice key={k} on={on} onClick={() => pickTrend(k)} ringCls={t.ring} onCls={`${t.border} ${t.bg}`}>
                  <span className={`grid h-8 w-8 place-items-center rounded-full ${t.iconBg} ${t.text}`}>
                    <t.icon className="h-4 w-4" />
                  </span>
                  <span className={`text-sm font-semibold ${t.text}`}>{t.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500">{t.hint}</span>
                </Choice>
              )
            })}
          </div>
        </Step>

        <Step n={3} title="Details" done={name.trim().length > 0 && !!price}>
          <div className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Name</span>
              <input
                value={name}
                maxLength={60}
                onChange={(e) => setName(e.target.value)}
                placeholder={category && kindOf(category).hint.trim() ? `e.g. ${kindOf(category).hint.split(',')[0].trim()}` : 'e.g. Toyota Fortuner'}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-400">Price</span>
                <MoneyBox value={price} onChange={setPrice} placeholder="e.g. 250k" />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-400">
                  {trend === 'appreciating' ? 'Grows per year (%)' : trend === 'depreciating' ? 'Drops per year (%)' : 'Change per year (%)'}
                </span>
                <input
                  inputMode="decimal"
                  value={trend === 'stable' ? '0' : rate}
                  disabled={!trend || trend === 'stable'}
                  onChange={(e) => {
                    setRate(e.target.value.replace(/[^\d.]/g, ''))
                    setRateTouched(true)
                  }}
                  placeholder="%"
                  className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-base tabular-nums text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-40"
                />
              </label>
            </div>
            <p className="text-[11px] text-zinc-500">Tip: you can type 250k, 1.5m, or 250,000 (all amounts are in pesos).</p>
          </div>
        </Step>

        <section>
          <button type="button" onClick={() => setNotesOpen((o) => !o)} aria-expanded={notesOpen} className="group flex w-full items-center gap-2.5 text-left">
            <span className={`grid h-6 w-6 place-items-center rounded-full transition ${notes.trim() || links.length ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10 text-zinc-300'}`}>
              <StickyNote className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-zinc-200">Notes &amp; links</span>
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">optional</span>
            {!notesOpen && links.length > 0 && (
              <span className="inline-flex shrink-0 items-center gap-1 text-xs text-sky-200/80">
                <Link2 className="h-3 w-3" /> {links.length}
              </span>
            )}
            {!notesOpen && notes.trim() && <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{notes.trim()}</span>}
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:text-zinc-300 ${notesOpen ? 'rotate-180' : ''}`} />
          </button>
          {notesOpen && (
            <div className="animate-fade">
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                onPaste={(e) => {
                  const url = pastedUrl(e.clipboardData.getData('text'))
                  if (!url || linkDraft || links.length >= MAX_LINKS) return
                  e.preventDefault()
                  setLinkDraft(emptyDraft(url))
                }}
                autoFocus
                rows={3}
                maxLength={2000}
                placeholder="Anything to remember: where to buy it, the exact model, why you want it…"
                className="mt-2.5 block min-h-[5.5rem] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-base leading-relaxed text-zinc-100 outline-none transition [field-sizing:content] placeholder:text-zinc-600 hover:border-white/20 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/15 sm:text-sm"
              />
              <LinksEditor links={links} onChange={setLinks} draft={linkDraft} setDraft={setLinkDraft} note={notes} onNote={setNotes} />
            </div>
          )}
        </section>

        {!!price && warning && (
          <div role="alert" className="animate-fade flex gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <p>{warning} You can still add it.</p>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function Step({ n, title, done, aside, children }: { n: number; title: string; done: boolean; aside?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition ${done ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-zinc-300'}`}>
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
        </span>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
        {aside}
      </div>
      {children}
    </section>
  )
}

function Choice(props: { on: boolean; onClick: () => void; onCls: string; ringCls: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      aria-pressed={props.on}
      className={`flex flex-col items-center gap-1.5 rounded-2xl border px-2 py-3.5 text-center transition ${
        props.on ? `${props.onCls} ring-2 ${props.ringCls}` : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      {props.children}
    </button>
  )
}

function Info({ k, v, cls = 'text-zinc-100' }: { k: string; v: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className={`truncate text-sm font-semibold tabular-nums ${cls}`}>{v}</p>
    </div>
  )
}

// ---- Add expense ----

export type NewExpense = { date: string; amount: number; name: string; category: string; place: string; notes: string }

const field =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm'

/**
 * `today`: the day the playground treats as today. `min`/`max`: the days that can be picked.
 * `past`: expenses already in the playground, for the same suggestions the app makes from your history.
 */
export function DemoExpenseModal({ today, min, max, past, onAdd, onClose }: {
  today: string; min: string; max: string; past: NewExpense[]; onAdd: (e: NewExpense) => void; onClose: () => void
}) {
  const [amount, setAmount] = useState<number | null>(null)
  const [date, setDate] = useState(today)
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [place, setPlace] = useState('')
  const [notes, setNotes] = useState('')
  const [notesOpen, setNotesOpen] = useState(false)
  const [calOpen, setCalOpen] = useState(false)
  const [added, setAdded] = useState(0)
  const amountBox = useRef<HTMLDivElement>(null)
  const yesterday = addDays(today, -1)
  const hasYesterday = yesterday >= min
  const ok = (amount ?? 0) > 0

  function save(again: boolean) {
    if (!ok) return amountBox.current?.querySelector('input')?.focus()
    onAdd({ date, amount: amount!, name: name.trim(), category, place: place.trim(), notes: notesOpen ? notes.trim() : '' })
    if (!again) return onClose()
    setAmount(null)
    setName('')
    setCategory('')
    setPlace('')
    setNotes('')
    setNotesOpen(false)
    setAdded((n) => n + 1)
    requestAnimationFrame(() => amountBox.current?.querySelector('input')?.focus())
  }

  // Spending per day, as dots on the calendar.
  const marks = useMemo(() => {
    const t = new Map<string, number>()
    for (const e of past) t.set(e.date, (t.get(e.date) ?? 0) + e.amount)
    return new Map([...t].map(([k, v]) => [k, `${peso(v)} spent`]))
  }, [past])

  const d = fromKey(date)
  const shortDate = `${MONTHS_SHORT[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`
  const picked = date !== today && date !== yesterday

  const dayChips = (
    <>
      <Chip on={date === today} onClick={() => setDate(today)}>
        Today
      </Chip>
      {hasYesterday && (
        <Chip on={date === yesterday} onClick={() => setDate(yesterday)}>
          Yesterday
        </Chip>
      )}
    </>
  )

  return (
    <Modal
      title="Add expense"
      subtitle={added > 0 ? `${added} added · keep going, or close when done` : longDate(date)}
      onClose={onClose}
      width="max-w-3xl"
      footer={
        <div className="flex items-center gap-2">
          <span className="flex-1" />
          <button onClick={() => save(true)} disabled={!ok} className="h-11 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-40 sm:h-10">
            Save &amp; add another
          </button>
          <button
            onClick={() => save(false)}
            disabled={!ok}
            className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:opacity-40 disabled:shadow-none sm:h-10"
          >
            Add
          </button>
        </div>
      }
    >
      <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_19rem] sm:gap-6" onKeyDown={(e) => (e.metaKey || e.ctrlKey) && e.key === 'Enter' && save(false)}>
        <div className="min-w-0 space-y-5">
          <Section label="How much" required>
            <div ref={amountBox}>
              <MoneyBox value={amount} onChange={setAmount} placeholder="0" autoFocus ariaLabel="Amount spent" key={added} />
            </div>
          </Section>

          {/* When (phones: a row that unfolds the calendar) */}
          <div className="sm:hidden">
            <Section label="When" required>
              <div className="flex flex-wrap gap-1.5">
                {dayChips}
                <button
                  type="button"
                  onClick={() => setCalOpen((o) => !o)}
                  aria-expanded={calOpen}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition ${
                    picked ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" />
                  {picked ? shortDate : 'Pick a day'}
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${calOpen ? 'rotate-180' : ''}`} />
                </button>
              </div>
              <div className={`grid transition-all duration-300 ease-out ${calOpen ? 'mt-2.5 grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!calOpen}>
                <div className="min-h-0 overflow-hidden">
                  <Calendar value={date} onChange={setDate} marks={marks} min={min} max={max} />
                </div>
              </div>
            </Section>
          </div>

          <NameField name={name} setName={setName} category={category} setCategory={setCategory} amount={amount} setAmount={setAmount} place={place} setPlace={setPlace} past={past} />
          <CategoryField category={category} setCategory={setCategory} name={name} setName={setName} />
          <PlaceField place={place} setPlace={setPlace} past={past} />

          {notesOpen ? (
            <Section label="Notes" onClear={() => (setNotes(''), setNotesOpen(false))}>
              <textarea
                value={notes}
                autoFocus
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
        </div>

        {/* When (wider screens: the calendar is always showing) */}
        <div className="hidden sm:block">
          <Section label="When" required>
            <div className="mb-2 flex gap-1.5">{dayChips}</div>
            <Calendar value={date} onChange={setDate} marks={marks} min={min} max={max} />
            <p className="mt-2 text-center text-xs text-zinc-500">{longDate(date)}</p>
          </Section>
        </div>
      </div>
    </Modal>
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

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`inline-flex h-9 max-w-full items-center gap-1.5 rounded-full border px-3 text-sm font-medium transition active:scale-95 ${
        on ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-300 hover:border-white/20 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

const catById = (id: string) => DEFAULT_EXPENSE_CATS.find((c) => c.id === id)

/** "What was it?" with suggestions: the category's usual things first, then what was typed before in the playground. */
function NameField(props: {
  name: string; setName: (v: string) => void; category: string; setCategory: (v: string) => void
  amount: number | null; setAmount: (v: number) => void; place: string; setPlace: (v: string) => void; past: NewExpense[]
}) {
  const { name, setName, category, past } = props
  const q = name.trim().toLowerCase()
  const usual = catById(category)?.items ?? []
  // Newest first, one per name.
  const names = useMemo(() => {
    const seen = new Set<string>()
    return [...past].reverse().filter((e) => e.name && !seen.has(e.name.toLowerCase()) && seen.add(e.name.toLowerCase()))
  }, [past])
  const last = names.find((n) => n.name.toLowerCase() === q)

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
      {last && (last.amount !== props.amount || (last.place && !props.place)) && (
        <div className="animate-fade mt-2 flex flex-wrap items-center gap-1.5 text-xs text-zinc-500">
          <History className="h-3.5 w-3.5" /> Last time:
          {last.amount !== props.amount && (
            <button type="button" onClick={() => props.setAmount(last.amount)} className="rounded-full bg-white/[0.06] px-2 py-0.5 font-medium tabular-nums text-zinc-200 transition hover:bg-white/10">
              {peso(last.amount)}
            </button>
          )}
          {last.place && !props.place && (
            <button type="button" onClick={() => props.setPlace(last.place)} className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 font-medium text-zinc-200 transition hover:bg-white/10">
              <MapPin className="h-3 w-3" /> {last.place}
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

function CategoryField({ category, setCategory, name, setName }: { category: string; setCategory: (v: string) => void; name: string; setName: (v: string) => void }) {
  const [hint, setHint] = useState(false)
  return (
    <Section label="Category">
      <InAppHint show={hint}>In Dizayr you can rename these, add your own categories, and set what each one suggests.</InAppHint>
      <div className="flex flex-wrap gap-1.5">
        {DEFAULT_EXPENSE_CATS.map((c) => {
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
          onClick={() => setHint((h) => !h)}
          aria-expanded={hint}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-sm text-zinc-500 transition hover:border-white/30 hover:text-zinc-200"
        >
          <Settings2 className="h-3.5 w-3.5" /> Edit
        </button>
      </div>
    </Section>
  )
}

/** Where: places used before in the playground (no saved places here). */
function PlaceField({ place, setPlace, past }: { place: string; setPlace: (v: string) => void; past: NewExpense[] }) {
  const q = place.trim().toLowerCase()
  const options = useMemo(() => {
    const count = new Map<string, { name: string; count: number }>()
    for (const e of past) {
      if (!e.place) continue
      const k = e.place.toLowerCase()
      count.set(k, { name: count.get(k)?.name ?? e.place, count: (count.get(k)?.count ?? 0) + 1 })
    }
    return [...count.entries()]
      .filter(([k]) => k !== q && (!q || k.includes(q)))
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([, v]) => v)
  }, [past, q])

  return (
    <Section label="Where">
      <div className="relative">
        <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
        <input value={place} maxLength={MAX_PLACE_NAME} onChange={(e) => setPlace(e.target.value)} placeholder="e.g. SM North, 7-Eleven, Home" className={`${field} pl-9`} />
      </div>
      {options.length > 0 && (
        <div className="scrollbar-none -mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-0.5 sm:flex-wrap sm:overflow-visible">
          {options.map((o) => (
            <button
              key={o.name}
              type="button"
              onClick={() => setPlace(o.name)}
              title={`Used ${o.count} time${o.count > 1 ? 's' : ''}`}
              className="inline-flex h-8 shrink-0 items-center gap-1 rounded-full border border-dashed border-white/15 px-3 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-zinc-200 active:scale-95"
            >
              <MapPin className="h-3 w-3" />
              {o.name}
            </button>
          ))}
        </div>
      )}
    </Section>
  )
}
