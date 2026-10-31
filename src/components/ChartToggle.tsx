import { Eye, EyeOff } from 'lucide-react'
import { useStore } from '../store'

/** Whether chart (or card) `id` is folded away (remembered). */
export const useChartHidden = (id: string) => useStore((s) => s.hiddenCharts.includes(id))

/** The Hide / Show button in a card's header. `name`: what it hides, e.g. "net worth chart". `show`: the button's text while hidden. */
export function ChartToggle({ id, name, show = 'Show chart' }: { id: string; name: string; show?: string }) {
  const hidden = useChartHidden(id)
  const toggle = useStore((s) => s.toggleChart)
  const label = hidden ? `Show the ${name}` : `Hide the ${name}`
  return (
    <button
      onClick={() => toggle(id)}
      aria-label={label}
      aria-expanded={!hidden}
      title={label}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2 text-xs font-medium transition ${
        hidden
          ? 'border-indigo-400/30 bg-indigo-500/10 text-indigo-100 hover:bg-indigo-500/20'
          : 'border-white/10 text-zinc-400 hover:border-white/20 hover:bg-white/5 hover:text-white'
      }`}
    >
      {hidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{hidden ? show : 'Hide'}</span>
    </button>
  )
}
