import { Check } from 'lucide-react'
import { ACCENTS, NAV_IDS, type NavId, type StartPage, type TextSize } from '../../lib/prefs'
import { useStore, type PhoneCols } from '../../store'
import { Group, Row, Segmented, Select, ToggleRow } from './ui'

const NAV_LABELS: Record<NavId, { label: string; hint: string }> = {
  favorites: { label: 'Favorites', hint: 'The items you starred' },
  calendar: { label: 'Calendar', hint: 'Events and tasks' },
  school: { label: 'School', hint: 'Subjects, deadlines and a board of what’s done' },
  expenses: { label: 'Expenses', hint: 'Money spent, day by day' },
  assets: { label: 'Assets', hint: 'What you own, and vehicle setups' },
  plan: { label: 'Money plan', hint: 'The ways you’ll make the money' },
}

const START_PAGES: { id: StartPage; label: string }[] = [
  { id: 'last', label: 'Where I left off' },
  { id: 'planner', label: 'Overview' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'school', label: 'School' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'assets', label: 'Assets' },
  { id: 'favorites', label: 'Favorites' },
  { id: 'plan', label: 'Money plan' },
]

const CHARTS = [
  { id: 'networth', label: 'Net worth chart', hint: 'On the Overview' },
  { id: 'assets', label: 'Assets card', hint: 'On the Overview' },
  { id: 'spend', label: 'Spending chart', hint: 'On Expenses' },
]

export function AppearanceSection() {
  const accent = useStore((s) => s.prefs.accent)
  const device = useStore((s) => s.device)
  const { setPrefs, setDevice } = useStore.getState()

  return (
    <>
      <Group title="Colour" hint="Follows your account to all your devices.">
        <Row id="accent" title="Accent colour" hint="Used for buttons, highlights and the logo." stacked>
          <div role="radiogroup" aria-label="Accent colour" className="flex flex-wrap gap-2">
            {ACCENTS.map((a) => {
              const on = a.id === accent
              return (
                <button
                  key={a.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setPrefs({ accent: a.id })}
                  className={`flex h-10 items-center gap-2 rounded-xl border pl-2 pr-3 text-[13px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
                    on ? 'border-white/30 bg-white/[0.08] text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-white'
                  }`}
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full" style={{ background: a.swatch }}>
                    {on && <Check className="h-3.5 w-3.5 text-white" strokeWidth={3} />}
                  </span>
                  {a.label}
                </button>
              )
            })}
          </div>
        </Row>
      </Group>

      <Group title="On this device" hint="These stay on this device, so a phone and a laptop can differ.">
        <Row id="text-size" title="Text size" hint="Scales the whole app.">
          <Segmented<TextSize>
            label="Text size"
            value={device.textSize}
            onChange={(textSize) => setDevice({ textSize })}
            options={[
              { id: 'small', label: 'Small' },
              { id: 'default', label: 'Normal' },
              { id: 'large', label: 'Large' },
            ]}
          />
        </Row>
        <ToggleRow id="glow" title="Background glow" hint="The soft coloured light behind the pages." on={device.glow} onChange={(glow) => setDevice({ glow })} />
        <ToggleRow id="calm" title="Reduce motion" hint="Turns off animations and sliding." on={device.calm} onChange={(calm) => setDevice({ calm })} />
        <ToggleRow id="solid" title="Turn off blur" hint="Solid menus instead of frosted glass. Can feel smoother on older devices." on={device.solid} onChange={(solid) => setDevice({ solid })} />
      </Group>
    </>
  )
}

