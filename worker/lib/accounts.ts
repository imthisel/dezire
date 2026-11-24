import { accessToken, type ServiceAccount } from './google'

/**
 * Firebase sign-in accounts, through Google's Identity Toolkit web API, with only fetch and Web Crypto
 * (firebase-admin doesn't run on Cloudflare Workers).
 * Covers what the admin page needs: list, look up, disable / enable, sign out everywhere, delete.
 */

export type Account = {
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

/** Same code firebase-admin uses, so callers can tell "no such account" apart. */
export class AccountError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

type RawUser = {
  localId: string
  email?: string
  emailVerified?: boolean
  displayName?: string
  photoUrl?: string
  disabled?: boolean
  providerUserInfo?: { providerId: string }[]
  createdAt?: string
  lastLoginAt?: string
  lastRefreshAt?: string
}

const toAccount = (u: RawUser): Account => ({
  uid: u.localId,
  email: u.email ?? null,
  emailVerified: !!u.emailVerified,
  name: u.displayName ?? null,
  photo: u.photoUrl ?? null,
  disabled: !!u.disabled,
  providers: (u.providerUserInfo ?? []).map((p) => p.providerId),
  createdAt: u.createdAt ? Number(u.createdAt) : null,
  lastSignIn: u.lastLoginAt ? Number(u.lastLoginAt) : null,
  lastRefresh: u.lastRefreshAt ? Date.parse(u.lastRefreshAt) || null : null,
})

export function accounts(sa: ServiceAccount) {
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${sa.project_id}`

  async function call<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method: init.method ?? (init.body ? 'POST' : 'GET'),
      headers: { Authorization: `Bearer ${await accessToken(sa)}`, 'Content-Type': 'application/json' },
      body: init.body ? JSON.stringify(init.body) : undefined,
      signal: AbortSignal.timeout(15_000),
    })
    const body = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } }
    if (!res.ok) {
      const msg = body.error?.message ?? `HTTP ${res.status}`
      throw new AccountError(msg === 'USER_NOT_FOUND' ? 'auth/user-not-found' : 'auth/api', `Accounts API: ${msg}`)
    }
    return body
  }

  return {
    /** Everyone, a thousand at a time. */
    async list(): Promise<Account[]> {
      const out: Account[] = []
      let page: string | undefined
      do {
        const q = new URLSearchParams({ maxResults: '1000', ...(page ? { nextPageToken: page } : {}) })
        const r = await call<{ users?: RawUser[]; nextPageToken?: string }>(`/accounts:batchGet?${q}`)
        out.push(...(r.users ?? []).map(toAccount))
        page = r.nextPageToken || undefined
      } while (page)
      return out
    },
    async get(uid: string): Promise<Account> {
      const r = await call<{ users?: RawUser[] }>('/accounts:lookup', { body: { localId: [uid] } })
      if (!r.users?.length) throw new AccountError('auth/user-not-found', 'No such account')
      return toAccount(r.users[0])
    },
    setDisabled: (uid: string, disabled: boolean) => call('/accounts:update', { body: { localId: uid, disableUser: disabled } }),
    /** Every sign-in issued before now stops working (each device has to sign in again). */
    signOutEverywhere: (uid: string) => call('/accounts:update', { body: { localId: uid, validSince: String(Math.floor(Date.now() / 1000)) } }),
    remove: (uid: string) => call('/accounts:delete', { body: { localId: uid } }),
  }
}
