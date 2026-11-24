import { useMemo } from 'react'
import { create } from 'zustand'
import type { IncomeSource, PlanStep } from '../../lib/types'
import { IncomePlanView, type IncomeApi, type IncomeData } from '../MoneyPlan'
import { Toolbar, compute, money, moneyShort } from './TryOverview'
import { DEMO_OFFSETS, monthLabel, useDemo } from './demoStore'

/*
 * A playable copy of the Income plan on the About page: the app's own page, on plans kept in this page's memory.
 * Its "goal for this month" is this month's goal under Wants (the playground's shared plan), so the two line up.
 */

let lastId = 0
const id = () => `try-inc-${++lastId}`
const step = (text: string, done = false): PlanStep => ({ id: id(), text, done })
const source = (s: Partial<IncomeSource> & Pick<IncomeSource, 'name' | 'kind' | 'stage'>): IncomeSource => ({
  id: id(), monthlyGoal: 0, price: 0, costPerSale: 0, monthlyCosts: 0, steps: [], notes: '', createdAt: Date.now(), ...s,
})

function example(): IncomeSource[] {
  return [
    source({
      name: 'SaaS', kind: 'business', stage: 'running', monthlyGoal: 1_000_000,
      price: 2_990, costPerSale: 300, monthlyCosts: 150_000,
      steps: [step('Ship the annual plan with 2 months free', true), step('Add a referral program'), step('Hire a part-time support person')],
      notes: 'Subscriptions at ₱2,990 a month. Servers, tools and payment fees are the costs.',
    }),
    source({
      name: 'Software engineer', kind: 'job', stage: 'running', monthlyGoal: 180_000,
      steps: [step('Finish the payments migration', true), step('Ask for the senior raise at review')],
    }),
    source({
      name: 'Memecoins', kind: 'invest', stage: 'running', monthlyGoal: 200_000,
      steps: [step('Take profits every month, never all in', true), step('Cap it at 5% of net worth')],
      notes: 'Side hustle, high risk: only money I can afford to lose.',
    }),
    source({
      name: 'Digital products', kind: 'online', stage: 'starting', monthlyGoal: 100_000,
      price: 1_499, costPerSale: 90,
      steps: [step('Finish the Notion template pack'), step('Launch it to the TikTok audience')],
    }),
    source({
      name: 'TikTok affiliate', kind: 'online', stage: 'running', monthlyGoal: 30_000,
      price: 150, costPerSale: 0,
      steps: [step('Post one review a day', true), step('Pin the best-selling links')],
    }),
    source({ name: 'Dropshipping', kind: 'online', stage: 'idea' }),
    source({ name: 'YouTube automation', kind: 'online', stage: 'idea' }),
  ]
}

const move = <T extends { id: string }>(list: T[], itemId: string, to: number) => {
  const from = list.findIndex((x) => x.id === itemId)
  if (from < 0) return list
  const next = [...list]
  const [it] = next.splice(from, 1)
  next.splice(Math.max(0, Math.min(to, next.length)), 0, it)
  return next
}
const steps = (list: IncomeSource[], sourceId: string, f: (s: PlanStep[]) => PlanStep[]) =>
  list.map((x) => (x.id === sourceId ? { ...x, steps: f(x.steps) } : x))

const useIncomeDemo = create<IncomeData & { reset: () => void; clear: () => void }>((set) => ({
  sources: example(),
  addSource: (kind) => {
    const s = source({ name: '', kind, stage: 'idea' })
    set((d) => ({ sources: [...d.sources, s] }))
    return s.id
  },
  updateSource: (sid, patch) => set((d) => ({ sources: d.sources.map((x) => (x.id === sid ? { ...x, ...patch } : x)) })),
  removeSource: (sid) => set((d) => ({ sources: d.sources.filter((x) => x.id !== sid) })),
  moveSource: (sid, to) => set((d) => ({ sources: move(d.sources, sid, to) })),
  addStep: (sid, text) => text.trim() && set((d) => ({ sources: steps(d.sources, sid, (l) => [...l, step(text.trim())]) })),
  updateStep: (sid, stepId, patch) => set((d) => ({ sources: steps(d.sources, sid, (l) => l.map((x) => (x.id === stepId ? { ...x, ...patch } : x))) })),
  removeStep: (sid, stepId) => set((d) => ({ sources: steps(d.sources, sid, (l) => l.filter((x) => x.id !== stepId)) })),
  moveStep: (sid, stepId, to) => set((d) => ({ sources: steps(d.sources, sid, (l) => move(l, stepId, to)) })),
  reset: () => set({ sources: example() }),
  clear: () => set({ sources: [] }),
}))

export function TryIncome() {
  // The first month's goal to make, worked out from its net worth goal when it has one (as the app's Income plan does).
  const months = useDemo((d) => d.months)
  const goal = useMemo(() => compute(months, undefined, DEMO_OFFSETS)[0].goal, [months])
  const api = useMemo<IncomeApi>(
    () => ({
      use: (pick) => useIncomeDemo(pick),
      get: () => useIncomeDemo.getState(),
      goal: { label: monthLabel(0), value: goal, set: (n) => useDemo.getState().update(0, { goal: n }) },
      fmt: (n, compact) => (compact ? moneyShort(n) : money(n)),
      alt: null,
      remember: false,
      openFirst: true,
    }),
    [goal],
  )
  return (
    <div>
      <Toolbar onReset={() => useIncomeDemo.getState().reset()} onClear={() => useIncomeDemo.getState().clear()} />
      <div className="mt-4">
        <IncomePlanView api={api} />
      </div>
    </div>
  )
}
