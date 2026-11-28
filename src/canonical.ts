/**
 * Dizayr lives at https://dizayr.com only. Opened at any other address (an old hosting address, or an app installed
 * from one), it removes that address's offline copy and moves to the same page on dizayr.com.
 * localhost and 127.0.0.1 stay as they are, for working on the app.
 */
export const HOME = 'dizayr.com'

const LOCAL = ['localhost', '127.0.0.1']

/** True when this page is at some other address and is being sent to dizayr.com, so the app shouldn't start. */
export const movingHome = location.hostname !== HOME && !LOCAL.includes(location.hostname)

if (movingHome) {
  const target = `https://${HOME}${location.pathname}${location.search}${location.hash}`
  const go = () => location.replace(target)
  // The old address's offline copy would otherwise keep opening the old app with no internet.
  const cleanup = Promise.all([
    navigator.serviceWorker?.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))),
    globalThis.caches?.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))),
  ])
  // Moves on even if clearing fails or hangs.
  Promise.race([cleanup, new Promise((r) => setTimeout(r, 1500))]).then(go, go)
}
