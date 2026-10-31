import { useEffect, useMemo, useState } from 'react'
import {
  Ban, Eye, Gift, Infinity as InfinityIcon, KeyRound, Lock, LogIn, LogOut, NotebookPen, RefreshCw, RotateCcw, ShieldAlert, ShieldX, Trash2, UserCheck, X,
  type LucideIcon,
} from 'lucide-react'
import { api, errorText, type LogEntry } from './api'
import { ago, fullDate } from './data'
import { Button, Card, Empty, Segmented, Skeleton, cx } from './ui'
import { PageHead } from './Overview'
import { go } from './router'

const ACTIONS: Record<string, { label: string; icon: LucideIcon; tone: string; kind: 'security' | 'change' | 'view' }> = {
  login: { label: 'Admin signed in', icon: LogIn, tone: 'text-emerald-300 bg-emerald-400/10', kind: 'security' },
  logout: { label: 'Admin locked', icon: Lock, tone: 'text-zinc-300 bg-white/[0.06]', kind: 'security' },
  login_failed: { label: 'Wrong admin password', icon: KeyRound, tone: 'text-amber-300 bg-amber-400/10', kind: 'security' },
  login_locked: { label: 'Sign-in locked (too many tries)', icon: ShieldX, tone: 'text-rose-300 bg-rose-400/10', kind: 'security' },
  view_user: { label: 'Viewed account', icon: Eye, tone: 'text-sky-300 bg-sky-400/10', kind: 'view' },
  grant_lifetime: { label: 'Gave lifetime access', icon: InfinityIcon, tone: 'text-amber-300 bg-amber-400/10', kind: 'change' },
  remove_lifetime: { label: 'Removed lifetime access', icon: X, tone: 'text-zinc-300 bg-white/[0.06]', kind: 'change' },
  grant_free: { label: 'Gave free membership', icon: Gift, tone: 'text-amber-300 bg-amber-400/10', kind: 'change' },
  end_free: { label: 'Ended free membership', icon: X, tone: 'text-zinc-300 bg-white/[0.06]', kind: 'change' },
  reset_trial: { label: 'Started a new trial', icon: RotateCcw, tone: 'text-indigo-300 bg-indigo-400/10', kind: 'change' },
  disable: { label: 'Disabled account', icon: Ban, tone: 'text-rose-300 bg-rose-400/10', kind: 'change' },
  enable: { label: 'Enabled account', icon: UserCheck, tone: 'text-emerald-300 bg-emerald-400/10', kind: 'change' },
  sign_out_everywhere: { label: 'Signed out everywhere', icon: LogOut, tone: 'text-zinc-300 bg-white/[0.06]', kind: 'change' },
  note: { label: 'Edited note', icon: NotebookPen, tone: 'text-zinc-300 bg-white/[0.06]', kind: 'change' },
  delete_account: { label: 'Deleted account', icon: Trash2, tone: 'text-rose-300 bg-rose-400/10', kind: 'change' },
}
const meta = (a: string) => ACTIONS[a] ?? { label: a, icon: ShieldAlert, tone: 'text-zinc-300 bg-white/[0.06]', kind: 'change' as const }

/** A short readable device from a user agent: "Chrome on Windows". */
function device(ua: string | null | undefined) {
  if (!ua) return null
  const b = /Edg\//.test(ua) ? 'Edge' : /OPR\//.test(ua) ? 'Opera' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /Linux/.test(ua) ? 'Linux' : ''
  return os ? `${b} on ${os}` : b
}

export function ActivityRow({ e, compact }: { e: LogEntry; compact?: boolean }) {
  const m = meta(e.action)
  const who = e.email ?? (e.uid ? e.uid.slice(0, 10) : null)
  return (
    <li className={cx('flex items-center gap-3', compact ? 'px-5 py-2.5' : 'px-5 py-3')}>
      <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg', m.tone)}>
        <m.icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-zinc-100">
          {m.label}
          {e.detail && <span className="text-zinc-400"> · {e.detail}</span>}
          {!compact && who && (
            <>
              {' '}
              <button onClick={() => e.uid && go(`/admin/users/${e.uid}`)} className="text-indigo-300 transition hover:text-indigo-200 hover:underline">
                {who}
              </button>
            </>
          )}
        </p>
        {!compact && (e.ip || e.ua) && (
          <p className="truncate text-xs text-zinc-500">
            {[e.ip, device(e.ua)].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>
      <span className="shrink-0 text-xs tabular-nums text-zinc-500" title={fullDate(e.at)}>
        {ago(e.at)}
      </span>
    </li>
  )
}

type Filter = 'all' | 'security' | 'change' | 'view'

export function Activity() {
  const [log, setLog] = useState<LogEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')

  const load = async () => {
    setBusy(true)
    try {
      setLog((await api.get<{ log: LogEntry[] }>('log')).log)
      setError(null)
    } catch (e) {
      setError(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  useEffect(() => void load(), [])

  const list = useMemo(() => (log ?? []).filter((e) => filter === 'all' || meta(e.action).kind === filter), [log, filter])
  const failed24 = (log ?? []).filter((e) => (e.action === 'login_failed' || e.action === 'login_locked') && (e.at ?? 0) > Date.now() - 86_400_000).length

  return (
    <>
      <PageHead
        title="Activity log"
        sub="Every admin sign-in and change, newest first (last 300)."
        actions={
          <Button icon={RefreshCw} busy={busy} onClick={() => void load()}>
            Refresh
          </Button>
        }
      />
      {failed24 > 0 && (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-amber-400/25 bg-amber-500/[0.07] px-4 py-3 text-sm text-amber-100">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
          <p>
            {failed24} wrong admin password attempt{failed24 === 1 ? '' : 's'} in the last 24 hours. If that wasn’t you, change <code>ADMIN_PASSWORD</code> in Vercel: it
            also signs out every admin session.
          </p>
        </div>
      )}
      {error && <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}
      <div className="mb-4">
        <Segmented
          value={filter}
          onChange={setFilter}
          options={[
            { id: 'all', label: 'All' },
            { id: 'change', label: 'Changes' },
            { id: 'security', label: 'Sign-ins' },
            { id: 'view', label: 'Views' },
          ]}
        />
      </div>
      <Card pad={false}>
        {!log ? (
          <div className="space-y-3 p-5">
            {Array.from({ length: 8 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty icon={ShieldAlert} title="Nothing logged yet" />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {list.map((e) => (
              <ActivityRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Card>
    </>
  )
}
