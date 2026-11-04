import { savedModes, useStore } from './store'
import { WEEKDAYS, addDays, fromKey } from './lib/expenses'
import { DUE_SPAN, isEvent } from './lib/tasks'
import { keyOf, labelOfKey, TOTAL_MONTHS } from './lib/time'
import { toast } from './toast'

const today = () => new Date().toISOString().slice(0, 10)

function download(name: string, text: string, type: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type }))
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}

// ---- Backups ----

/** Downloads everything in the account as one file that Restore can read back. */
export function downloadBackup() {
  const s = useStore.getState()
  const { kinds, currency, goals, goalAreas, sources, birthday, expenses, expenseCats, places, tasks, taskKinds, prefs } = s
  const data = { app: 'dizayr', version: 5, exportedAt: new Date().toISOString(), currency, kinds, goals, goalAreas, sources, birthday, expenses, expenseCats, places, tasks, taskKinds, prefs, ...savedModes(s) }
  download(`dizayr-backup-${today()}.json`, JSON.stringify(data, null, 2), 'application/json')
  s.setDevice({ lastBackup: Date.now() })
  toast.success('Backup downloaded.')
}

/** What a backup file holds, shown before it replaces anything. */
export type BackupInfo = { data: unknown; exportedAt: string | null; items: number; expenses: number; tasks: number; goals: number; modes: number }

/** Reads a backup file. Returns null (after saying why) when it isn't one. */
export async function readBackup(file: File): Promise<BackupInfo | null> {
  let d: Record<string, unknown>
  try {
    d = JSON.parse(await file.text())
  } catch {
    toast.error('That file is not valid JSON.')
    return null
  }
  if (!d || typeof d !== 'object' || !d.months || typeof d.months !== 'object') {
    toast.error('That file is not a Dizayr backup.')
    return null
  }
  const count = (list: unknown) => (Array.isArray(list) ? list.length : 0)
  const itemsIn = (months: unknown) => (months && typeof months === 'object' ? Object.values(months as Record<string, { items?: unknown }>).reduce((n, m) => n + count(m?.items), 0) : 0)
  const others = Array.isArray(d.modes) ? (d.modes as { months?: unknown }[]) : []
  return {
    data: d,
    exportedAt: typeof d.exportedAt === 'string' ? d.exportedAt : null,
    items: itemsIn(d.months) + others.reduce((n, m) => n + itemsIn(m?.months), 0),
    expenses: count(d.expenses),
    tasks: count(d.tasks),
    goals: d.goals && typeof d.goals === 'object' ? Object.values(d.goals).reduce((n: number, l) => n + count(l), 0) : 0,
    modes: Math.max(1, others.length),
  }
}

/** Everything a restore or a clear can change, to put back with Undo. */
function keepForUndo() {
  const s = useStore.getState()
  const kept = {
    months: s.months, kinds: s.kinds, goals: s.goals, goalAreas: s.goalAreas, sources: s.sources, birthday: s.birthday, yearNotes: s.yearNotes, currency: s.currency,
    expenses: s.expenses, expenseCats: s.expenseCats, places: s.places, layouts: s.layouts, setupNotes: s.setupNotes, setupFavorites: s.setupFavorites,
    modes: s.modes, modeId: s.modeId, modeData: s.modeData, tasks: s.tasks, taskKinds: s.taskKinds, prefs: s.prefs,
  }
  return () => useStore.setState(kept)
}

/** Replaces everything with a backup. It can be undone right after. */
export function restoreBackup(data: unknown) {
  const undo = keepForUndo()
  const r = useStore.getState().importData(data)
  if (r.ok) toast.undo('Backup restored.', undo)
  else toast.error(r.error)
}

// ---- Clearing ----

export type ClearPart = 'plan' | 'expenses' | 'calendar' | 'goals' | 'sources' | 'everything'

/** Clears part of the account, or all of it. It can be undone right after. */
export function clearData(parts: ClearPart[]) {
  const undo = keepForUndo()
  const s = useStore.getState()
  if (parts.includes('everything')) s.resetAll()
  else {
    useStore.setState({
      ...(parts.includes('plan') ? { months: {}, layouts: {}, setupNotes: {}, setupFavorites: {}, yearNotes: {}, clipboard: null } : {}),
      ...(parts.includes('expenses') ? { expenses: [] } : {}),
      ...(parts.includes('calendar') ? { tasks: [] } : {}),
      ...(parts.includes('goals') ? { goals: {} } : {}),
      ...(parts.includes('sources') ? { sources: [] } : {}),
    })
  }
  toast.undo('Cleared.', undo)
}

// ---- Spreadsheets ----

/** One spreadsheet cell. Text that starts like a formula is kept as plain text, so opening the file can't run anything. */
function cell(v: unknown) {
  let t = v == null ? '' : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}

/** The byte-order mark at the start tells Excel the file is UTF-8, so ₱ and accents come through. */
const sheet = (rows: unknown[][]) => '\ufeff' + rows.map((r) => r.map(cell).join(',')).join('\r\n')

