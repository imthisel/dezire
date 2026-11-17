/**
 * Who runs Dizayr, for the Terms, Privacy and Refund pages (/terms, /privacy, /refunds) and the footer.
 * Paddle checks these pages before approving the live account, so keep them true: the name must be the legal name on
 * your Paddle account, and the email must be one you read.
 */
export const LEGAL = {
  /** Your legal name (or registered business name), exactly as on your Paddle account. */
  operator: 'Zion Angeles',
  /** Where you're based. Also the law the Terms follow. */
  country: 'the Philippines',
  /** Where customers can reach you about billing, refunds and their data. */
  email: 'dizayrofficial@gmail.com',
  /** The date these pages last changed. Update it whenever you change their wording. */
  updated: 'November 17, 2026',
  /** Days after any payment in which a full refund is given, no questions asked. Paddle expects at least 14. */
  refundDays: 14,
} as const

export const LEGAL_PAGES = {
  '/terms': 'terms',
  '/privacy': 'privacy',
  '/refunds': 'refunds',
} as const

export type LegalPage = (typeof LEGAL_PAGES)[keyof typeof LEGAL_PAGES]

/** The legal page at this address, if it is one. */
export const legalPageAt = (path: string): LegalPage | null => LEGAL_PAGES[path.replace(/\/$/, '') as keyof typeof LEGAL_PAGES] ?? null
