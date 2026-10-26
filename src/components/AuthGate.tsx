import { useEffect, useState, type ReactNode } from 'react'
import { Loader2, Target } from 'lucide-react'
import { firebaseConfigured } from '../lib/firebase'
import { retryLoad, startCloud, useCloud } from '../cloud'
import { useAccess } from '../billing'
import { About, TrialEnded } from './About'

/**
 * Shows the app only to a signed-in account that may use it (free trial, a plan, or lifetime) once its data has loaded.
 * Signed out: the About page (also always at /about). Trial over and no plan: the page to pick one.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, ready, loadError } = useCloud()
  const access = useAccess((s) => s.state)

  useEffect(() => startCloud(), [])

  if (!firebaseConfigured) return <NotConfigured />
  if (location.pathname.replace(/\/$/, '') === '/about') return <About />
  if (!user) return ready ? <About /> : <Splash />
  if (access === 'ended') return <TrialEnded />
  if (!ready || access === 'checking') return <Splash />
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
