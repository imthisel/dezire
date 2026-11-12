import { useEffect, useMemo, useRef, useState } from 'react'
import { create } from 'zustand'
import {
  ArrowLeft, Bug, CheckCircle2, Circle, Clock, ExternalLink, Heart, Inbox as InboxIcon, Info, Lightbulb, Lock, MessageCircleQuestion, NotebookPen, RefreshCw,
  Search, Send, Star, type LucideIcon,
} from 'lucide-react'
import { api, errorText, useUsers } from './api'
import { ago, fullDate } from './data'
import { Avatar, Button, Card, CopyButton, Empty, Segmented, Skeleton, cx } from './ui'
import { PageHead } from './Overview'
import { go } from './router'
import { toast } from '../toast'

/** One message from Help in the app (see src/lib/feedback.ts and api/admin.ts → feedbackList). */
export type FeedbackItem = {
  id: string
  uid: string | null
  email: string | null
  name: string | null
  kind: 'question' | 'problem' | 'idea' | 'praise'
  topic: string
  subject: string
  message: string
  rating: number
  private: boolean
  status: 'open' | 'pending' | 'resolved'
  context: Record<string, string> | null
  replies: { from: 'team' | 'user'; text: string; at: number }[]
  createdAt: number | null
  updatedAt: number | null
  seenAt: number | null
  note: string
}

// ---------------------------------------------------------------- data

interface InboxState {
  items: FeedbackItem[] | null
  loading: boolean
  error: string | null
  loadedAt: number | null
}
export const useInbox = create<InboxState>(() => ({ items: null, loading: false, error: null, loadedAt: null }))

export async function loadInbox(force = false) {
  const s = useInbox.getState()
  if (s.loading || (!force && s.items)) return
  useInbox.setState({ loading: true, error: null })
  try {
    const r = await api.get<{ feedback: FeedbackItem[]; at: number }>('feedback')
    useInbox.setState({ items: r.feedback, loading: false, loadedAt: r.at })
  } catch (e) {
    useInbox.setState({ loading: false, error: errorText(e) })
  }
}

const patch = (id: string, p: Partial<FeedbackItem>) => useInbox.setState((s) => ({ items: s.items?.map((x) => (x.id === id ? { ...x, ...p } : x)) ?? null }))

/** Needs attention: new (never opened) or waiting for an answer from you. */
export const needsYou = (x: FeedbackItem) => x.status === 'open'
export const useInboxCount = () => useInbox((s) => (s.items ?? []).filter(needsYou).length)

// ---------------------------------------------------------------- looks

