import { FIRST_YEAR, MIN_START } from './time'

/**
 * Settings. Two kinds, because some choices belong to the person and some to the screen in front of them:
 * - `Prefs` follow the account: saved with the plan and the same on every device.
 * - `DevicePrefs` stay on this device: a big text size on a phone shouldn't change the laptop.
 */

export type Accent = 'indigo' | 'violet' | 'blue' | 'teal' | 'rose' | 'orange'
export type WeekStart = 0 | 1 | 6
export type Clock = '12' | '24'
export type TextSize = 'small' | 'default' | 'large'
/** The page the app opens on. `last`: wherever you left off. */
export type StartPage = 'last' | 'planner' | 'life' | 'calendar' | 'school' | 'grades' | 'expenses' | 'assets' | 'favorites' | 'plan'
/** Days between backup reminders. 0 = never. */
export type BackupEvery = 0 | 7 | 30
/** Places that can be taken out of the side menu and the phone's tab bar. */
export type NavId = 'life' | 'favorites' | 'calendar' | 'school' | 'expenses' | 'assets' | 'plan'
/** The side menu's blocks, which can be put in any order. */
export type SideBlock = 'wants' | 'needs' | 'plan' | 'calendar' | 'school' | 'expenses'
/** What a tab of the phone's tab bar can open. More is always added after them. */
export type TabId = 'wants' | 'needs' | 'life' | 'school' | 'grades' | 'expenses' | 'calendar' | 'assets' | 'favorites' | 'plan'

export type Prefs = {
  accent: Accent
  weekStart: WeekStart
  clock: Clock
  /** Minutes a new event starts with */
  eventLength: number
  /** Say so when a new or moved item doesn't fit its month (it's still marked red on the month) */
  budgetWarnings: boolean
  /** Buttons taken out of the header */
  hideBackup: boolean
  hideReset: boolean
  hideCurrency: boolean
  hideModes: boolean
  /** The quick show / hide amounts button in the header */
  privacyButton: boolean
  /** Places taken out of the side menu and the tab bar */
  hiddenNav: NavId[]
  /** The order of the side menu's blocks, top to bottom */
  sideOrder: SideBlock[]
  /** The phone tab bar's tabs, left to right (up to `TAB_MAX`; More follows them) */
  tabBar: TabId[]
  /** School deadlines also show on the Calendar page */
  schoolOnCalendar: boolean
  /** Time's to-dos also show on School's calendar (events stay on Time's Calendar) */
  timeTasksOnSchool: boolean
  /** The first year your plan covers. Accounts from before this setting start in 2026; new ones in the year they began. */
  yearStart: number
  /** The last year your plan covers. 0 = automatic: always `AUTO_AHEAD` years after the current one (see lib/time). */
  yearEnd: number
}

export type DevicePrefs = {
  textSize: TextSize
  /** Almost no animation, even if the system doesn't ask for that */
  calm: boolean
  /** No frosted-glass blur (smoother on older devices) */
  solid: boolean
  /** The soft coloured light behind the pages */
  glow: boolean
  startPage: StartPage
  /** Amounts hidden, for using the app around other people */
  masked: boolean
  /** Always open with amounts hidden */
  maskOnOpen: boolean
  /** Reminders before timed events and tasks */
  reminders: boolean
  /** Minutes before */
  reminderLead: number
  backupEvery: BackupEvery
  /** When a backup was last downloaded here (ms) */
  lastBackup: number | null
}

export const DEFAULT_PREFS: Prefs = {
  accent: 'indigo',
  weekStart: 0,
  clock: '12',
  eventLength: 60,
  budgetWarnings: true,
  hideBackup: false,
  hideReset: false,
  hideCurrency: false,
  hideModes: false,
  privacyButton: false,
  hiddenNav: [],
  sideOrder: ['wants', 'needs', 'plan', 'calendar', 'school', 'expenses'],
  tabBar: ['wants', 'needs', 'school', 'expenses'],
  schoolOnCalendar: false,
  timeTasksOnSchool: false,
  yearStart: FIRST_YEAR,
  yearEnd: 0,
}

export const DEFAULT_DEVICE: DevicePrefs = {
  textSize: 'default',
  calm: false,
  solid: false,
  glow: true,
  startPage: 'last',
  masked: false,
  maskOnOpen: false,
  reminders: false,
  reminderLead: 15,
  backupEvery: 0,
  lastBackup: null,
}

