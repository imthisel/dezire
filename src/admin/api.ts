import { create } from 'zustand'

/** Talks to api/admin.ts. The session is an HttpOnly cookie the page can't see; a 401 means it ran out or was never there. */

export type Sub = {
  trialStartedAt: number | null
  accessUntil: number | null
  compUntil: number | null
  lifetime: boolean
  plan: 'annual' | 'semiannual' | null
  status: string | null
  renewsAt: number | null
  endsAt: number | null
  testMode: boolean
  subscriptionId: string | null
  customerId: string | null
  billingEmail: string | null
}

export type Profile = {
  uid: string
  email: string | null
  emailVerified: boolean
  name: string | null
  photo: string | null
  disabled: boolean
  providers: string[]
  createdAt: number | null
  lastSignIn: number | null
  lastRefresh: number | null
}

export type UserRow = Profile & Sub & { lastSaved: number | null; hasPlan: boolean; note: string }

export type LogEntry = { id: string; at: number | null; action: string; uid?: string | null; email?: string | null; detail: string | null; ip?: string | null; ua?: string | null }

export type UserDetail = UserRow & { data: Record<string, unknown> | null; log: LogEntry[] }

export class AdminError extends Error {
  constructor(
    public status: number,
    public code: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(code)
  }
}

interface Session {
  /** null: still checking */
  state: 'checking' | 'in' | 'out' | 'not_configured' | 'offline'
  expires: number | null
  /** When not configured: which Vercel settings are missing or broken */
  problems: string[]
}
export const useSession = create<Session>(() => ({ state: 'checking', expires: null, problems: [] }))

async function call<T>(init: RequestInit & { query?: string }): Promise<T> {
  let res: Response
  try {
    res = await fetch(`/api/admin${init.query ? `?${init.query}` : ''}`, {
      ...init,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'x-admin': '1' },
    })
  } catch {
    throw new AdminError(0, 'network')
  }
  const type = res.headers.get('content-type') ?? ''
  // No API here (e.g. `npm run dev`, which only serves the page): Vite answers with the page itself.
  if (!type.includes('application/json')) throw new AdminError(res.status || 0, 'no_api')
  const body = (await res.json()) as Record<string, unknown>
  if (!res.ok) {
    const code = String(body.error ?? 'error')
    if (res.status === 401 && code === 'signed_out') useSession.setState({ state: 'out', expires: null })
    if (res.status === 503) useSession.setState({ state: 'not_configured', problems: Array.isArray(body.problems) ? (body.problems as string[]) : [] })
    throw new AdminError(res.status, code, body)
  }
  return body as T
}

export const api = {
  get: <T>(action: string, params: Record<string, string> = {}) => call<T>({ method: 'GET', query: new URLSearchParams({ action, ...params }).toString() }),
  post: <T = { ok: true }>(action: string, body: Record<string, unknown> = {}) => call<T>({ method: 'POST', body: JSON.stringify({ action, ...body }) }),
}

export async function checkSession() {
  try {
    const r = await api.get<{ expires: number }>('session')
    useSession.setState({ state: 'in', expires: r.expires })
  } catch (e) {
    const err = e as AdminError
    if (err.code === 'not_configured') return // already set (with what's missing) in call()
    if (err.code === 'no_api' || err.code === 'network') useSession.setState({ state: 'offline' })
    else useSession.setState({ state: 'out', expires: null })
  }
}

export async function logout() {
  try {
    await api.post('logout')
  } finally {
    useSession.setState({ state: 'out', expires: null })
    useUsers.setState({ users: null, loadedAt: null })
  }
}

/** Human words for an error code from the API. */
export function errorText(e: unknown) {
  const err = e as AdminError
  switch (err?.code) {
    case 'network':
      return 'Can’t reach the server. Check your connection.'
    case 'no_api':
      return 'The admin API isn’t running here. Use the deployed site, or `vercel dev` locally.'
    case 'signed_out':
      return 'Your admin session ended. Sign in again.'
    case 'not_found':
      return 'That account no longer exists.'
    case 'confirm_mismatch':
      return 'The confirmation didn’t match the account’s email.'
    case 'forbidden':
      return 'Request blocked (it didn’t come from this site).'
    default:
      return err?.extra?.message ? `Server error: ${String(err.extra.message)}` : 'Something went wrong on the server. Try again.'
  }
}

// ---- Everyone (cached for the session, refreshed on demand) ----

interface UsersState {
  users: UserRow[] | null
  loadedAt: number | null
  loading: boolean
  error: string | null
}
export const useUsers = create<UsersState>(() => ({ users: null, loadedAt: null, loading: false, error: null }))

export async function loadUsers(force = false) {
  const s = useUsers.getState()
  if (s.loading || (!force && s.users)) return
  useUsers.setState({ loading: true, error: null })
  try {
    const r = await api.get<{ users: UserRow[]; at: number }>('users')
    useUsers.setState({ users: r.users, loadedAt: r.at, loading: false })
  } catch (e) {
    useUsers.setState({ loading: false, error: errorText(e) })
  }
}

/** Updates one row in the cached list after a change on their page, so the list is right without reloading everyone. */
export function patchUser(uid: string, patch: Partial<UserRow> | null) {
  useUsers.setState((s) => ({
    users: s.users ? (patch ? s.users.map((u) => (u.uid === uid ? { ...u, ...patch } : u)) : s.users.filter((u) => u.uid !== uid)) : s.users,
  }))
}
