import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Activity as ActivityIcon, ArrowRight, Eye, EyeOff, KeyRound, LayoutDashboard, Loader2, Lock, RefreshCw, Search, ServerOff, ShieldCheck, Users as UsersIcon } from 'lucide-react'
import { useStore } from '../store'
import { Toasts } from '../components/Toasts'
import { toast } from '../toast'
import { AdminError, api, checkSession, errorText, loadUsers, logout, useSession, useUsers } from './api'
import { Avatar, Button, StatusChip, cx } from './ui'
import { displayName } from './data'
import { Overview } from './Overview'
import { Users } from './Users'
import { UserPage } from './UserPage'
import { Activity } from './Activity'
import { Preview } from './Preview'
import { go, useRoute } from './router'

/*
 * Viewing someone's planner loads their data into the app's own store. Point its saving at nothing first, so nothing
 * from here is ever written into this browser's copy of your own plan (and nothing is ever sent to their account:
 * the admin page never starts cloud sync).
 */
useStore.persist.setOptions({ storage: { getItem: () => null, setItem: () => {}, removeItem: () => {} } })

// ---------------------------------------------------------------- routing

type Route = { page: 'overview' | 'users' | 'activity' } | { page: 'user'; uid: string } | { page: 'planner'; uid: string }
function parse(path: string): Route {
  const p = path.split('/').filter(Boolean).slice(1)
  if (p[0] === 'users' && p[1]) return p[2] === 'planner' ? { page: 'planner', uid: p[1] } : { page: 'user', uid: p[1] }
  if (p[0] === 'users') return { page: 'users' }
  if (p[0] === 'activity') return { page: 'activity' }
  return { page: 'overview' }
}

const IDLE_MS = 30 * 60_000

export default function AdminApp() {
  const state = useSession((s) => s.state)
  const expires = useSession((s) => s.expires)

  useEffect(() => {
    document.title = 'Admin · Dizayr'
    const meta = document.createElement('meta')
    meta.name = 'robots'
    meta.content = 'noindex, nofollow'
    document.head.appendChild(meta)
    void checkSession()
  }, [])

  // Signed out when the session runs out, and after 30 minutes without touching anything.
  useEffect(() => {
    if (state !== 'in') return
    let idle = setTimeout(lockIdle, IDLE_MS)
    function lockIdle() {
      void logout()
      toast.info('Locked after 30 minutes without activity.')
    }
    const bump = () => {
      clearTimeout(idle)
      idle = setTimeout(lockIdle, IDLE_MS)
    }
    const events = ['pointerdown', 'keydown', 'scroll', 'mousemove'] as const
    events.forEach((e) => window.addEventListener(e, bump, { passive: true }))
    const end = expires ? setTimeout(() => useSession.setState({ state: 'out', expires: null }), Math.min(expires - Date.now(), 2 ** 31 - 1)) : undefined
    return () => {
      clearTimeout(idle)
      clearTimeout(end)
      events.forEach((e) => window.removeEventListener(e, bump))
    }
  }, [state, expires])

  return (
    <div className="relative min-h-screen bg-[#07080c] text-zinc-100 antialiased">
      {state === 'checking' ? <Splash /> : state === 'in' ? <Signed /> : <Login />}
      <Toasts />
    </div>
  )
}

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-x-0 top-0 h-[520px] overflow-hidden">
      <div className="absolute -top-48 left-1/3 h-[420px] w-[620px] rounded-full bg-indigo-600/15 blur-[120px]" />
      <div className="absolute -top-40 right-0 h-[360px] w-[480px] rounded-full bg-emerald-500/[0.07] blur-[120px]" />
    </div>
  )
}

function Mark({ size = 'h-9 w-9' }: { size?: string }) {
  return (
    <span className={cx('grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/25', size)}>
      <ShieldCheck className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
    </span>
  )
}

function Splash() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Glow />
      <Loader2 className="h-5 w-5 animate-spin text-zinc-500" />
    </div>
  )
}

// ---------------------------------------------------------------- sign in

