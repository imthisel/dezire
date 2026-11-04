import { useEffect, useRef, type KeyboardEvent } from 'react'
import { ExternalLink, Link2, Pencil, Plus, Trash2, Wand2 } from 'lucide-react'
import { MAX_LINKS, MAX_LINK_NAME, cleanUrl, findUrlInNote, hostOf, linkName } from '../lib/links'
import type { ItemLink } from '../lib/types'

/** Links as tidy chips: the name you gave it, and the full address only when you hover over it. Opens in a new tab. */
export function ItemLinks({ links, className = '' }: { links?: ItemLink[]; className?: string }) {
  if (!links?.length) return null
  return (
    <ul className={`flex flex-wrap gap-1.5 ${className}`} aria-label="Links">
      {links.map((l) => (
        <li key={l.id} className="min-w-0 max-w-full">
          <a
            href={l.url}
            target="_blank"
            rel="noopener noreferrer"
            title={l.url}
            // The rows and cards around these can be clicked open and dragged; a link only ever opens.
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            onDragStart={(e) => e.preventDefault()}
            className="group/link inline-flex h-8 max-w-full items-center gap-1.5 rounded-lg border border-sky-300/20 bg-sky-400/[0.08] pl-2 pr-2.5 text-xs font-medium text-sky-100 transition hover:border-sky-300/50 hover:bg-sky-400/[0.16] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300/60 sm:h-7"
          >
            <Link2 className="h-3.5 w-3.5 shrink-0 text-sky-300" />
            <span className="min-w-0 truncate">{linkName(l)}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-sky-200/50 transition group-hover/link:text-sky-100" />
          </a>
        </li>
      ))}
    </ul>
  )
}

/** A link being added or changed. `id`: the one being changed (null: a new one). */
export type LinkDraft = { id: string | null; url: string; label: string; focus: 'url' | 'label'; bad?: boolean }

export const emptyDraft = (url = ''): LinkDraft => ({ id: null, url, label: '', focus: url ? 'label' : 'url' })

const newId = () => Math.random().toString(36).slice(2, 10)

/**
 * The list with the draft in it. `null` when the address in the draft isn't a real one.
 * An empty draft is simply ignored, so it never gets in the way of saving.
 */
export function withDraft(links: ItemLink[], draft: LinkDraft | null): ItemLink[] | null {
  if (!draft || (!draft.url.trim() && !draft.label.trim())) return links
  const url = cleanUrl(draft.url)
  if (!url) return null
  const link = { id: draft.id ?? newId(), label: draft.label.trim().slice(0, MAX_LINK_NAME), url }
  return draft.id ? links.map((l) => (l.id === draft.id ? link : l)) : [...links, link]
}

const box =
  'w-full min-w-0 rounded-xl border border-white/10 bg-black/30 text-base text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-sky-300/50 focus:ring-2 focus:ring-sky-300/15 sm:text-sm'

