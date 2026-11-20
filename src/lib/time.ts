/*
 * The years the planner covers. You choose them (Settings → Calendar → Your years, or the years button in the header);
 * the default follows the real date: from the year you started to 14 years ahead of today, so it grows each New Year.
 *
 * The range is set with `setYearRange` (from the store, whenever your settings change or the year turns over) and the
 * values below are live: every module that imports them sees the new range. Data is saved by month ("2027-03"), never by
 * position, so changing the range can't lose anything: months outside it are only hidden until the range includes them.
 */

/** The first year Dizayr planned: accounts from before years could be chosen start here. */
export const FIRST_YEAR = 2026
/** The earliest start year you can pick. */
export const MIN_START = 2000
/** The most years one plan can cover. */
export const MAX_SPAN = 50
/** "Automatic" end: this many years after the current one (2026 → 2040). */
export const AUTO_AHEAD = 14

export let START_YEAR = FIRST_YEAR
export let END_YEAR = FIRST_YEAR + AUTO_AHEAD
export let YEARS: number[] = []
export let TOTAL_MONTHS = 0
/** The first and last day you can pick anywhere ("YYYY-MM-DD"). */
export let MIN_DATE = ''
export let MAX_DATE = ''

/**
 * The range to use for a start and end you chose (`end` 0 = automatic), today being `now`. It always contains the current
 * year, so today's month, expenses and calendar are always reachable, and it never covers more than `MAX_SPAN` years.
 */
export function resolveRange(start: number, end: number, now = new Date()) {
  const y = now.getFullYear()
  let s = Math.min(Number.isFinite(start) && start > 0 ? Math.round(start) : y, y)
  s = Math.max(s, MIN_START, y - MAX_SPAN + 1)
  let e = end > 0 ? Math.round(end) : y + AUTO_AHEAD
  e = Math.min(Math.max(e, y), s + MAX_SPAN - 1)
  return { start: s, end: e }
}

/** Sets the years covered. Returns whether anything changed. */
export function setYearRange(start: number, end: number) {
  if (start === START_YEAR && end === END_YEAR && YEARS.length) return false
  START_YEAR = start
  END_YEAR = end
  YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i)
  TOTAL_MONTHS = YEARS.length * 12
  MIN_DATE = `${START_YEAR}-01-01`
  MAX_DATE = `${END_YEAR}-12-31`
  return true
}

// Until settings load: from the first year to 14 years ahead of today.
{
  const r = resolveRange(FIRST_YEAR, 0)
  setYearRange(r.start, r.end)
}

/** "2026 – 2040" */
export const rangeLabel = () => `${START_YEAR} – ${END_YEAR}`

export const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
export const MONTHS_SHORT = MONTHS.map((m) => m.slice(0, 3))

export const indexOf = (year: number, month: number) => (year - START_YEAR) * 12 + month

export const fromIndex = (i: number) => ({ year: START_YEAR + Math.floor(i / 12), month: i % 12 })

export const keyOf = (i: number) => {
  const { year, month } = fromIndex(i)
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

export const indexOfKey = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return indexOf(y, m - 1)
}

export const labelOf = (i: number) => {
  const { year, month } = fromIndex(i)
  return `${MONTHS[month]} ${year}`
}

export const labelOfKey = (key: string) => labelOf(indexOfKey(key))

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n))

/** This month, by the real date (always inside the range: see `resolveRange`). */
export const currentIndex = () => {
  const now = new Date()
  return clamp(indexOf(now.getFullYear(), now.getMonth()), 0, TOTAL_MONTHS - 1)
}

export const currentYear = () => fromIndex(currentIndex()).year

/** Keeps a year inside the range. */
export const clampYear = (y: number) => clamp(y, START_YEAR, END_YEAR)
