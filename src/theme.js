const STORAGE_KEY = 'synapse-theme-preference'

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
}

/** Call once at app startup (e.g. from main.jsx). */
export function initTheme() {
  applyTheme(getResolvedTheme())
}
