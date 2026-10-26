import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  ArrowRight, BadgeCheck, CalendarCheck, Car, Check, ChevronDown, CircleDollarSign, Cloud, Crown, Flag, Gem, Home, LineChart, Loader2, Lock,
  LogOut, Plane, Quote, Receipt, Rocket, ShieldCheck, Smartphone, Sparkles, Star, Target, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import { signIn, signOut, useCloud } from '../cloud'
import { openCheckout, rememberIntent, useAccess } from '../billing'
import { PLANS, TRIAL_DAYS, billingUrl, perMonth, type Plan, type PlanId } from '../lib/plans'
import { EXAMPLE_REVIEWS, REVIEWS, type Review } from '../content/reviews'

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

/** Choosing a plan: pay right away when signed in; otherwise sign in first and the checkout opens straight after. */
async function choose(plan: PlanId) {
  const user = useCloud.getState().user
  if (user) return openCheckout(plan, user)
  rememberIntent(plan)
  await signIn()
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

// ---- The page ----

/** The About page: what Dizayr is, why it works, what people say, and what it costs. Shown before signing in. */
export function About() {
  const user = useCloud((s) => s.user)
  const signin = useSignIn()
  useReveal()

  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#07080c] text-zinc-100 antialiased">
      <Glow />
      <Nav signedIn={!!user} signin={signin} />

      <main>
        <Hero signedIn={!!user} signin={signin} />
        <Manifesto />
        <BeforeAfter />
        <HowItWorks />
        <Features />
        <Reviews />
        <Pricing signin={signin} />
        <Faq />
        <FinalCta signedIn={!!user} signin={signin} />
      </main>

      <footer className="border-t border-white/[0.06] px-4 py-10 text-center text-xs text-zinc-500 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 sm:flex-row">
          <span className="flex items-center gap-2">
            <Logo size="h-6 w-6" /> <span className="font-semibold text-zinc-300">Dizayr</span> · © {new Date().getFullYear()}
          </span>
          <span className="flex flex-wrap justify-center gap-x-5 gap-y-1">
            <a href="#pricing" className="hover:text-zinc-300">Pricing</a>
            <a href="#faq" className="hover:text-zinc-300">Questions</a>
            <span>Payments by Lemon Squeezy</span>
            <span>Your data is private to you</span>
          </span>
        </div>
      </footer>
    </div>
  )
}

type SignIn = ReturnType<typeof useSignIn>

function Glow() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[900px] overflow-hidden">
      <div className="absolute -top-56 left-1/2 h-[620px] w-[1100px] -translate-x-1/2 rounded-full bg-indigo-600/25 blur-[140px]" />
      <div className="absolute top-40 -right-40 h-[420px] w-[520px] rounded-full bg-emerald-500/10 blur-[120px]" />
      <div className="absolute top-72 -left-40 h-[380px] w-[480px] rounded-full bg-fuchsia-500/10 blur-[120px]" />
    </div>
  )
}

function Logo({ size = 'h-9 w-9' }: { size?: string }) {
  return (
    <span className={`grid ${size} shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-400 to-emerald-400 shadow-lg shadow-indigo-500/25`}>
      <Target className="h-1/2 w-1/2 text-white" strokeWidth={2.5} />
    </span>
  )
}

function GoogleButton({ signin, label = 'Start your 7-day free trial', big = false }: { signin: SignIn; label?: string; big?: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 sm:items-start">
      <button
        onClick={signin.go}
        disabled={signin.busy}
        className={`group inline-flex items-center justify-center gap-3 rounded-2xl bg-white font-semibold text-zinc-900 shadow-xl shadow-indigo-500/20 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-indigo-500/30 active:translate-y-0 disabled:opacity-60 ${
          big ? 'h-14 px-7 text-base' : 'h-12 px-6 text-[15px]'
        }`}
      >
        {signin.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <GoogleIcon />}
        {label}
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
      </button>
      {signin.error && <p className="animate-fade text-sm text-red-300">{signin.error}</p>}
    </div>
  )
}

