import { useMemo, useRef, useState, type DragEvent } from 'react'
import { AlertTriangle, ArrowDown, ArrowUp, Car, Check, ChevronDown, GripVertical, Home, Lock, Plus, RotateCcw, Trash2 } from 'lucide-react'
import { MAX_KIND_NAME, useKinds, useStore } from '../store'
import { DEFAULT_KINDS, KIND_COLORS, KIND_ICONS, kindColor, kindIcon } from '../lib/meta'
import type { ItemKind } from '../lib/types'
import { Modal } from './Modal'
import { toast } from '../toast'

const input =
  'h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm'

/** Add, rename, restyle, reorder and delete the kinds of items. Every change applies right away. */
export function KindsModal({ onClose }: { onClose: () => void }) {
  const kinds = useKinds()
  const months = useStore((s) => s.months)
  const [openId, setOpenId] = useState<string | null>(null)
  /** The kind just added: its name box gets focus so it can be renamed straight away */
  const [fresh, setFresh] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const list = useRef<HTMLUListElement>(null)

  /** How many items each kind has, across every month. */
  const counts = useMemo(() => {
    const n = new Map<string, number>()
    for (const m of Object.values(months)) for (const i of m.items) n.set(i.category, (n.get(i.category) ?? 0) + 1)
    return n
  }, [months])
  const missing = DEFAULT_KINDS.filter((d) => !kinds.some((k) => k.id === d.id))

  function add() {
    const id = useStore.getState().addKind(draft)
    setDraft('')
    setOpenId(id)
    setFresh(id)
    requestAnimationFrame(() => list.current?.lastElementChild?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }))
  }

  return (
    <Modal
      title="Kinds of items"
      subtitle="Name them however you like. Changes show up right away in Assets, the sidebar and when you add an item."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-zinc-500">
            {kinds.length} kind{kinds.length === 1 ? '' : 's'} · you need at least one
          </p>
          <button
            onClick={onClose}
            className="h-11 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:h-10"
          >
            Done
          </button>
        </div>
      }
    >
      <div className="space-y-5">
        <ul ref={list} className="space-y-2">
          {kinds.map((k, i) => (
            <KindRow
              key={k.id}
              kind={k}
              index={i}
              total={kinds.length}
              count={counts.get(k.id) ?? 0}
              open={openId === k.id}
              fresh={fresh === k.id}
              onToggle={() => setOpenId((o) => (o === k.id ? null : k.id))}
              onDeleted={() => setOpenId(null)}
              dragId={dragId}
              setDragId={setDragId}
            />
          ))}
        </ul>

        {/* Add a kind */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            add()
          }}
          className="flex gap-2"
        >
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">New kind name</span>
            <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={draft}
              maxLength={MAX_KIND_NAME}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a kind, e.g. Crypto, Gadgets, Art"
              className={`${input} pl-9`}
            />
          </label>
          <button
            type="submit"
            disabled={!draft.trim()}
            className="h-11 shrink-0 rounded-lg border border-indigo-400/40 bg-indigo-500/15 px-4 text-sm font-semibold text-indigo-100 transition hover:bg-indigo-500/25 disabled:cursor-not-allowed disabled:opacity-40 sm:h-10"
          >
            Add
          </button>
        </form>

        {missing.length > 0 && (
          <div>
            <p className="mb-2 text-xs text-zinc-500">Starter kinds you removed, tap to bring one back:</p>
            <div className="flex flex-wrap gap-1.5">
              {missing.map((d) => {
                const Icon = kindIcon(d)
                return (
                  <button
                    key={d.id}
                    onClick={() => {
                      useStore.getState().restoreKind(d.id)
                      toast.info(`Added “${d.label}” back.`)
                    }}
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
    </Modal>
  )
}

interface RowProps {
  kind: ItemKind
  index: number
  total: number
  count: number
  open: boolean
  fresh: boolean
  onToggle: () => void
  onDeleted: () => void
  dragId: string | null
  setDragId: (id: string | null) => void
}

function KindRow({ kind, index, total, count, open, fresh, onToggle, onDeleted, dragId, setDragId }: RowProps) {
  const { updateKind, moveKind } = useStore.getState()
  const Icon = kindIcon(kind)
  const c = kindColor(kind)
  const [dropAt, setDropAt] = useState<null | 'above' | 'below'>(null)

  const half = (e: DragEvent<HTMLLIElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    return e.clientY < r.top + r.height / 2 ? 'above' : 'below'
  }

  return (
    <li
      onDragOver={(e) => {
        if (!dragId) return
        e.preventDefault()
        setDropAt(dragId === kind.id ? null : half(e))
      }}
      onDragLeave={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && setDropAt(null)}
      onDrop={(e) => {
        e.preventDefault()
        setDropAt(null)
        if (!dragId || dragId === kind.id) return
        const kinds = useStore.getState().kinds
        const from = kinds.findIndex((k) => k.id === dragId)
        // Position in the list once the dragged kind has been taken out of it.
        const to = index + (half(e) === 'below' ? 1 : 0) - (from < index ? 1 : 0)
        moveKind(dragId, to)
        setDragId(null)
      }}
      className={`relative rounded-2xl border transition ${open ? 'border-white/15 bg-white/[0.04]' : 'border-white/[0.08] bg-white/[0.02] hover:border-white/15'} ${
        dragId === kind.id ? 'opacity-40' : ''
      }`}
    >
      {dropAt && <span className={`pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-indigo-400 ${dropAt === 'above' ? '-top-[5px]' : '-bottom-[5px]'}`} />}

      <div className="flex items-center gap-1 py-1.5 pl-1 pr-2">
        <span
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', kind.label)
            setDragId(kind.id)
          }}
          onDragEnd={() => setDragId(null)}
          title="Drag to reorder"
          className="hidden h-9 w-6 shrink-0 cursor-grab place-items-center text-zinc-600 transition hover:text-zinc-300 active:cursor-grabbing sm:grid"
        >
          <GripVertical className="h-4 w-4" />
        </span>
        <button onClick={onToggle} aria-expanded={open} className="flex min-w-0 flex-1 items-center gap-3 rounded-xl py-1 pl-2 text-left sm:pl-0">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${c.soft} ${c.text}`}>
            <Icon className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold text-white">{kind.label}</span>
            <span className="block truncate text-xs text-zinc-500">{kind.hint.trim() || 'No examples yet'}</span>
          </span>
          <span className="shrink-0 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] tabular-nums text-zinc-400">
            {count} item{count === 1 ? '' : 's'}
          </span>
          <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {open && (
        <div className="animate-fade space-y-4 border-t border-white/[0.06] px-3 pb-3 pt-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <NameField kind={kind} focus={fresh} />
            <label className="block">
              <span className="mb-1 block text-xs text-zinc-400">Examples (optional)</span>
              <input
                value={kind.hint}
                maxLength={80}
                onChange={(e) => updateKind(kind.id, { hint: e.target.value })}
                placeholder="e.g. Bitcoin, ETH, stablecoins"
                className={input}
              />
            </label>
          </div>

          <fieldset>
            <legend className="mb-1.5 text-xs text-zinc-400">Icon</legend>
            <div className="grid grid-cols-8 gap-1 sm:grid-cols-[repeat(12,minmax(0,1fr))]">
              {Object.entries(KIND_ICONS).map(([name, I]) => {
                const on = kind.icon === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateKind(kind.id, { icon: name })}
                    aria-label={`${name} icon`}
                    aria-pressed={on}
                    title={name[0].toUpperCase() + name.slice(1)}
                    className={`grid aspect-square place-items-center rounded-lg transition ${
                      on ? `${c.soft} ${c.text} ring-2 ${c.ring}` : 'text-zinc-400 hover:bg-white/[0.07] hover:text-white'
                    }`}
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
                const on = kind.color === name
                return (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateKind(kind.id, { color: name })}
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

          {(kind.id === 'property' || kind.id === 'vehicle') && (
            <p className="flex items-center gap-2 rounded-lg bg-teal-400/[0.07] px-3 py-2 text-xs text-teal-100/80">
              {kind.id === 'property' ? <Car className="h-3.5 w-3.5 shrink-0" /> : <Home className="h-3.5 w-3.5 shrink-0" />}
              {kind.id === 'property' ? 'Vehicles can be kept at items of this kind.' : 'Items of this kind can be kept at a property.'}
            </p>
          )}

          <Actions kind={kind} index={index} total={total} count={count} onDeleted={onDeleted} />
        </div>
      )}
    </li>
  )
}

/** Renamed as you type; an emptied name goes back to the last one when you leave the box. */
function NameField({ kind, focus }: { kind: ItemKind; focus: boolean }) {
  const [draft, setDraft] = useState(kind.label)
  const update = useStore((s) => s.updateKind)
  return (
    <label className="block">
      <span className="mb-1 block text-xs text-zinc-400">Name</span>
      <input
        value={draft}
        maxLength={MAX_KIND_NAME}
        autoFocus={focus}
        onFocus={(e) => e.target.select()}
        onChange={(e) => {
          setDraft(e.target.value)
          update(kind.id, { label: e.target.value })
        }}
        onBlur={() => setDraft(useStore.getState().kinds.find((k) => k.id === kind.id)?.label.trim() ?? draft)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        className={input}
      />
    </label>
  )
}

/** Move up / down, and delete (asking where its items should go). */
function Actions({ kind, index, total, count, onDeleted }: { kind: ItemKind; index: number; total: number; count: number; onDeleted: () => void }) {
  const kinds = useKinds()
  const others = kinds.filter((k) => k.id !== kind.id)
  const [confirming, setConfirming] = useState(false)
  const [moveTo, setMoveTo] = useState(others[0]?.id ?? '')
  const target = others.find((k) => k.id === moveTo) ?? others[0]
  const last = total <= 1
  const { moveKind, removeKind } = useStore.getState()

  function remove() {
    const r = removeKind(kind.id, target?.id)
    if (!r.ok) return toast.error(r.error)
    toast.info(count ? `Deleted “${kind.label}”. Its ${count} item${count === 1 ? '' : 's'} are now “${target!.label}”.` : `Deleted “${kind.label}”.`)
    onDeleted()
  }

  if (confirming) {
    return (
      <div role="alert" className="animate-fade rounded-xl border border-red-500/30 bg-red-500/[0.08] p-3">
        <p className="flex items-start gap-2 text-sm text-red-100">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          <span>
            “{kind.label}” has {count} item{count === 1 ? '' : 's'}. Nothing gets deleted, pick the kind they should become:
          </span>
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5" role="radiogroup" aria-label="Move items to">
          {others.map((k) => {
            const on = target?.id === k.id
            const I = kindIcon(k)
            return (
              <button
                key={k.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMoveTo(k.id)}
                className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
                  on ? 'border-white/40 bg-white/15 text-white' : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200'
                }`}
              >
                <I className={`h-3.5 w-3.5 ${kindColor(k).text}`} /> {k.label}
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={() => setConfirming(false)} className="h-9 rounded-lg px-3 text-sm font-medium text-zinc-300 transition hover:bg-white/5">
            Cancel
          </button>
          <button onClick={remove} className="h-9 rounded-lg bg-red-500/90 px-3 text-sm font-semibold text-white transition hover:bg-red-500">
            Move {count} &amp; delete
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-1 border-t border-white/[0.06] pt-3">
      <button
        onClick={() => moveKind(kind.id, index - 1)}
        disabled={index === 0}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
      >
        <ArrowUp className="h-3.5 w-3.5" /> Up
      </button>
      <button
        onClick={() => moveKind(kind.id, index + 1)}
        disabled={index === total - 1}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:pointer-events-none disabled:opacity-30"
      >
        <ArrowDown className="h-3.5 w-3.5" /> Down
      </button>
      <span className="flex-1" />
      {last ? (
        <span className="inline-flex items-center gap-1.5 px-2 text-xs text-zinc-500">
          <Lock className="h-3.5 w-3.5" /> Your only kind, it can’t be deleted
        </span>
      ) : (
        <button
          onClick={() => (count ? setConfirming(true) : remove())}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-red-300/80 transition hover:bg-red-500/10 hover:text-red-200"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete kind
        </button>
      )}
    </div>
  )
}
