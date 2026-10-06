import {
  Brain, Briefcase, Car, Crown, Dumbbell, Fingerprint, Gem, Home, Laptop, Lightbulb, Minus, PiggyBank, Plane, Rocket, Smartphone, Sparkles, Store,
  TrendingDown, TrendingUp, type LucideIcon,
} from 'lucide-react'
import type { Category, GoalArea, SourceKind, SourceStage, Trend } from './types'

export const CATEGORY: Record<Category, { label: string; short: string; hint: string; icon: LucideIcon }> = {
  property: { label: 'Land / Property', short: 'Property', hint: 'Land, house, condo, lot', icon: Home },
  vehicle: { label: 'Vehicle', short: 'Vehicle', hint: 'Car, motorbike, boat', icon: Car },
  status: { label: 'Status & Other', short: 'Status & other', hint: 'Watch, jewelry, gadgets, anything else', icon: Gem },
  travel: { label: 'Travel', short: 'Travel', hint: 'Trip, flights, hotel, vacation', icon: Plane },
}

export const TREND: Record<
  Trend,
  {
    label: string; hint: string; icon: LucideIcon
    text: string; bg: string; border: string; solid: string; iconBg: string; ring: string; stroke: string
    defaultRate: number
  }
> = {
  appreciating: {
    label: 'Appreciating', hint: 'Gains value over time', icon: TrendingUp,
    text: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/35',
    solid: 'bg-emerald-500', iconBg: 'bg-emerald-500/20', ring: 'ring-emerald-400/70', stroke: '#34d399', defaultRate: 5,
  },
  depreciating: {
    label: 'Depreciating', hint: 'Loses value over time', icon: TrendingDown,
    text: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/35',
    solid: 'bg-red-500', iconBg: 'bg-red-500/20', ring: 'ring-red-400/70', stroke: '#f87171', defaultRate: 15,
  },
  stable: {
    label: 'Stable', hint: 'Holds its value', icon: Minus,
    text: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/35',
    solid: 'bg-blue-500', iconBg: 'bg-blue-500/20', ring: 'ring-blue-400/70', stroke: '#60a5fa', defaultRate: 0,
  },
}

export const GOAL_AREAS: GoalArea[] = ['mind', 'body', 'status', 'identity']

/** Tailwind classes are written out in full so they survive the build. */
export const GOAL_AREA: Record<
  GoalArea,
  {
    label: string; hint: string; placeholder: string; icon: LucideIcon
    text: string; bg: string; border: string; ring: string; iconBg: string; check: string; glow: string; stroke: string
    hoverText: string; hoverBorder: string
  }
> = {
  mind: {
    label: 'IQ / Career', hint: 'Learning, skills, work, income', placeholder: 'e.g. Get promoted to senior',
    icon: Brain,
    text: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-400/40', ring: 'ring-sky-400/60',
    iconBg: 'bg-sky-500/15', check: 'border-sky-400 bg-sky-400', glow: 'from-sky-500/[0.08]', hoverText: 'hover:text-sky-300', hoverBorder: 'hover:border-sky-400', stroke: '#38bdf8',
  },
  body: {
    label: 'Physical health / Sports', hint: 'Fitness, training, food, sleep', placeholder: 'e.g. Run a half marathon',
    icon: Dumbbell,
    text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-400/40', ring: 'ring-orange-400/60',
    iconBg: 'bg-orange-500/15', check: 'border-orange-400 bg-orange-400', glow: 'from-orange-500/[0.08]', hoverText: 'hover:text-orange-300', hoverBorder: 'hover:border-orange-400', stroke: '#fb923c',
  },
  status: {
    label: 'Status', hint: 'Reputation, network, lifestyle', placeholder: 'e.g. Speak at a conference',
    icon: Crown,
    text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-400/40', ring: 'ring-amber-400/60',
    iconBg: 'bg-amber-500/15', check: 'border-amber-400 bg-amber-400', glow: 'from-amber-500/[0.08]', hoverText: 'hover:text-amber-300', hoverBorder: 'hover:border-amber-400', stroke: '#fbbf24',
  },
  identity: {
    label: 'Identity', hint: 'Who you are, values, habits', placeholder: 'e.g. Become someone who reads daily',
    icon: Fingerprint,
    text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-400/40', ring: 'ring-fuchsia-400/60',
    iconBg: 'bg-fuchsia-500/15', check: 'border-fuchsia-400 bg-fuchsia-400', glow: 'from-fuchsia-500/[0.08]', hoverText: 'hover:text-fuchsia-300', hoverBorder: 'hover:border-fuchsia-400', stroke: '#e879f9',
  },
}

