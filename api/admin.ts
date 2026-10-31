/**
 * Admin API, used by the admin page at /admin. Everything here runs on the server with the Firebase service account,
 * so the Firestore rules (which keep each user to their own data) don't apply: every request except `login` must carry
 * a valid admin session (see _lib/admin.ts).
 *
 * GET  /api/admin?action=session | users | user&uid=… | log
 * POST /api/admin  { action: login | logout | lifetime | comp | endComp | trial | disable | revoke | note | delete, … }
 *
 * Protections: the password only lives in ADMIN_PASSWORD; 5 wrong tries from one address lock it out for 15 minutes;
 * sessions are HttpOnly, SameSite=Strict cookies that expire after 8 hours; changes must come from this site
 * (Origin check + a custom header); and every sign-in and change is written to the `admin_log` collection.
 */
import { FieldValue, Timestamp, type DocumentSnapshot } from 'firebase-admin/firestore'
import type { UserRecord } from 'firebase-admin/auth'
import {
  COOKIE, SESSION_MS, adminConfigured, checkSession, clientIp, cookieOf, firebase, ipKey, newSession, passwordMatches, sessionCookie, setupProblems,
} from './_lib/admin.js'

const MAX_TRIES = 5
const LOCK_MS = 15 * 60_000
const DAY = 86_400_000

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', ...headers },
  })
const fail = (status: number, error: string, extra: Record<string, unknown> = {}) => json({ error, ...extra }, status)
/** Says which Vercel setting is missing or broken (names only, never values). */
const notConfigured = () => fail(503, 'not_configured', { problems: setupProblems() })

/** Anything unexpected becomes a JSON error the page can show, instead of Vercel's bare "server error". */
const safe =
  (handler: (request: Request) => Promise<Response>) =>
  async (request: Request) => {
    try {
      return await handler(request)
    } catch (e) {
      console.error('admin', e)
      return fail(500, 'server_error', { message: e instanceof Error ? e.message.slice(0, 300) : String(e) })
    }
  }

const ms = (v: unknown) => (v instanceof Timestamp ? v.toMillis() : null)
const validUid = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v)

async function audit(request: Request, action: string, extra: { uid?: string; email?: string | null; detail?: string } = {}) {
  try {
    await firebase()
      .db.collection('admin_log')
      .add({ at: FieldValue.serverTimestamp(), action, ip: clientIp(request), ua: (request.headers.get('user-agent') ?? '').slice(0, 200), ...extra })
  } catch (e) {
    console.error('admin_log', e)
  }
}

/** The signed-in admin's session expiry, or null. */
const session = (request: Request) => checkSession(cookieOf(request, COOKIE))

// ---------------------------------------------------------------- reading

function subscriptionOf(s: DocumentSnapshot | undefined) {
  const d = s?.data() ?? {}
  return {
    trialStartedAt: ms(d.trialStartedAt),
    accessUntil: ms(d.accessUntil),
    compUntil: ms(d.compUntil),
    lifetime: d.lifetime === true,
    plan: (d.plan as string | null) ?? null,
    status: (d.status as string | null) ?? null,
    renewsAt: ms(d.renewsAt),
    endsAt: ms(d.endsAt),
    testMode: d.testMode === true,
    subscriptionId: (d.subscriptionId as string | null) ?? null,
    customerId: (d.customerId as string | null) ?? null,
    billingEmail: (d.email as string | null) ?? null,
  }
}

function profileOf(u: UserRecord) {
  return {
    uid: u.uid,
    email: u.email ?? null,
    emailVerified: u.emailVerified,
    name: u.displayName ?? null,
    photo: u.photoURL ?? null,
    disabled: u.disabled,
    providers: u.providerData.map((p) => p.providerId),
    createdAt: Date.parse(u.metadata.creationTime) || null,
    lastSignIn: u.metadata.lastSignInTime ? Date.parse(u.metadata.lastSignInTime) : null,
    lastRefresh: u.metadata.lastRefreshTime ? Date.parse(u.metadata.lastRefreshTime) : null,
  }
}

