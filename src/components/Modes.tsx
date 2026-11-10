import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AlertTriangle, ArrowRight, Check, ChevronDown, Copy, Crown, FilePlus2, Layers, Lock, Pencil, Plus, Settings2, ShoppingBasket, Sparkles, Trash2 } from 'lucide-react'
import { MAIN_MODE, MAX_MODE_NAME, useStore } from '../store'
import { openPlans, useModeLimit } from '../billing'
import { modeKind } from '../lib/needs'
import type { ModeInfo, ModeKind } from '../lib/types'
import { Modal } from './Modal'
import { toast } from '../toast'
import { goTo } from '../nav'

/** Each mode's colour, by its place in the list (the main plan is always indigo). Written out so Tailwind keeps them. */
const COLORS = [
  { dot: 'bg-indigo-400', text: 'text-indigo-200', soft: 'bg-indigo-500/15', ring: 'ring-indigo-400/40', strip: 'from-indigo-500/20 border-indigo-400/25' },
  { dot: 'bg-fuchsia-400', text: 'text-fuchsia-200', soft: 'bg-fuchsia-500/15', ring: 'ring-fuchsia-400/40', strip: 'from-fuchsia-500/20 border-fuchsia-400/25' },
  { dot: 'bg-amber-300', text: 'text-amber-100', soft: 'bg-amber-400/15', ring: 'ring-amber-300/40', strip: 'from-amber-400/20 border-amber-300/25' },
  { dot: 'bg-cyan-400', text: 'text-cyan-200', soft: 'bg-cyan-500/15', ring: 'ring-cyan-400/40', strip: 'from-cyan-500/20 border-cyan-400/25' },
  { dot: 'bg-sky-400', text: 'text-sky-200', soft: 'bg-sky-500/15', ring: 'ring-sky-400/40', strip: 'from-sky-500/20 border-sky-400/25' },
  { dot: 'bg-rose-400', text: 'text-rose-200', soft: 'bg-rose-500/15', ring: 'ring-rose-400/40', strip: 'from-rose-500/20 border-rose-400/25' },
]
/** Green is kept for Needs modes alone, so it always means the same thing. */
const NEEDS_COLOR = { dot: 'bg-emerald-400', text: 'text-emerald-200', soft: 'bg-emerald-500/15', ring: 'ring-emerald-400/40', strip: 'from-emerald-500/20 border-emerald-400/25' }
export const modeColor = (index: number, kind: ModeKind = 'wants') => (kind === 'needs' ? NEEDS_COLOR : COLORS[index % COLORS.length])

/** The two sections of modes. Each has its own button in the header. */
const KINDS: { id: ModeKind; title: string; line: string; icon: typeof Copy; iconCls: string; on: string; form: string; create: string }[] = [
  {
    id: 'wants',
    title: 'Wants',
    line: 'The life you’re building: big goals, items, net worth and setups.',
    icon: Sparkles,
    iconCls: 'bg-gradient-to-br from-indigo-400 to-indigo-600',
    on: 'border-indigo-400/50 bg-indigo-500/15 text-white',
    form: 'border-indigo-400/25 bg-indigo-500/[0.06]',
    create: 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-indigo-500/20',
  },
  {
    id: 'needs',
    title: 'Needs',
    line: 'Everyday money: week by week, with a budget for each month.',
    icon: ShoppingBasket,
    iconCls: 'bg-gradient-to-br from-emerald-400 to-teal-500',
    on: 'border-emerald-400/50 bg-emerald-500/15 text-white',
    form: 'border-emerald-400/25 bg-emerald-500/[0.06]',
    create: 'bg-gradient-to-r from-emerald-500 to-emerald-400 text-emerald-950 shadow-emerald-500/20',
  },
]
const kindOf = (id: ModeKind) => KINDS.find((k) => k.id === id)!
const mainLabel = (kind: ModeKind) => (kind === 'needs' ? 'Your main budget' : 'Your main plan')

const NAME_INPUT =
  'h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:text-sm'

