import { create } from 'zustand'

/*
 * How the School page shows its tasks: as a board, a list or a calendar. Kept here (not inside the page) so the sidebar
 * can open School straight on its calendar ("School → Calendar") and light up the right link. Remembered on this device.
 */

export type SchoolView = 'board' | 'list' | 'calendar'
type TasksView = Exclude<SchoolView, 'calendar'>

const VIEW_KEY = 'dizayr-school-view'
/** The last of board / list, so "School → Tasks" goes back to the one you were using. */
const TASKS_KEY = 'dizayr-school-tasks-view'

function read<T extends string>(key: string, fallback: T, options: readonly T[]): T {
  try {
    const v = localStorage.getItem(key) as T | null
    return v && options.includes(v) ? v : fallback
  } catch {
    return fallback
  }
}
function write(key: string, v: string) {
  try {
    localStorage.setItem(key, v)
  } catch {
    // Not remembered: fine.
  }
}

type State = {
  view: SchoolView
  tasksView: TasksView
  setView: (v: SchoolView) => void
  /** Back to the tasks (the board or list last used), from the calendar. */
  showTasks: () => void
}

export const useSchoolView = create<State>((set, get) => ({
  view: read<SchoolView>(VIEW_KEY, 'board', ['board', 'list', 'calendar']),
  tasksView: read<TasksView>(TASKS_KEY, 'board', ['board', 'list']),
  setView: (view) => {
    write(VIEW_KEY, view)
    if (view !== 'calendar') write(TASKS_KEY, view)
    set(view === 'calendar' ? { view } : { view, tasksView: view })
  },
  showTasks: () => {
    if (get().view === 'calendar') get().setView(get().tasksView)
  },
}))
