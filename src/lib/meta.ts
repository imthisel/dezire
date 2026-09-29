import { Car, Gem, Home, Minus, TrendingDown, TrendingUp, type LucideIcon } from 'lucide-react'
import type { Category, Trend } from './types'

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
