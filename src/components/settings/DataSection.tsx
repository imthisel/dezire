import { useMemo, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, Check, Download, Flag, Gem, Receipt, Trash2, Upload } from 'lucide-react'
import { clearData, downloadBackup, downloadCalendar, downloadExpensesCsv, downloadGoalsCsv, downloadItemsCsv, readBackup, restoreBackup, type BackupInfo, type ClearPart } from '../../backup'
import { snapshot } from '../../cloud'
import { useStore } from '../../store'
import { Modal } from '../Modal'
import { ActionRow, Button, Group, Row, ToggleRow } from './ui'

/** The most one account's plan can hold: the limit on one saved document. */
const MAX_BYTES = 1024 * 1024

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${Number((bytes / (1024 * 1024)).toFixed(2))} MB`)
const ago = (ms: number) => {
  const days = Math.floor((Date.now() - ms) / 86_400_000)
  return days <= 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`
}
const plural = (n: number, word: string) => `${n.toLocaleString('en-US')} ${word}${n === 1 ? '' : 's'}`

export function DataSection() {
  const hideBackup = useStore((s) => s.prefs.hideBackup)
  const lastBackup = useStore((s) => s.device.lastBackup)
  const months = useStore((s) => s.months)
  const expenses = useStore((s) => s.expenses.length)
  const tasks = useStore((s) => s.tasks.length)
  const goals = useStore((s) => Object.values(s.goals).reduce((n, l) => n + l.length, 0))
  const sources = useStore((s) => s.sources.length)
  const modes = useStore((s) => s.modes.length)
  const items = useMemo(() => Object.values(months).reduce((n, m) => n + m.items.length, 0), [months])
  const file = useRef<HTMLInputElement>(null)
  const [restoring, setRestoring] = useState<BackupInfo | null>(null)
  const [clearing, setClearing] = useState(false)
  const setPrefs = useStore.getState().setPrefs

  // Worked out when the page opens: the whole plan has to be measured, so not on every change.
  const bytes = useMemo(() => new Blob([JSON.stringify(snapshot())]).size, [])
  const used = bytes / MAX_BYTES
  const tight = used > 0.8

  return (
    <>
      <Group title="Backups" hint="Your plan already saves to your account. A backup is an extra copy you keep yourself.">
        <ActionRow id="backup" icon={Download} title="Download a backup" hint={lastBackup ? `Last one on this device: ${ago(lastBackup)}.` : 'One file with your whole plan and all your modes.'} onClick={downloadBackup} />
        <ActionRow id="restore" icon={Upload} title="Restore from a backup" hint="Replaces what’s in your account with the file. You’ll see what’s in it first." onClick={() => file.current?.click()} />
        <ToggleRow id="data-buttons" title="Show Export & Import in the header" hint="Turn off for a simpler look. Both keep working from here." on={!hideBackup} onChange={(on) => setPrefs({ hideBackup: !on })} />
        <input
          ref={file}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (f) setRestoring(await readBackup(f))
          }}
        />
      </Group>

      <Group title="Spreadsheets & calendars" hint="Your data in files other apps can open, like Excel, Google Sheets, Google Calendar and Apple Calendar.">
        <ActionRow id="csv-expenses" icon={Receipt} title="Expenses spreadsheet" hint="Every expense, by date." value={expenses || undefined} onClick={downloadExpensesCsv} />
        <ActionRow id="csv-items" icon={Gem} title="Items spreadsheet" hint="Everything in the mode you’re using, by month." value={items || undefined} onClick={downloadItemsCsv} />
        <ActionRow id="csv-goals" icon={Flag} title="Goals spreadsheet" hint="Your yearly goals." value={goals || undefined} onClick={downloadGoalsCsv} />
        <ActionRow id="ics" icon={CalendarDays} title="Calendar file" hint="Events and tasks with a date, including repeating ones." value={tasks || undefined} onClick={downloadCalendar} />
      </Group>

      <Group title="Your account’s data">
        <Row id="storage" title="Space used" hint={tight ? 'You’re getting close to the limit. Clearing old expenses or modes you don’t need makes room.' : 'How much of the space for your plan is in use.'} stacked>
          <div>
            <div className="h-2 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Space used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used * 100)}>
              <div className={`h-full rounded-full ${tight ? 'bg-amber-400' : 'bg-gradient-to-r from-indigo-500 to-emerald-400'}`} style={{ width: `${Math.max(1, Math.min(100, used * 100))}%` }} />
            </div>
            <p className="mt-1.5 text-xs tabular-nums text-zinc-500">
              {size(bytes)} of {size(MAX_BYTES)}
            </p>
          </div>
        </Row>
        <div className="grid grid-cols-2 gap-px bg-white/[0.06] sm:grid-cols-3">
          {[
            ['Items', items],
            ['Expenses', expenses],
            ['Events & tasks', tasks],
            ['Yearly goals', goals],
            ['Money plans', sources],
            ['Modes', modes],
          ].map(([label, n]) => (
            <div key={label} className="bg-[#0b0c11] px-4 py-3">
              <p className="text-lg font-semibold tabular-nums text-white">{Number(n).toLocaleString('en-US')}</p>
              <p className="text-xs text-zinc-500">{label}</p>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Danger zone">
        <ActionRow id="clear" icon={Trash2} title="Clear data" hint="Delete expenses, the calendar, goals or everything. You pick what goes." danger onClick={() => setClearing(true)} />
      </Group>

      {restoring && <RestoreModal info={restoring} onClose={() => setRestoring(null)} />}
      {clearing && <ClearModal items={items} expenses={expenses} tasks={tasks} goals={goals} sources={sources} onClose={() => setClearing(false)} />}
    </>
  )
}

function RestoreModal({ info, onClose }: { info: BackupInfo; onClose: () => void }) {
  const when = info.exportedAt ? new Date(info.exportedAt) : null
  return (
    <Modal
      title="Restore this backup?"
      subtitle={when && !Number.isNaN(when.getTime()) ? `Made on ${when.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : undefined}
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            tone="primary"
            icon={Upload}
            onClick={() => {
              restoreBackup(info.data)
              onClose()
            }}
          >
            Replace my data
          </Button>
        </div>
      }
    >
      <p className="text-sm text-zinc-400">This file has:</p>
      <ul className="mt-2 grid grid-cols-2 gap-2 text-sm">
        {[plural(info.items, 'item'), plural(info.expenses, 'expense'), `${plural(info.tasks, 'event')} & tasks`, plural(info.goals, 'goal'), plural(info.modes, 'mode')].map((t) => (
          <li key={t} className="flex items-center gap-2 text-zinc-200">
            <Check className="h-3.5 w-3.5 shrink-0 text-emerald-300" /> {t}
          </li>
        ))}
      </ul>
      <p className="mt-4 flex gap-2 rounded-xl border border-amber-400/25 bg-amber-400/[0.07] px-3 py-2.5 text-xs leading-relaxed text-amber-100/90">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-300" />
        <span>Everything in your account is replaced with this file, on all your devices. You can undo it right after.</span>
      </p>
    </Modal>
  )
}

const CONFIRM_WORD = 'DELETE'

function ClearModal({ items, expenses, tasks, goals, sources, onClose }: { items: number; expenses: number; tasks: number; goals: number; sources: number; onClose: () => void }) {
  const modeName = useStore((s) => s.modes.find((m) => m.id === s.modeId)?.name ?? 'Main')
  const [picked, setPicked] = useState<ClearPart[]>([])
  const [typed, setTyped] = useState('')
  const everything = picked.includes('everything')
  const ready = picked.length > 0 && (!everything || typed.trim().toUpperCase() === CONFIRM_WORD)

  const options: { id: ClearPart; title: string; hint: string }[] = [
    { id: 'plan', title: `The plan in “${modeName}”`, hint: `${plural(items, 'item')}, goals to make, budgets, setups and year notes` },
    { id: 'expenses', title: 'Expenses', hint: plural(expenses, 'expense') },
    { id: 'calendar', title: 'Calendar & tasks', hint: plural(tasks, 'entry').replace('entrys', 'entries') },
    { id: 'goals', title: 'Yearly goals', hint: plural(goals, 'goal') },
    { id: 'sources', title: 'Money plans', hint: plural(sources, 'plan') },
    { id: 'everything', title: 'Everything', hint: 'All of the above in every mode, your lists and your birthday' },
  ]

  function toggle(id: ClearPart) {
    if (id === 'everything') return setPicked(everything ? [] : ['everything'])
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p.filter((x) => x !== 'everything'), id]))
  }

  return (
    <Modal
      title="Clear data"
      subtitle="Pick what to delete, on all your devices. You can undo it right after, but not later."
      onClose={onClose}
      width="max-w-md"
      footer={
        <div className="flex justify-end gap-2">
          <Button onClick={onClose}>Cancel</Button>
          <Button
            tone="danger"
            icon={Trash2}
            disabled={!ready}
            onClick={() => {
              clearData(picked)
              onClose()
            }}
          >
            {everything ? 'Delete everything' : 'Delete selected'}
          </Button>
        </div>
      }
    >
      <div className="space-y-1.5">
        {options.map((o) => {
          const on = picked.includes(o.id)
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(o.id)}
              className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${on ? 'border-red-400/50 bg-red-500/10' : 'border-white/[0.07] hover:border-white/20'}`}
            >
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border ${on ? 'border-red-400 bg-red-500' : 'border-white/20'}`}>{on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-zinc-100">{o.title}</span>
                <span className="block text-xs text-zinc-500">{o.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      {everything && (
        <label className="animate-fade mt-4 block">
          <span className="text-sm text-zinc-300">
            Type <b className="font-semibold text-white">{CONFIRM_WORD}</b> to confirm
          </span>
          <input
            autoFocus
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
            className="mt-1.5 h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm tracking-wider text-zinc-100 outline-none transition focus:border-red-400/60 focus:ring-2 focus:ring-red-500/20"
          />
        </label>
      )}
    </Modal>
  )
}
