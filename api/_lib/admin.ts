import crypto from 'node:crypto'
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'
import { getFirestore } from 'firebase-admin/firestore'

/**
 * Admin sign-in. The password is only ever in the ADMIN_PASSWORD environment variable (Vercel → Settings →
 * Environment Variables), never in the code. A session is a signed cookie (HttpOnly, so page scripts can't read it)
 * that lasts a few hours. Its signing key comes from the password and the Firebase service account's private key,
 * so changing the password signs every admin session out.
 */

type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string }
let account: ServiceAccount | null = null
const serviceAccount = (): ServiceAccount => (account ??= JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT ?? '{}') as ServiceAccount)

export function firebase() {
  if (!getApps().length) initializeApp({ credential: cert(serviceAccount() as Record<string, string>) })
  return { db: getFirestore(), auth: getAuth() }
}

const password = () => process.env.ADMIN_PASSWORD ?? ''
/** Off unless a real password and the server key are both set: never open by default. */
export const adminConfigured = () => password().length >= 8 && !!serviceAccount().private_key

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

export const clientIp = (request: Request) =>
  request.headers.get('x-real-ip') ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'

/** Short, stable id for an address (used as a document id for login lockouts). */
export const ipKey = (ip: string) => sha256(`ip:${ip}`).toString('hex').slice(0, 32)
