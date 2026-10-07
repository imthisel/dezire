import { useState, type ReactNode } from 'react'
import { AlertTriangle, Car, Check, ChevronDown, Home, StickyNote } from 'lucide-react'
import { fitCheck, useFmt, useItemIndex, useStore, useUsd } from '../store'
import { CATEGORY, TREND } from '../lib/meta'
import { labelOfKey } from '../lib/time'
import { NotYet } from './Kept'
import type { Category, Trend } from '../lib/types'
import { Modal } from './Modal'
import { MoneyInput } from './MoneyInput'
import { toast } from '../toast'

export function ItemModal({ monthKey, editId }: { monthKey: string; editId?: string }) {
  const f = useFmt()
  const u = useUsd()
  const months = useStore((s) => s.months)
  const close = useStore((s) => s.closeModal)
  const editing = editId ? months[monthKey]?.items.find((i) => i.id === editId) : undefined

  const [category, setCategory] = useState<Category | null>(editing?.category ?? null)
  const [trend, setTrend] = useState<Trend | null>(editing?.trend ?? null)
  const [name, setName] = useState(editing?.name ?? '')
  const [price, setPrice] = useState<number | null>(editing?.price ?? null)
  const [rate, setRate] = useState<string>(editing ? String(editing.rate) : '')
  const [rateTouched, setRateTouched] = useState(!!editing)
  const [notes, setNotes] = useState(editing?.notes ?? '')
  const [notesOpen, setNotesOpen] = useState(!!editing?.notes)
  const index = useItemIndex()
  // Only keep a link to a property that still exists.
  // Property: which vehicles are kept here (ticked in this window, saved with it).
  const vehicles = [...index.byId.values()].filter((p) => p.item.category === 'vehicle' && p.item.id !== editId)
  const [kept, setKept] = useState<Set<string>>(() => new Set((editId ? (index.vehiclesAt.get(editId) ?? []) : []).map((v) => v.item.id)))
  const toggleKept = (id: string) =>
    setKept((k) => {
      const n = new Set(k)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const [propertyId, setPropertyId] = useState<string | null>(
    editing?.propertyId && index.byId.get(editing.propertyId)?.item.category === 'property' ? editing.propertyId : null,
  )

  const m = months[monthKey]
  const budget = m?.budget ?? 0
  const spent = (m?.items ?? []).filter((i) => i.id !== editId).reduce((s, i) => s + i.price, 0)
  const { left, warning: budgetWarning } = fitCheck(months, monthKey, price ?? 0, editId)
  const rateNum = trend === 'stable' ? 0 : Math.min(100, Math.max(0, parseFloat(rate) || 0))

  const ready = !!category && !!trend && name.trim().length > 0 && !!price && price > 0

  function pickTrend(t: Trend) {
    setTrend(t)
    if (!rateTouched) setRate(t === 'stable' ? '0' : String(TREND[t].defaultRate))
  }

  function save() {
    if (!ready) return
    const data = { name: name.trim(), category: category!, trend: trend!, price: price!, rate: rateNum, notes: notes.trim(), propertyId: category === 'vehicle' && propertyId ? propertyId : undefined }
    const s = useStore.getState()
    const r = editId ? s.updateItem(monthKey, editId, data) : s.addItem(monthKey, data)
    // A property keeps the vehicles ticked below; anything that's no longer a property keeps none.
    const pid = editId ?? (r.ok ? r.id : undefined)
    if (pid && (category === 'property' || editing?.category === 'property')) s.setVehiclesAt(pid, category === 'property' ? [...kept] : [])
    toast.result(r, `${editId ? 'Updated' : 'Added'} “${data.name}” in ${labelOfKey(monthKey)}.`)
    if (r.ok) close()
  }

  const remaining = left - (price ?? 0)

  return (
    <Modal
      title={editId ? 'Edit item' : 'Add an item'}
      subtitle={labelOfKey(monthKey)}
      onClose={close}
      footer={
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-zinc-500">
            Left after this:{' '}
            <span className={`font-semibold tabular-nums ${remaining < 0 ? 'text-red-300' : 'text-zinc-200'}`}>{f(remaining)}</span>
          </p>
          <div className="flex gap-2">
            <button onClick={close} className="h-11 flex-1 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-300 transition hover:bg-white/5 sm:h-10 sm:flex-none sm:border-transparent">
              Cancel
            </button>
            <button
              onClick={save}
              disabled={!ready}
              className="h-11 flex-[2] rounded-xl sm:h-10 sm:flex-none bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
            >
              {editId ? 'Save changes' : 'Add item'}
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
        {/* Budget info */}
        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/[0.06] bg-black/20 p-2.5 text-center sm:p-3">
          <Info k="Budget" v={budget > 0 ? f(budget) : '—'} usd={budget > 0 ? u(budget) : ''} />
          <Info k="Already spent" v={f(spent)} usd={u(spent)} />
          <Info k="Left to spend" v={f(left)} usd={u(left)} cls={left <= 0 ? 'text-red-300' : 'text-emerald-300'} />
        </div>

        <Step n={1} title="What kind of item is it?" done={!!category}>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {(Object.keys(CATEGORY) as Category[]).map((k) => {
              const c = CATEGORY[k]
              const on = category === k
              return (
                <Choice key={k} on={on} onClick={() => setCategory(k)} ringCls="ring-indigo-400/70" onCls="border-indigo-400/60 bg-indigo-500/15">
                  <c.icon className={`h-6 w-6 ${on ? 'text-indigo-200' : 'text-zinc-400'}`} />
                  <span className="text-sm font-semibold text-white">{c.label}</span>
                  <span className="text-[11px] leading-tight text-zinc-500">{c.hint}</span>
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
                onChange={(e) => setName(e.target.value)}
                placeholder={category ? `e.g. ${CATEGORY[category].hint.split(',')[0]}` : 'e.g. Toyota Fortuner'}
                className="h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs text-zinc-400">Price</span>
                <MoneyInput value={price} nullable onChange={setPrice} placeholder="e.g. 250k" size="md" />
                <span className="mt-1 block text-xs tabular-nums text-zinc-400">{price ? `≈ ${u(price)} USD` : " "}</span>
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

        {/* Vehicles: which property it's kept at (optional) */}
        {category === 'vehicle' && (
          <section className="animate-fade">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className={`grid h-6 w-6 place-items-center rounded-full transition ${propertyId ? 'bg-teal-400/20 text-teal-200' : 'bg-white/10 text-zinc-300'}`}>
                <Home className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-sm font-semibold text-zinc-200">Where is it kept?</h3>
              <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">optional</span>
            </div>
            {index.properties.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-zinc-500">
                Add a <span className="text-zinc-300">Land / Property</span> item to any month and you can keep this vehicle there.
              </p>
            ) : (
              <div className="scrollbar-none -mx-1 max-h-56 space-y-1.5 overflow-y-auto px-1 py-0.5" role="radiogroup" aria-label="Where is it kept?">
                <PlaceOption on={!propertyId} onClick={() => setPropertyId(null)} title="Not at a property" sub="Leave it unassigned" />
                {index.properties.map((p) => {
                  const here = (index.vehiclesAt.get(p.item.id) ?? []).filter((v) => v.item.id !== editId).length
                  return (
                    <PlaceOption
                      key={p.item.id}
                      on={propertyId === p.item.id}
                      onClick={() => setPropertyId(p.item.id)}
                      title={p.item.name}
                      sub={`${labelOfKey(p.key)} · ${f(p.item.price, true)}`}
                      count={here}
                      home
                      tag={<NotYet vehicleKey={monthKey} propertyKey={p.key} />}
                    />
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Properties: tick the vehicles kept here (optional) */}
        {category === 'property' && (
          <section className="animate-fade">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className={`grid h-6 w-6 place-items-center rounded-full transition ${kept.size ? 'bg-teal-400/20 text-teal-200' : 'bg-white/10 text-zinc-300'}`}>
                <Car className="h-3.5 w-3.5" />
              </span>
              <h3 className="text-sm font-semibold text-zinc-200">Vehicles kept here</h3>
              <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">optional</span>
              {kept.size > 0 && <span className="ml-auto text-xs tabular-nums text-teal-200/80">{kept.size} selected</span>}
            </div>
            {vehicles.length === 0 ? (
              <p className="rounded-xl border border-dashed border-white/10 px-3 py-3 text-xs text-zinc-500">
                Add a <span className="text-zinc-300">Vehicle</span> item to any month and you can keep it here.
              </p>
            ) : (
              <div className="scrollbar-none -mx-1 max-h-56 space-y-1.5 overflow-y-auto px-1 py-0.5">
                {vehicles.map((v) => {
                  const on = kept.has(v.item.id)
                  const other = v.item.propertyId && v.item.propertyId !== editId ? index.byId.get(v.item.propertyId) : undefined
                  const elsewhere = other?.item.category === 'property' ? other.item.name : null
                  const t = TREND[v.item.trend]
                  return (
                    <button
                      key={v.item.id}
                      type="button"
                      role="checkbox"
                      aria-checked={on}
                      onClick={() => toggleKept(v.item.id)}
                      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                        on ? 'border-teal-400/60 bg-teal-500/10 ring-2 ring-teal-400/40' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
                      }`}
                    >
                      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.iconBg} ${t.text}`}>
                        <Car className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={`truncate text-sm font-medium ${on ? 'text-white' : 'text-zinc-200'}`}>{v.item.name}</span>
                          <NotYet vehicleKey={v.key} propertyKey={monthKey} />
                        </span>
                        <span className="block truncate text-[11px] text-zinc-500">
                          {labelOfKey(v.key)} · {f(v.item.price, true)}
                          {elsewhere && (on ? <span className="text-amber-200/80"> · moves here from {elsewhere}</span> : ` · at ${elsewhere}`)}
                        </span>
                      </span>
                      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border-2 transition ${on ? 'border-teal-400 bg-teal-400' : 'border-zinc-600'}`}>
                        {on && <Check className="h-3 w-3 text-black" strokeWidth={3.5} />}
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </section>
        )}

        {/* Notes (optional, folded away until asked for) */}
        <section>
          <button
            type="button"
            onClick={() => setNotesOpen((o) => !o)}
            aria-expanded={notesOpen}
            className="group flex w-full items-center gap-2.5 text-left"
          >
            <span className={`grid h-6 w-6 place-items-center rounded-full transition ${notes.trim() ? 'bg-amber-300/20 text-amber-200' : 'bg-white/10 text-zinc-300'}`}>
              <StickyNote className="h-3.5 w-3.5" />
            </span>
            <span className="text-sm font-semibold text-zinc-200">Notes</span>
            <span className="rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-zinc-500">optional</span>
            {!notesOpen && notes.trim() && <span className="min-w-0 flex-1 truncate text-xs text-zinc-500">{notes.trim()}</span>}
            <ChevronDown className={`ml-auto h-4 w-4 shrink-0 text-zinc-500 transition-transform group-hover:text-zinc-300 ${notesOpen ? 'rotate-180' : ''}`} />
          </button>
          {notesOpen && (
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              autoFocus={!editing?.notes}
              rows={3}
              maxLength={2000}
              placeholder="Anything to remember: where to buy it, the exact model, why you want it, a link…"
              className="animate-fade mt-2.5 block min-h-[5.5rem] w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-base leading-relaxed text-zinc-100 outline-none transition [field-sizing:content] placeholder:text-zinc-600 hover:border-white/20 focus:border-amber-300/50 focus:ring-2 focus:ring-amber-300/15 sm:text-sm"
            />
          )}
        </section>

        {!!price && budgetWarning && (
          <div role="alert" className="animate-fade flex gap-3 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-200">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-400" />
            <p>{budgetWarning} You can still add it.</p>
          </div>
        )}
        <button type="submit" hidden />
      </form>
    </Modal>
  )
}

function Step({ n, title, done, children }: { n: number; title: string; done: boolean; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className={`grid h-6 w-6 place-items-center rounded-full text-xs font-bold transition ${
            done ? 'bg-emerald-400 text-emerald-950' : 'bg-white/10 text-zinc-300'
          }`}
        >
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : n}
        </span>
        <h3 className="text-sm font-semibold text-zinc-200">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function PlaceOption({ on, onClick, title, sub, count = 0, home, tag }: { on: boolean; onClick: () => void; title: string; sub: string; count?: number; home?: boolean; tag?: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
        on ? 'border-teal-400/60 bg-teal-500/10 ring-2 ring-teal-400/40' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.05]'
      }`}
    >
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${home ? (on ? 'bg-teal-400/20 text-teal-200' : 'bg-white/5 text-zinc-400') : 'bg-white/5 text-zinc-500'}`}>
        {home ? <Home className="h-4 w-4" /> : <span className="text-base leading-none">—</span>}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-2">
          <span className={`truncate text-sm font-medium ${on ? 'text-white' : 'text-zinc-200'}`}>{title}</span>
          {tag}
        </span>
        <span className="block truncate text-[11px] text-zinc-500">{sub}</span>
      </span>
      {count > 0 && (
        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] tabular-nums text-zinc-400" title={`${count} other vehicle${count > 1 ? 's' : ''} kept here`}>
          <Car className="h-3 w-3" /> {count}
        </span>
      )}
      <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition ${on ? 'border-teal-400 bg-teal-400' : 'border-zinc-600'}`}>
        {on && <Check className="h-3 w-3 text-black" strokeWidth={3.5} />}
      </span>
    </button>
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

function Info({ k, v, usd, cls = 'text-zinc-100' }: { k: string; v: string; usd: string; cls?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-medium uppercase tracking-wider text-zinc-500">{k}</p>
      <p className={`truncate text-sm font-semibold tabular-nums ${cls}`}>{v}</p>
      {usd && <p className="truncate text-[11px] tabular-nums text-zinc-500">≈ {usd}</p>}
    </div>
  )
}
