/*
 * Makes Dezayr open with no internet. Caches the app itself (page, scripts, styles, fonts).
 * Your data is handled separately by Firebase, which keeps it on the device and uploads offline edits
 * as soon as you're back online.
 *
 * - The page: tries the network first (so new versions show up), falls back to the saved copy after a few seconds
 *   or when offline.
 * - Built files in /assets/: their names change with every version, so a saved copy is always right.
 * - Fonts and other files: served from the saved copy and refreshed in the background.
 * Firebase (sign-in, data) is never touched here.
 */

const SHELL = 'dezayr-shell-v1'
const RUNTIME = 'dezayr-runtime-v1'
const PAGE = '/'
const NETWORK_WAIT = 3500

self.addEventListener('install', (event) => {
  event.waitUntil(saveShell().catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) if (key !== SHELL && key !== RUNTIME) await caches.delete(key)
      await self.clients.claim()
    })(),
  )
})

/** Files the page needs, read from its HTML. */
const assetsIn = (html) =>
  [...html.matchAll(/(?:src|href)="(\/[^"]+)"/g)].map((m) => m[1]).filter((u) => !u.startsWith('/__/') && !u.startsWith('//'))

/** Saves the page and everything it loads; drops built files the new page no longer uses. */
async function saveShell(res) {
  const page = res ?? (await fetch(PAGE, { cache: 'no-store' }))
  if (!page.ok) return
  const html = await page.clone().text()
  const cache = await caches.open(SHELL)
  await cache.put(PAGE, page)
  const urls = assetsIn(html)
  await Promise.all(urls.map((u) => cache.match(u).then((hit) => hit || cache.add(u)).catch(() => {})))
  const keep = new Set(urls.map((u) => new URL(u, self.location.origin).href))
  for (const req of await cache.keys()) {
    const path = new URL(req.url).pathname
    if (path.startsWith('/assets/') && !keep.has(req.url)) await cache.delete(req)
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/__/')) return // Firebase sign-in
    if (req.mode === 'navigate') return event.respondWith(page(req))
    if (url.pathname.startsWith('/assets/')) return event.respondWith(cacheFirst(req, SHELL))
    return event.respondWith(staleWhileRevalidate(req, RUNTIME, event))
  }
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    return event.respondWith(staleWhileRevalidate(req, RUNTIME, event))
  }
})

/** The page: network first (with a time limit, for weak connections), then the saved copy. */
async function page(req) {
  const cache = await caches.open(SHELL)
  const network = fetch(req).then((res) => {
    if (res.ok) saveShell(res.clone()).catch(() => {})
    return res
  })
  const timeout = new Promise((resolve) => setTimeout(resolve, NETWORK_WAIT))
  try {
    const res = await Promise.race([network, timeout])
    if (res) return res
  } catch {
    // offline
  }
  const saved = await cache.match(PAGE)
  if (saved) {
    network.catch(() => {})
    return saved
  }
  return network // nothing saved yet: keep waiting for the network
}

async function cacheFirst(req, name) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  if (hit) return hit
  const res = await fetch(req)
  if (res.ok) cache.put(req, res.clone())
  return res
}

async function staleWhileRevalidate(req, name, event) {
  const cache = await caches.open(name)
  const hit = await cache.match(req)
  const fresh = fetch(req)
    .then((res) => {
      if (res.ok || res.type === 'opaque') cache.put(req, res.clone())
      return res
    })
    .catch(() => undefined)
  if (hit) {
    event.waitUntil(fresh)
    return hit
  }
  return (await fresh) ?? Response.error()
}
