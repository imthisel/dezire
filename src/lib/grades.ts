import { isDate, todayKey } from './expenses'
import {
  MAX_CATEGORY, MAX_GRADE_TITLE, MAX_SUBJECT, findSubject, rememberSubject, subjectOptions, uid,
  type Grade, type GradeCategory, type School,
} from './school'

/**
 * Grades: each subject's grade is made of parts (Quizzes 20%, Final exam 40%…), each part the average of its scores.
 *
 * - A part's average counts points: 18/20 and 40/50 make 58/70 (83%), the way most teachers and school systems add up.
 *   Its lowest few scores can be left out ("drop the lowest quiz").
 * - The subject's grade so far is the parts that have scores, each by its weight, scaled to the weight they make
 *   up between them: Quizzes 90% (20%) and a Midterm 80% (30%) make 84%, before the final is in.
 * - A subject with no parts yet just adds up all its points.
 */

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()

/** A score as a percentage (18 out of 20 → 90). */
export const percent = (g: Pick<Grade, 'score' | 'max'>) => (g.max > 0 ? (g.score / g.max) * 100 : 0)

export type CatReport = {
  cat: GradeCategory
  grades: Grade[]
  /** Scores left out as the lowest ones */
  dropped: Set<string>
  /** Average so far, null when there's nothing in it yet */
  avg: number | null
}

export type SubjectReport = {
  subject: string
  cats: CatReport[]
  /** Scores not in any part (only possible once the subject has parts, e.g. after one is deleted) */
  loose: Grade[]
  /** The grade so far (null: no scores yet) */
  current: number | null
  /** What all the parts add up to (usually 100) */
  weightTotal: number
  /** The weight of the parts that have scores */
  weightDone: number
  /** Points earned out of the whole course so far: the lowest the final grade can be if the rest were zero */
  secured: number
  count: number
}

/** A part's average: points over points, without the lowest `drop` scores. */
function catAverage(list: Grade[], drop = 0) {
  const dropped = new Set<string>()
  if (drop > 0 && list.length > drop) {
    for (const g of [...list].sort((a, b) => percent(a) - percent(b)).slice(0, drop)) dropped.add(g.id)
  }
  let got = 0
  let of = 0
  for (const g of list) {
    if (dropped.has(g.id)) continue
    got += g.score
    of += g.max
  }
  return { avg: of > 0 ? (got / of) * 100 : null, dropped }
}

export const subjectCats = (s: School, subject: string) => s.gradeCats.filter((c) => same(c.subject, subject))
export const subjectGrades = (s: School, subject: string) => s.grades.filter((g) => same(g.subject, subject))

/** Works out a subject's grade from its scores and parts. `grades` can be given to work it out as of an earlier day. */
export function report(s: School, subject: string, grades = subjectGrades(s, subject)): SubjectReport {
  const cats = subjectCats(s, subject)
  const ids = new Set(cats.map((c) => c.id))
  const loose = cats.length ? grades.filter((g) => !ids.has(g.cat)) : []
  const catReports: CatReport[] = cats.map((cat) => {
    const list = grades.filter((g) => g.cat === cat.id)
    return { cat, grades: list, ...catAverage(list, cat.drop) }
  })
  const weightTotal = cats.reduce((n, c) => n + c.weight, 0)
  let current: number | null = null
  let weightDone = 0
  let earned = 0
  if (!cats.length) {
    current = catAverage(grades).avg
    weightDone = current === null ? 0 : 100
    earned = current ?? 0
  } else {
    for (const r of catReports) {
      if (r.avg === null || r.cat.weight <= 0) continue
      weightDone += r.cat.weight
      earned += (r.avg * r.cat.weight) / 100
    }
    if (weightDone > 0) current = (earned / weightDone) * 100
  }
  const scale = cats.length && weightTotal > 0 ? 100 / weightTotal : 1
  return { subject, cats: catReports, loose, current, weightTotal, weightDone, secured: earned * scale, count: grades.length }
}

/**
 * What's needed on average in the parts still to come to finish on `target`: null when every part has scores
 * (or nothing's set up to say).
 */
export function needed(r: SubjectReport, target: number): number | null {
  if (!r.cats.length || r.weightTotal <= 0) return null
  const left = r.weightTotal - r.weightDone
  if (left <= 0.0001) return null
  const earnedOfTotal = (r.secured / 100) * r.weightTotal
  return ((target / 100) * r.weightTotal - earnedOfTotal) / left * 100
}

/** The subject's grade after each day it got a score, oldest first (for the trend line). */
export function history(s: School, subject: string): { date: string; value: number }[] {
  const all = [...subjectGrades(s, subject)].sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
  const out: { date: string; value: number }[] = []
  for (let i = 0; i < all.length; i++) {
    if (all[i + 1]?.date === all[i].date) continue
    const v = report(s, subject, all.slice(0, i + 1)).current
    if (v !== null) out.push({ date: all[i].date, value: v })
  }
  return out
}

