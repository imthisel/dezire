import { useMemo } from 'react'
import { create } from 'zustand'
import type { IncomeSource, PlanStep } from '../../lib/types'
import { IncomePlanView, type IncomeApi, type IncomeData } from '../MoneyPlan'
import { Toolbar, money, moneyShort } from './TryOverview'
import { monthLabel, useDemo } from './demoStore'

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
      name: 'Specialty coffee roastery', kind: 'business', stage: 'running', monthlyGoal: 1_200_000,
      price: 1_450, costPerSale: 520, monthlyCosts: 180_000,
      steps: [step('Lock in a second café wholesale account', true), step('Launch the monthly subscription box'), step('Hire a weekend roaster')],
      notes: 'Wholesale is 60% of sales. Subscriptions smooth out the slow months.',
    }),
    source({
      name: 'Head of Sales', kind: 'job', stage: 'running', monthlyGoal: 450_000,
      steps: [step('Close Q4 above target', true), step('Ask for the regional role at review')],
    }),
    source({
      name: 'Brand strategy retainers', kind: 'freelance', stage: 'starting', monthlyGoal: 900_000,
      price: 180_000, costPerSale: 20_000,
      steps: [step('Package one retainer offer'), step('Message 10 founders I already know')],
    }),
    source({ name: 'Rent out the BGC condo', kind: 'invest', stage: 'idea', monthlyGoal: 95_000 }),
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
  const goal = useDemo((d) => d.months[0].goal)
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
