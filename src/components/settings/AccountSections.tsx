import { CreditCard, Crown, ExternalLink, LogOut, ShieldCheck, Sparkles } from 'lucide-react'
import { openPlans, useAccess, useModeLimit } from '../../billing'
import { signOut, useCloud } from '../../cloud'
import { TRIAL_DAYS, billingUrl } from '../../lib/plans'
import { useStore } from '../../store'
import { toast } from '../../toast'
import { Avatar, STATUS } from '../AccountMenu'
import { PlanStatus } from '../About'
import { BirthdayInput } from '../Birthday'
import { ActionRow, Button, Group, Row } from './ui'

const longDate = (ms: number) => new Date(ms).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })

export function AccountSection() {
  const user = useCloud((s) => s.user)
  const status = useCloud((s) => s.status)
  if (!user) return null
  const name = user.displayName || user.email || 'Account'
  const since = user.metadata.creationTime ? Date.parse(user.metadata.creationTime) : NaN
  const st = STATUS[status]

  return (
    <>
      <div id="set-profile" className="flex scroll-mt-4 items-center gap-4 rounded-2xl border border-white/[0.07] bg-gradient-to-br from-indigo-500/[0.12] to-emerald-500/[0.06] p-4 sm:p-5">
        <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-full border border-white/15">
          <Avatar url={user.photoURL} name={name} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-white">{user.displayName || 'Signed in'}</p>
          <p className="truncate text-sm text-zinc-400">{user.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-zinc-500">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-300" /> Signed in with Google
            {!Number.isNaN(since) && ` · joined ${longDate(since)}`}
          </p>
        </div>
      </div>

      <Group title="About you">
        <Row id="birthday" title="Birthday" hint="Shows your age on your birth month, and moves your mid-year setup to that month." stacked>
          <div className="max-w-xs">
            <BirthdayInput />
          </div>
        </Row>
      </Group>

      <Group title="Saving">
        <Row id="sync" title="Saving & sync" hint="Your plan saves to your Google account as you go and stays the same on all your devices.">
          <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${st.cls}`}>
            <st.icon className={`h-3.5 w-3.5 ${st.spin ? 'animate-spin' : ''}`} strokeWidth={2.5} /> {st.label}
          </span>
        </Row>
      </Group>

      <Group title="Session">
        <ActionRow
          id="signout"
          icon={LogOut}
          title="Sign out"
          hint="Removes your plan from this device. It stays safe in your account for next time."
          onClick={async () => {
            await signOut()
            toast.info('Signed out.')
          }}
        />
      </Group>
    </>
  )
}

export function PlanSection() {
  const access = useAccess()
  const modes = useStore((s) => s.modes.length)
  const limit = useModeLimit()
  const billing = billingUrl()
  const subscribed = access.state === 'paid'
  const free = access.state === 'lifetime' || access.state === 'comp'
  const trialLeft = access.state === 'trial' && access.trialEndsAt ? Math.max(0, Math.ceil((access.trialEndsAt - Date.now()) / 86_400_000)) : null

  return (
    <>
      <div id="set-plan-status" className="scroll-mt-4 rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-300/[0.1] to-amber-300/[0.02] p-4 sm:p-5">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-b from-amber-200 to-amber-400 text-amber-950 shadow-md shadow-amber-500/20">
            <Crown className="h-5 w-5" strokeWidth={2.4} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-base font-semibold text-white">Your plan</p>
            <PlanStatus />
          </div>
        </div>
        {trialLeft !== null && (
          <div className="mt-4">
            <div className="h-1.5 overflow-hidden rounded-full bg-white/10" role="progressbar" aria-label="Free trial days left" aria-valuemin={0} aria-valuemax={TRIAL_DAYS} aria-valuenow={trialLeft}>
              <div className="h-full rounded-full bg-gradient-to-r from-amber-200 to-amber-400" style={{ width: `${Math.min(100, (trialLeft / TRIAL_DAYS) * 100)}%` }} />
            </div>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          {!free && (
            <Button tone="primary" icon={Sparkles} onClick={() => openPlans()}>
              {subscribed ? 'See plans' : 'Choose a plan'}
            </Button>
          )}
          {subscribed && billing && (
            <a href={billing} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-[13px] font-semibold text-zinc-200 transition hover:bg-white/5 hover:text-white">
              Manage billing <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      <Group title="What’s included">
        <Row id="plan-modes" title="Modes" hint="Wants modes for big goals, Needs modes for weekly and monthly budgets.">
          <span className="text-[13px] font-medium tabular-nums text-zinc-300">{limit === Infinity ? `${modes} · unlimited` : `${Math.min(modes, limit)} of ${limit}`}</span>
        </Row>
        <ActionRow id="plan-billing" icon={CreditCard} title="Plans & billing" hint={subscribed ? 'Compare plans, or change your card or plan.' : 'Compare plans and prices.'} onClick={() => openPlans()} />
      </Group>
    </>
  )
}
