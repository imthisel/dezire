import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode, type RefObject } from 'react'
import {
  ArrowRight, BadgeCheck, Check, ChevronDown, Cloud, CreditCard, Download, EyeOff, Fingerprint, KeyRound, Loader2, Lock, LogOut, Quote, Server,
  ShieldCheck, Smartphone, Star,
} from 'lucide-react'
import { signIn, signOut, useCloud } from '../cloud'
import { forgetIntent, openBilling, openCheckout, rememberIntent, upgradeToYearly, useAccess } from '../billing'
import { auth } from '../lib/firebase'
import { PLANS, TRIAL_DAYS, dollars, paymentsReady, perMonth, type Plan, type PlanId } from '../lib/plans'
import { EXAMPLE_REVIEWS, REVIEWS, type Review } from '../content/reviews'
import { DownloadSection } from './AppInstall'
import { ContactDialog } from './Help'
import { LEGAL } from '../lib/legal'
import { MAX_SPAN } from '../lib/time'
import { GoalsFloat, GoalsPreview, IncomePreview, LifeGoalsPreview, MonthOverview, NetWorthFloat } from './about/Previews'
import { TryOverview } from './about/TryOverview'
import { TryExpenses } from './about/TryExpenses'
import { TrySetups } from './about/TrySetups'
import { TryAssets } from './about/TryAssets'
import { TryIncome } from './about/TryIncome'
import { BrandLogo } from './BrandLogo'
import { ContactButton } from './EmailContact'

// ---- Actions ----

/** Signs in with Google (starts the free trial on the first time); errors are shown where the button is. */
function useSignIn() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  async function go() {
    setBusy(true)
    setError(null)
    try {
      await signIn()
    } catch (e) {
      console.error(e)
      setError('Sign-in didn’t go through. Please try again.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, go }
}

/**
 * Buying a plan right away, with or without trying it first: when signed in, checkout opens now; otherwise they sign in
 * with Google and checkout opens straight after (see `watchAccess`). The plan starts the day they pay.
 */
async function choose(plan: PlanId) {
  const user = useCloud.getState().user
  if (user) return openCheckout(plan, user)
  rememberIntent(plan)
  try {
    await signIn()
  } finally {
    // Closed the Google window without signing in: don't open checkout the next time they do.
    if (!auth?.currentUser) forgetIntent()
  }
}

/** Elements marked `data-reveal` fade up as they scroll into view. */
function useReveal() {
  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('[data-reveal]')
    if (!('IntersectionObserver' in window)) return els.forEach((el) => el.setAttribute('data-shown', ''))
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          e.target.setAttribute('data-shown', '')
          io.unobserve(e.target)
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 },
    )
    els.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}

/** Feeds the page's scroll position to `.parallax-*` inside `ref` (nothing moves for reduced motion). */
function useParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.hasAttribute('data-calm')) return
    let raf = 0
    const on = () => {
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(() => el.style.setProperty('--py', String(Math.min(window.scrollY, 1000))))
    }
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => {
      window.removeEventListener('scroll', on)
      cancelAnimationFrame(raf)
    }
  }, [ref])
}

/** The tab title while this page is open (the app's own title comes back after). */
function useTitle(title: string) {
  useEffect(() => {
    const before = document.title
    document.title = title
    return () => {
      document.title = before === title ? 'Dizayr' : before
    }
  }, [title])
}

// ---- The page ----

/** The About page: what Dizayr is, why it matters, what it does, and what it costs. Shown before signing in. */
export function About() {
  const user = useCloud((s) => s.user)
  const signin = useSignIn()
  useReveal()
  useTitle('Dizayr')

  return (
    <div className="about relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <a href="#main" className="sr-only z-50 rounded-lg bg-brand-600 px-4 py-2 font-medium text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4">
        Skip to content
      </a>
      <Glow />
      <Nav signedIn={!!user} signin={signin} />

      <main id="main">
        <Hero signedIn={!!user} signin={signin} />
        <Problem />
        <TryItNow />
        <Verse />
        <Features />
        <Numbers />
        <PrayAct />
        <Security />
        <DownloadSection />
        <Reviews />
        <Pricing signin={signin} />
        <Faq />
        <FinalCta signedIn={!!user} signin={signin} />
      </main>

      <Footer />

    </div>
  )
}

type SignIn = ReturnType<typeof useSignIn>

/** One warm light at the top of the page, nothing else. */
function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[1100px]">
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_50%_0%,rgb(58_109_240/0.13),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(40%_35%_at_85%_30%,rgb(58_109_240/0.05),transparent_70%)]" />
    </div>
  )
}

function Logo({ size = 'h-9 w-9' }: { size?: string }) {
  return <BrandLogo className={`${size} drop-shadow-[0_6px_18px_rgb(58_109_240/0.35)]`} />
}

const primaryBtn =
  'group inline-flex items-center justify-center gap-3 rounded-full bg-brand-600 font-semibold text-white shadow-[0_12px_40px_-12px_rgb(58_109_240/0.55)] transition duration-300 hover:-translate-y-0.5 hover:bg-brand-500 hover:shadow-[0_18px_50px_-12px_rgb(58_109_240/0.7)] active:translate-y-0 disabled:opacity-60'

function GoogleButton({ signin, label = 'Start building your vision', big = false }: { signin: SignIn; label?: string; big?: boolean }) {
  return (
    <div className="flex w-full flex-col items-center gap-2 sm:w-auto sm:items-start">
      <button onClick={signin.go} disabled={signin.busy} className={`${primaryBtn} w-full sm:w-auto ${big ? 'h-14 px-7 text-base' : 'h-12 px-6 text-[15px]'}`}>
        <span className="grid h-7 w-7 place-items-center rounded-full bg-white">
          {signin.busy ? <Loader2 className="h-4 w-4 animate-spin text-brand-600" /> : <GoogleIcon />}
        </span>
        {label}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </button>
      {signin.error && (
        <p role="alert" className="animate-fade text-sm text-rose-300">
          {signin.error}
        </p>
      )}
    </div>
  )
}

function OpenApp({ big = false }: { big?: boolean }) {
  return (
    <a href="/" className={`${primaryBtn} ${big ? 'h-14 px-7 text-base' : 'h-10 px-4 text-sm'}`}>
      Open your plan <ArrowRight className="h-4 w-4" />
    </a>
  )
}

