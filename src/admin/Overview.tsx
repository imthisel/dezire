import { useMemo, useState } from 'react'
import { AlarmClock, ArrowUpRight, BadgeDollarSign, Gift, RefreshCw, Sparkles, UserPlus, Users as UsersIcon, Zap } from 'lucide-react'
import { loadUsers, useUsers, type UserRow } from './api'
import { GROUP, PLAN_PRICE, ago, displayName, groupOf, lastActive, membershipDetail, membershipOf, trialEnds, type Group } from './data'
import { Avatar, Button, Card, Empty, Skeleton, Stat, cx } from './ui'
import { go } from './router'

const DAY = 86_400_000

export function PageHead({ title, sub, actions }: { title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 sm:mb-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-[28px]">{title}</h1>
        {sub && <p className="mt-1 text-sm text-zinc-500">{sub}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Overview() {
  const { users, loading, error, loadedAt } = useUsers()

  const stats = useMemo(() => {
    if (!users) return null
    const now = Date.now()
    const groups: Record<Group, number> = { trial: 0, paying: 0, free: 0, expired: 0 }
    let yearly = 0
    let semi = 0
    for (const u of users) {
      const m = membershipOf(u, now)
      groups[groupOf(m)]++
      if (m === 'paid' && u.plan === 'annual') yearly++
      if (m === 'paid' && u.plan === 'semiannual') semi++
    }
    const week = users.filter((u) => (u.createdAt ?? 0) > now - 7 * DAY).length
    const prevWeek = users.filter((u) => (u.createdAt ?? 0) > now - 14 * DAY && (u.createdAt ?? 0) <= now - 7 * DAY).length
    const active7 = users.filter((u) => (lastActive(u) ?? 0) > now - 7 * DAY).length
    // What paying subscribers bring in a year at today's prices: yearly × $20, 6-month × $15 × 2.
    const arr = yearly * PLAN_PRICE.annual + semi * PLAN_PRICE.semiannual * 2
    const everTried = users.filter((u) => u.trialStartedAt != null).length
    const conversion = everTried ? (groups.paying / everTried) * 100 : 0
    const endingSoon = users
      .filter((u) => membershipOf(u, now) === 'trial' && trialEnds(u)! - now < 2 * DAY)
      .sort((a, b) => trialEnds(a)! - trialEnds(b)!)
    return { groups, week, prevWeek, active7, arr, yearly, semi, conversion, endingSoon }
  }, [users])

  return (
    <>
      <PageHead
        title="Overview"
        sub={loadedAt ? `Live from Firebase · updated ${ago(loadedAt)}` : 'Live from Firebase'}
        actions={
          <Button icon={RefreshCw} busy={loading} onClick={() => void loadUsers(true)}>
            Refresh
          </Button>
        }
      />
      {error && <p className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {stats && users ? (
          <>
            <Stat label="Total users" value={users.length.toLocaleString()} icon={UsersIcon} hint={`${stats.active7} active in the last 7 days`} />
            <Stat
              label="New this week"
              value={stats.week}
              icon={UserPlus}
              accent="text-sky-300 bg-sky-400/10"
              hint={stats.prevWeek ? `${stats.week >= stats.prevWeek ? '+' : ''}${stats.week - stats.prevWeek} vs the week before` : 'First signups this week'}
            />
            <Stat
              label="Paying"
              value={stats.groups.paying}
              icon={BadgeDollarSign}
              accent="text-emerald-300 bg-emerald-400/10"
              hint={`${stats.conversion.toFixed(1)}% of trials converted`}
            />
            <Stat
              label="Yearly revenue"
              value={`$${stats.arr.toLocaleString()}`}
              icon={Zap}
              accent="text-amber-300 bg-amber-400/10"
              hint={`${stats.yearly} yearly · ${stats.semi} six-month`}
            />
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[118px] rounded-2xl" />)
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Card title="Signups · last 30 days" action={users && <span className="text-xs text-zinc-500">{users.filter((u) => (u.createdAt ?? 0) > Date.now() - 30 * DAY).length} total</span>}>
          {users ? <Signups users={users} /> : <Skeleton className="h-48" />}
        </Card>
        <Card title="Membership mix">{stats && users ? <Mix groups={stats.groups} total={users.length} /> : <Skeleton className="h-48" />}</Card>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title={<span className="flex items-center gap-2"><AlarmClock className="h-4 w-4 text-amber-300" /> Trials ending in 48h</span>} pad={false}>
          {!stats ? <ListSkeleton /> : stats.endingSoon.length ? <People list={stats.endingSoon} right={(u) => membershipDetail(u)} /> : <Empty icon={Sparkles} title="Nothing ending soon" />}
        </Card>
        <Card title="Newest users" pad={false} action={<SeeAll />}>
          {!users ? <ListSkeleton /> : <People list={[...users].sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0)).slice(0, 6)} right={(u) => ago(u.createdAt)} />}
        </Card>
        <Card title="Recently active" pad={false} action={<SeeAll />}>
          {!users ? <ListSkeleton /> : <People list={[...users].sort((a, b) => (lastActive(b) ?? 0) - (lastActive(a) ?? 0)).slice(0, 6)} right={(u) => ago(lastActive(u))} />}
        </Card>
      </div>
    </>
  )
}

const SeeAll = () => (
  <button onClick={() => go('/admin/users')} className="inline-flex items-center gap-1 text-xs font-medium text-zinc-400 transition hover:text-white">
    All users <ArrowUpRight className="h-3 w-3" />
  </button>
)

function ListSkeleton() {
  return (
    <div className="space-y-3 p-5">
      {Array.from({ length: 4 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  )
}

function People({ list, right }: { list: UserRow[]; right: (u: UserRow) => string }) {
  return (
    <ul className="divide-y divide-white/[0.05]">
      {list.map((u) => (
        <li key={u.uid}>
          <button onClick={() => go(`/admin/users/${u.uid}`)} className="flex w-full items-center gap-3 px-5 py-3 text-left transition hover:bg-white/[0.03]">
            <Avatar url={u.photo} name={displayName(u)} size="h-8 w-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-zinc-100">{displayName(u)}</span>
              <span className="block truncate text-xs text-zinc-500">{u.email}</span>
            </span>
            <span className="shrink-0 text-xs tabular-nums text-zinc-500">{right(u)}</span>
          </button>
        </li>
      ))}
    </ul>
  )
}

/** One bar per day; hovering a day shows its count and date. */
function Signups({ users }: { users: UserRow[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const days = useMemo(() => {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const first = start.getTime() - 29 * DAY
    const out = Array.from({ length: 30 }, (_, i) => ({ t: first + i * DAY, n: 0 }))
    for (const u of users) {
      const i = Math.floor(((u.createdAt ?? 0) - first) / DAY)
      if (i >= 0 && i < 30) out[i].n++
    }
    return out
  }, [users])
  const max = Math.max(1, ...days.map((d) => d.n))
  // A round top for the axis: 1, 2, 5, 10, 20…
  const top = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((s) => s >= max) ?? max
  const label = (t: number) => new Date(t).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const h = hover != null ? days[hover] : null

  return (
    <div>
      <div className="mb-3 h-5 text-sm">
        {h ? (
          <span className="text-zinc-300">
            <span className="font-semibold tabular-nums text-white">{h.n}</span> signup{h.n === 1 ? '' : 's'} on {label(h.t)}
          </span>
        ) : (
          <span className="text-zinc-500">Hover a day for details</span>
        )}
      </div>
      <div className="relative flex h-44 gap-3">
        {/* y axis */}
        <div className="flex flex-col justify-between pb-6 text-right text-[11px] tabular-nums text-zinc-600">
          <span>{top}</span>
          <span>{top % 2 ? '' : top / 2}</span>
          <span>0</span>
        </div>
        <div className="relative flex-1">
          <div className="absolute inset-x-0 top-0 border-t border-dashed border-white/[0.06]" />
          <div className="absolute inset-x-0 top-[calc(50%-12px)] border-t border-dashed border-white/[0.06]" />
          <div className="absolute inset-x-0 bottom-6 border-t border-white/10" />
          <div className="absolute inset-x-0 bottom-6 top-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
            {days.map((d, i) => (
              <div key={d.t} className="flex h-full flex-1 items-end" onMouseEnter={() => setHover(i)}>
                <div
                  className={cx('w-full rounded-t-[4px] transition-[opacity,height] duration-300', hover != null && hover !== i && 'opacity-40')}
                  style={{ height: d.n ? `${(d.n / top) * 100}%` : '2px', background: d.n ? '#6366f1' : 'rgba(255,255,255,0.06)' }}
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-x-0 bottom-0 flex justify-between text-[11px] text-zinc-600">
            <span>{label(days[0].t)}</span>
            <span>{label(days[14].t)}</span>
            <span>Today</span>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Where everyone stands: one bar split by group (2px gaps), plus a labelled legend with counts. */
function Mix({ groups, total }: { groups: Record<Group, number>; total: number }) {
  const order: Group[] = ['trial', 'paying', 'free', 'expired']
  const [hover, setHover] = useState<Group | null>(null)
  if (!total) return <Empty icon={Gift} title="No users yet" />
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full">
        {order
          .filter((g) => groups[g])
          .map((g) => (
            <div
              key={g}
              onMouseEnter={() => setHover(g)}
              onMouseLeave={() => setHover(null)}
              title={`${GROUP[g].label}: ${groups[g]}`}
              className={cx('h-full transition-opacity first:rounded-l-full last:rounded-r-full', hover && hover !== g && 'opacity-40')}
              style={{ width: `${(groups[g] / total) * 100}%`, background: GROUP[g].hex }}
            />
          ))}
      </div>
      <ul className="mt-6 space-y-1">
        {order.map((g) => (
          <li
            key={g}
            onMouseEnter={() => setHover(g)}
            onMouseLeave={() => setHover(null)}
            className={cx('flex items-center gap-3 rounded-xl px-2 py-2 transition', hover === g && 'bg-white/[0.04]')}
          >
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: GROUP[g].hex }} />
            <span className="flex-1 text-sm text-zinc-300">{GROUP[g].label}</span>
            <span className="text-sm font-semibold tabular-nums text-white">{groups[g]}</span>
            <span className="w-12 text-right text-xs tabular-nums text-zinc-500">{((groups[g] / total) * 100).toFixed(0)}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 border-t border-white/[0.05] pt-4 text-xs text-zinc-500">
        Lifetime access and free memberships you give from a user’s page count as Free.
      </p>
    </div>
  )
}
