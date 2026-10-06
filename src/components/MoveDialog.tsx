import { useState } from 'react'
import { Check } from 'lucide-react'
import { fitCheck, useFmt, useStore, useUsd } from '../store'
import { MONTHS_SHORT, YEARS, indexOf, indexOfKey, fromIndex, keyOf, labelOfKey } from '../lib/time'
import { TREND } from '../lib/meta'
import { Modal } from './Modal'
import { toast } from '../toast'

export function MoveDialog({ monthKey, id }: { monthKey: string; id: string }) {
  const f = useFmt()
  const u = useUsd()
  const months = useStore((s) => s.months)
  const close = useStore((s) => s.closeModal)
  const item = months[monthKey]?.items.find((i) => i.id === id)
  const [mode, setMode] = useState<'move' | 'copy'>('move')
  const [year, setYear] = useState(fromIndex(indexOfKey(monthKey)).year)
  const [picked, setPicked] = useState<string[]>([])

  if (!item) return null
  const t = TREND[item.trend]

  function run(keys: string[]) {
    const s = useStore.getState()
    const errors: string[] = []
    const warnings: string[] = []
    const done: string[] = []
    for (const k of keys) {
      const r = s.transferItem(monthKey, id, k, mode)
      if (!r.ok) errors.push(r.error)
      else {
        done.push(k)
        if (r.warning) warnings.push(r.warning)
      }
    }
    if (done.length) {
      const where = done.length === 1 ? labelOfKey(done[0]) : `${done.length} months`
      toast.success(`${mode === 'move' ? 'Moved' : 'Copied'} “${item!.name}” to ${where}.`)
      close()
    }
    warnings.forEach((w) => toast.warning(w))
    errors.forEach((e) => toast.error(e))
  }

  function clickMonth(key: string) {
    if (mode === 'move') return run([key])
    setPicked((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]))
  }

  return (
    <Modal
      title={mode === 'move' ? 'Move item' : 'Copy item'}
      subtitle={
        <span className="inline-flex items-center gap-1.5">
          <t.icon className={`h-3.5 w-3.5 ${t.text}`} />
          {item.name} · {f(item.price)} (≈ {u(item.price)}) · from {labelOfKey(monthKey)}
        </span>
      }
      onClose={close}
      width="max-w-lg"
      footer={
        mode === 'copy' ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-zinc-500">Pick one or more months, across any years.</p>
            <button
              disabled={!picked.length}
              onClick={() => run(picked)}
              className="h-11 rounded-xl sm:h-10 bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
            >
              Copy to {picked.length || ''} month{picked.length === 1 ? '' : 's'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-zinc-500">Tap a month to move the item there.</p>
        )
      }
    >
      <div className="space-y-4">
        <div className="inline-flex w-full rounded-xl border border-white/10 bg-white/[0.03] p-1 text-sm">
          {(['move', 'copy'] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m)
                setPicked([])
              }}
              className={`flex-1 rounded-lg py-2 font-medium capitalize transition ${
                mode === m ? 'bg-white/10 text-white shadow' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="scrollbar-none -mx-1 flex gap-1 overflow-x-auto px-1">
          {YEARS.map((y) => (
            <button
              key={y}
              onClick={() => setYear(y)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium tabular-nums transition ${
                y === year ? 'bg-indigo-500/25 text-white ring-1 ring-indigo-400/50' : 'text-zinc-400 hover:bg-white/5'
              }`}
            >
              {y}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {MONTHS_SHORT.map((label, mo) => {
            const key = keyOf(indexOf(year, mo))
            const isSource = key === monthKey && mode === 'move'
            const fit = fitCheck(months, key, item.price)
            const on = picked.includes(key)
            const disabled = isSource
            return (
              <button
                key={key}
                disabled={disabled}
                title={isSource ? 'Item is already here' : (fit.warning ?? undefined)}
                onClick={() => clickMonth(key)}
                className={`relative rounded-xl border px-2 py-2.5 text-left transition ${
                  on
                    ? 'border-indigo-400/70 bg-indigo-500/20'
                    : disabled
                      ? 'cursor-not-allowed border-white/[0.05] opacity-45'
                      : fit.warning
                        ? 'border-red-500/40 bg-red-500/[0.06] hover:border-red-400/60 hover:bg-red-500/10'
                        : 'border-white/10 bg-white/[0.02] hover:border-indigo-400/40 hover:bg-indigo-500/10'
                }`}
              >
                <p className="text-sm font-semibold text-white">{label}</p>
                <p className={`truncate text-[11px] tabular-nums ${isSource || !fit.warning ? 'text-zinc-400' : 'text-red-300'}`}>
                  {isSource ? 'current' : `${f(fit.left, true)} left`}
                </p>
                {on && <Check className="absolute right-2 top-2 h-4 w-4 text-indigo-200" />}
              </button>
            )
          })}
        </div>
        <p className="text-[11px] text-zinc-500">Red months don't have enough budget or earnings for this item. You can still put it there; it'll just be marked red.</p>
      </div>
    </Modal>
  )
}
