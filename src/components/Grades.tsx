import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import {
  AlertTriangle, ArrowDown, ArrowUp, Award, BookOpen, Check, CheckCircle2, ChevronDown, CircleDashed, Crosshair, Layers, ListPlus, Pencil, Plus, Sparkles, Target,
  Trash2, TrendingUp, X,
} from 'lucide-react'
import { useStore } from '../store'
import { todayKey } from '../lib/expenses'
import { KIND_COLORS } from '../lib/meta'
import { MAX_CATEGORY, MAX_GRADE_TITLE, findSubject, shortDate, type Grade, type School as SchoolData } from '../lib/school'
import {
  TEMPLATES, addCategory, addGrade, clearSubjectGrades, fmtPct, gradeSubjects, history, moveCategory, needed, nextTitle, overallAverage, parseScore, percent,
  removeCategory, removeGrades, report, scoreInput, scoreText, setCategories, setTarget, targetOf, updateCategory, updateGrade, type CatReport, type SubjectReport,
} from '../lib/grades'
import { card } from './Dashboard'
import { SubjectsModal } from './SchoolSubjects'
import { toast } from '../toast'

// ---- Looks ----

/**
 * The parts of a grade, in a fixed order (validated for colour-blind separation on this dark surface).
 * Written out in full so Tailwind keeps them.
 */
const PART_COLORS = [
  { fill: 'bg-[#3987e5]', soft: 'bg-[#3987e5]/25' },
  { fill: 'bg-[#d95926]', soft: 'bg-[#d95926]/25' },
  { fill: 'bg-[#199e70]', soft: 'bg-[#199e70]/25' },
  { fill: 'bg-[#c98500]', soft: 'bg-[#c98500]/25' },
  { fill: 'bg-[#d55181]', soft: 'bg-[#d55181]/25' },
  { fill: 'bg-[#008300]', soft: 'bg-[#008300]/25' },
  { fill: 'bg-[#9085e9]', soft: 'bg-[#9085e9]/25' },
  { fill: 'bg-[#e66767]', soft: 'bg-[#e66767]/25' },
]
const partColor = (i: number) => PART_COLORS[i % PART_COLORS.length]
const subjectLook = (school: SchoolData, name: string) => KIND_COLORS[findSubject(school, name)?.color ?? 'slate'] ?? KIND_COLORS.slate

type Tone = 'good' | 'close' | 'low' | 'none'
/** How a percentage reads: against your target when you set one, otherwise on a general scale. */
function toneOf(pct: number | null, target?: number): Tone {
  if (pct === null) return 'none'
  if (target) return pct >= target ? 'good' : pct >= target - 5 ? 'close' : 'low'
  return pct >= 85 ? 'good' : pct >= 75 ? 'close' : 'low'
}
const TONE_PILL: Record<Tone, string> = {
  good: 'bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-300/20',
  close: 'bg-amber-400/12 text-amber-100 ring-1 ring-amber-300/20',
  low: 'bg-rose-500/12 text-rose-200 ring-1 ring-rose-400/20',
  none: 'bg-white/[0.05] text-zinc-400',
}

const input =
  'h-10 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'
const ghostBtn = 'inline-flex h-9 items-center gap-1.5 rounded-xl border border-white/10 px-3 text-sm text-zinc-300 transition hover:bg-white/5 hover:text-white'
const iconBtn = 'grid h-8 w-8 shrink-0 place-items-center rounded-lg text-zinc-500 transition hover:bg-white/[0.07] hover:text-white disabled:opacity-30 disabled:hover:bg-transparent'

const change = (fn: (s: SchoolData) => SchoolData) => useStore.getState().changeSchool(fn)
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

// ---- Remembered on this device ----

const PICK_KEY = 'dizayr-grades-subject'
function readPick() {
  try {
    return localStorage.getItem(PICK_KEY)
  } catch {
    return null
  }
}
function savePick(name: string) {
  try {
    localStorage.setItem(PICK_KEY, name)
  } catch {
    // Not remembered: fine.
  }
}

// ---- The page ----

export function Grades() {
  const school = useStore((s) => s.school)
  const subjects = useMemo(() => gradeSubjects(school), [school])
  const reports = useMemo(() => new Map(subjects.map((n) => [n.toLowerCase(), report(school, n)])), [school, subjects])
  const [pick, setPick] = useState<string | null>(readPick)
  const [managing, setManaging] = useState(false)
  const scoreBox = useRef<HTMLInputElement>(null)

  // The subject shown: the one picked last (if it's still here), else the first with scores, else the first.
  const current =
    subjects.find((n) => pick && n.toLowerCase() === pick.toLowerCase()) ??
    subjects.find((n) => (reports.get(n.toLowerCase())?.count ?? 0) > 0) ??
    subjects[0] ??
    null

  const choose = (name: string) => {
    setPick(name)
    savePick(name)
  }

  // N: add a score. (Not while typing, or with a dialog open.)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement
      if (e.ctrlKey || e.metaKey || e.altKey || el.closest('input, textarea, select, [contenteditable="true"]') || useStore.getState().modal) return
      if (e.key === 'n' || e.key === 'N') {
        e.preventDefault()
        scoreBox.current?.focus()
        scoreBox.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const stats = useMemo(() => {
    const overall = overallAverage(school)
    let withTarget = 0
    let onTarget = 0
    let best: { name: string; value: number } | null = null
    for (const n of subjects) {
      const r = reports.get(n.toLowerCase())
      if (!r || r.current === null) continue
      const t = targetOf(school, n)
      if (t) {
        withTarget++
        if (r.current >= t) onTarget++
      }
      if (!best || r.current > best.value) best = { name: n, value: r.current }
    }
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10)
    const recent = school.grades.filter((g) => g.date >= weekAgo).length
    return { overall, withTarget, onTarget, best, recent }
  }, [school, subjects, reports])

  return (
    <div className="space-y-4 sm:space-y-5">
      {/* Title */}
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className="pointer-events-none absolute -top-24 left-1/3 h-48 w-[60%] rounded-full bg-violet-500/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-violet-400 via-indigo-400 to-sky-400 shadow-lg shadow-indigo-500/20">
            <Award className="h-5 w-5 text-white" strokeWidth={2.4} />
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Grades</h2>
            <p className="truncate text-sm text-zinc-400">Every score, weighted the way your class is graded, worked out for you.</p>
          </div>
          <button onClick={() => setManaging(true)} title="Your subjects" className={`${ghostBtn} h-10 shrink-0`}>
            <BookOpen className="h-4 w-4" /> <span className="hidden sm:inline">Subjects</span>
          </button>
          {current && (
            <button
              onClick={() => scoreBox.current?.focus()}
              title="Add a score (N)"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110 sm:px-4"
            >
              <Plus className="h-4 w-4" strokeWidth={2.5} /> <span className="hidden sm:inline">Add score</span>
            </button>
          )}
        </div>

        {subjects.length > 0 && (
          <div className="relative mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:grid-cols-4 sm:gap-3">
            <Stat icon={TrendingUp} label="Overall average" value={fmtPct(stats.overall)} hint={stats.overall === null ? 'add a score to start' : 'across your subjects'} />
            <Stat
              icon={Target}
              label="On target"
              value={stats.withTarget ? `${stats.onTarget} of ${stats.withTarget}` : '—'}
              hint={stats.withTarget ? (stats.onTarget === stats.withTarget ? 'every one, nice' : 'subjects at their goal') : 'set a target per subject'}
              tone={stats.withTarget ? (stats.onTarget === stats.withTarget ? 'good' : 'close') : undefined}
            />
            <Stat icon={Sparkles} label="Strongest" value={stats.best ? fmtPct(stats.best.value, true) : '—'} hint={stats.best?.name ?? 'nothing yet'} />
            <Stat icon={ListPlus} label="Scores logged" value={String(school.grades.length)} hint={stats.recent ? `${stats.recent} in the last 7 days` : 'none this week'} />
          </div>
        )}
      </section>

      {subjects.length === 0 ? (
        <Welcome onSubjects={() => setManaging(true)} />
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[17rem_minmax(0,1fr)] lg:items-start xl:grid-cols-[19rem_minmax(0,1fr)]">
          <SubjectRail school={school} subjects={subjects} reports={reports} current={current} onPick={choose} onAdd={() => setManaging(true)} />
          {current && <SubjectDetail key={current.toLowerCase()} school={school} subject={current} r={reports.get(current.toLowerCase())!} scoreBox={scoreBox} />}
        </div>
      )}

      {managing && <SubjectsModal onClose={() => setManaging(false)} />}
    </div>
  )
}

