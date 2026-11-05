import { useState, type ReactNode } from 'react'
import { BookOpen, Check, Download, Layers, ListChecks, MapPin, RefreshCw, RotateCcw, Sparkles, Tags, Target } from 'lucide-react'
import { applyUpdate, checkForUpdate, installApp, useApp } from '../../appUpdate'
import { DEFAULT_DEVICE, DEFAULT_PREFS } from '../../lib/prefs'
import { useStore } from '../../store'
import { toast } from '../../toast'
import { ExpenseSettings, type SettingsTab } from '../ExpenseSettings'
import { CopyModeModal, ModesModal } from '../Modes'
import { TaskKinds } from '../TaskKinds'
import { ActionRow, Button, Group, Row } from './ui'

export function ListsSection() {
  const kinds = useStore((s) => s.kinds.length)
  const areas = useStore((s) => s.goalAreas.length)
  const cats = useStore((s) => s.expenseCats.length)
  const places = useStore((s) => s.places.length)
  const taskKinds = useStore((s) => s.taskKinds.length)
  const modes = useStore((s) => s.modes.length)
  const [expenseTab, setExpenseTab] = useState<SettingsTab | null>(null)
  const [editTasks, setEditTasks] = useState(false)
  const [modesWindow, setModesWindow] = useState<null | 'list' | 'copy'>(null)
  const openModal = useStore.getState().openModal

  return (
    <>
      <Group title="Your plan" hint="Rename, recolour, reorder, add or delete. Nothing you’ve already planned gets lost.">
        <ActionRow id="list-kinds" icon={Tags} title="Kinds of items" hint="Property, vehicles, investments and more." value={kinds} onClick={() => openModal({ type: 'kinds' })} />
        <ActionRow id="list-areas" icon={Target} title="Goal areas" hint="What your yearly goals are grouped by." value={areas} onClick={() => openModal({ type: 'goalAreas' })} />
        <ActionRow id="list-modes" icon={Layers} title="Modes" hint="Wants and Needs each keep their own modes." value={modes} onClick={() => setModesWindow('list')} />
      </Group>
      <Group title="Spending">
        <ActionRow id="list-cats" icon={Tags} title="Expense categories" hint="And the usual things in each." value={cats} onClick={() => setExpenseTab('categories')} />
        <ActionRow id="list-places" icon={MapPin} title="Places" hint="Where you go often, one tap when adding an expense." value={places} onClick={() => setExpenseTab('places')} />
      </Group>
      <Group title="Time">
        <ActionRow id="list-tasks" icon={ListChecks} title="Kinds of tasks" hint="School, work and the rest, each with its colour." value={taskKinds} onClick={() => setEditTasks(true)} />
      </Group>

      {expenseTab && <ExpenseSettings tab={expenseTab} onClose={() => setExpenseTab(null)} />}
      {editTasks && <TaskKinds onClose={() => setEditTasks(false)} />}
      {modesWindow === 'list' && <ModesModal onCopy={() => setModesWindow('copy')} onClose={() => setModesWindow(null)} />}
      {modesWindow === 'copy' && <CopyModeModal onClose={() => setModesWindow(null)} />}
    </>
  )
}

const builtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const SHORTCUTS: { keys: string[]; what: string }[] = [
  { keys: ['T'], what: 'Jump to today' },
  { keys: ['D'], what: 'Day view' },
  { keys: ['3'], what: '3-day view' },
  { keys: ['W'], what: 'Week view' },
  { keys: ['M'], what: 'Month view' },
  { keys: ['E'], what: 'New event' },
  { keys: ['N'], what: 'New task' },
  { keys: ['←', '→'], what: 'Earlier or later' },
]

const TIPS: ReactNode[] = [
  <>Money boxes understand <b>100k</b>, <b>1.5m</b> and <b>250,000</b>.</>,
  <>Drag an item to another month to move it. Hold <b>Ctrl</b> while dragging to copy it instead.</>,
  <>Drag an item onto a year tab to switch years on the way.</>,
  <>On a phone, pinch the months and items to change how many columns they show.</>,
  <>Press <b>Esc</b> to close a window or cancel what you’re moving.</>,
]

function Key({ children }: { children: ReactNode }) {
  return <kbd className="inline-grid h-6 min-w-6 place-items-center rounded-md border border-white/15 bg-white/[0.06] px-1.5 text-xs font-medium text-zinc-200">{children}</kbd>
}

export function HelpSection() {
  const { version, builtAt, update, checking, installed } = useApp()

  function resetSettings() {
    const s = useStore.getState()
    const before = { prefs: s.prefs, device: s.device, hiddenCharts: s.hiddenCharts, phoneCols: s.phoneCols, openAllMonths: s.openAllMonths, sidebar: s.sidebar, assetFavorite: s.assetFavorite, dashMode: s.dashMode }
    useStore.setState({
      prefs: DEFAULT_PREFS,
      // When the last backup was made is a fact, not a setting.
      device: { ...DEFAULT_DEVICE, lastBackup: s.device.lastBackup },
      hiddenCharts: [],
      phoneCols: 1,
      openAllMonths: false,
      sidebar: true,
      assetFavorite: null,
      dashMode: 'plan',
    })
    toast.undo('Settings are back to their defaults. Your plan wasn’t touched.', () => useStore.setState(before))
  }

  return (
    <>
      <Group title="The app">
        <Row
          id="version"
          title={update ? 'A new version is ready' : 'Version'}
          hint={
            <span className="tabular-nums">
              {version}
              {version !== 'dev' && builtDate(builtAt) && ` · ${builtDate(builtAt)}`}
            </span>
          }
        >
          {update ? (
            <Button tone="primary" icon={Sparkles} onClick={() => void applyUpdate()}>
              Update now
            </Button>
          ) : (
            <Button icon={RefreshCw} disabled={checking} onClick={() => void checkForUpdate(true)}>
              Check for updates
            </Button>
          )}
        </Row>
        {installed ? (
          <Row id="install" title="Installed" hint="You’re using the Dizayr app.">
            <span className="inline-flex items-center gap-1.5 text-[13px] font-medium text-emerald-300">
              <Check className="h-3.5 w-3.5" /> Installed
            </span>
          </Row>
        ) : (
          <ActionRow id="install" icon={Download} title="Install the app" hint="Opens like an app, works offline and stays in sync." onClick={() => void installApp()} />
        )}
        <ActionRow id="about-page" icon={BookOpen} title="About Dizayr" hint="What it does, plans and common questions." href="/about" />
      </Group>

      <Group title="Keyboard shortcuts" hint="On the Calendar page, on a computer.">
        <div id="set-shortcuts" className="grid scroll-mt-4 gap-x-6 gap-y-2.5 p-4 sm:grid-cols-2">
          {SHORTCUTS.map((s) => (
            <div key={s.what} className="flex items-center justify-between gap-3 text-sm text-zinc-300">
              <span>{s.what}</span>
              <span className="flex shrink-0 gap-1">
                {s.keys.map((k) => (
                  <Key key={k}>{k}</Key>
                ))}
              </span>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Handy tips">
        <ul id="set-tips" className="scroll-mt-4 space-y-2 p-4 text-sm leading-relaxed text-zinc-300 [&_b]:font-semibold [&_b]:text-white">
          {TIPS.map((t, i) => (
            <li key={i} className="flex gap-2.5">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-indigo-400" />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      </Group>

      <Group title="Start over">
        <ActionRow id="reset-settings" icon={RotateCcw} title="Reset all settings" hint="Puts every setting back to its default. Your plan isn’t touched, and you can undo it." onClick={resetSettings} />
      </Group>
    </>
  )
}
