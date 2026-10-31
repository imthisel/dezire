import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ArrowLeft, Ban, CalendarDays, CalendarPlus, Check, Download, ExternalLink, FileJson, Gem, Gift, History, Infinity as InfinityIcon, LogOut,
  Mail, MonitorPlay, NotebookPen, Receipt, RefreshCw, RotateCcw, Rocket, ShieldAlert, Target, Trash2, UserCheck, X,
} from 'lucide-react'
import { toast } from '../toast'
import { api, errorText, patchUser, type UserDetail } from './api'
import {
  MEMBERSHIP_LABEL, PLAN_LABEL, ago, displayName, download, fullDate, goalsSummary, lastActive, membershipDetail, membershipOf, modeSummary, readPlan,
  shortDate, trialEnds,
} from './data'
import { Avatar, Button, Card, Confirm, CopyButton, Dialog, Empty, Skeleton, StatusChip, Tabs, cx } from './ui'
import { ActivityRow } from './Activity'
import { DreamsTab, GoalsTab, MoneyTab, NotesTab, RawTab, ScheduleTab, SpendingTab } from './PlanTabs'
import { fmt } from '../lib/money'
import { go } from './router'

const TABS = ['overview', 'dreams', 'goals', 'money', 'spending', 'calendar', 'notes', 'raw'] as const
type Tab = (typeof TABS)[number]
/** The tab in the address (?tab=dreams), so a tab can be linked to and survives a reload. */
const tabFromUrl = (): Tab => {
  const t = new URLSearchParams(location.search).get('tab')
  return (TABS as readonly string[]).includes(t ?? '') ? (t as Tab) : 'overview'
}

export function UserPage({ uid }: { uid: string }) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tab, setTabState] = useState<Tab>(tabFromUrl)
  const setTab = (t: Tab) => {
    setTabState(t)
    history.replaceState(null, '', t === 'overview' ? location.pathname : `${location.pathname}?tab=${t}`)
  }

  const load = useCallback(async () => {
    try {
      const r = await api.get<{ user: UserDetail }>('user', { uid })
      setUser(r.user)
      setError(null)
      const { data: _data, log: _log, ...row } = r.user
      patchUser(uid, row)
    } catch (e) {
      setError(errorText(e))
    }
  }, [uid])
  useEffect(() => void load(), [load])

  const plan = useMemo(() => readPlan(user?.data ?? null), [user])
  const counts = useMemo(() => {
    if (!plan) return null
    return {
      dreams: plan.modes.reduce((s, m) => s + Object.values(m.months).reduce((n, mo) => n + mo.items.length, 0), 0),
      goals: goalsSummary(plan.goals).total,
      money: plan.sources.length,
      spending: plan.expenses.length,
      calendar: plan.tasks.length,
    }
  }, [plan])

  if (error)
    return (
      <div>
        <BackLink />
        <Card>
          <Empty icon={ShieldAlert} title="Couldn’t open this account" text={error} />
        </Card>
      </div>
    )
  if (!user) return <Loading />

  const name = displayName(user)

  return (
    <>
      <BackLink />
      {/* Header */}
      <div className="mb-6 flex flex-col gap-5 sm:flex-row sm:items-center">
        <Avatar url={user.photo} name={name} size="h-16 w-16 text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-2xl font-semibold tracking-tight text-white">{name}</h1>
            <StatusChip sub={user} disabled={user.disabled} />
          </div>
          <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-zinc-400">
            {user.email ? (
              <>
                <a href={`mailto:${user.email}`} className="min-w-0 break-all transition hover:text-white">
                  {user.email}
                </a>
                <CopyButton text={user.email} label="Copy email" />
              </>
            ) : (
              <span>No email</span>
            )}
            <span className="text-zinc-700">·</span>
            <span>Joined {shortDate(user.createdAt)}</span>
            <span className="text-zinc-700">·</span>
            <span>Active {ago(lastActive(user))}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={RefreshCw} onClick={() => void load()} aria-label="Reload" title="Reload" />
          <Button icon={Download} disabled={!user.data} onClick={() => download(`dizayr-${(user.email ?? uid).replace(/[^\w.-]+/g, '_')}-${new Date().toISOString().slice(0, 10)}.json`, user.data)}>
            Export
          </Button>
          <Button tone="primary" icon={MonitorPlay} disabled={!user.data} onClick={() => go(`/admin/users/${uid}/planner`)}>
            View their planner
          </Button>
        </div>
      </div>

      <Tabs<Tab>
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'overview', label: 'Overview', icon: UserCheck },
          { id: 'dreams', label: 'Dreams & items', icon: Gem, count: counts?.dreams },
          { id: 'goals', label: 'Goals', icon: Target, count: counts?.goals },
          { id: 'money', label: 'Money plans', icon: Rocket, count: counts?.money },
          { id: 'spending', label: 'Spending', icon: Receipt, count: counts?.spending },
          { id: 'calendar', label: 'Calendar', icon: CalendarDays, count: counts?.calendar },
          { id: 'notes', label: 'Notes', icon: NotebookPen },
          { id: 'raw', label: 'Raw data', icon: FileJson },
        ]}
      />

      <div className="mt-6">
        {tab === 'overview' && <OverviewTab user={user} reload={load} />}
        {tab !== 'overview' && !plan && (
          <Card>
            <Empty icon={Gem} title="No plan saved yet" text="This person signed in but hasn’t saved anything in the planner (or their trial ended before they did)." />
          </Card>
        )}
        {plan && tab === 'dreams' && <DreamsTab plan={plan} />}
        {plan && tab === 'goals' && <GoalsTab plan={plan} />}
        {plan && tab === 'money' && <MoneyTab plan={plan} />}
        {plan && tab === 'spending' && <SpendingTab plan={plan} />}
        {plan && tab === 'calendar' && <ScheduleTab plan={plan} />}
        {plan && tab === 'notes' && <NotesTab plan={plan} />}
        {tab === 'raw' && user.data && <RawTab data={user.data} />}
      </div>
    </>
  )
}

