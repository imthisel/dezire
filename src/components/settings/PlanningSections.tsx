import { useEffect, useState } from 'react'
import { AlertTriangle, BellRing, Check, Eraser, Globe, Loader2 } from 'lucide-react'
import { fmt, fmtAlt, plain } from '../../lib/money'
import { EVENT_LENGTHS, REMINDER_LEADS, type BackupEvery, type Clock, type WeekStart } from '../../lib/prefs'
import { fmtDuration, fmtTime } from '../../lib/tasks'
import { useMedia } from '../../lib/useMedia'
import { askNotifications, notificationsSupported, sendTestNotice } from '../../reminders'
import { useCurrency, useStore } from '../../store'
import { toast } from '../../toast'
import { CurrencyFields, Presets, RateInput, Switch } from '../CurrencyMenu'
import { PERIOD_KEY } from '../Expenses'
import { VIEW_KEY } from '../Schedule'
import { ActionRow, Button, Group, Row, Segmented, Select, ToggleRow } from './ui'

/** A choice the pages remember in this browser themselves (the calendar's view, the expense period). */
function useRemembered<T extends string>(key: string, fallback: T, encode: (v: T) => string, decode: (raw: string) => unknown, ok: (v: unknown) => boolean) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key)
      const v = raw === null ? null : decode(raw)
      return ok(v) ? (v as T) : fallback
    } catch {
      return fallback
    }
  })
  const set = (v: T) => {
    setValue(v)
    try {
      localStorage.setItem(key, encode(v))
    } catch {
      // Not remembered; fine.
    }
  }
  return [value, set] as const
}

type RateState = 'idle' | 'busy' | 'done'

/** Today's rate, from a free public service (it only learns which two currencies are being looked up). */
function useLiveRate() {
  const { main, alt } = useCurrency()
  const setAlt = useStore((s) => s.setAltCurrency)
  const [state, setState] = useState<RateState>('idle')
  useEffect(() => setState('idle'), [main.code, alt.code])

  async function fetchRate() {
    if (!navigator.onLine) return toast.info('You’re offline. Connect to the internet to get today’s rate.')
    if (main.code === alt.code) return toast.info('Both currencies are the same, so the rate is always 1.')
    setState('busy')
    try {
      const res = await fetch(`https://open.er-api.com/v6/latest/${encodeURIComponent(alt.code)}`)
      const data = (await res.json()) as { result?: string; rates?: Record<string, number> }
      const rate = data.rates?.[main.code]
      if (data.result !== 'success' || !(rate! > 0)) throw new Error('no rate')
      setAlt({ rate: Number(rate!.toPrecision(6)) })
      setState('done')
      toast.success(`Rate updated: 1 ${alt.code} = ${main.symbol}${plain(rate!)}.`)
    } catch {
      setState('idle')
      toast.error(`Couldn’t find a rate for ${alt.code} to ${main.code}. You can still type it in.`)
    }
  }
  return { state, fetchRate }
}

