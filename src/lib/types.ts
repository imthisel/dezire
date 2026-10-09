/** Id of one of the user's item kinds (see `ItemKind`). The starter kinds keep fixed ids: 'property', 'vehicle', 'investment', 'status', 'travel'. */
export type Category = string
export type Trend = 'appreciating' | 'depreciating' | 'stable'

/** A kind of item, made and named by the user. Items point to it by `id`. */
export interface ItemKind {
  id: string
  label: string
  /** Examples shown under the name, e.g. "Car, motorbike, boat" */
  hint: string
  /** Key into KIND_ICONS */
  icon: string
  /** Key into KIND_COLORS */
  color: string
}

export interface Item {
  id: string
  name: string
  category: Category
  trend: Trend
  price: number
  /** Yearly % the value grows (appreciating) or drops (depreciating). Ignored when stable. */
  rate: number
  createdAt: number
  /** Starred: shown on the Favorites page and highlighted in its month */
  favorite?: boolean
  /** Free text, shown when the item is clicked open */
  notes?: string
  /** Vehicles only: id of the Land / Property item it's kept at (any month) */
  propertyId?: string
}

export interface MonthData {
  /** How much I want to make this month (typed by hand; ignored while `netWorthGoal` is set) */
  goal: number
  /** Net worth I want by the end of this month. When set, the goal to make is worked out from it. null = not set. */
  netWorthGoal: number | null
  /** How much I allow myself to spend this month */
  budget: number
  /** What I actually earned. null = assume I hit my goal. */
  earned: number | null
  items: Item[]
  /** Free text for the month, shown when its Notes are opened */
  notes?: string
}

/** `warning` is set when the change went through but put a month over its limit. */
export type Result = { ok: true; warning?: string; /** id of a newly added item */ id?: string } | { ok: false; error: string }

/** The four areas of life a yearly goal can belong to. */
export type GoalArea = 'mind' | 'body' | 'status' | 'identity'

export interface Goal {
  id: string
  text: string
  area: GoalArea
  done: boolean
  createdAt: number
}

/** What kind of money-maker a plan is. */
export type SourceKind = 'business' | 'job' | 'freelance' | 'online' | 'invest' | 'other'
/** How far along it is. */
export type SourceStage = 'idea' | 'starting' | 'running'

export interface PlanStep {
  id: string
  text: string
  done: boolean
}

/** One way of making money, with an optional goal, money math and to-do steps. Every field is optional to fill in. */
export interface IncomeSource {
  id: string
  name: string
  kind: SourceKind
  stage: SourceStage
  /** How much I want to make from this each month (0 = not set) */
  monthlyGoal: number
  /** What one sale / client / shift brings in (0 = not set) */
  price: number
  /** What each sale costs me to make or deliver */
  costPerSale: number
  /** Fixed costs every month (rent, tools, ads…) */
  monthlyCosts: number
  steps: PlanStep[]
  notes: string
  createdAt: number
}
