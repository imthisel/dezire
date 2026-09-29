export const START_YEAR = 2026
export const END_YEAR = 2040
export const YEARS = Array.from({ length: END_YEAR - START_YEAR + 1 }, (_, i) => START_YEAR + i)
export const TOTAL_MONTHS = YEARS.length * 12

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

export const currentIndex = () => {
  const now = new Date()
  return clamp(indexOf(now.getFullYear(), now.getMonth()), 0, TOTAL_MONTHS - 1)
}

export const currentYear = () => fromIndex(currentIndex()).year
