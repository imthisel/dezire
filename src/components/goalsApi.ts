import { createContext, useContext } from 'react'
import { useStore } from '../store'
import { UNKNOWN_AREA } from '../lib/meta'
import type { Goal, GoalArea, GoalAreaDef, LifeGoal } from '../lib/types'
import { toast } from '../toast'
import { goTo } from '../nav'

/**
 * What the yearly Goals section and its dialog run on. In the app it's the real store (the default); the About page's
 * "Try it now" gives it a plan kept in that page's memory, so the playground is the app's own Goals section.
 */
export type GoalsData = {
  year: number
  goals: Record<string, Goal[]>
  goalNotes: Record<string, string>
  goalAreas: GoalAreaDef[]
  life: { goals: LifeGoal[] }
  addGoal: (year: number, area: GoalArea, text: string, lifeId?: string, notes?: string) => void
  updateGoal: (year: number, id: string, patch: Partial<Pick<Goal, 'text' | 'area' | 'done' | 'lifeId' | 'notes'>>) => void
  removeGoal: (year: number, id: string) => void
  moveGoal: (year: number, id: string, area: GoalArea, at?: { id: string; after: boolean }) => void
  carryOverGoals: (year: number) => number
  updateArea: (id: string, patch: Partial<Omit<GoalAreaDef, 'id'>>) => void
  setGoalNote: (year: number, text: string) => void
}

export type GoalsApi = {
  /** Reads the goals (a hook) */
  use: <T>(pick: (d: GoalsData) => T) => T
  /** The goals and actions right now (not a hook) */
  get: () => GoalsData
  /** Puts a year's goals back as they were (Undo after a delete) */
  restore: (year: number, list: Goal[] | undefined) => void
  /** Opens the add / edit goal dialog */
  openGoal: (o: { year: number; editId?: string; area?: GoalArea }) => void
  closeGoal: () => void
  /** Opens the goal areas editor (null: areas can only be renamed here) */
  openAreas: ((o: { openId?: string; add?: boolean }) => void) | null
  /** Goes to a life goal on the Life goals page (null: the link only shows) */
  openLife: ((id: string) => void) | null
  /** Offer copying unfinished goals into the next year */
  carry: boolean
  toast: Pick<typeof toast, 'success' | 'info' | 'undo'>
}

const storeApi: GoalsApi = {
  use: (pick) => useStore(pick),
  get: () => useStore.getState(),
  restore: (year, list) => useStore.setState((s) => ({ goals: { ...s.goals, [year]: list ?? [] } })),
  openGoal: (o) => useStore.getState().openModal({ type: 'goal', ...o }),
  closeGoal: () => useStore.getState().closeModal(),
  openAreas: (o) => useStore.getState().openModal({ type: 'goalAreas', ...o }),
  openLife: (id) => goTo(`life-${id}`),
  carry: true,
  toast,
}

export const GoalsCtx = createContext<GoalsApi>(storeApi)
export const useGoalsApi = () => useContext(GoalsCtx)

/** The goal areas, in order. */
export const useAreas = () => useGoalsApi().use((d) => d.goalAreas)

/** Looks up a goal area by id (a placeholder if it no longer exists). */
export function useAreaLookup() {
  const areas = useAreas()
  return (id: GoalArea) => areas.find((a) => a.id === id) ?? UNKNOWN_AREA
}
