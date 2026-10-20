import { useMemo, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Check, ChevronDown, MapPin, Plus, RotateCcw, Star, Tags, Trash2, X } from 'lucide-react'
import { useStore } from '../store'
import { useExpenseCats, useHistory } from '../expenseHooks'
import { DEFAULT_EXPENSE_CATS, EXPENSE_ICONS, MAX_CAT_NAME, MAX_ITEM_NAME, MAX_PLACE_NAME, catColor, catIcon } from '../lib/expenses'
import { KIND_COLORS } from '../lib/meta'
import type { ExpenseCategory } from '../lib/types'
import { Modal } from './Modal'
import { toast } from '../toast'

export type SettingsTab = 'categories' | 'places'

const input =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm'

/** Spending categories (with their usual things) and the places you go often. Every change applies right away. */
export function ExpenseSettings({ tab: startTab = 'categories', onClose }: { tab?: SettingsTab; onClose: () => void }) {
  const [tab, setTab] = useState<SettingsTab>(startTab)
  const tabs: { id: SettingsTab; label: string; icon: typeof Tags }[] = [
    { id: 'categories', label: 'Categories', icon: Tags },
    { id: 'places', label: 'Places', icon: MapPin },
  ]
  return (
    <Modal
      title="Expense settings"
      subtitle="Make the categories and places your own. They show up as one-tap choices when you add an expense."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex justify-end">
          <button
            onClick={onClose}
            className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:h-10"
          >
            Done
          </button>
        </div>
      }
    >
      <div role="tablist" className="relative mb-5 grid grid-cols-2 rounded-xl border border-white/10 bg-black/30 p-1">
        <span
          aria-hidden
          className="absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-lg bg-white/[0.08] ring-1 ring-white/10 transition-transform duration-300 ease-[cubic-bezier(0.34,1.3,0.64,1)]"
          style={{ transform: `translateX(${tab === 'places' ? 100 : 0}%)` }}
        />
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`relative inline-flex h-9 items-center justify-center gap-2 text-sm font-medium transition ${tab === t.id ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>
      <div key={tab} className="animate-fade">
        {tab === 'categories' ? <Categories /> : <Places />}
      </div>
    </Modal>
  )
}

// ---- Categories ----

function Categories() {
  const cats = useExpenseCats()
  const expenses = useStore((s) => s.expenses)
  const [openId, setOpenId] = useState<string | null>(null)
  const [fresh, setFresh] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const list = useRef<HTMLUListElement>(null)
  const counts = useMemo(() => {
    const n = new Map<string, number>()
    for (const e of expenses) n.set(e.category, (n.get(e.category) ?? 0) + 1)
    return n
  }, [expenses])
  const missing = DEFAULT_EXPENSE_CATS.filter((d) => !cats.some((c) => c.id === d.id))

  function add() {
    if (!draft.trim()) return
    const id = useStore.getState().addExpenseCat(draft)
    setDraft('')
    setOpenId(id)
    setFresh(id)
    requestAnimationFrame(() => list.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <div className="space-y-5">
      <ul ref={list} className="space-y-2">
        {cats.map((c, i) => (
          <CatRow
            key={c.id}
            cat={c}
            index={i}
            total={cats.length}
            count={counts.get(c.id) ?? 0}
            open={openId === c.id}
            fresh={fresh === c.id}
            onToggle={() => setOpenId((o) => (o === c.id ? null : c.id))}
          />
        ))}
        {cats.length === 0 && <li className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">No categories. Add one below.</li>}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">New category name</span>
          <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={draft} maxLength={MAX_CAT_NAME} onChange={(e) => setDraft(e.target.value)} placeholder="Add a category, e.g. Coffee, Pets, Rent" className={`${input} pl-9`} />
        </label>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-11 shrink-0 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-40 sm:h-10"
        >
          Add
        </button>
      </form>

      {missing.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-zinc-500">Starter categories you removed, tap to bring one back:</p>
          <div className="flex flex-wrap gap-1.5">
            {missing.map((d) => {
              const Icon = catIcon(d)
              return (
                <button
                  key={d.id}
                  onClick={() => useStore.getState().restoreExpenseCat(d.id)}
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-xs font-medium text-zinc-400 transition hover:border-white/30 hover:text-white"
                >
                  <RotateCcw className="h-3 w-3" />
                  <Icon className="h-3.5 w-3.5" /> {d.label}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

function CatRow({ cat, index, total, count, open, fresh, onToggle }: { cat: ExpenseCategory; index: number; total: number; count: number; open: boolean; fresh: boolean; onToggle: () => void }) {
  const { updateExpenseCat, moveExpenseCat } = useStore.getState()
  const Icon = catIcon(cat)
  const c = catColor(cat)
  const [label, setLabel] = useState(cat.label)

  return (
    <li className={`rounded-2xl border transition ${open ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'}`}>
      <button onClick={onToggle} aria-expanded={open} className="flex w-full items-center gap-3 p-2.5 text-left">
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${c.soft} ${c.text}`}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{cat.label}</span>
          <span className="block truncate text-xs text-zinc-500">{cat.items.length ? cat.items.join(', ') : 'No usual items yet'}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">{count}</span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="animate-fade space-y-4 border-t border-white/[0.06] px-3 pb-3 pt-4">
          <label className="block">
            <span className="mb-1 block text-xs text-zinc-400">Name</span>
            <input
              value={label}
              maxLength={MAX_CAT_NAME}
              autoFocus={fresh}
              onFocus={(e) => e.target.select()}
              onChange={(e) => {
                setLabel(e.target.value)
                updateExpenseCat(cat.id, { label: e.target.value })
              }}
              onBlur={() => setLabel(useStore.getState().expenseCats.find((x) => x.id === cat.id)?.label.trim() ?? label)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className={input}
            />
          </label>

          <UsualItems cat={cat} />

          <fieldset>
            <legend className="mb-1.5 text-xs text-zinc-400">Icon</legend>
            <div className="grid grid-cols-8 gap-1">
              {Object.entries(EXPENSE_ICONS).map(([name, I]) => {
                const on = cat.icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateExpenseCat(cat.id, { icon: name })}
                    aria-label={`${name} icon`}
                    aria-pressed={on}
                    title={name[0].toUpperCase() + name.slice(1)}
                    className={`grid aspect-square place-items-center rounded-lg transition ${on ? `${c.soft} ${c.text} ring-2 ${c.ring}` : 'text-zinc-400 hover:bg-white/[0.07] hover:text-white'}`}
                  >
                    <I className="h-4 w-4" />
                  </button>
                )
              })}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-xs text-zinc-400">Colour</legend>
            <div className="flex flex-wrap gap-2">
              {Object.entries(KIND_COLORS).map(([name, col]) => {
                const on = cat.color === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateExpenseCat(cat.id, { color: name })}
                    aria-label={col.label}
                    aria-pressed={on}
                    title={col.label}
                    className={`grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br ${col.grad} transition ${
                      on ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0e1016]' : 'opacity-70 hover:scale-110 hover:opacity-100'
                    }`}
                  >
                    {on && <Check className="h-4 w-4 text-black/70" strokeWidth={3} />}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-3">
            <SmallBtn disabled={index === 0} onClick={() => moveExpenseCat(cat.id, index - 1)}>
              <ArrowUp className="h-3.5 w-3.5" /> Up
            </SmallBtn>
            <SmallBtn disabled={index === total - 1} onClick={() => moveExpenseCat(cat.id, index + 1)}>
              <ArrowDown className="h-3.5 w-3.5" /> Down
            </SmallBtn>
            <span className="flex-1" />
            <DeleteCat cat={cat} count={count} />
          </div>
        </div>
      )}
    </li>
  )
}

/** The things usually bought in a category: shown as one-tap names when adding an expense. */
function UsualItems({ cat }: { cat: ExpenseCategory }) {
  const [draft, setDraft] = useState('')
  const update = useStore((s) => s.updateExpenseCat)
  const { names } = useHistory()
  // Things already bought in this category that aren't in the list yet.
  const ideas = names.filter((n) => n.category === cat.id && !cat.items.some((i) => i.toLowerCase() === n.name.toLowerCase())).slice(0, 6)
  const add = (t: string) => t.trim() && update(cat.id, { items: [...cat.items, t] })

  return (
    <div>
      <span className="mb-1 block text-xs text-zinc-400">Usual items</span>
      <div className="flex flex-wrap gap-1.5">
        {cat.items.map((it) => (
          <span key={it} className="inline-flex h-8 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] pl-3 pr-1 text-xs font-medium text-zinc-200">
            {it}
            <button
              type="button"
              onClick={() => update(cat.id, { items: cat.items.filter((x) => x !== it) })}
              aria-label={`Remove ${it}`}
              className="grid h-6 w-6 place-items-center rounded-full text-zinc-500 transition hover:bg-white/10 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add(draft)
            setDraft('')
          }}
          className="relative"
        >
          <input
            value={draft}
            maxLength={MAX_ITEM_NAME}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="+ Add item"
            aria-label={`Add a usual item to ${cat.label}`}
            className="h-8 w-32 rounded-full border border-dashed border-white/15 bg-transparent px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-500 focus:w-44 focus:border-indigo-400/60 sm:text-xs"
          />
        </form>
      </div>
      {ideas.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-zinc-500">From your expenses:</span>
          {ideas.map((n) => (
            <button
              key={n.name}
              type="button"
              onClick={() => add(n.name)}
              className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] text-zinc-400 transition hover:bg-white/5 hover:text-white"
            >
              <Plus className="h-3 w-3" /> {n.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function DeleteCat({ cat, count }: { cat: ExpenseCategory; count: number }) {
  const cats = useExpenseCats()
  const others = cats.filter((c) => c.id !== cat.id)
  const [confirming, setConfirming] = useState(false)
  const [moveTo, setMoveTo] = useState('')

  function remove() {
    useStore.getState().removeExpenseCat(cat.id, moveTo || undefined)
    const target = others.find((c) => c.id === moveTo)
    toast.info(`Deleted “${cat.label}”.${count ? ` Its ${count} expense${count > 1 ? 's' : ''} ${target ? `moved to ${target.label}` : 'now have no category'}.` : ''}`)
  }

  if (!confirming)
    return (
      <SmallBtn danger onClick={() => (count ? setConfirming(true) : remove())}>
        <Trash2 className="h-3.5 w-3.5" /> Delete
      </SmallBtn>
    )
  return (
    <div className="animate-fade mt-2 w-full rounded-xl border border-red-500/25 bg-red-500/[0.06] p-3">
      <p className="flex items-center gap-2 text-sm text-red-100">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-300" /> {count} expense{count > 1 ? 's are' : ' is'} in “{cat.label}”.
      </p>
      <label className="mt-2 block text-xs text-zinc-400">
        Move {count > 1 ? 'them' : 'it'} to
        <select value={moveTo} onChange={(e) => setMoveTo(e.target.value)} className={`${input} mt-1`}>
          <option value="" className="bg-[#0e1016]">
            No category
          </option>
          {others.map((c) => (
            <option key={c.id} value={c.id} className="bg-[#0e1016]">
              {c.label}
            </option>
          ))}
        </select>
      </label>
      <div className="mt-3 flex justify-end gap-2">
        <SmallBtn onClick={() => setConfirming(false)}>Keep it</SmallBtn>
        <button onClick={remove} className="h-9 rounded-lg bg-red-500 px-3 text-xs font-semibold text-white transition hover:bg-red-400">
          Delete category
        </button>
      </div>
    </div>
  )
}

function SmallBtn({ onClick, disabled, danger, children }: { onClick: () => void; disabled?: boolean; danger?: boolean; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition disabled:pointer-events-none disabled:opacity-30 ${
        danger ? 'text-zinc-400 hover:bg-red-500/10 hover:text-red-300' : 'text-zinc-400 hover:bg-white/5 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}

// ---- Places ----

function Places() {
  const saved = useStore((s) => s.places)
  const { places: past } = useHistory()
  const { addPlace, removePlace } = useStore.getState()
  const [draft, setDraft] = useState('')
  const countOf = (p: string) => past.find((x) => x.name.toLowerCase() === p.toLowerCase())?.count ?? 0
  const ideas = past.filter((p) => !saved.some((s) => s.toLowerCase() === p.name.toLowerCase())).slice(0, 10)

  return (
    <div className="space-y-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (!draft.trim()) return
          addPlace(draft)
          setDraft('')
        }}
        className="flex gap-2"
      >
        <label className="relative min-w-0 flex-1">
          <span className="sr-only">New place</span>
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input value={draft} maxLength={MAX_PLACE_NAME} onChange={(e) => setDraft(e.target.value)} placeholder="Add a place you go often" className={`${input} pl-9`} />
        </label>
        <button
          type="submit"
          disabled={!draft.trim()}
          className="h-11 shrink-0 rounded-xl border border-indigo-400/40 bg-indigo-500/15 px-4 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:opacity-40 sm:h-10"
        >
          Add
        </button>
      </form>

      <div>
        <p className="mb-2 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
          <Star className="h-3.5 w-3.5 fill-amber-300 text-amber-300" /> Your places
        </p>
        {saved.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-sm text-zinc-500">
            None yet. Add the places you spend at most, like your go-to store or café, and they'll be one tap away.
          </p>
        ) : (
          <ul className="divide-y divide-white/[0.05] overflow-hidden rounded-2xl border border-white/[0.08]">
            {saved.map((p) => {
              const n = countOf(p)
              return (
                <li key={p} className="flex items-center gap-3 bg-white/[0.02] px-3 py-2.5">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-300/10 text-amber-200">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-100">{p}</span>
                    <span className="block text-[11px] text-zinc-500">{n ? `Used ${n} time${n > 1 ? 's' : ''}` : 'Not used yet'}</span>
                  </span>
                  <button
                    onClick={() => removePlace(p)}
                    aria-label={`Remove ${p}`}
                    className="grid h-9 w-9 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-red-300"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {ideas.length > 0 && (
        <div>
          <p className="mb-2 text-xs text-zinc-500">Places from your expenses, tap to save:</p>
          <div className="flex flex-wrap gap-1.5">
            {ideas.map((p) => (
              <button
                key={p.name}
                onClick={() => addPlace(p.name)}
                className="inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-white/15 px-3 text-xs font-medium text-zinc-400 transition hover:border-amber-300/40 hover:text-amber-50"
              >
                <Plus className="h-3 w-3" /> {p.name}
                <span className="tabular-nums text-zinc-600">×{p.count}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
