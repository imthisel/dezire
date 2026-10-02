import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react'
import { useToasts } from '../toast'

const STYLE = {
  error: { icon: AlertCircle, cls: 'border-red-500/40 bg-red-950/90 text-red-100', iconCls: 'text-red-400' },
  success: { icon: CheckCircle2, cls: 'border-emerald-500/40 bg-emerald-950/90 text-emerald-100', iconCls: 'text-emerald-400' },
  warning: { icon: AlertTriangle, cls: 'border-amber-500/40 bg-amber-950/90 text-amber-100', iconCls: 'text-amber-400' },
  info: { icon: Info, cls: 'border-indigo-500/40 bg-indigo-950/90 text-indigo-100', iconCls: 'text-indigo-300' },
}

export function Toasts() {
  const { toasts, dismiss } = useToasts()
  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[60] flex flex-col items-end gap-2 sm:left-auto sm:right-6 sm:top-6 sm:w-[400px]">
      {toasts.map((t) => {
        const s = STYLE[t.kind]
        return (
          <div
            key={t.id}
            role={t.kind === 'error' ? 'alert' : 'status'}
            className={`animate-slide pointer-events-auto flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-sm shadow-xl shadow-black/40 backdrop-blur ${s.cls}`}
          >
            <s.icon className={`mt-0.5 h-5 w-5 shrink-0 ${s.iconCls}`} />
            <p className="flex-1 leading-snug">{t.message}</p>
            <button onClick={() => dismiss(t.id)} className="opacity-60 transition hover:opacity-100" aria-label="Dismiss">
              <X className="h-4 w-4" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
