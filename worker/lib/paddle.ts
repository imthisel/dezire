/**
 * Calls to Paddle's API with PADDLE_API_KEY (server only). Sandbox and live are separate Paddle accounts with separate
 * keys; VITE_PADDLE_ENV=sandbox (the same setting the checkout uses) points the server at the sandbox API.
 */
export const paddleSandbox = () => process.env.VITE_PADDLE_ENV === 'sandbox'
const base = () => (paddleSandbox() ? 'https://sandbox-api.paddle.com' : 'https://api.paddle.com')

export class PaddleError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function paddle<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const key = process.env.PADDLE_API_KEY ?? ''
  if (!key) throw new PaddleError(503, 'PADDLE_API_KEY is not set')
  const res = await fetch(`${base()}${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined,
    signal: AbortSignal.timeout(10_000),
  })
  const body = (await res.json().catch(() => ({}))) as { data?: T; error?: { code?: string; detail?: string } }
  if (!res.ok || !body.data) throw new PaddleError(res.status, `Paddle API ${path}: ${body.error?.code ?? res.status} ${body.error?.detail ?? ''}`.trim())
  return body.data
}

/** Paddle ids: a prefix like ctm_ or sub_ and letters/digits, so one can't change the API path it's put into. */
export const paddleId = (v: unknown, prefix: string): v is string => typeof v === 'string' && new RegExp(`^${prefix}_[a-z0-9]{10,64}$`).test(v)
