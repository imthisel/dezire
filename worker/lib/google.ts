/**
 * The Firebase service account (FIREBASE_SERVICE_ACCOUNT) and the Google access token it signs in with, which the
 * Firestore and accounts calls use. Signed with Web Crypto, which Cloudflare Workers (and Node) have built in.
 */

export type ServiceAccount = { project_id?: string; client_email?: string; private_key?: string }

let account: ServiceAccount | null = null
/** The key file pasted into FIREBASE_SERVICE_ACCOUNT. A broken paste reads as "no key" (and is reported), never a crash. */
export function serviceAccount(): ServiceAccount {
  if (account) return account
  try {
    const parsed = JSON.parse((process.env.FIREBASE_SERVICE_ACCOUNT ?? '').trim() || '{}') as ServiceAccount
    // Some copies turn the key's line breaks into the two characters "\n"; the key needs real ones.
    if (parsed.private_key) parsed.private_key = parsed.private_key.replace(/\\n/g, '\n')
    account = parsed
  } catch {
    account = {}
  }
  return account
}

/** Errors from Google's APIs, with a code callers can tell apart (same codes firebase-admin uses where there is one). */
export class GoogleError extends Error {
  code: string
  status: number
  constructor(code: string, message: string, status = 500) {
    super(message)
    this.code = code
    this.status = status
  }
}

const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/identitytoolkit',
].join(' ')

const b64url = (v: string | ArrayBuffer) => Buffer.from(typeof v === 'string' ? v : new Uint8Array(v)).toString('base64url')

let signingKey: { pem: string; key: CryptoKey } | null = null
async function keyOf(pem: string) {
  if (signingKey?.pem === pem) return signingKey.key
  const der = Buffer.from(pem.replace(/-----(BEGIN|END) PRIVATE KEY-----/g, '').replace(/\s+/g, ''), 'base64')
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign'])
  signingKey = { pem, key }
  return key
}

let token: { email: string; value: string; until: number } | null = null

/** A Google access token for the service account (signed JWT → OAuth token), reused until shortly before it expires. */
export async function accessToken(sa: ServiceAccount) {
  if (token && token.email === sa.client_email && token.until > Date.now() + 60_000) return token.value
  if (!sa.client_email || !sa.private_key) throw new GoogleError('auth/no-key', 'FIREBASE_SERVICE_ACCOUNT is missing or incomplete')
  const now = Math.floor(Date.now() / 1000)
  const unsigned = `${b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${b64url(
    JSON.stringify({ iss: sa.client_email, scope: SCOPES, aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }),
  )}`
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', await keyOf(sa.private_key), new TextEncoder().encode(unsigned))
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${b64url(sig)}` }),
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; expires_in?: number; error_description?: string; error?: string }
  if (!res.ok || !body.access_token) throw new GoogleError('auth/token', `Google sign-in for the server failed: ${body.error_description ?? body.error ?? res.status}`)
  token = { email: sa.client_email, value: body.access_token, until: Date.now() + (body.expires_in ?? 3600) * 1000 }
  return token.value
}