/** The modes in order, with each kind's main one (its first) and which ones the current plan can open (the first ones, up to its limit). */
function useModes() {
  const modes = useStore((s) => s.modes)
  const modeId = useStore((s) => s.modeId)
  const limit = useModeLimit()
  const used: Record<ModeKind, number> = { wants: 0, needs: 0 }
  const list = modes.map((m, i) => {
    const kind = modeKind(m)
    return { ...m, index: i, kind, main: used[kind] === 0, locked: used[kind]++ >= limit }
  })
  const current = list.find((m) => m.id === modeId) ?? list[0]
  const mainId = list.find((m) => m.kind === current.kind && m.main)?.id ?? MAIN_MODE
  return { list, current, mainId, limit, canAdd: (kind: ModeKind) => used[kind] < limit }
}

/** The way to more modes, said for where the person is: the free trial (1 of each) or the 6-month plan. */
function askForMore(limit: number, kind: ModeKind, name?: string) {
  const title = kindOf(kind).title
  const held = name ? `“${name}” is kept safe. ` : ''
  openPlans()
  toast.info(limit === 1 ? `${held}Your free trial includes 1 ${title} mode. Pick a plan to have more.` : `${held}Your plan includes ${limit} ${title} modes. Go Yearly for unlimited.`)
}

/** Opens a mode. Crossing between Wants and Needs lands on that section's main page. */
function open(m: { id: string; name: string; locked: boolean; kind: ModeKind }, limit: number) {
  if (m.locked) return askForMore(limit, m.kind, m.name)
  const s = useStore.getState()
  const crossing = modeKind(s.modes.find((x) => x.id === s.modeId)) !== m.kind
  s.switchMode(m.id)
  if (crossing && s.view !== 'settings') s.setView('planner')
}

/** The last mode used of each kind, so going back to Wants or Needs lands where you were. */
export const lastMode: Partial<Record<ModeKind, string>> = {}

export function modeFor(kind: ModeKind, modes: ModeInfo[]) {
  return modes.find((m) => m.id === lastMode[kind] && modeKind(m) === kind) ?? modes.find((m) => modeKind(m) === kind)
}

/** Switches to a mode of this kind if one isn't in use. False when there is none of that kind yet. */
export function enterKind(kind: ModeKind) {
  const s = useStore.getState()
  if (modeKind(s.modes.find((m) => m.id === s.modeId)) === kind) return true
  const to = modeFor(kind, s.modes)
  if (!to) return false
  s.switchMode(to.id)
  return true
}

/**
 * Header: a Wants button and a Needs button. The name goes straight to that section's overview;
 * the arrow beside it opens the menu of that section's modes.
 */
