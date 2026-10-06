import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Cake, Check, CloudOff, Loader2, LogOut } from 'lucide-react'
import { signOut, useCloud, type SaveStatus } from '../cloud'
import { toast } from '../toast'
import { BirthdayInput } from './Birthday'

const STATUS: Record<SaveStatus, { label: string; cls: string; icon: typeof Check; spin?: boolean }> = {
  saved: { label: 'Saved', cls: 'text-emerald-300', icon: Check },
  saving: { label: 'Saving…', cls: 'text-zinc-400', icon: Loader2, spin: true },
  offline: { label: 'Offline · will sync', cls: 'text-amber-300', icon: CloudOff },
  error: { label: 'Not saved', cls: 'text-red-300', icon: AlertCircle },
}

export function SaveIndicator() {
  const status = useCloud((s) => s.status)
  const st = STATUS[status]
  return (
    <span className={`inline-flex h-9 items-center gap-1.5 px-1 text-xs font-medium ${st.cls}`} title="Changes save to your Google account automatically">
      <st.icon className={`h-3.5 w-3.5 ${st.spin ? 'animate-spin' : ''}`} strokeWidth={2.5} />
      <span className="hidden sm:inline">{st.label}</span>
    </span>
  )
}

export function AccountMenu() {
  const user = useCloud((s) => s.user)
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    window.addEventListener('mousedown', close)
    window.addEventListener('keydown', esc)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('keydown', esc)
    }
  }, [open])

  if (!user) return null
  const name = user.displayName || user.email || 'Account'

  return (
    <div ref={root} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Account"
        aria-expanded={open}
        className={`grid h-9 w-9 place-items-center overflow-hidden rounded-full border transition ${
          open ? 'border-indigo-400/60 ring-2 ring-indigo-500/30' : 'border-white/10 hover:border-white/25'
        }`}
      >
        <Avatar url={user.photoURL} name={name} />
      </button>
      {open && (
        <div className="animate-fade absolute right-0 top-11 z-50 w-72 overflow-hidden rounded-2xl border border-white/10 bg-[#0e1016] shadow-2xl shadow-black/60">
          <div className="flex items-center gap-3 border-b border-white/[0.06] p-4">
            <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full border border-white/10">
              <Avatar url={user.photoURL} name={name} />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">{user.displayName || 'Signed in'}</p>
              <p className="truncate text-xs text-zinc-500">{user.email}</p>
            </div>
          </div>
          <div className="border-b border-white/[0.06] p-4">
            <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-zinc-400">
              <Cake className="h-3.5 w-3.5 text-pink-300" /> Birthday
              <span className="font-normal text-zinc-600">· shows your age on your birth month</span>
            </p>
            <BirthdayInput />
          </div>
          <button
            onClick={async () => {
              setOpen(false)
              await signOut()
              toast.info('Signed out.')
            }}
            className="flex w-full items-center gap-2.5 px-4 py-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      )}
    </div>
  )
}

function Avatar({ url, name }: { url: string | null; name: string }) {
  const [broken, setBroken] = useState(false)
  if (url && !broken) {
    return <img src={url} alt="" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="h-full w-full object-cover" />
  }
  return (
    <span className="grid h-full w-full place-items-center bg-gradient-to-br from-indigo-500 to-emerald-500 text-sm font-semibold text-white">
      {name.charAt(0).toUpperCase()}
    </span>
  )
}
