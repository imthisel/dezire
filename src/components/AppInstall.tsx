import { useState, type ReactNode } from 'react'
import { Check, CloudOff, Download, Loader2, Monitor, MoreVertical, RefreshCw, RefreshCcw, Share, Smartphone, SquarePlus, Sparkles, X } from 'lucide-react'
import { applyUpdate, checkForUpdate, closeGuide, installApp, platform, snoozeUpdate, useApp, type Platform } from '../appUpdate'
import { Modal } from './Modal'

const builtDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/** "A new version is ready": shown whenever the site has a newer version than the one running. */
export function UpdateBanner() {
  const update = useApp((s) => s.update)
  const snoozed = useApp((s) => s.snoozed)
  const [busy, setBusy] = useState(false)
  if (!update || snoozed) return null
  return (
    <div
      role="status"
      className="animate-rise fixed inset-x-3 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-[55] mx-auto flex max-w-md items-center gap-3 rounded-2xl border border-indigo-400/30 bg-[#11131b]/95 p-3 pl-3.5 shadow-2xl shadow-black/60 backdrop-blur-xl sm:inset-x-auto sm:bottom-6 sm:right-6 sm:mx-0"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/25">
        <Sparkles className="h-5 w-5 text-white" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-white">A new version of Dizayr is ready</span>
        <span className="block text-xs text-zinc-400">Takes a second. Your plan stays exactly as it is.</span>
      </span>
      <button onClick={snoozeUpdate} className="hidden h-9 shrink-0 rounded-lg px-2.5 text-xs font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white sm:block">
        Later
      </button>
      <button
        onClick={async () => {
          setBusy(true)
          await applyUpdate()
        }}
        disabled={busy}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 px-3 text-xs font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-70"
      >
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        {busy ? 'Updating…' : 'Update now'}
      </button>
      <button onClick={snoozeUpdate} aria-label="Later" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/5 hover:text-white sm:hidden">
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}

/** How to install Dizayr on this device, step by step (for browsers that don't offer a one-tap install). */
export function InstallGuide() {
  const open = useApp((s) => s.guideOpen)
  const [tab, setTab] = useState<Platform>(platform)
  if (!open) return null
  const tabs: { id: Platform; label: string; icon: typeof Smartphone }[] = [
    { id: 'ios', label: 'iPhone / iPad', icon: Smartphone },
    { id: 'android', label: 'Android', icon: Smartphone },
    { id: 'desktop', label: 'Computer', icon: Monitor },
  ]
  return (
    <Modal title="Get the Dizayr app" subtitle="Free with your account · opens like an app · works offline · stays in sync" onClose={closeGuide} width="max-w-lg">
      <div className="grid grid-cols-3 gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            aria-pressed={tab === t.id}
            className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-medium transition ${tab === t.id ? 'bg-indigo-500/25 text-white ring-1 ring-indigo-400/40' : 'text-zinc-400 hover:text-white'}`}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <ol key={tab} className="animate-fade mt-5 space-y-3">
        {tab === 'ios' && (
          <>
            <Step n={1} icon={<Share className="h-4 w-4" />}>
              Open this site in <b>Safari</b> (or Chrome) and tap the <b>Share</b> button: the square with an arrow, at the bottom of the screen in Safari.
            </Step>
            <Step n={2} icon={<SquarePlus className="h-4 w-4" />}>
              Scroll down and tap <b>Add to Home Screen</b>.
            </Step>
            <Step n={3} icon={<Check className="h-4 w-4" />}>
              Tap <b>Add</b>. Dizayr is now on your home screen. Open it and sign in once with Google.
            </Step>
          </>
        )}
        {tab === 'android' && (
          <>
            <Step n={1} icon={<MoreVertical className="h-4 w-4" />}>
              In <b>Chrome</b>, tap the <b>⋮</b> menu at the top right.
            </Step>
            <Step n={2} icon={<Download className="h-4 w-4" />}>
              Tap <b>Install app</b> (or <b>Add to Home screen</b> → <b>Install</b>).
            </Step>
            <Step n={3} icon={<Check className="h-4 w-4" />}>
              Dizayr appears with your other apps. Open it from there.
            </Step>
          </>
        )}
        {tab === 'desktop' && (
          <>
            <Step n={1} icon={<Download className="h-4 w-4" />}>
              In <b>Chrome</b> or <b>Edge</b>, click the <b>install icon</b> at the right end of the address bar (a small screen with an arrow), then <b>Install</b>.
            </Step>
            <Step n={2} icon={<MoreVertical className="h-4 w-4" />}>
              Don’t see it? Open the browser menu (<b>⋮</b> or <b>…</b>) → <b>Cast, save and share → Install page as app</b> in Chrome, or <b>Apps → Install this site as an app</b> in Edge.
            </Step>
            <Step n={3} icon={<Monitor className="h-4 w-4" />}>
              On a Mac with <b>Safari</b>: <b>File → Add to Dock</b>. Firefox can’t install apps; use Chrome, Edge or Safari for this step.
            </Step>
          </>
        )}
      </ol>

      <div className="mt-5 grid gap-2 rounded-xl border border-white/[0.07] bg-white/[0.02] p-3 text-xs text-zinc-400 sm:grid-cols-3">
        <span className="flex items-center gap-1.5"><RefreshCcw className="h-3.5 w-3.5 text-emerald-300" /> Synced with the website</span>
        <span className="flex items-center gap-1.5"><CloudOff className="h-3.5 w-3.5 text-amber-300" /> Works offline</span>
        <span className="flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5 text-indigo-300" /> Updates by itself</span>
      </div>
    </Modal>
  )
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-indigo-500/15 text-sm font-bold text-indigo-200">{n}</span>
      <span className="flex min-w-0 flex-1 gap-2 pt-1.5 text-sm leading-relaxed text-zinc-300 [&_b]:font-semibold [&_b]:text-white">
        <span className="mt-0.5 shrink-0 text-zinc-500">{icon}</span>
        <span>{children}</span>
      </span>
    </li>
  )
}

/** Settings (account menu): the version, Check for updates, and installing the app. */
export function AppSettings({ onAction }: { onAction?: () => void }) {
  const { version, builtAt, update, checking, installed } = useApp()
  return (
    <div className="border-b border-white/[0.06] p-4">
      <p className="mb-2 flex items-center justify-between text-xs font-medium text-zinc-400">
        <span>App</span>
        <span className="font-normal tabular-nums text-zinc-600">
          Version {version}
          {version !== 'dev' && builtDate(builtAt) && ` · ${builtDate(builtAt)}`}
        </span>
      </p>
      <div className="grid grid-cols-2 gap-2">
        {update ? (
          <button
            onClick={() => void applyUpdate()}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-r from-indigo-500 to-indigo-400 text-xs font-semibold text-white"
          >
            <Sparkles className="h-3.5 w-3.5" /> Update now
          </button>
        ) : (
          <button
            onClick={() => void checkForUpdate(true)}
            disabled={checking}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-zinc-200 transition hover:bg-white/5 disabled:opacity-60"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? 'animate-spin' : ''}`} /> Check for updates
          </button>
        )}
        {installed ? (
          <span className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-emerald-400/10 text-xs font-medium text-emerald-200">
            <Check className="h-3.5 w-3.5" /> Installed
          </span>
        ) : (
          <button
            onClick={() => {
              onAction?.()
              void installApp()
            }}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-white/10 text-xs font-medium text-zinc-200 transition hover:bg-white/5"
          >
            <Download className="h-3.5 w-3.5" /> Install the app
          </button>
        )}
      </div>
    </div>
  )
}

