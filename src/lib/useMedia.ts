import { useSyncExternalStore } from 'react'

/** True while the CSS media query matches, e.g. useMedia('(max-width: 639px)'). */
export function useMedia(query: string) {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

/** Phone-sized screen (below Tailwind's `sm` breakpoint). */
export const useIsPhone = () => useMedia('(max-width: 639px)')