export function ModeSwitcher({ phone }: { phone: boolean }) {
  const { list, current, limit, canAdd } = useModes()
  lastMode[current.kind] = current.id
  const [menu, setMenu] = useState<ModeKind | null>(null)
  // A kind: Manage, opened on a new mode of that kind.
  const [manage, setManage] = useState<null | 'list' | 'copy' | ModeKind>(null)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setMenu(null)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setMenu(null)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [menu])

  const shown = menu ? kindOf(menu) : null
  const modes = list.filter((m) => m.kind === menu)
  const act = (then: () => void) => () => {
    setMenu(null)
    then()
  }
  const addNew = (kind: ModeKind) => act(() => (canAdd(kind) ? setManage(kind) : askForMore(limit, kind)))

  return (
    <div ref={root} className={`relative flex min-w-0 gap-1.5 ${phone ? 'flex-1' : ''}`}>
      {KINDS.map((k) => {
        const inUse = current.kind === k.id
        const count = list.filter((m) => m.kind === k.id).length
        const opened = menu === k.id
        // The name: straight to this section's overview (no modes of this kind yet: the menu, to make one).
        const goOverview = () => {
          setMenu(null)
          if (!enterKind(k.id)) return setMenu(k.id)
          goTo('overview')
        }
        return (
          <div
            key={k.id}
            className={`flex min-w-0 items-stretch overflow-hidden rounded-xl border text-sm font-medium transition ${phone ? `h-10 ${inUse ? 'flex-[2]' : 'flex-1'}` : `h-9 ${inUse ? 'max-w-[14rem]' : 'shrink-0'}`} ${
              inUse ? k.on : 'border-white/10 bg-white/[0.03] text-zinc-300 hover:border-white/20 hover:text-white'
            } ${opened ? 'ring-2 ring-white/15' : ''}`}
          >
            <button
              onClick={goOverview}
              aria-current={inUse ? 'true' : undefined}
              aria-label={inUse ? `${k.title}, in “${current.name}”. Go to the overview.` : `${k.title}. Go to the overview.`}
              title={`${k.title} overview`}
              className="flex min-w-0 flex-1 items-center gap-1.5 pl-2.5 pr-1.5 transition hover:bg-white/[0.06]"
            >
              <k.icon className={`h-4 w-4 shrink-0 ${k.id === 'needs' ? 'text-emerald-300' : 'text-indigo-300'}`} />
              <span className="shrink-0 font-semibold">{k.title}</span>
              {inUse ? (
                <>
                  <span aria-hidden className="shrink-0 text-white/30">·</span>
                  <span className="min-w-0 flex-1 truncate text-left font-normal text-zinc-200">{current.name}</span>
                  {current.main && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label={mainLabel(current.kind)} />}
                </>
              ) : (
                count > 0 && <span className="ml-auto shrink-0 rounded-full bg-white/[0.08] px-1.5 text-[11px] font-semibold tabular-nums text-zinc-400">{count}</span>
              )}
            </button>
            <button
              onClick={() => setMenu(opened ? null : k.id)}
              aria-expanded={opened}
              aria-haspopup="menu"
              aria-label={`Show ${k.title} modes`}
              title={`${k.title} modes`}
              className="grid w-7 shrink-0 place-items-center border-l border-white/10 text-zinc-500 transition hover:bg-white/[0.08] hover:text-white"
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-300 ${opened ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )
      })}

      {shown && (
        <div key={shown.id} role="menu" aria-label={`${shown.title} modes`} className="animate-menu absolute left-0 top-full z-50 mt-2 w-[20rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-white/10 bg-[#0e1016] shadow-2xl shadow-black/60 2xl:left-auto 2xl:right-0">
          <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3">
            <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-white ${shown.iconCls}`}>
              <shown.icon className="h-4 w-4" strokeWidth={2.4} />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-white">{shown.title} modes</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-zinc-500">{shown.line}</span>
            </span>
          </div>

          {modes.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm font-medium text-zinc-200">No {shown.title} modes yet</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-500">Make one to start. You can have as many separate budgets as your plan allows.</p>
            </div>
          ) : (
            <ul className="max-h-72 overflow-y-auto p-1.5">
              {modes.map((m) => (
                <MenuModeRow key={m.id} m={m} on={m.id === current.id} onOpen={act(() => open(m, limit))} />
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-1.5 border-t border-white/[0.06] p-2">
            {current.kind === shown.id && (
              <button onClick={act(() => setManage('copy'))} className="col-span-2 inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-zinc-200 transition hover:bg-white/5">
                <Copy className="h-3.5 w-3.5" /> Copy “<span className="max-w-[10rem] truncate">{current.name}</span>”
              </button>
            )}
            <button onClick={addNew(shown.id)} className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold ${shown.create}`}>
              {canAdd(shown.id) ? <Plus className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />}
              {canAdd(shown.id) ? `New ${shown.title} mode` : 'Unlock more'}
            </button>
            <button onClick={act(() => setManage('list'))} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-zinc-200 transition hover:bg-white/5">
              <Settings2 className="h-3.5 w-3.5" /> Manage
            </button>
          </div>
        </div>
      )}

      {manage === 'copy' && <CopyModeModal onClose={() => setManage(null)} />}
      {manage && manage !== 'copy' && <ModesModal startAdding={manage === 'list' ? undefined : manage} onCopy={() => setManage('copy')} onClose={() => setManage(null)} />}
    </div>
  )
}

