import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { finishGoogleRedirect } from '../googleRedirect'

/** /auth: shown for a moment while a phone's Google sign-in is finished, before going back to where it started. */
export function SigningIn() {
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    void finishGoogleRedirect().then(setError)
  }, [])
  return (
    <main className="grid min-h-svh place-items-center bg-[#07080c] px-6 text-center">
      <div>
        {error ? (
          <p className="text-[15px] text-zinc-300">{error}</p>
        ) : (
          <p className="inline-flex items-center gap-2.5 text-[15px] text-zinc-300">
            <Loader2 className="h-4 w-4 animate-spin text-brand-300" /> Signing you in…
          </p>
        )}
      </div>
    </main>
  )
}
