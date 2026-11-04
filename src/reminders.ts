import { useEffect } from 'react'
import { useStore } from './store'
import { addDays, todayKey } from './lib/expenses'
import { fmtTime, isEvent, nowMinutes, occurrencesIn } from './lib/tasks'
import { downloadBackup } from './backup'
import { toast } from './toast'

/**
 * Reminders before timed events and tasks. They run in the app, so they come while it's open (even in the background),
 * not when it's closed. Sending them with the app closed would need a push server, which Dizayr doesn't have.
 */

const SENT_KEY = 'dizayr-reminders-sent'
const CHECK_EVERY = 20_000
const DAY = 86_400_000

export const notificationsSupported = () => typeof Notification !== 'undefined'

/** Shows a system notification, or returns false when it can't. */
async function systemNotice(title: string, body: string, tag: string) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false
  try {
    // Phones only allow notifications through the service worker.
    const sw = await navigator.serviceWorker?.getRegistration().catch(() => undefined)
    if (sw) await sw.showNotification(title, { body, tag, icon: '/icon-192.png', badge: '/icon-192.png' })
    else new Notification(title, { body, tag, icon: '/icon-192.png' })
    return true
  } catch {
    return false
  }
}

/** A system notification when the app isn't on screen; a message inside it when it is (or when notifications aren't allowed). */
async function remind(title: string, body: string, tag: string) {
  if (document.visibilityState === 'visible' || !(await systemNotice(title, body, tag))) toast.info(`${title} · ${body}`)
}

/** Asks for permission if it hasn't been answered yet. Returns the answer. */
export async function askNotifications(): Promise<NotificationPermission | 'unsupported'> {
  if (!notificationsSupported()) return 'unsupported'
  if (Notification.permission !== 'default') return Notification.permission
  return Notification.requestPermission()
}

/** Settings' "Send a test" button: always goes through the system when allowed, so you can see it works. */
export async function sendTestNotice() {
  const sent = await systemNotice('Dizayr reminder', 'This is how your reminders will look.', 'dizayr-test')
  if (sent) toast.success('Test notification sent.')
  else toast.info('This is how a reminder looks inside the app. Allow notifications to get them outside it too.')
}

function readSent(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(SENT_KEY) ?? '{}') as Record<string, number>
  } catch {
    return {}
  }
}

/** Anything starting within the lead time that hasn't been reminded about yet. */
function check() {
  const { tasks, device } = useStore.getState()
  if (!device.reminders) return
  const today = todayKey()
  const now = nowMinutes()
  const sent = readSent()
  let changed = false
  // Tomorrow too: 11:55 PM can be 15 minutes before something at 12:10 AM.
  for (const o of occurrencesIn(tasks, today, addDays(today, 1))) {
    if (o.done || o.task.start == null) continue
    const left = o.task.start + (o.day === today ? 0 : 1440) - now
    if (left < 0 || left > device.reminderLead) continue
    const key = `${o.task.id}:${o.day}`
    if (sent[key]) continue
    sent[key] = Date.now()
    changed = true
    const when = left === 0 ? 'Now' : left < 60 ? `In ${left} min` : `In ${Math.floor(left / 60)}h${left % 60 ? ` ${left % 60}m` : ''}`
    void remind(o.task.title, `${when} · ${isEvent(o.task) ? '' : 'due '}${fmtTime(o.task.start, true)}`, key)
  }
  if (!changed) return
  // Forget old ones, so this stays small.
  for (const k of Object.keys(sent)) if (Date.now() - sent[k] > 3 * DAY) delete sent[k]
  try {
    localStorage.setItem(SENT_KEY, JSON.stringify(sent))
  } catch {
    // Could repeat a reminder after a reload; harmless.
  }
}

/** Runs while signed in (not on the admin page's preview of someone else's plan). */
export function useBackgroundJobs() {
  const on = useStore((s) => s.device.reminders)
  useEffect(() => {
    if (!on) return
    check()
    const timer = setInterval(check, CHECK_EVERY)
    document.addEventListener('visibilitychange', check)
    return () => {
      clearInterval(timer)
      document.removeEventListener('visibilitychange', check)
    }
  }, [on])

  // Backup reminder, once when the app opens.
  useEffect(() => {
    const { backupEvery, lastBackup } = useStore.getState().device
    if (!backupEvery || (lastBackup && Date.now() - lastBackup < backupEvery * DAY)) return
    const timer = setTimeout(() => toast.action(lastBackup ? 'It’s time for a new backup of your plan.' : 'You haven’t downloaded a backup of your plan yet.', 'Download', downloadBackup), 2500)
    return () => clearTimeout(timer)
  }, [])
}
