import { create } from 'zustand'
import { collection, doc, onSnapshot, query, serverTimestamp, where, writeBatch, type Timestamp } from 'firebase/firestore'
import { auth, db } from './firebase'
import { useApp } from '../appUpdate'
import { useStore } from '../store'

/*
 * Help & feedback: messages to the Dizayr team, saved in Firestore (`feedback`). The rules in firestore.rules make sure
 * each one is from the account that's signed in, so the team can always reply. Choosing to keep your name private only
 * means the team won't name you if they quote or share it: the message is still linked to your account.
 */

export type FeedbackKind = 'question' | 'problem' | 'idea' | 'praise'
export type FeedbackStatus = 'open' | 'pending' | 'resolved'
export type Reply = { from: 'team' | 'user'; text: string; at: number }

export type FeedbackContext = { version: string; page: string; browser: string; screen: string; lang: string; tz: string; installed: string; online: string }

export interface Ticket {
  id: string
  kind: FeedbackKind
  topic: string
  subject: string
  message: string
  rating: number
  private: boolean
  status: FeedbackStatus
  createdAt: number | null
  updatedAt: number | null
  seenAt: number | null
  replies: Reply[]
  context?: FeedbackContext
}

export const MAX_SUBJECT = 120
export const MAX_MESSAGE = 5000
/** Matches firestore.rules: one message every 30 seconds. */
export const WAIT_MS = 30_000

export const TOPICS: { id: string; label: string }[] = [
  { id: 'wants', label: 'Wants' },
  { id: 'needs', label: 'Needs' },
  { id: 'expenses', label: 'Expenses' },
  { id: 'money', label: 'Your money' },
  { id: 'school', label: 'School' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'billing', label: 'Account & billing' },
  { id: 'other', label: 'Something else' },
]

/** "Chrome 131 on Windows" */
function browserName() {
  const ua = navigator.userAgent
  const m = (re: RegExp) => ua.match(re)?.[1]
  const b = m(/Edg\/(\d+)/) ? `Edge ${m(/Edg\/(\d+)/)}` : m(/OPR\/(\d+)/) ? `Opera ${m(/OPR\/(\d+)/)}` : m(/Chrome\/(\d+)/) ? `Chrome ${m(/Chrome\/(\d+)/)}` : m(/Firefox\/(\d+)/) ? `Firefox ${m(/Firefox\/(\d+)/)}` : m(/Version\/(\d+).*Safari/) ? `Safari ${m(/Version\/(\d+).*Safari/)}` : 'Browser'
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Windows/.test(ua) ? 'Windows' : /Mac OS/.test(ua) ? 'macOS' : /CrOS/.test(ua) ? 'ChromeOS' : /Linux/.test(ua) ? 'Linux' : ''
  return (os ? `${b} on ${os}` : b).slice(0, 80)
}

/** What's sent along when "Include technical details" is on: nothing from your plan, only how the app is running. */
export function technicalContext(): FeedbackContext {
  const s = useStore.getState()
  return {
    version: String(useApp.getState().version).slice(0, 40),
    page: (s.view === 'help' ? s.prevView : s.view).slice(0, 40),
    browser: browserName(),
    screen: `${window.innerWidth}×${window.innerHeight} @${Math.round(devicePixelRatio * 10) / 10}x`.slice(0, 40),
    lang: navigator.language.slice(0, 20),
    tz: (Intl.DateTimeFormat().resolvedOptions().timeZone ?? '').slice(0, 60),
    installed: matchMedia('(display-mode: standalone)').matches ? 'yes' : 'no',
    online: navigator.onLine ? 'yes' : 'no',
  }
}

export type NewFeedback = { kind: FeedbackKind; topic: string; subject: string; message: string; rating: number; private: boolean; withContext: boolean }

const limitRef = (uid: string) => doc(db!, 'feedback_limits', uid)