export function MoneySection() {
  const { main, alt } = useCurrency()
  const { setMainCurrency, setAltCurrency } = useStore.getState()
  const { state, fetchRate } = useLiveRate()
  const [period, setPeriod] = useRemembered<'week' | 'month' | 'year'>(PERIOD_KEY, 'month', (v) => v, (raw) => raw, (v) => v === 'week' || v === 'month' || v === 'year')
  useStore((s) => s.device.masked) // redraw the preview when amounts are hidden
  const sample = 100000

  return (
    <>
      <Group title="Main currency" hint="Everything is saved in this currency. Changing it only changes the sign, not the numbers.">
        <div id="set-main-currency" className="scroll-mt-4 space-y-3 p-4">
          <CurrencyFields value={main} onChange={setMainCurrency} accent="indigo" />
          <Presets value={main} onPick={setMainCurrency} accent="indigo" />
        </div>
      </Group>

      <Group title="Alternative currency" hint="A second currency to compare with, shown as ≈ amounts under each total.">
        <div id="set-alt-currency" className="flex scroll-mt-4 items-center justify-between gap-3 px-4 py-3.5">
          <div className="min-w-0">
            <p className="text-sm font-medium text-zinc-100">Show {alt.code} amounts</p>
            <p className="mt-0.5 text-[13px] text-zinc-500">{alt.show ? 'Shown everywhere' : 'Hidden everywhere'}</p>
          </div>
          <Switch on={alt.show} onChange={(show) => setAltCurrency({ show })} label={`Show ${alt.code} amounts`} />
        </div>
        {alt.show && (
          <div className="animate-fade space-y-3 p-4">
            <CurrencyFields value={alt} onChange={setAltCurrency} accent="emerald" />
            <Presets value={alt} onPick={setAltCurrency} accent="emerald" exclude={main.code} />
            <div id="set-rate" className="scroll-mt-4">
              <RateInput key={`${alt.code}-${main.code}`} />
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Button icon={state === 'busy' ? Loader2 : state === 'done' ? Check : Globe} onClick={() => void fetchRate()} disabled={state === 'busy'}>
                {state === 'busy' ? 'Getting the rate…' : state === 'done' ? 'Rate updated' : 'Use today’s rate'}
              </Button>
              <a href="https://www.exchangerate-api.com" target="_blank" rel="noreferrer" className="text-xs text-zinc-500 underline-offset-2 transition hover:text-zinc-300 hover:underline">
                Rates By Exchange Rate API
              </a>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.06] bg-gradient-to-r from-indigo-500/[0.08] to-emerald-500/[0.08] px-3 py-2.5">
              <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">Preview</span>
              <span className="truncate text-sm tabular-nums">
                <span className="font-semibold text-white">{fmt(sample, main.symbol)}</span>
                <span className="text-zinc-500"> ≈ </span>
                <span className="font-semibold text-emerald-300">{fmtAlt(sample, alt)}</span>
              </span>
            </div>
          </div>
        )}
      </Group>

      <Group title="Expenses">
        <Row id="expense-period" title="Expenses opens on" hint="Changes as you switch on the Expenses page, too.">
          <Segmented<'week' | 'month' | 'year'>
            label="Expenses opens on"
            value={period}
            onChange={setPeriod}
            options={[
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
              { id: 'year', label: 'Year' },
            ]}
          />
        </Row>
      </Group>
    </>
  )
}

type CalView = 'day' | '3day' | 'week' | 'month'

export function CalendarSection() {
  const prefs = useStore((s) => s.prefs)
  const setPrefs = useStore.getState().setPrefs
  const wide = useMedia('(min-width: 640px)')
  const [view, setView] = useRemembered<CalView>(VIEW_KEY, wide ? 'week' : '3day', (v) => JSON.stringify(v), (raw) => JSON.parse(raw), (v) => ['day', '3day', 'week', 'month'].includes(v as string))

  return (
    <>
      <Group title="Dates & times" hint="Also used for the weeks on your Expenses page.">
        <Row id="week-start" title="Week starts on">
          <Segmented<WeekStart>
            label="Week starts on"
            value={prefs.weekStart}
            onChange={(weekStart) => setPrefs({ weekStart })}
            options={[
              { id: 0, label: 'Sun' },
              { id: 1, label: 'Mon' },
              { id: 6, label: 'Sat' },
            ]}
          />
        </Row>
        <Row id="clock" title="Time format" hint={`3:30 in the afternoon shows as ${fmtTime(15 * 60 + 30)}.`}>
          <Segmented<Clock>
            label="Time format"
            value={prefs.clock}
            onChange={(clock) => setPrefs({ clock })}
            options={[
              { id: '12', label: '12-hour' },
              { id: '24', label: '24-hour' },
            ]}
          />
        </Row>
      </Group>

      <Group title="Events">
        <Row id="cal-view" title="Calendar opens on" hint="Changes as you switch on the Calendar page, too.">
          <Segmented<CalView>
            label="Calendar opens on"
            value={view}
            onChange={setView}
            options={[
              { id: 'day', label: 'Day' },
              { id: '3day', label: '3 days' },
              { id: 'week', label: 'Week' },
              { id: 'month', label: 'Month' },
            ]}
          />
        </Row>
        <Row id="event-length" title="Usual event length" hint="What a new event starts with.">
          <Select<number> label="Usual event length" value={prefs.eventLength} onChange={(eventLength) => setPrefs({ eventLength })} options={EVENT_LENGTHS.map((m) => ({ id: m, label: fmtDuration(m) }))} />
        </Row>
      </Group>
    </>
  )
}

