import { useSyncExternalStore } from 'react'
import { useStore } from './store'

export type SettingsSection = 'account' | 'plan' | 'appearance' | 'layout' | 'money' | 'calendar' | 'notifications' | 'privacy' | 'lists' | 'data' | 'help'

const SECTIONS: SettingsSection[] = ['account', 'plan', 'appearance', 'layout', 'money', 'calendar', 'notifications', 'privacy', 'lists', 'data', 'help']
const PREFIX = '#settings'

/**
 * Settings has its own address (#settings/appearance), so the browser's and the phone's Back button walk back through it
 * instead of leaving the app, and a reload stays where it was.
 */
function parseHash(): { open: boolean; section: SettingsSection | null } {
  const h = location.hash
  if (h !== PREFIX && !h.startsWith(`${PREFIX}/`)) return { open: false, section: null }
  const part = h.slice(PREFIX.length + 1) as SettingsSection
  return { open: true, section: SECTIONS.includes(part) ? part : null }
}

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

/** Brings the page in line with the address (after Back, Forward or a reload). */
function follow() {
  const s = useStore.getState()
  const { open } = parseHash()
  if (open && s.view !== 'settings') s.setView('settings')
  else if (!open && s.view === 'settings') s.setView(s.prevView)
  emit()
}

const depth = () => Number((history.state as { settingsDepth?: number } | null)?.settingsDepth) || 0

function push(hash: string) {
  history.pushState({ settingsDepth: depth() + 1 }, '', hash)
  follow()
}

/** Opens Settings, on one section when given. */
export function openSettings(section?: SettingsSection) {
  useStore.getState().setDrawer(false)
  const hash = section ? `${PREFIX}/${section}` : PREFIX
  if (location.hash !== hash) push(hash)
  else follow()
}

/** Phones: from a section back to the list of sections, as the Back button would. */
export function settingsUp() {
  if (depth() >= 2) history.back()
  else openSettings()
}

/** Back to the page Settings was opened from, leaving no Settings steps behind in the Back button. */
export function closeSettings() {
  const d = depth()
  if (d > 0) return history.go(-d)
  history.replaceState(null, '', location.pathname + location.search)
  follow()
}

/** Out of Settings at once, whatever the history holds (signing out: the next person shouldn't land here). */
export function leaveSettings() {
  if (parseHash().open) history.replaceState(null, '', location.pathname + location.search)
  follow()
}

/** Which section the address points at (null: none picked, e.g. the list of sections on a phone). */
export const useSettingsSection = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => parseHash().section,
  )

let started = false
/** Call once when the planner opens. */
export function startSettingsNav() {
  if (started) return
  started = true
  window.addEventListener('popstate', follow)
  window.addEventListener('hashchange', follow)
  follow()
  // Going to another page from the side menu: the address stops pointing at Settings.
  useStore.subscribe((s, prev) => {
    if (s.view === prev.view || s.view === 'settings' || !parseHash().open) return
    history.replaceState(null, '', location.pathname + location.search)
    emit()
  })
}