/** About page: get the app. */
export function DownloadSection() {
  const installed = useApp((s) => s.installed)
  const tiles = [
    { icon: Smartphone, title: 'On your phone', text: 'An icon on your home screen that opens straight into your plan, full screen.', cls: 'text-sky-300 bg-sky-400/10' },
    { icon: Monitor, title: 'On your computer', text: 'Its own window and a place in your apps, Start menu or Dock. No browser tabs.', cls: 'text-indigo-300 bg-indigo-400/10' },
    { icon: CloudOff, title: 'Offline, still saved', text: 'Plan on a plane or a weak signal. Your edits are kept and sync the moment you’re back.', cls: 'text-amber-300 bg-amber-400/10' },
    { icon: RefreshCcw, title: 'Always in sync', text: 'Same account, same plan as the website, on every device. Updates arrive by themselves.', cls: 'text-emerald-300 bg-emerald-400/10' },
  ]
  return (
    <section id="download" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div data-reveal className="reveal mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">Get the app</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[2.6rem] sm:leading-tight">Take your plan everywhere.</h2>
          <p className="mt-4 text-lg text-zinc-400">Install Dizayr on your phone or computer in a few seconds. Nothing to download from an app store, and it’s included with your account.</p>
        </div>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {tiles.map((t, i) => (
            <div key={t.title} data-reveal className="reveal rounded-3xl border border-white/[0.07] bg-[#0c0e14] p-6" style={{ transitionDelay: `${i * 70}ms` }}>
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${t.cls}`}>
                <t.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-white">{t.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-zinc-400">{t.text}</p>
            </div>
          ))}
        </div>
        <div data-reveal className="reveal mt-10 flex flex-col items-center gap-3">
          {installed ? (
            <p className="inline-flex items-center gap-2 rounded-2xl bg-emerald-400/10 px-5 py-3 text-sm font-medium text-emerald-200">
              <Check className="h-4 w-4" /> You’re using the Dizayr app
            </p>
          ) : (
            <button
              onClick={() => void installApp()}
              className="group inline-flex h-14 items-center gap-3 rounded-2xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-7 text-base font-semibold text-white shadow-xl shadow-indigo-500/25 transition hover:-translate-y-0.5 hover:brightness-110"
            >
              <Download className="h-5 w-5 transition group-hover:translate-y-0.5" /> Download the app
            </button>
          )}
          <p className="text-sm text-zinc-500">iPhone, iPad, Android, Windows, Mac and Chromebook</p>
        </div>
      </div>
    </section>
  )
}