function Stat({ icon: Icon, label, value, hint, tone }: { icon: typeof Plus; label: string; value: string; hint: string; tone?: 'good' | 'close' }) {
  const color = tone === 'good' ? 'text-emerald-300' : tone === 'close' ? 'text-amber-200' : 'text-zinc-400'
  return (
    <div className="min-w-0 rounded-xl border border-white/[0.06] bg-black/20 p-3">
      <span className={`flex items-center gap-1.5 text-xs font-medium ${color}`}>
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="mt-1 block truncate text-2xl font-bold tabular-nums tracking-tight text-white">{value}</span>
      <span className="block truncate text-[11px] text-zinc-500">{hint}</span>
    </div>
  )
}

function Welcome({ onSubjects }: { onSubjects: () => void }) {
  const tips = [
    { icon: Layers, title: 'Set how it’s graded', text: 'Quizzes 20%, Exams 40%… or pick a ready-made split.' },
    { icon: ListPlus, title: 'Type scores fast', text: '“18/20”, “92%” or just “18”. It works out the rest.' },
    { icon: Crosshair, title: 'Aim for a target', text: 'See exactly what you need on what’s left to get there.' },
  ]
  return (
    <section className={`${card} p-5 sm:p-6`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <h3 className="text-base font-semibold text-white">Track your grades, class by class</h3>
          <p className="mt-0.5 text-sm text-zinc-400">Your subjects from School show up here. Add the classes you’re taking to begin.</p>
        </div>
        <button
          onClick={onSubjects}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-500 to-indigo-400 px-5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 transition hover:brightness-110"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add your subjects
        </button>
      </div>
      <ol className="mt-5 grid gap-2.5 sm:grid-cols-3">
        {tips.map((t) => (
          <li key={t.title} className="flex gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3">
            <t.icon className="mt-0.5 h-4 w-4 shrink-0 text-indigo-300" />
            <span>
              <span className="block text-sm font-medium text-zinc-200">{t.title}</span>
              <span className="block text-xs text-zinc-500">{t.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}

// ---- Subjects ----

function SubjectRail({ school, subjects, reports, current, onPick, onAdd }: {
  school: SchoolData
  subjects: string[]
  reports: Map<string, SubjectReport>
  current: string | null
  onPick: (name: string) => void
  onAdd: () => void
}) {
  return (
    <nav aria-label="Subjects" className="lg:sticky lg:top-20">
      <p className="mb-2 hidden px-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500 lg:block">Subjects</p>
      <ul className="scrollbar-none -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0 lg:pb-0">
        {subjects.map((n) => {
          const r = reports.get(n.toLowerCase())!
          const on = current?.toLowerCase() === n.toLowerCase()
          const target = targetOf(school, n)
          const tone = toneOf(r.current, target)
          const look = subjectLook(school, n)
          return (
            <li key={n} className="w-[13.5rem] shrink-0 lg:w-auto">
              <button
                onClick={() => onPick(n)}
                aria-current={on ? 'true' : undefined}
                className={`group relative flex w-full flex-col gap-2 overflow-hidden rounded-2xl border p-3 text-left transition active:scale-[0.99] ${
                  on ? 'border-indigo-400/40 bg-indigo-500/[0.08] shadow-lg shadow-indigo-950/30' : 'border-white/[0.06] bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.035]'
                }`}
              >
                <span aria-hidden className={`absolute inset-y-3 left-0 w-[3px] rounded-r-full ${look.bar} ${on ? '' : 'opacity-60'}`} />
                <span className="flex items-center gap-2 pl-1.5">
                  <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${on ? 'text-white' : 'text-zinc-200'}`}>{n}</span>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${TONE_PILL[tone]}`}>{fmtPct(r.current)}</span>
                </span>
                <Meter value={r.current} target={target} bar={look.bar} />
                <span className="flex items-center justify-between gap-2 pl-1.5 text-[11px] text-zinc-500">
                  <span className="truncate">{r.count ? plural(r.count, 'score') : 'No scores yet'}</span>
                  {target ? (
                    <span className="inline-flex shrink-0 items-center gap-1">
                      <Target className="h-3 w-3" /> {fmtPct(target, true)}
                    </span>
                  ) : null}
                </span>
              </button>
            </li>
          )
        })}
        <li className="w-[10rem] shrink-0 lg:w-auto">
          <button
            onClick={onAdd}
            className="flex h-full min-h-[4.5rem] w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-white/10 px-3 text-sm text-zinc-500 transition hover:border-white/25 hover:text-zinc-200 lg:min-h-0 lg:justify-start lg:py-2.5"
          >
            <Plus className="h-4 w-4" /> Add a subject
          </button>
        </li>
      </ul>
    </nav>
  )
}

/** A thin bar for a grade, with a tick where the target is. */
function Meter({ value, target, bar }: { value: number | null; target?: number; bar: string }) {
  const w = value === null ? 0 : Math.max(0, Math.min(100, value))
  return (
    <span className="relative ml-1.5 block h-1.5 overflow-visible rounded-full bg-white/[0.06]">
      <span className={`block h-full rounded-full ${bar} transition-[width] duration-500 ease-out`} style={{ width: `${w}%` }} />
      {target ? <span aria-hidden className="absolute -top-0.5 h-2.5 w-0.5 rounded-full bg-white/70" style={{ left: `calc(${Math.min(100, target)}% - 1px)` }} /> : null}
    </span>
  )
}

// ---- One subject ----

function SubjectDetail({ school, subject, r, scoreBox }: { school: SchoolData; subject: string; r: SubjectReport; scoreBox: RefObject<HTMLInputElement | null> }) {
  const target = targetOf(school, subject)
  const look = subjectLook(school, subject)
  const trend = useMemo(() => history(school, subject), [school, subject])
  const [fresh, setFresh] = useState<string | null>(null)

  return (
    <div className="min-w-0 space-y-4">
      {/* Where the grade stands */}
      <section className={`${card} relative overflow-hidden p-4 sm:p-6`}>
        <div aria-hidden className={`pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full opacity-[0.12] blur-3xl ${look.bar}`} />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center">
          <Ring value={r.current} target={target} color={look.text} />
          <div className="min-w-0 flex-1 space-y-3">
            <div>
              <h3 className="flex items-center gap-2 text-lg font-bold tracking-tight text-white sm:text-xl">
                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${look.bar}`} />
                <span className="truncate">{subject}</span>
              </h3>
              <Status r={r} target={target} />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <TargetChip subject={subject} target={target} />
              {r.cats.length > 0 && r.weightTotal > 0 && (
                <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.07] px-3 text-xs text-zinc-400" title="How much of the course has scores so far">
                  <CircleDashed className="h-3.5 w-3.5" /> {Math.round((r.weightDone / r.weightTotal) * 100)}% of the course graded
                </span>
              )}
              {r.cats.length > 0 && r.weightDone > 0 && r.weightDone < r.weightTotal && (
                <span
                  className="inline-flex h-8 items-center gap-1.5 rounded-full border border-white/[0.07] px-3 text-xs text-zinc-400"
                  title="The lowest your final grade can be, even with zero on everything still to come"
                >
                  <Check className="h-3.5 w-3.5" /> {fmtPct(r.secured)} locked in
                </span>
              )}
            </div>
          </div>
        </div>
        {trend.length >= 2 && <Trend points={trend} target={target} />}
        <Needed r={r} target={target} />
      </section>

      <QuickAdd school={school} subject={subject} r={r} scoreBox={scoreBox} onAdded={setFresh} />
      <Breakdown subject={subject} r={r} />
      <Scores school={school} r={r} target={target} fresh={fresh} />
      <DangerZone subject={subject} r={r} />
    </div>
  )
}

/** A ring for the grade so far, with a small mark where the target is. */
function Ring({ value, target, color }: { value: number | null; target?: number; color: string }) {
  const size = 132
  const stroke = 10
  const rad = (size - stroke) / 2
  const c = 2 * Math.PI * rad
  const v = value === null ? 0 : Math.max(0, Math.min(100, value))
  const tAngle = target ? (Math.min(100, target) / 100) * 2 * Math.PI - Math.PI / 2 : 0
  return (
    <div className="relative mx-auto h-[132px] w-[132px] shrink-0 sm:mx-0" role="img" aria-label={value === null ? 'No grade yet' : `Grade so far ${fmtPct(value)}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={rad} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-white/[0.06]" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={rad}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v / 100)}
          className={`${color} transition-[stroke-dashoffset] duration-700 ease-out`}
        />
      </svg>
      {target ? (
        <span
          aria-hidden
          className="absolute h-3.5 w-1 rounded-full bg-white shadow-[0_0_0_2px_#0e1016]"
          style={{
            left: size / 2 + Math.cos(tAngle) * rad - 2,
            top: size / 2 + Math.sin(tAngle) * rad - 7,
            transform: `rotate(${tAngle + Math.PI / 2}rad)`,
          }}
        />
      ) : null}
      <span className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-[28px] font-bold tabular-nums leading-none tracking-tight text-white">{value === null ? '—' : fmtPct(value)}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500">{value === null ? 'no scores' : 'so far'}</span>
      </span>
    </div>
  )
}

function Status({ r, target }: { r: SubjectReport; target?: number }) {
  if (r.current === null) return <p className="mt-0.5 text-sm text-zinc-500">No scores yet. Add your first one below.</p>
  if (!target) return <p className="mt-0.5 text-sm text-zinc-400">From {plural(r.count, 'score')}. Set a target to see how you’re tracking.</p>
  const gap = r.current - target
  if (gap >= 0)
    return (
      <p className="mt-0.5 flex items-center gap-1.5 text-sm text-emerald-300">
        <CheckCircle2 className="h-4 w-4 shrink-0" /> On track: {fmtPct(gap)} above your {fmtPct(target, true)} target
      </p>
    )
  return (
    <p className={`mt-0.5 flex items-center gap-1.5 text-sm ${gap >= -5 ? 'text-amber-200' : 'text-rose-300'}`}>
      <AlertTriangle className="h-4 w-4 shrink-0" /> {fmtPct(-gap)} below your {fmtPct(target, true)} target
    </p>
  )
}

function TargetChip({ subject, target }: { subject: string; target?: number }) {
  const [editing, setEditing] = useState(false)
  const [text, setText] = useState('')
  function save() {
    setEditing(false)
    const t = text.trim().replace('%', '').replace(',', '.')
    if (!t) return target && change((s) => setTarget(s, subject, null))
    const n = Number(t)
    if (!Number.isFinite(n) || n <= 0 || n > 1000) return toast.error('A target is a percentage, like 90.')
    if (n !== target) change((s) => setTarget(s, subject, n))
  }
  if (editing)
    return (
      <span className="inline-flex h-8 items-center gap-1 rounded-full border border-indigo-400/50 bg-black/40 pl-3 pr-1 ring-2 ring-indigo-500/20">
        <Target className="h-3.5 w-3.5 text-indigo-300" />
        <input
          autoFocus
          value={text}
          inputMode="decimal"
          aria-label="Target grade in percent"
          placeholder="90"
          onChange={(e) => setText(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              e.stopPropagation()
              setText(String(target ?? ''))
              setEditing(false)
            }
          }}
          className="w-12 bg-transparent text-xs font-semibold tabular-nums text-white outline-none placeholder:text-zinc-600"
        />
        <span className="pr-2 text-xs text-zinc-500">%</span>
      </span>
    )
  return (
    <button
      onClick={() => (setText(target ? String(target) : ''), setEditing(true))}
      title={target ? 'Change your target (leave it empty to remove it)' : 'Set the grade you’re aiming for'}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition ${
        target ? 'border-white/10 text-zinc-200 hover:border-white/25' : 'border-dashed border-indigo-400/40 text-indigo-200 hover:bg-indigo-500/10'
      }`}
    >
      <Target className="h-3.5 w-3.5" /> {target ? `Target ${fmtPct(target, true)}` : 'Set a target'}
      {target ? <Pencil className="h-3 w-3 text-zinc-500" /> : null}
    </button>
  )
}

/** "To finish with 90% you need 84% on what's left": the most useful line on the page. */
function Needed({ r, target }: { r: SubjectReport; target?: number }) {
  if (!target || r.current === null) return null
  const n = needed(r, target)
  if (n === null) return null
  const left = r.cats.filter((c) => c.avg === null && c.cat.weight > 0)
  const parts = left.map((c) => `${c.cat.name} (${fmtPct(c.cat.weight, true)})`).join(', ')
  const [tone, icon, text] =
    n <= 0
      ? (['border-emerald-400/25 bg-emerald-500/[0.07] text-emerald-100', CheckCircle2, <>You’ve already locked in {fmtPct(target, true)}. Anything from here is a bonus.</>] as const)
      : n > 100
        ? ([
            'border-rose-400/25 bg-rose-500/[0.07] text-rose-100',
            AlertTriangle,
            <>
              Reaching {fmtPct(target, true)} would take <b className="font-semibold text-white">{fmtPct(n)}</b> on what’s left, more than full marks. The most you can still
              finish with is about <b className="font-semibold text-white">{fmtPct(maxReachable(r))}</b>.
            </>,
          ] as const)
        : ([
            n > 90 ? 'border-amber-400/25 bg-amber-500/[0.07] text-amber-50' : 'border-indigo-400/25 bg-indigo-500/[0.07] text-indigo-50',
            Crosshair,
            <>
              To finish with {fmtPct(target, true)}, you need an average of <b className="font-semibold text-white">{fmtPct(n)}</b> on what’s left.
            </>,
          ] as const)
  const Icon = icon
  return (
    <div className={`relative mt-4 flex gap-3 rounded-xl border px-3.5 py-3 text-sm leading-relaxed ${tone}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="min-w-0">
        {text}
        {parts && <span className="block text-xs opacity-70">Still to come: {parts}</span>}
      </p>
    </div>
  )
}

const maxReachable = (r: SubjectReport) => r.secured + ((r.weightTotal - r.weightDone) / r.weightTotal) * 100

/** The grade over time: after each day with a score. Hover (or touch) to read any point. */
function Trend({ points, target }: { points: { date: string; value: number }[]; target?: number }) {
  const [hover, setHover] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const W = 600
  const H = 96
  const pad = 8
  const vals = points.map((p) => p.value)
  const lo = Math.max(0, Math.floor((Math.min(...vals, target ?? Infinity) - 5) / 5) * 5)
  const hi = Math.min(Math.max(100, ...vals), Math.ceil((Math.max(...vals, target ?? -Infinity) + 5) / 5) * 5)
  const x = (i: number) => (points.length === 1 ? W / 2 : (i / (points.length - 1)) * W)
  const y = (v: number) => pad + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - pad * 2)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const area = `${line} L${W},${H} L0,${H} Z`
  const first = points[0].value
  const last = points[points.length - 1].value
  const delta = last - first

  function onMove(clientX: number) {
    const el = box.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const f = (clientX - rect.left) / rect.width
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(f * (points.length - 1)))))
  }
  const h = hover === null ? null : points[hover]

  return (
    <div className="relative mt-5 border-t border-white/[0.05] pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <p className="text-xs font-medium text-zinc-400">Grade over time</p>
        <p className="text-xs tabular-nums text-zinc-500">
          {Math.abs(delta) < 0.05 ? 'Steady' : `${delta > 0 ? '+' : '−'}${fmtPct(Math.abs(delta))}`} since {shortDate(points[0].date).replace(/^\w+, /, '')}
        </p>
      </div>
      <div
        ref={box}
        className="relative h-24 touch-pan-y"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible text-indigo-400" aria-hidden>
          <defs>
            <linearGradient id="grade-area" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          {target && target >= lo && target <= hi ? (
            <line x1={0} x2={W} y1={y(target)} y2={y(target)} stroke="rgba(255,255,255,0.28)" strokeDasharray="4 4" strokeWidth={1} vectorEffect="non-scaling-stroke" />
          ) : null}
          <path d={area} fill="url(#grade-area)" />
          <path d={line} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
          {h && <line x1={x(hover!)} x2={x(hover!)} y1={0} y2={H} stroke="rgba(255,255,255,0.18)" strokeWidth={1} vectorEffect="non-scaling-stroke" />}
        </svg>
        {/* Dots are drawn in HTML so they stay round when the chart stretches. */}
        {[hover ?? points.length - 1].map((i) => (
          <span
            key={i}
            aria-hidden
            className="pointer-events-none absolute h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-indigo-300 shadow-[0_0_0_2px_#0e1016]"
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(points[i].value) / H) * 100}%` }}
          />
        ))}
        {target && target >= lo && target <= hi ? (
          <span className="pointer-events-none absolute right-0 -translate-y-full pb-0.5 text-[10px] text-zinc-500" style={{ top: `${(y(target) / H) * 100}%` }}>
            Target {fmtPct(target, true)}
          </span>
        ) : null}
        {h && (
          <div
            className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-white/10 bg-[#12141b]/95 px-2.5 py-1.5 text-xs shadow-xl backdrop-blur"
            style={{ left: `${Math.min(88, Math.max(12, (x(hover!) / W) * 100))}%` }}
          >
            <span className="block font-semibold tabular-nums text-white">{fmtPct(h.value)}</span>
            <span className="block text-zinc-500">{shortDate(h.date)}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ---- Adding a score ----

function QuickAdd({ school, subject, r, scoreBox, onAdded }: {
  school: SchoolData
  subject: string
  r: SubjectReport
  scoreBox: RefObject<HTMLInputElement | null>
  onAdded: (id: string) => void
}) {
  const cats = r.cats.map((c) => c.cat)
  const [cat, setCat] = useState<string>(() => cats[0]?.id ?? '')
  const [score, setScore] = useState('')
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(todayKey)
  const catId = cats.some((c) => c.id === cat) ? cat : (cats[0]?.id ?? '')
  const catReport = r.cats.find((c) => c.cat.id === catId)
  const inCat = catReport ? catReport.grades : r.cats.length ? [] : school.grades.filter((g) => g.subject.toLowerCase() === subject.toLowerCase())
  // A plain number counts out of the same total as the last score here ("18" after "17/20" means 18/20).
  const lastMax = [...inCat].sort((a, b) => b.createdAt - a.createdAt)[0]?.max ?? 100
  const typed = score.trim()
  const plainNum = /^-?[\d.,]+$/.test(typed) ? Number(typed.replace(',', '.')) : NaN
  const parsed = parseScore(typed, Number.isFinite(plainNum) && plainNum > lastMax ? 100 : lastMax)
  const suggestion = nextTitle(catReport?.cat, inCat.length)

  function submit() {
    if (!parsed) {
      if (typed) toast.error('Type a score like 18/20, 92% or 85.')
      scoreBox.current?.focus()
      return
    }
    let id = ''
    change((s) => {
      const res = addGrade(s, { subject, cat: catId, title: title.trim() || suggestion, score: parsed.score, max: parsed.max, date })
      id = res.id
      return res.school
    })
    onAdded(id)
    setScore('')
    setTitle('')
    scoreBox.current?.focus()
  }

  const pct = parsed ? percent(parsed) : null

  return (
    <section className={`${card} p-4 sm:p-5`} aria-label="Add a score">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-semibold text-white">
          <ListPlus className="h-4 w-4 text-indigo-300" /> Add a score
        </h4>
        <span className="hidden text-[11px] text-zinc-500 sm:block">
          Press <kbd className="rounded border border-white/10 px-1">Enter</kbd> to add, then type the next
        </span>
      </div>

      {cats.length > 0 && (
        <div role="radiogroup" aria-label="Part of the grade" className="scrollbar-none -mx-1 mb-3 flex gap-1.5 overflow-x-auto px-1 pb-0.5">
          {r.cats.map((c, i) => (
            <button
              key={c.cat.id}
              type="button"
              role="radio"
              aria-checked={catId === c.cat.id}
              onClick={() => (setCat(c.cat.id), scoreBox.current?.focus())}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition active:scale-95 ${
                catId === c.cat.id ? 'border-indigo-400/50 bg-indigo-500/15 text-white' : 'border-white/10 text-zinc-400 hover:border-white/20 hover:text-zinc-200'
              }`}
            >
              <span className={`h-2 w-2 rounded-sm ${partColor(i).fill}`} /> {c.cat.name}
              <span className="text-zinc-500">{fmtPct(c.cat.weight, true)}</span>
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
        className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,10rem)_auto]"
      >
        <label className="relative col-span-1">
          <span className="sr-only">Score</span>
          <input
            ref={scoreBox}
            value={score}
            onChange={(e) => setScore(e.target.value)}
            inputMode="text"
            autoComplete="off"
            placeholder={lastMax === 100 ? 'e.g. 18/20' : `Score / ${lastMax}`}
            aria-describedby="score-preview"
            className={`${input} h-11 pr-14 text-base font-semibold tabular-nums sm:h-10 sm:text-sm`}
          />
          <span
            id="score-preview"
            aria-live="polite"
            className={`pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-md px-1.5 py-0.5 text-[11px] font-semibold tabular-nums transition ${
              pct !== null ? TONE_PILL[toneOf(pct, targetOf(school, subject))] : typed ? 'text-rose-300' : 'opacity-0'
            }`}
          >
            {pct !== null ? fmtPct(pct, true) : typed ? '?' : ''}
          </span>
        </label>
        <label className="col-span-1">
          <span className="sr-only">Name</span>
          <input
            value={title}
            maxLength={MAX_GRADE_TITLE}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={suggestion}
            className={`${input} h-11 text-base sm:h-10 sm:text-sm`}
          />
        </label>
        <label className="col-span-1">
          <span className="sr-only">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} className={`${input} h-11 [color-scheme:dark] sm:h-10`} />
        </label>
        <button
          disabled={!parsed}
          className="col-span-1 inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40 sm:h-10"
        >
          <Plus className="h-4 w-4" strokeWidth={2.5} /> Add
        </button>
      </form>
      <p className="mt-2 min-h-[1rem] text-[11px] text-zinc-500">
        {parsed ? (
          <>
            {scoreText(parsed)} = <span className="font-medium text-zinc-300">{fmtPct(pct)}</span>
            {catReport ? (
              <>
                {' '}
                in {catReport.cat.name}
                {catReport.avg !== null && (
                  <>
                    {' '}
                    · its average would go from {fmtPct(catReport.avg, true)} to{' '}
                    {fmtPct(((catReport.grades.reduce((n, g) => n + g.score, 0) + parsed.score) / (catReport.grades.reduce((n, g) => n + g.max, 0) + parsed.max)) * 100, true)}
                  </>
                )}
              </>
            ) : null}
          </>
        ) : (
          <>Type “18/20”, “18 of 20”, “92%”, or just a number{lastMax !== 100 ? ` (out of ${lastMax}, like the last one)` : ' (out of 100)'}.</>
        )}
      </p>
    </section>
  )
}

