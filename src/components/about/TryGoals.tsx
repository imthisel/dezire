import { useMemo, useState } from 'react'
import { create } from 'zustand'
import { DEFAULT_GOAL_AREAS } from '../../lib/meta'
import type { Goal, GoalArea, LifeGoal } from '../../lib/types'
import { MAX_GOAL_NOTE } from '../../store'
import { GoalsSection } from '../GoalsSection'
import { GoalModal } from '../GoalModal'
import { GoalsCtx, type GoalsApi, type GoalsData } from '../goalsApi'
import { Toolbar } from './TryOverview'

/*
 * A playable copy of the yearly Goals on the About page: the app's own Goals section and goal dialog, on goals kept in
 * this page's memory. Nothing is saved; leaving or refreshing the page starts it over.
 */

const YEAR = new Date().getFullYear()

let lastId = 0
const id = () => `try-goal-${++lastId}`
const goal = (area: GoalArea, text: string, done = false, extra: Partial<Goal> = {}): Goal => ({
  id: id(), text, area, done, createdAt: Date.now(), ...extra,
})

const LIFE: LifeGoal[] = [
  { id: 'try-life-free', text: 'Financially free by 40', why: '', area: 'mind', byAge: 40, done: false, doneAt: null, createdAt: 0 },
  { id: 'try-life-faith', text: 'Know God deeply', why: '', area: 'identity', byAge: null, done: false, doneAt: null, createdAt: 0 },
]

function example(): Pick<GoalsData, 'goals' | 'goalNotes'> {
  return {
    goals: {
      [YEAR]: [
        goal('mind', 'Score 1570 on the SAT', false, {
          notes: 'Last practice test: 1490.\nTwo full practice tests a week, review every wrong answer the same day.',
        }),
        goal('body', 'Finish an Ironman', false, {
          notes: '3.8 km swim · 180 km bike · 42.2 km run.\nA 70.3 first, then the full distance.',
        }),
        goal('body', 'Bench press 170 kg', false, {
          notes: 'Now at 145 kg. Add 2.5 kg every three weeks.',
        }),
        goal('status', 'Pay for all my own expenses', true),
        goal('status', 'Give back to my parents', false, {
          notes: 'A monthly allowance for Mom and Dad, and take them on a trip.',
        }),
        goal('identity', 'Give generously to God and to other people', false, {
          lifeId: 'try-life-faith',
          notes: 'Tithe first, every month. Then help someone in need each month.',
        }),
        goal('identity', 'Become the most complete, best person I can be'),
      ],
    },
    goalNotes: { [YEAR]: 'The year I stop waiting to be ready. Show up every day, even when it’s small.' },
  }
}

const move = (list: Goal[], gid: string, area: GoalArea, at?: { id: string; after: boolean }) => {
  const g = list.find((x) => x.id === gid)
  if (!g || at?.id === gid) return list
  const rest = list.filter((x) => x.id !== gid)
  let i = at ? rest.findIndex((x) => x.id === at.id) + (at.after ? 1 : 0) : -1
  if (!at || i < 0) {
    // End of the area: right after its last goal.
    const last = rest.map((x) => x.area).lastIndexOf(area)
    i = last < 0 ? rest.length : last + 1
  }
  rest.splice(i, 0, { ...g, area })
  return rest
}

const useGoalsDemo = create<GoalsData & { reset: () => void; clear: () => void }>((set, get) => {
  const year = (y: number, f: (l: Goal[]) => Goal[]) => set((s) => ({ goals: { ...s.goals, [y]: f(s.goals[y] ?? []) } }))
  return {
    year: YEAR,
    ...example(),
    goalAreas: DEFAULT_GOAL_AREAS,
    life: { goals: LIFE },
    addGoal: (y, area, text, lifeId, notes) =>
      year(y, (l) => [...l, goal(area, text.trim(), false, { ...(lifeId ? { lifeId } : {}), ...(notes?.trim() ? { notes: notes.slice(0, MAX_GOAL_NOTE) } : {}) })]),
    updateGoal: (y, gid, patch) =>
      year(y, (l) =>
        l.map((g) => {
          if (g.id !== gid) return g
          const next = { ...g, ...patch }
          if (patch.notes !== undefined && !patch.notes.trim()) delete next.notes
          return next
        }),
      ),
    removeGoal: (y, gid) => year(y, (l) => l.filter((g) => g.id !== gid)),
    moveGoal: (y, gid, area, at) => year(y, (l) => move(l, gid, area, at)),
    carryOverGoals: () => 0,
    updateArea: (aid, patch) => {
      const label = patch.label?.trim()
      if (patch.label !== undefined && !label) return
      set({ goalAreas: get().goalAreas.map((a) => (a.id === aid ? { ...a, ...patch, ...(label ? { label } : {}) } : a)) })
    },
    setGoalNote: (y, text) =>
      set((s) => {
        const { [y]: _old, ...rest } = s.goalNotes
        return { goalNotes: text ? { ...rest, [y]: text } : rest }
      }),
    reset: () => set({ ...example(), goalAreas: DEFAULT_GOAL_AREAS }),
    clear: () => set({ goals: {}, goalNotes: {} }),
  }
})

type Dialog = { year: number; editId?: string; area?: GoalArea } | null

/** Toasts aren't shown on the About page: what you do shows right there in the goals. */
const quiet = { success: () => {}, info: () => {}, undo: () => {} }

export function TryGoals() {
  const [dialog, setDialog] = useState<Dialog>(null)
  const api = useMemo<GoalsApi>(
    () => ({
      use: (pick) => useGoalsDemo(pick),
      get: () => useGoalsDemo.getState(),
      restore: (y, list) => useGoalsDemo.setState((s) => ({ goals: { ...s.goals, [y]: list ?? [] } })),
      openGoal: (o) => setDialog(o),
      closeGoal: () => setDialog(null),
      openAreas: null,
      openLife: null,
      carry: false,
      toast: quiet,
    }),
    [],
  )
  return (
    <div>
      <Toolbar onReset={() => useGoalsDemo.getState().reset()} onClear={() => useGoalsDemo.getState().clear()} />
      <div className="mt-4">
        <GoalsSection api={api} />
      </div>
      {dialog && (
        <GoalsCtx.Provider value={api}>
          <GoalModal key={`${dialog.editId ?? dialog.area ?? 'new'}`} year={dialog.year} editId={dialog.editId} area={dialog.area} />
        </GoalsCtx.Provider>
      )}
    </div>
  )
}