export function LayoutSection() {
  const prefs = useStore((s) => s.prefs)
  const device = useStore((s) => s.device)
  const sidebar = useStore((s) => s.sidebar)
  const dashMode = useStore((s) => s.dashMode)
  const kinds = useStore((s) => s.kinds)
  const assetFavorite = useStore((s) => s.assetFavorite)
  const hiddenCharts = useStore((s) => s.hiddenCharts)
  const phoneCols = useStore((s) => s.phoneCols)
  const openAllMonths = useStore((s) => s.openAllMonths)
  const s = useStore.getState()

  const toggleNav = (id: NavId, show: boolean) => s.setPrefs({ hiddenNav: show ? prefs.hiddenNav.filter((x) => x !== id) : [...prefs.hiddenNav, id] })

  return (
    <>
      <Group title="Header buttons" hint="Keep the top of the app as simple as you like. Everything hidden here is still available in Settings.">
        <ToggleRow id="export-import" title="Export & Import buttons" hint="Download or restore a backup. Also in Data & backup." on={!prefs.hideBackup} onChange={(on) => s.setPrefs({ hideBackup: !on })} />
        <ToggleRow id="hide-reset" title="Clear everything button" hint="Hide it to avoid pressing it by accident. Also in Data & backup." on={!prefs.hideReset} onChange={(on) => s.setPrefs({ hideReset: !on })} />
        <ToggleRow id="hide-currency" title="Currency button" hint="The rate and the show / hide switch. Also in Money." on={!prefs.hideCurrency} onChange={(on) => s.setPrefs({ hideCurrency: !on })} />
        <ToggleRow id="hide-modes" title="Wants and Needs buttons" hint="Switch between your Wants and Needs modes. Also in Your lists." on={!prefs.hideModes} onChange={(on) => s.setPrefs({ hideModes: !on })} />
        <ToggleRow id="privacy-button" title="Hide amounts button" hint="One tap to hide your money when someone’s looking." on={prefs.privacyButton} onChange={(privacyButton) => s.setPrefs({ privacyButton })} />
      </Group>

      <Group title="Side menu & tab bar" hint="Don’t use a page? Take it out of the menu. Your data stays, and you can bring it back any time.">
        <div id="set-nav" className="divide-y divide-white/[0.06]">
          {NAV_IDS.map((id) => (
            <ToggleRow key={id} title={NAV_LABELS[id].label} hint={NAV_LABELS[id].hint} on={!prefs.hiddenNav.includes(id)} onChange={(on) => toggleNav(id, on)} />
          ))}
        </div>
        <ToggleRow id="sidebar" title="Show the side menu" hint="On wide screens. On smaller ones it slides in from the menu button." on={sidebar} onChange={s.setSidebar} />
      </Group>

      <Group title="Opening pages">
        <Row id="start-page" title="Open the app on" hint="On this device.">
          <Select<StartPage> label="Open the app on" value={device.startPage} onChange={(startPage) => s.setDevice({ startPage })} options={START_PAGES} />
        </Row>
        <Row id="dash-mode" title="Overview shows">
          <Segmented<'plan' | 'year'>
            label="Overview shows"
            value={dashMode}
            onChange={s.setDashMode}
            options={[
              { id: 'plan', label: 'Whole plan' },
              { id: 'year', label: 'One year' },
            ]}
          />
        </Row>
        <Row id="asset-favorite" title="Assets opens on">
          <Select<string>
            label="Assets opens on"
            value={assetFavorite ?? 'all'}
            onChange={(v) => s.setAssetFavorite(v === 'all' ? null : v)}
            options={[{ id: 'all', label: 'All kinds' }, ...kinds.map((k) => ({ id: k.id, label: k.label }))]}
          />
        </Row>
      </Group>

      <Group title="Charts & cards">
        <div id="set-charts" className="divide-y divide-white/[0.06]">
          {CHARTS.map((c) => (
            <ToggleRow key={c.id} title={c.label} hint={c.hint} on={!hiddenCharts.includes(c.id)} onChange={() => s.toggleChart(c.id)} />
          ))}
        </div>
      </Group>

      <Group title="On phones" hint="You can also pinch the months and items to change columns.">
        <Row id="phone-cols" title="Columns on phones">
          <Segmented<PhoneCols>
            label="Columns on phones"
            value={phoneCols}
            onChange={s.setPhoneCols}
            options={[
              { id: 1, label: '1' },
              { id: 2, label: '2' },
              { id: 3, label: '3' },
            ]}
          />
        </Row>
        <ToggleRow id="open-months" title="Unfold all months on phones" hint="Show every month card open, not just the current one." on={openAllMonths} onChange={s.setOpenAllMonths} />
      </Group>
    </>
  )
}