/** Sends a message to the team. Returns its id (the reference shown to the user). */
export async function sendFeedback(d: NewFeedback): Promise<string> {
  const user = auth?.currentUser
  if (!user || !db) throw new Error('signed_out')
  // The email and name exactly as the sign-in has them (the rules compare against these).
  const claims = (await user.getIdTokenResult()).claims
  const ref = doc(collection(db, 'feedback'))
  const batch = writeBatch(db)
  batch.set(ref, {
    uid: user.uid,
    email: (claims.email as string | undefined) ?? null,
    name: (claims.name as string | undefined) ?? null,
    kind: d.kind,
    topic: d.topic.slice(0, 32),
    subject: d.subject.trim().slice(0, MAX_SUBJECT),
    message: d.message.trim().slice(0, MAX_MESSAGE),
    rating: Math.max(0, Math.min(5, Math.round(d.rating))),
    private: d.private,
    ...(d.withContext ? { context: technicalContext() } : {}),
    status: 'open',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  batch.set(limitRef(user.uid), { last: serverTimestamp() })
  await commit(batch)
  return ref.id
}

/** Adds a follow-up to one of your requests (it opens again for the team). */
export async function followUp(t: Ticket, text: string) {
  const user = auth?.currentUser
  if (!user || !db) throw new Error('signed_out')
  const batch = writeBatch(db)
  batch.update(doc(db, 'feedback', t.id), {
    replies: [...t.replies, { from: 'user', text: text.trim().slice(0, MAX_MESSAGE), at: Date.now() }],
    status: 'open',
    updatedAt: serverTimestamp(),
  })
  batch.set(limitRef(user.uid), { last: serverTimestamp() })
  await commit(batch)
}

/** Marks one of your requests as solved. */
export async function closeTicket(t: Ticket) {
  if (!db) return
  const batch = writeBatch(db)
  batch.update(doc(db, 'feedback', t.id), { status: 'resolved', updatedAt: serverTimestamp() })
  await commit(batch)
}

/**
 * Waits for the server to accept the write (so a refusal, like sending again too soon, is reported),
 * but not forever: offline, Firestore keeps it and sends it once back online.
 */
async function commit(batch: ReturnType<typeof writeBatch>) {
  const done = batch.commit()
  if (!navigator.onLine) {
    done.catch(() => {})
    return
  }
  await done
}

export const isTooSoon = (e: unknown) => (e as { code?: string })?.code === 'permission-denied'

// ---- Your requests, live ----

const ms = (v: unknown) => (v && typeof (v as Timestamp).toMillis === 'function' ? (v as Timestamp).toMillis() : null)

function toTicket(id: string, d: Record<string, unknown>): Ticket {
  return {
    id,
    kind: (['question', 'problem', 'idea', 'praise'].includes(d.kind as string) ? d.kind : 'question') as FeedbackKind,
    topic: typeof d.topic === 'string' ? d.topic : '',
    subject: String(d.subject ?? ''),
    message: String(d.message ?? ''),
    rating: Number(d.rating) || 0,
    private: d.private === true,
    status: (['open', 'pending', 'resolved'].includes(d.status as string) ? d.status : 'open') as FeedbackStatus,
    createdAt: ms(d.createdAt),
    updatedAt: ms(d.updatedAt),
    seenAt: ms(d.seenAt),
    replies: Array.isArray(d.replies)
      ? (d.replies as Reply[]).filter((r) => r && typeof r.text === 'string').map((r) => ({ from: r.from === 'team' ? 'team' : 'user', text: r.text, at: Number(r.at) || 0 }))
      : [],
    context: d.context as FeedbackContext | undefined,
  }
}

interface MineState {
  tickets: Ticket[] | null
  /** Per request: when you last opened it (to show new replies). Kept on this device. */
  read: Record<string, number>
}
const READ_KEY = 'dizayr-help-read'
const loadRead = (): Record<string, number> => {
  try {
    return JSON.parse(localStorage.getItem(READ_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}
export const useMine = create<MineState>(() => ({ tickets: null, read: loadRead() }))

let stop: (() => void) | null = null
let watching: string | null = null

/** Keeps your requests up to date while signed in (call with null when signed out). */
export function watchMine(uid: string | null) {
  if (uid === watching) return
  stop?.()
  stop = null
  watching = uid
  useMine.setState({ tickets: null })
  if (!uid || !db) return
  stop = onSnapshot(
    query(collection(db, 'feedback'), where('uid', '==', uid)),
    (snap) => {
      const list = snap.docs.map((d) => toTicket(d.id, d.data()))
      list.sort((a, b) => (b.updatedAt ?? b.createdAt ?? Date.now()) - (a.updatedAt ?? a.createdAt ?? Date.now()))
      useMine.setState({ tickets: list })
    },
    () => useMine.setState({ tickets: [] }),
  )
}

/** The newest reply from the team that you haven't opened yet. */
export const lastTeamReply = (t: Ticket) => t.replies.reduce((n, r) => (r.from === 'team' ? Math.max(n, r.at) : n), 0)
export const hasNewReply = (t: Ticket, read: Record<string, number>) => lastTeamReply(t) > (read[t.id] ?? 0)

export function markRead(id: string) {
  const read = { ...useMine.getState().read, [id]: Date.now() }
  useMine.setState({ read })
  try {
    localStorage.setItem(READ_KEY, JSON.stringify(read))
  } catch {
    // Not remembered: the reply just shows as new again next time.
  }
}

/** How many of your requests have a reply you haven't seen. */
export const useUnreadReplies = () => useMine((s) => (s.tickets ?? []).filter((t) => hasNewReply(t, s.read)).length)

/** A short reference people can quote: "#4F2K9A". */
export const ref = (id: string) => `#${id.slice(0, 6).toUpperCase()}`