/** Add, rename and remove an item's links. The draft is kept by the window, so saving the item includes one still being typed. */
export function LinksEditor({ links, onChange, draft, setDraft, note, onNote }: {
  links: ItemLink[]
  onChange: (links: ItemLink[]) => void
  draft: LinkDraft | null
  setDraft: (d: LinkDraft | null) => void
  note: string
  onNote: (note: string) => void
}) {
  const found = !draft && links.length < MAX_LINKS ? findUrlInNote(note) : null
  // What's being typed, shown exactly as it will look.
  const url = draft ? cleanUrl(draft.url) : null
  const full = links.length >= MAX_LINKS
  const form = useRef<HTMLDivElement>(null)
  const isOpen = !!draft
  // Opened near the bottom of the window, it would otherwise sit behind the buttons there.
  useEffect(() => {
    if (isOpen) form.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [isOpen, draft?.id])

  function commit() {
    if (!draft) return
    const next = withDraft(links, draft)
    if (!next) return setDraft({ ...draft, bad: true, focus: 'url' })
    onChange(next)
    setDraft(null)
  }

  // Enter finishes the link, not the whole item; Esc leaves the link, not the whole window.
  function onKey(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault()
      commit()
    } else if (e.key === 'Escape') {
      e.stopPropagation()
      setDraft(null)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {links.length > 0 && (
        <ul className="divide-y divide-white/[0.06] overflow-hidden rounded-xl border border-white/10 bg-black/20">
          {links.map((l) =>
            draft?.id === l.id ? null : (
              <li key={l.id} className="flex items-center gap-2.5 py-1.5 pl-2.5 pr-1.5">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sky-400/10 text-sky-300">
                  <Link2 className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-zinc-100">{linkName(l)}</span>
                  <span className="block truncate text-xs text-zinc-500">{hostOf(l.url)}</span>
                </span>
                <a href={l.url} target="_blank" rel="noopener noreferrer" title={`Open ${l.url}`} aria-label={`Open ${linkName(l)}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white">
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button type="button" onClick={() => setDraft({ id: l.id, url: l.url, label: l.label, focus: 'label' })} title="Rename or change" aria-label={`Rename ${linkName(l)}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-400 transition hover:bg-white/10 hover:text-white">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button type="button" onClick={() => onChange(links.filter((x) => x.id !== l.id))} title="Remove" aria-label={`Remove ${linkName(l)}`} className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-red-500/10 hover:text-red-300">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ),
          )}
        </ul>
      )}

      {draft ? (
        <div ref={form} className="animate-fade scroll-my-3 space-y-2.5 rounded-xl border border-sky-300/25 bg-sky-400/[0.05] p-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">Link</span>
            <span className="relative block">
              <Link2 className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
              <input
                key={`url-${draft.focus}`}
                autoFocus={draft.focus === 'url'}
                value={draft.url}
                inputMode="url"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={!!draft.bad}
                onChange={(e) => setDraft({ ...draft, url: e.target.value, bad: false })}
                onKeyDown={onKey}
                placeholder="Paste the link here"
                className={`${box} h-10 pl-9 pr-3 ${draft.bad ? 'border-red-500/60' : ''}`}
              />
            </span>
            {draft.bad && <span role="alert" className="mt-1 block text-xs text-red-300">That doesn’t look like a web address. Try something like example.com/page.</span>}
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-zinc-400">Name it</span>
            <input
              key={`label-${draft.focus}`}
              autoFocus={draft.focus === 'label'}
              value={draft.label}
              maxLength={MAX_LINK_NAME}
              onChange={(e) => setDraft({ ...draft, label: e.target.value })}
              onKeyDown={onKey}
              placeholder={url ? hostOf(url) : 'e.g. Toyota price list'}
              className={`${box} h-10 px-3`}
            />
          </label>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex min-w-0 flex-1 basis-44 items-center gap-2 text-xs text-zinc-500">
              {url && (
                <>
                  <span className="shrink-0">Shows as</span>
                  <span className="inline-flex h-7 min-w-0 items-center gap-1.5 rounded-lg border border-sky-300/20 bg-sky-400/[0.08] px-2 font-medium text-sky-100">
                    <Link2 className="h-3.5 w-3.5 shrink-0 text-sky-300" />
                    <span className="truncate">{draft.label.trim() || hostOf(url)}</span>
                  </span>
                </>
              )}
            </p>
            <div className="flex shrink-0 gap-2">
              <button type="button" onClick={() => setDraft(null)} className="h-9 rounded-lg px-3 text-[13px] font-medium text-zinc-400 transition hover:text-white">
                Cancel
              </button>
              <button type="button" onClick={commit} disabled={!draft.url.trim()} className="h-9 rounded-lg bg-sky-400/90 px-3.5 text-[13px] font-semibold text-sky-950 transition hover:bg-sky-300 disabled:opacity-40">
                {draft.id ? 'Save link' : 'Add link'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDraft(emptyDraft())}
            disabled={full}
            title={full ? `An item can have up to ${MAX_LINKS} links` : undefined}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-dashed border-white/15 px-3 text-[13px] font-medium text-zinc-300 transition hover:border-sky-300/40 hover:bg-sky-400/[0.06] hover:text-sky-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Plus className="h-3.5 w-3.5" /> Add a link
          </button>
          {found && (
            <button
              type="button"
              onClick={() => {
                // The address leaves the note and becomes a link with a name.
                const at = note.indexOf(found.text)
                const before = note.slice(0, at)
                const after = note.slice(at + found.text.length)
                onNote((before.endsWith(' ') && after.startsWith(' ') ? before + after.slice(1) : before + after).replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim())
                setDraft(emptyDraft(found.url))
              }}
              className="inline-flex h-9 min-w-0 items-center gap-1.5 rounded-lg bg-sky-400/10 px-3 text-[13px] font-medium text-sky-100 transition hover:bg-sky-400/20"
            >
              <Wand2 className="h-3.5 w-3.5 shrink-0 text-sky-300" />
              <span className="truncate">Name the link to {hostOf(found.url)}</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