/** Subjects on the Grades page: your subject list (starred first), plus any that only have grades. */
export function gradeSubjects(s: School): string[] {
  const names = subjectOptions(s).map((x) => x.name)
  for (const n of [...s.grades.map((g) => g.subject), ...s.gradeCats.map((c) => c.subject)]) {
    if (!names.some((x) => same(x, n))) names.push(n)
  }
  return names
}

/** The plain average of every subject's grade so far (null: no scores anywhere yet). */
export function overallAverage(s: School): number | null {
  if (!s.grades.length) return null
  let sum = 0
  let n = 0
  for (const name of gradeSubjects(s)) {
    const c = report(s, name).current
    if (c === null) continue
    sum += c
    n++
  }
  return n ? sum / n : null
}

/** The grade you're aiming for in `subject`, if you set one. */
export const targetOf = (s: School, subject: string) => findSubject(s, subject)?.target

// ---- Typing a score ----

/**
 * Reads a score as typed: "18/20", "18 / 20", "18 out of 20", "18 of 20", "85%", or a plain "85" (out of 100,
 * or out of `defaultMax`). Commas work as decimal points too. Null when it can't be read.
 */
export function parseScore(text: string, defaultMax = 100): { score: number; max: number } | null {
  const t = text.trim().toLowerCase().replace(/,/g, '.')
  if (!t) return null
  const n = '(-?\\d+(?:\\.\\d+)?|-?\\.\\d+)'
  const pair = t.match(new RegExp(`^${n}\\s*(?:/|out of|of)\\s*${n}$`))
  if (pair) {
    const score = Number(pair[1])
    const max = Number(pair[2])
    return max > 0 && Math.abs(score) <= max * 10 ? { score, max } : null
  }
  const pct = t.match(new RegExp(`^${n}\\s*%$`))
  if (pct) {
    const score = Number(pct[1])
    return Math.abs(score) <= 1000 ? { score, max: 100 } : null
  }
  const plain = t.match(new RegExp(`^${n}$`))
  if (plain) {
    const score = Number(plain[1])
    return defaultMax > 0 && Math.abs(score) <= defaultMax * 10 ? { score, max: defaultMax } : null
  }
  return null
}

/** "18 / 20", "92.5 / 100" */
export const scoreText = (g: Pick<Grade, 'score' | 'max'>) => `${trim(g.score)} / ${trim(g.max)}`
/** How a score reads back in the box when editing it: "18/20". */
export const scoreInput = (g: Pick<Grade, 'score' | 'max'>) => `${trim(g.score)}/${trim(g.max)}`
const trim = (n: number) => String(Math.round(n * 100) / 100)

/** "92.4%", or "92%" with `short`. */
export const fmtPct = (n: number | null, short = false) => (n === null ? '—' : `${short ? Math.round(n) : Math.round(n * 10) / 10}%`)

/** A name for the next score in a part: "Quizzes" with 2 already → "Quiz 3". */
export function nextTitle(cat: GradeCategory | undefined, count: number) {
  if (!cat) return `Score ${count + 1}`
  const n = cat.name.trim()
  const one = /ies$/i.test(n) ? n.replace(/ies$/i, 'y') : /(ss|us)$/i.test(n) ? n : /s$/i.test(n) ? n.replace(/s$/i, '') : n
  // Quizzes → Quiz, Classes → Class
  const fixed = /zze$/i.test(one) ? one.slice(0, -2) : /sse$/i.test(one) ? one.slice(0, -1) : one
  return `${fixed} ${count + 1}`
}

// ---- Changes (each returns a new School) ----

export type GradeInput = { subject: string; cat: string; title: string; score: number; max: number; date: string }

export function addGrade(s: School, d: GradeInput): { school: School; id: string } {
  const base = rememberSubject(s, d.subject)
  const g: Grade = {
    id: uid(),
    subject: findSubject(base, d.subject)?.name ?? d.subject.trim().slice(0, MAX_SUBJECT),
    cat: d.cat,
    title: d.title.trim().slice(0, MAX_GRADE_TITLE),
    score: d.score,
    max: d.max,
    date: isDate(d.date) ? d.date : todayKey(),
    createdAt: Date.now(),
  }
  return { school: { ...base, grades: [...base.grades, g] }, id: g.id }
}

export const updateGrade = (s: School, id: string, patch: Partial<Omit<Grade, 'id' | 'subject' | 'createdAt'>>): School => ({
  ...s,
  grades: s.grades.map((g) =>
    g.id === id
      ? {
          ...g,
          ...patch,
          title: patch.title === undefined ? g.title : patch.title.trim().slice(0, MAX_GRADE_TITLE),
          date: patch.date && isDate(patch.date) ? patch.date : g.date,
        }
      : g,
  ),
})

