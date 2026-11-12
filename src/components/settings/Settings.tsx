import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, Bell, CalendarCheck, ChevronRight, Crown, Database, EyeOff, LayoutPanelLeft, LifeBuoy, ListTree, Palette, Search, Settings as SettingsIcon, User, Wallet, X, type LucideIcon } from 'lucide-react'
import { useMedia } from '../../lib/useMedia'
import { closeSettings, openSettings, settingsUp, useSettingsSection, type SettingsSection } from '../../settingsNav'
import { useStore, type View } from '../../store'
import { searchSettings } from './search'
import { AccountSection, PlanSection } from './AccountSections'
import { AppearanceSection, LayoutSection } from './LookSections'
import { CalendarSection, MoneySection, NotificationsSection, PrivacySection } from './PlanningSections'
import { DataSection } from './DataSection'
import { HelpSection, ListsSection } from './MoreSections'

const SECTIONS: { id: SettingsSection; label: string; about: string; icon: LucideIcon; show: () => React.JSX.Element }[] = [
  { id: 'account', label: 'Account', about: 'Your profile, birthday and syncing', icon: User, show: () => <AccountSection /> },
  { id: 'plan', label: 'Plan & billing', about: 'Your plan, renewal and payment', icon: Crown, show: () => <PlanSection /> },
  { id: 'appearance', label: 'Appearance', about: 'Colour, text size and motion', icon: Palette, show: () => <AppearanceSection /> },
  { id: 'layout', label: 'Layout', about: 'Header buttons, menu and start page', icon: LayoutPanelLeft, show: () => <LayoutSection /> },
  { id: 'money', label: 'Money', about: 'Currencies and exchange rate', icon: Wallet, show: () => <MoneySection /> },
  { id: 'calendar', label: 'Calendar', about: 'Week start, time format and events', icon: CalendarCheck, show: () => <CalendarSection /> },
  { id: 'notifications', label: 'Notifications', about: 'Reminders and warnings', icon: Bell, show: () => <NotificationsSection /> },
  { id: 'privacy', label: 'Privacy', about: 'Hide your amounts from others', icon: EyeOff, show: () => <PrivacySection /> },
  { id: 'lists', label: 'Your lists', about: 'Kinds, categories, places and modes', icon: ListTree, show: () => <ListsSection /> },
  { id: 'data', label: 'Data & backup', about: 'Export, import, spreadsheets and clearing', icon: Database, show: () => <DataSection /> },
  { id: 'help', label: 'Help & support', about: 'Help center, contact us, updates and tips', icon: LifeBuoy, show: () => <HelpSection /> },
]

const VIEW_NAMES: Record<View, string> = {
  planner: 'Overview',
  plan: 'Money plan',
  favorites: 'Favorites',
  assets: 'Assets',
  expenses: 'Expenses',
  calendar: 'Calendar',
  school: 'School',
  grades: 'Grades',
  help: 'Help',
  settings: 'Overview',
}

