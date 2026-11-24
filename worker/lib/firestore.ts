import { accessToken, GoogleError, type ServiceAccount } from './google'

/**
 * Firestore through its REST API, with only fetch and Web Crypto, so it runs on Cloudflare Workers (firebase-admin needs
 * Node features Workers don't have). The same shape as the parts of firebase-admin the server uses:
 * collection / doc / get / set (with merge) / update / delete / add, where('==') / orderBy / limit / select,
 * runTransaction, FieldValue (serverTimestamp, delete, increment, arrayUnion) and Timestamp.
 * Only top-level collections and top-level field names, which is all the server needs.
 *
 * FIRESTORE_EMULATOR_HOST (e.g. 127.0.0.1:8080) points it at the local Firestore emulator, for testing only.
 */

// ---------------------------------------------------------------- values

export class Timestamp {
  constructor(
    readonly seconds: number,
    readonly nanoseconds: number,
  ) {}
  static fromMillis(ms: number) {
    const s = Math.floor(ms / 1000)
    return new Timestamp(s, Math.round((ms - s * 1000) * 1e6))
  }
  static fromDate(d: Date) {
    return Timestamp.fromMillis(d.getTime())
  }
  static now() {
    return Timestamp.fromMillis(Date.now())
  }
  /** From Firestore's RFC 3339 text, keeping up to nanoseconds. */
  static parse(s: string) {
    const fraction = /\.(\d+)Z$/.exec(s)?.[1] ?? ''
    const ms = Date.parse(s.replace(/\.\d+Z$/, 'Z'))
    return new Timestamp(Math.floor(ms / 1000), Number(fraction.padEnd(9, '0').slice(0, 9)) || 0)
  }
  toMillis() {
    return this.seconds * 1000 + Math.floor(this.nanoseconds / 1e6)
  }
  toDate() {
    return new Date(this.toMillis())
  }
  toRfc3339() {
    return new Date(this.seconds * 1000).toISOString().replace(/\.\d{3}Z$/, `.${String(this.nanoseconds).padStart(9, '0')}Z`)
  }
}

class Sentinel {
  constructor(
    readonly kind: 'serverTimestamp' | 'delete' | 'increment' | 'arrayUnion',
    readonly arg: unknown[] = [],
  ) {}
}

export const FieldValue = {
  serverTimestamp: () => new Sentinel('serverTimestamp'),
  delete: () => new Sentinel('delete'),
  increment: (n: number) => new Sentinel('increment', [n]),
  arrayUnion: (...values: unknown[]) => new Sentinel('arrayUnion', values),
}

type Value = Record<string, unknown>
type Fields = Record<string, Value>

function encode(v: unknown): Value {
  if (v === null || v === undefined) return { nullValue: null }
  if (typeof v === 'boolean') return { booleanValue: v }
  if (typeof v === 'number') return Number.isSafeInteger(v) ? { integerValue: String(v) } : { doubleValue: Number.isFinite(v) ? v : String(v) }
  if (typeof v === 'string') return { stringValue: v }
  if (v instanceof Timestamp) return { timestampValue: v.toRfc3339() }
  if (v instanceof Date) return { timestampValue: Timestamp.fromDate(v).toRfc3339() }
  if (v instanceof Sentinel) throw new Error(`FieldValue.${v.kind}() can only be a top-level field`)
  if (Array.isArray(v)) return { arrayValue: { values: v.map(encode) } }
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(v as Record<string, unknown>) } }
  throw new Error(`Can't store a ${typeof v} in Firestore`)
}

/** Fields that are undefined are left out (firebase-admin would refuse the whole write). */
function encodeFields(o: Record<string, unknown>): Fields {
  const out: Fields = {}
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[k] = encode(v)
  return out
}

function decode(v: Value): unknown {
  if ('nullValue' in v) return null
  if ('booleanValue' in v) return v.booleanValue as boolean
  if ('integerValue' in v) return Number(v.integerValue)
  if ('doubleValue' in v) return Number(v.doubleValue)
  if ('stringValue' in v) return v.stringValue as string
  if ('timestampValue' in v) return Timestamp.parse(v.timestampValue as string)
  if ('arrayValue' in v) return ((v.arrayValue as { values?: Value[] }).values ?? []).map(decode)
  if ('mapValue' in v) return decodeFields((v.mapValue as { fields?: Fields }).fields ?? {})
  if ('referenceValue' in v) return v.referenceValue as string
  if ('bytesValue' in v) return v.bytesValue as string
  if ('geoPointValue' in v) return v.geoPointValue
  return null
}

const decodeFields = (f: Fields) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, decode(v)]))

