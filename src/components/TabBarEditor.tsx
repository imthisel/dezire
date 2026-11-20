import { ArrowDown, ArrowUp, Award, CalendarCheck, Gem, GraduationCap, Menu, Minus, Mountain, Plus, Receipt, RotateCcw, Rocket, ShoppingBasket, Sparkles, Star, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { DEFAULT_PREFS, TAB_IDS, TAB_MAX, type NavId, type TabId } from '../lib/prefs'
import { useStore } from '../store'
import { Modal } from './Modal'

/** How each tab looks. */
export const TAB_LOOK: Record<TabId, { label: string; icon: LucideIcon; hint: string }> = {
  wants: { label: 'Wants', icon: Sparkles, hint: 'Your Wants overview' },
  needs: { label: 'Needs', icon: ShoppingBasket, hint: 'Your everyday budget' },
  life: { label: 'Life', icon: Mountain, hint: 'Your life goals' },
  school: { label: 'School', icon: GraduationCap, hint: 'Subjects and deadlines' },
  grades: { label: 'Grades', icon: Award, hint: 'Your grade tracker' },
  expenses: { label: 'Expenses', icon: Receipt, hint: 'Money spent, day by day' },
  calendar: { label: 'Calendar', icon: CalendarCheck, hint: 'Events and tasks' },
  assets: { label: 'Assets', icon: Gem, hint: 'What you own' },
  favorites: { label: 'Favorites', icon: Star, hint: 'The items you starred' },
  plan: { label: 'Income', icon: Rocket, hint: 'Your income plan' },
}

/** The setting that takes a tab's page out of the menus (a hidden page doesn't get a tab either). */
export const HIDDEN_BY: Partial<Record<TabId, NavId>> = {
  life: 'life', school: 'school', grades: 'school', expenses: 'expenses', calendar: 'calendar', assets: 'assets', favorites: 'favorites', plan: 'plan',
}

/** Opens the tab bar editor from anywhere (the More menu, Settings). */
export const EDIT_TABS_EVENT = 'dz-edit-tabs'
export const editTabBar = () => window.dispatchEvent(new Event(EDIT_TABS_EVENT))

const setTabs = (tabBar: TabId[]) => useStore.getState().setPrefs({ tabBar })

/**
 * Choosing the phone's tab bar: a live copy of the bar on top, then the tabs in it (move up / down, remove)
 * and every other page (add). More is always last and opens everything else.
 */
export function TabBarEditor() {
  const tabBar = useStore((s) => s.prefs.tabBar)
  const hiddenNav = useStore((s) => s.prefs.hiddenNav)
  const isHidden = (id: TabId) => !!HIDDEN_BY[id] && hiddenNav.includes(HIDDEN_BY[id]!)
  const full = tabBar.length >= TAB_MAX
  const others = TAB_IDS.filter((id) => !tabBar.includes(id))
  const isDefault = tabBar.join() === DEFAULT_PREFS.tabBar.join()

  const move = (i: number, d: -1 | 1) => {
    const next = [...tabBar]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    setTabs(next)
  }

  return (
    <div className="space-y-5">
      <Preview tabs={tabBar.filter((id) => !isHidden(id))} />

      <section>
        <h4 className="mb-2 flex items-baseline justify-between px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">
          In your tab bar
          <span className="font-medium normal-case tracking-normal tabular-nums text-zinc-500">
            {tabBar.length} of {TAB_MAX}
          </span>
        </h4>
        {tabBar.length === 0 ? (
          <p className="rounded-xl border border-dashed border-white/10 px-4 py-4 text-center text-sm text-zinc-500">No tabs: only More. Add a page below.</p>
        ) : (
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
            {tabBar.map((id, i) => (
              <PageRow
                key={id}
                id={id}
                note={isHidden(id) ? 'Hidden in Customize menu, so it isn’t shown' : undefined}
                lead={
                  <RoundBtn label={`Remove ${TAB_LOOK[id].label}`} cls="bg-rose-500 text-white" onClick={() => setTabs(tabBar.filter((x) => x !== id))}>
                    <Minus className="h-3.5 w-3.5" strokeWidth={3} />
                  </RoundBtn>
                }
              >
                <IconBtn label={`Move ${TAB_LOOK[id].label} earlier`} disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Move ${TAB_LOOK[id].label} later`} disabled={i === tabBar.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </IconBtn>
              </PageRow>
            ))}
          </ul>
        )}
      </section>

      {others.length > 0 && (
        <section>
          <h4 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-500">More pages</h4>
          {full && <p className="mb-2 px-1 text-xs text-amber-200/80">The tab bar is full. Remove a tab to add another.</p>}
          <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/[0.07] bg-white/[0.02]">
            {others.map((id) => {
              const hidden = isHidden(id)
              return (
                <PageRow
                  key={id}
                  id={id}
                  dim={full || hidden}
                  note={hidden ? 'Hidden in Customize menu' : undefined}
                  lead={
                    <RoundBtn label={`Add ${TAB_LOOK[id].label}`} cls="bg-emerald-500 text-white" disabled={full || hidden} onClick={() => setTabs([...tabBar, id])}>
                      <Plus className="h-3.5 w-3.5" strokeWidth={3} />
                    </RoundBtn>
                  }
                />
              )
            })}
          </ul>
        </section>
      )}

      {!isDefault && (
        <button
          onClick={() => setTabs(DEFAULT_PREFS.tabBar)}
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Back to the usual tabs ({DEFAULT_PREFS.tabBar.map((id) => TAB_LOOK[id].label).join(', ')})
        </button>
      )}
    </div>
  )
}

/** The tab bar as it will look, updating as you change it. */
function Preview({ tabs }: { tabs: TabId[] }) {
  const empty = Math.max(0, TAB_MAX - tabs.length)
  return (
    <div aria-label="Preview of your tab bar" role="img" className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b0c11]">
      <div className="flex">
        {tabs.map((id, i) => (
          <PreviewTab key={id} icon={TAB_LOOK[id].icon} label={TAB_LOOK[id].label} on={i === 0} />
        ))}
        {Array.from({ length: empty }, (_, i) => (
          <span key={`e${i}`} className="flex flex-1 flex-col items-center justify-center gap-1 py-2.5">
            <span className="h-5 w-5 rounded-md border border-dashed border-white/15" />
            <span className="h-2 w-7 rounded-full bg-white/[0.04]" />
          </span>
        ))}
        <PreviewTab icon={Menu} label="More" />
      </div>
    </div>
  )
}

function PreviewTab({ icon: Icon, label, on }: { icon: LucideIcon; label: string; on?: boolean }) {
  return (
    <span className={`animate-fade relative flex min-w-0 flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px] font-medium ${on ? 'text-white' : 'text-zinc-500'}`}>
      {on && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-indigo-400" />}
      <Icon className={`h-5 w-5 ${on ? 'text-indigo-300' : ''}`} strokeWidth={on ? 2.4 : 2} />
      <span className="max-w-full truncate px-px">{label}</span>
    </span>
  )
}

function PageRow({ id, lead, note, dim, children }: { id: TabId; lead: ReactNode; note?: string; dim?: boolean; children?: ReactNode }) {
  const t = TAB_LOOK[id]
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {lead}
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.05] ${dim ? 'text-zinc-600' : 'text-zinc-300'}`}>
        <t.icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block truncate text-sm font-medium ${dim ? 'text-zinc-500' : 'text-white'}`}>{t.label}</span>
        <span className={`block truncate text-xs ${note ? 'text-amber-200/70' : 'text-zinc-500'}`}>{note ?? t.hint}</span>
      </span>
      {children && <span className="flex shrink-0 items-center gap-0.5">{children}</span>}
    </li>
  )
}

function RoundBtn({ label, cls, disabled, onClick, children }: { label: string; cls: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full transition active:scale-90 disabled:opacity-25 ${cls}`}
    >
      {children}
    </button>
  )
}

function IconBtn({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white active:scale-90 disabled:pointer-events-none disabled:opacity-20"
    >
      {children}
    </button>
  )
}

/** The editor as a sheet: opened from the tab bar itself (press and hold) or from More. */
export function TabBarSheet({ onClose }: { onClose: () => void }) {
  return (
    <Modal
      title="Edit tab bar"
      subtitle="Pick the pages you use most. More is always last and opens everything else."
      onClose={onClose}
      width="max-w-md"
      footer={
        <button onClick={onClose} className="h-11 w-full rounded-xl bg-indigo-500 text-sm font-semibold text-white transition hover:bg-indigo-400 sm:w-auto sm:px-6">
          Done
        </button>
      }
    >
      <TabBarEditor />
    </Modal>
  )
}
