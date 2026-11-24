/**
 * The Cloudflare Worker behind dizayr.com. The site itself (dist/, built by Vite) is served by Cloudflare as static
 * files, with the headers in public/_headers. Only these paths come here first (see wrangler.jsonc, run_worker_first):
 * - /api/admin, /api/billing, /api/paddle: the server (admin page, Manage billing, Paddle's payment webhook)
 * - /__/auth/*, /__/firebase/*: Firebase's sign-in pages, passed through from the project's firebaseapp.com, so that
 *   sign-in runs on this site's own address (see src/lib/firebase.ts)
 */
import * as admin from './admin'
import * as billing from './billing'
import * as paddle from './paddle'

type Env = { ASSETS: { fetch(request: Request): Promise<Response> } }
type Route = { GET?: (request: Request) => Response | Promise<Response>; POST?: (request: Request) => Response | Promise<Response> }

const FIREBASE_HOSTING = 'https://dezire-ce767.firebaseapp.com'

const ROUTES: Record<string, Route> = {
  '/api/admin': admin,
  '/api/billing': billing,
  '/api/paddle': paddle,
}

/** For the server's own answers (static files get theirs from public/_headers). */
const API_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

function withApiHeaders(res: Response) {
  const out = new Response(res.body, res)
  for (const [k, v] of Object.entries(API_HEADERS)) if (!out.headers.has(k)) out.headers.set(k, v)
  return out
}

/** Firebase's sign-in pages, fetched from Firebase Hosting and passed back as they are (redirects included). */
async function firebaseHosting(request: Request, url: URL) {
  const headers = new Headers(request.headers)
  for (const h of [...headers.keys()]) if (h === 'host' || h.startsWith('cf-') || h.startsWith('x-forwarded-') || h === 'x-real-ip') headers.delete(h)
  const hasBody = request.method !== 'GET' && request.method !== 'HEAD'
  const res = await fetch(FIREBASE_HOSTING + url.pathname + url.search, {
    method: request.method,
    headers,
    body: hasBody ? request.body : undefined,
    redirect: 'manual',
  })
  return new Response(res.body, res)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const path = url.pathname

    if (path.startsWith('/__/auth/') || path.startsWith('/__/firebase/')) return firebaseHosting(request, url)

    const route = ROUTES[path.replace(/\/$/, '')]
    if (route) {
      const method = request.method === 'HEAD' ? 'GET' : request.method
      const handler = method === 'GET' || method === 'POST' ? route[method] : undefined
      if (!handler) return withApiHeaders(new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, POST' } }))
      return withApiHeaders(await handler(request))
    }
    if (path.startsWith('/api/')) return withApiHeaders(Response.json({ error: 'not_found' }, { status: 404 }))

    return env.ASSETS.fetch(request)
  },
}