function Nav({ signedIn, signin }: { signedIn: boolean; signin: SignIn }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07080c]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-5 sm:px-8">
        <a href="#top" className="flex items-center gap-2.5" aria-label="Dizayr, back to top">
          <Logo />
          <span className="text-lg font-semibold tracking-tight text-white">Dizayr</span>
        </a>
        <nav aria-label="Main" className="hidden items-center gap-7 text-sm text-zinc-400 lg:flex">
          <a href="#try" className="transition hover:text-white">Try it now</a>
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#security" className="transition hover:text-white">Security</a>
          <a href="#pricing" className="transition hover:text-white">Pricing</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </nav>
        {signedIn ? (
          <OpenApp />
        ) : (
          <div className="flex items-center gap-1">
            <button onClick={signin.go} className="hidden h-10 rounded-full px-4 text-sm font-medium text-zinc-300 transition hover:text-white sm:block">
              Sign in
            </button>
            <button
              onClick={signin.go}
              disabled={signin.busy}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:opacity-60"
            >
              {signin.busy && <Loader2 className="h-4 w-4 animate-spin" />} Try it free
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

// ---- Hero ----

function Hero({ signedIn, signin }: { signedIn: boolean; signin: SignIn }) {
  const ref = useRef<HTMLElement>(null)
  useParallax(ref)
  // The first screen: the hero and the trust bar under it fill exactly one screen below the sticky bar. On phones the words
  // and buttons fill the first screen on their own and the drawn month follows. On short laptop screens the small
  // floating cards step aside and the headline shrinks a little, so nothing is ever cut off.
  return (
    <section ref={ref} id="top" aria-label="Dizayr" className="relative flex scroll-mt-16 flex-col lg:min-h-[calc(100svh-4rem-1px)]">
      <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-10 px-5 sm:px-8 lg:grid-cols-[1.08fr_1fr] lg:gap-14 lg:py-[clamp(1.5rem,4svh,3rem)]">
        <div className="flex min-h-[calc(100svh-4rem-1px)] flex-col justify-center py-8 text-center lg:min-h-0 lg:py-0 lg:text-left">
          <a
            href="#try"
            className="hero-in mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] py-1 pl-1 pr-3.5 text-xs text-zinc-300 transition hover:border-brand-300/40 hover:text-white lg:mx-0 lg:self-start [@media(max-height:700px)]:mb-4"
            style={{ ['--d' as string]: '0ms' }}
          >
            <span className="rounded-full bg-brand-600 px-2 py-0.5 font-semibold text-white">New</span>
            Wants, Expenses & Setups, all in one plan <ArrowRight className="h-3 w-3" />
          </a>
          <h1
            className="hero-in font-display font-semibold tracking-[-0.035em] text-[2.9rem] leading-[1] text-white sm:text-[4rem] lg:text-[4.6rem] [@media(min-width:1024px)_and_(max-height:760px)]:text-[3.7rem]"
            style={{ ['--d' as string]: '80ms' }}
          >
            A private space for <span className="text-brand-300">the life you want.</span>
          </h1>
          <p className="hero-in mx-auto mt-6 max-w-lg text-lg leading-relaxed text-zinc-300 lg:mx-0" style={{ ['--d' as string]: '180ms' }}>
            Build a visual version of the life you want. Give every dream a price and a date, then work toward it, one month at a time.
          </p>
          <div className="hero-in mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ ['--d' as string]: '280ms' }}>
            {signedIn ? <OpenApp big /> : <GoogleButton signin={signin} big />}
            <a href="#try" className="inline-flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-medium text-zinc-300 transition hover:text-white">
              Try it now <ChevronDown className="h-4 w-4" />
            </a>
          </div>
          {!signedIn && (
            <p className="hero-in mt-5 text-sm text-zinc-400" style={{ ['--d' as string]: '380ms' }}>
              {TRIAL_DAYS} days free · No card needed ·{' '}
              <a href="#pricing" className="text-brand-200 underline decoration-brand-300/40 underline-offset-4 transition hover:text-brand-100">
                or plans from {perMonth(PLANS.annual)}/month
              </a>
            </p>
          )}

          {/* Where this year stands: goals ticked off, net worth on track (only where there's room for it) */}
          <div className="hero-in mt-10 hidden justify-center gap-4 lg:flex lg:justify-start [@media(max-height:879px)]:!hidden" style={{ ['--d' as string]: '460ms' }} aria-hidden>
            <GoalsFloat />
            <NetWorthFloat />
          </div>
        </div>

        {/* The app, drawn: one month of the life you're planning */}
        <div className="hero-in relative mx-auto mb-12 w-full max-w-[440px] lg:mb-0 lg:mr-0" style={{ ['--d' as string]: '220ms' }} aria-hidden>
          <div className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(58_109_240/0.12),transparent)]" />
          <div className="parallax-a relative [@media(min-width:1024px)_and_(max-height:720px)]:[zoom:0.86]">
            <MonthOverview />
          </div>
        </div>
      </div>
      <TrustBar />
    </section>
  )
}

// ---- The problem ----

function Problem() {
  const points = [
    { k: 'Unwritten', text: 'If it only lives in your head, it’s easy to quietly let it go.' },
    { k: 'Unpriced', text: '“Someday” has no number, so it never gets a plan.' },
    { k: 'Untracked', text: 'Nothing measures it, so you never know if you’re getting closer.' },
  ]
  return (
    <section aria-labelledby="problem-title" className="border-t border-white/[0.06] px-5 sm:px-8 sec">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="reveal max-w-3xl">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">The quiet problem</p>
          <h2 id="problem-title" className="mt-5 font-display font-semibold tracking-[-0.035em] text-[2.6rem] leading-[1.02] text-white sm:text-6xl">
            Most dreams never make it out of your head.
          </h2>
        </div>
        <div className="mt-10 sm:mt-12 grid gap-px overflow-hidden rounded-[28px] border border-white/[0.07] bg-white/[0.07] md:grid-cols-3">
          {points.map((p, i) => (
            <div key={p.k} data-reveal className="reveal bg-[#07080c] p-7 sm:p-9" style={{ transitionDelay: `${i * 90}ms` }}>
              <p className="text-2xl font-semibold tracking-tight text-brand-300">{p.k}.</p>
              <p className="mt-3 text-[17px] leading-relaxed text-zinc-300">{p.text}</p>
            </div>
          ))}
        </div>
        <p data-reveal className="reveal mt-12 max-w-2xl text-xl leading-relaxed text-zinc-300">
          Wanting it was never the problem. <span className="text-white">Seeing it clearly is.</span> That’s where Dizayr starts.
        </p>
      </div>
    </section>
  )
}