/** Ways of making money, for the Money plan page. `calc` = the "how many sales do I need" math makes sense for it. */
export const SOURCE_KINDS: SourceKind[] = ['business', 'freelance', 'online', 'job', 'invest', 'other']

export const SOURCE_KIND: Record<
  SourceKind,
  {
    label: string; hint: string; placeholder: string; icon: LucideIcon
    /** What one "sale" is called for this kind, singular / plural */
    unit: [string, string]
    calc: boolean
    /** Starter steps the user can tap to add */
    steps: string[]
    text: string; iconBg: string; chip: string; glow: string; bar: string
  }
> = {
  business: {
    label: 'Business', hint: 'Shop, food, products, services', placeholder: 'e.g. Milk tea stall', icon: Store,
    unit: ['sale', 'sales'], calc: true,
    steps: ['Decide what to sell and who will buy it', 'Work out the price and what each one costs you', 'Get the permit or setup you need', 'Make your first sale', 'Ask happy customers to tell their friends'],
    text: 'text-emerald-300', iconBg: 'bg-emerald-500/15', chip: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200', glow: 'from-emerald-500/[0.08]', bar: 'bg-emerald-400',
  },
  freelance: {
    label: 'Freelance / Service', hint: 'Projects, clients, skills', placeholder: 'e.g. Logo design', icon: Laptop,
    unit: ['client', 'clients'], calc: true,
    steps: ['Pick one service you are good at', 'Make a few samples or a simple portfolio', 'Set your rate', 'Message 10 people who might need it', 'Land your first paying client'],
    text: 'text-violet-300', iconBg: 'bg-violet-500/15', chip: 'border-violet-400/50 bg-violet-500/15 text-violet-200', glow: 'from-violet-500/[0.08]', bar: 'bg-violet-400',
  },
  online: {
    label: 'Online / Content', hint: 'Selling online, videos, social media', placeholder: 'e.g. TikTok shop', icon: Smartphone,
    unit: ['sale', 'sales'], calc: true,
    steps: ['Pick one platform to start on', 'Post on a schedule (e.g. 3 times a week)', 'Reach your first 1,000 followers', 'Add a way to earn (products, affiliate, ads)'],
    text: 'text-pink-300', iconBg: 'bg-pink-500/15', chip: 'border-pink-400/50 bg-pink-500/15 text-pink-200', glow: 'from-pink-500/[0.08]', bar: 'bg-pink-400',
  },
  job: {
    label: 'Job / Salary', hint: 'Full-time, part-time, shifts', placeholder: 'e.g. Day job', icon: Briefcase,
    unit: ['shift', 'shifts'], calc: false,
    steps: ['Update your CV', 'Apply to 5 jobs a week', 'Ask for a raise or more hours', 'Learn one skill that pays more'],
    text: 'text-sky-300', iconBg: 'bg-sky-500/15', chip: 'border-sky-400/50 bg-sky-500/15 text-sky-200', glow: 'from-sky-500/[0.08]', bar: 'bg-sky-400',
  },
  invest: {
    label: 'Investing / Rent', hint: 'Stocks, savings, rentals', placeholder: 'e.g. Rent out a room', icon: PiggyBank,
    unit: ['tenant', 'tenants'], calc: false,
    steps: ['Save an emergency fund first', 'Learn the basics of what you will invest in', 'Start small', 'Add a fixed amount every month'],
    text: 'text-amber-300', iconBg: 'bg-amber-500/15', chip: 'border-amber-400/50 bg-amber-500/15 text-amber-200', glow: 'from-amber-500/[0.08]', bar: 'bg-amber-400',
  },
  other: {
    label: 'Something else', hint: 'Any other idea', placeholder: 'e.g. Reselling sneakers', icon: Sparkles,
    unit: ['sale', 'sales'], calc: true,
    steps: ['Write down the idea in one sentence', 'Find out if people would pay for it', 'Try it once, small'],
    text: 'text-zinc-200', iconBg: 'bg-white/10', chip: 'border-white/30 bg-white/10 text-white', glow: 'from-white/[0.05]', bar: 'bg-zinc-300',
  },
}

export const SOURCE_STAGES: SourceStage[] = ['idea', 'starting', 'running']

export const SOURCE_STAGE: Record<SourceStage, { label: string; icon: LucideIcon; chip: string }> = {
  idea: { label: 'Just an idea', icon: Lightbulb, chip: 'border-amber-400/50 bg-amber-500/15 text-amber-200' },
  starting: { label: 'Getting started', icon: Rocket, chip: 'border-sky-400/50 bg-sky-500/15 text-sky-200' },
  running: { label: 'Already earning', icon: TrendingUp, chip: 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200' },
}
