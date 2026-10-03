import { useEffect, useState, type ReactNode } from 'react'
import { Cloud, Flag, Loader2, LineChart, ShieldCheck, Target } from 'lucide-react'
import { firebaseConfigured } from '../lib/firebase'
import { retryLoad, signIn, startCloud, useCloud } from '../cloud'

/** Shows the app only to a signed-in user whose data has loaded. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready, loadError } = useCloud()

  useEffect(() => startCloud(), [])

  if (!firebaseConfigured) return <NotConfigured />
  if (!ready) return <Splash />
  if (!user) return <SignIn />
  if (loadError) return <LoadError message={loadError} />
  return <>{children}</>
}

function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-[#07080c] px-4 py-10 text-zinc-100 antialiased">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/4 h-[420px] w-[620px] rounded-full bg-indigo-600/20 blur-[120px]" />
        <div className="absolute -bottom-40 right-0 h-[360px] w-[480px] rounded-full bg-emerald-500/10 blur-[120px]" />
      </div>
      <div className="relative w-full max-w-md">{children}</div>
    </div>
  )
}

function Logo({ size = 'h-14 w-14' }: { size?: string }) {
  return (
    <div className={`mx-auto grid ${size} place-items-center rounded-2xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/25`}>
      <Target className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
    </div>
  )
}

function Splash() {
  return (
    <Shell>
      <div className="animate-fade flex flex-col items-center gap-4 text-center">
        <Logo />
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your plan…
        </p>
      </div>
    </Shell>
  )
}

function SignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function go() {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      console.error(e)
      setError('Sign-in failed. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <div className="animate-pop rounded-3xl border border-white/10 bg-[#0e1016]/80 p-7 shadow-2xl shadow-black/60 backdrop-blur-xl sm:p-9">
        <Logo />
        <h1 className="mt-5 text-center text-3xl font-bold tracking-tight text-white">Dezire</h1>
        <p className="mt-2 text-center text-sm text-zinc-400">Plan your money, your things and who you want to become, 2026 to 2040.</p>

        <ul className="mt-7 space-y-3 text-sm">
          <Feature icon={LineChart} cls="bg-indigo-500/15 text-indigo-300">Monthly goals, budgets and net worth in ₱</Feature>
          <Feature icon={Flag} cls="bg-fuchsia-500/15 text-fuchsia-300">Yearly goals for career, health, status and identity</Feature>
          <Feature icon={Cloud} cls="bg-sky-500/15 text-sky-300">Saved to your account automatically, on every device</Feature>
          <Feature icon={ShieldCheck} cls="bg-emerald-500/15 text-emerald-300">Private: only you can see your data</Feature>
        </ul>

        <button
          onClick={go}
          disabled={busy}
          className="mt-8 flex h-12 w-full items-center justify-center gap-3 rounded-xl bg-white text-[15px] font-semibold text-zinc-900 shadow-lg shadow-black/30 transition hover:bg-zinc-100 disabled:opacity-60"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
          Continue with Google
        </button>
        {error && <p className="animate-fade mt-3 text-center text-sm text-red-300">{error}</p>}
      </div>
    </Shell>
  )
}

function Feature({ icon: Icon, cls, children }: { icon: typeof Cloud; cls: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${cls}`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-zinc-300">{children}</span>
    </li>
  )
}

function LoadError({ message }: { message: string }) {
  return (
    <Shell>
      <div className="animate-pop rounded-3xl border border-white/10 bg-[#0e1016]/80 p-8 text-center">
        <Logo size="h-12 w-12" />
        <p className="mt-5 text-zinc-200">{message}</p>
        <button onClick={retryLoad} className="mt-6 h-10 rounded-xl bg-indigo-500 px-5 text-sm font-semibold text-white transition hover:bg-indigo-400">
          Try again
        </button>
      </div>
    </Shell>
  )
}

function NotConfigured() {
  return (
    <Shell>
      <div className="rounded-3xl border border-amber-400/30 bg-amber-500/5 p-8">
        <h1 className="text-lg font-semibold text-amber-200">Firebase isn't set up yet</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Add the <code className="text-zinc-200">VITE_FIREBASE_*</code> values to <code className="text-zinc-200">.env.local</code> (or to your
          hosting provider's environment variables) and restart. See the README.
        </p>
      </div>
    </Shell>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}
