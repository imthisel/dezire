import { useRef } from 'react'
import { Download, Eye, EyeOff, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, Target, Upload } from 'lucide-react'
import { inNeedsMode, useStore } from '../store'
import { downloadBackup, readBackup, restoreBackup } from '../backup'
import { goHome } from '../nav'
import { toast } from '../toast'
import { AccountMenu, SaveIndicator } from './AccountMenu'
import { CurrencyMenu } from './CurrencyMenu'
import { ModeSwitcher } from './Modes'
import { PremiumBadge } from './Plans'
import { toggleSidebar, useDocked } from './Sidebar'

export function Header() {
  const docked = useDocked()
  const sidebar = useStore((s) => s.sidebar)
  const symbol = useStore((s) => s.currency.main.symbol)
  const prefs = useStore((s) => s.prefs)
  const masked = useStore((s) => s.device.masked)
  const needs = useStore(inNeedsMode)
  const fileRef = useRef<HTMLInputElement>(null)
  // Tablets and phones give the tools their own rows; with everything hidden those rows go too.
  const anyTool = !prefs.hideCurrency || !prefs.hideBackup || !prefs.hideReset || prefs.privacyButton

  function reset() {
    if (confirm('Delete ALL money goals, budgets, items, expenses, yearly goals, money plans, tasks, year and setup notes and your birthday from 2026–2040? This cannot be undone.')) {
      useStore.getState().resetAll()
      toast.info('Everything was cleared.')
    }
  }

  const btn =
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white'

  const tools = (phone: boolean) => (
    <>
      {!phone && !prefs.hideModes && <ModeSwitcher phone={false} />}
      {!prefs.hideCurrency && <CurrencyMenu phone={phone} />}
      {prefs.privacyButton && (
        <button
          className={`${btn} ${masked ? 'border-indigo-400/40 text-indigo-200' : ''} ${phone ? 'h-10 w-10 px-0' : 'w-9 px-0'}`}
          onClick={() => useStore.getState().setDevice({ masked: !masked })}
          title={masked ? 'Show amounts' : 'Hide amounts'}
          aria-label={masked ? 'Show amounts' : 'Hide amounts'}
          aria-pressed={masked}
        >
          {masked ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      )}
      {!prefs.hideBackup && (
        <>
      <button className={`${btn} ${phone ? 'h-10 w-10 px-0' : ''}`} onClick={downloadBackup} title="Download a backup of all your data" aria-label="Export backup">
        <Download className="h-4 w-4" /> {!phone && <span className="hidden min-[1400px]:inline">Export</span>}
      </button>
      <button className={`${btn} ${phone ? 'h-10 w-10 px-0' : ''}`} onClick={() => fileRef.current?.click()} title="Restore from a backup file" aria-label="Import backup">
        <Upload className="h-4 w-4" /> {!phone && <span className="hidden min-[1400px]:inline">Import</span>}
      </button>
        </>
      )}
      {!prefs.hideReset && (
        <button
          className={`${btn} hover:border-red-500/40 hover:text-red-300 ${phone ? 'h-10 w-10 px-0' : ''}`}
          onClick={reset}
          title="Clear everything"
          aria-label="Clear everything"
        >
          <RotateCcw className="h-4 w-4" />
        </button>
      )}
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
          <a
            href="/"
            onClick={goHome}
            title="Go to Overview"
            className="flex min-w-0 items-center gap-3 rounded-2xl transition hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/60"
          >
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/20 sm:h-11 sm:w-11">
            <Target className="h-5 w-5 text-white sm:h-6 sm:w-6" strokeWidth={2.5} />
          </div>
          <div className="min-w-0">
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Dizayr</h1>
            <p className="truncate text-xs text-zinc-400">
              <span className="sm:hidden">{needs ? `${symbol} everyday budget` : `${symbol} planner · 2026 – 2040`}</span>
              <span className="hidden sm:inline">{needs ? <>Everyday budget in {symbol}</> : <>Goals, budgets &amp; net worth in {symbol} · 2026 – 2040</>}</span>
            </p>
          </div>
          </a>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <div className="hidden items-center gap-2 2xl:flex">{tools(false)}</div>
          <PremiumBadge />
          <SaveIndicator />
          <AccountMenu />
        </div>
      </div>

      {/* Tablets and laptops: the tools don't fit beside the logo, so they get their own row */}
      {(anyTool || !prefs.hideModes) && <div className="mt-4 hidden flex-wrap items-center justify-end gap-2 sm:flex 2xl:hidden">{tools(false)}</div>}
      {anyTool && <div className="mt-4 flex items-center gap-2 sm:hidden">{tools(true)}</div>}
      {/* Phones: the mode in use, on its own row so the name has room */}
      {!prefs.hideModes && (
        <div className={`${anyTool ? 'mt-2' : 'mt-4'} flex sm:hidden`}>
          <ModeSwitcher phone />
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void readBackup(f).then((info) => info && restoreBackup(info.data))
          e.target.value = ''
        }}
      />
    </header>
  )
}