/** Settings: a list of sections beside the one that's open (on phones, the list first, then the section on its own). */
export function Settings() {
  const wide = useMedia('(min-width: 768px)')
  const routed = useSettingsSection()
  const prevView = useStore((s) => s.prevView)
  const [query, setQuery] = useState('')
  const pendingJump = useRef<string | null>(null)
  const shownSection = useRef<SettingsSection | null>(routed)
  const [jumps, setJumps] = useState(0)
  const section: SettingsSection | null = routed ?? (wide ? 'account' : null)
  const current = SECTIONS.find((s) => s.id === section)
  const top = useRef<HTMLDivElement>(null)

  // A new section starts at its top; arriving from search, the setting found comes into view and lights up.
  useEffect(() => {
    const changed = shownSection.current !== section
    shownSection.current = section
    const id = pendingJump.current
    pendingJump.current = null
    if (!id) {
      if (changed && top.current && top.current.getBoundingClientRect().top < 0) top.current.scrollIntoView()
      return
    }
    const el = document.getElementById(`set-${id}`)
    if (!el) return
    el.scrollIntoView({ block: 'center' })
    el.classList.add('setting-found')
    setTimeout(() => el.classList.remove('setting-found'), 1900)
  }, [section, jumps])

  function jump(id: string, to: SettingsSection) {
    setQuery('')
    pendingJump.current = id
    openSettings(to)
    setJumps((n) => n + 1)
  }

  const results = searchSettings(query)
  const searching = query.trim().length > 0

  const finder = (
    <div className="relative">
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search settings"
        aria-label="Search settings"
        className="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-9 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-500 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20"
      />
      {searching && (
        <button onClick={() => setQuery('')} aria-label="Clear search" className="absolute right-1.5 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )

  const found = (
    <div className="mt-3" aria-live="polite">
      {results.length === 0 ? (
        <p className="px-3 py-6 text-center text-sm text-zinc-500">Nothing found for “{query.trim()}”.</p>
      ) : (
        <ul className="space-y-0.5">
          {results.map((r) => (
            <li key={r.id}>
              <button onClick={() => jump(r.id, r.section)} className="w-full rounded-xl px-3 py-2 text-left transition hover:bg-white/5">
                <span className="block text-sm font-medium text-zinc-100">{r.title}</span>
                <span className="block text-xs text-zinc-500">{SECTIONS.find((s) => s.id === r.section)?.label}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  const backButton = (
    <button onClick={closeSettings} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Back to {VIEW_NAMES[prevView]}
    </button>
  )

  // Phones: the list of sections, as its own screen.
  if (!wide && !current) {
    return (
      <div ref={top} className="scroll-mt-4 space-y-4">
        {backButton}
        <Title />
        {finder}
        {searching ? (
          found
        ) : (
          <nav aria-label="Settings sections" className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
            {SECTIONS.map((s) => (
              <button key={s.id} onClick={() => openSettings(s.id)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition active:bg-white/5">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-indigo-300">
                  <s.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-zinc-100">{s.label}</span>
                  <span className="block truncate text-[13px] text-zinc-500">{s.about}</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-zinc-600" />
              </button>
            ))}
          </nav>
        )}
      </div>
    )
  }

  const body = current && (
    <div key={current.id} className="animate-fade min-w-0 space-y-7">
      <header>
        <h3 className="text-lg font-semibold tracking-tight text-white sm:text-xl">{current.label}</h3>
        <p className="mt-0.5 text-sm text-zinc-500">{current.about}</p>
      </header>
      {current.show()}
    </div>
  )

  // Phones: one section, with the way back to the list.
  if (!wide) {
    return (
      <div ref={top} className="scroll-mt-4 space-y-3">
        <button onClick={settingsUp} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Settings
        </button>
        {body}
      </div>
    )
  }

  return (
    <div ref={top} className="scroll-mt-4 space-y-5">
      <div>
        {backButton}
        <div className="mt-2">
          <Title />
        </div>
      </div>
      <div className="grid grid-cols-[13.5rem_minmax(0,1fr)] items-start gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
        <aside className="sticky top-4 max-h-[calc(100dvh-2rem)] overflow-y-auto pb-2">
          {finder}
          {searching ? (
            found
          ) : (
            <nav aria-label="Settings sections" className="mt-3 space-y-0.5">
              {SECTIONS.map((s) => {
                const on = s.id === section
                return (
                  <button
                    key={s.id}
                    onClick={() => openSettings(s.id)}
                    aria-current={on ? 'page' : undefined}
                    className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition ${on ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                  >
                    <s.icon className={`h-4 w-4 shrink-0 ${on ? 'text-indigo-300' : ''}`} />
                    <span className="truncate">{s.label}</span>
                  </button>
                )
              })}
            </nav>
          )}
        </aside>
        <div className="min-w-0 max-w-3xl">{body}</div>
      </div>
    </div>
  )
}

function Title() {
  return (
    <div className="flex items-center gap-3">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/20">
        <SettingsIcon className="h-5 w-5 text-white" strokeWidth={2.4} />
      </span>
      <div className="min-w-0">
        <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Settings</h2>
        <p className="truncate text-sm text-zinc-400">Make Dizayr work the way you do. Changes apply right away.</p>
      </div>
    </div>
  )
}
