import {
  Baby, Bike, Bitcoin, BookOpen, Brain, Briefcase, Building2, Camera, CandlestickChart, Car, Coins, Crown, Dumbbell, Fingerprint, Gamepad2, Gem, Gift,
  GraduationCap, HeartPulse, Home, Landmark, Laptop, Lightbulb, Minus, Music, Package, Palette, PawPrint, PiggyBank, Plane, Rocket, Sailboat, Shirt,
  Smartphone, Sparkles, Store, Tent, Trees, TrendingDown, TrendingUp, Watch, Wrench, Target, Heart, Star, Users, Sun, Mountain, Flame, Smile,
  Compass, Leaf, type LucideIcon,
} from 'lucide-react'
import type { GoalAreaDef, ItemKind, SourceKind, SourceStage, Trend } from './types'

/** Icons a kind of item can use, by name. */
export const KIND_ICONS: Record<string, LucideIcon> = {
  home: Home, building: Building2, land: Trees, car: Car, bike: Bike, boat: Sailboat, plane: Plane,
  stocks: CandlestickChart, crypto: Bitcoin, savings: PiggyBank, bank: Landmark, coins: Coins, business: Briefcase, shop: Store,
  gem: Gem, watch: Watch, phone: Smartphone, laptop: Laptop, games: Gamepad2, clothes: Shirt, art: Palette, music: Music,
  camera: Camera, books: BookOpen, school: GraduationCap, health: HeartPulse, fitness: Dumbbell, pets: PawPrint, baby: Baby,
  gift: Gift, camping: Tent, tools: Wrench, box: Package, other: Sparkles,
}

/** Colours a kind of item can use (written out in full so Tailwind keeps them). */
export const KIND_COLORS: Record<string, { label: string; grad: string; bar: string; text: string; soft: string; ring: string }> = {
  teal: { label: 'Teal', grad: 'from-teal-300 to-emerald-500', bar: 'bg-teal-400', text: 'text-teal-300', soft: 'bg-teal-500/15', ring: 'ring-teal-300' },
  cyan: { label: 'Cyan', grad: 'from-cyan-300 to-sky-500', bar: 'bg-cyan-400', text: 'text-cyan-300', soft: 'bg-cyan-500/15', ring: 'ring-cyan-300' },
  blue: { label: 'Blue', grad: 'from-sky-300 to-blue-500', bar: 'bg-blue-400', text: 'text-blue-300', soft: 'bg-blue-500/15', ring: 'ring-blue-300' },
  violet: { label: 'Violet', grad: 'from-violet-300 to-indigo-500', bar: 'bg-violet-400', text: 'text-violet-300', soft: 'bg-violet-500/15', ring: 'ring-violet-300' },
  pink: { label: 'Pink', grad: 'from-fuchsia-300 to-pink-500', bar: 'bg-fuchsia-400', text: 'text-fuchsia-300', soft: 'bg-fuchsia-500/15', ring: 'ring-fuchsia-300' },
  rose: { label: 'Rose', grad: 'from-rose-300 to-red-500', bar: 'bg-rose-400', text: 'text-rose-300', soft: 'bg-rose-500/15', ring: 'ring-rose-300' },
  orange: { label: 'Orange', grad: 'from-amber-300 to-orange-500', bar: 'bg-orange-400', text: 'text-orange-300', soft: 'bg-orange-500/15', ring: 'ring-orange-300' },
  yellow: { label: 'Yellow', grad: 'from-yellow-200 to-amber-400', bar: 'bg-yellow-300', text: 'text-yellow-200', soft: 'bg-yellow-400/15', ring: 'ring-yellow-200' },
  lime: { label: 'Lime', grad: 'from-lime-300 to-green-500', bar: 'bg-lime-400', text: 'text-lime-300', soft: 'bg-lime-500/15', ring: 'ring-lime-300' },
  slate: { label: 'Grey', grad: 'from-zinc-300 to-slate-500', bar: 'bg-zinc-400', text: 'text-zinc-300', soft: 'bg-white/10', ring: 'ring-zinc-300' },
}

/** The kinds every new account starts with. Their ids are fixed (old items and the property ↔ vehicle link use them). */
export const DEFAULT_KINDS: ItemKind[] = [
  { id: 'property', label: 'Land / Property', hint: 'Land, house, condo, lot', icon: 'home', color: 'teal' },
  { id: 'vehicle', label: 'Vehicle', hint: 'Car, motorbike, boat', icon: 'car', color: 'cyan' },
  { id: 'investment', label: 'Investments', hint: 'Stocks, crypto, funds, risky bets', icon: 'stocks', color: 'lime' },
  { id: 'status', label: 'Status & Other', hint: 'Watch, jewelry, gadgets, anything else', icon: 'gem', color: 'pink' },
  { id: 'travel', label: 'Travel', hint: 'Trip, flights, hotel, vacation', icon: 'plane', color: 'orange' },
]

/** Shown for an item whose kind no longer exists (e.g. deleted on another device a moment ago). */
export const UNKNOWN_KIND: ItemKind = { id: '', label: 'No kind', hint: '', icon: 'box', color: 'slate' }

