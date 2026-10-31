import { ExternalLink, Sparkles } from 'lucide-react'
import { openPlans, useAccess } from '../billing'
import { TRIAL_DAYS, billingUrl } from '../lib/plans'
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
