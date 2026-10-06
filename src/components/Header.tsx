import { useEffect, useRef, useState } from 'react'
import { Download, Menu, PanelLeftClose, PanelLeftOpen, RotateCcw, Target, Upload } from 'lucide-react'
import { useStore } from '../store'
import { toast } from '../toast'
import { AccountMenu, SaveIndicator } from './AccountMenu'
import { toggleSidebar, useDocked } from './Sidebar'

export function Header() {
  const docked = useDocked()
  const sidebar = useStore((s) => s.sidebar)
  const usdRate = useStore((s) => s.usdRate)
  const setUsdRate = useStore((s) => s.setUsdRate)
  const [rateText, setRateText] = useState(String(usdRate))
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setRateText(String(usdRate)), [usdRate])

  function exportData() {
    const { months, usdRate, goals, areaLabels, sources, birthday } = useStore.getState()
    const blob = new Blob(
      [JSON.stringify({ app: 'dezire', version: 3, exportedAt: new Date().toISOString(), currency: 'PHP', usdRate, months, goals, areaLabels, sources, birthday }, null, 2)],
      { type: 'application/json' },
    )
    const a = document.createElement('a')
    a.href = URL.createObjectURL(blob)
    a.download = `dezire-backup-${new Date().toISOString().slice(0, 10)}.json`
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
    if (confirm('Delete ALL money goals, budgets, items, yearly goals, money plans and your birthday from 2026–2040? This cannot be undone.')) {
      useStore.getState().resetAll()
      toast.info('Everything was cleared.')
    }
  }

  const btn =
    'inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white'

  const tools = (phone: boolean) => (
    <>
      <label className={`${btn} pr-1 ${phone ? 'h-10 flex-1 justify-between' : ''}`} title="Exchange rate used to show US dollar amounts">
        <span className="text-zinc-400">Rate</span>
        <span className="flex items-center">
          <span className="flex h-7 items-center rounded-lg bg-white/5 pl-2 text-white">
            ₱
            <input
              inputMode="decimal"
              value={rateText}
              onChange={(e) => {
                const t = e.target.value.replace(/[^\d.]/g, '')
                setRateText(t)
                if (parseFloat(t) > 0) setUsdRate(parseFloat(t))
              }}
              onBlur={() => setRateText(String(usdRate))}
              className="w-14 bg-transparent px-1 tabular-nums outline-none"
              aria-label="Pesos per US dollar"
            />
          </span>
          <span className="px-1.5 text-zinc-400">= $1</span>
        </span>
      </label>
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
            <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">Dezire</h1>
            <p className="truncate text-xs text-zinc-400">
              <span className="sm:hidden">₱ planner · 2026 – 2040</span>
              <span className="hidden sm:inline">Goals, budgets &amp; net worth in ₱ · 2026 – 2040</span>
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
