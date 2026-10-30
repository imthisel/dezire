import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, Copy, Crown, FilePlus2, Layers, Lock, Pencil, Plus, Settings2, Sparkles, Trash2 } from 'lucide-react'
import { MAIN_MODE, MAX_MODE_NAME, useStore } from '../store'
import { openPlans, useModeLimit } from '../billing'
import type { ModeInfo } from '../lib/types'
import { Modal } from './Modal'
import { toast } from '../toast'

/** Each mode's colour, by its place in the list (the main plan is always indigo). Written out so Tailwind keeps them. */
const COLORS = [
  { dot: 'bg-indigo-400', text: 'text-indigo-200', soft: 'bg-indigo-500/15', ring: 'ring-indigo-400/40', strip: 'from-indigo-500/20 border-indigo-400/25' },
  { dot: 'bg-fuchsia-400', text: 'text-fuchsia-200', soft: 'bg-fuchsia-500/15', ring: 'ring-fuchsia-400/40', strip: 'from-fuchsia-500/20 border-fuchsia-400/25' },
  { dot: 'bg-amber-300', text: 'text-amber-100', soft: 'bg-amber-400/15', ring: 'ring-amber-300/40', strip: 'from-amber-400/20 border-amber-300/25' },
  { dot: 'bg-emerald-400', text: 'text-emerald-200', soft: 'bg-emerald-500/15', ring: 'ring-emerald-400/40', strip: 'from-emerald-500/20 border-emerald-400/25' },
  { dot: 'bg-sky-400', text: 'text-sky-200', soft: 'bg-sky-500/15', ring: 'ring-sky-400/40', strip: 'from-sky-500/20 border-sky-400/25' },
  { dot: 'bg-rose-400', text: 'text-rose-200', soft: 'bg-rose-500/15', ring: 'ring-rose-400/40', strip: 'from-rose-500/20 border-rose-400/25' },
]
export const modeColor = (index: number) => COLORS[index % COLORS.length]

/** The modes in order, with which ones the current plan can open (the first ones, up to its limit; the main one always). */
function useModes() {
  const modes = useStore((s) => s.modes)
  const modeId = useStore((s) => s.modeId)
  const limit = useModeLimit()
  const list = modes.map((m, i) => ({ ...m, index: i, main: m.id === MAIN_MODE, locked: i >= limit }))
  const current = list.find((m) => m.id === modeId) ?? list[0]
  return { list, current, limit, canAdd: modes.length < limit }
}

function open(m: { id: string; name: string; locked: boolean }) {
  if (m.locked) {
    openPlans()
    return toast.info(`“${m.name}” is kept safe, but your plan includes 2 modes. Get Yearly for unlimited modes.`)
  }
  useStore.getState().switchMode(m.id)
}

