import { GoogleAuthProvider, signInWithCredential } from 'firebase/auth'
import { auth } from './lib/firebase'

/*
 * Google sign-in on phones and tablets, in the same tab, without Firebase's sign-in page (/__/auth/handler).
 *
 * That page keeps what it needs for the trip to Google in sessionStorage, which some phones lose on the way back
 * (Safari privacy settings, Google opening in another tab, the installed app): "missing initial state". Here the trip is:
 *   1. Firebase makes the Google sign-in link, with this site's /auth as where Google comes back to.
 *   2. The tab goes to Google. What's needed to check the answer is kept in localStorage, which every tab of this site
 *      shares and which isn't cleared on the way.
 *   3. Google comes back to /auth with a sign-in token; Firebase signs in with it, and the tab goes back to where it was.
 * Google only comes back to /auth if it's listed as an authorized redirect URI of the project's OAuth client (see README.md,
 * "Sign-in on phones").
 */

const KEY = 'dizayr-google-signin'
/** Where Google comes back to. */
export const AUTH_PATH = '/auth'
/** How long a sign-in that was started can still be finished. */
const VALID_FOR = 15 * 60_000

type Pending = { state: string; back: string; at: number }

/** Goes to Google to sign in. Never resolves: the tab leaves the page. */
export async function startGoogleRedirect(): Promise<never> {
  const res = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:createAuthUri?key=${import.meta.env.VITE_FIREBASE_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: 'google.com', continueUri: location.origin + AUTH_PATH }),
  })
  const body = (await res.json().catch(() => ({}))) as { authUri?: string; error?: { message?: string } }
  if (!res.ok || !body.authUri) throw new Error(body.error?.message ?? 'sign_in_link_failed')
  const url = new URL(body.authUri)
  url.searchParams.set('prompt', 'select_account')
  const pending: Pending = { state: url.searchParams.get('state') ?? '', back: location.pathname + location.search, at: Date.now() }
  localStorage.setItem(KEY, JSON.stringify(pending))
  location.assign(url.toString())
  return new Promise<never>(() => {})
}

/** Whether this page is Google coming back from a sign-in. */
export const isGoogleReturn = () => location.pathname === AUTH_PATH

/**
 * On /auth: signs in with what Google sent back, then goes back to the page the sign-in started from.
 * Returns an error message to show if it didn't work (the page then still goes back, after a moment).
 */
export async function finishGoogleRedirect(): Promise<string | null> {
  const answer = new URLSearchParams(location.hash.slice(1))
  let pending: Pending | null = null
  try {
    pending = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Pending | null
    localStorage.removeItem(KEY)
  } catch {
    // Nothing kept: treated as an expired sign-in below.
  }
  const back = pending?.back && pending.back.startsWith('/') && !pending.back.startsWith('//') ? pending.back : '/'
  // The token is in the address: take it out of the history straight away.
  history.replaceState(null, '', AUTH_PATH)
  const go = () => location.replace(back)

  const token = answer.get('id_token')
  if (answer.get('error') || !token) {
    go()
    return null // closed or cancelled on Google's side: just go back
  }
  if (!pending || !pending.state || answer.get('state') !== pending.state || Date.now() - pending.at > VALID_FOR || !auth) {
    setTimeout(go, 2500)
    return 'That sign-in took too long or was started somewhere else. Please try again.'
  }
  try {
    await signInWithCredential(auth, GoogleAuthProvider.credential(token))
    go()
    return null
  } catch (e) {
    console.error(e)
    setTimeout(go, 2500)
    return 'Sign-in didn’t go through. Please try again.'
  }
}
