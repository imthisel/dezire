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
export type StartPage = 'last' | 'planner' | 'calendar' | 'school' | 'expenses' | 'assets' | 'favorites' | 'plan'
/** Days between backup reminders. 0 = never. */
export type BackupEvery = 0 | 7 | 30
/** Places that can be taken out of the side menu and the phone's tab bar. */
export type NavId = 'favorites' | 'calendar' | 'school' | 'expenses' | 'assets' | 'plan'

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
  { id: 'indigo', label: 'Indigo', swatch: '#6366f1' },
  { id: 'violet', label: 'Violet', swatch: '#8b5cf6' },
  { id: 'blue', label: 'Blue', swatch: '#3b82f6' },
  { id: 'teal', label: 'Teal', swatch: '#0d9488' },
  { id: 'rose', label: 'Rose', swatch: '#f43f5e' },
  { id: 'orange', label: 'Orange', swatch: '#ea580c' },
]
export const EVENT_LENGTHS = [15, 30, 45, 60, 90, 120]
export const REMINDER_LEADS = [5, 10, 15, 30, 60]
export const NAV_IDS: NavId[] = ['favorites', 'calendar', 'school', 'expenses', 'assets', 'plan']
const START_PAGES: StartPage[] = ['last', 'planner', 'calendar', 'school', 'expenses', 'assets', 'favorites', 'plan']

const bool = (v: unknown, fallback: boolean) => (typeof v === 'boolean' ? v : fallback)
const oneOf = <T,>(v: unknown, list: readonly T[], fallback: T) => (list.includes(v as T) ? (v as T) : fallback)
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