/**
 * One mode in the header menu. Click to open it; hovering shows a pencil that turns the name into a field,
 * so a mode can be renamed right there (Enter or clicking away saves, Escape cancels).
 */
function MenuModeRow({ m, on, onOpen }: { m: ModeInfo & { index: number; kind: ModeKind; main: boolean; locked: boolean }; on: boolean; onOpen: () => void }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(m.name)
  // Set on Escape, so the blur that follows (the field going away) doesn't save the name anyway.
  const cancelled = useRef(false)
  const mc = modeColor(m.index, m.kind)

  function startEditing() {
    cancelled.current = false
    setName(m.name)
    setEditing(true)
  }
  function save() {
    if (!cancelled.current) useStore.getState().renameMode(m.id, name)
    setEditing(false)
  }

  return (
    <li className={`group flex items-center rounded-xl transition ${on ? `${mc.soft} ring-1 ${mc.ring}` : 'hover:bg-white/5'}`}>
      {editing ? (
        <div className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-1.5">
          <span className={`mx-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${mc.dot}`} />
          <input
            autoFocus
            value={name}
            maxLength={MAX_MODE_NAME}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur()
              if (e.key === 'Escape') {
                // Cancel the rename only: keep the menu open.
                e.stopPropagation()
                cancelled.current = true
                setEditing(false)
              }
            }}
            aria-label={`Rename ${m.name}`}
            className="h-8 min-w-0 flex-1 rounded-lg border border-white/15 bg-black/40 px-2 text-sm font-medium text-white outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
          />
          <button
            type="button"
            // Saves through the input's blur; mousedown keeps it from closing first.
            onMouseDown={(e) => e.preventDefault()}
            onClick={save}
            aria-label="Save name"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-300 transition hover:bg-white/10 hover:text-white"
          >
            <Check className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <button role="menuitemradio" aria-checked={on} onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 pl-2.5 text-left">
            <span className={`mx-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${mc.dot} ${m.locked ? 'opacity-40' : ''}`} />
            <span className="min-w-0 flex-1">
              <span className={`block truncate text-sm font-medium ${m.locked ? 'text-zinc-500' : 'text-zinc-100'}`}>{m.name}</span>
              {m.main && <span className="block text-[11px] text-zinc-500">{mainLabel(m.kind)}</span>}
            </span>
            {m.main && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-300" aria-label="Main" />}
            {m.locked && <Lock className="h-3.5 w-3.5 shrink-0 text-zinc-500" aria-label="Needs the yearly plan" />}
            {on && <Check className={`h-4 w-4 shrink-0 ${mc.text}`} />}
          </button>
          <button
            type="button"
            onClick={startEditing}
            title="Rename"
            aria-label={`Rename ${m.name}`}
            className="mx-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 opacity-0 transition hover:bg-white/10 hover:text-white focus-visible:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </>
      )}
    </li>
  )
}