function Nav({ signedIn, signin }: { signedIn: boolean; signin: SignIn }) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-[#07080c]/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <a href="#top" className="flex items-center gap-2.5">
          <Logo />
          <span className="text-lg font-bold tracking-tight text-white">Dizayr</span>
        </a>
        <nav className="hidden items-center gap-7 text-sm text-zinc-400 md:flex">
          <a href="#how" className="transition hover:text-white">How it works</a>
          <a href="#features" className="transition hover:text-white">Features</a>
          {reviewsToShow().length > 0 && <a href="#reviews" className="transition hover:text-white">Reviews</a>}
          <a href="#pricing" className="transition hover:text-white">Pricing</a>
          <a href="#faq" className="transition hover:text-white">FAQ</a>
        </nav>
        {signedIn ? (
          <a href="/" className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-100">
            Open the app <ArrowRight className="h-4 w-4" />
          </a>
        ) : (
          <div className="flex items-center gap-2">
            <button onClick={signin.go} className="hidden h-10 rounded-xl px-3 text-sm font-medium text-zinc-300 transition hover:text-white sm:block">
              Sign in
            </button>
            <button
              onClick={signin.go}
              disabled={signin.busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-4 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 disabled:opacity-60"
            >
              {signin.busy && <Loader2 className="h-4 w-4 animate-spin" />} Try free
            </button>
          </div>
        )}
      </div>
    </header>
  )
}

// ---- Hero ----

function Hero({ signedIn, signin }: { signedIn: boolean; signin: SignIn }) {
  return (
    <section id="top" className="relative mx-auto grid max-w-6xl items-center gap-14 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.05fr_1fr] lg:gap-10 lg:pb-28">
      <div className="text-center lg:text-left">
        <p className="animate-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Your life plan, from today to 2040
        </p>
        <h1 className="animate-rise mt-6 text-[2.6rem] font-extrabold leading-[1.05] tracking-tight text-white sm:text-6xl">
          Only you know what you{' '}
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">really want.</span>
        </h1>
        <p className="animate-rise mx-auto mt-6 max-w-xl text-lg leading-relaxed text-zinc-400 lg:mx-0">
          Dizayr turns it into a plan. Put the house, the car, the trips and the person you’re becoming into real months with real
          numbers, then watch your net worth climb toward them.
        </p>
        <div className="animate-rise mt-9 flex flex-col items-center gap-4 sm:flex-row sm:justify-center lg:justify-start">
          {signedIn ? (
            <a href="/" className="inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-zinc-900 shadow-xl shadow-indigo-500/20">
              Open your plan <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <GoogleButton signin={signin} big />
          )}
          <a href="#how" className="inline-flex h-14 items-center gap-2 rounded-2xl px-5 text-sm font-medium text-zinc-300 transition hover:text-white">
            See how it works <ChevronDown className="h-4 w-4" />
          </a>
        </div>
        <ul className="animate-rise mt-6 flex flex-wrap justify-center gap-x-5 gap-y-2 text-sm text-zinc-500 lg:justify-start">
          {[`${TRIAL_DAYS} days free`, 'No card needed', 'One tap with Google'].map((t) => (
            <li key={t} className="flex items-center gap-1.5">
              <Check className="h-4 w-4 text-emerald-400" strokeWidth={3} /> {t}
            </li>
          ))}
        </ul>
      </div>
      <AppPreview />
    </section>
  )
}