export const removeGrades = (s: School, ids: string[]): School => {
  const gone = new Set(ids)
  return { ...s, grades: s.grades.filter((g) => !gone.has(g.id)) }
}

export function addCategory(s: School, subject: string, name: string, weight: number): { school: School; id: string } {
  const base = rememberSubject(s, subject)
  const c: GradeCategory = {
    id: uid(),
    subject: findSubject(base, subject)?.name ?? subject.trim().slice(0, MAX_SUBJECT),
    name: name.trim().slice(0, MAX_CATEGORY) || 'Untitled',
    weight: clampWeight(weight),
  }
  // A subject's first part takes in the scores it already had, so nothing drops out of its grade.
  const first = !subjectCats(base, subject).length
  const grades = first ? base.grades.map((g) => (same(g.subject, subject) && !g.cat ? { ...g, cat: c.id } : g)) : base.grades
  return { school: { ...base, gradeCats: [...base.gradeCats, c], grades }, id: c.id }
}

const clampWeight = (w: number) => (Number.isFinite(w) ? Math.min(1000, Math.max(0, Math.round(w * 100) / 100)) : 0)

export const updateCategory = (s: School, id: string, patch: Partial<Pick<GradeCategory, 'name' | 'weight' | 'drop'>>): School => ({
  ...s,
  gradeCats: s.gradeCats.map((c) => {
    if (c.id !== id) return c
    const next: GradeCategory = { ...c }
    if (patch.name !== undefined) next.name = patch.name.trim().slice(0, MAX_CATEGORY) || c.name
    if (patch.weight !== undefined) next.weight = clampWeight(patch.weight)
    if (patch.drop !== undefined) {
      const d = Math.max(0, Math.min(99, Math.round(patch.drop)))
      if (d) next.drop = d
      else delete next.drop
    }
    return next
  }),
})

export function moveCategory(s: School, id: string, by: -1 | 1): School {
  const c = s.gradeCats.find((x) => x.id === id)
  if (!c) return s
  const mine = subjectCats(s, c.subject)
  const i = mine.indexOf(c)
  const other = mine[i + by]
  if (!other) return s
  const list = [...s.gradeCats]
  const a = list.indexOf(c)
  const b = list.indexOf(other)
  ;[list[a], list[b]] = [list[b], list[a]]
  return { ...s, gradeCats: list }
}

/** Deletes a part. Its scores move to part `to`, or are deleted with it when `to` is null. */
export function removeCategory(s: School, id: string, to: string | null): School {
  return {
    ...s,
    gradeCats: s.gradeCats.filter((c) => c.id !== id),
    grades: to === null ? s.grades.filter((g) => g.cat !== id) : s.grades.map((g) => (g.cat === id ? { ...g, cat: to } : g)),
  }
}

/** Sets up a subject's parts in one go (from a template). Scores keep their place when a part with the same name remains. */
export function setCategories(s: School, subject: string, parts: { name: string; weight: number }[]): School {
  let next = s
  for (const p of parts) next = addCategory(next, subject, p.name, p.weight).school
  return next
}

export function setTarget(s: School, subject: string, target: number | null): School {
  const base = rememberSubject(s, subject)
  return {
    ...base,
    subjects: base.subjects.map((x) => {
      if (!same(x.name, subject)) return x
      const next = { ...x }
      if (target && target > 0) next.target = Math.min(1000, Math.round(target * 100) / 100)
      else delete next.target
      return next
    }),
  }
}

/** Deletes everything on the Grades page for one subject (its parts and scores). */
export const clearSubjectGrades = (s: School, subject: string): School => ({
  ...s,
  gradeCats: s.gradeCats.filter((c) => !same(c.subject, subject)),
  grades: s.grades.filter((g) => !same(g.subject, subject)),
})

/** Ready-made ways a grade is often split up. */
export const TEMPLATES: { id: string; label: string; parts: { name: string; weight: number }[] }[] = [
  {
    id: 'classic',
    label: 'Quizzes · Assignments · Midterm · Final',
    parts: [
      { name: 'Quizzes', weight: 20 },
      { name: 'Assignments', weight: 20 },
      { name: 'Midterm exam', weight: 25 },
      { name: 'Final exam', weight: 35 },
    ],
  },
  {
    id: 'lab',
    label: 'Lecture · Lab · Exams',
    parts: [
      { name: 'Quizzes', weight: 15 },
      { name: 'Lab work', weight: 30 },
      { name: 'Project', weight: 20 },
      { name: 'Exams', weight: 35 },
    ],
  },
  {
    id: 'written',
    label: 'Written · Performance · Exam',
    parts: [
      { name: 'Written works', weight: 30 },
      { name: 'Performance tasks', weight: 50 },
      { name: 'Quarterly exam', weight: 20 },
    ],
  },
]
