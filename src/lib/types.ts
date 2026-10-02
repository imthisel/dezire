export type Category = 'property' | 'vehicle' | 'status'
export type Trend = 'appreciating' | 'depreciating' | 'stable'

export interface Item {
  id: string
  name: string
  category: Category
  trend: Trend
  price: number
  /** Yearly % the value grows (appreciating) or drops (depreciating). Ignored when stable. */
  rate: number
  createdAt: number
}

export interface MonthData {
  /** How much I want to make this month */
  goal: number
  /** How much I allow myself to spend this month */
  budget: number
  /** What I actually earned. null = assume I hit my goal. */
  earned: number | null
  items: Item[]
}

/** `warning` is set when the change went through but put a month over its limit. */
export type Result = { ok: true; warning?: string } | { ok: false; error: string }
