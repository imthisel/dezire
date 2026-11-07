import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import {
  ArrowRight, BadgeCheck, Check, ChevronDown, Download, EyeOff, KeyRound, Loader2, Lock, LogOut, Quote, ShieldCheck, Star, Target,
} from 'lucide-react'
import { signIn, signOut, useCloud } from '../cloud'
import { forgetIntent, openCheckout, rememberIntent, useAccess } from '../billing'
import { auth } from '../lib/firebase'
import { PLANS, TRIAL_DAYS, billingUrl, perMonth, pesos, type Plan, type PlanId } from '../lib/plans'
import { EXAMPLE_REVIEWS, REVIEWS, type Review } from '../content/reviews'
import { DownloadSection } from './AppInstall'
import { BoardPreview, GoalsFloat, GoalsPreview, MonthOverview, NetWorthFloat, WishListPreview } from './about/Previews'
import { TryOverview } from './about/TryOverview'
import { TryExpenses } from './about/TryExpenses'
import { RealisticDemo } from './about/RealisticDemo'

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
  useTitle('Dizayr · Your future starts with a vision')

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
        <TryIt />
        <TryItExpenses />
        <Verse />
        <Features />
        <Realistic />
        <PrayAct />
        <Privacy />
        <DownloadSection />
        <Reviews />
        <Pricing signin={signin} />
        <Faq />
        <FinalCta signedIn={!!user} signin={signin} />
      </main>

      <footer className="border-t border-white/[0.06] px-5 py-10 text-sm text-zinc-400 sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-5 sm:flex-row">
          <span className="flex items-center gap-2.5">
            <Logo size="h-7 w-7" /> <span className="font-semibold text-zinc-200">Dizayr</span>
            <span className="text-zinc-500">© {new Date().getFullYear()}</span>
          </span>
          <nav aria-label="Footer" className="flex flex-wrap justify-center gap-x-6 gap-y-2">
            <a href="#realistic" className="transition hover:text-white">Realistic</a>
            <a href="#pricing" className="transition hover:text-white">Pricing</a>
            <a href="#faq" className="transition hover:text-white">Questions</a>
            <span>Payments by Lemon Squeezy</span>
          </nav>
        </div>
      </footer>
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
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-xl border border-brand-300/30 bg-gradient-to-b from-[#111a30] to-[#0a0f1c] shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]`}>
      <Target className="h-1/2 w-1/2 text-brand-200" strokeWidth={2.25} />
    </span>
  )
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
          <a href="#try" className="transition hover:text-white">Try it</a>
          <a href="#try-expenses" className="transition hover:text-white">Expenses</a>
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#realistic" className="transition hover:text-white">Realistic</a>
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
  return (
    <section
      ref={ref}
      id="top"
      className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-16 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[1.08fr_1fr] lg:items-start lg:gap-14 lg:pb-24 lg:pt-12"
    >
      <div className="text-center lg:text-left">
        <p className="hero-in text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">A private space for the life you want</p>
        <h1 className="hero-in mt-6 font-display font-semibold tracking-[-0.035em] text-[2.9rem] leading-[1] text-white sm:text-[4rem] lg:text-[4.6rem]" style={{ ['--d' as string]: '80ms' }}>
          Your future starts with a <span className="text-brand-300">vision.</span>
        </h1>
        <p className="hero-in mx-auto mt-7 max-w-lg text-lg leading-relaxed text-zinc-300 lg:mx-0" style={{ ['--d' as string]: '180ms' }}>
          Build a visual version of the life you want. Give every dream a price and a date, then work toward it, one month at a time.
        </p>
        <div className="hero-in mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center lg:justify-start" style={{ ['--d' as string]: '280ms' }}>
          {signedIn ? <OpenApp big /> : <GoogleButton signin={signin} big />}
          <a href="#try" className="inline-flex h-14 items-center gap-2 rounded-full px-5 text-[15px] font-medium text-zinc-300 transition hover:text-white">
            Try it live <ChevronDown className="h-4 w-4" />
          </a>
        </div>
        {!signedIn && (
          <p className="hero-in mt-6 text-sm text-zinc-400" style={{ ['--d' as string]: '380ms' }}>
            {TRIAL_DAYS} days free · No card needed ·{' '}
            <a href="#pricing" className="text-brand-200 underline decoration-brand-300/40 underline-offset-4 transition hover:text-brand-100">
              or plans from {perMonth(PLANS.annual)}/month
            </a>
          </p>
        )}

        {/* Where this year stands: goals ticked off, net worth on track */}
        <div className="hero-in mt-12 flex justify-center gap-4 lg:justify-start" style={{ ['--d' as string]: '460ms' }} aria-hidden>
          <GoalsFloat />
          <div className="hidden sm:block">
            <NetWorthFloat />
          </div>
        </div>
      </div>

      {/* The app, drawn: one month of the life you're planning */}
      <div className="hero-in relative mx-auto w-full max-w-[440px] lg:mr-0" style={{ ['--d' as string]: '220ms' }} aria-hidden>
        <div className="absolute -inset-10 rounded-full bg-[radial-gradient(closest-side,rgb(58_109_240/0.12),transparent)]" />
        <div className="parallax-a relative">
          <MonthOverview />
        </div>
      </div>
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

function TryIt() {
  return (
    <section id="try" aria-labelledby="try-title" className="border-t border-white/[0.06] bg-white/[0.012] px-5 sm:px-8 sec">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          id="try-title"
          eyebrow="Try it, right here"
          title="Plan three months. Watch it all add up."
          sub="Set a goal, a budget, a net worth to reach. Add what you want. Every total, warning and chart updates as you type."
        />
        <div className="mt-10">
          <TryOverview />
        </div>
      </div>
    </section>
  )
}

function TryItExpenses() {
  return (
    <section id="try-expenses" aria-labelledby="try-expenses-title" className="border-t border-white/[0.06] px-5 sm:px-8 sec">
      <div className="mx-auto max-w-6xl">
        <SectionHead
          id="try-expenses-title"
          eyebrow="Expenses"
          title="See exactly where your money goes."
          sub="Log a few things you spent. Your budget, daily average and where it went update in an instant. Tap a category to see just those."
        />
        <div className="mt-10">
          <TryExpenses />
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
      <SectionHead id="features-title" eyebrow="What you can do" title="Everything you want, finally in one place." />
      <div className="mt-10 sm:mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Tile title="A private place for everything you want." text="Big or small, write it all down, without explaining it to anyone.">
          <WishListPreview />
        </Tile>
        <Tile title="See your life on one board." text="Star what matters most and see it all together: your vision, laid out year by year.">
          <BoardPreview />
        </Tile>
        <Tile className="md:col-span-2 lg:col-span-1" title="Watch every goal move." text="Yearly goals for mind, body, status and who you’re becoming. Tick them off as you go.">
          <GoalsPreview />
        </Tile>
      </div>
    </section>
  )
}

function Tile({ title, text, children, className = '', href, cta }: { title: string; text: string; children: ReactNode; className?: string; href?: string; cta?: string }) {
  return (
    <article
      data-reveal
      className={`reveal group flex flex-col justify-between gap-8 rounded-[28px] border border-white/[0.07] bg-[#0b0c10] p-6 transition-colors duration-500 hover:border-white/[0.14] sm:p-7 ${className}`}
    >
      <div>
        <h3 className="text-xl font-semibold tracking-tight text-white">{title}</h3>
        <p className="mt-2 leading-relaxed text-zinc-400">{text}</p>
        {href && (
          <a href={href} className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-brand-200 transition hover:text-brand-100">
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

// ---- Realistic ----

function Realistic() {
  return (
    <section id="realistic" aria-labelledby="realistic-title" className="border-y border-white/[0.06] bg-white/[0.012] px-5 sm:px-8 sec">
      <div className="mx-auto max-w-6xl">
        <div data-reveal className="reveal mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-brand-300">Realistic</p>
          <h2 id="realistic-title" className="mt-5 font-display font-semibold tracking-[-0.035em] text-[2.6rem] leading-[1.02] text-white sm:text-6xl">
            Dreams have prices. <span className="text-brand-300">Now you’ll know yours.</span>
          </h2>
          <p className="mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-300">
            Choose what you want and when you want it. Dizayr adds it all up and shows what each month has to bring in. A dream becomes a
            number, and a number becomes a plan.
          </p>
        </div>
        <div data-reveal className="reveal mt-10 sm:mt-12">
          <RealisticDemo />
        </div>
      </div>
    </section>
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
    <section id="how" aria-labelledby="how-title" className="mx-auto max-w-6xl px-5 sm:px-8 sec">
      <div className="grid gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-20">
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

// ---- Privacy ----

function Privacy() {
  const points = [
    { icon: KeyRound, title: 'Only you can open it', text: 'Your space is tied to your Google account. No one else sees what you write.' },
    { icon: EyeOff, title: 'Never sold, never shared', text: 'Your dreams aren’t data for advertisers. We don’t sell or share them.' },
    { icon: Download, title: 'Yours to keep', text: 'Export a full backup whenever you like.' },
  ]
  return (
    <section aria-labelledby="privacy-title" className="border-t border-white/[0.06] px-5 sm:px-8 sec">
      <div className="mx-auto grid max-w-6xl items-start gap-12 lg:grid-cols-[1fr_1.3fr] lg:gap-20">
        <div data-reveal className="reveal">
          <span className="grid h-12 w-12 place-items-center rounded-2xl border border-brand-300/30 bg-brand-300/[0.06]">
            <Lock className="h-5 w-5 text-brand-200" />
          </span>
          <h2 id="privacy-title" className="mt-6 font-display font-semibold tracking-[-0.035em] text-[2.6rem] leading-[1.02] text-white sm:text-6xl">
            Your dreams are yours.
          </h2>
          <p className="mt-6 max-w-md text-lg leading-relaxed text-zinc-300">
            Some of what you want, you haven’t told anyone yet. Dizayr is a private space, so you can be honest about all of it.
          </p>
        </div>
        <ul className="grid gap-4">
          {points.map((p, i) => (
            <li key={p.title} data-reveal className="reveal rounded-[24px] border border-white/[0.07] bg-[#0b0c10] p-6" style={{ transitionDelay: `${i * 70}ms` }}>
              <p.icon className="h-5 w-5 text-brand-300" />
              <h3 className="mt-4 font-semibold text-white">{p.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-zinc-400">{p.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
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
  const body = (
    <>
      <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
        {order.map((id) => (
          <PlanCard key={id} plan={PLANS[id]} featured={id === 'annual'} current={onPlan && access.plan === id} disabled={onPlan} brand={brand} />
        ))}
      </div>
      {!compact && !user && signin && (
        <div data-reveal className="reveal mt-12 flex flex-col items-center gap-4 text-center">
          <p className="max-w-lg text-zinc-300">
            Rather try it first? Use every feature free for {TRIAL_DAYS} days, with one Wants mode and one Needs mode. No card, no commitment.
          </p>
          <GoogleButton signin={signin} label={`Try it free for ${TRIAL_DAYS} days`} />
        </div>
      )}
      <ul className="mx-auto mt-10 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-400">
        <li className="flex items-center gap-1.5"><Lock className="h-4 w-4" /> Secure checkout by Lemon Squeezy</li>
        <li className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4" /> Cancel anytime</li>
        <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Your data stays private</li>
      </ul>
    </>
  )
  if (compact) return body
  return (
    <section id="pricing" aria-labelledby="pricing-title" className="mx-auto max-w-6xl px-5 sm:px-8 sec">
      <SectionHead
        id="pricing-title"
        eyebrow="Pricing"
        title="Less than a coffee a month, for the life you’re building."
        sub="One plan, everything included. Every feature, every device, every year to 2040."
      />
      <div className="mt-10 sm:mt-12">{body}</div>
    </section>
  )
}

function PlanCard({ plan, featured, current, disabled, brand }: { plan: Plan; featured: boolean; current: boolean; disabled: boolean; brand: boolean }) {
  const [busy, setBusy] = useState(false)
  const signedIn = useCloud((s) => !!s.user)
  const included = [...plan.perks, 'Every other feature included', 'Plans from 2026 to 2040', 'All your devices, synced', 'Works offline']
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
        <span className="text-5xl font-semibold tracking-tight text-white">{pesos(plan.price)}</span>
        <span className="pb-1.5 text-zinc-400">{plan.every}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm">
        {plan.compareAt && <span className="text-zinc-500 line-through">{pesos(plan.compareAt)}</span>}
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
            await choose(plan.id)
          } finally {
            setBusy(false)
          }
        }}
        disabled={busy || disabled}
        className={`mt-7 inline-flex h-12 items-center justify-center gap-2 text-[15px] font-semibold transition disabled:cursor-default ${look.btnRadius} ${look.button}`}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {current ? 'Your plan' : `Buy ${plan.name} now`}
      </button>
      {!disabled && (
        <p className="mt-2.5 text-center text-xs text-zinc-400">{signedIn ? 'Starts today · secure checkout' : 'Skip the trial · sign in, then straight to checkout'}</p>
      )}
    </div>
  )
}

// ---- Questions ----

function Faq() {
  const qs: [string, string][] = [
    ['How does the free trial work?', `Sign in with Google and every feature is unlocked for ${TRIAL_DAYS} days, with one Wants mode and one Needs mode. No card, nothing to cancel. When the trial ends, pick a plan to keep going.`],
    ['Can I pay right away, without the free trial?', 'Yes. Pick a plan under Pricing, sign in with Google, and you go straight to the secure checkout. Your plan starts the day you pay. Already on the trial? You can buy whenever you like; the plan starts that day.'],
    ['What happens to my plan if I don’t subscribe?', 'Nothing is deleted. Everything you planned stays saved in your account, and it’s all there the moment you choose a plan.'],
    ['Can I cancel anytime?', 'Yes. Cancel from your billing page in a couple of clicks, and you keep access until the end of the time you paid for.'],
    ['Is my data private?', 'Yes. Your plan is tied to your Google account and only you can open it. We never sell or share it.'],
    ['Does it work on my phone?', 'Yes. Dizayr works in any browser on your phone, tablet or computer, and stays in sync. Add it to your home screen and it opens like an app, even offline.'],
    ['What are modes?', 'Separate versions of your plan. Add some to try a different future, each with its own items, net worth and setups, while your calendar, expenses and goals stay shared. Modes come in two sections, Wants and Needs, and you choose which one is the main one in each. The free trial includes 1 of each, the 6-month plan 2 of each, and the yearly plan is unlimited.'],
    ['Which currency does it use?', 'Plan in your own currency, and see a second one next to every amount if you like (for example pesos and US dollars).'],
    ['How do I pay?', 'By card or PayPal, through Lemon Squeezy’s secure checkout. Prices are in Philippine pesos, tax included; your bank converts them if you pay in another currency.'],
  ]
  return (
    <section id="faq" aria-labelledby="faq-title" className="border-t border-white/[0.06] sec">
      <div className="mx-auto max-w-3xl px-5 sm:px-8">
        <SectionHead id="faq-title" eyebrow="Questions" title="Everything you might be wondering." />
        <div className="mt-12 divide-y divide-white/[0.07] rounded-[28px] border border-white/[0.07] bg-[#0b0c10]">
          {qs.map(([q, a], i) => (
            <Question key={q} id={`faq-${i}`} q={q} a={a} />
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
          className="flex w-full items-center justify-between gap-4 rounded-[28px] px-6 py-5 text-left"
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
          Your future starts with a vision. Write yours down today, and take the first step toward it.
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
          {billingUrl() && (
            <a href={billingUrl()} target="_blank" rel="noreferrer" className="text-zinc-300 underline-offset-4 hover:text-white hover:underline">
              Already paid? Check your billing
            </a>
          )}
          <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-zinc-300 hover:text-white">
            <LogOut className="h-3.5 w-3.5" /> Sign out
          </button>
        </div>
      </div>
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