// ---- How it's graded ----

function Breakdown({ subject, r }: { subject: string; r: SubjectReport }) {
  const [adding, setAdding] = useState(false)
  const [open, setOpen] = useState(r.cats.length === 0 || r.weightTotal !== 100)
  const total = r.weightTotal
  const off = r.cats.length > 0 && Math.abs(total - 100) > 0.001

  return (
    <section className={`${card} overflow-hidden`} aria-label="How it’s graded">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-white/[0.02] sm:px-5">
        <Layers className="h-4 w-4 shrink-0 text-indigo-300" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-semibold text-white">How it’s graded</span>
          <span className="block truncate text-xs text-zinc-500">
            {r.cats.length ? `${plural(r.cats.length, 'part')} · ${r.cats.map((c) => `${c.cat.name} ${fmtPct(c.cat.weight, true)}`).join(' · ')}` : 'Every score counts the same until you add parts'}
          </span>
        </span>
        {r.cats.length > 0 && (
          <span
            className={`hidden shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums sm:inline-flex ${
              off ? 'bg-amber-400/12 text-amber-100 ring-1 ring-amber-300/20' : 'bg-emerald-400/12 text-emerald-200 ring-1 ring-emerald-300/20'
            }`}
          >
            {off ? <AlertTriangle className="h-3 w-3" /> : <Check className="h-3 w-3" />} {fmtPct(total, true)}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {r.cats.length > 0 && <WeightBar cats={r.cats} total={total} />}

      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`} inert={!open}>
        <div className="min-h-0 overflow-hidden">
          <div className="space-y-3 border-t border-white/[0.05] px-4 py-4 sm:px-5">
            {r.cats.length === 0 ? (
              <Templates subject={subject} onCustom={() => setAdding(true)} />
            ) : (
              <>
                {off && (
                  <p className="flex items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] px-3 py-2 text-xs text-amber-100">
                    <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0" />
                    The parts add up to {fmtPct(total)}, not 100%. Your grade is still worked out fairly, scaled to {fmtPct(total, true)}.
                  </p>
                )}
                <div className="hidden grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_4.5rem_5.5rem] gap-2 px-1 text-[11px] font-medium uppercase tracking-wider text-zinc-500 sm:grid">
                  <span>Part</span>
                  <span>Weight</span>
                  <span>Drop lowest</span>
                  <span className="text-right">Average</span>
                  <span />
                </div>
                <ul className="space-y-2">
                  {r.cats.map((c, i) => (
                    <CategoryRow key={c.cat.id} c={c} index={i} all={r.cats} />
                  ))}
                </ul>
              </>
            )}
            {adding || r.cats.length > 0 ? (
              <AddCategory subject={subject} suggest={Math.max(0, 100 - total)} startOpen={adding} onDone={() => setAdding(false)} />
            ) : null}
          </div>
        </div>
      </div>
    </section>
  )
}

/** Each part as a share of the whole grade; the solid part of each segment is how much of it you've earned. */
function WeightBar({ cats, total }: { cats: CatReport[]; total: number }) {
  if (total <= 0) return null
  return (
    <div className="px-4 pb-4 sm:px-5" aria-hidden>
      <div className="flex h-2.5 gap-[2px]">
        {cats.map((c, i) =>
          c.cat.weight > 0 ? (
            <div
              key={c.cat.id}
              title={`${c.cat.name}: ${fmtPct(c.cat.weight, true)} of the grade · average ${fmtPct(c.avg)}`}
              className={`relative h-full overflow-hidden rounded-[4px] ${partColor(i).soft}`}
              style={{ flexGrow: c.cat.weight, flexBasis: 0 }}
            >
              <div className={`h-full ${partColor(i).fill} transition-[width] duration-500 ease-out`} style={{ width: `${c.avg === null ? 0 : Math.min(100, c.avg)}%` }} />
            </div>
          ) : null,
        )}
      </div>
    </div>
  )
}

function Templates({ subject, onCustom }: { subject: string; onCustom: () => void }) {
  return (
    <div>
      <p className="mb-2.5 text-sm text-zinc-400">Split the grade the way your syllabus does. Pick a starting point and adjust it, or make your own.</p>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-2 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <button
            key={t.id}
            onClick={() => {
              change((s) => setCategories(s, subject, t.parts))
              toast.success(`Set up ${subject}: ${t.parts.length} parts. Change any name or weight to match your class.`)
            }}
            className="group rounded-xl border border-white/[0.07] bg-black/20 p-3 text-left transition hover:border-indigo-400/40 hover:bg-indigo-500/[0.05]"
          >
            <span className="block text-sm font-medium text-zinc-100">{t.label}</span>
            <span className="mt-2 flex h-1.5 gap-[2px]">
              {t.parts.map((p, i) => (
                <span key={p.name} className={`rounded-[3px] ${partColor(i).fill}`} style={{ flexGrow: p.weight, flexBasis: 0 }} />
              ))}
            </span>
            <span className="mt-1.5 block truncate text-[11px] text-zinc-500">{t.parts.map((p) => `${p.name} ${p.weight}%`).join(' · ')}</span>
          </button>
        ))}
        <button
          onClick={onCustom}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 p-3 text-sm text-zinc-400 transition hover:border-white/25 hover:text-zinc-200"
        >
          <Plus className="h-4 w-4" /> Make my own
        </button>
      </div>
    </div>
  )
}

function CategoryRow({ c, index, all }: { c: CatReport; index: number; all: CatReport[] }) {
  const [name, setName] = useState(c.cat.name)
  const [weight, setWeight] = useState(String(c.cat.weight))
  const [sure, setSure] = useState(false)
  useEffect(() => setName(c.cat.name), [c.cat.name])
  useEffect(() => setWeight(String(c.cat.weight)), [c.cat.weight])
  const others = all.filter((x) => x.cat.id !== c.cat.id)
  const moveTo = others[0]?.cat

  function saveName() {
    const n = name.trim()
    if (!n) return setName(c.cat.name)
    if (n !== c.cat.name) change((s) => updateCategory(s, c.cat.id, { name: n }))
  }
  function saveWeight() {
    const w = Number(weight.replace('%', '').replace(',', '.').trim())
    if (!weight.trim() || !Number.isFinite(w) || w < 0) return setWeight(String(c.cat.weight))
    if (w !== c.cat.weight) change((s) => updateCategory(s, c.cat.id, { weight: w }))
  }
  function remove(keepScores: boolean) {
    const before = useStore.getState().school
    change((s) => removeCategory(s, c.cat.id, keepScores ? (moveTo?.id ?? '') : null))
    setSure(false)
    toast.undo(
      c.grades.length
        ? keepScores && moveTo
          ? `Deleted “${c.cat.name}”. Its ${plural(c.grades.length, 'score')} moved to “${moveTo.name}”.`
          : `Deleted “${c.cat.name}” and its ${plural(c.grades.length, 'score')}.`
        : `Deleted “${c.cat.name}”.`,
      () => change(() => before),
    )
  }
  const field = 'h-9 w-full rounded-lg border border-white/10 bg-black/30 px-2.5 text-sm text-zinc-100 outline-none transition hover:border-white/20 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'

  return (
    <li className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-2">
      <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] gap-2 sm:grid-cols-[minmax(0,1fr)_5.5rem_6.5rem_4.5rem_5.5rem] sm:items-center">
        <label className="relative">
          <span className="sr-only">Name of this part</span>
          <span aria-hidden className={`absolute left-2.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-sm ${partColor(index).fill}`} />
          <input
            value={name}
            maxLength={MAX_CATEGORY}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`${field} pl-7 font-medium`}
          />
        </label>
        <label className="relative">
          <span className="sr-only">Weight in percent</span>
          <input
            value={weight}
            inputMode="decimal"
            onChange={(e) => setWeight(e.target.value)}
            onBlur={saveWeight}
            onFocus={(e) => e.currentTarget.select()}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            className={`${field} pr-7 text-right tabular-nums`}
          />
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
        </label>
        <label className="flex items-center gap-2 sm:block">
          <span className="text-xs text-zinc-500 sm:sr-only">Drop lowest</span>
          <select
            value={c.cat.drop ?? 0}
            onChange={(e) => change((s) => updateCategory(s, c.cat.id, { drop: Number(e.target.value) }))}
            title="Leave out your lowest scores in this part, if your teacher does"
            className={`${field} w-auto [color-scheme:dark] sm:w-full`}
          >
            {[0, 1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n === 0 ? 'None' : `${n} lowest`}
              </option>
            ))}
          </select>
        </label>
        <span className="flex items-center justify-end gap-2 text-right text-sm tabular-nums">
          <span className="text-xs text-zinc-500 sm:hidden">{plural(c.grades.length, 'score')} ·</span>
          <span className={c.avg === null ? 'text-zinc-600' : 'font-semibold text-zinc-100'}>{fmtPct(c.avg)}</span>
        </span>
        <span className="col-span-2 flex items-center justify-end gap-0.5 sm:col-span-1">
          <button onClick={() => change((s) => moveCategory(s, c.cat.id, -1))} disabled={index === 0} aria-label={`Move ${c.cat.name} up`} className={iconBtn}>
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
          <button onClick={() => change((s) => moveCategory(s, c.cat.id, 1))} disabled={index === all.length - 1} aria-label={`Move ${c.cat.name} down`} className={iconBtn}>
            <ArrowDown className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => (c.grades.length ? setSure((x) => !x) : remove(false))}
            aria-label={`Delete ${c.cat.name}`}
            className={`${iconBtn} hover:bg-red-500/10 hover:text-red-300 ${sure ? 'bg-red-500/10 text-red-300' : ''}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </span>
      </div>
      {sure && (
        <div className="animate-fade mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-red-500/[0.06] px-2.5 py-2 text-xs text-red-100">
          <span className="mr-auto">“{c.cat.name}” has {plural(c.grades.length, 'score')}. What should happen to them?</span>
          {moveTo && (
            <button onClick={() => remove(true)} className="h-8 rounded-lg border border-white/10 px-2.5 font-medium text-zinc-100 transition hover:bg-white/5">
              Move to “{moveTo.name}”
            </button>
          )}
          <button onClick={() => remove(false)} className="h-8 rounded-lg bg-red-500/80 px-2.5 font-semibold text-white transition hover:bg-red-500">
            Delete them too
          </button>
          <button onClick={() => setSure(false)} aria-label="Cancel" className={iconBtn}>
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </li>
  )
}

function AddCategory({ subject, suggest, startOpen, onDone }: { subject: string; suggest: number; startOpen: boolean; onDone: () => void }) {
  const [open, setOpen] = useState(startOpen)
  const [name, setName] = useState('')
  const [weight, setWeight] = useState(String(suggest || ''))
  useEffect(() => {
    if (startOpen) setOpen(true)
  }, [startOpen])
  useEffect(() => setWeight(String(suggest || '')), [suggest])

  function close() {
    setOpen(false)
    setName('')
    onDone()
  }

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="flex h-10 w-full items-center gap-2 rounded-xl px-3 text-sm text-zinc-500 transition hover:bg-white/[0.04] hover:text-zinc-200">
        <Plus className="h-4 w-4" /> Add a part{suggest > 0 ? ` (${fmtPct(suggest, true)} still unassigned)` : ''}
      </button>
    )

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) return
        const w = Number(weight.replace('%', '').replace(',', '.'))
        change((s) => addCategory(s, subject, name, Number.isFinite(w) ? w : 0).school)
        setName('')
      }}
      className="animate-fade flex flex-wrap gap-2 rounded-xl border border-indigo-400/25 bg-indigo-500/[0.04] p-2"
    >
      <input
        autoFocus
        value={name}
        maxLength={MAX_CATEGORY}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), close())}
        placeholder="Name, e.g. Quizzes"
        aria-label="Name of the new part"
        className={`${input} h-9 min-w-[10rem] flex-1`}
      />
      <label className="relative w-24">
        <span className="sr-only">Weight in percent</span>
        <input value={weight} inputMode="decimal" onChange={(e) => setWeight(e.target.value)} placeholder="20" className={`${input} h-9 pr-7 text-right tabular-nums`} />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-zinc-500">%</span>
      </label>
      <button disabled={!name.trim()} className="h-9 rounded-xl bg-indigo-500 px-4 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
        Add
      </button>
      <button type="button" onClick={close} className="h-9 rounded-xl px-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
        Done
      </button>
    </form>
  )
}