const KIND: Record<FeedbackItem['kind'], { label: string; icon: LucideIcon; tone: string }> = {
  question: { label: 'Question', icon: MessageCircleQuestion, tone: 'text-sky-300 bg-sky-400/10' },
  problem: { label: 'Problem', icon: Bug, tone: 'text-rose-300 bg-rose-400/10' },
  idea: { label: 'Idea', icon: Lightbulb, tone: 'text-amber-300 bg-amber-400/10' },
  praise: { label: 'Feedback', icon: Heart, tone: 'text-pink-300 bg-pink-400/10' },
}
const STATUS: Record<FeedbackItem['status'], { label: string; icon: LucideIcon; chip: string }> = {
  open: { label: 'Open', icon: Circle, chip: 'bg-sky-400/10 text-sky-200 ring-sky-400/25' },
  pending: { label: 'Waiting on user', icon: Clock, chip: 'bg-amber-400/10 text-amber-200 ring-amber-400/25' },
  resolved: { label: 'Resolved', icon: CheckCircle2, chip: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/25' },
}
const TOPIC: Record<string, string> = {
  wants: 'Wants', needs: 'Needs', expenses: 'Expenses', money: 'Your money', school: 'School', calendar: 'Calendar', billing: 'Account & billing', other: 'Other',
}
const ref = (id: string) => `#${id.slice(0, 6).toUpperCase()}`
const sender = (x: FeedbackItem) => x.name || x.email?.split('@')[0] || 'Unknown'

// ---------------------------------------------------------------- page

type Filter = 'open' | 'pending' | 'resolved' | 'all'

export function Inbox({ id }: { id?: string }) {
  const { items, loading, error, loadedAt } = useInbox()
  const [filter, setFilter] = useState<Filter>('open')
  const [kind, setKind] = useState<FeedbackItem['kind'] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => void loadInbox(), [])

  const counts = useMemo(() => {
    const c = { open: 0, pending: 0, resolved: 0, all: items?.length ?? 0 }
    for (const x of items ?? []) c[x.status]++
    return c
  }, [items])

  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (items ?? []).filter(
      (x) =>
        (filter === 'all' || x.status === filter) &&
        (!kind || x.kind === kind) &&
        (!t || [x.subject, x.message, x.email, x.name, ref(x.id)].some((v) => v?.toLowerCase().includes(t))),
    )
  }, [items, filter, kind, q])

  const current = id ? items?.find((x) => x.id === id) : undefined
  const ratings = (items ?? []).filter((x) => x.rating > 0)
  const avg = ratings.length ? ratings.reduce((n, x) => n + x.rating, 0) / ratings.length : null

  return (
    <>
      <PageHead
        title="Inbox"
        sub="Questions, problems, ideas and feedback sent from Help in the app."
        actions={
          <Button icon={RefreshCw} busy={loading} onClick={() => void loadInbox(true)} title={loadedAt ? `Loaded ${ago(loadedAt)}` : undefined}>
            Refresh
          </Button>
        }
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label="Needs a reply" value={counts.open} tone="text-sky-200" />
        <Tile label="Waiting on user" value={counts.pending} tone="text-amber-200" />
        <Tile label="Resolved" value={counts.resolved} tone="text-emerald-200" />
        <Tile label="Average rating" value={avg === null ? '—' : `${avg.toFixed(1)} ★`} tone="text-zinc-100" hint={ratings.length ? `${ratings.length} rated` : 'none yet'} />
      </div>

      {error && <p className="mb-4 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</p>}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,24rem)_minmax(0,1fr)]">
        {/* The list (on phones, hidden while one is open) */}
        <div className={cx('min-w-0 space-y-3', current && 'hidden lg:block')}>
          <Segmented
            value={filter}
            onChange={setFilter}
            options={[
              { id: 'open', label: 'Open', count: counts.open },
              { id: 'pending', label: 'Waiting', count: counts.pending },
              { id: 'resolved', label: 'Resolved', count: counts.resolved },
              { id: 'all', label: 'All', count: counts.all },
            ]}
          />
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search subject, message, email or #ref…"
              className="h-10 w-full rounded-xl border border-white/10 bg-black/30 pl-9 pr-3 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(KIND) as FeedbackItem['kind'][]).map((k) => {
              const K = KIND[k]
              const on = kind === k
              return (
                <button
                  key={k}
                  onClick={() => setKind(on ? null : k)}
                  className={cx('inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium transition', on ? 'border-white/20 bg-white/[0.08] text-white' : 'border-white/10 text-zinc-400 hover:text-zinc-100')}
                >
                  <K.icon className="h-3 w-3" /> {K.label}
                </button>
              )
            })}
          </div>

          <Card pad={false}>
            {!items ? (
              <div className="space-y-3 p-4">
                {Array.from({ length: 5 }, (_, i) => (
                  <Skeleton key={i} className="h-14" />
                ))}
              </div>
            ) : list.length === 0 ? (
              <Empty icon={InboxIcon} title={filter === 'open' && !q && !kind ? 'All caught up' : 'Nothing here'} text={filter === 'open' && !q && !kind ? 'No messages are waiting for a reply.' : undefined} />
            ) : (
              <ul className="max-h-[70vh] divide-y divide-white/[0.05] overflow-y-auto">
                {list.map((x) => {
                  const K = KIND[x.kind] ?? KIND.question
                  const unseen = !x.seenAt
                  const last = x.replies[x.replies.length - 1]
                  const userWaiting = last?.from === 'user'
                  return (
                    <li key={x.id}>
                      <button
                        onClick={() => go(`/admin/inbox/${x.id}`)}
                        className={cx('flex w-full gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]', current?.id === x.id && 'bg-white/[0.05]')}
                      >
                        <span className={cx('mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg', K.tone)}>
                          <K.icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            {(unseen || userWaiting) && <span className="h-2 w-2 shrink-0 rounded-full bg-indigo-400" title={unseen ? 'Not opened yet' : 'They replied'} />}
                            <span className={cx('truncate text-sm', unseen ? 'font-semibold text-white' : 'font-medium text-zinc-200')}>{x.subject}</span>
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-zinc-500">{(userWaiting ? last.text : x.message).replace(/\s+/g, ' ')}</span>
                          <span className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-500">
                            <span className="truncate text-zinc-400">{sender(x)}</span>
                            {x.private && <Lock className="h-3 w-3 shrink-0 text-amber-300/80" aria-label="Asked to keep their name private" />}
                            {x.rating > 0 && (
                              <span className="inline-flex shrink-0 items-center gap-0.5 text-amber-300/90">
                                <Star className="h-3 w-3 fill-current" />
                                {x.rating}
                              </span>
                            )}
                            <span className="ml-auto shrink-0 tabular-nums" title={fullDate(x.updatedAt ?? x.createdAt)}>
                              {ago(x.updatedAt ?? x.createdAt)}
                            </span>
                          </span>
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        {/* The one that's open */}
        <div className={cx('min-w-0', !current && 'hidden lg:block')}>
          {current ? (
            <Detail key={current.id} x={current} />
          ) : (
            <Card>
              <Empty icon={InboxIcon} title={id && items ? 'That message no longer exists' : 'Pick a message'} text="Its conversation, the sender and the technical details show here." />
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

function Tile({ label, value, tone, hint }: { label: string; value: string | number; tone: string; hint?: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-[#0e1016]/80 px-4 py-3">
      <p className="text-[12px] font-medium text-zinc-500">{label}</p>
      <p className={cx('mt-1 text-xl font-semibold tabular-nums', tone)}>{value}</p>
      {hint && <p className="text-[11px] text-zinc-600">{hint}</p>}
    </div>
  )
}

function Detail({ x }: { x: FeedbackItem }) {
  const users = useUsers((s) => s.users)
  const person = x.uid ? users?.find((u) => u.uid === x.uid) : undefined
  const [reply, setReply] = useState('')
  const [busy, setBusy] = useState<null | 'reply' | 'resolve' | 'status'>(null)
  const [note, setNote] = useState(x.note)
  const noteSaved = useRef(x.note)
  const K = KIND[x.kind] ?? KIND.question
  const S = STATUS[x.status] ?? STATUS.open

  // Opening it marks it read (the sender sees "Read by the team").
  useEffect(() => {
    if (x.seenAt) return
    patch(x.id, { seenAt: Date.now() })
    void api.post('feedback', { id: x.id, seen: true }).catch(() => {})
  }, [x.id, x.seenAt])

  async function send(resolve: boolean) {
    const text = reply.trim()
    if (!text) return
    setBusy(resolve ? 'resolve' : 'reply')
    try {
      await api.post('feedback', { id: x.id, reply: text, ...(resolve ? { status: 'resolved' } : {}) })
      patch(x.id, { replies: [...x.replies, { from: 'team', text, at: Date.now() }], status: resolve ? 'resolved' : 'pending', updatedAt: Date.now() })
      setReply('')
      toast.success(resolve ? 'Reply sent and resolved.' : 'Reply sent. They’ll see it in Help.')
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function setStatus(status: FeedbackItem['status']) {
    if (status === x.status) return
    setBusy('status')
    try {
      await api.post('feedback', { id: x.id, status })
      patch(x.id, { status, updatedAt: Date.now() })
    } catch (e) {
      toast.error(errorText(e))
    } finally {
      setBusy(null)
    }
  }

  async function saveNote() {
    if (note === noteSaved.current) return
    try {
      await api.post('feedback', { id: x.id, note })
      noteSaved.current = note
      patch(x.id, { note })
      toast.success('Note saved.')
    } catch (e) {
      toast.error(errorText(e))
    }
  }

  const thread = [{ from: 'user' as const, text: x.message, at: x.createdAt ?? 0 }, ...x.replies]

  return (
    <div className="space-y-4">
      <button onClick={() => go('/admin/inbox')} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white lg:hidden">
        <ArrowLeft className="h-4 w-4" /> Inbox
      </button>

      <Card pad={false}>
        <header className="flex flex-wrap items-start gap-3 border-b border-white/[0.06] p-5">
          <span className={cx('grid h-10 w-10 shrink-0 place-items-center rounded-xl', K.tone)}>
            <K.icon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug text-white">{x.subject}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span className="font-mono tracking-wider text-zinc-400">{ref(x.id)}</span>·<span>{K.label}</span>
              {x.topic && <>·<span>{TOPIC[x.topic] ?? x.topic}</span></>}·<span title={fullDate(x.createdAt)}>{ago(x.createdAt)}</span>
              {x.rating > 0 && (
                <span className="inline-flex items-center gap-0.5 text-amber-300">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className={cx('h-3 w-3', i < x.rating ? 'fill-current' : 'text-zinc-700')} />
                  ))}
                </span>
              )}
            </p>
          </div>
          <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset', S.chip)}>
            <S.icon className="h-3.5 w-3.5" /> {S.label}
          </span>
        </header>

        {/* Who sent it: always known, even when they asked to keep their name private */}
        <div className="flex flex-wrap items-center gap-3 border-b border-white/[0.06] bg-white/[0.015] px-5 py-3.5">
          <Avatar url={person?.photo ?? null} name={sender(x)} size="h-9 w-9" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-sm font-medium text-zinc-100">
              {x.name || person?.name || sender(x)}
              {x.private && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold text-amber-200 ring-1 ring-inset ring-amber-400/25">
                  <Lock className="h-2.5 w-2.5" /> Name private
                </span>
              )}
            </p>
            <p className="flex items-center gap-1 truncate text-xs text-zinc-400">
              {x.email ?? 'No email on the account'}
              {x.email && <CopyButton text={x.email} label="Copy email" />}
            </p>
          </div>
          {x.uid && (
            <Button size="sm" icon={ExternalLink} onClick={() => go(`/admin/users/${x.uid}`)}>
              Open account
            </Button>
          )}
        </div>
        {x.private && (
          <p className="flex items-start gap-2 border-b border-white/[0.06] bg-amber-500/[0.04] px-5 py-2.5 text-xs leading-relaxed text-amber-100/80">
            <Info className="mt-px h-3.5 w-3.5 shrink-0" />
            They asked to keep their name private: don’t name them if you quote or share this. Replying to them here is fine.
          </p>
        )}

        {/* The conversation */}
        <div className="space-y-4 p-5">
          {thread.map((m, i) => {
            const team = m.from === 'team'
            return (
              <div key={i} className={cx('flex gap-3', team && 'flex-row-reverse')}>
                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[11px] font-semibold', team ? 'bg-gradient-to-br from-indigo-400 to-emerald-400 text-white' : 'bg-white/[0.08] text-zinc-200')}>
                  {team ? 'DZ' : sender(x).slice(0, 1).toUpperCase()}
                </span>
                <div className={cx('flex max-w-[85%] flex-col', team && 'items-end')}>
                  <p className="mb-1 text-[11px] text-zinc-500">
                    {team ? 'You (Dizayr team)' : sender(x)} · <span title={fullDate(m.at)}>{ago(m.at)}</span>
                  </p>
                  <div
                    className={cx(
                      'whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-sm leading-relaxed',
                      team ? 'rounded-tr-md bg-indigo-500/15 text-zinc-100 ring-1 ring-inset ring-indigo-400/20' : 'rounded-tl-md bg-white/[0.05] text-zinc-200 ring-1 ring-inset ring-white/[0.08]',
                    )}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* Reply */}
        <div className="border-t border-white/[0.06] bg-black/20 p-5">
          <textarea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && void send(false)}
            maxLength={5000}
            rows={4}
            placeholder={`Reply to ${x.name?.split(' ')[0] || 'them'}… They’ll see it in Help → Your requests.`}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-sm leading-relaxed text-white outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/15"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap gap-1">
              {(Object.keys(STATUS) as FeedbackItem['status'][]).map((s) => {
                const St = STATUS[s]
                return (
                  <button
                    key={s}
                    disabled={!!busy}
                    onClick={() => void setStatus(s)}
                    className={cx(
                      'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium transition disabled:opacity-50',
                      x.status === s ? cx('ring-1 ring-inset', St.chip) : 'text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100',
                    )}
                  >
                    <St.icon className="h-3.5 w-3.5" /> {St.label}
                  </button>
                )
              })}
            </div>
            <div className="flex gap-2">
              <Button size="sm" icon={CheckCircle2} busy={busy === 'resolve'} disabled={!reply.trim() || !!busy} onClick={() => void send(true)}>
                Send & resolve
              </Button>
              <Button size="sm" tone="primary" icon={Send} busy={busy === 'reply'} disabled={!reply.trim() || !!busy} onClick={() => void send(false)}>
                Send reply
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title={<span className="inline-flex items-center gap-2"><NotebookPen className="h-4 w-4 text-zinc-400" /> Private note</span>}>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={() => void saveNote()}
            maxLength={5000}
            rows={4}
            placeholder="Only admins see this. Saved when you click away."
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60"
          />
        </Card>
        <Card title={<span className="inline-flex items-center gap-2"><Info className="h-4 w-4 text-zinc-400" /> Technical details</span>}>
          {x.context ? (
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-xs">
              {Object.entries(x.context).map(([k, v]) => (
                <div key={k} className="min-w-0">
                  <dt className="text-zinc-500">{k}</dt>
                  <dd className="truncate font-mono text-zinc-200" title={v}>
                    {v || '—'}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-zinc-500">They chose not to include technical details.</p>
          )}
        </Card>
      </div>
    </div>
  )
}