async function listUsers() {
  const { db, auth } = firebase()
  const people: UserRecord[] = []
  let page: string | undefined
  do {
    const r = await auth.listUsers(1000, page)
    people.push(...r.users)
    page = r.pageToken
  } while (page)
  // Only the save time from each plan (not the plan itself), so the list stays fast with many users.
  const [subs, saves, notes] = await Promise.all([
    db.collection('subscriptions').get(),
    db.collection('users').select('updatedAt').get(),
    db.collection('admin_users').get(),
  ])
  const sub = new Map(subs.docs.map((d) => [d.id, d]))
  const saved = new Map(saves.docs.map((d) => [d.id, ms(d.get('updatedAt'))]))
  const note = new Map(notes.docs.map((d) => [d.id, (d.get('note') as string) ?? '']))
  return people.map((u) => ({
    ...profileOf(u),
    ...subscriptionOf(sub.get(u.uid)),
    lastSaved: saved.get(u.uid) ?? null,
    hasPlan: saved.has(u.uid),
    note: note.get(u.uid) ?? '',
  }))
}

async function userDetail(uid: string) {
  const { db, auth } = firebase()
  const [u, sub, plan, note, log] = await Promise.all([
    auth.getUser(uid),
    db.collection('subscriptions').doc(uid).get(),
    db.collection('users').doc(uid).get(),
    db.collection('admin_users').doc(uid).get(),
    db.collection('admin_log').where('uid', '==', uid).limit(100).get(),
  ])
  return {
    ...profileOf(u),
    ...subscriptionOf(sub),
    lastSaved: ms(plan.get('updatedAt')),
    hasPlan: plan.exists,
    note: (note.get('note') as string) ?? '',
    data: plan.exists ? (plan.get('data') ?? null) : null,
    log: log.docs
      .map((d) => ({ id: d.id, at: ms(d.get('at')), action: d.get('action') as string, detail: (d.get('detail') as string) ?? null }))
      .sort((a, b) => (b.at ?? 0) - (a.at ?? 0)),
  }
}

async function auditLog() {
  const snap = await firebase().db.collection('admin_log').orderBy('at', 'desc').limit(300).get()
  return snap.docs.map((d) => ({
    id: d.id,
    at: ms(d.get('at')),
    action: d.get('action') as string,
    uid: (d.get('uid') as string) ?? null,
    email: (d.get('email') as string) ?? null,
    detail: (d.get('detail') as string) ?? null,
    ip: (d.get('ip') as string) ?? null,
    ua: (d.get('ua') as string) ?? null,
  }))
}

export const GET = safe(async (request: Request) => {
  if (!adminConfigured()) return notConfigured()
  const action = new URL(request.url).searchParams.get('action')
  const exp = session(request)
  if (action === 'session') return exp ? json({ ok: true, expires: exp }) : fail(401, 'signed_out')
  if (!exp) return fail(401, 'signed_out')
  try {
    if (action === 'users') return json({ users: await listUsers(), at: Date.now() })
    if (action === 'log') return json({ log: await auditLog() })
    if (action === 'user') {
      const uid = new URL(request.url).searchParams.get('uid')
      if (!validUid(uid)) return fail(400, 'bad_uid')
      const detail = await userDetail(uid)
      await audit(request, 'view_user', { uid, email: detail.email })
      return json({ user: detail })
    }
    return fail(400, 'unknown_action')
  } catch (e) {
    console.error('admin GET', action, e)
    if ((e as { code?: string }).code === 'auth/user-not-found') return fail(404, 'not_found')
    throw e
  }
})

// ---------------------------------------------------------------- changes

/** Changes must come from this site's own page: a cross-site form or script can't set the header or fake the Origin. */
function sameSite(request: Request) {
  if (request.headers.get('x-admin') !== '1') return false
  const origin = request.headers.get('origin')
  return !origin || new URL(origin).host === new URL(request.url).host
}

