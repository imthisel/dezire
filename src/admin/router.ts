import { create } from 'zustand'

/** The admin page's own small router: /admin, /admin/users, /admin/users/<uid>, /admin/users/<uid>/planner, /admin/activity. */
const here = () => location.pathname.replace(/\/$/, '') || '/admin'

export const useRoute = create<{ path: string }>(() => ({ path: here() }))

export function go(path: string) {
  if (path === useRoute.getState().path) return
  history.pushState(null, '', path)
  useRoute.setState({ path })
  window.scrollTo({ top: 0 })
}

window.addEventListener('popstate', () => useRoute.setState({ path: here() }))
