import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { create } from 'zustand'
import {
  ArrowLeft, ArrowRight, BookOpen, Bug, Check, CheckCircle2, ChevronDown, Circle, Clock, Copy, CreditCard, GraduationCap, Heart, Inbox, Info, Keyboard,
  Layers, Lightbulb, LifeBuoy, Loader2, Lock, MessageCircleQuestion, MessageSquareText, Rocket, Search, Send, ShieldCheck, ShoppingBasket,
  Sparkles, Star, Wallet, X, type LucideIcon,
} from 'lucide-react'
import { useCloud } from '../cloud'
import { openPlans } from '../billing'
import { openSettings } from '../settingsNav'
import { goTo } from '../nav'
import { installApp } from '../appUpdate'
import { toast } from '../toast'
import {
  MAX_MESSAGE, MAX_SUBJECT, TOPICS, WAIT_MS, closeTicket, followUp, hasNewReply, isTooSoon, markRead, ref, sendFeedback, technicalContext, useMine,
  type FeedbackKind, type Ticket,
} from '../lib/feedback'
import { card } from './Dashboard'
import { Switch } from './CurrencyMenu'
import { Modal } from './Modal'

/*
 * The Help center: guides you can search, a way to write to the team, and the conversations you've had with them.
 */

export type HelpTab = 'guides' | 'contact' | 'requests'
type Prefill = { kind?: FeedbackKind; topic?: string; subject?: string }

export const useHelp = create<{ tab: HelpTab; prefill: Prefill | null; open: string | null }>(() => ({ tab: 'guides', prefill: null, open: null }))

/** Opens the Help center, on a tab (and, for Contact, with the form started). */
export function openHelp(tab: HelpTab = 'guides', prefill?: Prefill) {
  useHelp.setState({ tab, prefill: prefill ?? null })
  goTo('help')
}

// ---------------------------------------------------------------- guides

type Topic = { id: string; title: string; about: string; icon: LucideIcon; tint: string }
const GUIDE_TOPICS: Topic[] = [
  { id: 'start', title: 'Getting started', about: 'The basics, installing, undo', icon: Rocket, tint: 'from-indigo-400 to-violet-500' },
  { id: 'wants', title: 'Wants', about: 'Planning what you dream of buying', icon: Sparkles, tint: 'from-violet-400 to-fuchsia-500' },
  { id: 'needs', title: 'Needs', about: 'Weekly essentials and budgets', icon: ShoppingBasket, tint: 'from-emerald-400 to-teal-500' },
  { id: 'money', title: 'Expenses & money', about: 'Spending, accounts, balances', icon: Wallet, tint: 'from-rose-400 to-orange-500' },
  { id: 'school', title: 'School & calendar', about: 'Tasks, deadlines, shortcuts', icon: GraduationCap, tint: 'from-sky-400 to-indigo-500' },
  { id: 'account', title: 'Account & privacy', about: 'Billing, sync, backups, privacy', icon: ShieldCheck, tint: 'from-amber-400 to-orange-500' },
]

type Article = { id: string; topic: string; title: string; words: string; body: ReactNode; action?: { label: string; run: () => void } }

const b = (t: string) => <b>{t}</b>