async function login(request: Request, given: unknown) {
  const { db } = firebase()
  const lockRef = db.collection('admin_locks').doc(ipKey(clientIp(request)))
  const lock = await lockRef.get()
  const until = ms(lock.get('until')) ?? 0
  if (until > Date.now()) return fail(429, 'locked', { retryAt: until })

  if (!passwordMatches(given)) {
    const tries = ((lock.get('tries') as number) ?? 0) + 1
    const locked = tries >= MAX_TRIES
    await lockRef.set(
      locked ? { tries: 0, until: Timestamp.fromMillis(Date.now() + LOCK_MS) } : { tries, until: null, last: FieldValue.serverTimestamp() },
    )
    await audit(request, locked ? 'login_locked' : 'login_failed')
    // A moment's pause makes guessing slower still.
    await new Promise((r) => setTimeout(r, 600))
    return locked ? fail(429, 'locked', { retryAt: Date.now() + LOCK_MS }) : fail(401, 'wrong_password', { triesLeft: MAX_TRIES - tries })
  }

  if (lock.exists) await lockRef.delete()
  await audit(request, 'login')
  const { token, expires } = newSession()
  return json({ ok: true, expires }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_MS / 1000) })
}

type Body = { action?: string; uid?: unknown; on?: unknown; days?: unknown; note?: unknown; confirm?: unknown; password?: unknown }

export const POST = safe(async (request: Request) => {
  if (!adminConfigured()) return notConfigured()
  if (!sameSite(request)) return fail(403, 'forbidden')
  let body: Body
  try {
    body = (await request.json()) as Body
  } catch {
    return fail(400, 'bad_request')
  }

  if (body.action === 'login') return login(request, body.password)
  if (body.action === 'logout') {
    if (session(request)) await audit(request, 'logout')
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) })
  }
  if (!session(request)) return fail(401, 'signed_out')

  const uid = body.uid
  if (!validUid(uid)) return fail(400, 'bad_uid')
  const { db, auth } = firebase()
  const sub = db.collection('subscriptions').doc(uid)

  try {
    const person = await auth.getUser(uid)
    const log = (action: string, detail?: string) => audit(request, action, { uid, email: person.email ?? null, detail })

    switch (body.action) {
      case 'lifetime': {
        const on = body.on === true
        await sub.set({ lifetime: on, adminUpdatedAt: FieldValue.serverTimestamp() }, { merge: true })
        await log(on ? 'grant_lifetime' : 'remove_lifetime')
        break
      }
      case 'comp': {
        const days = Number(body.days)
        if (!Number.isInteger(days) || days < 1 || days > 3650) return fail(400, 'bad_days')
        // Adds to any free time still left, so granting twice stacks.
        const now = await sub.get()
        const from = Math.max(Date.now(), ms(now.get('compUntil')) ?? 0)
        await sub.set({ compUntil: Timestamp.fromMillis(from + days * DAY), adminUpdatedAt: FieldValue.serverTimestamp() }, { merge: true })
        await log('grant_free', `${days} day${days === 1 ? '' : 's'}`)
        break
      }
      case 'endComp':
        await sub.set({ compUntil: FieldValue.delete(), adminUpdatedAt: FieldValue.serverTimestamp() }, { merge: true })
        await log('end_free')
        break
      case 'trial':
        await sub.set({ trialStartedAt: FieldValue.serverTimestamp(), adminUpdatedAt: FieldValue.serverTimestamp() }, { merge: true })
        await log('reset_trial')
        break
      case 'disable': {
        const on = body.on === true
        await auth.updateUser(uid, { disabled: on })
        if (on) await auth.revokeRefreshTokens(uid)
        await log(on ? 'disable' : 'enable')
        break
      }
      case 'revoke':
        await auth.revokeRefreshTokens(uid)
        await log('sign_out_everywhere')
        break
      case 'note': {
        const note = typeof body.note === 'string' ? body.note.slice(0, 5000) : ''
        await db.collection('admin_users').doc(uid).set({ note, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        await log('note')
        break
      }
      case 'delete': {
        // Typed confirmation: the account's email (or its uid when it has none).
        if (typeof body.confirm !== 'string' || body.confirm.trim().toLowerCase() !== (person.email ?? uid).toLowerCase()) return fail(400, 'confirm_mismatch')
        await log('delete_account')
        await Promise.all([db.collection('users').doc(uid).delete(), sub.delete(), db.collection('admin_users').doc(uid).delete()])
        await auth.deleteUser(uid)
        return json({ ok: true, deleted: true })
      }
      default:
        return fail(400, 'unknown_action')
    }
    return json({ ok: true })
  } catch (e) {
    console.error('admin POST', body.action, e)
    if ((e as { code?: string }).code === 'auth/user-not-found') return fail(404, 'not_found')
    throw e
  }
})
