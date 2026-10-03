import { Brain, Car, Crown, Dumbbell, Fingerprint, Gem, Home, Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import type { Category, GoalArea, Trend } from './types'

export const CATEGORY: Record<Category, { label: string; short: string; hint: string; icon: LucideIcon }> = {
  property: { label: 'Land / Property', short: 'Property', hint: 'Land, house, condo, lot', icon: Home },
  vehicle: { label: 'Vehicle', short: 'Vehicle', hint: 'Car, motorbike, boat', icon: Car },
  status: { label: 'Status', short: 'Status', hint: 'Watch, jewelry, luxury', icon: Gem },
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