/** Manage modes, section by section: rename, delete, choose the main one, and add one. `startAdding`: open on a new mode of this kind. */
export function ModesModal({ startAdding, onCopy, onClose }: { startAdding?: ModeKind; onCopy: () => void; onClose: () => void }) {
  const { list, current, limit, canAdd } = useModes()
  const [adding, setAdding] = useState<ModeKind | null>(startAdding && canAdd(startAdding) ? startAdding : null)
  const s = useStore.getState()

  function remove(m: ModeInfo & { main: boolean; kind: ModeKind }) {
    if (!confirm(`Delete the mode “${m.name}”? ${modeKind(m) === 'needs' ? 'Its items, budgets and categories are' : 'Its months, items, setups and year notes are'} deleted for good. Your other modes, calendar and expenses stay${modeKind(m) === 'needs' ? ', including anything already sent to Expenses' : ''}.`)) return
    // The next one along takes over as the main one.
    const next = m.main ? list.find((x) => x.kind === m.kind && !x.main) : undefined
    s.removeMode(m.id)
    toast.info(`Deleted “${m.name}”.${next ? ` “${next.name}” is now ${mainLabel(m.kind).toLowerCase()}.` : ''}`)
  }

  return (
    <Modal title="Modes" subtitle="Wants and Needs each keep their own modes. The crown marks the main one." onClose={onClose} width="max-w-lg">
      <div className="space-y-6">
        {KINDS.map((k) => {
          const modes = list.filter((m) => m.kind === k.id)
          return (
            <section key={k.id} aria-label={`${k.title} modes`}>
              <div className="mb-2.5 flex items-center gap-2.5">
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-white ${k.iconCls}`}>
                  <k.icon className="h-4 w-4" strokeWidth={2.4} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-white">{k.title}</span>
                  <span className="block text-xs text-zinc-500">{k.line}</span>
                </span>
                <span className="shrink-0 rounded-full bg-white/[0.07] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-zinc-400">{modes.length}</span>
              </div>
              <ul className="space-y-1.5">
                {modes.map((m) => (
                  <ModeRow key={m.id} m={m} current={m.id === current.id} onCopy={onCopy} onDelete={() => remove(m)} />
                ))}
              </ul>
              {adding === k.id ? (
                <NewModeForm kind={k.id} onCancel={() => setAdding(null)} onDone={onClose} />
              ) : canAdd(k.id) ? (
                <button onClick={() => setAdding(k.id)} className={`${modes.length ? 'mt-1.5' : ''} flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/15 py-2.5 text-sm font-medium text-zinc-300 transition hover:border-white/30 hover:text-white`}>
                  <Plus className="h-4 w-4" /> New {k.title} mode
                </button>
              ) : (
                <button onClick={() => askForMore(limit, k.id)} className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-amber-300/30 bg-amber-300/[0.05] py-2.5 text-sm font-medium text-amber-100 transition hover:border-amber-300/60 hover:bg-amber-300/10">
                  <Sparkles className="h-4 w-4 text-amber-300" /> Unlock more {k.title} modes
                </button>
              )}
            </section>
          )
        })}
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 text-xs text-zinc-400">
        {limit === Infinity ? (
          <span>Unlimited modes on your plan.</span>
        ) : (
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {limit === 1 ? '1 Wants and 1 Needs mode during your free trial.' : `${limit} Wants and ${limit} Needs modes on your plan.`}
              {list.some((m) => m.locked) && <span className="text-amber-200/80"> {list.filter((m) => m.locked).length} more kept safe (locked).</span>}
            </span>
            <button onClick={() => openPlans()} className="inline-flex items-center gap-1 font-semibold text-indigo-200 hover:text-white">
              <Sparkles className="h-3.5 w-3.5" /> {limit === 1 ? 'See plans' : 'Get Yearly for unlimited'}
            </button>
          </span>
        )}
      </div>
    </Modal>
  )
}

/** A name for a new mode that isn't taken: "Needs", "Needs 2", "Mode 3". */
function newModeName(kind: ModeKind, taken: string[]) {
  const base = kind === 'needs' ? 'Needs' : 'Mode'
  if (kind === 'needs' && !taken.includes(base)) return base
  for (let n = 2; ; n++) if (!taken.includes(`${base} ${n}`)) return `${base} ${n}`
}

function NewModeForm({ kind, onCancel, onDone }: { kind: ModeKind; onCancel: () => void; onDone: () => void }) {
  const { list, current } = useModes()
  const [name, setName] = useState('')
  const [copy, setCopy] = useState(false)
  const k = kindOf(kind)
  // Only a mode of the same kind can be copied: a plan of items can't become budgets, or the other way round.
  const canCopy = current.kind === kind
  const copying = copy && canCopy
  const fallback = newModeName(kind, list.map((m) => m.name))

  function create() {
    const s = useStore.getState()
    const id = s.addMode(name || fallback, copying, kind)
    const made = useStore.getState().modes.find((m) => m.id === id)
    if (current.kind !== kind && s.view !== 'settings') s.setView('planner')
    toast.success(
      copying
        ? `Now in “${made?.name}”. It starts as a copy of “${current.name}”.`
        : kind === 'needs'
          ? `Now in “${made?.name}”. Set a monthly budget and start adding.`
          : `Now in “${made?.name}”. It starts empty, separate from “${current.name}”.`,
    )
    onDone()
  }

  return (
    <div className={`animate-fade mt-1.5 space-y-3 rounded-2xl border p-4 ${k.form}`}>
      <input
        autoFocus
        value={name}
        maxLength={MAX_MODE_NAME}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && create()}
        aria-label={`New ${k.title} mode name`}
        placeholder={kind === 'needs' ? 'e.g. Monthly needs, Student budget' : `e.g. Dream life, Safe plan, ${fallback}`}
        className={NAME_INPUT}
      />
      {canCopy ? (
        <div className="grid grid-cols-2 gap-2">
          <StartOption on={!copy} onClick={() => setCopy(false)} icon={FilePlus2} title={kind === 'needs' ? 'Start fresh' : 'Start empty'} hint={kind === 'needs' ? 'Common categories, no budget' : 'A blank plan'} />
          <StartOption on={copy} onClick={() => setCopy(true)} icon={Copy} title={`Copy “${current.name}”`} hint="Then change it freely" />
        </div>
      ) : (
        kind === 'needs' && <p className="text-xs leading-relaxed text-zinc-400">Offers groceries, food, transport, bills and health, and you can change the list. What you add stays here, and only goes to Expenses when you tick it.</p>
      )}
      <div className="flex justify-end gap-2">
        <button onClick={onCancel} className="h-10 rounded-xl px-4 text-sm font-medium text-zinc-400 hover:text-white">
          Cancel
        </button>
        <button onClick={create} className={`h-10 rounded-xl px-5 text-sm font-semibold shadow-lg ${k.create}`}>
          Create and open
        </button>
      </div>
    </div>
  )
}

function ModeRow({ m, current, onCopy, onDelete }: { m: ModeInfo & { index: number; kind: ModeKind; main: boolean; locked: boolean }; current: boolean; onCopy: () => void; onDelete: () => void }) {
  const limit = useModeLimit()
  const [name, setName] = useState(m.name)
  // Changing the main Wants mode gives this id another mode's name.
  useEffect(() => setName(m.name), [m.name])
  const c = modeColor(m.index, m.kind)
  return (
    <li className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-2 ${current ? `border-transparent ${c.soft} ring-1 ${c.ring}` : 'border-white/[0.07]'}`}>
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${c.soft}`}>
        {m.main ? <Crown className="h-4 w-4 text-amber-300" /> : m.locked ? <Lock className="h-4 w-4 text-zinc-500" /> : m.kind === 'needs' ? <ShoppingBasket className="h-4 w-4 text-emerald-300" /> : <Layers className={`h-4 w-4 ${c.text}`} />}
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
          {[m.main && mainLabel(m.kind), current && 'In use', m.locked && 'Locked on your plan'].filter(Boolean).join(' · ') || `${m.kind === 'needs' ? 'Needs' : 'Wants'} mode`}
        </span>
      </span>
      {current && (
        <button onClick={onCopy} title="Copy this mode" aria-label={`Copy ${m.name}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white">
          <Copy className="h-4 w-4" />
        </button>
      )}
      {!current && (
        <button
          onClick={() => open(m, limit)}
          className="h-8 shrink-0 rounded-lg border border-white/10 px-2.5 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
        >
          Open
        </button>
      )}
      {!m.main && !m.locked && (
        <button
          onClick={() => {
            useStore.getState().setMainMode(m.id)
            toast.success(`“${m.name}” is now ${mainLabel(m.kind).toLowerCase()}.`)
          }}
          title="Make this the main one"
          aria-label={`Make ${m.name} the main ${m.kind === 'needs' ? 'Needs' : 'Wants'} mode`}
          className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-amber-300/10 hover:text-amber-300"
        >
          <Crown className="h-4 w-4" />
        </button>
      )}
      {m.id !== MAIN_MODE && (
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

/** "Dream life copy", or "Dream life copy 2" when that's taken. Always fits the name limit. */
function copyName(name: string, taken: string[]) {
  for (let n = 1; ; n++) {
    const ending = n === 1 ? ' copy' : ` copy ${n}`
    const made = name.slice(0, MAX_MODE_NAME - ending.length).trimEnd() + ending
    if (!taken.includes(made)) return made
  }
}

const NEW_MODE = 'new'

/** Copy the mode in use: into a new mode, or over one you already have. */
export function CopyModeModal({ onClose }: { onClose: () => void }) {
  const { list, current, limit, canAdd: canAddTo } = useModes()
  const canAdd = canAddTo(current.kind)
  // A plan of items and a set of budgets are different things: only a mode of the same kind can be copied over.
  const others = list.filter((m) => m.id !== current.id && !m.locked && m.kind === current.kind)
  const suggested = copyName(current.name, list.map((m) => m.name))
  // Nothing is picked when the only choices would replace a mode: that has to be a deliberate click.
  const [to, setTo] = useState<string | null>(canAdd ? NEW_MODE : null)
  const [name, setName] = useState(suggested)
  const target = others.find((m) => m.id === to)
  const creating = to === NEW_MODE
  const c = modeColor(current.index, current.kind)

  function copy() {
    const s = useStore.getState()
    if (creating) {
      const id = s.addMode(name.trim() || suggested, true, current.kind)
      const made = useStore.getState().modes.find((m) => m.id === id)
      toast.success(`Now in “${made?.name}”. It starts as a copy of “${current.name}”.`)
    } else if (target) {
      toast.undo(`“${target.name}” is now a copy of “${current.name}”.`, s.copyModeOver(target.id))
    } else return
    onClose()
  }

  return (
    <Modal
      title="Copy this mode"
      subtitle="Make a separate copy to change freely. This mode stays as it is."
      onClose={onClose}
      width="max-w-lg"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="h-10 shrink-0 rounded-xl px-4 text-sm font-medium text-zinc-400 hover:text-white">
            Cancel
          </button>
          <button
            onClick={copy}
            disabled={!creating && !target}
            className={`inline-flex h-10 min-w-0 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
              target ? 'bg-amber-400 text-zinc-950 hover:bg-amber-300' : 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-lg shadow-indigo-500/20'
            }`}
          >
            <Copy className="h-4 w-4 shrink-0" />
            <span className="truncate">{target ? `Replace “${target.name}”` : creating ? 'Copy and open' : 'Copy'}</span>
          </button>
        </div>
      }
    >
      <div className={`flex items-center gap-3 rounded-xl px-3 py-2.5 ring-1 ${c.soft} ${c.ring}`}>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold text-white">{current.name}</span>
          <span className="block text-[11px] text-zinc-400">{current.kind === 'needs' ? 'Items, monthly budgets and categories' : 'Months, items, net worth, setups and year notes'}</span>
        </span>
      </div>

      <p className="mb-2 mt-5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
        <ArrowRight className="h-3.5 w-3.5" /> Copy to
      </p>
      <div role="radiogroup" aria-label="Copy to" className="space-y-1.5">
        {canAdd ? (
          <CopyTarget on={creating} onClick={() => setTo(NEW_MODE)} title="A new mode" hint="Starts as an exact copy">
            <Plus className="h-4 w-4 text-indigo-200" />
          </CopyTarget>
        ) : (
          <button
            onClick={() => askForMore(limit, current.kind)}
            className="flex w-full items-center gap-2.5 rounded-xl border border-dashed border-white/15 px-2.5 py-2 text-left transition hover:border-white/30"
          >
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04]">
              <Sparkles className="h-4 w-4 text-indigo-200" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-200">A new mode</span>
              <span className="block text-[11px] text-zinc-500">{limit === 1 ? 'Pick a plan to have more modes' : 'Get Yearly for unlimited modes'}</span>
            </span>
          </button>
        )}
        {creating && (
          <input
            autoFocus
            value={name}
            maxLength={MAX_MODE_NAME}
            onFocus={(e) => e.target.select()}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && copy()}
            aria-label="New mode name"
            placeholder={suggested}
            className={`animate-fade ${NAME_INPUT}`}
          />
        )}
        {others.map((m) => {
          const mc = modeColor(m.index, m.kind)
          return (
            <CopyTarget key={m.id} on={to === m.id} onClick={() => setTo(m.id)} title={m.name} hint={m.main ? `${mainLabel(m.kind)} · replaces what’s in it` : 'Replaces what’s in it'}>
              {m.main ? <Crown className="h-4 w-4 text-amber-300" /> : <span className={`h-2.5 w-2.5 rounded-full ${mc.dot}`} />}
            </CopyTarget>
          )
        })}
      </div>

      {target && (
        <p className="animate-fade mt-3 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
          <span>
            What’s in “{target.name}” now is replaced by this copy. You can undo it right after. Calendar, expenses and goals are shared, so they don’t change.
          </span>
        </p>
      )}
    </Modal>
  )
}

function CopyTarget({ on, onClick, title, hint, children }: { on: boolean; onClick: () => void; title: string; hint: string; children: ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition ${on ? 'border-indigo-400/60 bg-indigo-500/15' : 'border-white/[0.07] hover:border-white/20'}`}
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.04]">{children}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-zinc-100">{title}</span>
        <span className="block text-[11px] text-zinc-500">{hint}</span>
      </span>
      {on && <Check className="h-4 w-4 shrink-0 text-indigo-200" />}
    </button>
  )
}

/** Overview & Assets: which mode this is, when there's more than one (so it's always clear which plan you're editing). */
export function ModeStrip() {
  const { list, current, mainId } = useModes()
  if (list.length < 2) return null
  const c = modeColor(current.index, current.kind)
  return (
    <div className={`animate-fade flex items-center gap-3 rounded-2xl border bg-gradient-to-r to-transparent px-4 py-2.5 ${c.strip}`}>
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${c.dot}`} />
      <p className="min-w-0 flex-1 truncate text-sm text-zinc-300">
        {current.main ? (
          <>
            <span className="font-semibold text-white">{current.name}</span> · {mainLabel(current.kind).toLowerCase()}
          </>
        ) : (
          <>
            Mode <span className="font-semibold text-white">{current.name}</span>
            <span className="text-zinc-500"> · its own overview, items, setups and year notes</span>
          </>
        )}
      </p>
      {!current.main && (
        <button onClick={() => useStore.getState().switchMode(mainId)} className="shrink-0 rounded-lg px-2.5 py-1 text-xs font-medium text-zinc-300 transition hover:bg-white/10 hover:text-white">
          Back to main
        </button>
      )}
    </div>
  )
}

/**
 * If the mode in use is locked (the plan changed to one with fewer modes), go back to the main one of its kind.
 * A Needs mode has no assets of its own, so pages built around them send you to its budget.
 */
export function useModeGuard() {
  const { current, mainId } = useModes()
  const view = useStore((s) => s.view)
  useEffect(() => {
    if (current.kind === 'needs' && (view === 'assets' || view === 'favorites' || view === 'plan')) useStore.getState().setView('planner')
  }, [current.kind, view])
  useEffect(() => {
    if (!current.locked) return
    useStore.getState().switchMode(mainId)
    toast.info(`Back to ${mainLabel(current.kind).toLowerCase()}: “${current.name}” is kept safe and opens again with a bigger plan.`)
  }, [current.locked, current.name, current.kind, mainId])
}
