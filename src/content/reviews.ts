/**
 * ★ REVIEWS on the About page ★
 *
 * Add one { ... } per review inside the list below, then save. They slide across the About page on their own.
 * - name:   who wrote it (required)
 * - text:   what they said (required; one to three sentences reads best)
 * - role:   a few words under the name, e.g. "Student · Manila" (optional)
 * - stars:  1 to 5 (optional, 5 if left out)
 * - photo:  link to a picture of them (optional; their first letter is shown otherwise)
 *
 * Only add real reviews from real people, with their permission.
 * The Reviews section stays hidden on the live site until there is at least one review here
 * (while you work on the site locally, a few labeled examples show instead so you can see how it looks).
 *
 * Example (copy, paste above the closing bracket and change it):
 *
 *   {
 *     name: 'Maria Santos',
 *     role: 'Nurse · Cebu',
 *     text: 'I finally know exactly when I can afford my first condo. Seeing it month by month changed everything.',
 *     stars: 5,
 *   },
 */
export const REVIEWS: Review[] = [
  // ← your reviews go here
]

export type Review = {
  name: string
  text: string
  role?: string
  stars?: 1 | 2 | 3 | 4 | 5
  photo?: string
}

/** Only shown while developing locally, when REVIEWS above is empty, so the slider can be seen. Never on the live site. */
export const EXAMPLE_REVIEWS: Review[] = [
  { name: 'Example reviewer', role: 'Shown only while developing', text: 'Your real reviews will slide here. Add them in src/content/reviews.ts.' },
  { name: 'Example reviewer', role: 'Shown only while developing', text: 'Each card shows the name, a short line about them, their stars and what they said.', stars: 5 },
  { name: 'Example reviewer', role: 'Shown only while developing', text: 'The row keeps moving on its own and pauses when someone hovers over it to read.', stars: 4 },
  { name: 'Example reviewer', role: 'Shown only while developing', text: 'With six or more reviews, a second row slides the other way.' },
]