/** A small picture of the app (drawn, not a screenshot): net worth climbing, a month with a car in it, goals ticked off. */
function AppPreview() {
  const points = [8, 10, 9, 14, 17, 16, 22, 27, 31, 36, 44, 52, 61, 72, 86]
  const w = 440
  const h = 170
  const max = 90
  const xy = points.map((p, i) => [(i / (points.length - 1)) * w, h - (p / max) * h] as const)
  const line = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <div className="animate-rise relative mx-auto w-full max-w-[520px]" aria-hidden>
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-indigo-500/20 via-transparent to-emerald-500/20 blur-2xl" />
      <div className="relative rounded-3xl border border-white/10 bg-[#0c0e14]/90 p-5 shadow-2xl shadow-black/60 backdrop-blur">
        <div>
          <p className="text-xs font-medium text-zinc-500">Net worth by December 2040</p>
          <p className="mt-1 flex flex-wrap items-center gap-2.5 text-3xl font-bold tabular-nums text-white">
            ₱86,400,000
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/10 px-2.5 py-1 text-xs font-semibold text-emerald-300">
              <TrendingUp className="h-3.5 w-3.5" /> on track
            </span>
          </p>
        </div>
        <svg viewBox={`0 0 ${w} ${h}`} className="mt-4 h-40 w-full overflow-visible">
          <defs>
            <linearGradient id="nw" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#818cf8" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="nwl" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="#818cf8" />
              <stop offset="100%" stopColor="#34d399" />
            </linearGradient>
          </defs>
          <path d={`${line} L${w},${h} L0,${h} Z`} fill="url(#nw)" />
          <path d={line} fill="none" stroke="url(#nwl)" strokeWidth="3" strokeLinecap="round" className="draw-line" />
          <circle cx={xy[xy.length - 1][0]} cy={xy[xy.length - 1][1]} r="5" fill="#34d399" className="animate-pulse" />
        </svg>
        <div className="mt-2 flex justify-between text-[10px] font-medium uppercase tracking-wider text-zinc-600">
          <span>2026</span>
          <span>2030</span>
          <span>2035</span>
          <span>2040</span>
        </div>
      </div>

      {/* A month, floating */}
      <div className="float-slow absolute -bottom-10 -left-4 w-64 rounded-2xl border border-white/10 bg-[#11131b]/95 p-3.5 shadow-2xl shadow-black/60 backdrop-blur sm:-left-10">
        <div className="flex items-baseline justify-between">
          <p className="font-semibold text-white">June 2028</p>
          <p className="text-[11px] text-emerald-300">₱180,000 left</p>
        </div>
        <div className="mt-2.5 flex items-center gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-red-500/20 text-red-300">
            <Car className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-semibold text-white">Toyota Fortuner</span>
            <span className="flex items-center gap-1 text-[10.5px] text-red-300">
              <TrendingDown className="h-3 w-3" /> Depreciating · 12%/yr
            </span>
          </span>
          <span className="text-[13px] font-bold tabular-nums text-white">₱2.2M</span>
        </div>
      </div>

      {/* Goals, floating */}
      <div className="float-slower absolute -right-2 -top-8 w-52 rounded-2xl border border-white/10 bg-[#11131b]/95 p-3 shadow-2xl shadow-black/60 backdrop-blur sm:-right-8">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">2027 goals</p>
        {['Run a half marathon', 'Save ₱500K emergency fund', 'Launch my side business'].map((g, i) => (
          <p key={g} className="mt-1.5 flex items-center gap-2 text-[12.5px] text-zinc-200">
            <span className={`grid h-4 w-4 shrink-0 place-items-center rounded-full ${i < 2 ? 'bg-emerald-400' : 'border-2 border-fuchsia-400'}`}>
              {i < 2 && <Check className="h-2.5 w-2.5 text-black" strokeWidth={4} />}
            </span>
            <span className={i < 2 ? 'text-zinc-400 line-through decoration-zinc-600' : ''}>{g}</span>
          </p>
        ))}
      </div>
    </div>
  )
}

// ---- Why ----

function Manifesto() {
  const points: { k: string; title: string; text: string; cls: string }[] = [
    {
      k: '01',
      title: 'Only you know what you really want.',
      text: 'Not your parents, not your feed, not anyone else. Dizayr doesn’t tell you what to want. It helps you write it down and make it real.',
      cls: 'from-indigo-300 to-violet-300',
    },
    {
      k: '02',
      title: 'Know yourself more. Be specific.',
      text: '“A nice car someday” becomes “a ₱2.2M Fortuner in June 2028”. Specific goals get done; vague ones stay wishes.',
      cls: 'from-fuchsia-300 to-pink-300',
    },
    {
      k: '03',
      title: 'Dream big.',
      text: 'Plan fifteen years ahead. When every dream has a price and a month, big stops being scary and starts being next.',
      cls: 'from-emerald-300 to-teal-300',
    },
  ]
  return (
    <section className="relative border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 md:grid-cols-3 md:gap-8">
        {points.map((p) => (
          <div key={p.k} data-reveal className="reveal">
            <p className={`bg-gradient-to-r bg-clip-text text-sm font-bold tracking-[0.2em] text-transparent ${p.cls}`}>{p.k}</p>
            <h2 className="mt-3 text-2xl font-bold leading-tight tracking-tight text-white sm:text-[1.7rem]">{p.title}</h2>
            <p className="mt-3 leading-relaxed text-zinc-400">{p.text}</p>
          </div>
        ))}
      </div>
    </section>
  )
}

