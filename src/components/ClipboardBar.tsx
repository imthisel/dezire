import { useEffect } from 'react'
import { ClipboardPaste, Scissors, Copy, X } from 'lucide-react'
import { useFmt, useStore } from '../store'
import { labelOfKey } from '../lib/time'

export function ClipboardBar() {
  const clip = useStore((s) => s.clipboard)
  const clear = useStore((s) => s.clearClipboard)
  const f = useFmt()

  useEffect(() => {
    if (!clip) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !useStore.getState().modal && clear()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [clip, clear])

  if (!clip) return null
  const Icon = clip.mode === 'cut' ? Scissors : Copy

  return (
    <div className="animate-rise fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border border-indigo-400/30 bg-[#11131c]/95 py-2.5 pl-4 pr-2.5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:bottom-6">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-500/20 text-indigo-200">
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium text-white">
          {clip.mode === 'cut' ? 'Cut' : 'Copied'} “{clip.item.name}” · {f(clip.item.price)}
        </p>
        <p className="flex items-center gap-1 truncate text-xs text-zinc-400">
          from {labelOfKey(clip.fromKey)} · click <ClipboardPaste className="inline h-3 w-3" /> Paste on any month
          {clip.mode === 'copy' ? ' (as many as you like)' : ''}
        </p>
      </div>
      <button
        onClick={clear}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-zinc-400 transition hover:bg-white/10 hover:text-white"
        aria-label="Clear clipboard"
        title="Clear (Esc)"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