export function NotificationsSection() {
  const device = useStore((s) => s.device)
  const budgetWarnings = useStore((s) => s.prefs.budgetWarnings)
  const { setDevice, setPrefs } = useStore.getState()
  const [permission, setPermission] = useState(() => (notificationsSupported() ? Notification.permission : 'unsupported'))

  async function setReminders(on: boolean) {
    setDevice({ reminders: on })
    if (!on) return
    const answer = await askNotifications()
    setPermission(answer)
    if (answer === 'granted') toast.success('Reminders are on.')
    else toast.info('Reminders are on inside the app. Allow notifications in your browser to get them outside it too.')
  }

  const blocked = permission === 'denied' || permission === 'unsupported'

  return (
    <>
      <Group title="Reminders" hint="They come while Dizayr is open, even in the background. They can’t reach you when it’s fully closed. On this device.">
        <ToggleRow id="reminders" title="Event & task reminders" hint="Before anything on your calendar with a time." on={device.reminders} onChange={(on) => void setReminders(on)} />
        {device.reminders && (
          <>
            <Row id="reminder-lead" title="Remind me" hint="How long before it starts.">
              <Select<number> label="Remind me" value={device.reminderLead} onChange={(reminderLead) => setDevice({ reminderLead })} options={REMINDER_LEADS.map((m) => ({ id: m, label: m === 60 ? '1 hour before' : `${m} min before` }))} />
            </Row>
            {blocked && (
              <div className="flex gap-2.5 bg-amber-400/[0.06] px-4 py-3 text-[13px] leading-relaxed text-amber-100/90">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <span>
                  {permission === 'denied'
                    ? 'Notifications are blocked for this site, so reminders only show inside the app. To change that, use the site settings next to the address bar.'
                    : 'This browser can’t show notifications, so reminders only show inside the app. On iPhone, install the app first.'}
                </span>
              </div>
            )}
            <ActionRow id="reminder-test" icon={BellRing} title="Send a test" hint="See how a reminder looks." onClick={() => void sendTestNotice()} />
          </>
        )}
      </Group>

      <Group title="Messages in the app">
        <ToggleRow id="budget-warnings" title="Budget warnings" hint="Say so when an item goes over its month’s budget or money left. It’s still marked red on the month." on={budgetWarnings} onChange={(on) => setPrefs({ budgetWarnings: on })} />
        <Row id="backup-reminder" title="Backup reminder" hint="A nudge to download a copy of your plan. On this device.">
          <Select<BackupEvery>
            label="Backup reminder"
            value={device.backupEvery}
            onChange={(backupEvery) => setDevice({ backupEvery })}
            options={[
              { id: 0, label: 'Off' },
              { id: 7, label: 'Every week' },
              { id: 30, label: 'Every month' },
            ]}
          />
        </Row>
      </Group>
    </>
  )
}

export function PrivacySection() {
  const device = useStore((s) => s.device)
  const privacyButton = useStore((s) => s.prefs.privacyButton)
  const { setDevice, setPrefs } = useStore.getState()

  function forget() {
    if (!confirm('Forget the calendar view, expense period, hidden task kinds and other small choices remembered on this device? Your plan isn’t touched.')) return
    try {
      const keep = new Set(['dizayr-goal-planner-v1', 'dizayr-app-version', 'dizayr-reminders-sent'])
      for (const k of Object.keys(localStorage)) if (k.startsWith('dizayr-') && !keep.has(k)) localStorage.removeItem(k)
      toast.success('Forgotten.')
    } catch {
      toast.error('Couldn’t reach this browser’s storage.')
    }
  }

  return (
    <>
      <Group title="Hide your money" hint="For using Dizayr around other people. Amounts show as ₱•••••• everywhere, until you turn this off or tap into a box to edit it.">
        <ToggleRow id="masked" title="Hide amounts" hint="On this device." on={device.masked} onChange={(masked) => setDevice({ masked })} />
        <ToggleRow id="mask-open" title="Always open with amounts hidden" hint="Starts hidden each time you open the app here." on={device.maskOnOpen} onChange={(maskOnOpen) => setDevice({ maskOnOpen })} />
        <ToggleRow title="Hide amounts button" hint="Keep this switch in the header, one tap away." on={privacyButton} onChange={(on) => setPrefs({ privacyButton: on })} />
      </Group>

      <Group title="This device">
        <ActionRow id="forget" icon={Eraser} title="Forget choices on this device" hint="Calendar view, expense period and other small things remembered here. Your plan isn’t touched." onClick={forget} />
      </Group>
    </>
  )
}