/** A top-level field name as a Firestore field path (names that aren't plain identifiers go in backticks). */
const fieldPath = (k: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(k) ? k : '`' + k.replace(/\\/g, '\\\\').replace(/`/g, '\\`') + '`')

type Mode = 'replace' | 'merge' | 'update' | 'create'

/** One write for :commit. Sentinels become field transforms (or, for delete, a masked-out field). */
function writeOf(name: string, data: Record<string, unknown>, mode: Mode) {
  const fields: Fields = {}
  const mask: string[] = []
  const transforms: Record<string, unknown>[] = []
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined) continue
    const path = fieldPath(k)
    if (v instanceof Sentinel) {
      if (v.kind === 'delete') {
        if (mode === 'replace' || mode === 'create') throw new Error('FieldValue.delete() needs set(…, { merge: true }) or update()')
        mask.push(path)
      } else if (v.kind === 'serverTimestamp') transforms.push({ fieldPath: path, setToServerValue: 'REQUEST_TIME' })
      else if (v.kind === 'increment') transforms.push({ fieldPath: path, increment: encode(v.arg[0]) })
      else transforms.push({ fieldPath: path, appendMissingElements: { values: v.arg.map(encode) } })
      continue
    }
    fields[k] = encode(v)
    mask.push(path)
  }
  const write: Record<string, unknown> = { update: { name, fields } }
  if (mode === 'merge' || mode === 'update') write.updateMask = { fieldPaths: mask }
  if (mode === 'update') write.currentDocument = { exists: true }
  if (mode === 'create') write.currentDocument = { exists: false }
  if (transforms.length) write.updateTransforms = transforms
  return write
}

// ---------------------------------------------------------------- documents and queries

export class DocumentSnapshot {
  constructor(
    readonly ref: DocumentReference,
    private readonly fields: Fields | null,
  ) {}
  get id() {
    return this.ref.id
  }
  get exists() {
    return this.fields !== null
  }
  data(): Record<string, unknown> | undefined {
    return this.fields ? decodeFields(this.fields) : undefined
  }
  get(field: string): unknown {
    const v = this.fields?.[field]
    return v === undefined ? undefined : decode(v)
  }
}

/** A document a query found: it always exists. */
export class QueryDocumentSnapshot extends DocumentSnapshot {
  override data(): Record<string, unknown> {
    return super.data() ?? {}
  }
}

type Db = ReturnType<typeof firestore>

export class DocumentReference {
  constructor(
    private readonly db: Db,
    readonly collection: string,
    readonly id: string,
  ) {
    if (!id || id.includes('/')) throw new Error('Bad document id')
  }
  get name() {
    return `${this.db.root}/${this.collection}/${this.id}`
  }
  async get() {
    return (await this.db.getAll([this]))[0]
  }
  set(data: Record<string, unknown>, options: { merge?: boolean } = {}) {
    return this.db.commit([writeOf(this.name, data, options.merge ? 'merge' : 'replace')])
  }
  /** Fails when the document doesn't exist, like firebase-admin. */
  update(data: Record<string, unknown>) {
    return this.db.commit([writeOf(this.name, data, 'update')])
  }
  create(data: Record<string, unknown>) {
    return this.db.commit([writeOf(this.name, data, 'create')])
  }
  delete() {
    return this.db.commit([{ delete: this.name }])
  }
}

type Query = { where?: { field: string; value: unknown }; orderBy?: { field: string; desc: boolean }; limit?: number; select?: string[] }

export class CollectionReference {
  constructor(
    private readonly db: Db,
    readonly id: string,
    private readonly q: Query = {},
  ) {}
  doc(id: string) {
    return new DocumentReference(this.db, this.id, id)
  }
  /** A new document with a random id, like firebase-admin's add. */
  async add(data: Record<string, unknown>) {
    const ref = this.doc(autoId())
    await ref.create(data)
    return ref
  }
  where(field: string, op: '==', value: unknown) {
    if (op !== '==') throw new Error('Only == is supported')
    return new CollectionReference(this.db, this.id, { ...this.q, where: { field, value } })
  }
  orderBy(field: string, direction: 'asc' | 'desc' = 'asc') {
    return new CollectionReference(this.db, this.id, { ...this.q, orderBy: { field, desc: direction === 'desc' } })
  }
  limit(n: number) {
    return new CollectionReference(this.db, this.id, { ...this.q, limit: n })
  }
  select(...fields: string[]) {
    return new CollectionReference(this.db, this.id, { ...this.q, select: fields })
  }
  async get(): Promise<{ docs: QueryDocumentSnapshot[]; empty: boolean; size: number }> {
    const { where, orderBy, limit, select } = this.q
    const structuredQuery: Record<string, unknown> = { from: [{ collectionId: this.id }] }
    if (where) structuredQuery.where = { fieldFilter: { field: { fieldPath: fieldPath(where.field) }, op: 'EQUAL', value: encode(where.value) } }
    if (orderBy) structuredQuery.orderBy = [{ field: { fieldPath: fieldPath(orderBy.field) }, direction: orderBy.desc ? 'DESCENDING' : 'ASCENDING' }]
    if (limit !== undefined) structuredQuery.limit = limit
    if (select) structuredQuery.select = { fields: (select.length ? select.map(fieldPath) : ['__name__']).map((f) => ({ fieldPath: f })) }
    const rows = await this.db.call<{ document?: { name: string; fields?: Fields } }[]>(':runQuery', { structuredQuery })
    const docs = rows
      .filter((r) => r.document)
      .map((r) => new QueryDocumentSnapshot(this.doc(r.document!.name.split('/').pop()!), r.document!.fields ?? {}))
    return { docs, empty: !docs.length, size: docs.length }
  }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
function autoId() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  // 62 × 4 = 248: bytes from 248 up are re-drawn so every letter is equally likely.
  let out = ''
  for (const b of bytes) out += b < 248 ? ID_CHARS[b % 62] : ID_CHARS[crypto.getRandomValues(new Uint8Array(1))[0] % 62]
  return out
}

export type Transaction = {
  get(ref: DocumentReference): Promise<DocumentSnapshot>
  set(ref: DocumentReference, data: Record<string, unknown>, options?: { merge?: boolean }): void
  update(ref: DocumentReference, data: Record<string, unknown>): void
  delete(ref: DocumentReference): void
}

// ---------------------------------------------------------------- the client

export function firestore(sa: ServiceAccount) {
  const emulator = process.env.FIRESTORE_EMULATOR_HOST
  const root = `projects/${sa.project_id}/databases/(default)/documents`
  const base = `${emulator ? `http://${emulator}` : 'https://firestore.googleapis.com'}/v1/${root}`

  async function call<T>(path: string, body: unknown): Promise<T> {
    if (!sa.project_id) throw new GoogleError('firestore/no-project', 'FIREBASE_SERVICE_ACCOUNT has no project_id')
    const res = await fetch(base + path, {
      method: 'POST',
      headers: { Authorization: `Bearer ${emulator ? 'owner' : await accessToken(sa)}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15_000),
    })
    const out = (await res.json().catch(() => ({}))) as T & { error?: { status?: string; message?: string } }
    if (!res.ok) {
      const e = (Array.isArray(out) ? out[0]?.error : out.error) as { status?: string; message?: string } | undefined
      throw new GoogleError(`firestore/${(e?.status ?? String(res.status)).toLowerCase()}`, `Firestore: ${e?.status ?? res.status} ${e?.message ?? ''}`.trim(), res.status)
    }
    return out
  }

  async function getAll(refs: DocumentReference[], transaction?: string) {
    const rows = await call<{ found?: { name: string; fields?: Fields }; missing?: string }[]>(':batchGet', {
      documents: refs.map((r) => r.name),
      ...(transaction ? { transaction } : {}),
    })
    const byName = new Map<string, Fields | null>()
    for (const r of rows) {
      if (r.found) byName.set(r.found.name, r.found.fields ?? {})
      else if (r.missing) byName.set(r.missing, null)
    }
    return refs.map((r) => new DocumentSnapshot(r, byName.get(r.name) ?? null))
  }

  const commit = async (writes: unknown[], transaction?: string) => {
    await call(':commit', { writes, ...(transaction ? { transaction } : {}) })
  }

  const db = {
    root,
    call,
    getAll,
    commit,
    collection: (id: string): CollectionReference => new CollectionReference(db, id),
    /**
     * Reads, then writes all at once, retried (up to 5 times) when another change got in between,
     * like firebase-admin's runTransaction: `fn` may run more than once.
     */
    async runTransaction<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
      for (let attempt = 1; ; attempt++) {
        const { transaction } = await call<{ transaction: string }>(':beginTransaction', { options: { readWrite: {} } })
        const writes: unknown[] = []
        const tx: Transaction = {
          get: async (ref) => (await getAll([ref], transaction))[0],
          set: (ref, data, options = {}) => void writes.push(writeOf(ref.name, data, options.merge ? 'merge' : 'replace')),
          update: (ref, data) => void writes.push(writeOf(ref.name, data, 'update')),
          delete: (ref) => void writes.push({ delete: ref.name }),
        }
        let result: T
        try {
          result = await fn(tx)
        } catch (e) {
          await call(':rollback', { transaction }).catch(() => {})
          throw e
        }
        try {
          await commit(writes, transaction)
          return result
        } catch (e) {
          // ABORTED: another change to the same documents came first. Start again with fresh reads.
          if (e instanceof GoogleError && e.code === 'firestore/aborted' && attempt < 5) continue
          throw e
        }
      }
    },
  }
  return db
}