function BackLink() {
  return (
    <button onClick={() => (history.length > 1 ? history.back() : go('/admin/users'))} className="mb-5 inline-flex items-center gap-1.5 text-sm text-zinc-500 transition hover:text-white">
      <ArrowLeft className="h-4 w-4" /> Users
    </button>
  )
}

function Loading() {
  return (
    <div>
      <Skeleton className="mb-6 h-4 w-20" />
      <div className="mb-8 flex items-center gap-5">
        <Skeleton className="h-16 w-16 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-6 w-56" />
          <Skeleton className="h-4 w-80" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------- overview tab

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 py-2.5">
      <dt className="shrink-0 text-[13px] text-zinc-500">{label}</dt>
      <dd className="min-w-0 break-words text-right text-[13px] text-zinc-200">{children}</dd>
    </div>
  )
}

function OverviewTab({ user, reload }: { user: UserDetail; reload: () => Promise<void> }) {
  const plan = useMemo(() => readPlan(user.data), [user.data])
  const main = plan ? modeSummary(plan.modes[0]) : null
  const goals = plan ? goalsSummary(plan.goals) : null
  const sym = plan?.currency.main.symbol ?? '₱'

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <div className="min-w-0 space-y-4">
        {/* Plan at a glance */}
        <Card title="Their plan at a glance">
          {!plan || !main || !goals ? (
            <p className="text-sm text-zinc-500">Nothing saved yet.</p>
          ) : (
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.06] sm:grid-cols-3">
              <Mini label="Dreams & items" value={main.dreams} sub={`${fmt(main.dreamsValue, sym, true)} in total`} />
              <Mini label="Net worth by 2040" value={fmt(main.netWorth, sym, true)} sub="Main plan" />
              <Mini label="Goals done" value={`${goals.done}/${goals.total}`} sub={goals.total ? `${Math.round((goals.done / goals.total) * 100)}% complete` : 'None set'} />
              <Mini label="Months planned" value={main.monthsPlanned} sub="of 180 (2026–2040)" />
              <Mini label="Money plans" value={plan.sources.length} sub={`${plan.sources.filter((s) => s.stage === 'running').length} already earning`} />
              <Mini label="Modes" value={plan.modes.length} sub={plan.modes.map((m) => m.name).join(', ')} />
            </div>
          )}
        </Card>

        <Card title="Account">
          <dl className="divide-y divide-white/[0.05]">
            <Fact label="Name">{user.name ?? '—'}</Fact>
            <Fact label="Email">
              <span className="inline-flex items-center gap-1">
                {user.email ?? '—'}
                {user.email && (user.emailVerified ? <Check className="h-3.5 w-3.5 text-emerald-400" aria-label="Verified" /> : <span className="text-xs text-zinc-500">(unverified)</span>)}
              </span>
            </Fact>
            <Fact label="User ID">
              <span className="inline-flex min-w-0 items-center gap-1 font-mono text-xs">
                <span className="break-all">{user.uid}</span>
                <CopyButton text={user.uid} label="Copy user ID" />
              </span>
            </Fact>
            <Fact label="Signs in with">{user.providers.map((p) => (p === 'google.com' ? 'Google' : p)).join(', ') || '—'}</Fact>
            <Fact label="Joined">{fullDate(user.createdAt)}</Fact>
            <Fact label="Last sign-in">{fullDate(user.lastSignIn)}</Fact>
            <Fact label="Last saved their plan">{fullDate(user.lastSaved)}</Fact>
            {plan?.birthday && <Fact label="Birthday">{new Date(`${plan.birthday}T00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Fact>}
            {plan && <Fact label="Currency">{`${plan.currency.main.symbol} ${plan.currency.main.code}`}</Fact>}
          </dl>
        </Card>

        <NoteCard user={user} />
      </div>

      <div className="min-w-0 space-y-4">
        <MembershipCard user={user} reload={reload} />
        <AccountControls user={user} reload={reload} />
        <Card title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-zinc-400" /> Admin history</span>} pad={false}>
          {user.log.length ? (
            <ul className="max-h-80 divide-y divide-white/[0.05] overflow-y-auto">
              {user.log.slice(0, 30).map((e) => (
                <ActivityRow key={e.id} e={e} compact />
              ))}
            </ul>
          ) : (
            <p className="px-5 py-6 text-sm text-zinc-500">No admin actions yet.</p>
          )}
        </Card>
      </div>
    </div>
  )
}

function Mini({ label, value, sub }: { label: string; value: ReactNode; sub?: string }) {
  return (
    <div className="bg-[#0e1016] p-4">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-lg font-semibold tabular-nums text-white">{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-zinc-500">{sub}</p>}
    </div>
  )
}

function NoteCard({ user }: { user: UserDetail }) {
  const [note, setNote] = useState(user.note)
  const [busy, setBusy] = useState(false)
  const dirty = note !== user.note
  const save = async () => {
    setBusy(true)
    try {
      await api.post('note', { uid: user.uid, note })
      user.note = note
      patchUser(user.uid, { note })
      toast.success('Note saved.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card
      title={<span className="flex items-center gap-2"><NotebookPen className="h-4 w-4 text-amber-300" /> Private note</span>}
      action={<span className="text-xs text-zinc-600">Only admins see this</span>}
    >
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && dirty && void save()}
        rows={4}
        maxLength={5000}
        placeholder="e.g. Friend from school, gave 3 months free on Oct 31. Asked for a CSV export feature."
        className="w-full resize-y rounded-xl border border-white/[0.08] bg-black/25 px-3.5 py-3 text-sm leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-amber-400/40 focus:ring-4 focus:ring-amber-500/10"
      />
      <div className="mt-3 flex items-center justify-end gap-2">
        {dirty && (
          <Button size="sm" tone="subtle" onClick={() => setNote(user.note)}>
            Discard
          </Button>
        )}
        <Button size="sm" tone="primary" disabled={!dirty} busy={busy} onClick={() => void save()}>
          Save note
        </Button>
      </div>
    </Card>
  )
}

// ---------------------------------------------------------------- membership

/** Runs an admin action, then reloads the person and says how it went. */
function useAction(uid: string, reload: () => Promise<void>) {
  const [busy, setBusy] = useState<string | null>(null)
  const run = async (action: string, body: Record<string, unknown>, done: string) => {
    setBusy(action + JSON.stringify(body))
    try {
      await api.post(action, { uid, ...body })
      await reload()
      toast.success(done)
    } catch (e) {
      toast.error(errorText(e))
      throw e
    } finally {
      setBusy(null)
    }
  }
  return { busy, run, is: (action: string, body: Record<string, unknown> = {}) => busy === action + JSON.stringify(body) }
}

function MembershipCard({ user, reload }: { user: UserDetail; reload: () => Promise<void> }) {
  const { run, is } = useAction(user.uid, reload)
  const [giving, setGiving] = useState(false)
  const [ask, setAsk] = useState<null | 'lifetime' | 'unlifetime' | 'trial' | 'endComp'>(null)
  const m = membershipOf(user)
  const now = Date.now()

  const accent =
    m === 'lifetime' || m === 'comp' ? 'from-amber-500/15' : m === 'paid' ? 'from-emerald-500/15' : m === 'trial' || m === 'new' ? 'from-indigo-500/15' : 'from-rose-500/15'

  return (
    <Card title="Membership" pad={false}>
      <div className={cx('bg-gradient-to-br to-transparent px-5 py-5', accent)}>
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Status</p>
        <p className="mt-1 text-xl font-semibold text-white">{MEMBERSHIP_LABEL[m]}</p>
        <p className="mt-0.5 text-sm text-zinc-400">{membershipDetail(user)}</p>
      </div>
      <dl className="divide-y divide-white/[0.05] px-5">
        <Fact label="Free trial">{user.trialStartedAt ? `${shortDate(user.trialStartedAt)} → ${shortDate(trialEnds(user))}` : 'Not started'}</Fact>
        <Fact label="Paid plan">
          {user.plan ? `${PLAN_LABEL[user.plan]}${user.status ? ` · ${user.status}` : ''}${user.testMode ? ' (test)' : ''}` : 'None'}
        </Fact>
        {user.accessUntil && <Fact label="Paid until">{shortDate(user.accessUntil)}</Fact>}
        {(user.compUntil ?? 0) > now && <Fact label="Free until">{shortDate(user.compUntil)}</Fact>}
        <Fact label="Lifetime">{user.lifetime ? 'Yes' : 'No'}</Fact>
        {user.billingEmail && user.billingEmail !== user.email && <Fact label="Billing email">{user.billingEmail}</Fact>}
      </dl>
      <div className="grid grid-cols-2 gap-2 border-t border-white/[0.06] p-4">
        <Button icon={Gift} onClick={() => setGiving(true)} className="col-span-2" tone="primary">
          {(user.compUntil ?? 0) > now ? 'Add more free time' : 'Give free membership'}
        </Button>
        {user.lifetime ? (
          <Button icon={X} onClick={() => setAsk('unlifetime')} busy={is('lifetime', { on: false })}>
            Remove lifetime
          </Button>
        ) : (
          <Button icon={InfinityIcon} onClick={() => setAsk('lifetime')} busy={is('lifetime', { on: true })}>
            Make lifetime
          </Button>
        )}
        <Button icon={RotateCcw} onClick={() => setAsk('trial')} busy={is('trial')}>
          New 7-day trial
        </Button>
        {(user.compUntil ?? 0) > now && (
          <Button icon={X} className="col-span-2" tone="subtle" onClick={() => setAsk('endComp')} busy={is('endComp')}>
            End free membership now
          </Button>
        )}
      </div>
      {user.plan && (
        <p className="border-t border-white/[0.06] px-5 py-3 text-xs leading-relaxed text-zinc-500">
          Paid subscriptions are billed by Lemon Squeezy. To refund or cancel one, use{' '}
          <a href="https://app.lemonsqueezy.com/subscriptions" target="_blank" rel="noreferrer" className="inline-flex items-center gap-0.5 text-zinc-300 hover:text-white">
            Lemon Squeezy → Subscriptions <ExternalLink className="h-3 w-3" />
          </a>
          .
        </p>
      )}

      {giving && <GiveFree user={user} onClose={() => setGiving(false)} run={run} />}
      {ask === 'lifetime' && (
        <Confirm
          title="Give lifetime access?"
          text={<>{displayName(user)} will be able to use Dizayr free, forever, with unlimited modes. You can take it back any time.</>}
          confirmLabel="Make lifetime"
          onConfirm={() => run('lifetime', { on: true }, 'Lifetime access given.')}
          onClose={() => setAsk(null)}
        />
      )}
      {ask === 'unlifetime' && (
        <Confirm
          title="Remove lifetime access?"
          text="They’ll go back to whatever else they have: a paid plan, free time, a trial, or no access."
          confirmLabel="Remove lifetime"
          danger
          onConfirm={() => run('lifetime', { on: false }, 'Lifetime access removed.')}
          onClose={() => setAsk(null)}
        />
      )}
      {ask === 'trial' && (
        <Confirm
          title="Start a new 7-day trial?"
          text="Their free trial restarts from now and lasts 7 days. Handy when someone signed up and never got to try it."
          confirmLabel="Start new trial"
          onConfirm={() => run('trial', {}, 'New 7-day trial started.')}
          onClose={() => setAsk(null)}
        />
      )}
      {ask === 'endComp' && (
        <Confirm
          title="End their free membership?"
          text="The free time you gave stops right away. Anything else they have (paid plan, trial, lifetime) still counts."
          confirmLabel="End it now"
          danger
          onConfirm={() => run('endComp', {}, 'Free membership ended.')}
          onClose={() => setAsk(null)}
        />
      )}
    </Card>
  )
}

const PRESETS = [
  { days: 7, label: '1 week' },
  { days: 30, label: '1 month' },
  { days: 90, label: '3 months' },
  { days: 180, label: '6 months' },
  { days: 365, label: '1 year' },
  { days: 730, label: '2 years' },
]

function GiveFree({ user, onClose, run }: { user: UserDetail; onClose: () => void; run: (a: string, b: Record<string, unknown>, done: string) => Promise<void> }) {
  const [days, setDays] = useState(30)
  const [custom, setCustom] = useState('')
  const [busy, setBusy] = useState(false)
  const n = custom ? Math.floor(Number(custom)) : days
  const valid = Number.isInteger(n) && n >= 1 && n <= 3650
  const from = Math.max(Date.now(), user.compUntil ?? 0)
  const until = from + n * 86_400_000
  const go = async () => {
    setBusy(true)
    try {
      await run('comp', { days: n }, `Free membership until ${shortDate(until)}.`)
      onClose()
    } catch {
      setBusy(false)
    }
  }
  return (
    <Dialog
      title={<span className="flex items-center gap-2"><Gift className="h-4 w-4 text-amber-300" /> Give free membership</span>}
      onClose={onClose}
      footer={
        <>
          <Button onClick={onClose}>Cancel</Button>
          <Button tone="primary" icon={CalendarPlus} disabled={!valid} busy={busy} onClick={() => void go()}>
            Give {valid ? (n === 1 ? '1 day' : `${n} days`) : ''}
          </Button>
        </>
      }
    >
      <p className="text-zinc-400">Full access with unlimited modes, no payment needed. {user.compUntil && user.compUntil > Date.now() ? 'Added on top of the free time they already have.' : ''}</p>
      <div className="mt-4 grid grid-cols-3 gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            onClick={() => {
              setDays(p.days)
              setCustom('')
            }}
            className={cx(
              'h-11 rounded-xl border text-sm font-medium transition',
              !custom && days === p.days ? 'border-amber-400/60 bg-amber-500/15 text-amber-100' : 'border-white/10 text-zinc-300 hover:border-white/20 hover:bg-white/[0.04]',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>
      <label className="mt-3 flex items-center gap-2">
        <span className="text-[13px] text-zinc-500">Or exactly</span>
        <input
          value={custom}
          onChange={(e) => setCustom(e.target.value.replace(/\D/g, '').slice(0, 4))}
          inputMode="numeric"
          placeholder="45"
          className="h-9 w-20 rounded-lg border border-white/10 bg-black/30 px-2.5 text-center text-sm tabular-nums text-white outline-none focus:border-amber-400/50"
        />
        <span className="text-[13px] text-zinc-500">days</span>
      </label>
      {valid && (
        <p className="mt-4 rounded-xl border border-amber-400/15 bg-amber-500/[0.06] px-3.5 py-2.5 text-[13px] text-amber-100">
          Free until <span className="font-semibold">{new Date(until).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
        </p>
      )}
    </Dialog>
  )
}

// ---------------------------------------------------------------- account controls

function AccountControls({ user, reload }: { user: UserDetail; reload: () => Promise<void> }) {
  const { run, is } = useAction(user.uid, reload)
  const [ask, setAsk] = useState<null | 'disable' | 'revoke' | 'delete'>(null)
  return (
    <Card title={<span className="flex items-center gap-2"><ShieldAlert className="h-4 w-4 text-rose-300" /> Account controls</span>} pad={false}>
      <div className="divide-y divide-white/[0.05]">
        <Control
          title={user.disabled ? 'Account is disabled' : 'Disable account'}
          text={user.disabled ? 'They can’t sign in. Their data is kept.' : 'Blocks sign-in and signs them out. Their data is kept.'}
        >
          {user.disabled ? (
            <Button size="sm" icon={UserCheck} busy={is('disable', { on: false })} onClick={() => void run('disable', { on: false }, 'Account enabled.').catch(() => {})}>
              Enable
            </Button>
          ) : (
            <Button size="sm" tone="danger" icon={Ban} onClick={() => setAsk('disable')}>
              Disable
            </Button>
          )}
        </Control>
        <Control title="Sign out everywhere" text="Ends their sessions on every device (within about an hour).">
          <Button size="sm" icon={LogOut} busy={is('revoke')} onClick={() => setAsk('revoke')}>
            Sign out
          </Button>
        </Control>
        {user.email && (
          <Control title="Email them" text={`Opens your mail app to ${user.email}.`}>
            <a href={`mailto:${user.email}?subject=${encodeURIComponent('About your Dizayr account')}`} className="inline-flex h-8 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-[13px] font-medium text-zinc-200 transition hover:bg-white/[0.07]">
              <Mail className="h-4 w-4" /> Write
            </a>
          </Control>
        )}
        <Control title="Delete account" text="Removes the sign-in, their whole plan and membership. Can’t be undone." danger>
          <Button size="sm" tone="danger" icon={Trash2} onClick={() => setAsk('delete')}>
            Delete
          </Button>
        </Control>
      </div>

      {ask === 'disable' && (
        <Confirm
          title={`Disable ${displayName(user)}?`}
          text="They’ll be signed out and can’t sign back in until you enable the account again. Nothing is deleted."
          confirmLabel="Disable account"
          danger
          onConfirm={() => run('disable', { on: true }, 'Account disabled.')}
          onClose={() => setAsk(null)}
        />
      )}
      {ask === 'revoke' && (
        <Confirm
          title="Sign them out everywhere?"
          text="Every device they’re signed in on has to sign in again. Their data isn’t touched."
          confirmLabel="Sign out everywhere"
          onConfirm={() => run('revoke', {}, 'Signed out on every device.')}
          onClose={() => setAsk(null)}
        />
      )}
      {ask === 'delete' && (
        <Confirm
          title="Delete this account for good?"
          text={
            <>
              This deletes <span className="font-semibold text-white">{displayName(user)}</span>’s sign-in, every dream, goal, expense and note they saved, and their membership.
              {user.plan && (user.accessUntil ?? 0) > Date.now() && (
                <span className="mt-2 block text-amber-200">They still have a paid subscription: cancel it in Lemon Squeezy too, or they’ll keep being charged.</span>
              )}
            </>
          }
          typeToConfirm={user.email ?? user.uid}
          confirmLabel="Delete forever"
          danger
          onConfirm={async (typed) => {
            try {
              await api.post('delete', { uid: user.uid, confirm: typed })
              patchUser(user.uid, null)
              toast.success('Account deleted.')
              go('/admin/users')
            } catch (e) {
              toast.error(errorText(e))
              throw e
            }
          }}
          onClose={() => setAsk(null)}
        />
      )}
    </Card>
  )
}

function Control({ title, text, children, danger }: { title: string; text: string; children: ReactNode; danger?: boolean }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5">
      <div className="min-w-0 flex-1">
        <p className={cx('text-sm font-medium', danger ? 'text-rose-200' : 'text-zinc-100')}>{title}</p>
        <p className="mt-0.5 text-xs text-zinc-500">{text}</p>
      </div>
      {children}
    </div>
  )
}

