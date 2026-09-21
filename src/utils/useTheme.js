import { useEffect, useState } from 'react'
import { getStoredPreference, setPreference, subscribe } from '../theme'

/**
 * The current theme preference plus a setter, kept in sync across every control that can
 * change it.
 *
 * The sidebar toggle and the Settings page are mounted at the same time — the sidebar lives
 * in DashboardLayout, Settings renders in its outlet — so a control that read the preference
 * once into local state would show a stale value as soon as the other one changed it.
 *
 * @returns {['light' | 'dark', (preference: 'light' | 'dark') => void]}
 */
export default function useTheme() {
  const [theme, setTheme] = useState(() => getStoredPreference())

  useEffect(() => {
    // Re-read on mount as well as subscribing: the preference can change between the
    // useState initialiser running and this effect attaching.
    setTheme(getStoredPreference())
    return subscribe(setTheme)
  }, [])

  return [theme, setPreference]
}
