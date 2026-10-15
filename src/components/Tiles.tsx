import { Cake, Star, StickyNote } from 'lucide-react'
import { useFmt, useKindOf, usePlan, useStore, type PhoneCols } from '../store'
import { MONTHS, MONTHS_SHORT, currentIndex } from '../lib/time'
import { TREND, kindIcon } from '../lib/meta'
import type { Item } from '../lib/types'
import { ageIn, useBirthday } from './Birthday'
import { zoomName, zoomTo } from '../zoom'

/*
 * Compact versions of the month and item cards for the zoomed-out phone grids (2 or 3 columns).
 * They show only what still reads well at that size; tapping one zooms back in to the full card.
 */

const EMPTY: never[] = []

/** A month at a glance: net worth, spending against the budget, and what's in it. */
export function MonthTile({ index, cols }: { index: number; cols: Exclude<PhoneCols, 1> }) {
  const c = usePlan()[index]
  const f = useFmt()
  const kindOf = useKindOf()
  const month = useStore((s) => s.months[c.key])
  const items = month?.items ?? EMPTY
  const birthday = useBirthday()
  const age = birthday?.month === c.month ? ageIn(birthday, c.year) : null
  const hasNotes = !!month?.notes?.trim()
  const today = currentIndex()
  const isCurrent = index === today
  const isPast = index < today
  const small = cols === 3

  const pct = c.budget > 0 ? c.spent / c.budget : 0
  const bar = pct > 1 ? 'bg-red-400' : pct >= 0.85 ? 'bg-amber-300' : 'bg-emerald-400'
  // Up to 4 kinds of what's bought this month, most items first.
  const kinds = Object.entries(
    items.reduce<Record<string, number>>((m, i) => ((m[i.category] = (m[i.category] ?? 0) + 1), m), {}),
  ).sort((a, b) => b[1] - a[1])

  return (
    <button
      id={`month-${c.key}`}
      {...zoomName(`m-${c.key}`)}
      onClick={(e) => zoomTo(1, { anchor: e.currentTarget, open: c.key })}
      aria-label={`${MONTHS[c.month]} ${c.year} · net worth ${f(c.netWorth)}. Tap to open.`}
      className={`relative flex min-w-0 flex-col rounded-2xl border bg-white/[0.025] text-left shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition active:scale-[0.97] ${
        small ? 'p-2.5' : 'p-3'
      } ${isCurrent ? 'border-emerald-400/35 bg-gradient-to-b from-emerald-500/[0.08] to-transparent' : 'border-white/[0.07]'}`}
    >
      <span className="flex items-center justify-between gap-1">
        <span className={`truncate font-semibold tracking-tight ${small ? 'text-[15px]' : 'text-base'} ${isPast ? 'text-zinc-400' : 'text-white'}`}>
          {small ? MONTHS_SHORT[c.month] : MONTHS[c.month]}
        </span>
        <span className="flex shrink-0 items-center gap-1">
          {hasNotes && <StickyNote className="h-3 w-3 text-amber-200/70" aria-label="Has notes" />}
          {age !== null && <Cake className="h-3 w-3 text-pink-300" aria-label="Birthday month" />}
          {isCurrent && <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_8px] shadow-emerald-400/70" aria-label="This month" />}
        </span>
      </span>

      <span className="mt-2 block text-[10px] font-medium uppercase tracking-wider text-zinc-500">Net worth</span>
      <span className={`block truncate font-bold leading-tight tabular-nums ${small ? 'text-sm' : 'text-lg'} ${c.netWorth < 0 ? 'text-red-300' : 'text-indigo-200'}`}>
        {f(c.netWorth, true)}
      </span>

      {!small && (
        <span className="mt-1 flex items-baseline justify-between gap-2 text-[11px] tabular-nums">
          <span className="text-zinc-500">Goal</span>
          <span className="truncate font-medium text-zinc-300">{c.goal > 0 ? f(c.goal, true) : '—'}</span>
        </span>
      )}

      {/* Spending against the budget */}
      <span className={`block h-1 overflow-hidden rounded-full bg-white/[0.06] ${small ? 'mt-2' : 'mt-2.5'}`}>
        {c.budget > 0 && <span className={`block h-full rounded-full ${bar}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />}
      </span>
      <span className={`mt-1 block truncate tabular-nums ${small ? 'text-[10px]' : 'text-[11px]'} ${pct > 1 ? 'text-red-300' : 'text-zinc-400'}`}>
        {c.budget > 0 ? (
          <>
            {f(c.spent, true)}
            <span className="text-zinc-600"> / {f(c.budget, true)}</span>
          </>
        ) : c.spent > 0 ? (
          `${f(c.spent, true)} spent`
        ) : (
          <span className="text-zinc-600">No budget</span>
        )}
      </span>

      {/* What's in it */}
      <span className="mt-auto flex items-center gap-1 pt-2">
        {items.length === 0 ? (
          <span className={`text-zinc-600 ${small ? 'text-[10px]' : 'text-[11px]'}`}>No items</span>
        ) : (
          <>
            {kinds.slice(0, small ? 2 : 4).map(([id]) => {
              const k = kindOf(id)
              const Icon = kindIcon(k)
              return (
                <span key={id} className="grid h-5 w-5 shrink-0 place-items-center rounded-md bg-white/[0.06] text-zinc-300">
                  <Icon className="h-3 w-3" />
                </span>
              )
            })}
            <span className={`truncate tabular-nums text-zinc-400 ${small ? 'text-[10px]' : 'text-[11px]'}`}>
              {small ? `${items.length}` : `${items.length} item${items.length > 1 ? 's' : ''}`}
            </span>
          </>
        )}
      </span>
    </button>
  )
}

/** An item (Favorites / Assets) at a glance: what it is, its price, and when. */
export function ItemTile({ item, domId, when, cols }: { item: Item; domId: string; when: string; cols: Exclude<PhoneCols, 1> }) {
  const f = useFmt()
  const kind = useKindOf()(item.category)
  const Icon = kindIcon(kind)
  const t = TREND[item.trend]
  const small = cols === 3

  return (
    <button
      id={domId}
      {...zoomName(`i-${item.id}`)}
      onClick={(e) => zoomTo(1, { anchor: e.currentTarget })}
      aria-label={`${item.name} · ${f(item.price)} · ${when}. Tap to open.`}
      className={`relative flex min-w-0 flex-col overflow-hidden rounded-2xl border text-left transition active:scale-[0.97] ${t.border} ${t.bg} ${
        small ? 'p-2.5' : 'p-3'
      } ${item.favorite ? 'bg-gradient-to-br from-amber-300/[0.12] via-transparent to-transparent ring-1 ring-amber-300/30' : ''}`}
    >
      {item.favorite && <span aria-hidden className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-amber-200 to-amber-400" />}
      <span className="flex items-start justify-between gap-1">
        <span className={`grid shrink-0 place-items-center rounded-lg ${t.iconBg} ${t.text} ${small ? 'h-7 w-7' : 'h-8 w-8'}`}>
          <Icon className={small ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </span>
        {item.favorite && <Star className="h-3.5 w-3.5 shrink-0 fill-amber-300 text-amber-300" aria-label="Favorite" />}
      </span>
      <span className={`mt-2 line-clamp-2 break-words font-semibold leading-snug text-white ${small ? 'text-xs' : 'text-[13px]'}`}>{item.name}</span>
      <span className={`mt-auto block truncate pt-1.5 font-bold tabular-nums text-white ${small ? 'text-sm' : 'text-base'}`}>{f(item.price, true)}</span>
      <span className={`block truncate text-zinc-400 ${small ? 'text-[10px]' : 'text-[11px]'}`}>
        {small ? when : `${kind.label} · ${when}`}
      </span>
      {!small && (
        <span className={`mt-1.5 inline-flex items-center gap-1 self-start rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${t.border} ${t.text}`}>
          <t.icon className="h-3 w-3" /> {t.label}
        </span>
      )}
    </button>
  )
}