const ARTICLES: Article[] = [
  {
    id: 'what',
    topic: 'start',
    title: 'What you can do with Dizayr',
    words: 'overview features wants needs expenses money plan school calendar',
    body: (
      <>
        <p>Dizayr keeps your plans and your real money in one place:</p>
        <ul>
          <li>{b('Wants')}: things you're saving up for, planned month by month, with goals and budgets.</li>
          <li>{b('Needs')}: everyday essentials, budgeted week by week.</li>
          <li>{b('Expenses')}: what you actually spent. Each one comes off {b('Your money')}, split into accounts like Cash and Bank.</li>
          <li>{b('Money plan')}: ideas and steps for earning more.</li>
          <li>{b('Calendar')} and {b('School')}: events, to-dos, subjects and deadlines.</li>
        </ul>
        <p>Everything syncs to your account, so it's the same on your phone and your computer.</p>
      </>
    ),
  },
  {
    id: 'install',
    topic: 'start',
    title: 'Install Dizayr as an app',
    words: 'install download pwa home screen offline desktop phone',
    body: (
      <>
        <p>Installed, Dizayr opens in its own window, starts faster and keeps working offline. Your changes are uploaded when you're back online.</p>
        <p>
          On a computer, use the install button in the menu. On iPhone, open the Share menu in Safari and choose {b('Add to Home Screen')}. On Android, use the browser
          menu and choose {b('Install app')}.
        </p>
      </>
    ),
    action: { label: 'Install now', run: () => void installApp() },
  },
  {
    id: 'undo',
    topic: 'start',
    title: 'Undo a mistake',
    words: 'undo redo ctrl z mistake deleted restore',
    body: (
      <>
        <p>
          Press {b('Ctrl + Z')} ({b('⌘ + Z')} on a Mac) to undo, and {b('Ctrl + Shift + Z')} to redo. Most actions also show an {b('Undo')} button at the bottom of
          the screen for a few seconds.
        </p>
        <p>Undo works for your plans, expenses, money, School and settings, but not while you're typing in a box (the box has its own undo).</p>
      </>
    ),
  },
  {
    id: 'wants-plan',
    topic: 'wants',
    title: 'Plan items month by month',
    words: 'add item month drag move copy select several',
    body: (
      <>
        <p>Add an item to the month you plan to buy it. Drag it to another month to move it, or hold {b('Ctrl')} while dragging to copy it.</p>
        <p>
          To work on several at once, {b('Ctrl-click')} or {b('Shift-click')} them. A bar appears with actions for all of them: move, copy, mark spent or delete.
        </p>
      </>
    ),
  },
  {
    id: 'wants-spent',
    topic: 'wants',
    title: 'Mark something as bought',
    words: 'spent bought tick check expenses account paid from deduct',
    body: (
      <>
        <p>
          Tick the circle next to an item when you've bought it. It goes into {b('Expenses')} and stays in its month with a {b('Spent')} mark, so your plan still
          adds up.
        </p>
        <p>
          If you track your money in more than one account, Dizayr asks which one paid and shows what will be left. For items in past months, choose whether you
          paid today or back then.
        </p>
      </>
    ),
  },
  {
    id: 'wants-blur',
    topic: 'wants',
    title: 'Hide the price of an item',
    words: 'blur hide eye private price',
    body: (
      <>
        <p>Point at an item and press the {b('eye')} button to blur its name and price. Press it again to show them. This is remembered on that device.</p>
        <p>To hide the totals at the top of a page, use the eye button there, then press and hold a card to peek.</p>
      </>
    ),
  },
  {
    id: 'modes',
    topic: 'needs',
    title: 'Wants and Needs modes',
    words: 'mode switch copy main wants needs',
    body: (
      <>
        <p>
          Wants and Needs each have their own {b('modes')}: separate versions of your plan, like “Dream car” and “Realistic”. Switch, rename, copy or delete them
          from the mode menu at the top.
        </p>
        <p>One mode of each kind is the {b('main')} one. That's the one that opens when you go to Wants or Needs.</p>
      </>
    ),
    action: { label: 'Manage modes', run: () => openSettings('lists') },
  },
  {
    id: 'needs-weeks',
    topic: 'needs',
    title: 'Budget your essentials by week',
    words: 'needs week budget send expenses tick groceries',
    body: (
      <>
        <p>In Needs, each month has four weeks. Add what you buy each week (groceries, fare, bills) and set a budget to see how much is left.</p>
        <p>
          When you've paid, tick an item (or a whole week) to send it to {b('Expenses')}. Untick it to take it back out. It always stays in Needs.
        </p>
      </>
    ),
  },
  {
    id: 'money-accounts',
    topic: 'money',
    title: 'Track your money across accounts',
    words: 'wallet current money accounts cash bank gcash balance count',
    body: (
      <>
        <p>
          On the Expenses page, {b('Your money')} shows how much you have in each account, like Cash, Bank or GCash. Every expense comes off the account it was paid
          from, as soon as you log it.
        </p>
        <p>
          Use {b('Add money')} for money that came in, {b('Move')} to move money between accounts (say, withdrawing cash), and {b('Count')} after you've counted
          what you really have. Counting corrects the balance from that moment on.
        </p>
      </>
    ),
    action: { label: 'Open Expenses', run: () => goTo('expenses') },
  },
  {
    id: 'money-why',
    topic: 'money',
    title: 'Why didn’t my balance change?',
    words: 'balance not changing wrong deduct missing expense',
    body: (
      <>
        <p>An expense only comes off your money when:</p>
        <ul>
          <li>its date is {b('on or after')} the last time you counted that account,</li>
          <li>its date isn't in the future, and</li>
          <li>it was paid from an account you still track. Check {b('Paid with')} when you open the expense.</li>
        </ul>
        <p>Everything that changed your balance is in the {b('Activity')} list under Your money.</p>
      </>
    ),
  },
  {
    id: 'expenses-log',
    topic: 'money',
    title: 'Log and organise expenses',
    words: 'add expense category place spreadsheet export csv',
    body: (
      <>
        <p>Only the amount and the day are needed. Add a name, category and place to see where your money goes. Places you visit often become one-tap choices.</p>
        <p>To use your expenses in Excel or Google Sheets, export them from Data & backup in Settings.</p>
      </>
    ),
    action: { label: 'Open Data & backup', run: () => openSettings('data') },
  },
  {
    id: 'school-board',
    topic: 'school',
    title: 'Use the School board',
    words: 'school subject task due deadline board column done',
    body: (
      <>
        <p>
          Add a task with its subject and due date. Drag it across columns as you work on it, or tick it to send it to {b('Done')}. Every Sunday, last week's Done
          tasks move to {b('Done earlier')}.
        </p>
        <p>
          Press {b('N')} for a new task and {b('/')} to search. Tasks are kept in your account and synced to all your devices. They're only removed when you delete
          them.
        </p>
      </>
    ),
  },
  {
    id: 'shortcuts',
    topic: 'school',
    title: 'Keyboard shortcuts',
    words: 'keyboard shortcuts keys calendar day week month',
    body: (
      <>
        <p>
          On the Calendar: {b('T')} today, {b('D')} day, {b('3')} three days, {b('W')} week, {b('M')} month, {b('E')} new event, {b('N')} new task, and the {b('arrow keys')}{' '}
          to go earlier or later.
        </p>
        <p>Anywhere: {b('Ctrl + Z')} to undo and {b('Esc')} to close a window.</p>
      </>
    ),
  },
  {
    id: 'billing',
    topic: 'account',
    title: 'Your free trial and plans',
    words: 'trial plan price billing pay subscription renew cancel lifetime',
    body: (
      <>
        <p>
          Every new account gets a {b('7-day free trial')} with everything included. After that, pick a plan in {b('Plan & billing')} to keep using Dizayr. Your
          data stays safe either way.
        </p>
        <p>You can see when your plan renews, or cancel it, in Plan & billing. If a payment went through but the app didn't unlock, contact us and we'll fix it.</p>
      </>
    ),
    action: { label: 'Open Plan & billing', run: () => openPlans() },
  },
  {
    id: 'sync',
    topic: 'account',
    title: 'Syncing and working offline',
    words: 'sync offline devices phone computer cloud saved',
    body: (
      <>
        <p>
          While you're signed in, every change is saved to your account within a second or two, and appears on your other devices. With no connection, keep going:
          your changes are kept on the device and uploaded when you're back online.
        </p>
        <p>The status by your profile picture shows whether everything is saved.</p>
      </>
    ),
  },
  {
    id: 'backup',
    topic: 'account',
    title: 'Back up or restore your data',
    words: 'backup restore export import download file json',
    body: (
      <>
        <p>
          In {b('Data & backup')}, download a backup file of everything in your account. You can restore it later, and undo a restore right after if it wasn't what
          you wanted.
        </p>
      </>
    ),
    action: { label: 'Open Data & backup', run: () => openSettings('data') },
  },
  {
    id: 'privacy',
    topic: 'account',
    title: 'Privacy and who can see your data',
    words: 'privacy data security hide amounts blur who can see',
    body: (
      <>
        <p>
          Your plan is stored in your own account and only you can open it from the app. Dizayr's team only looks at an account to help with a problem you've
          reported, or to keep the service running safely.
        </p>
        <p>To hide amounts from people near you, use {b('Privacy')} in Settings, or the eye buttons on each page.</p>
      </>
    ),
    action: { label: 'Open Privacy settings', run: () => openSettings('privacy') },
  },
]

