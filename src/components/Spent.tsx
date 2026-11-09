import { useMemo } from 'react'
import { useStore } from '../store'
import { modeKind } from '../lib/needs'
import type { ModeKind } from '../lib/types'
import { toast } from '../toast'

export type LinkSource = { kind: ModeKind; mode: string }

/**
 * Expenses that came from a mode: a Needs item that was ticked, or a Wants item marked spent. By expense id, with the
 * kind and the mode's name, so Expenses can say where each one came from.
 */
export function useLinkSources() {
  const modes = useStore((s) => s.modes)
  const modeId = useStore((s) => s.modeId)
  const months = useStore((s) => s.months)
  const modeData = useStore((s) => s.modeData)
  return useMemo(() => {
    const out = new Map<string, LinkSource>()
    for (const m of modes) {
      if (modeKind(m) === 'needs') {
        for (const i of m.needs?.items ?? []) if (i.expenseId) out.set(i.expenseId, { kind: 'needs', mode: m.name })
        continue
      }
      // The mode in use keeps its months in `months`; the others in `modeData`.
      const its = m.id === modeId ? months : (modeData[m.id]?.months ?? {})
      for (const mo of Object.values(its)) for (const i of mo.items) if (i.expenseId) out.set(i.expenseId, { kind: 'wants', mode: m.name })
    }
    return out
  }, [modes, modeId, months, modeData])
}

/*
 * Wants items marked as already spent on. It works like a Needs item's tick: marking one adds it to Expenses as a linked
 * expense, and it stays in its month with a "Spent" mark. Unmarking it (or deleting that expense) takes it back out.
 */

/** The expense recording this item, while it exists. */
export const useSpentExpense = (expenseId: string | undefined) => useStore((s) => (expenseId ? s.expenses.find((e) => e.id === expenseId) : undefined))

/** How many of these items are marked spent, and what they add up to. */
export function useSpentOf(items: { expenseId?: string; price: number }[]) {
  const total = useStore((s) => {
    const ids = new Set(s.expenses.map((e) => e.id))
    let n = 0
    let sum = 0
    for (const i of items) if (i.expenseId && ids.has(i.expenseId)) (n++, (sum += i.price))
    return `${n}|${sum}`
  })
  const [count, sum] = total.split('|').map(Number)
  return { count, sum }
}

const plural = (n: number) => `${n} ${n === 1 ? 'item' : 'items'}`

/** Marks or unmarks items as spent, and says what happened with a way to undo it. `what`: how to name them, like “Rolex”. */
export function flipSpent(ids: string[], on: boolean, what?: string) {
  const { count, undo } = useStore.getState().setItemsSpent(ids, on)
  if (!count) return
  const name = what ?? plural(count)
  toast.undo(on ? `${name} marked spent and added to Expenses. Still in its month.` : `${name} no longer marked spent. Taken out of Expenses.`, undo)
}
