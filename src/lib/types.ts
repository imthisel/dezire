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
  /** Vehicles only, optional: what it costs to run each year (an estimate) */
  running?: RunningCosts
}

/** A vehicle's yearly running costs, as estimated by the user. Amounts are in the main currency. */
export interface RunningCosts {
  /** Maintenance a year: servicing, tyres, insurance, registration… */
  maintenance: number
  /** Kilometres planned a year */
  kmPerYear: number
  /** Fuel economy, km per litre */
  kmPerLiter: number
  /** Price of a litre of fuel */
  fuelPrice: number
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

/** One mode: a separate version of the plan. The one with id 'main' is the main plan. */
export interface ModeInfo {
  id: string
  name: string
  createdAt: number
}

/** What each mode keeps for itself: its months (goals, budgets, items), its setups and its year notes. */
export interface ModeData {
  months: Record<string, MonthData>
  /** Setups: vehicle id → property id, by setup month */
  layouts: Record<string, Record<string, string>>
  setupNotes: Record<string, string>
  /** Free text for each year, keyed by year ("2027") */
  yearNotes: Record<string, string>
}

/** `warning` is set when the change went through but put a month over its limit. */
export type Result = { ok: true; warning?: string; /** id of a newly added item */ id?: string } | { ok: false; error: string }

/** Id of one of the user's goal areas (see `GoalAreaDef`). The starter areas keep fixed ids: 'mind', 'body', 'status', 'identity'. */
export type GoalArea = string

/** An area of life a yearly goal can belong to, made and named by the user. Goals point to it by `id`. */
export interface GoalAreaDef {
  id: string
  label: string
  /** What fits in it, shown under the name, e.g. "Fitness, training, food, sleep" */
  hint: string
  /** Key into GOAL_ICONS */
  icon: string
  /** Key into GOAL_COLORS */
  color: string
}

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

/** A kind of spending (Food, Bills…), made and named by the user. Expenses point to it by `id`. */
export interface ExpenseCategory {
  id: string
  label: string
  /** Key into EXPENSE_ICONS */
  icon: string
  /** Key into KIND_COLORS */
  color: string
  /** Things usually bought in it ("Lunch", "Coffee"), offered as one-tap names when adding */
  items: string[]
}

/** Money spent. Only `date` and `amount` are needed; the rest is optional. */
export interface Expense {
  id: string
  /** "YYYY-MM-DD" (the user's own calendar day) */
  date: string
  amount: number
  /** What it was ('' = not said) */
  name: string
  /** ExpenseCategory id ('' = none) */
  category: string
  /** Where ('' = not said) */
  place: string
  notes: string
  createdAt: number
}

/** A kind of task (School, Work…), made and named by the user. Tasks point to it by `id` and are coloured by it. */
export interface TaskKind {
  id: string
  label: string
  /** Key into TASK_ICONS */
  icon: string
  /** Key into TASK_COLORS */
  color: string
}

/** Which weekdays a task comes back on (0 = Sunday … 6 = Saturday), and the last day it does ('' = forever). */
export interface Repeat {
  days: number[]
  until: string
}

/**
 * Something on the calendar or the to-do list.
 * - 'event': time set aside to do something ("Study 2–4 PM"). A block on the calendar; nothing to tick off.
 * - 'todo': something to get done, ticked off when it is. Its date / time (if any) is when it's due.
 */
export type TaskType = 'event' | 'todo'

/** An event or a to-do (see `TaskType`). With a `date` it shows on the calendar; a to-do without one is just on the list. */
export interface Task {
  id: string
  type: TaskType
  title: string
  /** TaskKind id */
  kind: string
  notes: string
  /** "YYYY-MM-DD": the day it happens / is due, or (repeating) the first day it can. '' = no deadline (to-dos only). */
  date: string
  /** Minutes after midnight it starts (events) or is due (to-dos). null = all day / any time that day. */
  start: number | null
  /** How long it takes, in minutes (timed events only) */
  duration: number
  /** null = happens once */
  repeat: Repeat | null
  /** Ticked off (tasks that happen once) */
  done: boolean
  /** Repeating tasks: the days ("YYYY-MM-DD") that were ticked off */
  doneOn: string[]
  createdAt: number
}
