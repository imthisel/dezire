import type { ItemLink } from './types'

export const MAX_LINKS = 10
export const MAX_LINK_NAME = 60
const MAX_URL = 2000

/**
 * What was typed or pasted as a proper address, or null when it isn't one. Only web and email addresses get through:
 * these are opened with a click, and something like `javascript:` would run code instead of opening a page.
 */
export function cleanUrl(raw: string): string | null {
  let t = raw.trim()
  if (!t || t.length > MAX_URL || /\s/.test(t)) return null
  if (/^[^\s@/:]+@[^\s@/:]+\.[^\s@/:]+$/.test(t)) t = `mailto:${t}`
  // "example.com:8080/x" isn't a scheme called "example.com": only a word with no dot before the colon is.
  const scheme = /^([a-z][a-z0-9+-]*):/i.exec(t)?.[1]?.toLowerCase()
  if (!scheme || (scheme !== 'http' && scheme !== 'https' && scheme !== 'mailto' && /^\d/.test(t.slice(scheme.length + 1)))) t = `https://${t}`
  try {
    const u = new URL(t)
    if (u.protocol === 'mailto:') return u.pathname.includes('@') ? u.href : null
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    // A real site has a dot in its name (or is this computer).
    if (!u.hostname.includes('.') && u.hostname !== 'localhost') return null
    return u.href
  } catch {
    return null
  }
}

/** A short version of the address: "shop.example.com", or the email address. */
export function hostOf(url: string) {
  try {
    const u = new URL(url)
    return u.protocol === 'mailto:' ? u.pathname : u.hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** What a link shows as: the name given to it, otherwise the site's name. */
export const linkName = (l: Pick<ItemLink, 'label' | 'url'>) => l.label || hostOf(l.url)

/** Cleans up links from a backup file or the cloud. Anything that isn't a safe address is dropped. */
export function parseLinks(raw: unknown): ItemLink[] {
  if (!Array.isArray(raw)) return []
  const out: ItemLink[] = []
  const seen = new Set<string>()
  for (const x of raw as Record<string, unknown>[]) {
    if (!x || typeof x !== 'object' || typeof x.url !== 'string') continue
    const url = cleanUrl(x.url)
    if (!url) continue
    const id = typeof x.id === 'string' && x.id && !seen.has(x.id) ? x.id : Math.random().toString(36).slice(2, 10)
    seen.add(id)
    out.push({ id, label: typeof x.label === 'string' ? x.label.trim().slice(0, MAX_LINK_NAME) : '', url })
    if (out.length >= MAX_LINKS) break
  }
  return out
}

/** The whole pasted text, when all of it is clearly one web address (so pasting a sentence isn't intercepted). */
export const pastedUrl = (text: string) => (/^(https?:\/\/|www\.)\S+$/i.test(text.trim()) ? cleanUrl(text) : null)

/** The first web address written out in a note, to offer turning it into a named link. */
export function findUrlInNote(note: string) {
  const m = /(?:https?:\/\/|www\.)[^\s<>()]+/i.exec(note)
  if (!m) return null
  const text = m[0].replace(/[.,;:!?'"]+$/, '')
  const url = cleanUrl(text)
  return url ? { text, url } : null
}