// ---- Try it ----

type TryTab = 'wants' | 'assets' | 'income' | 'expenses' | 'setups'
/** Opens a tab of "Try it now" from elsewhere on the page (detail: the tab). */
const TRY_EVENT = 'dz-try-tab'
const TRY_TABS: { id: TryTab; label: string; sub: string }[] = [
  { id: 'wants', label: 'Wants', sub: 'Plan three months: set a goal, a budget, a net worth to reach, and add what you want.' },
  { id: 'assets', label: 'Assets', sub: 'Everything you plan to own, what it costs, and what it’ll be worth years from now.' },
  { id: 'income', label: 'Income', sub: 'Every way you earn, whether it covers the month’s goal, and the next step for each.' },
  { id: 'expenses', label: 'Expenses', sub: 'Your money on hand, and every expense coming off it. Budget and breakdown update as you log.' },
  { id: 'setups', label: 'Setups', sub: 'Drag the GT3 RS onto a property. Take one off and it counts as sold.' },
]

/**
 * "Try it now": the playgrounds (Wants, Assets, Income, Expenses, Setups) as tabs in one section, shown at the same size as in
 * the app. They share one plan, so a change in one shows in the others.
 */
function TryItNow() {
  const [tab, setTab] = useState<TryTab>('wants')
  useEffect(() => {
    const open = (e: Event) => setTab((e as CustomEvent<TryTab>).detail)
    window.addEventListener(TRY_EVENT, open)
    return () => window.removeEventListener(TRY_EVENT, open)
  }, [])
  const active = TRY_TABS.find((t) => t.id === tab)!
  const tabs = useRef<(HTMLButtonElement | null)[]>([])
  const onKey = (e: KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const n = (i + d + TRY_TABS.length) % TRY_TABS.length
    setTab(TRY_TABS[n].id)
    tabs.current[n]?.focus()
  }
  return (
    <section id="try" aria-labelledby="try-title" className="screen border-t border-white/[0.06] bg-white/[0.012] px-5 sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <div className="flex flex-col items-center gap-5 text-center lg:flex-row lg:items-end lg:justify-between lg:gap-10 lg:text-left">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">Try it now · no sign-up</p>
            <h2 id="try-title" className="mt-3 font-display text-[2.2rem] font-semibold leading-[1.05] tracking-[-0.035em] text-white sm:text-[2.8rem]">
              The real app, right here.
            </h2>
            <p key={tab} className="animate-fade mt-2 max-w-xl text-[15px] text-zinc-300 sm:text-base">{active.sub}</p>
          </div>
          <div role="tablist" aria-label="Try it now" className="flex shrink-0 flex-wrap justify-center gap-1 rounded-full border border-white/[0.08] bg-white/[0.03] p-1">
            {TRY_TABS.map((t, i) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabs.current[i] = el
                }}
                role="tab"
                id={`try-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls="try-panel"
                tabIndex={tab === t.id ? 0 : -1}
                onClick={() => setTab(t.id)}
                onKeyDown={(e) => onKey(e, i)}
                className={`h-9 rounded-full px-4 text-sm font-medium transition ${
                  tab === t.id ? 'bg-brand-600 text-white shadow-[0_6px_20px_-8px_rgb(58_109_240/0.7)]' : 'text-zinc-400 hover:text-white'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div id="try-panel" role="tabpanel" aria-labelledby={`try-tab-${tab}`} className="mt-6">
          <div key={tab} className="animate-fade">
            {tab === 'wants' && <TryOverview part="plan" />}
            {tab === 'assets' && <TryAssets onOpenMonth={() => setTab('wants')} />}
            {tab === 'income' && <TryIncome />}
            {tab === 'expenses' && <TryExpenses />}
            {tab === 'setups' && <TrySetups />}
          </div>
        </div>
      </div>
    </section>
  )
}

// ---- The verse ----

function Verse() {
  const words = 'Write the vision, and make it plain upon tables, that he may run that readeth it.'.split(' ')
  return (
    <section aria-label="Habakkuk 2:2" className="relative overflow-hidden border-y border-white/[0.06] px-5 py-20 sm:px-8 sm:py-28">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(50%_60%_at_50%_50%,rgb(58_109_240/0.07),transparent_75%)]" />
      <figure data-reveal className="relative mx-auto max-w-4xl text-center">
        <blockquote className="font-verse text-[2.1rem] leading-[1.18] text-white sm:text-5xl lg:text-[3.6rem]">
          <p>
            <span aria-hidden className="text-brand-300">“</span>
            {words.map((w, i) => (
              <span key={i} className="verse-word" style={{ transitionDelay: `${150 + i * 55}ms` }}>
                {w}
                {i < words.length - 1 && ' '}
              </span>
            ))}
            <span aria-hidden className="text-brand-300">”</span>
          </p>
        </blockquote>
        <figcaption className="mt-10 text-xs font-semibold uppercase tracking-[0.3em] text-brand-300">Habakkuk 2:2 · KJV</figcaption>
        <p className="mx-auto mt-10 max-w-md text-[17px] leading-relaxed text-zinc-300">
          Write it down. Make it plain. Then run with it.
          <br />
          That’s what Dizayr is for.
        </p>
      </figure>
    </section>
  )
}

// ---- What you can do ----

function Features() {
  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto max-w-6xl px-5 sm:px-8 sec">
      <SectionHead
        id="features-title"
        eyebrow="What you can do"
        title="Your whole life, planned down to this month."
        sub="Start with where you want to end up. Dizayr breaks it into this year’s goals, then into the money and the next step that get you there."
      />
      <div className="mt-10 sm:mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile
          title="Know where your life is going."
          text="Write the goals for your whole life and the age you want each one by. Dizayr shows the year, and how many years you have left."
        >
          <LifeGoalsPreview />
        </Tile>
        <Tile
          title="Make this year count toward it."
          text="Set yearly goals for mind, body, status and who you’re becoming, each linked to the life goal it moves forward."
        >
          <GoalsPreview />
        </Tile>
        <Tile
          className="md:col-span-2 lg:col-span-1"
          title="Know where the money comes from."
          text="Plan every way you earn, see how much of your goal each one covers, and always know the next step."
          href="#try"
          cta="Try the Income plan"
          onCta={() => window.dispatchEvent(new CustomEvent<TryTab>(TRY_EVENT, { detail: 'income' }))}
        >
          <IncomePreview />
        </Tile>
      </div>
    </section>
  )
}

