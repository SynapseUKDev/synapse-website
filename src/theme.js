const STORAGE_KEY = 'synapse-theme-preference'

/**
 * Listeners notified when the preference changes. The sidebar toggle and the Settings page
 * both mutate the theme and are mounted at the same time, so each needs to hear about the
 * other's change or the two controls drift out of sync.
 */
const listeners = new Set()

/**
 * Subscribe to preference changes.
 * @param {(preference: 'light' | 'dark') => void} listener
 * @returns {() => void} unsubscribe
 */
export function subscribe(listener) {
  if (typeof listener !== 'function') return () => {}
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** @returns {'light' | 'dark'} */
export function getStoredPreference() {
  try {
    let v = localStorage.getItem(STORAGE_KEY)
    if (v === 'system') {
      const resolved =
        typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
      try {
        localStorage.setItem(STORAGE_KEY, resolved)
      } catch {
        /* ignore */
      }
      return resolved
    }
    if (v === 'light' || v === 'dark') return v
  } catch {
    /* ignore */
  }
  return 'light'
}

/** Same as stored preference (no separate “system” mode). */
export function getResolvedTheme() {
  return getStoredPreference()
}

export function applyTheme(theme) {
  if (typeof document === 'undefined') return
  
  // Only allow dark mode on dashboard routes
  const isDashboard = typeof window !== 'undefined' && window.location.pathname.startsWith('/dashboard')
  const effectiveTheme = isDashboard ? theme : 'light'

  document.documentElement.setAttribute('data-theme', effectiveTheme)
  document.documentElement.style.colorScheme = effectiveTheme
}

/** @param {'light' | 'dark'} preference */
export function setPreference(preference) {
  if (preference !== 'light' && preference !== 'dark') return
  try {
    localStorage.setItem(STORAGE_KEY, preference)
  } catch {
    /* ignore */
  }
  applyTheme(getResolvedTheme())
  listeners.forEach((listener) => {
    // One misbehaving subscriber must not stop the others hearing the change, nor make
    // setPreference throw into the click handler that called it.
    try {
      listener(preference)
    } catch {
      /* ignore */
    }
  })
}

/** Call once at app startup (e.g. from main.jsx). */
export function initTheme() {
  applyTheme(getResolvedTheme())
}