export const kindIcon = (k: ItemKind) => KIND_ICONS[k.icon] ?? Package
export const kindColor = (k: ItemKind) => KIND_COLORS[k.color] ?? KIND_COLORS.slate

/** Words in a new kind's name that suggest an icon, so it starts with a fitting one. */
const ICON_WORDS: [RegExp, string][] = [
  [/house|home|condo|apartment|property|real estate|rental/, 'home'],
  [/building|office|commercial/, 'building'],
  [/land|lot|farm|garden/, 'land'],
  [/car|vehicle|truck|suv|auto/, 'car'],
  [/bike|bicycle|motor/, 'bike'],
  [/boat|yacht|ship/, 'boat'],
  [/travel|trip|flight|vacation|holiday/, 'plane'],
  [/stock|invest|fund|etf|share|trading|forex/, 'stocks'],
  [/crypto|bitcoin|btc|eth|coin/, 'crypto'],
  [/sav|emergency|piggy/, 'savings'],
  [/bank|bond|insurance|pension|retire/, 'bank'],
  [/gold|silver|cash|money/, 'coins'],
  [/business|startup|company|franchise/, 'business'],
  [/shop|store|stall/, 'shop'],
  [/jewel|status|luxury|ring|diamond/, 'gem'],
  [/watch/, 'watch'],
  [/phone|gadget|tech/, 'phone'],
  [/laptop|computer|pc/, 'laptop'],
  [/game|console/, 'games'],
  [/cloth|fashion|shoe|sneaker|bag/, 'clothes'],
  [/art|paint|collect/, 'art'],
  [/music|guitar|piano|instrument/, 'music'],
  [/camera|photo/, 'camera'],
  [/book/, 'books'],
  [/school|educat|course|study|tuition/, 'school'],
  [/health|medical|doctor/, 'health'],
  [/gym|fitness|sport/, 'fitness'],
  [/pet|dog|cat/, 'pets'],
  [/baby|kid|child|family/, 'baby'],
  [/gift|wedding|party|event/, 'gift'],
  [/camp|outdoor/, 'camping'],
  [/tool|equipment|repair/, 'tools'],
]
export const guessIcon = (name: string) => ICON_WORDS.find(([re]) => re.test(name.toLowerCase()))?.[1] ?? 'box'

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

/** Icons a goal area can use, by name: the item icons plus a few for life goals. */
export const GOAL_ICONS: Record<string, LucideIcon> = {
  brain: Brain, fitness: Dumbbell, crown: Crown, identity: Fingerprint, target: Target, heart: Heart, star: Star, people: Users,
  sun: Sun, mountain: Mountain, flame: Flame, smile: Smile, compass: Compass, leaf: Leaf,
  ...KIND_ICONS,
}

/** Colours a goal area can use. Tailwind classes are written out in full so they survive the build. */
export const GOAL_COLORS: Record<
  string,
  {
    label: string
    /** For the progress bar, ring and drop line */
    stroke: string
    text: string; bg: string; border: string; ring: string; iconBg: string; check: string; glow: string
    hoverText: string; hoverBorder: string
  }