function BeforeAfter() {
  const without = ['“Someday” goals with no date or price', 'Money disappears and you’re not sure where', 'No idea if you’re actually on track', 'Big dreams feel out of reach, so you stop dreaming']
  const withIt = ['Every dream placed in a real month, with a real price', 'Every peso you spend, seen and sorted', 'Your net worth, month by month, all the way to 2040', 'Big dreams broken into steps you can start this month']
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead eyebrow="Why most goals never happen" title="Wanting it isn’t the problem. Not seeing the path is." />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        <div data-reveal className="reveal rounded-3xl border border-white/[0.07] bg-white/[0.02] p-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-zinc-500">Without a plan</p>
          <ul className="mt-5 space-y-3.5">
            {without.map((t) => (
              <li key={t} className="flex gap-3 text-zinc-400">
                <X className="mt-0.5 h-5 w-5 shrink-0 text-zinc-600" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <div data-reveal className="reveal relative overflow-hidden rounded-3xl border border-indigo-400/30 bg-gradient-to-br from-indigo-500/15 via-indigo-500/[0.06] to-emerald-500/10 p-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-indigo-200">With Dizayr</p>
          <ul className="mt-5 space-y-3.5">
            {withIt.map((t) => (
              <li key={t} className="flex gap-3 text-zinc-100">
                <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-emerald-400">
                  <Check className="h-3 w-3 text-black" strokeWidth={4} />
                </span>
                {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

function HowItWorks() {
  const steps = [
    { icon: Sparkles, title: 'Dream it', text: 'Add what you want, a house, a car, a trip, an investment, to the month you want it. Big or small, it all counts.', cls: 'text-amber-300 bg-amber-400/10' },
    { icon: CircleDollarSign, title: 'Price it', text: 'Set what you’ll make and spend each month. Dizayr checks every dream fits, and warns you when one doesn’t.', cls: 'text-indigo-300 bg-indigo-400/10' },
    { icon: Rocket, title: 'Live it', text: 'Log what you spend, plan your days, tick off your goals, and watch your net worth climb toward the life you chose.', cls: 'text-emerald-300 bg-emerald-400/10' },
  ]
  return (
    <section id="how" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="How it works" title="From “I want” to “I did”, in three steps." />
        <ol className="mt-14 grid gap-5 md:grid-cols-3">
          {steps.map((s, i) => (
            <li key={s.title} data-reveal className="reveal relative rounded-3xl border border-white/[0.07] bg-[#0c0e14] p-7" style={{ transitionDelay: `${i * 90}ms` }}>
              <span className="absolute right-6 top-5 text-5xl font-black text-white/[0.04]">{i + 1}</span>
              <span className={`grid h-12 w-12 place-items-center rounded-2xl ${s.cls}`}>
                <s.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-bold text-white">{s.title}</h3>
              <p className="mt-2 leading-relaxed text-zinc-400">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}

function Features() {
  const list: { icon: typeof Home; title: string; text: string; cls: string }[] = [
    { icon: LineChart, title: 'A money plan for every month', text: 'Goals, budgets and what you actually earned, from 2026 to 2040, with running totals that update as you type.', cls: 'text-indigo-300 bg-indigo-400/10' },
    { icon: TrendingUp, title: 'Net worth you can watch grow', text: 'Property that gains value, cars that lose it: each asset ages on its own rate, so your future net worth is real.', cls: 'text-emerald-300 bg-emerald-400/10' },
    { icon: Gem, title: 'Everything you own, in one place', text: 'Property, vehicles, investments, travel, your own kinds. See what you paid, what it’s worth, and where each car is kept.', cls: 'text-fuchsia-300 bg-fuchsia-400/10' },
    { icon: Flag, title: 'Yearly goals for your whole life', text: 'Mind, body, status, identity, or your own areas. Tick them off, and carry the unfinished ones into next year.', cls: 'text-pink-300 bg-pink-400/10' },
    { icon: Receipt, title: 'Know where your money goes', text: 'Log spending in seconds. Categories, places and charts show your week, month and year at a glance.', cls: 'text-rose-300 bg-rose-400/10' },
    { icon: Rocket, title: 'A plan to make the money', text: 'Business, job, freelance or online: set the goal, do the math per sale, and follow your own step-by-step plan.', cls: 'text-amber-300 bg-amber-400/10' },
    { icon: CalendarCheck, title: 'Your days, organized', text: 'A full calendar for time you set aside, plus tasks with deadlines and routines. Color-coded, drag to plan.', cls: 'text-sky-300 bg-sky-400/10' },
    { icon: Cloud, title: 'With you everywhere', text: 'Phone, tablet, computer. Saved to your account automatically, and it keeps working without internet.', cls: 'text-teal-300 bg-teal-400/10' },
  ]
  return (
    <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead eyebrow="Everything in one place" title="One app for the life you’re building." sub="Money, things, goals and time. Usually that’s five apps and a spreadsheet. In Dizayr it’s one plan." />
      <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {list.map((f, i) => (
          <div
            key={f.title}
            data-reveal
            className="reveal group rounded-3xl border border-white/[0.07] bg-white/[0.02] p-6 transition hover:-translate-y-1 hover:border-white/15 hover:bg-white/[0.035]"
            style={{ transitionDelay: `${(i % 4) * 70}ms` }}
          >
            <span className={`grid h-11 w-11 place-items-center rounded-xl ${f.cls}`}>
              <f.icon className="h-5 w-5" />
            </span>
            <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">{f.text}</p>
          </div>
        ))}
      </div>
      <div data-reveal className="reveal mt-10 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-zinc-500">
        <span className="flex items-center gap-2"><Home className="h-4 w-4 text-teal-300" /> Property</span>
        <span className="flex items-center gap-2"><Car className="h-4 w-4 text-cyan-300" /> Vehicles</span>
        <span className="flex items-center gap-2"><TrendingUp className="h-4 w-4 text-lime-300" /> Investments</span>
        <span className="flex items-center gap-2"><Plane className="h-4 w-4 text-orange-300" /> Travel</span>
        <span className="flex items-center gap-2"><Crown className="h-4 w-4 text-amber-300" /> Status</span>
        <span className="flex items-center gap-2"><Smartphone className="h-4 w-4 text-sky-300" /> Works offline</span>
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
    <section id="reviews" className="scroll-mt-20 border-y border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionHead eyebrow="Reviews" title="People who stopped wishing and started planning." />
      </div>
      <div className="marquee-mask mt-14 space-y-5">
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
    <figure aria-hidden={hidden || undefined} className="relative w-[320px] shrink-0 rounded-3xl border border-white/[0.08] bg-[#0c0e14] p-6 sm:w-[380px]">
      <Quote className="absolute right-5 top-5 h-8 w-8 text-white/[0.05]" />
      <div className="flex gap-0.5" aria-label={`${stars} out of 5 stars`}>
        {Array.from({ length: 5 }, (_, i) => (
          <Star key={i} className={`h-4 w-4 ${i < stars ? 'fill-amber-300 text-amber-300' : 'text-zinc-700'}`} />
        ))}
      </div>
      <blockquote className="mt-4 leading-relaxed text-zinc-200">“{r.text}”</blockquote>
      <figcaption className="mt-5 flex items-center gap-3">
        {r.photo ? (
          <img src={r.photo} alt="" className="h-10 w-10 rounded-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-indigo-500 to-emerald-500 font-semibold text-white">
            {r.name.charAt(0).toUpperCase()}
          </span>
        )}
        <span className="min-w-0">
          <span className="block truncate font-semibold text-white">{r.name}</span>
          {r.role && <span className="block truncate text-sm text-zinc-500">{r.role}</span>}
        </span>
      </figcaption>
    </figure>
  )
}

// ---- Pricing ----

export function Pricing({ signin, compact = false }: { signin?: SignIn; compact?: boolean }) {
  const access = useAccess()
  const user = useCloud((s) => s.user)
  const order: PlanId[] = ['semiannual', 'annual']
  const onPlan = access.state === 'paid' || access.state === 'lifetime'
  const body = (
    <>
      <div className="mx-auto grid max-w-3xl gap-5 md:grid-cols-2">
        {order.map((id) => (
          <PlanCard key={id} plan={PLANS[id]} featured={id === 'annual'} current={onPlan && access.plan === id} disabled={onPlan} />
        ))}
      </div>
      {!compact && (
        <>
          {!user && signin && (
            <div data-reveal className="reveal mt-10 flex flex-col items-center gap-3 text-center">
              <p className="text-zinc-400">Not sure yet? Use everything free for {TRIAL_DAYS} days first.</p>
              <GoogleButton signin={signin} label={`Try it free for ${TRIAL_DAYS} days`} />
            </div>
          )}
        </>
      )}
      <ul className="mx-auto mt-8 flex max-w-3xl flex-wrap justify-center gap-x-6 gap-y-2 text-sm text-zinc-500">
        <li className="flex items-center gap-1.5"><Lock className="h-4 w-4 text-zinc-400" /> Secure checkout by Lemon Squeezy</li>
        <li className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-zinc-400" /> Cancel anytime</li>
        <li className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-zinc-400" /> Your data stays private</li>
      </ul>
    </>
  )
  if (compact) return body
  return (
    <section id="pricing" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHead eyebrow="Pricing" title="Less than a coffee a month, for the rest of your plan." sub="One plan, everything included. Every feature, every device, every year to 2040." />
      <div className="mt-14">{body}</div>
    </section>
  )
}

function PlanCard({ plan, featured, current, disabled }: { plan: Plan; featured: boolean; current: boolean; disabled: boolean }) {
  const [busy, setBusy] = useState(false)
  const included = ['Every feature, nothing locked', 'Plans from 2026 to 2040', 'All your devices, synced', 'Works offline', 'New features as they come']
  return (
    <div
      data-reveal
      className={`reveal relative flex flex-col rounded-3xl p-7 ${featured ? 'order-first md:order-last' : ''} ${
        featured
          ? 'border-2 border-indigo-400/60 bg-gradient-to-b from-indigo-500/15 via-[#0c0e14] to-[#0c0e14] shadow-2xl shadow-indigo-500/15'
          : 'border border-white/[0.08] bg-[#0c0e14]'
      }`}
    >
      {featured && (
        <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-gradient-to-r from-indigo-500 to-fuchsia-500 px-3.5 py-1 text-xs font-bold uppercase tracking-wider text-white shadow-lg">
          Best value{plan.badge ? ` · ${plan.badge}` : ''}
        </span>
      )}
      <p className="font-semibold text-zinc-200">{plan.name}</p>
      <div className="mt-4 flex items-end gap-2">
        <span className="text-5xl font-extrabold tracking-tight text-white">${plan.price}</span>
        <span className="pb-1.5 text-zinc-400">{plan.every}</span>
      </div>
      <p className="mt-2 flex items-center gap-2 text-sm">
        {plan.compareAt && <span className="text-zinc-500 line-through">${plan.compareAt}</span>}
        <span className={featured ? 'font-semibold text-emerald-300' : 'text-zinc-400'}>
          just {perMonth(plan)} a month
        </span>
      </p>
      <ul className="mt-6 flex-1 space-y-2.5 text-sm">
        {included.map((t) => (
          <li key={t} className="flex items-center gap-2.5 text-zinc-300">
            <Check className={`h-4 w-4 shrink-0 ${featured ? 'text-indigo-300' : 'text-zinc-500'}`} strokeWidth={3} /> {t}
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
        className={`mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold transition disabled:cursor-default ${
          featured
            ? 'bg-gradient-to-r from-indigo-500 to-indigo-400 text-white shadow-lg shadow-indigo-500/30 hover:brightness-110 disabled:opacity-60'
            : 'border border-white/15 text-white hover:bg-white/5 disabled:opacity-50'
        }`}
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {current ? 'Your plan' : `Get ${plan.name}`}
      </button>
    </div>
  )
}

// ---- Questions ----

function Faq() {
  const qs: [string, string][] = [
    ['How does the free trial work?', `Sign in with Google and everything is unlocked for ${TRIAL_DAYS} days. No card, nothing to cancel. When the trial ends, pick a plan to keep going.`],
    ['What happens to my plan if I don’t subscribe?', 'Nothing is deleted. Everything you planned stays saved in your account, and it’s all there the moment you choose a plan.'],
    ['Can I cancel anytime?', 'Yes. Cancel from your billing page in a couple of clicks, and you keep access until the end of the time you paid for.'],
    ['Is my data private?', 'Yes. Your plan is tied to your Google account and only you can open it. We never sell or share it.'],
    ['Does it work on my phone?', 'Yes. Dizayr works in any browser on your phone, tablet or computer, and stays in sync. Add it to your home screen and it opens like an app, even offline.'],
    ['Which currency does it use?', 'Plan in your own currency, and see a second one next to every amount if you like (for example pesos and US dollars).'],
    ['How do I pay?', 'By card or PayPal, through Lemon Squeezy’s secure checkout. Prices are in US dollars; your bank converts them if needed.'],
  ]
  return (
    <section id="faq" className="scroll-mt-20 border-t border-white/[0.06] bg-white/[0.015] py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <SectionHead eyebrow="Questions" title="Everything you might be wondering." />
        <div className="mt-12 divide-y divide-white/[0.07] rounded-3xl border border-white/[0.07] bg-[#0c0e14]">
          {qs.map(([q, a]) => (
            <Question key={q} q={q} a={a} />
          ))}
        </div>
      </div>
    </section>
  )
}

function Question({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left">
        <span className="font-medium text-white">{q}</span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-zinc-500 transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <p className="min-h-0 overflow-hidden px-6 text-zinc-400">
          <span className="block pb-5 leading-relaxed">{a}</span>
        </p>
      </div>
    </div>
  )
}

function FinalCta({ signedIn, signin }: { signedIn: boolean; signin: SignIn }) {
  return (
    <section className="relative overflow-hidden px-4 py-24 sm:px-6 sm:py-32">
      <div aria-hidden className="absolute inset-0 bg-gradient-to-b from-transparent via-indigo-600/15 to-transparent" />
      <div data-reveal className="reveal relative mx-auto max-w-3xl text-center">
        <h2 className="text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
          Dream big.{' '}
          <span className="bg-gradient-to-r from-indigo-300 via-fuchsia-300 to-emerald-300 bg-clip-text text-transparent">Start today.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-xl text-lg text-zinc-400">The life you want won’t plan itself. Give it a month, a price and a plan. It takes a minute to start.</p>
        <div className="mt-9 flex justify-center">
          {signedIn ? (
            <a href="/" className="inline-flex h-14 items-center gap-2 rounded-2xl bg-white px-7 text-base font-semibold text-zinc-900">
              Open your plan <ArrowRight className="h-4 w-4" />
            </a>
          ) : (
            <GoogleButton signin={signin} big />
          )}
        </div>
        <p className="mt-4 text-sm text-zinc-500">{TRIAL_DAYS} days free · no card needed · cancel anytime</p>
      </div>
    </section>
  )
}

function SectionHead({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div data-reveal className="reveal mx-auto max-w-2xl text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-300">{eyebrow}</p>
      <h2 className="mt-3 text-3xl font-bold tracking-tight text-white sm:text-[2.6rem] sm:leading-tight">{title}</h2>
      {sub && <p className="mt-4 text-lg text-zinc-400">{sub}</p>}
    </div>
  )
}

// ---- After the trial ----

/** Shown to a signed-in account whose free trial is over and that has no plan: everything is kept, pick a plan to continue. */
export function TrialEnded() {
  const user = useCloud((s) => s.user)
  const activating = useAccess((s) => s.activating)
  return (
    <div className="relative min-h-screen overflow-x-clip bg-[#07080c] px-4 pb-16 pt-12 text-zinc-100 antialiased sm:px-6 sm:pt-20">
      <Glow />
      <div className="relative mx-auto max-w-3xl text-center">
        <Logo size="h-12 w-12" />
        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-white sm:text-5xl">Your free trial has ended.</h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          Everything you planned is saved and waiting. Choose a plan to keep building the life you want.
        </p>
        {activating && (
          <p className="animate-fade mx-auto mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-4 py-2 text-sm text-emerald-200">
            <Loader2 className="h-4 w-4 animate-spin" /> Payment received, unlocking your plan…
          </p>
        )}
      </div>
      <div className="relative mt-12">
        <Pricing compact />
      </div>
      <div className="relative mt-10 flex flex-col items-center gap-2 text-sm text-zinc-500">
        <p>Signed in as {user?.email}</p>
        <div className="flex gap-4">
          {billingUrl() && (
            <a href={billingUrl()} target="_blank" rel="noreferrer" className="text-zinc-400 underline-offset-4 hover:text-white hover:underline">
              Already paid? Check your billing
            </a>
          )}
          <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-zinc-400 hover:text-white">
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
  else if (s.state === 'paid' && s.paidUntil)
    text = s.status === 'cancelled' ? `Your plan is cancelled and ends on ${fmt(s.paidUntil)}.` : `You’re on the ${s.plan ? PLANS[s.plan].name : ''} plan. Next renewal around ${fmt(s.paidUntil)}.`
  else if (s.state === 'trial' && s.trialEndsAt) {
    const days = Math.max(0, Math.ceil((s.trialEndsAt - Date.now()) / 86_400_000))
    text = `Free trial: ${days} day${days === 1 ? '' : 's'} left (ends ${fmt(s.trialEndsAt)}).`
  }
  return text ? <p className="text-sm text-zinc-300">{text}</p> : null
}
