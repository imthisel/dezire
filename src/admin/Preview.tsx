import { useEffect, useState } from 'react'
import { ArrowLeft, Eye, Loader2 } from 'lucide-react'
import { Planner } from '../App'
import { useStore } from '../store'
import { currentYear } from '../lib/time'
import { api, errorText, type UserDetail } from './api'
import { displayName } from './data'
import { Avatar, Button } from './ui'
import { go } from './router'

/**
 * Someone's planner exactly as they see it, with their data. It's a copy in memory only: the store doesn't save
 * anywhere on the admin page (see AdminApp) and cloud sync never runs here, so nothing you click changes their account.
 */
export function Preview({ uid }: { uid: string }) {
  const [user, setUser] = useState<UserDetail | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let live = true
    api
      .get<{ user: UserDetail }>('user', { uid })
      .then(({ user }) => {
        if (!live) return
        if (!user.data) return setError('This person hasn’t saved a plan yet.')
        const s = useStore.getState()
        s.resetAll()
        const r = s.importData(user.data)
        if (!r.ok) return setError(r.error)
        useStore.setState({ view: 'planner', year: currentYear(), modal: null, sidebar: true })
        setUser(user)
      })
      .catch((e) => live && setError(errorText(e)))
    return () => {
      live = false
      // Don't leave their data in memory once you leave.
      useStore.getState().resetAll()
    }
  }, [uid])

  const back = () => go(`/admin/users/${uid}`)

  if (error)
    return (
      <div className="grid min-h-screen place-items-center px-4">
        <div className="text-center">
          <p className="text-sm text-zinc-300">{error}</p>
          <Button className="mt-4" icon={ArrowLeft} onClick={back}>
            Back
          </Button>
        </div>
      </div>
    )
  if (!user)
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" /> Opening their planner…
        </p>
      </div>
    )

  return (
    <>
      <Planner />
      {/* Always on top: whose plan this is, and the way back */}
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4 sm:bottom-6">
        <div className="animate-rise pointer-events-auto flex items-center gap-3 rounded-2xl border border-amber-400/30 bg-[#14110a]/95 py-2 pl-2 pr-2 shadow-2xl shadow-black/60 backdrop-blur-xl">
          <Avatar url={user.photo} name={displayName(user)} size="h-8 w-8" />
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-[13px] font-semibold text-amber-100">
              <Eye className="h-3.5 w-3.5" /> Viewing {displayName(user)}’s planner
            </p>
            <p className="truncate text-xs text-amber-200/60">Read-only preview · nothing you change is saved</p>
          </div>
          <Button size="sm" tone="primary" icon={ArrowLeft} onClick={back} className="ml-2">
            Exit
          </Button>
        </div>
      </div>
    </>
  )
}