// ---- The scores ----

function Scores({ school, r, target, fresh }: { school: SchoolData; r: SubjectReport; target?: number; fresh: string | null }) {
  const [editing, setEditing] = useState<string | null>(null)
  if (!r.count) return null
  const groups: { id: string; name: string; weight?: number; avg: number | null; color?: string; grades: Grade[]; dropped: Set<string>; loose?: boolean }[] = r.cats.length
    ? [
        ...r.cats.map((c, i) => ({ id: c.cat.id, name: c.cat.name, weight: c.cat.weight, avg: c.avg, color: partColor(i).fill, grades: c.grades, dropped: c.dropped })),
        ...(r.loose.length ? [{ id: '', name: 'Not in a part', avg: null, grades: r.loose, dropped: new Set<string>(), loose: true }] : []),
      ]
    : [{ id: '', name: 'All scores', avg: r.current, grades: school.grades.filter((g) => g.subject.toLowerCase() === r.subject.toLowerCase()), dropped: new Set<string>() }]

  return (
    <section className={`${card} overflow-hidden`} aria-label="Scores">
      <h4 className="flex items-center gap-2 border-b border-white/[0.05] px-4 py-3.5 text-sm font-semibold text-white sm:px-5">
        Scores <span className="text-xs font-normal tabular-nums text-zinc-500">{r.count}</span>
      </h4>
      <div className="divide-y divide-white/[0.05]">
        {groups
          .filter((g) => g.grades.length)
          .map((g) => (
            <div key={g.id || 'loose'}>
              <div className="flex items-center gap-2 bg-black/10 px-4 py-2 sm:px-5">
                {g.color && <span className={`h-2.5 w-2.5 shrink-0 rounded-sm ${g.color}`} />}
                <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  {g.name}
                  {g.weight !== undefined && <span className="ml-1.5 font-normal normal-case tracking-normal text-zinc-600">{fmtPct(g.weight, true)} of the grade</span>}
                </span>
                {g.loose ? (
                  <span className="text-[11px] text-amber-200/80">Not counted · pick a part for each</span>
                ) : (
                  <span className="text-xs font-semibold tabular-nums text-zinc-300">avg {fmtPct(g.avg)}</span>
                )}
              </div>
              <ul className="divide-y divide-white/[0.035]">
                {[...g.grades]
                  .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt)
                  .map((x) =>
                    editing === x.id ? (
                      <EditRow key={x.id} grade={x} r={r} onDone={() => setEditing(null)} />
                    ) : (
                      <ScoreRow key={x.id} grade={x} target={target} dropped={g.dropped.has(x.id)} fresh={fresh === x.id} onEdit={() => setEditing(x.id)} />
                    ),
                  )}
              </ul>
            </div>
          ))}
      </div>
    </section>
  )
}