export function downloadExpensesCsv() {
  const { expenses, expenseCats, currency } = useStore.getState()
  if (!expenses.length) return toast.info('No expenses to download yet.')
  const name = new Map(expenseCats.map((c) => [c.id, c.label]))
  const rows = [...expenses].sort((a, b) => a.date.localeCompare(b.date)).map((e) => [e.date, e.amount, currency.main.code, e.name, name.get(e.category) ?? '', e.place, e.notes])
  download(`dizayr-expenses-${today()}.csv`, sheet([['Date', 'Amount', 'Currency', 'Item', 'Category', 'Place', 'Notes'], ...rows]), 'text/csv')
  toast.success(`Downloaded ${expenses.length} expense${expenses.length === 1 ? '' : 's'}.`)
}

/** The items in the mode in use, in month order. */
export function downloadItemsCsv() {
  const { months, kinds, currency } = useStore.getState()
  const name = new Map(kinds.map((k) => [k.id, k.label]))
  const rows: unknown[][] = []
  for (let i = 0; i < TOTAL_MONTHS; i++) {
    const key = keyOf(i)
    for (const it of months[key]?.items ?? []) rows.push([labelOfKey(key), it.name, name.get(it.category) ?? '', it.trend, it.price, currency.main.code, it.trend === 'stable' ? '' : it.rate, it.favorite ? 'Yes' : '', it.notes ?? ''])
  }
  if (!rows.length) return toast.info('No items to download yet.')
  download(`dizayr-items-${today()}.csv`, sheet([['Month', 'Item', 'Kind', 'Value', 'Price', 'Currency', 'Yearly %', 'Favorite', 'Notes'], ...rows]), 'text/csv')
  toast.success(`Downloaded ${rows.length} item${rows.length === 1 ? '' : 's'}.`)
}

export function downloadGoalsCsv() {
  const { goals, goalAreas } = useStore.getState()
  const name = new Map(goalAreas.map((a) => [a.id, a.label]))
  const rows = Object.keys(goals).sort().flatMap((y) => goals[y].map((g) => [y, name.get(g.area) ?? '', g.text, g.done ? 'Yes' : 'No']))
  if (!rows.length) return toast.info('No goals to download yet.')
  download(`dizayr-goals-${today()}.csv`, sheet([['Year', 'Area', 'Goal', 'Done'], ...rows]), 'text/csv')
  toast.success(`Downloaded ${rows.length} goal${rows.length === 1 ? '' : 's'}.`)
}

// ---- Calendar file ----

const pad = (n: number) => String(n).padStart(2, '0')
const icsDate = (k: string) => k.replace(/-/g, '')
/** Minutes after the start of day `k` → "20270315T093000" (runs on into later days when past midnight). */
const icsTime = (k: string, m: number) => `${icsDate(addDays(k, Math.floor(m / 1440)))}T${pad(Math.floor(m / 60) % 24)}${pad(m % 60)}00`
const icsText = (t: string) => t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

/** Calendar files allow 75 bytes on a line; longer ones carry on after a line break and a space. */
function fold(line: string) {
  const enc = new TextEncoder()
  const out: string[] = []
  let cur = ''
  let size = 0
  for (const ch of line) {
    const n = enc.encode(ch).length
    if (size + n > 73) {
      out.push(cur)
      cur = ' '
      size = 1
    }
    cur += ch
    size += n
  }
  out.push(cur)
  return out.join('\r\n')
}

/** Downloads every event and dated task as a file that Google Calendar, Apple Calendar and Outlook can import. */
export function downloadCalendar() {
  const tasks = useStore.getState().tasks.filter((t) => t.date)
  if (!tasks.length) return toast.info('Nothing with a date to download yet.')
  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Dizayr//Planner//EN', 'CALSCALE:GREGORIAN']
  for (const t of tasks) {
    // A repeating one must start on a day it repeats on.
    let day = t.date
    if (t.repeat) for (let i = 0; i < 7 && !t.repeat.days.includes(fromKey(day).getDay()); i++) day = addDays(day, 1)
    lines.push('BEGIN:VEVENT', `UID:${t.id}@dizayr`, `DTSTAMP:${stamp}`, `SUMMARY:${icsText(isEvent(t) ? t.title : `Task: ${t.title}`)}`)
    if (t.start == null) lines.push(`DTSTART;VALUE=DATE:${icsDate(day)}`, `DTEND;VALUE=DATE:${icsDate(addDays(day, 1))}`)
    else lines.push(`DTSTART:${icsTime(day, t.start)}`, `DTEND:${icsTime(day, t.start + (isEvent(t) ? t.duration : DUE_SPAN))}`)
    if (t.notes) lines.push(`DESCRIPTION:${icsText(t.notes)}`)
    if (t.repeat) {
      const byday = t.repeat.days.map((d) => WEEKDAYS[d].slice(0, 2).toUpperCase()).join(',')
      const until = t.repeat.until ? `;UNTIL=${t.start == null ? icsDate(t.repeat.until) : `${icsDate(t.repeat.until)}T235959`}` : ''
      lines.push(`RRULE:FREQ=WEEKLY;BYDAY=${byday}${until}`)
    }
    lines.push('END:VEVENT')
  }
  lines.push('END:VCALENDAR')
  download(`dizayr-calendar-${today()}.ics`, lines.map(fold).join('\r\n') + '\r\n', 'text/calendar')
  toast.success(`Downloaded ${tasks.length} calendar ${tasks.length === 1 ? 'entry' : 'entries'}.`)
}
