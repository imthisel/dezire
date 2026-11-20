import { useState, type ReactNode } from 'react'
import { Check, Copy, Mail, MessageSquare } from 'lucide-react'
import { LEGAL } from '../lib/legal'
import { useCloud } from '../cloud'
import { toast } from '../toast'
import { Modal } from './Modal'
import { ContactDialog } from './Help'

/*
 * "Contact us" for everyone, signed in or not (About page, Terms / Privacy / Refunds). A plain mailto: link does nothing
 * on a computer with no email app set up (most people use Gmail in the browser), so this shows the address to copy and
 * opens a ready-to-send email in Gmail, Outlook or the email app, with the topic in the subject. Signed in, it also
 * offers the in-app form (Help & feedback), which keeps the conversation in the app.
 */

const TOPICS = [
  { id: 'question', label: 'A question', subject: 'Question about Dizayr' },
  { id: 'billing', label: 'Billing & refunds', subject: 'Billing / refund' },
  { id: 'problem', label: 'Something’s not working', subject: 'Problem with Dizayr' },
  { id: 'idea', label: 'Feedback & ideas', subject: 'Feedback for Dizayr' },
] as const

const enc = encodeURIComponent

function links(subject: string) {
  const to = LEGAL.email
  const body = 'Hi Dizayr team,\n\n'
  return {
    gmail: `https://mail.google.com/mail/?view=cm&fs=1&to=${enc(to)}&su=${enc(subject)}&body=${enc(body)}`,
    outlook: `https://outlook.live.com/mail/0/deeplink/compose?to=${enc(to)}&subject=${enc(subject)}&body=${enc(body)}`,
    app: `mailto:${to}?subject=${enc(subject)}&body=${enc(body)}`,
  }
}

export function EmailContactDialog({ onClose, topic = 'question' }: { onClose: () => void; topic?: (typeof TOPICS)[number]['id'] }) {
  const signedIn = useCloud((s) => !!s.user)
  const [pick, setPick] = useState<(typeof TOPICS)[number]['id']>(topic)
  const [copied, setCopied] = useState(false)
  const [inApp, setInApp] = useState(false)
  const subject = TOPICS.find((t) => t.id === pick)!.subject
  const l = links(subject)

  async function copy() {
    try {
      await navigator.clipboard.writeText(LEGAL.email)
      setCopied(true)
      toast.success('Email address copied.')
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.info(`Our email is ${LEGAL.email}`)
    }
  }

  if (inApp) return <ContactDialog onClose={onClose} kind={pick === 'idea' ? 'idea' : pick === 'problem' ? 'problem' : 'question'} />

  const btn =
    'inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-zinc-100 transition hover:border-white/20 hover:bg-white/[0.06]'
  return (
    <Modal title="Contact us" subtitle="Questions, billing or feedback: we read every message and reply by email." onClose={onClose} width="max-w-lg">
      <div className="space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">What’s it about?</p>
          <div className="flex flex-wrap gap-1.5">
            {TOPICS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPick(t.id)}
                aria-pressed={pick === t.id}
                className={`inline-flex h-9 items-center rounded-full border px-3.5 text-sm font-medium transition ${
                  pick === t.id ? 'border-brand-400/60 bg-brand-500/15 text-white' : 'border-white/10 text-zinc-300 hover:border-white/20'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* The address, to copy anywhere */}
        <div className="flex items-center gap-3 rounded-2xl border border-brand-400/25 bg-brand-500/[0.07] p-3 pl-4">
          <Mail className="h-5 w-5 shrink-0 text-brand-300" />
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Email us at</p>
            <p className="break-all font-semibold text-white">{LEGAL.email}</p>
          </div>
          <button onClick={copy} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-white/[0.08] px-3 text-sm font-medium text-white transition hover:bg-white/[0.14]">
            {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy'}
          </button>
        </div>

        {/* Or start the email right away */}
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-400">Or write it now in</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <a href={l.gmail} target="_blank" rel="noopener noreferrer" className={btn}>
              <GmailIcon /> Gmail
            </a>
            <a href={l.outlook} target="_blank" rel="noopener noreferrer" className={btn}>
              <OutlookIcon /> Outlook
            </a>
            <a href={l.app} className={btn}>
              <Mail className="h-4 w-4 text-zinc-400" /> Email app
            </a>
          </div>
          <p className="mt-2 text-xs text-zinc-500">The subject is filled in for you: “{subject}”.</p>
        </div>

        {signedIn && (
          <button onClick={() => setInApp(true)} className="flex w-full items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-3 text-left transition hover:border-white/15 hover:bg-white/[0.04]">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-brand-500/15 text-brand-200">
              <MessageSquare className="h-4 w-4" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-medium text-zinc-100">Message us from your account</span>
              <span className="block text-xs text-zinc-500">No email needed. Replies show up under Help & feedback.</span>
            </span>
          </button>
        )}
      </div>
    </Modal>
  )
}

/** A link-styled button that opens the contact panel. */
export function ContactButton({ className = '', children = 'Contact us', topic }: { className?: string; children?: ReactNode; topic?: (typeof TOPICS)[number]['id'] }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className}>
        {children}
      </button>
      {open && <EmailContactDialog onClose={() => setOpen(false)} topic={topic} />}
    </>
  )
}

function GmailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M2 6.5v11A1.5 1.5 0 0 0 3.5 19H6V9.8l6 4.5 6-4.5V19h2.5a1.5 1.5 0 0 0 1.5-1.5v-11L12 13 2 6.5Z" opacity=".95" />
      <path fill="#EA4335" d="M22 6.5V6a2 2 0 0 0-3.2-1.6L12 9.5 5.2 4.4A2 2 0 0 0 2 6v.5l10 7 10-7Z" />
    </svg>
  )
}

function OutlookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <rect x="2" y="5" width="12" height="14" rx="2" fill="#0A64D6" />
      <path fill="#28A8EA" d="M14 7h7a1 1 0 0 1 1 1v8a1 1 0 0 1-1 1h-7z" />
      <ellipse cx="8" cy="12" rx="3" ry="3.4" fill="none" stroke="#fff" strokeWidth="1.8" />
    </svg>
  )
}
