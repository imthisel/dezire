import crypto from 'node:crypto'
import { accounts } from './accounts'
import { firestore } from './firestore'
import { serviceAccount } from './google'

/**
 * Admin sign-in. The password is only ever in the ADMIN_PASSWORD environment variable (Cloudflare → Workers →
 * dizayr → Settings → Variables and Secrets), never in the code. A session is a signed cookie (HttpOnly, so page scripts can't read it)
 * that lasts a few hours. Its signing key comes from the password and the Firebase service account's private key,
 * so changing the password signs every admin session out.
 */

/** Firestore and the sign-in accounts, both through Google's web APIs with the service account. */
export function firebase() {
  const sa = serviceAccount()
  return { db: firestore(sa), auth: accounts(sa) }
}

const password = () => process.env.ADMIN_PASSWORD ?? ''
/** Off unless a real password and the server key are both set: never open by default. */
export const adminConfigured = () => setupProblems().length === 0

/** What's missing, in words, so the admin page can say exactly which setting to fix. */
export function setupProblems() {
  const out: string[] = []
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim()
  const sa = serviceAccount()
  if (!raw) out.push('FIREBASE_SERVICE_ACCOUNT is missing.')
  else if (!sa.private_key || !sa.client_email || !sa.project_id)
    out.push('FIREBASE_SERVICE_ACCOUNT isn’t the whole key file. Paste everything from the first { to the last }.')
  if (!password()) out.push('ADMIN_PASSWORD is missing.')
  else if (password().length < 8) out.push('ADMIN_PASSWORD must be at least 8 characters.')
  return out
}

export const COOKIE = 'dz_admin'
export const SESSION_MS = 8 * 3_600_000

const sha256 = (s: string) => crypto.createHash('sha256').update(s, 'utf8').digest()
const signingKey = () => crypto.createHmac('sha256', serviceAccount().private_key!).update(`dizayr-admin\0${password()}`).digest()
const b64 = (b: Buffer | string) => Buffer.from(b).toString('base64url')

/** Compared as hashes so the time taken never depends on how much of the password was right. */
export function passwordMatches(given: unknown) {
  return typeof given === 'string' && given.length <= 256 && crypto.timingSafeEqual(sha256(given), sha256(password()))
}

export function newSession() {
  const now = Date.now()
  const body = b64(JSON.stringify({ iat: now, exp: now + SESSION_MS, n: crypto.randomBytes(8).toString('hex') }))
  const sig = b64(crypto.createHmac('sha256', signingKey()).update(body).digest())
  return { token: `${body}.${sig}`, expires: now + SESSION_MS }
}

/** The session's expiry time (ms) when the token is genuine and still valid, otherwise null. */
export function checkSession(token: string | undefined): number | null {
  if (!token || !adminConfigured()) return null
  const [body, sig] = token.split('.')
  if (!body || !sig) return null
  const want = crypto.createHmac('sha256', signingKey()).update(body).digest()
  const got = Buffer.from(sig, 'base64url')
  if (got.length !== want.length || !crypto.timingSafeEqual(got, want)) return null
  try {
    const { exp } = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as { exp: number }
    return typeof exp === 'number' && exp > Date.now() ? exp : null
  } catch {
    return null
  }
}

export function cookieOf(request: Request, name: string) {
  for (const part of (request.headers.get('cookie') ?? '').split(';')) {
    const [k, ...v] = part.trim().split('=')
    if (k === name) return v.join('=')
  }
  return undefined
}

/** HttpOnly + Secure + SameSite=Strict, and only sent to the admin API. */
export const sessionCookie = (token: string, maxAgeSec: number) =>
  `${COOKIE}=${token}; Path=/api/admin; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`

/** The visitor's address, as Cloudflare saw it (CF-Connecting-IP can't be set by the visitor). */
export const clientIp = (request: Request) =>
  request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

/** Short, stable id for an address (used as a document id for login lockouts). */
export const ipKey = (ip: string) => sha256(`ip:${ip}`).toString('hex').slice(0, 32)
