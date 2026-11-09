import { useMemo, useState } from 'react'
import { Plus, Star, Trash2 } from 'lucide-react'
import { useStore } from '../store'
import { KIND_COLORS } from '../lib/meta'
import { MAX_SUBJECT, forgetSubject, rememberSubject, subjectOptions, updateSubject, type SchoolSubject } from '../lib/school'
import { Modal } from './Modal'
import { toast } from '../toast'

/** Your subjects: star the ones you take now (they're offered first), rename, recolour, add or forget them. */
export function SubjectsModal({ onClose, onPick }: { onClose: () => void; onPick?: (name: string) => void }) {
  const school = useStore((s) => s.school)
  const [adding, setAdding] = useState('')
  const list = useMemo(() => subjectOptions(school), [school])
  const counts = useMemo(() => {
    const n = new Map<string, number>()
    for (const t of school.tasks) n.set(t.subject.toLowerCase(), (n.get(t.subject.toLowerCase()) ?? 0) + 1)
    return n
  }, [school.tasks])
  const change = useStore.getState().changeSchool

  function add() {
    const name = adding.trim()
    if (!name) return
    if (school.subjects.some((x) => x.name.toLowerCase() === name.toLowerCase())) {
      toast.info(`“${name}” is already in your subjects.`)
      return setAdding('')
    }
    // Added here on purpose: it's one you take now, so it starts starred.
    change((s) => updateSubject(rememberSubject(s, name), name, { fav: true }))
    setAdding('')
  }

  const favs = list.filter((x) => x.fav)
  const others = list.filter((x) => !x.fav)

  return (
    <Modal title="Your subjects" subtitle="Star the classes you’re taking now: they come first when adding a task." onClose={onClose} width="max-w-lg">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
        className="flex gap-2"
      >
        <input
          value={adding}
          autoFocus
          maxLength={MAX_SUBJECT}
          onChange={(e) => setAdding(e.target.value)}
          placeholder="Add a subject, e.g. CCINFOM"
          className="h-11 min-w-0 flex-1 rounded-xl border border-white/10 bg-black/30 px-3 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 sm:h-10 sm:text-sm"
        />
        <button
          disabled={!adding.trim()}
          className="inline-flex h-11 items-center gap-1.5 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40 sm:h-10"
        >
          <Plus className="h-4 w-4" /> Add
        </button>
      </form>

      {list.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
          No subjects yet. Add the classes you’re taking, or just type one when you add a task: it’s saved for next time.
        </p>
      ) : (
        <div className="mt-5 space-y-5">
          {favs.length > 0 && <List title="Starred" items={favs} counts={counts} onPick={onPick} />}
          {others.length > 0 && <List title={favs.length ? 'Others you’ve used' : 'Subjects you’ve used'} items={others} counts={counts} onPick={onPick} />}
        </div>
      )}
    </Modal>
  )
}

function List({ title, items, counts, onPick }: { title: string; items: SchoolSubject[]; counts: Map<string, number>; onPick?: (name: string) => void }) {
  return (
    <section>
      <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{title}</h3>
      <ul className="space-y-1">
        {items.map((x) => (
          <Row key={x.name} subject={x} count={counts.get(x.name.toLowerCase()) ?? 0} onPick={onPick} />
        ))}
      </ul>
    </section>
  )
}

function Row({ subject: x, count, onPick }: { subject: SchoolSubject; count: number; onPick?: (name: string) => void }) {
  const [name, setName] = useState(x.name)
  const [colors, setColors] = useState(false)
  const change = useStore.getState().changeSchool
  const c = KIND_COLORS[x.color] ?? KIND_COLORS.slate

  function rename() {
    const to = name.trim()
    if (!to || to === x.name) return setName(x.name)
    change((s) => updateSubject(s, x.name, { name: to }))
    toast.success(count ? `Renamed to “${to}” on ${count} task${count === 1 ? '' : 's'}.` : `Renamed to “${to}”.`)
  }

  function forget() {
    const before = useStore.getState().school.subjects
    change((s) => forgetSubject(s, x.name))
    toast.undo(
      count ? `Removed “${x.name}” from your list. Its ${count} task${count === 1 ? '' : 's'} stay.` : `Removed “${x.name}”.`,
      () => useStore.getState().changeSchool((s) => ({ ...s, subjects: before })),
    )
  }

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02]">
      <div className="flex items-center gap-1.5 p-1.5">
        <button
          type="button"
          onClick={() => setColors((o) => !o)}
          aria-expanded={colors}
          aria-label={`Colour of ${x.name}`}
          title="Change colour"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition hover:bg-white/[0.06]"
        >
          <span className={`h-3.5 w-3.5 rounded-full ${c.bar} ring-2 ring-white/10`} />
        </button>
        <input
          value={name}
          maxLength={MAX_SUBJECT}
          aria-label="Subject name"
          onChange={(e) => setName(e.target.value)}
          onBlur={rename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.stopPropagation()
              setName(x.name)
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 text-sm font-medium text-zinc-100 outline-none transition hover:border-white/10 focus:border-indigo-400/50 focus:bg-black/30"
        />
        <span className="shrink-0 px-1 text-[11px] tabular-nums text-zinc-500" title={`${count} task${count === 1 ? '' : 's'}`}>
          {count || ''}
        </span>
        {onPick && (
          <button type="button" onClick={() => onPick(x.name)} className="h-8 shrink-0 rounded-lg px-2.5 text-xs font-medium text-indigo-200 transition hover:bg-indigo-500/15">
            Use
          </button>
        )}
        <button
          type="button"
          onClick={() => change((s) => updateSubject(s, x.name, { fav: !x.fav }))}
          aria-pressed={x.fav}
          aria-label={x.fav ? `Unstar ${x.name}` : `Star ${x.name}`}
          title={x.fav ? 'Starred · comes first' : 'Star it'}
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg transition hover:bg-white/[0.06] active:scale-90"
        >
          <Star className={`h-4 w-4 ${x.fav ? 'fill-amber-300 text-amber-300' : 'text-zinc-500'}`} />
        </button>
        <button
          type="button"
          onClick={forget}
          aria-label={`Remove ${x.name}`}
          title="Remove from your subjects"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
      <div className={`grid transition-all duration-200 ease-out ${colors ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!colors}>
        <div className="min-h-0 overflow-hidden">
          <ColorRow value={x.color} onChange={(color) => (change((s) => updateSubject(s, x.name, { color })), setColors(false))} />
        </div>
      </div>
    </li>
  )
}

/** A row of colour swatches. */
export function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-1.5 px-3 pb-3 pt-1">
      {Object.entries(KIND_COLORS).map(([id, c]) => (
        <button
          key={id}
          type="button"
          role="radio"
          aria-checked={value === id}
          aria-label={c.label}
          title={c.label}
          onClick={() => onChange(id)}
          className={`h-7 w-7 rounded-full ${c.bar} transition hover:scale-110 active:scale-95 ${value === id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0e1016]' : 'opacity-80'}`}
        />
      ))}
    </div>
  )
}
