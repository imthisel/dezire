import { useId } from 'react'

/** The Dizayr mark (also public/logo.svg and favicon.svg). Drawn inline so it's sharp at any size and needs no download. */
const MARK =
  'M77.96 48.53 L77.92 47.79 L77.77 46.33 L77.56 44.87 L77.27 43.43 L77.10 42.71 L76.91 42.00 L76.49 40.59 L76.25 39.89 L75.72 38.52 L75.43 37.84 L74.80 36.51 L74.10 35.21 L73.35 33.95 L72.94 33.33 L72.10 32.13 L71.65 31.54 L70.72 30.40 L69.73 29.31 L69.21 28.79 L68.15 27.77 L67.60 27.28 L67.03 26.81 L65.87 25.90 L64.67 25.06 L63.42 24.27 L62.79 23.90 L61.49 23.20 L60.83 22.88 L59.48 22.28 L58.11 21.75 L56.71 21.29 L55.29 20.90 L53.85 20.58 L52.40 20.32 L50.94 20.14 L50.21 20.08 L48.74 20.01 L24.78 20.01 L24.34 20.07 L23.99 20.18 L23.65 20.32 L23.33 20.51 L23.04 20.73 L22.73 21.04 L22.51 21.33 L22.29 21.72 L22.15 22.06 L22.07 22.34 L22.01 22.71 L22.00 23.00 L22.00 71.28 L46.21 47.08 L40.37 41.24 L63.00 37.00 L58.76 59.63 L52.92 53.79 L26.72 80.00 L48.00 80.00 L49.47 79.96 L50.21 79.92 L51.67 79.77 L53.13 79.56 L54.57 79.27 L56.00 78.91 L57.41 78.49 L58.11 78.25 L59.48 77.72 L60.83 77.12 L62.14 76.46 L63.42 75.73 L64.67 74.94 L65.27 74.53 L65.87 74.10 L67.03 73.19 L67.60 72.72 L68.69 71.73 L69.73 70.69 L70.72 69.60 L71.19 69.03 L72.10 67.87 L72.94 66.67 L73.35 66.05 L74.10 64.79 L74.46 64.14 L74.80 63.49 L75.43 62.16 L75.72 61.48 L76.25 60.11 L76.71 58.71 L76.91 58.00 L77.27 56.57 L77.56 55.13 L77.68 54.40 L77.77 53.67 L77.92 52.21 L77.99 50.74 L78.00 50.00 Z'

/** The logo: a blue rounded square with the white D. `className` sets its size (e.g. "h-9 w-9"). */
export function BrandLogo({ className = 'h-9 w-9', title }: { className?: string; title?: string }) {
  const id = `dz${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
  return (
    <svg viewBox="0 0 100 100" className={`shrink-0 ${className}`} role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8EA8FF" />
          <stop offset="0.6" stopColor="#3A6DF0" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="22.5" fill={`url(#${id})`} />
      <g transform="translate(7 7) scale(0.86)">
        <path fill="#FFFFFF" d={MARK} />
      </g>
    </svg>
  )
}