function Login() {
  const state = useSession((s) => s.state)
  const [pw, setPw] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [lockedUntil, setLockedUntil] = useState<number | null>(null)
  const [, tick] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => input.current?.focus(), [state])
  useEffect(() => {
    if (!lockedUntil) return
    const t = setInterval(() => (Date.now() > lockedUntil ? (setLockedUntil(null), setError(null)) : tick((n) => n + 1)), 1000)
    return () => clearInterval(t)
  }, [lockedUntil])

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!pw || busy || lockedUntil) return
    setBusy(true)
    setError(null)
    try {
      const r = await api.post<{ expires: number }>('login', { password: pw })
      setPw('')
      useSession.setState({ state: 'in', expires: r.expires })
    } catch (err) {
      const x = err as AdminError
      if (x.code === 'wrong_password') {
        const left = Number(x.extra.triesLeft)
        setError(`Wrong password. ${left} ${left === 1 ? 'try' : 'tries'} left before a 15-minute lock.`)
      } else if (x.code === 'locked') {
        setLockedUntil(Number(x.extra.retryAt))
        setError('Too many wrong tries.')
      } else if (x.code !== 'not_configured') setError(errorText(err))
      setPw('')
      input.current?.focus()
    } finally {
      setBusy(false)
    }
  }

  const wait = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)) : 0

  return (
    <div className="relative grid min-h-screen place-items-center px-4 py-10">
      <Glow />
      <div className="animate-pop relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center text-center">
          <Mark size="h-14 w-14" />
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-white">Dizayr Admin</h1>
          <p className="mt-1.5 text-sm text-zinc-500">Restricted area. Every sign-in is recorded.</p>
        </div>

        {state === 'not_configured' || state === 'offline' ? (
          <div className="rounded-3xl border border-amber-400/25 bg-amber-500/[0.06] p-6">
            <div className="flex items-center gap-2 text-amber-200">
              <ServerOff className="h-4 w-4" />
              <p className="text-sm font-semibold">{state === 'offline' ? 'Admin API not reachable' : 'Admin isn’t switched on yet'}</p>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              {state === 'offline' ? (
                <>
                  This page needs the server functions in <code className="text-zinc-200">/api</code>. Open it on the deployed site, or run{' '}
                  <code className="text-zinc-200">vercel dev</code> instead of <code className="text-zinc-200">npm run dev</code>.
                </>
              ) : (
                <>
                  Add <code className="text-zinc-200">ADMIN_PASSWORD</code> (8+ characters) and <code className="text-zinc-200">FIREBASE_SERVICE_ACCOUNT</code> in Vercel →
                  Settings → Environment Variables, then redeploy.
                </>
              )}
            </p>
            <Button className="mt-4 w-full" icon={RefreshCw} onClick={() => void checkSession()}>
              Check again
            </Button>
          </div>
        ) : (
          <form onSubmit={submit} className="rounded-3xl border border-white/[0.08] bg-[#0e1016]/90 p-6 shadow-2xl shadow-black/50 backdrop-blur">
            <label htmlFor="admin-pw" className="text-[13px] font-medium text-zinc-300">
              Admin password
            </label>
            <div className="relative mt-2">
              <KeyRound className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                id="admin-pw"
                ref={input}
                type={show ? 'text' : 'password'}
                value={pw}
                onChange={(e) => setPw(e.target.value)}
                autoComplete="current-password"
                disabled={!!lockedUntil}
                className="h-12 w-full rounded-xl border border-white/10 bg-black/30 pl-10 pr-11 text-[15px] tracking-wide text-white outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/15 disabled:opacity-50"
                placeholder="••••••••••"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white"
                aria-label={show ? 'Hide password' : 'Show password'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && (
              <p className="animate-fade mt-3 rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-[13px] text-rose-200" role="alert">
                {error}
                {wait > 0 && ` Try again in ${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, '0')}.`}
              </p>
            )}
            <Button type="submit" tone="primary" busy={busy} disabled={!pw || !!lockedUntil} className="mt-5 h-11 w-full">
              Unlock <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}
        <p className="mt-6 text-center text-xs text-zinc-600">
          <Lock className="mr-1 inline h-3 w-3" />
          Sessions end after 8 hours, or 30 minutes idle.
        </p>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- signed in

function Signed() {
  const path = useRoute((s) => s.path)
  const route = useMemo(() => parse(path), [path])
  useEffect(() => void loadUsers(), [])

  if (route.page === 'planner') return <Preview uid={route.uid} />
  return (
    <Shell route={route}>
      {route.page === 'overview' && <Overview />}
      {route.page === 'users' && <Users />}
      {route.page === 'activity' && <Activity />}
      {route.page === 'user' && <UserPage key={route.uid} uid={route.uid} />}
    </Shell>
  )
}

const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard, path: '/admin' },
  { id: 'users', label: 'Users', icon: UsersIcon, path: '/admin/users' },
  { id: 'activity', label: 'Activity log', icon: ActivityIcon, path: '/admin/activity' },
] as const