function Tile({ title, text, children, className = '', href, cta, onCta }: { title: string; text: string; children: ReactNode; className?: string; href?: string; cta?: string; onCta?: () => void }) {
  return (
    <article
      data-reveal
      className={`reveal group flex flex-col justify-between gap-8 rounded-[28px] border border-white/[0.07] bg-[#0b0c10] p-6 transition-colors duration-500 hover:border-white/[0.14] sm:p-7 ${className}`}
    >
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2 leading-relaxed text-zinc-400">{text}</p>
        {href && (
          <a href={href} onClick={onCta} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-200 transition hover:text-brand-100">
            {cta} <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </a>
        )}
      </div>
      <div aria-hidden className="transition duration-500 group-hover:-translate-y-1">
        {children}
      </div>
    </article>
  )
}

// ---- Pray for it. Act on it. ----

function PrayAct() {
  const steps = [
    { n: '01', title: 'Envision', text: 'Write it down and see it: the home, the car, the trip, the person you’re becoming.' },
    { n: '02', title: 'Plan', text: 'Give every dream a price and a month. Dizayr does the math and tells you when something doesn’t fit.' },
    { n: '03', title: 'Act', text: 'Track what you earn and spend, tick off your goals, and watch your net worth rise toward it.' },
  ]
  return (
    <section id="how" aria-labelledby="how-title" className="screen px-5 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
        <div data-reveal className="reveal">
          <h2 id="how-title" className="font-display font-semibold tracking-[-0.035em] text-[3.2rem] leading-[0.98] text-white sm:text-7xl">
            Pray for it.
            <br />
            <span className="text-brand-300">Act on it.</span>
          </h2>
          <p className="mt-8 max-w-md text-lg leading-relaxed text-zinc-300">
            A vision is only the first step. Everything after it is action. Faith and work were always meant to go together: write down what
            you’re believing for, then show up for it, month after month.
          </p>
          <p className="mt-8 border-l border-brand-300/40 pl-4 text-zinc-400">
            <span className="font-verse text-xl italic text-zinc-200">“Faith without works is dead.”</span>
            <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-brand-300">James 2:26</span>
          </p>
        </div>

        <ol className="relative space-y-4">
          <span aria-hidden className="absolute bottom-10 left-[2.15rem] top-10 w-px bg-gradient-to-b from-brand-300/50 via-brand-300/20 to-transparent" />
          {steps.map((s, i) => (
            <li
              key={s.n}
              data-reveal
              className="reveal relative flex gap-5 rounded-[24px] border border-white/[0.07] bg-[#0b0c10] p-5 sm:p-6"
              style={{ transitionDelay: `${i * 110}ms` }}
            >
              <span className="relative grid h-11 w-11 shrink-0 place-items-center rounded-full border border-brand-300/40 bg-[#0d1428] text-sm font-semibold tabular-nums text-brand-200">
                {s.n}
              </span>
              <span>
                <span className="block text-xl font-semibold tracking-tight text-white">{s.title}</span>
                <span className="mt-1.5 block leading-relaxed text-zinc-400">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

// ---- Trust bar ----

/** Right under the hero: what Dizayr runs on and how it's protected. Only true things: no invented logos or numbers. */
function TrustBar() {
  const items = [
    { icon: Cloud, text: 'Runs on Google Cloud' },
    { icon: Fingerprint, text: 'Secure Google sign-in' },
    { icon: Lock, text: 'Encrypted in transit & at rest' },
    { icon: CreditCard, text: 'Payments by Paddle' },
    { icon: Smartphone, text: 'Phone, tablet & computer' },
  ]
  return (
    <div aria-label="Built on trusted infrastructure" role="region" className="border-y border-white/[0.06] bg-white/[0.015] px-5 py-6 sm:px-8">
      <ul className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-10 gap-y-3 text-sm text-zinc-400">
        {items.map((it) => (
          <li key={it.text} className="flex items-center gap-2">
            <it.icon className="h-4 w-4 text-brand-300" /> {it.text}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ---- By the numbers ----

function Numbers() {
  const stats = [
    { v: String(MAX_SPAN), unit: 'years', k: 'Planned ahead month by month, from any year you choose' },
    { v: '0', unit: 'ads', k: 'Ever. Your plan is never sold or shared' },
    { v: String(LEGAL.refundDays), unit: 'days', k: 'Full money-back guarantee, no questions asked' },
    { v: '24/7', unit: '', k: 'On every device, synced, even offline' },
  ]
  return (
    <section aria-label="Dizayr by the numbers" className="border-y border-white/[0.06] bg-white/[0.012] px-5 py-16 sm:px-8 sm:py-20">
      <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.k} data-reveal className="reveal border-l border-brand-300/30 pl-5" style={{ transitionDelay: `${i * 80}ms` }}>
            <dt className="sr-only">{s.k}</dt>
            <dd>
              <span className="font-display text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl">{s.v}</span>
              {s.unit && <span className="ml-2 text-lg font-medium text-brand-300">{s.unit}</span>}
              <span aria-hidden className="mt-2 block max-w-[15rem] text-sm leading-relaxed text-zinc-400">{s.k}</span>
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}

// ---- Security & privacy ----

function Security() {
  const points = [
    {
      icon: Fingerprint,
      title: 'Google sign-in, no password',
      text: 'There’s no Dizayr password to steal, guess or leak. Google checks it’s you, with the same protection as your Gmail: 2-Step Verification, passkeys and new-sign-in alerts.',
    },
    {
      icon: KeyRound,
      title: 'Locked to your account',
      text: 'Our servers check every single request. Your plan opens for your Google account and nobody else’s, not another user, not someone with the link.',
    },
    {
      icon: Server,
      title: 'Encrypted on Google Cloud',
      text: 'Everything travels over HTTPS and is stored encrypted on Google’s infrastructure, the same that runs Gmail and Google Drive.',
    },
    {
      icon: CreditCard,
      title: 'We never see your card',
      text: 'Payments go through Paddle’s secure checkout. Your card number never touches Dizayr.',
    },
    {
      icon: EyeOff,
      title: 'Never sold, never shared',
      text: 'Your dreams aren’t data for advertisers. We don’t sell, rent or share them. No ads, ever.',
    },
    { icon: Download, title: 'Yours to keep', text: 'Export a full backup of everything, whenever you like.' },
  ]
  return (
    <section id="security" aria-labelledby="security-title" className="screen border-t border-white/[0.06] px-5 sm:px-8">
      <div className="mx-auto w-full max-w-6xl">
        <div data-reveal className="reveal grid items-end gap-6 lg:grid-cols-[1.25fr_1fr] lg:gap-16">
          <div>
            <p className="flex items-center gap-2.5 text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">
              <ShieldCheck className="h-4 w-4" /> Security & privacy
            </p>
            <h2 id="security-title" className="mt-4 font-display font-semibold tracking-[-0.035em] text-[2.6rem] leading-[1.02] text-white sm:text-[3.4rem] [@media(min-width:1024px)_and_(max-height:720px)]:text-[2.7rem]">
              Your dreams are yours. And they’re safe.
            </h2>
          </div>
          <div>
            <p className="text-lg leading-relaxed text-zinc-300">
              Some of what you want, you haven’t told anyone yet. Dizayr is built so it stays that way: private by design, protected at every step.
            </p>
            <a href="#faq" className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-200 transition hover:text-brand-100">
              How sign-in keeps you safe <ArrowRight className="h-3.5 w-3.5" />
            </a>
          </div>
        </div>
        <ul className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 [@media(min-width:1024px)_and_(max-height:720px)]:mt-6">
          {points.map((p, i) => (
            <li key={p.title} data-reveal className="reveal rounded-[24px] border border-white/[0.07] bg-[#0b0c10] p-5 sm:p-6 [@media(min-width:1024px)_and_(max-height:720px)]:p-5" style={{ transitionDelay: `${(i % 3) * 70}ms` }}>
              <h3 className="flex items-center gap-3 font-semibold text-white">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-brand-300/25 bg-brand-300/[0.06]">
                  <p.icon className="h-4 w-4 text-brand-200" />
                </span>
                {p.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-zinc-400 [@media(min-width:1024px)_and_(max-height:720px)]:mt-2 [@media(min-width:1024px)_and_(max-height:720px)]:text-sm">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

// ---- Footer ----

function Footer() {
  const link = 'transition hover:text-white'
  const cols: { title: string; links: [string, string][] }[] = [
    { title: 'Product', links: [['Try it now', '#try'], ['How it works', '#how'], ['Download', '#download'], ['Pricing', '#pricing']] },
    { title: 'Trust', links: [['Security', '#security'], ['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Refunds', '/refunds']] },
    { title: 'Support', links: [['Questions', '#faq'], ['Contact us', 'contact']] },
  ]
  return (
    <footer className="border-t border-white/[0.06] px-5 pb-10 pt-16 text-sm text-zinc-400 sm:px-8">
      <div className="mx-auto grid max-w-6xl gap-12 md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div>
          <span className="flex items-center gap-2.5">
            <Logo size="h-8 w-8" /> <span className="text-base font-semibold text-zinc-100">Dizayr</span>
          </span>
          <p className="mt-4 max-w-xs leading-relaxed">A private space for the life you want. Write the vision, make it plain, then run with it.</p>
          <p className="mt-5 flex items-center gap-2 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-brand-300" /> Secure Google sign-in · Encrypted · Never sold
          </p>
        </div>
        {cols.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-200">{c.title}</p>
            <ul className="mt-4 space-y-2.5">
              {c.links.map(([t, href]) => (
                <li key={t}>
                  {href === 'contact' ? (
                    <ContactButton className={link}>{t}</ContactButton>
                  ) : (
                    <a href={href} className={link}>
                      {t}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="mx-auto mt-14 flex max-w-6xl flex-col items-center justify-between gap-3 border-t border-white/[0.06] pt-6 text-xs text-zinc-500 sm:flex-row">
        <span>© {new Date().getFullYear()} Dizayr. All rights reserved.</span>
        <span>Payments processed securely by Paddle.com</span>
      </div>
    </footer>
  )
}

// ---- Reviews ----

/** Real reviews; while developing locally with none filled in yet, labeled examples so the slider can be seen. */
const reviewsToShow = (): Review[] => (REVIEWS.length ? REVIEWS : import.meta.env.DEV ? EXAMPLE_REVIEWS : [])

function Reviews() {
  const list = reviewsToShow()
  if (!list.length) return null
  // Two rows sliding opposite ways once there are enough reviews to fill both.
  const rows = list.length >= 6 ? [list.filter((_, i) => i % 2 === 0), list.filter((_, i) => i % 2 === 1)] : [list]
  return (
    <section id="reviews" aria-labelledby="reviews-title" className="border-b border-white/[0.06] sec">
      <div className="mx-auto max-w-6xl px-5 sm:px-8">
        <SectionHead id="reviews-title" eyebrow="In their words" title="From people who stopped wishing and started planning." />
      </div>
      <div className="marquee-mask mt-10 sm:mt-12 space-y-5">
        {rows.map((row, r) => (
          <Marquee key={r} items={row} reverse={r === 1} />
        ))}
      </div>
    </section>
  )
}

/** A row of review cards that keeps sliding sideways (pauses on hover; still for reduced motion, where it can be scrolled). */
function Marquee({ items, reverse }: { items: Review[]; reverse?: boolean }) {
  // Enough copies to be wider than any screen; the second half repeats the first so the loop is seamless.
  const copies = Math.max(2, Math.ceil(8 / items.length))
  const half = Array.from({ length: copies }, () => items).flat()
  const seconds = Math.max(30, half.length * 7)
  return (
    <div className="marquee group overflow-hidden">
      <div className={`marquee-track flex w-max gap-5 ${reverse ? 'marquee-reverse' : ''}`} style={{ animationDuration: `${seconds}s` }}>
        {[...half, ...half].map((rv, i) => (
          <ReviewCard key={i} r={rv} hidden={i >= half.length} />
        ))}
      </div>
    </div>
  )
}

function ReviewCard({ r, hidden }: { r: Review; hidden: boolean }) {
  const stars = r.stars ?? 5
  return (
    <figure aria-hidden={hidden || undefined} className="relative w-[320px] shrink-0 rounded-[24px] border border-white/[0.08] bg-[#0b0c10] p-6 sm:w-[380px]">
      <Quote className="absolute right-5 top-5 h-8 w-8 text-white/[0.05]" />
      <div className="flex gap-0.5" role="img" aria-label={`${stars} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < stars ? 'fill-brand-300 text-brand-300' : 'text-zinc-700'}`} />
        ))}
      </div>
      <blockquote className="mt-4 leading-relaxed text-zinc-200">“{r.text}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        {r.photo ? (
          <img src={r.photo} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full border border-brand-300/30 bg-brand-300/10 font-semibold text-brand-100">
            {r.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-semibold text-white">{r.name}</span>
          {r.role && <span className="block truncate text-sm text-zinc-400">{r.role}</span>}
        </span>
      </figcaption>
    </figure>
  )
}

// ---- Pricing ----

/**
 * The plans. On the About page (and the trial-ended page) they wear the page's blue; inside the app (`compact`, from the
 * plans window) they keep the app's own accent colour, which people can change in Settings.
 */
export function Pricing({ signin, compact = false, tone }: { signin?: SignIn; compact?: boolean; tone?: 'brand' | 'app' }) {
  // The plans are also shown inside the app, where the About page isn't there to reveal them.
  useReveal()
  const access = useAccess()
  const user = useCloud((s) => s.user)
  const brand = (tone ?? (compact ? 'app' : 'brand')) === 'brand'
  const order: PlanId[] = ['semiannual', 'annual']
  const onPlan = access.state === 'paid' || access.state === 'comp' || access.state === 'lifetime'
  // A running 6-month subscription can move up to Yearly from here (Paddle's billing page can't change plans).
  const canUpgrade =
    access.state === 'paid' && access.plan === 'semiannual' && (access.status === 'active' || access.status === 'on_trial') && paymentsReady()
  const cards = (
    <div className="mx-auto grid w-full max-w-3xl gap-5 md:grid-cols-2">
      {order.map((id) => (
        <PlanCard
          key={id}
          plan={PLANS[id]}
          featured={id === 'annual'}
          current={onPlan && access.plan === id}
          disabled={onPlan && !(id === 'annual' && canUpgrade)}
          upgrade={id === 'annual' && canUpgrade}
          brand={brand}
        />
      ))}
    </div>
  )
  const trust = (
    <ul className={`flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-400 ${compact ? 'mx-auto mt-10 max-w-3xl justify-center' : 'justify-center lg:grid lg:grid-cols-2 lg:justify-start'}`}>
      <li className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Secure checkout by Paddle</li>
      <li className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> {LEGAL.refundDays}-day money-back</li>
      <li className="flex items-center gap-1.5"><Check className="h-4 w-4" /> Cancel anytime</li>
      <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Your data stays private</li>
    </ul>
  )
  const fine = (
    <p className={`text-xs leading-relaxed text-zinc-500 ${compact ? 'mx-auto mt-5 max-w-2xl text-center' : 'mx-auto mt-8 max-w-3xl text-center lg:mt-6'}`}>
      Prices in US dollars, tax included. Plans renew automatically until you cancel. Orders are processed by Paddle.com, our reseller and
      merchant of record. By buying you agree to the{' '}
      <a href="/terms" className="underline underline-offset-2 hover:text-zinc-300">Terms</a> and{' '}
      <a href="/refunds" className="underline underline-offset-2 hover:text-zinc-300">Refund Policy</a>.
    </p>
  )
  if (compact)
    return (
      <>
        {cards}
        {trust}
        {fine}
      </>
    )
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="screen px-5 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-center gap-10 lg:grid-cols-[0.85fr_1.4fr] lg:gap-14">
        <div data-reveal className="reveal text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">Pricing</p>
          <h2 id="pricing-title" className="mt-5 font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[3.2rem]">
            Less than a coffee a month.
          </h2>
          <p className="mt-4 text-lg text-zinc-300">One plan, everything included. Every feature, every device, as many years ahead as you want.</p>
          {!user && signin && (
            <div className="mt-7 rounded-[24px] border border-white/[0.07] bg-white/[0.02] p-5">
              <p className="text-[15px] text-zinc-300">
                <span className="font-semibold text-white">Rather try it first?</span> Every feature free for {TRIAL_DAYS} days, with one Wants mode
                and one Needs mode. No card, no commitment.
              </p>
              <div className="mt-4 flex justify-center lg:justify-start">
                <GoogleButton signin={signin} label={`Try it free for ${TRIAL_DAYS} days`} />
              </div>
            </div>
          )}
          <div className="mt-6">{trust}</div>
        </div>
        <div>
          {cards}
          {fine}
        </div>
      </div>
    </section>
  )
}

function PlanCard({
  plan, featured, current, disabled, upgrade = false, brand,
}: { plan: Plan; featured: boolean; current: boolean; disabled: boolean; upgrade?: boolean; brand: boolean }) {
  const [busy, setBusy] = useState(false)
  const signedIn = useCloud((s) => !!s.user)
  const included = [...plan.perks, 'Every other feature included', `Plan up to ${MAX_SPAN} years ahead`, 'All your devices, synced', 'Works offline']
  const look = brand
    ? {
        card: featured
          ? 'border border-brand-300/40 bg-gradient-to-b from-brand-300/[0.09] via-[#0b0c10] to-[#0b0c10] shadow-[0_30px_80px_-30px_rgb(58_109_240/0.35)]'
          : 'border border-white/[0.08] bg-[#0b0c10]',
        badge: 'bg-brand-600 text-white',
        save: 'font-semibold text-brand-200',
        check: featured ? 'text-brand-300' : 'text-zinc-500',
        button: featured
          ? 'bg-brand-600 text-white hover:bg-brand-500 disabled:opacity-60'
          : 'border border-white/15 text-white hover:bg-white/5 disabled:opacity-50',
        radius: 'rounded-[28px]',
        btnRadius: 'rounded-full',
      }
    : {
        card: featured
          ? 'border-2 border-indigo-400/60 bg-gradient-to-b from-indigo-500/15 via-[#0c0e14] to-[#0c0e14] shadow-2xl shadow-indigo-500/15'
          : 'border border-white/[0.08] bg-[#0c0e14]',
        badge: 'bg-gradient-to-r from-indigo-500 to-fuchsia-500 text-white shadow-lg',
        save: 'font-semibold text-emerald-300',
        check: featured ? 'text-indigo-300' : 'text-zinc-500',
        button: featured
          ? 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 disabled:opacity-60'
          : 'border border-white/15 text-white hover:bg-white/5 disabled:opacity-50',
        radius: 'rounded-3xl',
        btnRadius: 'rounded-2xl',
      }
  return (
    <div data-reveal className={`reveal relative flex flex-col p-7 ${look.radius} ${featured ? 'order-first md:order-last' : ''} ${look.card}`}>
      {featured && (
        <span className={`absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full px-3.5 py-1 text-xs font-bold uppercase tracking-wider ${look.badge}`}>
          Best value{plan.badge ? ` · ${plan.badge}` : ''}
        </span>
      )}
      <p className="font-semibold text-zinc-200">{plan.name}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-5xl font-semibold tracking-tight text-white">{dollars(plan.price)}</span>
        <span className="pb-1.5 text-zinc-400">{plan.every}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm">
        {plan.compareAt && <span className="text-zinc-500 line-through">{dollars(plan.compareAt)}</span>}
        <span className={featured ? look.save : 'text-zinc-400'}>just {perMonth(plan)} a month</span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {included.map((t) => (
          <li key={t} className={`flex items-center gap-2.5 ${plan.perks.includes(t) ? 'font-semibold text-white' : 'text-zinc-300'}`}>
            <Check className={`h-4 w-4 shrink-0 ${look.check}`} strokeWidth={3} /> {t}
          </li>
        ))}
      </ul>
      <button
        onClick={async () => {
          setBusy(true)
          try {
            await (upgrade ? upgradeToYearly() : choose(plan.id))
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy || disabled}
        className={`mt-7 inline-flex h-12 items-center justify-center gap-2 text-[15px] font-semibold transition disabled:cursor-default ${look.btnRadius} ${look.button}`}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {current ? 'Your plan' : upgrade ? `Upgrade to ${plan.name}` : `Buy ${plan.name} now`}
      </button>
      {!disabled && (
        <p className="mt-2.5 text-center text-xs text-zinc-400">
          {upgrade
            ? 'Credit for your unused 6-month time · you’ll see the price first'
            : signedIn
              ? 'Starts today · secure checkout'
              : 'Skip the trial · sign in, then straight to checkout'}
        </p>
      )}
    </div>
  )
}

// ---- Questions ----

type FaqGroup = { id: string; label: string; qs: [string, string][] }

function Faq() {
  const groups: FaqGroup[] = [
    {
      id: 'safety',
      label: 'Sign-in & safety',
      qs: [
      ['Why do I sign in with Google?', 'Because it’s the safest way in. There’s no new password to create, reuse or forget, and nothing for anyone to steal from us: Dizayr never sees or stores a password at all. Google confirms it’s you, with the same protection that guards your Gmail, and you’re in with one tap on every device.'],
      ['Is signing in safe? Could my account get hacked?', 'Your account is as safe as your Google account, which is among the best-protected accounts in the world. Since Dizayr has no passwords, a leak on some other website can’t be used to get into your plan, and there’s no password here for anyone to guess. Google watches every sign-in, blocks suspicious ones and alerts you about new devices. For the strongest protection, turn on 2-Step Verification or a passkey in your Google account; then even someone who knew your password still couldn’t get in.'],
      ['What can Dizayr see in my Google account?', 'Only your name, email address and profile photo, so we know it’s you. Dizayr cannot read your Gmail, Drive, Photos, contacts or calendar, and it can’t post, send or do anything on your behalf. You can see or remove its access anytime at myaccount.google.com, under Security.'],
      ['Who else can see my plan?', 'No one. Your plan is locked to your account, and our servers check every request: it opens only for your Google account, not for another user and not for someone with a link. Everything is encrypted on its way to you (HTTPS) and while it’s stored on Google Cloud. We never sell or share it, and there are no ads.'],
      ],
    },
    {
      id: 'billing',
      label: 'Plans & billing',
      qs: [
      ['How does the free trial work?', `Sign in with Google and every feature is unlocked for ${TRIAL_DAYS} days, with one Wants mode and one Needs mode. No card, nothing to cancel. When the trial ends, pick a plan to keep going.`],
      ['Can I pay right away, without the free trial?', 'Yes. Pick a plan under Pricing, sign in with Google, and you go straight to the secure checkout. Your plan starts the day you pay. Already on the trial? You can buy whenever you like; the plan starts that day.'],
      ['Is paying safe? Do you keep my card?', 'Yes, and no, we never see it. Payments go through Paddle, a trusted checkout used by thousands of software companies. Your card details go straight to them and never touch Dizayr.'],
      ['How do I pay?', 'By card, PayPal, Apple Pay or Google Pay, through Paddle’s secure checkout. Prices are in US dollars, tax included; your bank converts them if your card is in pesos or another currency.'],
      ['Can I cancel anytime?', 'Yes. Cancel from your billing page in a couple of clicks, and you keep access until the end of the time you paid for.'],
      ['Can I get a refund?', `Yes. Ask within ${LEGAL.refundDays} days of any payment and you get your money back in full, no questions asked. See the Refund Policy at the bottom of this page.`],
      ['What happens to my plan if I don’t subscribe?', 'Nothing is deleted. Everything you planned stays saved in your account, and it’s all there the moment you choose a plan.'],
      ],
    },
    {
      id: 'using',
      label: 'Using Dizayr',
      qs: [
      ['Does it work on my phone?', 'Yes. Dizayr works in any browser on your phone, tablet or computer, and stays in sync. Add it to your home screen and it opens like an app, even offline.'],
      ['What are modes?', 'Separate versions of your plan. Add some to try a different future, each with its own items, net worth and setups, while your calendar, expenses and goals stay shared. Modes come in two sections, Wants and Needs, and you choose which one is the main one in each. The free trial includes 1 of each, the 6-month plan 2 of each, and the yearly plan is unlimited.'],
      ['Which currency does it use?', 'Plan in your own currency, and see a second one next to every amount if you like (for example pesos and US dollars).'],
      ],
    },
  ]
  const [group, setGroup] = useState(groups[0].id)
  const active = groups.find((g) => g.id === group) ?? groups[0]
  return (
    <section id="faq" aria-labelledby="faq-title" className="screen border-t border-white/[0.06] px-5 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl items-start gap-10 lg:grid-cols-[0.9fr_1.4fr] lg:gap-16">
        <div data-reveal className="reveal text-center lg:text-left">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">Questions</p>
          <h2 id="faq-title" className="mt-5 font-display text-[2.5rem] font-semibold leading-[1.04] tracking-[-0.035em] text-white sm:text-[3.2rem]">
            Everything you might be wondering.
          </h2>
          <div role="tablist" aria-label="Question topics" className="mt-8 flex flex-wrap justify-center gap-2 lg:flex-col lg:items-stretch">
            {groups.map((g) => (
              <button
                key={g.id}
                role="tab"
                aria-selected={group === g.id}
                aria-controls="faq-panel"
                onClick={() => setGroup(g.id)}
                className={`flex h-11 items-center justify-between gap-3 rounded-full px-5 text-sm font-medium transition lg:rounded-2xl ${
                  group === g.id ? 'bg-brand-600 text-white' : 'border border-white/[0.08] bg-white/[0.02] text-zinc-300 hover:text-white'
                }`}
              >
                {g.label}
                <span className={`text-xs tabular-nums ${group === g.id ? 'text-white/70' : 'text-zinc-500'}`}>{g.qs.length}</span>
              </button>
            ))}
          </div>
          <p className="mt-6 text-sm text-zinc-400">
            Still wondering?{' '}
            <ContactButton className="text-brand-200 underline decoration-brand-300/40 underline-offset-4 hover:text-brand-100">Write to us</ContactButton>
            . We read every message.
          </p>
        </div>
        <div id="faq-panel" role="tabpanel" key={group} className="animate-fade divide-y divide-white/[0.07] rounded-[28px] border border-white/[0.07] bg-[#0b0c10]">
          {active.qs.map(([q, a], i) => (
            <Question key={q} id={`faq-${group}-${i}`} q={q} a={a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Question({ id, q, a }: { id: string; q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <h3>
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls={id}
          className="flex w-full items-center justify-between gap-4 rounded-[28px] px-6 py-4 text-left"
        >
          <span className="font-medium text-white">{q}</span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
        </button>
      </h3>
      <div id={id} className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <p className="min-h-0 overflow-hidden px-6 text-zinc-400">
          <span className="block pb-5 leading-relaxed">{a}</span>
        </p>
      </div>
    </div>
  )
}

// ---- The end ----

function FinalCta({ signedIn, signin }: { signedIn: boolean; signin: SignIn }) {
  return (
    <section aria-labelledby="final-title" className="relative overflow-hidden border-t border-white/[0.06] px-5 py-20 sm:px-8 sm:py-28">
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(55%_60%_at_50%_100%,rgb(58_109_240/0.12),transparent_75%)]" />
      <div data-reveal className="reveal relative mx-auto max-w-3xl text-center">
        <h2 id="final-title" className="font-display font-semibold tracking-[-0.035em] text-[3.2rem] leading-[0.98] text-white sm:text-7xl">
          Don’t just dream it.
          <br />
          <span className="text-brand-300">Build it.</span>
        </h2>
        <p className="mx-auto mt-7 max-w-lg text-lg leading-relaxed text-zinc-300">
          Write down the life you want today, and take the first step toward it.
        </p>
        <div className="mt-10 flex justify-center">{signedIn ? <OpenApp big /> : <GoogleButton signin={signin} big />}</div>
        <p className="mt-5 text-sm text-zinc-400">
          {TRIAL_DAYS} days free · no card needed · cancel anytime
          {!signedIn && (
            <>
              {' · '}
              <a href="#pricing" className="text-brand-200 underline decoration-brand-300/40 underline-offset-4 hover:text-brand-100">
                or buy a plan now
              </a>
            </>
          )}
        </p>
      </div>
    </section>
  )
}

function SectionHead({ id, eyebrow, title, sub }: { id?: string; eyebrow: string; title: string; sub?: string }) {
  return (
    <div data-reveal className="reveal mx-auto max-w-2xl text-center">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">{eyebrow}</p>
      <h2 id={id} className="mt-5 font-display font-semibold tracking-[-0.035em] text-[2.5rem] leading-[1.04] text-white sm:text-[3.4rem]">
        {title}
      </h2>
      {sub && <p className="mt-5 text-lg text-zinc-300">{sub}</p>}
    </div>
  )
}

// ---- After the trial ----

/** Shown to a signed-in account whose free trial is over and that has no plan: everything is kept, pick a plan to continue. */
export function TrialEnded() {
  const user = useCloud((s) => s.user)
  const activating = useAccess((s) => s.activating)
  const [contact, setContact] = useState(false)
  return (
    <div className="about relative min-h-screen overflow-x-clip bg-[#07080c] px-5 pb-16 pt-12 text-zinc-100 antialiased sm:px-8 sm:pt-20">
      <Glow />
      <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
        <Logo size="h-12 w-12" />
        <h1 className="mt-7 font-display font-semibold tracking-[-0.035em] text-5xl leading-[1.02] text-white sm:text-6xl">Your free trial has ended.</h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">Everything you planned is saved and waiting. Choose a plan to keep building the life you want.</p>
        {activating && (
          <p className="animate-fade mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            <Loader2 className="h-4 w-4 animate-spin" /> Payment received, unlocking your plan…
          </p>
        )}
      </div>
      <div className="relative mt-14">
        <Pricing compact tone="brand" />
      </div>
      <div className="relative mt-10 flex flex-col items-center gap-2 text-sm text-zinc-400">
        <p>Signed in as {user?.email}</p>
        <div className="flex gap-4">
          {paymentsReady() && (
            <button type="button" onClick={() => void openBilling()} className="text-zinc-300 underline-offset-4 hover:text-white hover:underline">
              Already paid? Check your billing
            </button>
          )}
          <button onClick={() => setContact(true)} className="text-zinc-300 underline-offset-4 hover:text-white hover:underline">
            Contact support
          </button>
          <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
      {contact && <ContactDialog kind="question" onClose={() => setContact(false)} />}
    </div>
  )
}

export function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

/** Small reusable bit for the app: where you stand (trial days left / plan) — used in the plans window. */
export function PlanStatus() {
  const s = useAccess()
  const fmt = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  let text: ReactNode = null
  if (s.state === 'lifetime') text = 'You have lifetime access. Thank you!'
  else if (s.state === 'comp' && s.compUntil) text = `You have a free membership until ${fmt(s.compUntil)}. Enjoy!`
  else if (s.state === 'paid' && s.paidUntil)
    text = s.status === 'cancelled' ? `Your plan is cancelled and ends on ${fmt(s.paidUntil)}.` : `You’re on the ${s.plan ? PLANS[s.plan].name : ''} plan. Next renewal around ${fmt(s.paidUntil)}.`
  else if (s.state === 'trial' && s.trialEndsAt) {
    const days = Math.max(0, Math.ceil((s.trialEndsAt - Date.now()) / 86_400_000))
    text = `Free trial: ${days} day${days === 1 ? '' : 's'} left (ends ${fmt(s.trialEndsAt)}).`
  }
  return text ? <p className="text-sm text-zinc-300">{text}</p> : null
}