/** Header: which mode is in use, and a menu to switch, add or manage modes. */
export function ModeSwitcher({ phone }: { phone: boolean }) {
  const { list, current, canAdd } = useModes()
  const [menu, setMenu] = useState(false)
  const [manage, setManage] = useState<null | 'list' | 'new'>(null)
  const root = useRef<HTMLDivElement>(null)
  const c = modeColor(current.index)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setMenu(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [menu])

  return (
    <div ref={root} className={`relative ${phone ? 'min-w-0 flex-1' : ''}`}>
      <button
        onClick={() => setMenu((o) => !o)}
        aria-expanded={menu}
        aria-haspopup="menu"
        title="Modes: separate versions of your plan"
        className={`flex w-full items-center gap-2 rounded-xl border bg-white/[0.03] pl-2.5 pr-2 text-sm font-medium transition ${phone ? 'h-10' : 'h-9 max-w-[13rem]'} ${
          menu ? 'border-indigo-400/50 ring-2 ring-indigo-500/20' : 'border-white/10 hover:border-white/20'
        }`}
      >
        <Layers className={`h-4 w-4 shrink-0 ${c.text}`} />
        <span className="min-w-0 flex-1 truncate text-left text-zinc-200">{current.name}</span>
        {current.main && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Main plan" />}
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 text-zinc-500 transition-transform duration-300 ${menu ? 'rotate-180' : ''}`} />
      </button>

      {menu && (
        <div role="menu" className="animate-menu absolute left-0 top-full z-50 mt-2 w-[19rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0e1016] shadow-2xl shadow-black/60 sm:left-auto sm:right-0">
          <div className="border-b border-white/[0.06] px-4 py-3">
            <p className="text-sm font-semibold text-white">Modes</p>
            <p className="mt-0.5 text-xs leading-relaxed text-zinc-500">Separate versions of your plan, each with its own overview, items, net worth and setups. Calendar, expenses and goals are shared.</p>
          </div>
          <ul className="max-h-72 overflow-y-auto p-1.5">
            {list.map((m) => {
              const mc = modeColor(m.index)
              const on = m.id === current.id
              return (
                <li key={m.id}>
                  <button
                    role="menuitemradio"
                    aria-checked={on}
                    onClick={() => {
                      setMenu(false)
                      open(m)
                    }}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${on ? `${mc.soft} ring-1 ${mc.ring}` : 'hover:bg-white/5'}`}
                  >
                    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${mc.dot} ${m.locked ? 'opacity-40' : ''}`} />
                    <span className="min-w-0 flex-1">
                      <span className={`block truncate text-sm font-medium ${m.locked ? 'text-zinc-500' : 'text-zinc-100'}`}>{m.name}</span>
                      {m.main && <span className="block text-[11px] text-zinc-500">Your main plan</span>}
                    </span>
                    {m.main && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Main" />}
                    {m.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-label="Needs the yearly plan" />}
                    {on && <Check className={`h-4 w-4 shrink-0 ${mc.text}`} />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="grid grid-cols-2 gap-1.5 border-t border-white/[0.06] p-2">
            <button
              onClick={() => {
                setMenu(false)
                if (canAdd) setManage('new')
                else openPlans()
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 text-xs font-semibold text-white"
            >
              {canAdd ? <Plus className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {canAdd ? 'New mode' : 'Unlimited modes'}
            </button>
            <button
              onClick={() => {
                setMenu(false)
                setManage('list')
              }}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
            >
              <Settings2 className="h-3.5 w-3.5" /> Manage
            </button>
          </div>
        </div>
      )}

      {manage && <ModesModal startAdding={manage === 'new'} onClose={() => setManage(null)} />}
    </div>
  )
}

/** Manage modes: rename, delete, and add one (empty, or a copy of the one in use). */
function ModesModal({ startAdding, onClose }: { startAdding: boolean; onClose: () => void }) {
  const { list, current, limit, canAdd } = useModes()
  const [adding, setAdding] = useState(startAdding && canAdd)
  const [name, setName] = useState('')
  const [copy, setCopy] = useState(false)
  const s = useStore.getState()

  function create() {
    const id = s.addMode(name || `Mode ${list.length + 1}`, copy)
    const made = useStore.getState().modes.find((m) => m.id === id)
    toast.success(`Now in “${made?.name}”. ${copy ? 'It starts as a copy of' : 'It starts empty, separate from'} “${current.name}”.`)
    onClose()
  }

  function remove(m: ModeInfo) {
    if (!confirm(`Delete the mode “${m.name}”? Its months, items and setups are deleted for good. Your other modes, calendar and expenses stay.`)) return
    s.removeMode(m.id)
    toast.info(`Deleted “${m.name}”.`)
  }

  return (
    <Modal title="Modes" subtitle="Separate versions of your plan. Mode 1 is your main plan." onClose={onClose} width="max-w-lg">
      <ul className="space-y-1.5">
        {list.map((m) => (
          <ModeRow key={m.id} m={m} current={m.id === current.id} onDelete={() => remove(m)} />
        ))}
      </ul>

      <div className="mt-4 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-400">
        {limit === Infinity ? (
          <span>Unlimited modes on your plan.</span>
        ) : (
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {Math.min(list.length, limit)} of {limit} modes on your plan.
              {list.length > limit && <span className="text-amber-200/80"> {list.length - limit} more kept safe (locked).</span>}
            </span>
            <button onClick={() => openPlans()} className="inline-flex items-center gap-1 font-semibold text-indigo-200 hover:text-white">
              <Sparkles className="h-3.5 w-3.5" /> Get Yearly for unlimited
            </button>
          </span>
        )}
      </div>

      {canAdd &&
        (adding ? (
          <div className="animate-fade mt-4 space-y-3 rounded-2xl border border-indigo-400/25 bg-indigo-500/[0.06] p-4">
            <p className="text-sm font-semibold text-white">New mode</p>
            <input
              autoFocus
              value={name}
              maxLength={MAX_MODE_NAME}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && create()}
              placeholder={`e.g. Dream life, Safe plan, Mode ${list.length + 1}`}
              className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <StartOption on={!copy} onClick={() => setCopy(false)} icon={FilePlus2} title="Start empty" hint="A blank plan" />
              <StartOption on={copy} onClick={() => setCopy(true)} icon={Copy} title={`Copy “${current.name}”`} hint="Then change it freely" />
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setAdding(false)} className="h-10 rounded-xl px-4 text-sm font-medium text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button onClick={create} className="h-10 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20">
                Create and open
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setAdding(true)}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-3 text-sm font-medium text-zinc-300 transition hover:border-white/30 hover:text-white"
          >
            <Plus className="h-4 w-4" /> New mode
          </button>
        ))}
    </Modal>
  )
}

function ModeRow({ m, current, onDelete }: { m: ModeInfo & { index: number; main: boolean; locked: boolean }; current: boolean; onDelete: () => void }) {
  const [name, setName] = useState(m.name)
  const c = modeColor(m.index)
  return (
    <li className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${current ? `border-transparent ${c.soft} ring-1 ${c.ring}` : 'border-white/[0.07]'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${c.soft}`}>
        {m.main ? <Crown className="h-4 w-4 text-amber-300" /> : m.locked ? <Lock className="h-4 w-4 text-zinc-500" /> : <Layers className={`h-4 w-4 ${c.text}`} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <input
            value={name}
            maxLength={MAX_MODE_NAME}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => useStore.getState().renameMode(m.id, name)}
            onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
            aria-label="Mode name"
            className="h-7 min-w-0 flex-1 rounded-md bg-transparent px-1 text-sm font-medium text-white outline-none transition hover:bg-white/[0.04] focus:bg-black/30"
          />
          <Pencil className="h-3 w-3 shrink-0 text-zinc-600" />
        </span>
        <span className="block px-1 text-[11px] text-zinc-500">
          {m.main ? 'Mode 1 · your main plan' : `Mode ${m.index + 1}`}
          {current && ' · in use'}
          {m.locked && ' · locked on your plan'}
        </span>
      </span>
      {!current && (
        <button
          onClick={() => open(m)}
          className="h-8 shrink-0 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
        >
          Open
        </button>
      )}
      {!m.main && (
        <button onClick={onDelete} title="Delete this mode" aria-label={`Delete ${m.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300">
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </li>
  )
}

function StartOption({ on, onClick, icon: Icon, title, hint }: { on: boolean; onClick: () => void; icon: typeof Copy; title: string; hint: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={`flex min-w-0 flex-col items-start gap-1 rounded-xl border p-3 text-left transition ${on ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/10 hover:border-white/20'}`}
    >
      <Icon className={`h-4 w-4 ${on ? 'text-indigo-200' : 'text-zinc-500'}`} />
      <span className="w-full truncate text-sm font-semibold text-white">{title}</span>
      <span className="text-[11px] text-zinc-500">{hint}</span>
    </button>
  )
}

/** Overview & Assets: which mode this is, when there's more than one (so it's always clear which plan you're editing). */
export function ModeStrip() {
  const { list, current } = useModes()
  if (list.length < 2) return null
  const c = modeColor(current.index)
  return (
    <div className={`animate-fade flex items-center gap-3 rounded-2xl border bg-gradient-to-r to-transparent px-4 py-2.5 ${c.strip}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-300">
        {current.main ? (
          <>
            <span className="font-semibold text-white">{current.name}</span> · your main plan
          </>
        ) : (
          <>
            Mode <span className="font-semibold text-white">{current.name}</span>
            <span className="text-zinc-500"> · its own overview, items and setups</span>
          </>
        )}
      </p>
      {!current.main && (
        <button onClick={() => useStore.getState().switchMode(MAIN_MODE)} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white">
          Back to main
        </button>
      )}
    </div>
  )
}

/** If the mode in use is locked (the plan changed to one with fewer modes), go back to the main plan. */
export function useModeGuard() {
  const { current } = useModes()
  useEffect(() => {
    if (!current.locked) return
    useStore.getState().switchMode(MAIN_MODE)
    toast.info(`Back to your main plan: “${current.name}” is kept safe and opens again with the yearly plan.`)
  }, [current.locked, current.name])
}
