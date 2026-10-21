import { useRef } from 'react'
import { Download, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, Target, Upload } from 'lucide-react'
import { useStore } from '../store'
import { toast } from '../toast'
import { AccountMenu, SaveIndicator } from './AccountMenu'
import { CurrencyMenu } from './CurrencyMenu'
import { toggleSidebar, useDocked } from './Sidebar'

export function Header() {
  const docked = useDocked()
  const sidebar = useStore((s) => s.sidebar)
  const symbol = useStore((s) => s.currency.main.symbol)
  const fileRef = useRef<HTMLInputElement>(null)

  function exportData() {
    const { months, kinds, currency, goals, goalAreas, sources, birthday, yearNotes, expenses, expenseCats, places, layouts, tasks, taskKinds } = useStore.getState()
    const blob = new Blob(
      [JSON.stringify({ app: 'obseszion', version: 4, exportedAt: new Date().toISOString(), currency, months, kinds, goals, goalAreas, sources, birthday, yearNotes, expenses, expenseCats, places, layouts, tasks, taskKinds }, null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `obseszion-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(a.href)
    toast.success('Backup downloaded.')
  }

  async function importFile(file: File) {
    try {
      const r = useStore.getState().importData(JSON.parse(await file.text()))
      r.ok ? toast.success('Backup restored.') : toast.error(r.error)
    } catch {
      toast.error('That file is not valid JSON.')
    }
  }

  function reset() {
    if (confirm('Delete ALL money goals, budgets, items, expenses, yearly goals, money plans, tasks, year notes and your birthday from 2026–2040? This cannot be undone.')) {
      useStore.getState().resetAll()
      toast.info('Everything was cleared.')
    }
  }

  const btn =
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white'

  const tools = (phone: boolean) => (
    <>
      <CurrencyMenu phone={phone} />
      <button className={`${btn} ${phone ? 'h-10 w-10 px-0' : ''}`} onClick={exportData} title="Download a backup of all your data" aria-label="Export backup">
        <Download className="h-4 w-4" /> {!phone && 'Export'}
      </button>
      <button className={`${btn} ${phone ? 'h-10 w-10 px-0' : ''}`} onClick={() => fileRef.current?.click()} title="Restore from a backup file" aria-label="Import backup">
        <Upload className="h-4 w-4" /> {!phone && 'Import'}
      </button>
      <button
        className={`${btn} hover:border-red-500/40 hover:text-red-300 ${phone ? 'h-10 w-10 px-0' : ''}`}
        onClick={reset}
        title="Clear everything"
        aria-label="Clear everything"
      >
        <RotateCcw className="h-4 w-4" />
      </button>
    </>
  )

  return (
    <header className="mx-auto max-w-[1440px] px-4 pb-5 pt-[max(1rem,env(safe-area-inset-top))] sm:px-6 sm:py-6 lg:px-8">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button
            onClick={() => toggleSidebar(docked)}
            title={docked && sidebar ? 'Hide sidebar' : 'Show sidebar'}
            aria-label={docked && sidebar ? 'Hide sidebar' : 'Show sidebar'}
            className="-ml-1 grid h-10 w-10 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/5 hover:text-white"
          >
            {docked && sidebar ? <PanelLeftClose className="h-5 w-5" /> : docked ? <PanelLeftOpen className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/20 sm:h-11 sm:w-11">
            <Target className="h-5 w-5 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Obseszion</h1>
            <p className="truncate text-xs text-zinc-400">
              <span className="sm:hidden">{symbol} planner · 2026 – 2040</span>
              <span className="hidden sm:inline">Goals, budgets &amp; net worth in {symbol} · 2026 – 2040</span>
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 sm:flex">{tools(false)}</div>
          <SaveIndicator />
          <AccountMenu />
        </div>
      </div>

      <div className="mt-4 flex items-center gap-2 sm:hidden">{tools(true)}</div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) importFile(f)
          e.target.value = ''
        }}
      />
    </header>
  )
}
