import { useEffect, useRef, useState } from 'react'
import { Download, RotateCcw, Target, Upload } from 'lucide-react'
import { useStore } from '../store'
import { toast } from '../toast'

export function Header() {
  const usdRate = useStore((s) => s.usdRate)
  const setUsdRate = useStore((s) => s.setUsdRate)
  const [rateText, setRateText] = useState(String(usdRate))
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => setRateText(String(usdRate)), [usdRate])

  function exportData() {
    const { months, usdRate } = useStore.getState()
    const blob = new Blob(
      [JSON.stringify({ app: 'dezire', version: 2, exportedAt: new Date().toISOString(), currency: 'PHP', usdRate, months }, null, 2)],
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
    if (confirm('Delete ALL goals, budgets and items from 2026–2040? This cannot be undone.')) {
      useStore.getState().resetAll()
      toast.info('Everything was cleared.')
    }
  }

  const btn =
    'inline-flex h-9 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-300 transition hover:border-white/20 hover:bg-white/[0.06] hover:text-white'

  return (
    <header className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/20">
          <Target className="h-6 w-6 text-white" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Dezire</h1>
          <p className="text-xs text-zinc-400">Goals, budgets &amp; net worth in ₱ · 2026 – 2040</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className={`${btn} pr-1`} title="Exchange rate used to show US dollar amounts">
          <span className="text-zinc-400">Rate</span>
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
          <span className="pr-1.5 text-zinc-400">= $1</span>
        </label>
        <button className={btn} onClick={exportData} title="Download a backup of all your data">
          <Download className="h-4 w-4" /> <span className="hidden sm:inline">Export</span>
        </button>
        <button className={btn} onClick={() => fileRef.current?.click()} title="Restore from a backup file">
          <Upload className="h-4 w-4" /> <span className="hidden sm:inline">Import</span>
        </button>
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
        <button className={`${btn} hover:border-red-500/40 hover:text-red-300`} onClick={reset} title="Clear everything">
          <RotateCcw className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