function Shell({ route, children }: { route: Route; children: ReactNode }) {
  const [finder, setFinder] = useState(false)
  const active = route.page === 'user' ? 'users' : route.page
  const count = useUsers((s) => s.users?.length)

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setFinder((f) => !f)
      } else if (e.key === '/' && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault()
        setFinder(true)
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])

  return (
    <>
      <Glow />
      {/* Sidebar (large screens) */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-white/[0.06] bg-[#090a0f]/90 backdrop-blur-xl lg:flex">
        <div className="flex items-center gap-3 px-5 pb-6 pt-6">
          <Mark />
          <div>
            <p className="text-sm font-semibold text-white">Dizayr</p>
            <p className="text-xs text-zinc-500">Admin console</p>
          </div>
        </div>
        <button
          onClick={() => setFinder(true)}
          className="mx-3 mb-4 flex h-9 items-center gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 text-left text-[13px] text-zinc-500 transition hover:border-white/15 hover:text-zinc-300"
        >
          <Search className="h-3.5 w-3.5" />
          <span className="flex-1">Find a user…</span>
          <kbd className="rounded border border-white/10 px-1.5 font-sans text-[10px] text-zinc-500">Ctrl K</kbd>
        </button>
        <nav className="space-y-0.5 px-3">
          {NAV.map((n) => (
            <a
              key={n.id}
              href={n.path}
              onClick={(e) => {
                e.preventDefault()
                go(n.path)
              }}
              className={cx(
                'flex h-10 items-center gap-3 rounded-xl px-3 text-sm font-medium transition',
                active === n.id ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:bg-white/[0.04] hover:text-zinc-100',
              )}
            >
              <n.icon className={cx('h-4 w-4', active === n.id && 'text-indigo-300')} />
              <span className="flex-1">{n.label}</span>
              {n.id === 'users' && count != null && <span className="text-xs tabular-nums text-zinc-500">{count}</span>}
            </a>
          ))}
        </nav>
        <div className="mt-auto border-t border-white/[0.06] p-3">
          <SessionInfo />
        </div>
      </aside>

      {/* Top bar (phones and tablets) */}
      <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07080c]/85 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center gap-3 px-4">
          <Mark size="h-8 w-8" />
          <p className="flex-1 text-sm font-semibold">Admin</p>
          <Button size="sm" tone="subtle" icon={Search} onClick={() => setFinder(true)} aria-label="Find a user" />
          <Button size="sm" tone="subtle" icon={Lock} onClick={() => void logout()} aria-label="Lock" />
        </div>
        <nav className="scrollbar-none flex gap-1 overflow-x-auto px-3 pb-2">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => go(n.path)}
              className={cx('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium', active === n.id ? 'bg-white/[0.08] text-white' : 'text-zinc-400')}
            >
              <n.icon className="h-3.5 w-3.5" /> {n.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="relative lg:pl-64">
        <div className="mx-auto max-w-[1280px] px-4 pb-24 pt-6 sm:px-6 lg:px-10 lg:pt-10">
          <div key={active + (route.page === 'user' ? route.uid : '')} className="animate-page">
            {children}
          </div>
        </div>
      </main>

      {finder && <Finder onClose={() => setFinder(false)} />}
    </>
  )
}

function SessionInfo() {
  const expires = useSession((s) => s.expires)
  const [, tick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])
  const left = expires ? Math.max(0, expires - Date.now()) : 0
  const h = Math.floor(left / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  return (
    <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-40" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-medium text-zinc-200">Secure session</p>
        <p className="text-xs text-zinc-500">
          Ends in {h}h {m}m
        </p>
      </div>
      <Button size="sm" tone="subtle" icon={Lock} onClick={() => void logout()} title="Lock (sign out of admin)">
        Lock
      </Button>
    </div>
  )
}

// ---------------------------------------------------------------- quick find (Ctrl K)

function Finder({ onClose }: { onClose: () => void }) {
  const users = useUsers((s) => s.users)
  const [q, setQ] = useState('')
  const [at, setAt] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])

  const hits = useMemo(() => {
    const t = q.trim().toLowerCase()
    const list = users ?? []
    return (t ? list.filter((u) => [u.name, u.email, u.uid].some((v) => v?.toLowerCase().includes(t))) : [...list].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))).slice(0, 8)
  }, [users, q])

  const open = (uid: string) => {
    onClose()
    go(`/admin/users/${uid}`)
  }

  return (
    <div className="fixed inset-0 z-[90] flex items-start justify-center px-4 pt-[12vh]" role="dialog" aria-modal="true">
      <div className="animate-fade absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="animate-pop relative w-full max-w-xl overflow-hidden rounded-2xl border border-white/10 bg-[#0e1016] shadow-2xl shadow-black/70">
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4">
          <Search className="h-4 w-4 text-zinc-500" />
          <input
            ref={input}
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setAt(0)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') (e.preventDefault(), setAt((i) => Math.min(hits.length - 1, i + 1)))
              else if (e.key === 'ArrowUp') (e.preventDefault(), setAt((i) => Math.max(0, i - 1)))
              else if (e.key === 'Enter' && hits[at]) open(hits[at].uid)
            }}
            placeholder="Search by name, email or UID…"
            className="h-14 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-zinc-600"
          />
          <kbd className="rounded border border-white/10 px-1.5 text-[10px] text-zinc-500">Esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {!users ? (
            <p className="flex items-center gap-2 px-3 py-6 text-sm text-zinc-500">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading users…
            </p>
          ) : hits.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-zinc-500">No one matches “{q}”.</p>
          ) : (
            <>
              {!q && <p className="px-3 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Newest</p>}
              {hits.map((u, i) => (
                <button
                  key={u.uid}
                  onMouseEnter={() => setAt(i)}
                  onClick={() => open(u.uid)}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition', i === at ? 'bg-white/[0.07]' : '')}
                >
                  <Avatar url={u.photo} name={displayName(u)} size="h-8 w-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium text-zinc-100">{displayName(u)}</span>
                    <span className="block truncate text-xs text-zinc-500">{u.email}</span>
                  </span>
                  <StatusChip sub={u} disabled={u.disabled} />
                </button>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
