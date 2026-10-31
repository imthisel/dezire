import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ChevronRight, Download, RefreshCw, Search, StickyNote, UserX, Users as UsersIcon } from 'lucide-react'
import { loadUsers, useUsers, type UserRow } from './api'
import { ago, displayName, download, groupOf, lastActive, membershipDetail, membershipOf, shortDate, usersCsv, type Group } from './data'
import { Avatar, Button, Empty, Segmented, Skeleton, StatusChip, cx } from './ui'
import { PageHead } from './Overview'
import { go } from './router'

type Filter = 'all' | Group | 'disabled'
type SortKey = 'joined' | 'active' | 'name' | 'status'
const PAGE = 50

const STATUS_ORDER = { lifetime: 0, comp: 1, paid: 2, trial: 3, new: 4, expired: 5 }

export function Users() {
  const { users, loading, error } = useUsers()
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({ key: 'joined', desc: true })
  const [shown, setShown] = useState(PAGE)

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, trial: 0, paying: 0, free: 0, expired: 0, disabled: 0 }
    for (const u of users ?? []) {
      c.all++
      if (u.disabled) c.disabled++
      else c[groupOf(membershipOf(u))]++
    }
    return c
  }, [users])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    const out = (users ?? []).filter((u) => {
      if (filter === 'disabled' ? !u.disabled : filter !== 'all' && (u.disabled || groupOf(membershipOf(u)) !== filter)) return false
      return !t || [u.name, u.email, u.uid, u.note].some((v) => v?.toLowerCase().includes(t))
    })
    const val = (u: UserRow): number | string =>
      sort.key === 'joined' ? (u.createdAt ?? 0) : sort.key === 'active' ? (lastActive(u) ?? 0) : sort.key === 'name' ? displayName(u).toLowerCase() : STATUS_ORDER[membershipOf(u)]
    out.sort((a, b) => {
      const x = val(a)
      const y = val(b)
      const c = x < y ? -1 : x > y ? 1 : 0
      return sort.desc ? -c : c
    })
    return out
  }, [users, q, filter, sort])

  const setKey = (key: SortKey) => setSort((s) => ({ key, desc: s.key === key ? !s.desc : key !== 'name' }))

  return (
    <>
      <PageHead
        title="Users"
        sub={users ? `${users.length.toLocaleString()} accounts` : 'Loading accounts…'}
        actions={
          <>
            <Button icon={RefreshCw} busy={loading} onClick={() => void loadUsers(true)}>
              Refresh
            </Button>
            <Button icon={Download} disabled={!list.length} onClick={() => download(`dizayr-users-${new Date().toISOString().slice(0, 10)}.csv`, usersCsv(list), 'text/csv')}>
              Export CSV
            </Button>
          </>
        }
      />
      {error && <p className="mb-6 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setShown(PAGE)
            }}
            placeholder="Search name, email, UID or note…"
            className="h-10 w-full rounded-xl border border-white/[0.08] bg-[#0e1016]/80 pl-10 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/50 focus:ring-4 focus:ring-indigo-500/10"
          />
        </div>
        <Segmented<Filter>
          value={filter}
          onChange={(f) => {
            setFilter(f)
            setShown(PAGE)
          }}
          options={[
            { id: 'all', label: 'All', count: counts.all },
            { id: 'trial', label: 'Trial', count: counts.trial },
            { id: 'paying', label: 'Paying', count: counts.paying },
            { id: 'free', label: 'Free', count: counts.free },
            { id: 'expired', label: 'Expired', count: counts.expired },
            { id: 'disabled', label: 'Disabled', count: counts.disabled },
          ]}
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-[#0e1016]/80">
        {/* Header (wide screens) */}
        <div className="hidden grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_110px_120px_28px] items-center gap-4 border-b border-white/[0.06] bg-white/[0.015] px-5 py-2.5 text-xs font-medium text-zinc-500 md:grid">
          <SortHead label="User" k="name" sort={sort} onClick={setKey} />
          <SortHead label="Membership" k="status" sort={sort} onClick={setKey} />
          <SortHead label="Joined" k="joined" sort={sort} onClick={setKey} />
          <SortHead label="Last active" k="active" sort={sort} onClick={setKey} />
          <span />
        </div>

        {!users ? (
          <div className="space-y-px">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-4">
                <Skeleton className="h-9 w-9 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : list.length === 0 ? (
          <Empty icon={q ? UserX : UsersIcon} title={q ? 'No one matches that search' : 'No users here'} text={q ? 'Try part of their email or name.' : undefined} />
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {list.slice(0, shown).map((u) => (
              <Row key={u.uid} u={u} />
            ))}
          </ul>
        )}
      </div>
      {list.length > shown && (
        <div className="mt-4 flex justify-center">
          <Button onClick={() => setShown((n) => n + PAGE)}>
            Show more ({(list.length - shown).toLocaleString()} left)
          </Button>
        </div>
      )}
    </>
  )
}

function SortHead({ label, k, sort, onClick }: { label: string; k: SortKey; sort: { key: SortKey; desc: boolean }; onClick: (k: SortKey) => void }) {
  const on = sort.key === k
  const Icon = sort.desc ? ArrowDown : ArrowUp
  return (
    <button onClick={() => onClick(k)} className={cx('inline-flex items-center gap-1 text-left transition hover:text-zinc-200', on && 'text-zinc-200')}>
      {label}
      {on && <Icon className="h-3 w-3" />}
    </button>
  )
}

function Row({ u }: { u: UserRow }) {
  const open = () => go(`/admin/users/${u.uid}`)
  return (
    <li>
      <a
        href={`/admin/users/${u.uid}`}
        onClick={(e) => {
          if (e.ctrlKey || e.metaKey) return // new tab
          e.preventDefault()
          open()
        }}
        className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-white/[0.025] md:grid-cols-[minmax(0,2.4fr)_minmax(0,1.6fr)_110px_120px_28px]"
      >
        <span className="flex min-w-0 items-center gap-3">
          <Avatar url={u.photo} name={displayName(u)} />
          <span className="min-w-0">
            <span className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-zinc-100">{displayName(u)}</span>
              {u.note && <StickyNote className="h-3 w-3 shrink-0 text-amber-300/70" aria-label="Has a note" />}
            </span>
            <span className="block truncate text-[13px] text-zinc-500">{u.email ?? 'No email'}</span>
          </span>
        </span>
        <span className="flex min-w-0 flex-col items-end gap-0.5 md:items-start">
          <StatusChip sub={u} disabled={u.disabled} />
          <span className="hidden truncate text-xs text-zinc-500 md:block">{membershipDetail(u)}</span>
        </span>
        <span className="hidden text-[13px] tabular-nums text-zinc-400 md:block">{shortDate(u.createdAt)}</span>
        <span className="hidden text-[13px] tabular-nums text-zinc-400 md:block">{ago(lastActive(u))}</span>
        <ChevronRight className="hidden h-4 w-4 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300 md:block" />
      </a>
    </li>
  )
}
