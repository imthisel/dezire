import type { SettingsSection } from '../../settingsNav'

/**
 * Everything search can find. `id` is the setting's anchor (`id` on its Row). `words`: other things someone might type for it.
 */
export const SEARCH: { id: string; section: SettingsSection; title: string; words?: string }[] = [
  { id: 'profile', section: 'account', title: 'Your profile', words: 'name email photo google account member since' },
  { id: 'birthday', section: 'account', title: 'Birthday', words: 'age birth setup month' },
  { id: 'sync', section: 'account', title: 'Saving & sync', words: 'cloud offline saved status devices' },
  { id: 'signout', section: 'account', title: 'Sign out', words: 'log out logout leave' },

  { id: 'plan-status', section: 'plan', title: 'Your plan', words: 'subscription premium trial yearly lifetime membership renew' },
  { id: 'plan-modes', section: 'plan', title: 'Modes on your plan', words: 'limit unlimited' },
  { id: 'plan-billing', section: 'plan', title: 'Plans & billing', words: 'payment card cancel upgrade price invoice' },

  { id: 'accent', section: 'appearance', title: 'Accent colour', words: 'color theme highlight purple blue green teal rose orange' },
  { id: 'text-size', section: 'appearance', title: 'Text size', words: 'font bigger smaller zoom accessibility' },
  { id: 'glow', section: 'appearance', title: 'Background glow', words: 'light gradient colour background' },
  { id: 'calm', section: 'appearance', title: 'Reduce motion', words: 'animation accessibility movement' },
  { id: 'solid', section: 'appearance', title: 'Turn off blur', words: 'performance slow transparency glass smooth' },

  { id: 'export-import', section: 'layout', title: 'Export & Import buttons', words: 'hide header backup restore download upload' },
  { id: 'hide-reset', section: 'layout', title: 'Clear everything button', words: 'hide header reset delete' },
  { id: 'hide-currency', section: 'layout', title: 'Currency button', words: 'hide header exchange' },
  { id: 'hide-modes', section: 'layout', title: 'Modes button', words: 'hide header switch' },
  { id: 'privacy-button', section: 'layout', title: 'Hide amounts button', words: 'eye header privacy' },
  { id: 'nav', section: 'layout', title: 'Side menu & tab bar', words: 'hide pages favorites calendar expenses assets money plan navigation sidebar' },
  { id: 'sidebar', section: 'layout', title: 'Show the side menu', words: 'sidebar wide screens docked' },
  { id: 'start-page', section: 'layout', title: 'Open the app on', words: 'start home landing first page default' },
  { id: 'dash-mode', section: 'layout', title: 'Overview shows', words: 'whole plan selected year dashboard' },
  { id: 'asset-favorite', section: 'layout', title: 'Assets opens on', words: 'kind favorite default' },
  { id: 'charts', section: 'layout', title: 'Charts & cards', words: 'net worth chart spending graph hide overview' },
  { id: 'phone-cols', section: 'layout', title: 'Columns on phones', words: 'grid mobile pinch' },
  { id: 'open-months', section: 'layout', title: 'Unfold all months on phones', words: 'mobile collapse expand cards' },

  { id: 'main-currency', section: 'money', title: 'Main currency', words: 'peso dollar php usd sign code symbol' },
  { id: 'alt-currency', section: 'money', title: 'Alternative currency', words: 'second usd convert show hide' },
  { id: 'rate', section: 'money', title: 'Exchange rate', words: 'live today convert update' },
  { id: 'expense-period', section: 'money', title: 'Expenses opens on', words: 'week month year period default' },

  { id: 'week-start', section: 'calendar', title: 'Week starts on', words: 'sunday monday saturday first day' },
  { id: 'clock', section: 'calendar', title: 'Time format', words: '12 24 hour clock am pm military' },
  { id: 'cal-view', section: 'calendar', title: 'Calendar opens on', words: 'day week month 3 days default view' },
  { id: 'event-length', section: 'calendar', title: 'Usual event length', words: 'duration default new minutes hour' },

  { id: 'reminders', section: 'notifications', title: 'Event & task reminders', words: 'notification alert before push' },
  { id: 'reminder-lead', section: 'notifications', title: 'Remind me', words: 'minutes before early time' },
  { id: 'reminder-test', section: 'notifications', title: 'Send a test', words: 'notification try' },
  { id: 'budget-warnings', section: 'notifications', title: 'Budget warnings', words: 'over limit money left item fit' },
  { id: 'backup-reminder', section: 'notifications', title: 'Backup reminder', words: 'weekly monthly export' },

  { id: 'masked', section: 'privacy', title: 'Hide amounts', words: 'privacy blur money private public secret numbers' },
  { id: 'mask-open', section: 'privacy', title: 'Always open with amounts hidden', words: 'privacy start' },
  { id: 'forget', section: 'privacy', title: 'Forget choices on this device', words: 'clear local storage remembered reset' },

  { id: 'list-kinds', section: 'lists', title: 'Kinds of items', words: 'category property vehicle investment edit' },
  { id: 'list-areas', section: 'lists', title: 'Goal areas', words: 'edit yearly goals' },
  { id: 'list-cats', section: 'lists', title: 'Expense categories', words: 'food bills spending edit' },
  { id: 'list-places', section: 'lists', title: 'Places', words: 'stores saved expenses' },
  { id: 'list-tasks', section: 'lists', title: 'Kinds of tasks', words: 'school work colours calendar' },
  { id: 'list-modes', section: 'lists', title: 'Modes', words: 'versions plans rename delete copy' },

  { id: 'backup', section: 'data', title: 'Download a backup', words: 'export save json file' },
  { id: 'restore', section: 'data', title: 'Restore from a backup', words: 'import upload json file' },
  { id: 'data-buttons', section: 'data', title: 'Show Export & Import in the header', words: 'hide buttons' },
  { id: 'csv-expenses', section: 'data', title: 'Expenses spreadsheet', words: 'csv excel sheets export download' },
  { id: 'csv-items', section: 'data', title: 'Items spreadsheet', words: 'csv excel sheets export download assets' },
  { id: 'csv-goals', section: 'data', title: 'Goals spreadsheet', words: 'csv excel sheets export download' },
  { id: 'ics', section: 'data', title: 'Calendar file', words: 'ics google apple outlook export download' },
  { id: 'storage', section: 'data', title: 'Space used', words: 'storage size limit full' },
  { id: 'clear', section: 'data', title: 'Clear data', words: 'delete erase wipe reset everything' },

  { id: 'version', section: 'help', title: 'Version & updates', words: 'check update latest' },
  { id: 'install', section: 'help', title: 'Install the app', words: 'download pwa home screen offline' },
  { id: 'about-page', section: 'help', title: 'About Dizayr', words: 'website features pricing' },
  { id: 'shortcuts', section: 'help', title: 'Keyboard shortcuts', words: 'keys hotkeys' },
  { id: 'tips', section: 'help', title: 'Handy tips', words: 'help 100k drag copy pinch' },
  { id: 'reset-settings', section: 'help', title: 'Reset all settings', words: 'defaults restore' },
]

export function searchSettings(query: string) {
  const parts = query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  if (!parts.length) return []
  return SEARCH.filter((s) => {
    const text = `${s.title} ${s.words ?? ''}`.toLowerCase()
    return parts.every((p) => text.includes(p))
  })
}