// ---------------------------------------------------------------- the page

export function Help() {
  const tab = useHelp((s) => s.tab)
  const tickets = useMine((s) => s.tickets)
  const read = useMine((s) => s.read)
  const unread = (tickets ?? []).filter((t) => hasNewReply(t, read)).length
  const setTab = (t: HelpTab) => useHelp.setState({ tab: t })

  return (
    <div className="mx-auto max-w-5xl space-y-6 sm:space-y-8">
      <Hero />

      <div role="tablist" aria-label="Help" className="sticky top-0 z-20 -mx-4 bg-[#07080c]/85 px-4 py-2 backdrop-blur-xl sm:mx-0 sm:px-0">
        <div className="grid grid-cols-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-1 sm:inline-grid sm:w-auto">
          {(
            [
              ['guides', 'Guides', BookOpen, 0],
              ['contact', 'Contact us', MessageSquareText, 0],
              ['requests', 'Your requests', Inbox, unread],
            ] as const
          ).map(([id, label, Icon, badge]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`relative inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-medium transition ${tab === id ? 'bg-white/[0.09] text-white shadow-sm' : 'text-zinc-400 hover:text-zinc-100'}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{label}</span>
              {badge > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-indigo-500 px-1 text-[11px] font-semibold tabular-nums text-white">{badge}</span>}
            </button>
          ))}
        </div>
      </div>

      <div key={tab} className="animate-fade">
        {tab === 'guides' && <Guides />}
        {tab === 'contact' && <Contact />}
        {tab === 'requests' && <Requests />}
      </div>
    </div>
  )
}

function Hero() {
  const tab = useHelp((s) => s.tab)
  return (
    <section className={`${card} relative overflow-hidden px-5 py-8 sm:px-10 sm:py-12`}>
      <div aria-hidden className="pointer-events-none absolute -left-24 -top-32 h-72 w-[30rem] rounded-full bg-indigo-500/[0.16] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute -bottom-32 -right-16 h-72 w-96 rounded-full bg-emerald-500/[0.1] blur-3xl" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgba(255,255,255,0.05)_1px,transparent_0)] [background-size:22px_22px] [mask-image:linear-gradient(to_bottom,black,transparent)]" />
      <div className="relative">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-xs font-medium text-zinc-300">
          <LifeBuoy className="h-3.5 w-3.5 text-indigo-300" /> Help center
        </span>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-white sm:text-[2.6rem] sm:leading-[1.1]">How can we help?</h1>
        <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-400">Search the guides, or write to the team. Every message is read by a person, and replies show up right here.</p>
        {tab === 'guides' ? (
          <SearchBox />
        ) : (
          <div className="mt-6 flex flex-wrap gap-2">
            <button onClick={() => useHelp.setState({ tab: 'guides' })} className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/[0.08]">
              <Search className="h-4 w-4 text-zinc-400" /> Search the guides
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

const useQuery = create<{ q: string; topic: string | null }>(() => ({ q: '', topic: null }))

function SearchBox() {
  const q = useQuery((s) => s.q)
  const box = useRef<HTMLInputElement>(null)
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === '/' && !(e.target as HTMLElement).closest('input, textarea, [contenteditable="true"]')) {
        e.preventDefault()
        box.current?.focus()
      }
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [])
  return (
    <div className="mt-6 max-w-2xl">
      <div className="group relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-500 transition group-focus-within:text-indigo-300" />
        <input
          ref={box}
          value={q}
          onChange={(e) => useQuery.setState({ q: e.target.value, topic: null })}
          onKeyDown={(e) => e.key === 'Escape' && useQuery.setState({ q: '' })}
          placeholder="Search for answers… e.g. “balance”, “offline”, “trial”"
          aria-label="Search the guides"
          className="h-14 w-full rounded-2xl border border-white/10 bg-black/40 pl-12 pr-12 text-base text-white shadow-2xl shadow-black/40 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/15"
        />
        {q ? (
          <button onClick={() => useQuery.setState({ q: '' })} aria-label="Clear search" className="absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/10 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        ) : (
          <kbd className="pointer-events-none absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-zinc-500 sm:block">/</kbd>
        )}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-zinc-600">Popular:</span>
        {['balance', 'mark as bought', 'offline', 'trial', 'backup'].map((t) => (
          <button key={t} onClick={() => useQuery.setState({ q: t, topic: null })} className="rounded-full border border-white/10 px-2.5 py-1 text-zinc-400 transition hover:border-white/25 hover:text-zinc-100">
            {t}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Every word typed has to appear in the title, the words or the topic. */
function matches(a: Article, q: string) {
  const hay = `${a.title} ${a.words} ${GUIDE_TOPICS.find((t) => t.id === a.topic)?.title ?? ''}`.toLowerCase()
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w))
}

function Guides() {
  const q = useQuery((s) => s.q).trim()
  const topic = useQuery((s) => s.topic)
  const results = useMemo(() => (q ? ARTICLES.filter((a) => matches(a, q)) : []), [q])
  const list = useRef<HTMLDivElement>(null)

  const pick = (id: string | null) => {
    useQuery.setState({ topic: id, q: '' })
    requestAnimationFrame(() => list.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }

  if (q) {
    return (
      <div className="space-y-4">
        <p className="px-1 text-sm text-zinc-400">
          {results.length ? `${results.length} result${results.length === 1 ? '' : 's'} for “${q}”` : `Nothing found for “${q}”.`}
        </p>
        {results.length > 0 ? (
          <ArticleList articles={results} />
        ) : (
          <StillNeedHelp title="We couldn’t find an answer" text="Tell us what you were looking for. We’ll answer you, and add a guide for it." subject={q} />
        )}
      </div>
    )
  }

  const shown = topic ? GUIDE_TOPICS.filter((t) => t.id === topic) : GUIDE_TOPICS
  return (
    <div className="space-y-8">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {GUIDE_TOPICS.map((t) => {
          const n = ARTICLES.filter((a) => a.topic === t.id).length
          const on = topic === t.id
          return (
            <button
              key={t.id}
              onClick={() => pick(on ? null : t.id)}
              aria-pressed={on}
              className={`group relative overflow-hidden rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/30 ${
                on ? 'border-indigo-400/40 bg-indigo-500/[0.08]' : 'border-white/[0.07] bg-white/[0.025] hover:border-white/15'
              }`}
            >
              <span className={`grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br ${t.tint} text-white shadow-lg shadow-black/30`}>
                <t.icon className="h-5 w-5" />
              </span>
              <p className="mt-3 flex items-center gap-1.5 text-[15px] font-semibold text-white">
                {t.title}
                <ArrowRight className="h-3.5 w-3.5 -translate-x-1 text-zinc-500 opacity-0 transition group-hover:translate-x-0 group-hover:opacity-100" />
              </p>
              <p className="mt-0.5 text-[13px] text-zinc-500">{t.about}</p>
              <p className="mt-3 text-[11px] font-medium uppercase tracking-wider text-zinc-600">
                {n} guide{n === 1 ? '' : 's'}
              </p>
            </button>
          )
        })}
      </div>

      <div ref={list} className="scroll-mt-20 space-y-8">
        {topic && (
          <button onClick={() => pick(null)} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white">
            <ArrowLeft className="h-4 w-4" /> All topics
          </button>
        )}
        {shown.map((t) => (
          <section key={t.id}>
            <h2 className="flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
              <t.icon className="h-3.5 w-3.5" /> {t.title}
            </h2>
            <div className="mt-2.5">
              <ArticleList articles={ARTICLES.filter((a) => a.topic === t.id)} />
            </div>
          </section>
        ))}
      </div>

      <StillNeedHelp title="Still need help?" text="Ask a question, report a problem or share an idea. A real person reads every message." />
    </div>
  )
}

function ArticleList({ articles }: { articles: Article[] }) {
  const [open, setOpen] = useState<string | null>(articles.length === 1 ? articles[0].id : null)
  return (
    <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      {articles.map((a) => {
        const on = open === a.id
        return (
          <div key={a.id}>
            <button onClick={() => setOpen(on ? null : a.id)} aria-expanded={on} className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg transition ${on ? 'bg-indigo-500/20 text-indigo-200' : 'bg-white/[0.05] text-zinc-400'}`}>
                <BookOpen className="h-4 w-4" />
              </span>
              <span className={`min-w-0 flex-1 text-[15px] font-medium ${on ? 'text-white' : 'text-zinc-200'}`}>{a.title}</span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${on ? 'rotate-180' : ''}`} />
            </button>
            <div className={`grid transition-all duration-300 ease-out ${on ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!on}>
              <div className="min-h-0 overflow-hidden">
                <div className="space-y-3 px-4 pb-5 pl-[3.75rem] text-sm leading-relaxed text-zinc-300 sm:px-5 sm:pl-16 [&_b]:font-semibold [&_b]:text-white [&_li]:relative [&_li]:pl-4 [&_li]:before:absolute [&_li]:before:left-0 [&_li]:before:top-[0.6em] [&_li]:before:h-1 [&_li]:before:w-1 [&_li]:before:rounded-full [&_li]:before:bg-indigo-400 [&_ul]:space-y-1.5">
                  {a.body}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {a.action && (
                      <button onClick={a.action.run} className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-white px-3.5 text-[13px] font-semibold text-zinc-950 transition hover:bg-zinc-200">
                        {a.action.label} <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      onClick={() => openHelp('contact', { kind: 'question', topic: topicFor(a.topic), subject: `About “${a.title}”` })}
                      className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-medium text-zinc-400 transition hover:bg-white/5 hover:text-white"
                    >
                      <MessageCircleQuestion className="h-3.5 w-3.5" /> Still stuck? Ask us
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const topicFor = (guide: string) => ({ start: 'other', wants: 'wants', needs: 'needs', money: 'money', school: 'school', account: 'billing' })[guide] ?? 'other'

function StillNeedHelp({ title, text, subject }: { title: string; text: string; subject?: string }) {
  return (
    <section className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-gradient-to-br from-indigo-500/[0.12] via-white/[0.02] to-emerald-500/[0.06] p-6 sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/[0.08] text-indigo-200 ring-1 ring-inset ring-white/10">
          <MessageSquareText className="h-6 w-6" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <p className="mt-1 text-sm text-zinc-400">{text}</p>
        </div>
        <button
          onClick={() => openHelp('contact', subject ? { kind: 'question', subject: `Looking for: ${subject}`.slice(0, MAX_SUBJECT) } : undefined)}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
        >
          Contact us <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </section>
  )
}

// ---------------------------------------------------------------- contact

const KINDS: { id: FeedbackKind; title: string; hint: string; icon: LucideIcon; tone: string; placeholder: string; subject: string }[] = [
  { id: 'question', title: 'Ask a question', hint: 'How do I…?', icon: MessageCircleQuestion, tone: 'text-sky-300 bg-sky-400/10 ring-sky-400/30', placeholder: 'What would you like to know?', subject: 'e.g. How do I move money from Bank to Cash?' },
  { id: 'problem', title: 'Report a problem', hint: 'Something isn’t working', icon: Bug, tone: 'text-rose-300 bg-rose-400/10 ring-rose-400/30', placeholder: 'What happened? What did you expect? Steps to make it happen again help a lot.', subject: 'e.g. My balance didn’t change after an expense' },
  { id: 'idea', title: 'Suggest an idea', hint: 'A feature or change', icon: Lightbulb, tone: 'text-amber-300 bg-amber-400/10 ring-amber-400/30', placeholder: 'What would you like Dizayr to do, and how would it help you?', subject: 'e.g. Let me set a savings goal per account' },
  { id: 'praise', title: 'Share feedback', hint: 'What you love or don’t', icon: Heart, tone: 'text-pink-300 bg-pink-400/10 ring-pink-400/30', placeholder: 'Tell us what’s working for you, and what isn’t.', subject: 'e.g. Loving the School board' },
]

const RATINGS = ['Very bad', 'Bad', 'Okay', 'Good', 'Excellent']

/** The contact form on its own, in a window: for where the Help center can't be opened (e.g. when the trial has ended). */
export function ContactDialog({ onClose, kind }: { onClose: () => void; kind?: FeedbackKind }) {
  // Set before the form first renders, so it starts on billing.
  useState(() => kind && useHelp.setState({ prefill: { kind, topic: 'billing' } }))
  return (
    <Modal title="Contact the Dizayr team" subtitle="A real person reads every message." onClose={onClose} width="max-w-2xl">
      <Contact embedded />
    </Modal>
  )
}

function Contact({ embedded }: { embedded?: boolean }) {
  const user = useCloud((s) => s.user)
  const prefill = useHelp((s) => s.prefill)
  const [kind, setKind] = useState<FeedbackKind>(prefill?.kind ?? 'question')
  const [topic, setTopic] = useState(prefill?.topic ?? '')
  const [subject, setSubject] = useState(prefill?.subject ?? '')
  const [message, setMessage] = useState('')
  const [rating, setRating] = useState(0)
  const [hideName, setHideName] = useState(false)
  const [withContext, setWithContext] = useState(true)
  const [showContext, setShowContext] = useState(false)
  const [busy, setBusy] = useState(false)
  const [tried, setTried] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [lastSent, setLastSent] = useState(0)
  const subjectBox = useRef<HTMLInputElement>(null)
  const messageBox = useRef<HTMLTextAreaElement>(null)
  const k = KINDS.find((x) => x.id === kind)!

  // Used once: a later visit starts with an empty form.
  useEffect(() => void (prefill && useHelp.setState({ prefill: null })), [prefill])

  const missing = { subject: !subject.trim(), message: !message.trim() }
  const context = useMemo(() => technicalContext(), [])

  async function submit() {
    if (missing.subject || missing.message) {
      setTried(true)
      ;(missing.subject ? subjectBox : messageBox).current?.focus()
      return
    }
    const wait = lastSent + WAIT_MS - Date.now()
    if (wait > 0) return toast.info(`Please wait ${Math.ceil(wait / 1000)} seconds before sending another message.`)
    setBusy(true)
    try {
      const id = await sendFeedback({ kind, topic: topic || 'other', subject, message, rating: kind === 'praise' || kind === 'idea' ? rating : 0, private: hideName, withContext })
      setLastSent(Date.now())
      setSent(id)
    } catch (e) {
      toast.error(isTooSoon(e) ? 'You just sent a message. Please wait a few seconds, then try again.' : 'Couldn’t send it. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className={`${card} animate-pop mx-auto max-w-xl px-6 py-10 text-center sm:px-10`}>
        <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shadow-xl shadow-emerald-500/25">
          <Check className="h-8 w-8 text-white" strokeWidth={3} />
        </span>
        <h2 className="mt-5 text-2xl font-semibold tracking-tight text-white">Thanks, we got it</h2>
        <p className="mt-2 text-sm leading-relaxed text-zinc-400">
          {kind === 'problem'
            ? 'We’ll look into it and reply here as soon as we can.'
            : kind === 'question'
              ? 'We’ll answer here as soon as we can.'
              : 'Every idea and comment is read, and they shape what we build next.'}
        </p>
        <button
          onClick={() => {
            void navigator.clipboard?.writeText(ref(sent))
            toast.info('Reference copied.')
          }}
          className="mx-auto mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3.5 py-2 text-sm text-zinc-300 transition hover:bg-white/[0.06]"
          title="Copy"
        >
          Reference <b className="font-mono font-semibold tracking-wider text-white">{ref(sent)}</b> <Copy className="h-3.5 w-3.5 text-zinc-500" />
        </button>
        {embedded ? (
          <p className="mt-6 text-sm text-zinc-500">Replies show up in Help → Your requests once you’re back in the app.</p>
        ) : (
        <div className="mt-8 flex flex-col justify-center gap-2 sm:flex-row">
          <button
            onClick={() => {
              useHelp.setState({ tab: 'requests', open: sent })
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200"
          >
            <Inbox className="h-4 w-4" /> View your request
          </button>
          <button
            onClick={() => {
              setSent(null)
              setSubject('')
              setMessage('')
              setRating(0)
              setTried(false)
            }}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 px-5 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
          >
            Send another
          </button>
        </div>
        )}
      </div>
    )
  }

  const field =
    'w-full rounded-xl border bg-black/30 px-3.5 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/15 sm:text-sm'

  return (
    <div className={embedded ? '' : 'grid gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]'}>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          void submit()
        }}
        className={embedded ? 'space-y-6' : `${card} space-y-6 p-5 sm:p-7`}
      >
        {!embedded && (
          <div>
            <h2 className="text-lg font-semibold text-white">Write to the Dizayr team</h2>
            <p className="mt-1 text-sm text-zinc-500">Pick what this is about, so it reaches the right place.</p>
          </div>
        )}

        <div role="radiogroup" aria-label="What is this about" className="grid grid-cols-2 gap-2 lg:grid-cols-4">
          {KINDS.map((x) => {
            const on = kind === x.id
            return (
              <button
                key={x.id}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setKind(x.id)}
                className={`rounded-2xl border p-3 text-left transition active:scale-[0.98] ${on ? 'border-white/20 bg-white/[0.07] ring-2 ring-indigo-400/40' : 'border-white/[0.07] hover:border-white/15 hover:bg-white/[0.03]'}`}
              >
                <span className={`grid h-8 w-8 place-items-center rounded-lg ring-1 ring-inset ${x.tone}`}>
                  <x.icon className="h-4 w-4" />
                </span>
                <span className="mt-2 block text-sm font-medium text-zinc-100">{x.title}</span>
                <span className="block text-[11px] text-zinc-500">{x.hint}</span>
              </button>
            )
          })}
        </div>

        <Field label="Area" optional>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                aria-pressed={topic === t.id}
                onClick={() => setTopic(topic === t.id ? '' : t.id)}
                className={`h-8 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${topic === t.id ? 'border-indigo-400/50 bg-indigo-500/15 text-indigo-100' : 'border-white/10 text-zinc-400 hover:border-white/25 hover:text-zinc-200'}`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Subject" error={tried && missing.subject ? 'Add a short subject.' : undefined}>
          <input
            ref={subjectBox}
            value={subject}
            maxLength={MAX_SUBJECT}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={k.subject}
            className={`${field} h-11 ${tried && missing.subject ? 'border-rose-400/50' : 'border-white/10 hover:border-white/20'}`}
          />
        </Field>

        <Field label="Message" error={tried && missing.message ? 'Tell us a little more.' : undefined} count={`${message.length.toLocaleString()} / ${MAX_MESSAGE.toLocaleString()}`}>
          <textarea
            ref={messageBox}
            value={message}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && void submit()}
            placeholder={k.placeholder}
            rows={7}
            className={`${field} min-h-[10rem] resize-y py-3 leading-relaxed ${tried && missing.message ? 'border-rose-400/50' : 'border-white/10 hover:border-white/20'}`}
          />
        </Field>

        {(kind === 'praise' || kind === 'idea') && (
          <Field label="How’s Dizayr working for you?" optional>
            <div className="flex items-center gap-1" role="radiogroup" aria-label="Rating">
              {RATINGS.map((label, i) => {
                const n = i + 1
                const on = rating >= n
                return (
                  <button key={label} type="button" role="radio" aria-checked={rating === n} aria-label={label} title={label} onClick={() => setRating(rating === n ? 0 : n)} className="grid h-10 w-10 place-items-center rounded-xl transition hover:bg-white/5 active:scale-90">
                    <Star className={`h-6 w-6 transition ${on ? 'fill-amber-300 text-amber-300' : 'text-zinc-600'}`} />
                  </button>
                )
              })}
              {rating > 0 && <span className="ml-2 text-sm text-zinc-400">{RATINGS[rating - 1]}</span>}
            </div>
          </Field>
        )}

        <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.02]">
          <div className="flex items-start gap-3 p-4">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
              <Lock className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-100">Keep my name private</p>
              <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
                We won’t use your name if we quote or share this. It stays linked to your account, which only the Dizayr team can see, so we can reply and prevent
                abuse.
              </p>
            </div>
            <Switch on={hideName} onChange={setHideName} label="Keep my name private" />
          </div>
          <div className="p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.05] text-zinc-300">
                <Info className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-zinc-100">Include technical details</p>
                <p className="mt-0.5 text-[13px] leading-snug text-zinc-500">
                  Helps us fix problems faster. Only how the app is running, never your plans or amounts.{' '}
                  <button type="button" onClick={() => setShowContext((s) => !s)} className="text-indigo-300 underline-offset-2 hover:underline">
                    {showContext ? 'Hide' : 'See what’s sent'}
                  </button>
                </p>
              </div>
              <Switch on={withContext} onChange={setWithContext} label="Include technical details" />
            </div>
            {showContext && (
              <dl className="animate-fade mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 rounded-xl bg-black/30 p-3 font-mono text-[11px] sm:grid-cols-4">
                {Object.entries(context).map(([key, v]) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-zinc-600">{key}</dt>
                    <dd className="truncate text-zinc-300">{v || '—'}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-white/[0.06] pt-5 sm:flex-row sm:items-center">
          <p className="text-xs text-zinc-500">
            Sending as <span className="text-zinc-300">{user?.email ?? 'your account'}</span>
            {hideName && <span className="ml-1.5 inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] text-zinc-400"><Lock className="h-2.5 w-2.5" /> name private</span>}
          </p>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 px-6 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:brightness-110 active:scale-[0.98] disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Send message
          </button>
        </div>
      </form>

      <aside className={embedded ? 'hidden' : 'space-y-3'}>
        <SideCard icon={Clock} title="When you’ll hear back">
          Replies appear in <b>Your requests</b>, with a dot on Help in the menu when there’s something new.
        </SideCard>
        <SideCard icon={Bug} title="Reporting a problem?">
          Say what you did, what you expected and what happened instead. Keep technical details on.
        </SideCard>
        <SideCard icon={CreditCard} title="Billing">
          Paid but still locked out? Choose <b>Account & billing</b> above and include your reference from the payment email.
        </SideCard>
        <SideCard icon={Keyboard} title="Tip">
          Press <b>Ctrl + Enter</b> in the message box to send.
        </SideCard>
      </aside>
    </div>
  )
}

function SideCard({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-white/[0.025] p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-zinc-100">
        <Icon className="h-4 w-4 text-zinc-400" /> {title}
      </p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 [&_b]:font-medium [&_b]:text-zinc-300">{children}</p>
    </div>
  )
}

function Field({ label, optional, error, count, children }: { label: string; optional?: boolean; error?: string; count?: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-xs font-medium text-zinc-400">
          {label} {optional && <span className="font-normal text-zinc-600">optional</span>}
        </p>
        {count && <span className="text-[11px] tabular-nums text-zinc-600">{count}</span>}
      </div>
      {children}
      {error && <p className="animate-fade mt-1.5 text-xs text-rose-300">{error}</p>}
    </div>
  )
}

// ---------------------------------------------------------------- your requests

const STATUS: Record<Ticket['status'], { label: string; cls: string; icon: LucideIcon }> = {
  open: { label: 'Open', cls: 'bg-sky-400/10 text-sky-200 ring-sky-400/25', icon: Circle },
  pending: { label: 'Waiting on you', cls: 'bg-amber-400/10 text-amber-200 ring-amber-400/25', icon: Clock },
  resolved: { label: 'Solved', cls: 'bg-emerald-400/10 text-emerald-200 ring-emerald-400/25', icon: CheckCircle2 },
}

const when = (t: number | null) => {
  if (!t) return 'Sending…'
  const d = Date.now() - t
  if (d < 60_000) return 'Just now'
  if (d < 3_600_000) return `${Math.floor(d / 60_000)} min ago`
  if (d < 86_400_000) return `${Math.floor(d / 3_600_000)} h ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: new Date(t).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' })
}

function Requests() {
  const tickets = useMine((s) => s.tickets)
  const read = useMine((s) => s.read)
  const open = useHelp((s) => s.open)
  const setOpen = (id: string | null) => useHelp.setState({ open: id })
  const current = tickets?.find((t) => t.id === open)

  useEffect(() => void (current && markRead(current.id)), [current])

  if (!tickets)
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-zinc-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading your requests…
      </div>
    )

  if (current) return <Thread t={current} onBack={() => setOpen(null)} />

  if (!tickets.length)
    return (
      <div className={`${card} flex flex-col items-center px-6 py-14 text-center`}>
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/[0.05] text-zinc-400">
          <Inbox className="h-6 w-6" />
        </span>
        <p className="mt-4 text-base font-medium text-white">No requests yet</p>
        <p className="mt-1 max-w-sm text-sm text-zinc-500">Questions, problems and ideas you send to the team show up here, with our replies.</p>
        <button onClick={() => useHelp.setState({ tab: 'contact' })} className="mt-5 inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200">
          Contact us <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    )

  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025]">
      <ul className="divide-y divide-white/[0.06]">
        {tickets.map((t) => {
          const k = KINDS.find((x) => x.id === t.kind)!
          const st = STATUS[t.status]
          const fresh = hasNewReply(t, read)
          const lastReply = t.replies[t.replies.length - 1]
          return (
            <li key={t.id}>
              <button onClick={() => setOpen(t.id)} className="flex w-full items-center gap-3 px-4 py-4 text-left transition hover:bg-white/[0.03] sm:px-5">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${k.tone}`}>
                  <k.icon className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className={`truncate text-[15px] ${fresh ? 'font-semibold text-white' : 'font-medium text-zinc-100'}`}>{t.subject}</span>
                    {fresh && <span className="shrink-0 rounded-full bg-indigo-500 px-1.5 py-px text-[10px] font-semibold text-white">New reply</span>}
                  </span>
                  <span className="mt-0.5 block truncate text-[13px] text-zinc-500">
                    {lastReply ? `${lastReply.from === 'team' ? 'Dizayr: ' : 'You: '}${lastReply.text}` : t.message}
                  </span>
                </span>
                <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${st.cls}`}>
                    <st.icon className="h-3 w-3" /> {st.label}
                  </span>
                  <span className="text-[11px] tabular-nums text-zinc-600">
                    {ref(t.id)} · {when(t.updatedAt ?? t.createdAt)}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function Thread({ t, onBack }: { t: Ticket; onBack: () => void }) {
  const user = useCloud((s) => s.user)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const k = KINDS.find((x) => x.id === t.kind)!
  const st = STATUS[t.status]
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => end.current?.scrollIntoView({ block: 'nearest' }), [t.replies.length])

  async function send() {
    if (!text.trim() || busy) return
    setBusy(true)
    try {
      await followUp(t, text)
      setText('')
    } catch (e) {
      toast.error(isTooSoon(e) ? 'You just sent a message. Please wait a few seconds, then try again.' : 'Couldn’t send it. Check your connection and try again.')
    } finally {
      setBusy(false)
    }
  }

  async function solve() {
    try {
      await closeTicket(t)
      toast.success('Marked as solved. Glad we could help!')
    } catch {
      toast.error('Couldn’t update it. Try again.')
    }
  }

  const messages = [{ from: 'user' as const, text: t.message, at: t.createdAt ?? Date.now() }, ...t.replies]

  return (
    <div className="space-y-4">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-zinc-400 transition hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All requests
      </button>

      <div className={`${card} overflow-hidden`}>
        <header className="flex flex-wrap items-start gap-3 border-b border-white/[0.06] p-5 sm:p-6">
          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ring-1 ring-inset ${k.tone}`}>
            <k.icon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-snug text-white">{t.subject}</h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-zinc-500">
              <span className="font-mono tracking-wider">{ref(t.id)}</span>·<span>{k.title}</span>
              {t.topic && TOPICS.find((x) => x.id === t.topic) && <>·<span>{TOPICS.find((x) => x.id === t.topic)!.label}</span></>}
              {t.private && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/[0.06] px-1.5 py-px text-[10px] text-zinc-400">
                  <Lock className="h-2.5 w-2.5" /> name private
                </span>
              )}
            </p>
          </div>
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${st.cls}`}>
            <st.icon className="h-3.5 w-3.5" /> {st.label}
          </span>
        </header>

        <div className="space-y-4 p-5 sm:p-6">
          {messages.map((m, i) => {
            const mine = m.from === 'user'
            return (
              <div key={i} className={`flex gap-3 ${mine ? 'flex-row-reverse' : ''}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-xs font-semibold ${mine ? 'bg-white/[0.08] text-zinc-200' : 'bg-gradient-to-br from-indigo-400 to-emerald-400 text-white'}`}>
                  {mine ? user?.photoURL ? <img src={user.photoURL} alt="" referrerPolicy="no-referrer" className="h-full w-full object-cover" /> : (user?.displayName?.[0] ?? 'Y') : <Layers className="h-4 w-4" />}
                </span>
                <div className={`max-w-[85%] sm:max-w-[75%] ${mine ? 'items-end text-right' : ''} flex flex-col`}>
                  <p className="mb-1 text-[11px] text-zinc-500">
                    {mine ? 'You' : 'Dizayr team'} · {when(m.at)}
                  </p>
                  <div
                    className={`whitespace-pre-wrap break-words rounded-2xl px-4 py-3 text-left text-sm leading-relaxed ${
                      mine ? 'rounded-tr-md bg-indigo-500/15 text-zinc-100 ring-1 ring-inset ring-indigo-400/20' : 'rounded-tl-md bg-white/[0.05] text-zinc-200 ring-1 ring-inset ring-white/[0.08]'
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              </div>
            )
          })}
          {t.seenAt && !t.replies.some((r) => r.from === 'team') && (
            <p className="flex items-center justify-center gap-1.5 text-[11px] text-zinc-500">
              <Check className="h-3 w-3 text-emerald-400" /> Read by the team {when(t.seenAt).toLowerCase()}
            </p>
          )}
          <div ref={end} />
        </div>

        <div className="border-t border-white/[0.06] bg-black/20 p-4 sm:p-5">
          <textarea
            value={text}
            maxLength={MAX_MESSAGE}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => (e.ctrlKey || e.metaKey) && e.key === 'Enter' && void send()}
            rows={3}
            placeholder={t.status === 'resolved' ? 'Need more help? Write here to open it again.' : 'Add more details or reply…'}
            className="w-full resize-y rounded-xl border border-white/10 bg-black/30 px-3.5 py-3 text-base leading-relaxed text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-4 focus:ring-indigo-500/15 sm:text-sm"
          />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {t.status !== 'resolved' ? (
              <button onClick={() => void solve()} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-medium text-zinc-400 transition hover:bg-white/5 hover:text-emerald-200">
                <CheckCircle2 className="h-4 w-4" /> Mark as solved
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                <ShieldCheck className="h-3.5 w-3.5" /> Solved. Replying opens it again.
              </span>
            )}
            <button
              onClick={() => void send()}
              disabled={!text.trim() || busy}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-zinc-950 transition hover:bg-zinc-200 disabled:opacity-40"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