> = {
  sky: {
    label: 'Sky', stroke: '#38bdf8',
    text: 'text-sky-300', bg: 'bg-sky-500/10', border: 'border-sky-400/40', ring: 'ring-sky-400/60',
    iconBg: 'bg-sky-500/15', check: 'border-sky-400 bg-sky-400', glow: 'from-sky-500/[0.08]', hoverText: 'hover:text-sky-300', hoverBorder: 'hover:border-sky-400',
  },
  orange: {
    label: 'Orange', stroke: '#fb923c',
    text: 'text-orange-300', bg: 'bg-orange-500/10', border: 'border-orange-400/40', ring: 'ring-orange-400/60',
    iconBg: 'bg-orange-500/15', check: 'border-orange-400 bg-orange-400', glow: 'from-orange-500/[0.08]', hoverText: 'hover:text-orange-300', hoverBorder: 'hover:border-orange-400',
  },
  amber: {
    label: 'Amber', stroke: '#fbbf24',
    text: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-400/40', ring: 'ring-amber-400/60',
    iconBg: 'bg-amber-500/15', check: 'border-amber-400 bg-amber-400', glow: 'from-amber-500/[0.08]', hoverText: 'hover:text-amber-300', hoverBorder: 'hover:border-amber-400',
  },
  fuchsia: {
    label: 'Pink', stroke: '#e879f9',
    text: 'text-fuchsia-300', bg: 'bg-fuchsia-500/10', border: 'border-fuchsia-400/40', ring: 'ring-fuchsia-400/60',
    iconBg: 'bg-fuchsia-500/15', check: 'border-fuchsia-400 bg-fuchsia-400', glow: 'from-fuchsia-500/[0.08]', hoverText: 'hover:text-fuchsia-300', hoverBorder: 'hover:border-fuchsia-400',
  },
  emerald: {
    label: 'Green', stroke: '#34d399',
    text: 'text-emerald-300', bg: 'bg-emerald-500/10', border: 'border-emerald-400/40', ring: 'ring-emerald-400/60',
    iconBg: 'bg-emerald-500/15', check: 'border-emerald-400 bg-emerald-400', glow: 'from-emerald-500/[0.08]', hoverText: 'hover:text-emerald-300', hoverBorder: 'hover:border-emerald-400',
  },
  teal: {
    label: 'Teal', stroke: '#2dd4bf',
    text: 'text-teal-300', bg: 'bg-teal-500/10', border: 'border-teal-400/40', ring: 'ring-teal-400/60',
    iconBg: 'bg-teal-500/15', check: 'border-teal-400 bg-teal-400', glow: 'from-teal-500/[0.08]', hoverText: 'hover:text-teal-300', hoverBorder: 'hover:border-teal-400',
  },
  violet: {
    label: 'Violet', stroke: '#a78bfa',
    text: 'text-violet-300', bg: 'bg-violet-500/10', border: 'border-violet-400/40', ring: 'ring-violet-400/60',
    iconBg: 'bg-violet-500/15', check: 'border-violet-400 bg-violet-400', glow: 'from-violet-500/[0.08]', hoverText: 'hover:text-violet-300', hoverBorder: 'hover:border-violet-400',
  },
  rose: {
    label: 'Red', stroke: '#fb7185',
    text: 'text-rose-300', bg: 'bg-rose-500/10', border: 'border-rose-400/40', ring: 'ring-rose-400/60',
    iconBg: 'bg-rose-500/15', check: 'border-rose-400 bg-rose-400', glow: 'from-rose-500/[0.08]', hoverText: 'hover:text-rose-300', hoverBorder: 'hover:border-rose-400',
  },
  lime: {
    label: 'Lime', stroke: '#a3e635',
    text: 'text-lime-300', bg: 'bg-lime-500/10', border: 'border-lime-400/40', ring: 'ring-lime-400/60',
    iconBg: 'bg-lime-500/15', check: 'border-lime-400 bg-lime-400', glow: 'from-lime-500/[0.08]', hoverText: 'hover:text-lime-300', hoverBorder: 'hover:border-lime-400',
  },
  slate: {
    label: 'Grey', stroke: '#a1a1aa',
    text: 'text-zinc-200', bg: 'bg-white/[0.06]', border: 'border-zinc-400/40', ring: 'ring-zinc-400/60',
    iconBg: 'bg-white/10', check: 'border-zinc-300 bg-zinc-300', glow: 'from-white/[0.05]', hoverText: 'hover:text-zinc-200', hoverBorder: 'hover:border-zinc-300',
  },
}

/** The areas every new account starts with. Their ids are fixed (goals saved before areas were editable use them). */
export const DEFAULT_GOAL_AREAS: GoalAreaDef[] = [
  { id: 'mind', label: 'IQ / Career', hint: 'Learning, skills, work, income', icon: 'brain', color: 'sky' },
  { id: 'body', label: 'Physical health / Sports', hint: 'Fitness, training, food, sleep', icon: 'fitness', color: 'orange' },
  { id: 'status', label: 'Status', hint: 'Reputation, network, lifestyle', icon: 'crown', color: 'amber' },
  { id: 'identity', label: 'Identity', hint: 'Who you are, values, habits', icon: 'identity', color: 'fuchsia' },
]

/** Example goals for the starter areas, shown in the empty goal box. */
const GOAL_PLACEHOLDER: Record<string, string> = {
  mind: 'e.g. Get promoted to senior',
  body: 'e.g. Run a half marathon',
  status: 'e.g. Speak at a conference',
  identity: 'e.g. Become someone who reads daily',
}
export const goalPlaceholder = (a: GoalAreaDef) => GOAL_PLACEHOLDER[a.id] ?? 'Write your goal'

/** Shown for a goal whose area no longer exists (e.g. deleted on another device a moment ago). */
export const UNKNOWN_AREA: GoalAreaDef = { id: '', label: 'No area', hint: '', icon: 'other', color: 'slate' }

/** Words in a new area's name that suggest an icon; falls back to the item-kind words, then a target. */
const AREA_WORDS: [RegExp, string][] = [
  [/mind|iq|brain|learn|skill|career|work|job/, 'brain'],
  [/body|health|fit|sport|gym|run/, 'fitness'],
  [/status|fame|reputation/, 'crown'],
  [/identity|self|habit|value/, 'identity'],
  [/love|relationship|partner|dating|romance/, 'heart'],
  [/friend|social|network|people|community/, 'people'],
  [/spirit|faith|god|church|soul|peace|mental/, 'sun'],
  [/advent|challenge|climb/, 'mountain'],
  [/fun|joy|happy|hobby|hobbies/, 'smile'],
  [/nature|environment|green|eco/, 'leaf'],
]
export const guessAreaIcon = (name: string) => {
  const n = name.toLowerCase()
  const icon = AREA_WORDS.find(([re]) => re.test(n))?.[1] ?? guessIcon(n)
  return icon === 'box' ? 'target' : icon
}

export const areaIcon = (a: GoalAreaDef) => GOAL_ICONS[a.icon] ?? Sparkles
export const areaColor = (a: GoalAreaDef) => GOAL_COLORS[a.color] ?? GOAL_COLORS.slate

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
