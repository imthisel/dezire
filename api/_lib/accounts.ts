import crypto from 'node:crypto'

/**
 * Firebase sign-in accounts, through Google's Identity Toolkit web API, using only Node's own crypto.
 * Used instead of `firebase-admin/auth`, which loads a package (jose) in a way Vercel's functions can't run.
 * Covers what the admin page needs: list, look up, disable / enable, sign out everywhere, delete.
 */

export type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string }

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

const b64 = (v: string | Buffer) => Buffer.from(v).toString('base64url')

let token: { value: string; until: number } | null = null

/** A Google access token for the service account (signed JWT → OAuth token), reused until shortly before it expires. */
async function accessToken(sa: ServiceAccount) {
  if (token && token.until > Date.now() + 60_000) return token.value
  const now = Math.floor(Date.now() / 1000)
  const head = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = b64(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/cloud-platform https://www.googleapis.com/auth/identitytoolkit',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const sig = crypto.createSign('RSA-SHA256').update(`${head}.${claims}`).sign(sa.private_key!)
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${head}.${claims}.${b64(sig)}` }),
  })
  const body = (await res.json()) as { access_token?: string; expires_in?: number; error_description?: string; error?: string }
  if (!res.ok || !body.access_token) throw new AccountError('auth/token', `Google sign-in for the server failed: ${body.error_description ?? body.error ?? res.status}`)
  token = { value: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return token.value
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