export const ACCENTS: { id: Accent; label: string; swatch: string }[] = [
  // The id stays 'indigo' (saved settings use it); the colour is the brand blue (see index.css).
  { id: 'indigo', label: 'Dizayr blue', swatch: '#3a6df0' },
  { id: 'violet', label: 'Violet', swatch: '#8b5cf6' },
  { id: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { id: 'teal', label: 'Teal', swatch: '#0d9488' },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { id: 'orange', label: 'Orange', swatch: '#ea580c' },
]
export const EVENT_LENGTHS = [15, 30, 45, 60, 90, 120]
export const REMINDER_LEADS = [5, 10, 15, 30, 60]
export const TAB_IDS: TabId[] = ['wants', 'needs', 'life', 'school', 'grades', 'expenses', 'calendar', 'assets', 'favorites', 'plan']
/** Tabs besides More: any more and the labels get too cramped on a phone. */
export const TAB_MAX = 4
export const NAV_IDS: NavId[] = ['life', 'favorites', 'calendar', 'school', 'expenses', 'assets', 'plan']
const START_PAGES: StartPage[] = ['last', 'planner', 'life', 'calendar', 'school', 'grades', 'expenses', 'assets', 'favorites', 'plan']

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const oneOf = <T,>(v: unknown, list: readonly T[], fallback: T) => (list.includes(v as T) ? (v as T) : fallback)
const year = (v: unknown, lo: number, hi: number, fallback: number) => (typeof v === 'number' && Number.isInteger(v) && v >= lo && v <= hi ? v : fallback)
const record = (raw: unknown) => (raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {})

/** Cleans up account settings from a backup file, the cloud or this browser. Anything missing gets its default. */
export function parsePrefs(raw: unknown): Prefs {
  const r = record(raw)
  const d = DEFAULT_PREFS
  return {
    accent: oneOf(r.accent, ACCENTS.map((a) => a.id), d.accent),
    weekStart: oneOf(r.weekStart, [0, 1, 6] as const, d.weekStart),
    clock: oneOf(r.clock, ['12', '24'] as const, d.clock),
    eventLength: oneOf(r.eventLength, EVENT_LENGTHS, d.eventLength),
    budgetWarnings: bool(r.budgetWarnings, d.budgetWarnings),
    hideBackup: bool(r.hideBackup, d.hideBackup),
    hideReset: bool(r.hideReset, d.hideReset),
    hideCurrency: bool(r.hideCurrency, d.hideCurrency),
    hideModes: bool(r.hideModes, d.hideModes),
    privacyButton: bool(r.privacyButton, d.privacyButton),
    hiddenNav: Array.isArray(r.hiddenNav) ? NAV_IDS.filter((id) => (r.hiddenNav as unknown[]).includes(id)) : d.hiddenNav,
    sideOrder: parseSideOrder(r.sideOrder),
    tabBar: parseTabBar(r.tabBar),
    schoolOnCalendar: bool(r.schoolOnCalendar, d.schoolOnCalendar),
    timeTasksOnSchool: bool(r.timeTasksOnSchool, d.timeTasksOnSchool),
    yearStart: year(r.yearStart, MIN_START, 9999, d.yearStart),
    yearEnd: r.yearEnd === 0 ? 0 : year(r.yearEnd, MIN_START, 9999, d.yearEnd),
  }
}

/** Cleans up this device's settings. Anything missing gets its default. */
export function parseDevice(raw: unknown): DevicePrefs {
  const r = record(raw)
  const d = DEFAULT_DEVICE
  return {
    textSize: oneOf(r.textSize, ['small', 'default', 'large'] as const, d.textSize),
    calm: bool(r.calm, d.calm),
    solid: bool(r.solid, d.solid),
    glow: bool(r.glow, d.glow),
    startPage: oneOf(r.startPage, START_PAGES, d.startPage),
    masked: bool(r.masked, d.masked),
    maskOnOpen: bool(r.maskOnOpen, d.maskOnOpen),
    reminders: bool(r.reminders, d.reminders),
    reminderLead: oneOf(r.reminderLead, REMINDER_LEADS, d.reminderLead),
    backupEvery: oneOf(r.backupEvery, [0, 7, 30] as const, d.backupEvery),
    lastBackup: Number(r.lastBackup) > 0 ? Number(r.lastBackup) : null,
  }
}

/**
 * The few settings plain helpers need (formatting an amount, working out a week), kept here so those helpers don't have to
 * know about the store. The store keeps them up to date before anything redraws.
 */
export const live = { weekStart: 0 as WeekStart, clock: '12' as Clock, masked: false, budgetWarnings: true, eventLength: 60 }

/** A saved side menu order, cleaned up: unknown or repeated blocks dropped, any missing ones added where they'd be by default. */
export function parseSideOrder(raw: unknown): SideBlock[] {
  const all = DEFAULT_PREFS.sideOrder
  const out = Array.isArray(raw) ? all.filter((b) => raw.includes(b)).sort((a, b) => raw.indexOf(a) - raw.indexOf(b)) : []
  // A block that's new since the order was saved goes back in after the block it follows by default.
  all.forEach((b, i) => {
    if (out.includes(b)) return
    const after = i === 0 ? -1 : out.indexOf(all[i - 1])
    out.splice(after + 1, 0, b)
  })
  return out
}

/** The order with `id` moved to position `to`. */
export function moveSideBlock(order: SideBlock[], id: SideBlock, to: number): SideBlock[] {
  const rest = order.filter((b) => b !== id)
  rest.splice(Math.max(0, Math.min(rest.length, to)), 0, id)
  return rest
}

/** A saved tab bar, cleaned up: unknown or repeated tabs dropped, at most `TAB_MAX`. Nothing saved: the default. */
export function parseTabBar(raw: unknown): TabId[] {
  if (!Array.isArray(raw)) return DEFAULT_PREFS.tabBar
  return raw.filter((t, i): t is TabId => TAB_IDS.includes(t as TabId) && raw.indexOf(t) === i).slice(0, TAB_MAX)
}