function ScoreRow({ grade: g, target, dropped, fresh, onEdit }: { grade: Grade; target?: number; dropped: boolean; fresh: boolean; onEdit: () => void }) {
  const p = percent(g)
  function remove() {
    change((s) => removeGrades(s, [g.id]))
    toast.undo(`Deleted “${g.title || scoreText(g)}”.`, () => useStore.getState().changeSchool((s) => ({ ...s, grades: [...s.grades, g] })))
  }
  return (
    <li className={`group flex items-center gap-3 px-4 py-2.5 transition hover:bg-white/[0.025] sm:px-5 ${fresh ? 'animate-rise bg-indigo-500/[0.06]' : ''}`}>
      <button onClick={onEdit} className="flex min-w-0 flex-1 items-center gap-3 text-left" title="Edit">
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm font-medium ${dropped ? 'text-zinc-500 line-through decoration-zinc-600' : 'text-zinc-100'}`}>{g.title || 'Untitled'}</span>
          <span className="block text-xs text-zinc-500">
            {shortDate(g.date)}
            {dropped && ' · dropped as one of the lowest'}
          </span>
        </span>
        <span className="shrink-0 text-sm tabular-nums text-zinc-400">{scoreText(g)}</span>
        <span className={`w-[4.25rem] shrink-0 rounded-full px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${dropped ? TONE_PILL.none : TONE_PILL[toneOf(p, target)]}`}>
          {fmtPct(p)}
        </span>
      </button>
      <span className="flex shrink-0 opacity-100 transition sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
        <button onClick={onEdit} aria-label={`Edit ${g.title}`} className={iconBtn}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button onClick={remove} aria-label={`Delete ${g.title}`} className={`${iconBtn} hover:bg-red-500/10 hover:text-red-300`}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </span>
    </li>
  )
}

function EditRow({ grade: g, r, onDone }: { grade: Grade; r: SubjectReport; onDone: () => void }) {
  const [title, setTitle] = useState(g.title)
  const [score, setScore] = useState(scoreInput(g))
  const [cat, setCat] = useState(g.cat)
  const [date, setDate] = useState(g.date)
  const parsed = parseScore(score, g.max)

  function save() {
    if (!parsed) return toast.error('Type a score like 18/20, 92% or 85.')
    change((s) => updateGrade(s, g.id, { title, score: parsed.score, max: parsed.max, cat, date }))
    onDone()
  }
  const field = 'h-9 w-full rounded-lg border border-white/10 bg-black/40 px-2.5 text-sm text-zinc-100 outline-none transition focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20'

  return (
    <li className="animate-fade bg-indigo-500/[0.05] px-4 py-3 sm:px-5">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
        onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onDone())}
        className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1fr)_7rem_minmax(0,9rem)_9.5rem_auto]"
      >
        <input autoFocus value={title} maxLength={MAX_GRADE_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder="Name" aria-label="Name" className={`${field} col-span-2 sm:col-span-1`} />
        <label className="relative">
          <span className="sr-only">Score</span>
          <input value={score} onChange={(e) => setScore(e.target.value)} className={`${field} pr-11 font-semibold tabular-nums ${parsed ? '' : 'border-rose-400/50'}`} />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] tabular-nums text-zinc-500">{parsed ? fmtPct(percent(parsed), true) : '?'}</span>
        </label>
        {r.cats.length > 0 ? (
          <select value={cat} onChange={(e) => setCat(e.target.value)} aria-label="Part" className={`${field} [color-scheme:dark]`}>
            {!r.cats.some((c) => c.cat.id === cat) && <option value={cat}>Not in a part</option>}
            {r.cats.map((c) => (
              <option key={c.cat.id} value={c.cat.id}>
                {c.cat.name}
              </option>
            ))}
          </select>
        ) : (
          <span className="hidden sm:block" />
        )}
        <input type="date" value={date} onChange={(e) => setDate(e.target.value || g.date)} aria-label="Date" className={`${field} [color-scheme:dark]`} />
        <span className="col-span-2 flex justify-end gap-1.5 sm:col-span-1">
          <button type="button" onClick={onDone} className="h-9 rounded-lg px-3 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white">
            Cancel
          </button>
          <button disabled={!parsed} className="h-9 rounded-lg bg-indigo-500 px-3.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:opacity-40">
            Save
          </button>
        </span>
      </form>
    </li>
  )
}

function DangerZone({ subject, r }: { subject: string; r: SubjectReport }) {
  const [sure, setSure] = useState(false)
  if (!r.count && !r.cats.length) return null
  return (
    <div className="flex flex-wrap items-center justify-end gap-2 px-1 text-xs">
      {sure ? (
        <>
          <span className="text-zinc-400">
            Delete {r.count ? plural(r.count, 'score') : 'no scores'}
            {r.cats.length ? ` and ${plural(r.cats.length, 'part')}` : ''} for {subject}?
          </span>
          <button onClick={() => setSure(false)} className="h-8 rounded-lg px-2.5 text-zinc-400 transition hover:bg-white/5 hover:text-white">
            Keep them
          </button>
          <button
            onClick={() => {
              const before = useStore.getState().school
              change((s) => clearSubjectGrades(s, subject))
              setSure(false)
              toast.undo(`Cleared the grades for ${subject}.`, () => change(() => before))
            }}
            className="h-8 rounded-lg bg-red-500/80 px-2.5 font-semibold text-white transition hover:bg-red-500"
          >
            Delete
          </button>
        </>
      ) : (
        <button onClick={() => setSure(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-zinc-600 transition hover:bg-red-500/10 hover:text-red-300">
          <Trash2 className="h-3.5 w-3.5" /> Clear {subject}’s grades
        </button>
      )}
    </div>
  )
}

