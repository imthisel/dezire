import { Crown, ExternalLink, Sparkles } from 'lucide-react'
import { openPlans, useAccess } from '../billing'
import { PLANS, TRIAL_DAYS, billingUrl, pesos } from '../lib/plans'
import { Modal } from './Modal'
import { PlanStatus, Pricing } from './About'

/** During the free trial: a slim bar at the top with the days left and a way to pick a plan. */
export function TrialBanner() {
  const state = useAccess((s) => s.state)
  const ends = useAccess((s) => s.trialEndsAt)
  if (state !== 'trial' || !ends) return null
  const days = Math.max(0, Math.ceil((ends - Date.now()) / 86_400_000))
  const urgent = days <= 2
  return (
    <div
      className={`relative z-30 flex items-center justify-center gap-3 px-4 py-2 text-center text-[13px] ${
        urgent ? 'bg-gradient-to-r from-amber-500/20 via-rose-500/20 to-amber-500/20 text-amber-50' : 'bg-gradient-to-r from-indigo-500/15 via-fuchsia-500/15 to-indigo-500/15 text-indigo-50'
      }`}
    >
      <Sparkles className={`hidden h-4 w-4 shrink-0 sm:block ${urgent ? 'text-amber-300' : 'text-indigo-300'}`} />
      <span>
        <span className="font-semibold">Free trial</span> · {days === 0 ? 'ends today' : `${days} of ${TRIAL_DAYS} days left`}
        <span className="hidden sm:inline"> · keep everything you plan</span>
      </span>
      <button
        onClick={() => openPlans()}
        className="rounded-lg bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-900 transition hover:bg-white"
      >
        Choose a plan
      </button>
    </div>
  )
}

/** The subscription as shown on every page: what you can get, or what you already have. Nothing until access is known. */
function usePremium() {
  const state = useAccess((s) => s.state)
  const plan = useAccess((s) => s.plan)
  if (state === 'checking') return null
  if (state === 'lifetime') return { label: 'Lifetime', upgrade: false }
  if (state === 'comp' || (state === 'paid' && plan !== 'semiannual')) return { label: 'Premium', upgrade: false }
  return { label: state === 'paid' ? 'Go Yearly' : 'Get Premium', upgrade: true }
}

/** Why to upgrade, in a few words. Comes from the yearly plan, so it can't drift from the real price. */
const UPGRADE_HINT = `${PLANS.annual.perks[0]} · ${pesos(PLANS.annual.price)} a year`

/** Header: gold when there's something to get, quieter once you have it. Opens Plans & billing either way. */
export function PremiumBadge() {
  const premium = usePremium()
  if (!premium) return null
  const { label, upgrade } = premium
  return (
    <button
      onClick={() => openPlans()}
      aria-label={upgrade ? label : `${label}: plan & billing`}
      title={upgrade ? UPGRADE_HINT : 'Plan & billing'}
      className={`inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl px-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#07080c] ${
        upgrade
          ? 'premium-sheen bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950 shadow-lg shadow-amber-500/20 hover:from-amber-100 hover:to-amber-300 hover:shadow-amber-400/30 active:scale-[0.97] sm:px-3'
          : 'border border-amber-300/25 bg-amber-300/[0.08] text-amber-200 hover:border-amber-300/45 hover:bg-amber-300/[0.14] sm:px-3'
      }`}
    >
      <Crown className="h-4 w-4 shrink-0" strokeWidth={2.4} />
      {/* Phones are tight: a shorter label, and just the crown on the smallest */}
      <span className="hidden sm:inline">{label}</span>
      <span className="hidden min-[390px]:inline sm:hidden">{label.replace('Get ', '')}</span>
    </button>
  )
}

/** Sidebar: the offer with a little more room, only when there's something to get. */
export function PremiumCard({ onOpen }: { onOpen: () => void }) {
  const premium = usePremium()
  if (!premium?.upgrade) return null
  return (
    <button
      onClick={() => {
        onOpen()
        openPlans()
      }}
      className="group mx-3 mb-2 flex items-center gap-3 rounded-xl border border-amber-300/25 bg-gradient-to-br from-amber-300/[0.13] to-amber-300/[0.03] px-3 py-2.5 text-left transition hover:border-amber-300/50 hover:from-amber-300/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/70"
    >
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950 shadow-md shadow-amber-500/20 transition group-hover:scale-105">
        <Crown className="h-4 w-4" strokeWidth={2.4} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-semibold text-amber-50">{premium.label}</span>
          {PLANS.annual.badge && <span className="shrink-0 rounded-full bg-amber-300/15 px-1.5 py-px text-[10px] font-semibold text-amber-200">{PLANS.annual.badge}</span>}
        </span>
        <span className="block truncate text-[11px] text-amber-100/60">{UPGRADE_HINT}</span>
      </span>
    </button>
  )
}

/** Plans & billing: where you stand, the plans, and (for subscribers) a way to manage the subscription. */
export function PlansModal() {
  const open = useAccess((s) => s.plansOpen)
  const state = useAccess((s) => s.state)
  if (!open) return null
  const subscribed = state === 'paid'
  return (
    <Modal title="Plan & billing" subtitle={<PlanStatus />} onClose={() => openPlans(false)} width="max-w-3xl">
      <div className="py-2">
        {state !== 'lifetime' && state !== 'comp' && <Pricing compact />}
        {subscribed && billingUrl() && (
          <div className="mt-6 flex justify-center">
            <a
              href={billingUrl()}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 px-4 text-sm font-medium text-zinc-200 transition hover:bg-white/5"
            >
              Manage billing: card, plan or cancel <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        )}
      </div>
    </Modal>
  )
}
