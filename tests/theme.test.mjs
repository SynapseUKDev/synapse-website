/**
 * Tests for the theme preference module.
 *
 * Plain `node`, no framework: the app has no test runner. `npm run test:theme`.
 *
 * `theme.js` reads `localStorage` and writes to `document.documentElement` at CALL time,
 * not at import time, so stubbing the globals before invoking anything is enough.
 *
 * What these guard: the sidebar toggle and the Settings page both change the theme, and they
 * are mounted at the same time (the sidebar lives in DashboardLayout, Settings renders in its
 * outlet). Without a subscription the two controls drift out of sync — Settings reads the
 * preference once via useState and never again.
 */

function installDom({ pathname = '/dashboard', prefersDark = false } = {}) {
  const store = new Map()
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  }
  const root = { attributes: {}, style: {}, setAttribute(k, v) { this.attributes[k] = v } }
  globalThis.document = { documentElement: root }
  globalThis.window = {
    location: { pathname },
    matchMedia: () => ({ matches: prefersDark }),
  }
  return { store, root }
}

let failed = 0
let passed = 0

function t(name, fn) {
  try {
    fn()
    passed++
    console.log(`  ok    ${name}`)
  } catch (e) {
    failed++
    console.log(`  FAIL  ${name}\n        ${e.message}`)
  }
}

function eq(got, want, what) {
  if (got !== want) {
    throw new Error(`${what}: got ${JSON.stringify(got)}, want ${JSON.stringify(want)}`)
  }
}

installDom()
const theme = await import('../src/theme.js')

console.log('\ntheme.subscribe / setPreference')

t('setPreference notifies subscribers with the new theme', () => {
  installDom()
  const seen = []
  theme.subscribe((v) => seen.push(v))
  theme.setPreference('dark')
  eq(seen.length, 1, 'notification count')
  eq(seen[0], 'dark', 'notified value')
})

t('subscribe returns an unsubscribe that stops notifications', () => {
  installDom()
  const seen = []
  const off = theme.subscribe((v) => seen.push(v))
  theme.setPreference('dark')
  off()
  theme.setPreference('light')
  eq(seen.length, 1, 'notification count after unsubscribe')
  eq(seen[0], 'dark', 'only the pre-unsubscribe value')
})

t('every subscriber hears the change, not just the first', () => {
  installDom()
  const seen = []
  theme.subscribe(() => seen.push('a'))
  theme.subscribe(() => seen.push('b'))
  theme.setPreference('dark')
  eq(seen.join(','), 'a,b', 'both subscribers notified')
})

t('a subscriber that throws does not stop the others or the theme change', () => {
  const { store } = installDom()
  const seen = []
  theme.subscribe(() => {
    throw new Error('subscriber exploded')
  })
  theme.subscribe(() => seen.push('survived'))
  theme.setPreference('dark')
  eq(seen.join(','), 'survived', 'later subscriber still notified')
  eq(store.get('synapse-theme-preference'), 'dark', 'preference still persisted')
})

t('an invalid preference is rejected and notifies nobody', () => {
  const { store } = installDom()
  const seen = []
  theme.subscribe((v) => seen.push(v))
  theme.setPreference('chartreuse')
  eq(seen.length, 0, 'notification count')
  eq(store.get('synapse-theme-preference'), undefined, 'nothing written')
})

console.log('\ntheme.getStoredPreference')

t('defaults to light when nothing is stored', () => {
  installDom()
  eq(theme.getStoredPreference(), 'light', 'default')
})

t('migrates the legacy "system" value using the OS preference', () => {
  // This branch exists in the shipped code; the toggle must not break it for users whose
  // stored preference predates the light/dark-only simplification.
  const { store } = installDom({ prefersDark: true })
  store.set('synapse-theme-preference', 'system')
  eq(theme.getStoredPreference(), 'dark', 'resolved value')
  eq(store.get('synapse-theme-preference'), 'dark', 'migrated in storage')
})

t('applyTheme forces light outside /dashboard', () => {
  // Dark mode is dashboard-only by design (theme.js). The sidebar toggle lives inside
  // /dashboard, but this guards the rule it depends on.
  const { root } = installDom({ pathname: '/pricing' })
  theme.applyTheme('dark')
  eq(root.attributes['data-theme'], 'light', 'data-theme outside dashboard')
})

console.log(`\n${passed} passed, ${failed} failed\n`)
process.exit(failed === 0 ? 0 : 1)
